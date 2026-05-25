export const PICKER_BASE =
	'https://nick-sorogovets.github.io/snow_time_extension/picker/';

/** GitHub Pages picker must message the installed extension by runtime ID. */
export function buildPickerUrl(intent) {
	const params = new URLSearchParams({
		intent,
		ext: chrome.runtime.id,
	});
	return `${PICKER_BASE}?${params.toString()}`;
}
