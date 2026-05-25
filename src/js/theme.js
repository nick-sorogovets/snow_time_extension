const THEME_DEFAULT = 'system';
const VALID_THEMES = new Set(['system', 'light', 'dark']);

export function applyTheme(theme = THEME_DEFAULT) {
	const value = VALID_THEMES.has(theme) ? theme : THEME_DEFAULT;
	document.documentElement.dataset.theme = value;
}

export function readStoredTheme() {
	return new Promise((resolve) => {
		chrome.storage.sync.get({ theme: THEME_DEFAULT }, (items) => {
			resolve(items.theme || THEME_DEFAULT);
		});
	});
}

export async function initTheme() {
	applyTheme(await readStoredTheme());
}

export function watchTheme() {
	chrome.storage.onChanged.addListener((changes, area) => {
		if (area === 'sync' && changes.theme) {
			applyTheme(changes.theme.newValue);
		}
	});
}

export { THEME_DEFAULT, VALID_THEMES };
