import {
	getAuthToken,
	getIdFromUrl,
	GetSubFolderListPromise,
	CaptureScreenshot,
	UploadScreenshot,
	GetCurrentWindow
} from './api.js';

let settings = {};
let data = {
	isUploadStarted: false,
	isInitStarted: false
};

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
	} else {
		data = {
			...data,
			token
		};
		console.log('Authentication success ', token);
	}
}

function subscribeOnSubmitClick(tabId) {
	getAuthToken({
		interactive: false,
		callback: getAuthTokenSilentCallback
	});

	chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
		console.log(sender.tab ? 'from a content script:' + sender.tab.url : 'from the extension');

		console.log(request);

		switch (request.action) {
			case 'init':
				if (!data.isInitStarted) {
					data.isInitStarted = true;
					const { week_name } = request;
					if (week_name != data.week_name || !data.selectedFolder) {
						//Clear cached data
						data.selectedFolder = null;
						data.week_name = null;

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
									sendResponse(weekFolder);
								} else {
									data.isInitStarted = false;
									sendResponse({ name: undefined});
									alert(`Could not find folder as week name: "${week_name}" `);
								}
							})
							.catch((jqHXR, textStatus) => {
								alert('Request failed: ' + textStatus);
								data.isInitStarted = false;
							});
					} else if (week_name === data.week_name && data.selectedFolder) {
						sendResponse(data.selectedFolder);
						data.isInitStarted = false;
					}
				}
				break;
			case 'submit_pressed':
				const today = new Date();
				const now = today.toISOString().substring(0, 10);
				const filename = `${settings.username}_${now}.png`;
				const { selectedFolder, isUploadStarted } = data;

				if (!isUploadStarted) {
					data.isUploadStarted = true;

					GetCurrentWindow()
						.then(currentWindow => {
							return CaptureScreenshot(currentWindow.id);
						})
						.then(dataUrl => {
							const options = {
								folderId: selectedFolder.id,
								token: data.token,
								dataUrl,
								filename
							};
							return UploadScreenshot(options);
						})
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
						})
						.then(() => {
							data = {
								...data,
								isUploadStarted: false,
								selectedFolder: null,
								week_name: ''
							};
						});
				}
				break;
			default:
				break;
		}
		return true;
	});

	chrome.tabs.executeScript(tabId, {
		file: './js/content.js'
	});
}

function loadSettings(tabId) {
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
				subscribeOnSubmitClick(tabId);
			}
		}
	);
}

chrome.webNavigation.onCompleted.addListener(
	function(details) {
		loadSettings(details.tabId);
	},
	{ url: [{ urlMatches: 'https://coxauto.service-now.com/time' }] }
);
