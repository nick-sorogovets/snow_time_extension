import {
	getAuthToken,
	GetSubFolderList,
	CreateFolder,
	captureTab,
	UploadScreenshot,
	finalizeUploadedFile,
	GetCurrentWindow,
} from './api.js';
import { initI18n, t } from './i18n.js';
import { buildScreenshotFilename, isExtensionConfigured } from './filename.js';

const DEFAULTS = {
	folder_id: '',
	folder_name: '',
	username: '',
	filename_use_domain: false,
	filename_postfix: 'short_date',
	auto_screenshot: false,
	auto_upload: false,
	copy_link_after_upload: false,
	language: 'en',
	screenshot_mode: 'visible',
	max_page_height: 15000,
};

const PICKER_ORIGIN = 'https://nick-sorogovets.github.io/snow_time_extension/';

const cache = {
	uploadInFlight: false,
	weekFolderByName: new Map(),
};

function getSettings() {
	return new Promise((resolve) => chrome.storage.sync.get(DEFAULTS, resolve));
}

async function ensureI18n() {
	await initI18n();
}

function notify(id, titleKey, message) {
	chrome.notifications.create(id, {
		type: 'basic',
		iconUrl: chrome.runtime.getURL('img/icon_48.png'),
		title: t(titleKey),
		message,
	});
}

async function ensureWeekFolder(token, rootId, weekName) {
	const cached = cache.weekFolderByName.get(`${rootId}:${weekName}`);
	if (cached) return cached;

	const subfolders = await GetSubFolderList(token, rootId);
	let folder = subfolders.find((f) => f.name === weekName);
	if (!folder) {
		folder = await CreateFolder(token, weekName, rootId);
	}
	cache.weekFolderByName.set(`${rootId}:${weekName}`, folder);
	return folder;
}

async function handleInit({ week_name }) {
	const settings = await getSettings();
	if (!settings.folder_id || !settings.auto_upload) return null;

	const token = await getAuthToken({ interactive: false }).catch(() => null);
	if (!token) return null;

	try {
		return await ensureWeekFolder(token, settings.folder_id, week_name);
	} catch (err) {
		console.error('ensureWeekFolder failed', err);
		await ensureI18n();
		notify('snow-week-failed', 'app_name', t('err_week_folder', { name: week_name }));
		return null;
	}
}

async function handleSubmitPressed({ week_name }) {
	if (cache.uploadInFlight) return null;
	cache.uploadInFlight = true;
	try {
		const settings = await getSettings();
		if (!isExtensionConfigured(settings)) return null;

		await ensureI18n();

		const token = await getAuthToken({ interactive: false }).catch(() => null);
		if (!token) {
			notify('snow-auth-needed', 'app_name', t('err_auth_needed'));
			return null;
		}

		const target = week_name
			? await ensureWeekFolder(token, settings.folder_id, week_name)
			: { id: settings.folder_id };

		const win = await GetCurrentWindow();
		const [tab] = await chrome.tabs.query({ active: true, windowId: win.id });
		const dataUrl = await captureTab({
			tabId: tab?.id,
			windowId: tab?.windowId ?? win.id,
			mode: settings.screenshot_mode || 'visible',
			maxHeight: settings.max_page_height || DEFAULTS.max_page_height,
		});
		const filename = await buildScreenshotFilename(settings, tab?.url, {
			advanceIncrement: true,
		});

		let file = await UploadScreenshot({
			token,
			folderId: target.id,
			dataUrl,
			filename,
		});
		let shareLink = null;
		if (settings.copy_link_after_upload) {
			try {
				({ file, shareLink } = await finalizeUploadedFile({
					token,
					file,
					shareLink: true,
				}));
				if (shareLink) {
					try {
						await navigator.clipboard.writeText(shareLink);
					} catch (err) {
						console.warn('clipboard write failed', err);
					}
				}
			} catch (shareErr) {
				console.error(shareErr);
				notify(
					'snow-upload-ok',
					'app_name',
					t('err_share_link', { name: file.name, error: shareErr.message })
				);
				return file;
			}
		}
		notify(
			'snow-upload-ok',
			'app_name',
			shareLink
				? t('notify_uploaded_link_copied', { name: file.name })
				: t('notify_uploaded', { name: file.name })
		);
		return file;
	} catch (err) {
		console.error('submit upload failed', err);
		await ensureI18n();
		notify('snow-upload-failed', 'app_name', t('err_upload', { error: err.message }));
		return null;
	} finally {
		cache.uploadInFlight = false;
	}
}

function isAllowedPickerSender(sender) {
	return Boolean(sender.url && sender.url.startsWith(PICKER_ORIGIN));
}

async function handlePickerResult({ intent, folder }) {
	if (!folder || !folder.id) return;

	await ensureI18n();

	if (intent === 'set-root') {
		await chrome.storage.sync.set({
			folder_id: folder.id,
			folder_name: folder.name,
		});
	} else if (intent === 'set-upload-target') {
		await chrome.storage.session.set({
			pending_upload_target: { id: folder.id, name: folder.name, ts: Date.now() },
		});
	}
	notify('snow-picker-ok', 'app_name', t('notify_picker_selected', { name: folder.name }));
}

chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
	if (!isAllowedPickerSender(sender)) {
		sendResponse({ error: 'forbidden' });
		return false;
	}
	if (!message || typeof message.type !== 'string') {
		sendResponse({ error: 'invalid message' });
		return false;
	}

	switch (message.type) {
		case 'request-token':
			getAuthToken({ interactive: true })
				.then((token) => sendResponse({ token }))
				.catch((err) => sendResponse({ error: err.message }));
			return true;
		case 'picker-result':
			handlePickerResult(message)
				.then(() => sendResponse({ ok: true }))
				.catch((err) => sendResponse({ error: err.message }));
			return true;
		case 'picker-cancel':
			sendResponse({ ok: true });
			return false;
		default:
			sendResponse({ error: 'unknown type' });
			return false;
	}
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
	if (!message || typeof message.action !== 'string') return false;

	switch (message.action) {
		case 'ping':
			sendResponse({ ok: true, id: chrome.runtime.id });
			return false;
		case 'init':
			handleInit(message).then(sendResponse);
			return true;
		case 'submit_pressed':
			handleSubmitPressed(message).then(sendResponse);
			return true;
		case 'get_submit_label':
			ensureI18n()
				.then(() => sendResponse({ label: t('submit_upload') }))
				.catch(() => sendResponse({ label: 'Submit & Upload' }));
			return true;
		default:
			return false;
	}
});

chrome.notifications.onClicked.addListener(async (id) => {
	if (id === 'snow-auth-needed') {
		await getAuthToken({ interactive: true }).catch(() => {});
	}
	chrome.notifications.clear(id);
});

chrome.runtime.onInstalled.addListener(async (details) => {
	if (details.reason !== 'update') return;
	const items = await new Promise((resolve) => chrome.storage.sync.get(null, resolve));
	if (items.folder_url && !items.folder_id) {
		chrome.storage.sync.remove('folder_url');
		await ensureI18n();
		notify('snow-rescope', 'app_name', t('notify_rescope'));
		chrome.runtime.openOptionsPage();
	}
});

ensureI18n();
