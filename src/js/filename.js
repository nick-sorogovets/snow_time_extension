const FALLBACK_PREFIX = 'screenshot';
const INCREMENT_STORAGE_KEY = 'filename_increment_index';

export const POSTFIX_MODES = new Set(['short_date', 'increment', 'long_date', 'datetime']);

function pad2(n) {
	return String(n).padStart(2, '0');
}

export function domainFromUrl(url) {
	try {
		const hostname = new URL(url).hostname;
		if (!hostname) return FALLBACK_PREFIX;
		return hostname.replace(/^www\./i, '') || FALLBACK_PREFIX;
	} catch {
		return FALLBACK_PREFIX;
	}
}

export function screenshotFilenamePrefix(settings, tabUrl) {
	if (settings?.filename_use_domain) {
		return domainFromUrl(tabUrl);
	}
	const prefix = settings?.username?.trim();
	return prefix || FALLBACK_PREFIX;
}

function formatShortDate(date) {
	const y = date.getFullYear();
	const m = pad2(date.getMonth() + 1);
	const d = pad2(date.getDate());
	return `${y}-${m}-${d}`;
}

function formatLongDate(date, locale = 'en') {
	const year = date.getFullYear();
	const month = date.toLocaleString(locale, { month: 'long' });
	return `${year}-${month}-${pad2(date.getDate())}`;
}

function formatDateTime(date) {
	return `${formatShortDate(date)}_${pad2(date.getHours())}-${pad2(date.getMinutes())}-${pad2(date.getSeconds())}`;
}

function getIncrementPreview() {
	return new Promise((resolve) => {
		chrome.storage.local.get({ [INCREMENT_STORAGE_KEY]: 0 }, (items) => {
			resolve((Number(items[INCREMENT_STORAGE_KEY]) || 0) + 1);
		});
	});
}

function nextIncrementIndex() {
	return new Promise((resolve) => {
		chrome.storage.local.get({ [INCREMENT_STORAGE_KEY]: 0 }, (items) => {
			const next = (Number(items[INCREMENT_STORAGE_KEY]) || 0) + 1;
			chrome.storage.local.set({ [INCREMENT_STORAGE_KEY]: next }, () => resolve(next));
		});
	});
}

export async function formatFilenamePostfix(
	mode,
	{ date = new Date(), locale = 'en', advanceIncrement = false } = {}
) {
	const postfixMode = POSTFIX_MODES.has(mode) ? mode : 'short_date';
	switch (postfixMode) {
		case 'increment':
			return String(
				advanceIncrement ? await nextIncrementIndex() : await getIncrementPreview()
			);
		case 'long_date':
			return formatLongDate(date, locale);
		case 'datetime':
			return formatDateTime(date);
		default:
			return formatShortDate(date);
	}
}

/** Static postfix sample for settings hints (does not advance increment). */
export function samplePostfix(mode, { date = new Date(), locale = 'en' } = {}) {
	const postfixMode = POSTFIX_MODES.has(mode) ? mode : 'short_date';
	switch (postfixMode) {
		case 'increment':
			return '1';
		case 'long_date':
			return formatLongDate(date, locale);
		case 'datetime':
			return formatDateTime(date);
		default:
			return formatShortDate(date);
	}
}

export async function buildScreenshotFilename(settings, tabUrl, { advanceIncrement = false } = {}) {
	const prefix = screenshotFilenamePrefix(settings, tabUrl);
	const postfix = await formatFilenamePostfix(settings?.filename_postfix, {
		locale: settings?.language || 'en',
		advanceIncrement,
	});
	return `${prefix}_${postfix}.png`;
}

export function isExtensionConfigured(settings) {
	if (!settings?.folder_id) return false;
	if (settings.filename_use_domain) return true;
	return !!settings.username?.trim();
}
