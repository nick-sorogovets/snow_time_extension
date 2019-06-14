import {
	getAuthToken,
	getIdFromUrl,
	GetSubFolderListPromise,
	CaptureScreenshot,
	UploadScreenshot
} from './js/api.js';

let settings = {};
let data = {};

const DEFAULT_SETTINGS = {
	folder_url: '',
	username: '',
	auto_screenshot: false,
	auto_upload: false
};

function getAuthTokenSilentCallback(token) {
	// Catch chrome error if user is not authorized.
	if (chrome.runtime.lastError) {
		console.error(chrome.runtime.lastError.message);
		showAuthNotification();
	} else {
		data = {
			...data,
			token
		};
		console.log('Authentication success ', token);
	}
}

function subscribeOnSubmitClick() {
	getAuthToken({
		interactive: false,
		callback: getAuthTokenSilentCallback
	});

	chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
		console.log(sender.tab ? 'from a content script:' + sender.tab.url : 'from the extension');

		console.log(request);

		switch (request.action) {
			case 'init':
				const { week_name } = request;
				if (week_name != data.week_name) {
					console.log(request.week_name);
					const { folder_url } = settings;
					const folderId = getIdFromUrl(folder_url);
					GetSubFolderListPromise(folder_url, data.token, folderId)
						.then(folders => {
							if (folders.some(f => f.name === week_name)) {
								const weekFolder = folders.find((folder, index) => {
									return folder.name == week_name;
								});

								data = {
									...data,
									week_name,
									selectedFolder: weekFolder
								};

								console.log(weekFolder);
							} else {
								alert(`Could not find folder as week name: ${week_name} `);
							}
						})
						.catch((jqHXR, textStatus) => {
							alert('Request failed: ' + textStatus);
						});
				}
				break;
			case 'submit_pressed':
				const today = new Date();
				const now = today.toISOString().substring(0, 10);
				const filename = `${settings.username}_${now}.png`;
				const { selectedFolder } = data;
				const options = {
					folderId: selectedFolder.id,
					token: data.token,
					dataUrl: request.dataUrl,
					filename
				};

				UploadScreenshot(options)
					.then(response => {
						console.log(response);

						data = {
							...data,
							uploadedFile: response
						};

						sendResponse(response);
					})
					.catch((jqHXR, textStatus) => {
						alert('Request failed: ' + textStatus);
					});
				break;
			default:
				break;
		}
	});
	chrome.tabs.executeScript(null, {
		file: 'content.js'
	});
}

function loadSettings() {
	chrome.storage.sync.get(
		{
			folder_url: DEFAULT_SETTINGS.folder_url,
			username: DEFAULT_SETTINGS.username,
			auto_screenshot: DEFAULT_SETTINGS.auto_screenshot,
			auto_upload: DEFAULT_SETTINGS.auto_upload
		},
		function(items) {
			const { auto_upload } = items;
			settings = items;

			if (auto_upload) {
				subscribeOnSubmitClick();
			}
		}
	);
}

chrome.webNavigation.onDOMContentLoaded.addListener(
	function() {
		loadSettings();
	},
	{ url: [{ urlMatches: 'https://coxauto.service-now.com/time' }] }
);
