(function () {
	const log = window.__pickerLog || function () {};

	const APP_ID = '384905528545';
	const DEFAULT_EXT_ID = 'cmhmigmpifnomnelnecfimefophfgldh';

	const params = new URLSearchParams(window.location.search);
	const intent = params.get('intent') || 'set-root';
	const extId = params.get('ext') || DEFAULT_EXT_ID;

	log('intent=' + intent + ', extId=' + extId);

	function sendToExtension(message) {
		return new Promise((resolve, reject) => {
			if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) {
				reject(new Error('Chrome extension APIs unavailable (extension not installed?)'));
				return;
			}
			chrome.runtime.sendMessage(extId, message, (response) => {
				if (chrome.runtime.lastError) {
					reject(new Error(chrome.runtime.lastError.message));
					return;
				}
				if (response && response.error) {
					reject(new Error(response.error));
					return;
				}
				resolve(response || {});
			});
		});
	}

	async function requestToken() {
		log('Requesting OAuth token from extension…');
		const response = await sendToExtension({ type: 'request-token' });
		if (!response.token) {
			throw new Error('Extension did not return a token');
		}
		log('Token received (length=' + response.token.length + ')', 'ok');
		return response.token;
	}

	function loadPickerLib() {
		return new Promise((resolve, reject) => {
			if (typeof gapi === 'undefined') {
				reject(new Error('Google API (gapi) not loaded'));
				return;
			}
			log('Loading Picker library…');
			gapi.load('picker', {
				callback: () => {
					log('Picker library loaded', 'ok');
					resolve();
				},
				onerror: (e) => reject(new Error('gapi.load(picker) failed: ' + e)),
				timeout: 15000,
				ontimeout: () => reject(new Error('gapi.load(picker) timed out')),
			});
		});
	}

	function showPicker(token) {
		log(
			'Opening Picker (origin=' + window.location.origin + ', appId=' + APP_ID + ')…'
		);
		const view = new google.picker.DocsView(google.picker.ViewId.FOLDERS)
			.setIncludeFolders(true)
			.setSelectFolderEnabled(true)
			.setMimeTypes('application/vnd.google-apps.folder');

		const picker = new google.picker.PickerBuilder()
			.setAppId(APP_ID)
			.setOAuthToken(token)
			.setOrigin(window.location.origin)
			.setTitle('Select a folder for screenshots')
			.addView(view)
			.enableFeature(google.picker.Feature.NAV_HIDDEN)
			.setCallback(pickerCallback)
			.build();

		picker.setVisible(true);
		if (window.__pickerMarkOpen) window.__pickerMarkOpen();
		log('Picker.setVisible(true)', 'ok');
	}

	async function pickerCallback(data) {
		const Action = google.picker.Action;
		const Response = google.picker.Response;
		const action = data[Response.ACTION];
		log('Picker callback: action=' + action);

		if (action === Action.PICKED) {
			const docs = data[Response.DOCUMENTS] || [];
			const doc = docs[0];
			if (doc) {
				log('Selected folder: ' + doc.name, 'ok');
				await sendToExtension({
					type: 'picker-result',
					intent,
					folder: { id: doc.id, name: doc.name },
				});
			}
			setTimeout(() => window.close(), 200);
		} else if (action === Action.CANCEL) {
			log('Picker cancelled', 'warn');
			await sendToExtension({ type: 'picker-cancel', intent }).catch(() => {});
			setTimeout(() => window.close(), 200);
		}
	}

	async function main() {
		try {
			const token = await requestToken();
			await loadPickerLib();
			showPicker(token);
		} catch (err) {
			log(err.message || String(err), 'err');
		}
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', main);
	} else {
		main();
	}
})();
