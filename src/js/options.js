import { getAuthToken, CreateFolder, GetFile } from './api.js';
import { qs, qsa, show, hide, setBusy, setStatus, on } from './ui.js';
import { initI18n, t, applyI18n, LOCALE_LABELS } from './i18n.js';
import { initTheme, applyTheme, THEME_DEFAULT, VALID_THEMES } from './theme.js';
import { samplePostfix } from './filename.js';
import { buildPickerUrl } from './picker-url.js';

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
	theme: THEME_DEFAULT,
	screenshot_mode: 'visible',
	max_page_height: 15000,
};

const MAX_PAGE_HEIGHT_MIN = 1000;
const MAX_PAGE_HEIGHT_MAX = 32000;

const els = {};

function populateLanguageSelect(selected) {
	els.language.replaceChildren();
	for (const [code, label] of Object.entries(LOCALE_LABELS)) {
		const opt = document.createElement('option');
		opt.value = code;
		opt.textContent = label;
		if (code === selected) opt.selected = true;
		els.language.append(opt);
	}
}

function getSelectedTheme() {
	const active = els.themeOptions.find((btn) => btn.classList.contains('is-active'));
	return active?.dataset.themeValue || THEME_DEFAULT;
}

function setThemeSelection(theme) {
	const value = VALID_THEMES.has(theme) ? theme : THEME_DEFAULT;
	for (const btn of els.themeOptions) {
		const selected = btn.dataset.themeValue === value;
		btn.classList.toggle('is-active', selected);
		btn.setAttribute('aria-checked', selected ? 'true' : 'false');
	}
}

async function handleThemeChange(theme) {
	if (!VALID_THEMES.has(theme)) return;
	setThemeSelection(theme);
	applyTheme(theme);
	await chrome.storage.sync.set({ theme });
}

function updateFilenameHints() {
	const useDomain = els.filenameUseDomain.checked;
	const postfixMode = els.filenamePostfix.value || DEFAULTS.filename_postfix;
	const locale = els.language.value || 'en';
	const postfixSample = samplePostfix(postfixMode, { locale });
	const example = useDomain
		? `bool.dev_${postfixSample}.png`
		: `nick_${postfixSample}.png`;

	if (useDomain) {
		hide(els.filenamePrefixField);
		hide(els.filenameHintPrefix);
		show(els.filenameHintDomain);
		els.filenameHintDomain.textContent = t('filename_hint_domain', { example });
	} else {
		show(els.filenamePrefixField);
		show(els.filenameHintPrefix);
		hide(els.filenameHintDomain);
		els.filenameHintPrefix.textContent = t('filename_hint_prefix', { example });
	}

	els.filenamePostfixHint.textContent = t('filename_postfix_hint', { example: postfixSample });
}

function syncFilenamePrefixUi() {
	updateFilenameHints();
}

function syncScreenshotModeUi() {
	const isFullPage = els.screenshotMode.value === 'full_page';
	if (isFullPage) {
		show(els.maxPageHeightField);
	} else {
		hide(els.maxPageHeightField);
	}
}

function loadSettings() {
	chrome.storage.sync.get(DEFAULTS, (items) => {
		els.folderName.value = items.folder_name || '';
		els.folderId.value = items.folder_id || '';
		els.username.value = items.username || '';
		els.filenameUseDomain.checked = !!items.filename_use_domain;
		els.filenamePostfix.value = items.filename_postfix || DEFAULTS.filename_postfix;
		els.autoScreenshot.checked = !!items.auto_screenshot;
		els.autoUpload.checked = !!items.auto_upload;
		els.copyLinkAfterUpload.checked = !!items.copy_link_after_upload;
		els.screenshotMode.value = items.screenshot_mode || 'visible';
		els.maxPageHeight.value = String(items.max_page_height || DEFAULTS.max_page_height);
		populateLanguageSelect(items.language || 'en');
		setThemeSelection(items.theme || THEME_DEFAULT);
		syncFilenamePrefixUi();
		syncScreenshotModeUi();
	});
}

function openPicker(intent) {
	chrome.tabs.create({ url: buildPickerUrl(intent) });
	setStatus(els.status, t('status_picker_opened'), 'info');
}

function handlePickFolder() {
	openPicker('set-root');
}

async function handleCreateFolder() {
	const suggestion = els.folderName.value || t('default_folder_name');
	const name = window.prompt(t('prompt_create_folder'), suggestion);
	if (!name) return;

	setBusy(els.createFolderBtn, true);
	setStatus(els.status, t('status_authorizing'));

	try {
		const token = await getAuthToken({ interactive: true });
		setStatus(els.status, t('status_creating_folder'));
		const folder = await CreateFolder(token, name.trim(), null);
		els.folderId.value = folder.id;
		els.folderName.value = folder.name;
		setStatus(els.status, t('status_folder_created', { name: folder.name }), 'ok');
	} catch (err) {
		console.error(err);
		setStatus(els.status, t('err_create_folder', { error: err.message }), 'error');
	} finally {
		setBusy(els.createFolderBtn, false);
	}
}

async function validateFolderAccessible(token, folderId) {
	if (!folderId) return false;
	try {
		const file = await GetFile(token, folderId, 'id,name');
		els.folderName.value = file.name;
		return true;
	} catch {
		return false;
	}
}

async function handleSubmit(event) {
	event.preventDefault();

	const folder_id = els.folderId.value.trim();
	const folder_name = els.folderName.value.trim();
	const username = els.username.value.trim();
	const filename_use_domain = els.filenameUseDomain.checked;
	const filename_postfix = els.filenamePostfix.value || DEFAULTS.filename_postfix;
	const language = els.language.value;
	const theme = getSelectedTheme();
	const screenshot_mode = els.screenshotMode.value;
	const max_page_height = parseInt(els.maxPageHeight.value, 10);

	if (!folder_id) {
		setStatus(els.status, t('err_pick_or_create'), 'error');
		return;
	}
	if (!filename_use_domain && !username) {
		setStatus(els.status, t('err_filename_prefix_required'), 'error');
		els.username.focus();
		return;
	}
	if (
		screenshot_mode === 'full_page' &&
		(!Number.isFinite(max_page_height) ||
			max_page_height < MAX_PAGE_HEIGHT_MIN ||
			max_page_height > MAX_PAGE_HEIGHT_MAX)
	) {
		setStatus(els.status, t('err_max_page_height_range'), 'error');
		els.maxPageHeight.focus();
		return;
	}

	setBusy(els.saveBtn, true);
	setStatus(els.status, t('status_saving'));

	try {
		const token = await getAuthToken({ interactive: false }).catch(() => null);
		if (token) {
			const ok = await validateFolderAccessible(token, folder_id);
			if (!ok) {
				setStatus(els.status, t('err_folder_inaccessible'), 'error');
				setBusy(els.saveBtn, false);
				return;
			}
		}

		await new Promise((resolve) =>
			chrome.storage.sync.set(
				{
					folder_id,
					folder_name,
					username,
					filename_use_domain,
					filename_postfix,
					auto_screenshot: els.autoScreenshot.checked,
					auto_upload: els.autoUpload.checked,
					copy_link_after_upload: els.copyLinkAfterUpload.checked,
					language,
					theme,
					screenshot_mode,
					max_page_height,
				},
				resolve
			)
		);

		setStatus(els.status, t('status_saved'), 'ok');
		setTimeout(redirectToOrigin, 800);
	} catch (err) {
		console.error(err);
		setStatus(els.status, t('err_save', { error: err.message }), 'error');
	} finally {
		setBusy(els.saveBtn, false);
	}
}

function redirectToOrigin() {
	const params = new URLSearchParams(document.location.search);
	const origin = params.get('origin');
	if (origin) {
		window.location = origin;
	} else {
		window.close();
	}
}

document.addEventListener('DOMContentLoaded', async () => {
	els.folderId = qs('#folder-id');
	els.folderName = qs('#folder-name');
	els.username = qs('#username');
	els.filenameUseDomain = qs('#filename_use_domain');
	els.filenamePrefixField = qs('#filename-prefix-field');
	els.filenameHintPrefix = qs('#filename-hint-prefix');
	els.filenameHintDomain = qs('#filename-hint-domain');
	els.filenamePostfix = qs('#filename_postfix');
	els.filenamePostfixHint = qs('#filename-postfix-hint');
	els.language = qs('#language');
	els.themeOptions = qsa('.theme-option');
	els.screenshotMode = qs('#screenshot_mode');
	els.maxPageHeightField = qs('#max-page-height-field');
	els.maxPageHeight = qs('#max_page_height');
	els.autoScreenshot = qs('#auto_screenshot');
	els.autoUpload = qs('#auto_upload');
	els.copyLinkAfterUpload = qs('#copy_link_after_upload');
	els.createFolderBtn = qs('#create-folder-btn');
	els.pickFolderBtn = qs('#pick-folder-btn');
	els.saveBtn = qs('#save-btn');
	els.status = qs('#status');
	els.form = qs('#settingsForm');

	await initTheme();
	await initI18n();
	loadSettings();

	for (const btn of els.themeOptions) {
		on(btn, 'click', () => handleThemeChange(btn.dataset.themeValue));
	}

	on(els.createFolderBtn, 'click', handleCreateFolder);
	on(els.pickFolderBtn, 'click', handlePickFolder);
	on(els.form, 'submit', handleSubmit);
	on(els.filenameUseDomain, 'change', syncFilenamePrefixUi);
	on(els.filenamePostfix, 'change', updateFilenameHints);
	on(els.screenshotMode, 'change', syncScreenshotModeUi);
	on(els.language, 'change', async () => {
		await chrome.storage.sync.set({ language: els.language.value });
		await initI18n();
		applyI18n();
		populateLanguageSelect(els.language.value);
		updateFilenameHints();
	});

	chrome.storage.onChanged.addListener((changes, area) => {
		if (area !== 'sync') return;
		if (changes.folder_id || changes.folder_name) {
			loadSettings();
			const name = changes.folder_name?.newValue;
			if (name) {
				setStatus(els.status, t('status_picked', { name }), 'ok');
			}
		}
	});
});
