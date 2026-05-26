import {
	getAuthToken,
	GetSubFolderList,
	CreateFolder,
	captureTab,
	UploadScreenshot,
	finalizeUploadedFile,
} from './api.js';
import { qs, show, hide, toggle, setBusy, on } from './ui.js';
import { initI18n, t } from './i18n.js';
import { buildScreenshotFilename, isExtensionConfigured } from './filename.js';
import { initTheme, watchTheme } from './theme.js';
import { buildPickerUrl } from './picker-url.js';

const PENDING_TARGET_TTL_MS = 5 * 60 * 1000;

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
	theme: 'system',
	screenshot_mode: 'visible',
	max_page_height: 15000,
};

const els = {};
const state = {
	settings: { ...DEFAULTS },
	token: null,
	rootFolder: null,
	currentFolder: null,
	breadcrumb: [],
	dataUrl: null,
	filename: null,
	captureTabUrl: null,
	uploadedFile: null,
};

function setAuthState(kind, labelKey) {
	els.authPill.dataset.state = kind;
	els.authText.textContent = t(labelKey);
	if (kind === 'connected') {
		hide(els.authorizeBtn);
	} else {
		show(els.authorizeBtn);
	}
}

function setBanner(kind, html) {
	els.statusBanner.className = `banner banner-${kind}`;
	els.statusBanner.innerHTML = '';
	if (typeof html === 'string') {
		els.statusBanner.append(document.createTextNode(html));
	} else if (html instanceof Node) {
		els.statusBanner.append(html);
	}
	show(els.statusBanner);
}

function clearBanner() {
	hide(els.statusBanner);
	els.statusBanner.replaceChildren();
}

function renderBreadcrumb() {
	els.breadcrumb.replaceChildren();
	if (!state.breadcrumb.length) {
		const span = document.createElement('span');
		span.className = 'muted';
		span.textContent = t('no_folder_selected');
		els.breadcrumb.append(span);
		return;
	}
	state.breadcrumb.forEach((node, i) => {
		const a = document.createElement('button');
		a.type = 'button';
		a.className = 'crumb';
		a.textContent = node.name;
		a.addEventListener('click', () => navigateTo(i));
		els.breadcrumb.append(a);
		if (i < state.breadcrumb.length - 1) {
			const sep = document.createElement('span');
			sep.className = 'crumb-sep';
			sep.textContent = '›';
			els.breadcrumb.append(sep);
		}
	});
}

function renderFolderList(folders) {
	els.foldersList.replaceChildren();
	if (!folders.length) {
		const li = document.createElement('li');
		li.className = 'folder-empty muted';
		li.textContent = t('no_subfolders');
		els.foldersList.append(li);
		show(els.foldersList);
		return;
	}
	folders.forEach((folder) => {
		const li = document.createElement('li');
		li.className = 'folder-item';
		li.tabIndex = 0;
		li.setAttribute('role', 'option');

		const ico = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
		ico.setAttribute('aria-hidden', 'true');
		ico.classList.add('folder-ico');
		const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
		use.setAttribute('href', '#i-folder');
		ico.append(use);

		const name = document.createElement('span');
		name.textContent = folder.name;

		li.append(ico, name);
		li.addEventListener('click', () => enterFolder(folder));
		li.addEventListener('keydown', (e) => {
			if (e.key === 'Enter' || e.key === ' ') {
				e.preventDefault();
				enterFolder(folder);
			}
		});
		els.foldersList.append(li);
	});
	show(els.foldersList);
}

async function loadFolderListing(folder) {
	if (!state.token) return;
	setBusy(els.browseBtn, true);
	try {
		const folders = await GetSubFolderList(state.token, folder.id);
		renderFolderList(folders);
	} catch (err) {
		console.error(err);
		setBanner('error', t('err_list_folders', { error: err.message }));
	} finally {
		setBusy(els.browseBtn, false);
	}
}

function navigateTo(index) {
	state.breadcrumb = state.breadcrumb.slice(0, index + 1);
	state.currentFolder = state.breadcrumb[state.breadcrumb.length - 1];
	renderBreadcrumb();
	loadFolderListing(state.currentFolder);
}

function enterFolder(folder) {
	state.breadcrumb.push(folder);
	state.currentFolder = folder;
	renderBreadcrumb();
	loadFolderListing(folder);
}

async function handleNewSubfolder() {
	if (!state.token || !state.currentFolder) return;
	const raw = window.prompt(t('prompt_new_folder'), '');
	if (!raw) return;
	const name = raw.trim();
	if (!name) return;
	clearBanner();
	setBusy(els.newFolderBtn, true);
	try {
		const existing = await GetSubFolderList(state.token, state.currentFolder.id);
		const match = existing.find(
			(f) => f.name.toLowerCase() === name.toLowerCase()
		);
		if (match) {
			enterFolder({ id: match.id, name: match.name });
			setBanner('ok', t('banner_reuse_folder', { name: match.name }));
			return;
		}
		const folder = await CreateFolder(state.token, name, state.currentFolder.id);
		enterFolder({ id: folder.id, name: folder.name });
		setBanner('ok', t('banner_created_folder', { name: folder.name }));
	} catch (err) {
		console.error(err);
		setBanner('error', t('err_create_folder', { error: err.message }));
	} finally {
		setBusy(els.newFolderBtn, false);
	}
}

function openPicker(intent) {
	chrome.tabs.create({ url: buildPickerUrl(intent) });
	setBanner('ok', t('banner_picker_opened'));
}

function handlePickFolder() {
	openPicker('set-upload-target');
}

async function applyPendingUploadTarget() {
	const { pending_upload_target: pending } = await chrome.storage.session.get(
		'pending_upload_target'
	);
	if (!pending || !pending.id) return;

	if (Date.now() - (pending.ts || 0) > PENDING_TARGET_TTL_MS) {
		await chrome.storage.session.remove('pending_upload_target');
		return;
	}

	await chrome.storage.session.remove('pending_upload_target');

	const root = state.rootFolder;
	if (!root) return;

	const idx = state.breadcrumb.findIndex((n) => n.id === pending.id);
	if (idx >= 0) {
		state.breadcrumb = state.breadcrumb.slice(0, idx + 1);
	} else {
		state.breadcrumb = [root, { id: pending.id, name: pending.name }];
	}
	state.currentFolder = { id: pending.id, name: pending.name };
	renderBreadcrumb();
	setBanner('ok', t('banner_upload_target', { name: pending.name }));
}

async function takeScreenshot() {
	clearBanner();
	const isFullPage = (state.settings.screenshot_mode || 'visible') === 'full_page';
	if (isFullPage) {
		els.captureBtn.classList.add('capture-progress');
	}
	setBusy(els.captureBtn, true, isFullPage ? { label: t('capturing') } : undefined);
	try {
		const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
		const dataUrl = await captureTab({
			tabId: tab?.id,
			windowId: tab?.windowId,
			mode: state.settings.screenshot_mode || 'visible',
			maxHeight: state.settings.max_page_height || DEFAULTS.max_page_height,
		});
		state.dataUrl = dataUrl;
		state.captureTabUrl = tab?.url || null;
		state.filename = await buildScreenshotFilename(state.settings, state.captureTabUrl, {
			advanceIncrement: false,
		});
		els.preview.src = dataUrl;
		els.preview.alt = state.filename;
		show(els.previewSection);
		els.uploadBtn.disabled = !state.token;
	} catch (err) {
		console.error(err);
		if (err.message === 'capture_restricted') {
			setBanner('error', t('err_capture_restricted'));
		} else {
			setBanner('error', t('err_capture', { error: err.message }));
		}
	} finally {
		setBusy(els.captureBtn, false);
		els.captureBtn.classList.remove('capture-progress');
	}
}

async function uploadScreenshot() {
	if (!state.dataUrl || !state.currentFolder || !state.token) return;
	clearBanner();
	setBusy(els.uploadBtn, true);
	try {
		const filename = await buildScreenshotFilename(state.settings, state.captureTabUrl, {
			advanceIncrement: true,
		});
		state.filename = filename;
		let file = await UploadScreenshot({
			token: state.token,
			folderId: state.currentFolder.id,
			dataUrl: state.dataUrl,
			filename,
		});
		let shareLink = null;
		if (state.settings.copy_link_after_upload) {
			try {
				({ file, shareLink } = await finalizeUploadedFile({
					token: state.token,
					file,
					shareLink: true,
				}));
				if (shareLink) {
					await navigator.clipboard.writeText(shareLink);
				}
			} catch (shareErr) {
				console.error(shareErr);
				setBanner(
					'error',
					t('err_share_link', { name: file.name, error: shareErr.message })
				);
				state.uploadedFile = file;
				return;
			}
		}
		state.uploadedFile = file;
		const wrap = document.createElement('div');
		const checkSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
		checkSvg.setAttribute('aria-hidden', 'true');
		checkSvg.classList.add('banner-icon');
		const useEl = document.createElementNS('http://www.w3.org/2000/svg', 'use');
		useEl.setAttribute('href', '#i-check');
		checkSvg.append(useEl);
		const text = document.createElement('span');
		text.textContent = shareLink
			? `${t('banner_uploaded_link_copied', { name: file.name })} `
			: `${t('banner_uploaded', { name: file.name })} `;
		const link = document.createElement('a');
		link.href = '#';
		link.textContent = t('open_in_drive');
		link.addEventListener('click', (e) => {
			e.preventDefault();
			if (file.webViewLink) chrome.tabs.create({ url: file.webViewLink });
		});
		wrap.append(checkSvg, text, link);
		setBanner('ok', wrap);
	} catch (err) {
		console.error(err);
		setBanner('error', t('err_upload', { error: err.message }));
	} finally {
		setBusy(els.uploadBtn, false);
	}
}

async function tryAuth({ interactive }) {
	try {
		const token = await getAuthToken({ interactive });
		state.token = token;
		setAuthState('connected', 'auth_connected');
		els.uploadBtn.disabled = !state.dataUrl;
		return token;
	} catch (err) {
		state.token = null;
		if (interactive) {
			setAuthState('disconnected', 'auth_sign_in_failed');
		} else {
			setAuthState('disconnected', 'auth_sign_in');
		}
		els.uploadBtn.disabled = true;
		if (interactive) {
			setBanner('error', t('err_sign_in', { error: err.message }));
		}
		return null;
	}
}

function showOptionsError() {
	const url = chrome.runtime.getURL('options.html') + '?origin=popup.html';
	els.optionsUrl.href = url;
	els.optionsUrl.addEventListener('click', (e) => {
		e.preventDefault();
		chrome.runtime.openOptionsPage();
	});
	show(els.optionsError);
	els.captureBtn.disabled = true;
	els.browseBtn.disabled = true;
}

async function init() {
	const items = await new Promise((resolve) => chrome.storage.sync.get(DEFAULTS, resolve));
	state.settings = items;

	if (!isExtensionConfigured(items)) {
		showOptionsError();
		return;
	}

	state.rootFolder = {
		id: items.folder_id,
		name: items.folder_name || t('drive_folder_default'),
	};
	state.currentFolder = state.rootFolder;
	state.breadcrumb = [state.rootFolder];
	renderBreadcrumb();

	await tryAuth({ interactive: false });

	await applyPendingUploadTarget();

	if (items.auto_screenshot) {
		await takeScreenshot();
	}
}

document.addEventListener('DOMContentLoaded', async () => {
	els.captureBtn = qs('#capture-btn');
	els.uploadBtn = qs('#upload-btn');
	els.authorizeBtn = qs('#authorize-btn');
	els.browseBtn = qs('#browse-folders-btn');
	els.pickFolderBtn = qs('#pick-folder-btn');
	els.newFolderBtn = qs('#new-folder-btn');
	els.foldersList = qs('#folders-list');
	els.breadcrumb = qs('#folder-breadcrumb');
	els.preview = qs('#screenshot-preview');
	els.previewSection = qs('#preview-section');
	els.statusBanner = qs('#status-banner');
	els.authPill = qs('#auth-pill');
	els.authText = qs('#auth-text');
	els.optionsError = qs('#options-error');
	els.optionsUrl = qs('#options-url');
	els.openOptions = qs('#open-options');

	await initTheme();
	watchTheme();
	await initI18n();

	on(els.captureBtn, 'click', takeScreenshot);
	on(els.uploadBtn, 'click', uploadScreenshot);
	on(els.authorizeBtn, 'click', () => tryAuth({ interactive: true }));
	on(els.browseBtn, 'click', () => {
		if (!state.token) return;
		toggle(els.foldersList, els.foldersList.classList.contains('hidden'));
		if (!els.foldersList.classList.contains('hidden')) {
			loadFolderListing(state.currentFolder);
		}
	});
	on(els.newFolderBtn, 'click', handleNewSubfolder);
	on(els.pickFolderBtn, 'click', handlePickFolder);
	on(els.preview, 'click', () => els.previewSection.classList.toggle('zoomed'));
	on(els.openOptions, 'click', (e) => {
		e.preventDefault();
		chrome.runtime.openOptionsPage();
	});

	await init();
});
