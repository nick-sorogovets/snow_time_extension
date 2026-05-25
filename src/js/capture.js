const DEFAULT_MAX_PAGE_HEIGHT = 15000;
const MAX_PAGE_HEIGHT_HARD_CAP = 32000;
const MIN_PAGE_HEIGHT_CAP = 1000;
/** Chrome allows ~2 captureVisibleTab calls/sec (MAX_CAPTURE_VISIBLE_TAB_CALLS_PER_SECOND). */
const SCROLL_DELAY_MS = 150;
const MIN_CAPTURE_INTERVAL_MS = 550;
const CAPTURE_QUOTA_RETRIES = 4;

function captureVisibleTab(windowId) {
	return new Promise((resolve, reject) => {
		const cb = (dataUrl) => {
			if (chrome.runtime.lastError) {
				reject(new Error(chrome.runtime.lastError.message));
				return;
			}
			resolve(dataUrl);
		};
		if (windowId == null) {
			chrome.tabs.captureVisibleTab({ format: 'png' }, cb);
		} else {
			chrome.tabs.captureVisibleTab(windowId, { format: 'png' }, cb);
		}
	});
}

function isCaptureQuotaError(message) {
	return String(message).includes('MAX_CAPTURE_VISIBLE_TAB');
}

async function captureVisibleTabRateLimited(windowId, lastCaptureAtRef) {
	const elapsed = Date.now() - lastCaptureAtRef.value;
	if (lastCaptureAtRef.value > 0 && elapsed < MIN_CAPTURE_INTERVAL_MS) {
		await delay(MIN_CAPTURE_INTERVAL_MS - elapsed);
	}

	for (let attempt = 0; attempt <= CAPTURE_QUOTA_RETRIES; attempt++) {
		try {
			const dataUrl = await captureVisibleTab(windowId);
			lastCaptureAtRef.value = Date.now();
			return dataUrl;
		} catch (err) {
			if (isCaptureQuotaError(err?.message) && attempt < CAPTURE_QUOTA_RETRIES) {
				const backoff = MIN_CAPTURE_INTERVAL_MS * (attempt + 1);
				console.warn(`[snow] capture quota exceeded, retry in ${backoff}ms`);
				await delay(backoff);
				continue;
			}
			throw err;
		}
	}
}

function delay(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function execInTab(tabId, func, args = []) {
	const results = await chrome.scripting.executeScript({
		target: { tabId },
		func,
		args,
	});
	return results[0]?.result;
}

async function loadCaptureBitmap(dataUrl) {
	const response = await fetch(dataUrl);
	const blob = await response.blob();
	return createImageBitmap(blob);
}

async function canvasToDataUrl(canvas) {
	if (typeof canvas.convertToBlob === 'function') {
		const blob = await canvas.convertToBlob({ type: 'image/png' });
		const buffer = await blob.arrayBuffer();
		const bytes = new Uint8Array(buffer);
		let binary = '';
		for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
		return `data:image/png;base64,${btoa(binary)}`;
	}
	return canvas.toDataURL('image/png');
}

async function stitchCaptures(captures, pageWidth, pageHeight, viewportHeight, dpr) {
	const canvasWidth = Math.round(pageWidth * dpr);
	const canvasHeight = Math.round(pageHeight * dpr);
	const canvas =
		typeof OffscreenCanvas !== 'undefined'
			? new OffscreenCanvas(canvasWidth, canvasHeight)
			: (() => {
					const el = document.createElement('canvas');
					el.width = canvasWidth;
					el.height = canvasHeight;
					return el;
			  })();
	const ctx = canvas.getContext('2d');
	ctx.fillStyle = '#ffffff';
	ctx.fillRect(0, 0, canvasWidth, canvasHeight);

	for (const cap of captures) {
		const img = await loadCaptureBitmap(cap.dataUrl);
		const drawY = Math.round(cap.actualY * dpr);

		if (cap.index > 0) {
			const expectedY = cap.index * viewportHeight;
			const drift = expectedY - cap.actualY;
			if (drift > 0) {
				const overlapPx = Math.round(drift * dpr);
				ctx.drawImage(
					img,
					0,
					overlapPx,
					img.width,
					img.height - overlapPx,
					0,
					drawY + overlapPx,
					img.width,
					img.height - overlapPx
				);
				img.close?.();
				continue;
			}
		}

		ctx.drawImage(img, 0, drawY);
		img.close?.();
	}

	return canvasToDataUrl(canvas);
}

async function measurePageInTab(tabId, maxHeight) {
	return execInTab(
		tabId,
		(cap) => {
			const html = document.documentElement;
			const body = document.body;
			const savedX = window.scrollX;
			const savedY = window.scrollY;
			const savedScrollBehavior = html.style.scrollBehavior;
			const savedBodyScrollBehavior = body ? body.style.scrollBehavior : '';
			html.style.scrollBehavior = 'auto';
			if (body) body.style.scrollBehavior = 'auto';

			const candidatesHeight = [
				html.scrollHeight,
				html.offsetHeight,
				html.clientHeight,
				body ? body.scrollHeight : 0,
				body ? body.offsetHeight : 0,
			];
			window.scrollTo(0, 1e9);
			const probedY = window.scrollY + window.innerHeight;
			candidatesHeight.push(probedY);

			const candidatesWidth = [
				html.scrollWidth,
				html.offsetWidth,
				html.clientWidth,
				body ? body.scrollWidth : 0,
				body ? body.offsetWidth : 0,
				window.innerWidth,
			];

			window.scrollTo(savedX, savedY);
			html.style.scrollBehavior = savedScrollBehavior;
			if (body) body.style.scrollBehavior = savedBodyScrollBehavior;

			const width = Math.max.apply(null, candidatesWidth.filter(Number.isFinite));
			let height = Math.max.apply(null, candidatesHeight.filter(Number.isFinite));
			if (Number.isFinite(cap) && cap > 0) height = Math.min(height, cap);

			return {
				width,
				height,
				viewportHeight: window.innerHeight,
				viewportWidth: window.innerWidth,
				scrollX: savedX,
				scrollY: savedY,
				dpr: window.devicePixelRatio || 1,
			};
		},
		[maxHeight]
	);
}

async function scrollTabTo(tabId, y) {
	return execInTab(
		tabId,
		(yy) => {
			const html = document.documentElement;
			const body = document.body;
			const savedScrollBehavior = html.style.scrollBehavior;
			const savedBodyScrollBehavior = body ? body.style.scrollBehavior : '';
			html.style.scrollBehavior = 'auto';
			if (body) body.style.scrollBehavior = 'auto';
			window.scrollTo(0, yy);
			html.style.scrollBehavior = savedScrollBehavior;
			if (body) body.style.scrollBehavior = savedBodyScrollBehavior;
			return window.scrollY;
		},
		[y]
	);
}

async function hideFixedInTab(tabId) {
	return execInTab(tabId, () => {
		const hidden = [];
		const all = document.querySelectorAll('*');
		for (let i = 0; i < all.length; i++) {
			const el = all[i];
			const pos = getComputedStyle(el).position;
			if (pos === 'fixed' || pos === 'sticky') {
				hidden.push({ el, vis: el.style.visibility });
				el.style.visibility = 'hidden';
			}
		}
		window.__snowHiddenFixed = hidden;
		return hidden.length;
	});
}

async function restoreFixedInTab(tabId) {
	return execInTab(tabId, () => {
		const hidden = window.__snowHiddenFixed || [];
		for (const item of hidden) {
			if (item.el && item.el.style) item.el.style.visibility = item.vis;
		}
		delete window.__snowHiddenFixed;
	});
}

function clampMaxHeight(maxHeight) {
	if (!Number.isFinite(maxHeight)) return DEFAULT_MAX_PAGE_HEIGHT;
	return Math.min(MAX_PAGE_HEIGHT_HARD_CAP, Math.max(MIN_PAGE_HEIGHT_CAP, Math.round(maxHeight)));
}

async function captureFullPage(tabId, windowId, maxHeight) {
	const cap = clampMaxHeight(maxHeight);
	const metrics = await measurePageInTab(tabId, cap);
	if (!metrics?.height || !metrics?.viewportHeight) {
		throw new Error('Could not measure page dimensions');
	}

	const { width, height, viewportHeight, scrollX, scrollY, dpr } = metrics;
	console.log('[snow] full page metrics', metrics);

	const lastCaptureAtRef = { value: 0 };

	if (height <= viewportHeight + 4) {
		return captureVisibleTabRateLimited(windowId, lastCaptureAtRef);
	}

	const totalSlices = Math.ceil(height / viewportHeight);
	const captures = [];

	for (let i = 0; i < totalSlices; i++) {
		const targetY = i * viewportHeight;
		const actualY = await scrollTabTo(tabId, targetY);
		await delay(SCROLL_DELAY_MS);

		if (i === 1) {
			await hideFixedInTab(tabId);
		}

		const dataUrl = await captureVisibleTabRateLimited(windowId, lastCaptureAtRef);

		captures.push({
			dataUrl,
			actualY: typeof actualY === 'number' ? actualY : targetY,
			index: i,
		});
		console.log(`[snow] slice ${i + 1}/${totalSlices} at y=${actualY}`);
	}

	await restoreFixedInTab(tabId);
	await scrollTabTo(tabId, scrollY);
	void scrollX;

	return stitchCaptures(captures, width, height, viewportHeight, dpr);
}

export async function captureTab({ tabId, windowId, mode = 'visible', maxHeight }) {
	if (!tabId) {
		throw new Error('No active tab');
	}

	try {
		if (mode === 'full_page') {
			return await captureFullPage(tabId, windowId, maxHeight);
		}
		return await captureVisibleTab(windowId);
	} catch (err) {
		const msg = err?.message || String(err);
		if (
			msg.includes('Cannot access') ||
			msg.includes('extensions gallery') ||
			msg.includes('chrome://') ||
			msg.includes('Cannot capture')
		) {
			throw new Error('capture_restricted');
		}
		throw err;
	}
}

export { captureVisibleTab };
