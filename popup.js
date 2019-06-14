import {
	GetSubFolderListPromise,
	getIdFromUrl,
	getAuthToken,
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

const CONSTANTS = {
	DEFAULT_SETTINGS,
	IDS: {
		AUTHORIZE_BTN: '#authorize_button',
		GET_FOLDERS_BUTTON: '#get_subfolders_button',
		CURRENT_FOLDER: '#currentFolder',
		TAKE_SCREENSHOT_BTN: '#take-screenshot-button',
		SCREENSHOT_CONTAINER: '#screenshot',
		SCREENSHOT_PREVIEW: '#screenshot-preview',
		FOLDER_LIST: '#folders_list',
		UPLOAD_BUTTON: '#upload_screenshot_button',
		OPTIONS_URL: '#options_url',
		OPTIONS_ERROR: '#options_error'
	},
	APIS: {
		GET_FILES: 'https://www.googleapis.com/drive/v3/files',
		MULTIPART_UPLOAD: 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart'
	}
};

function takeScreenshot() {
	$(CONSTANTS.IDS.TAKE_SCREENSHOT_BTN).setBusy(true);

	CaptureScreenshot().then(dataUrl => {
		$(CONSTANTS.IDS.SCREENSHOT_PREVIEW).attr('src', dataUrl);
		$(CONSTANTS.IDS.SCREENSHOT_CONTAINER).show();

		const today = new Date();
		const now = today.toISOString().substring(0, 10);
		const filename = `${settings.username}_${now}.png`;

		$(CONSTANTS.IDS.SCREENSHOT_PREVIEW).attr('alt', filename);

		console.log(filename);

		data = {
			...data,
			href: dataUrl,
			filename: filename
		};

		$(CONSTANTS.IDS.TAKE_SCREENSHOT_BTN).setBusy(false);
	});
}

function getListOfSubFolders(folderId = null) {
	$(CONSTANTS.IDS.GET_FOLDERS_BUTTON).setBusy(true);

	const { folder_url } = settings;

	if (folderId === null) {
		$(CONSTANTS.IDS.CURRENT_FOLDER).html('<strong>Root</strong>');
		data = {
			...data,
			selectedFolder: { id: getIdFromUrl(folder_url) }
		};
	}

	GetSubFolderListPromise(folder_url, data.token, folderId)
		.then(folders => {
			data = {
				...data,
				folders
			};
			renderFolderList(folders);
		})
		.catch((jqXHR, textStatus, errorThrown) => {
			alert('Request failed: ' + textStatus);
		})
		.then(() => {
			$(CONSTANTS.IDS.GET_FOLDERS_BUTTON).setBusy(false);
		});
}

function renderFolderList(folders) {
	$(CONSTANTS.IDS.FOLDER_LIST).empty();

	folders.map(folder => {
		let element = $(`<li data-id="${folder.id}" class="folder">${folder.name}</li>`);
		element.click(folder.id, event => {
			data = {
				...data,
				selectedFolder: folder
			};
			getListOfSubFolders(event.data);
			updateSelectedFolder();
		});
		$(CONSTANTS.IDS.FOLDER_LIST).append(element);
	});
}

function updateSelectedFolder() {
	const { selectedFolder } = data;
	if (selectedFolder) {
		$(CONSTANTS.IDS.CURRENT_FOLDER).append(` > <strong>${selectedFolder.name}</strong>`);
	}
}

function uploadScreenshot() {
	$(CONSTANTS.IDS.UPLOAD_BUTTON).setBusy(true);
	const { selectedFolder, href, filename } = data;

	const options = {
		folderId: selectedFolder.id,
		token: data.token,
		dataUrl: href,
		filename
	};

	UploadScreenshot(options)
		.then(response => {
			console.log(response);

			data = {
				...data,
				uploadedFile: response
			};

			$('#msg-success').show();
			$('#view_link').html(response.name);
			getFileUrls();
		})
		.catch((jqXHR, textStatus) => {
			alert('Request failed: ' + textStatus);
			$('#msg-error').show();
			$(CONSTANTS.IDS.UPLOAD_BUTTON).setBusy(false);
		});

	// const base64Data = href.replace(/^data:image\/(png|jpg|jpeg);base64,/, '');

	// const metadata = {
	// 	name: filename,
	// 	mimeType: 'image/png',
	// 	parents: [selectedFolder.id]
	// };

	// const boundary = '-------314159265358979323846';
	// const delimiter = '\r\n--' + boundary + '\r\n';
	// const close_delimiter = '\r\n--' + boundary + '--';
	// const contentType = metadata.mimeType || 'application/octet-stream';
	// const multipartRequestBody =
	// 	delimiter +
	// 	'Content-Type: application/json\r\n\r\n' +
	// 	JSON.stringify(metadata) +
	// 	delimiter +
	// 	'Content-Type: ' +
	// 	contentType +
	// 	'\r\n' +
	// 	'Content-Transfer-Encoding: base64\r\n' +
	// 	'\r\n' +
	// 	base64Data +
	// 	close_delimiter;

	// $.ajax({
	// 	url: CONSTANTS.APIS.MULTIPART_UPLOAD,
	// 	method: 'POST',
	// 	crossDomain: true,
	// 	headers: {
	// 		Authorization: 'Bearer ' + data.token,
	// 		'Content-Type': `multipart/related; boundary=${boundary}`
	// 	},
	// 	data: multipartRequestBody
	// })
	// 	.done(response => {
	// 		console.log(response);

	// 		data = {
	// 			...data,
	// 			uploadedFile: response
	// 		};

	// 		$('#msg-success').show();
	// 		$('#view_link').html(response.name);
	// 		getFileUrls();
	// 	})
	// 	.fail(function(jqXHR, textStatus) {
	// 		alert('Request failed: ' + textStatus);
	// 		$('#msg-error').show();
	// 		$(CONSTANTS.IDS.UPLOAD_BUTTON).setBusy(false);
	// 	})
	// 	.always(() => {});
}

function getFileUrls() {
	const { uploadedFile } = data;
	$.ajax({
		url: `${CONSTANTS.APIS.GET_FILES}/${uploadedFile.id}?fields=webViewLink`,
		method: 'GET',
		crossDomain: true,
		headers: {
			Authorization: 'Bearer ' + data.token
		}
	})
		.done(response => {
			data = {
				...data,
				uploadedFile: {
					...uploadedFile,
					viewLink: response.webViewLink
				}
			};

			$('#view_link').attr('href', response.webViewLink);
			$('#view_link').click(() => {
				chrome.tabs.create({
					url: response.webViewLink
				});
			});
		})
		.fail(function(jqXHR, textStatus) {
			alert('Request failed: ' + textStatus);
			$('#msg-error').show();
		})
		.always(() => {
			$(CONSTANTS.IDS.UPLOAD_BUTTON).setBusy(false);
		});
}

/**
 * Setting initialization
 */
function loadSettings() {
	chrome.storage.sync.get(
		{
			folder_url: DEFAULT_SETTINGS.folder_url,
			username: DEFAULT_SETTINGS.username,
			auto_screenshot: DEFAULT_SETTINGS.auto_screenshot,
			auto_upload: DEFAULT_SETTINGS.auto_upload
		},
		function(items) {
			const { folder_url, username, auto_screenshot } = items;

			if (!folder_url || !username) {
				showOptionError();
			}

			settings = items;
			data = {
				...data,
				selectedFolder: { id: getIdFromUrl(items.folder_url) }
			};
			handleClientLoad();

			if (auto_screenshot) {
				takeScreenshot();
			}
		}
	);
}

function showOptionError() {
	let optionUrl = chrome.extension.getURL('options.html');
	optionUrl = `${optionUrl}?origin=popup.html`;
	$(CONSTANTS.IDS.OPTIONS_URL).attr('href', optionUrl);
	$(CONSTANTS.IDS.OPTIONS_ERROR).show();

	//Disable controls until user is configure settings
	$(CONSTANTS.IDS.GET_FOLDERS_BUTTON).disable();
	$(CONSTANTS.IDS.TAKE_SCREENSHOT_BTN).disable();
	$(CONSTANTS.AUTHORIZE_BTN).disable();
}

/**
 *  On load, called to load the auth2 library and API client library.
 */
function handleClientLoad() {
	getAuthToken({
		interactive: false,
		callback: getAuthTokenSilentCallback
	});
}

function getAuthTokenSilentCallback(token) {
	// Catch chrome error if user is not authorized.
	if (chrome.runtime.lastError) {
		console.error(chrome.runtime.lastError.message);
		showAuthNotification();
		$(CONSTANTS.IDS.AUTHORIZE_BTN).show();
	} else {
		data = {
			...data,
			token
		};
		console.log('Authentication success ', token);
		$(CONSTANTS.IDS.AUTHORIZE_BTN).hide();
	}
}

function showAuthNotification() {
	const options = {
		id: 'start-auth',
		iconUrl: 'icon.png',
		title: 'SNOW screenshot upload extension',
		message: 'Click here to authorize access to GDrive'
	};
	createBasicNotification(options);
}

function createBasicNotification(options) {
	const notificationOptions = {
		type: 'basic',
		iconUrl: options.iconUrl, // Relative to Chrome dir or remote URL must be whitelisted in manifest.
		title: options.title,
		message: options.message,
		isClickable: true
	};
	chrome.notifications.create(options.id, notificationOptions, function(notificationId) {});
}

/**
 * User finished authorizing, start getting Google count.
 *
 * @param {string} token - Current users access_token.
 */
function getAuthTokenInteractiveCallback(token) {
	// Catch chrome error if user is not authorized.
	if (chrome.runtime.lastError) {
		console.error(chrome.runtime.lastError);
		showAuthNotification();
		$(CONSTANTS.IDS.AUTHORIZE_BTN).show();
	} else {
		data = {
			...data,
			token
		};
		$(CONSTANTS.IDS.AUTHORIZE_BTN).hide();
		console.log('Authentication success', token);
	}
}

/**
 *  Sign in the user upon button click.
 */
function handleAuthClick(event) {
	getAuthTokenInteractive();
}

function getAuthTokenInteractive() {
	getAuthToken({
		interactive: true,
		callback: getAuthTokenInteractiveCallback
	});
}

/**
 * Triggered anytime user clicks on a desktop notification.
 */
function notificationClicked(notificationId) {
	// User clicked on notification to start auth flow.
	if (notificationId === 'start-auth') {
		getAuthTokenInteractive();
	}
	clearNotification(notificationId);
}

/**
 * Clear a desktop notification.
 *
 * @param {string} notificationId - Id of notification to clear.
 */
function clearNotification(notificationId) {
	chrome.notifications.clear(notificationId, function(wasCleared) {});
}

/**
 * Wire up Chrome event listeners.
 */
chrome.notifications.onClicked.addListener(notificationClicked);

document.addEventListener('DOMContentLoaded', () => {
	const btnGetData = document.getElementById('take-screenshot-button');
	btnGetData.addEventListener('click', () => {
		takeScreenshot();
	});

	const authorizeButton = document.getElementById('authorize_button');
	authorizeButton.addEventListener('click', () => {
		handleAuthClick();
	});

	const callApiButton = document.getElementById('get_subfolders_button');
	callApiButton.addEventListener('click', () => {
		getListOfSubFolders();
	});

	const uploadButton = document.getElementById('upload_screenshot_button');
	uploadButton.addEventListener('click', () => {
		uploadScreenshot();
	});

	//Load Settings
	loadSettings();
});

$.fn.extend({
	setBusy: function(isBusy = false) {
		if (isBusy === true) {
			$(this).disable();
			$(this).showSpinner();
		} else {
			$(this).enable();
			$(this).hideSpinner();
		}
	},
	disable: function() {
		$(this).prop('disabled', true);
	},
	enable: function() {
		$(this).prop('disabled', false);
	},
	showSpinner: function() {
		const position = $(this).position();
		const elementWidth = $(this).outerWidth(true);
		const elementHeight = $(this).outerHeight(true);

		const top = position.top + elementHeight / 2 - 10;
		const left = position.left + elementWidth;
		$('#ajax-spinner')
			.show()
			.css({
				top,
				left
			});

		$(this).css({ paddingRight: 42 });
	},
	hideSpinner: function() {
		$('#ajax-spinner').hide();
		$(this).css({ paddingRight: 12 });
	}
});

export { getAuthToken, getIdFromUrl, GetSubFolderListPromise };
