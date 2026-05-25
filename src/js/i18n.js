import { MESSAGES, DEFAULT_LOCALE } from './i18n-data.js';

export { LOCALE_LABELS } from './i18n-data.js';

let locale = DEFAULT_LOCALE;

function normalizeLocale(code) {
	if (!code) return DEFAULT_LOCALE;
	const lower = String(code).toLowerCase().replace('-', '_');
	const short = lower.split('_')[0];
	const supported = Object.keys(MESSAGES);
	if (supported.includes(lower)) return lower;
	if (supported.includes(short)) return short;
	return DEFAULT_LOCALE;
}

function langAttr(code) {
	if (code === 'en') return 'en';
	return code.replace('_', '-');
}

export async function initI18n() {
	const stored = await chrome.storage.sync.get({ language: '' });
	locale = stored.language
		? normalizeLocale(stored.language)
		: normalizeLocale(typeof navigator !== 'undefined' ? navigator.language : DEFAULT_LOCALE);
	if (typeof document !== 'undefined' && document.documentElement) {
		document.documentElement.lang = langAttr(locale);
		applyI18n();
	}
}

export function t(key, params = {}) {
	const bag = MESSAGES[locale] || MESSAGES[DEFAULT_LOCALE];
	let s = bag[key] ?? MESSAGES[DEFAULT_LOCALE][key] ?? key;
	for (const [k, v] of Object.entries(params)) {
		s = s.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
	}
	return s;
}

export function applyI18n(root = document) {
	if (!root || !root.querySelectorAll) return;
	root.querySelectorAll('[data-i18n]').forEach((el) => {
		el.textContent = t(el.dataset.i18n);
	});
	root.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
		el.placeholder = t(el.dataset.i18nPlaceholder);
	});
	root.querySelectorAll('[data-i18n-title]').forEach((el) => {
		el.title = t(el.dataset.i18nTitle);
	});
	root.querySelectorAll('option[data-i18n]').forEach((el) => {
		el.textContent = t(el.dataset.i18n);
	});
	root.querySelectorAll('[data-i18n-alt]').forEach((el) => {
		el.alt = t(el.dataset.i18nAlt);
	});
}
