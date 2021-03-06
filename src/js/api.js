const CONSTANTS = {
	APIS: {
		FILES: 'https://www.googleapis.com/drive/v3/files',
		MULTIPART_UPLOAD: 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
	},
};

function getIdFromUrl(url) {
	return url.match(/[-\w]{25,}/)[0];
}

function getAuthToken(options) {
	chrome.identity.getAuthToken({ interactive: options.interactive }, options.callback);
}

function GetSubFolderListPromise(folder_url, token, folderId = null) {
	folderId = folderId || getIdFromUrl(folder_url);

	return new Promise((resolve, reject) => {
		$.ajax({
			url: CONSTANTS.APIS.FILES,
			method: 'GET',
			crossDomain: true,
			headers: {
				Authorization: 'Bearer ' + token,
			},
			data: {
				corpora: 'user',
				q: `mimeType = 'application/vnd.google-apps.folder' and '${folderId}' in parents`,
				supportsTeamDrives: true,
			},
		})
			.done((response) => resolve(response.files))
			.fail(reject);
	});
}

function GetCurrentWindow() {
	return new Promise((resolve, reject) => {
		chrome.windows.getCurrent({}, resolve);
	});
}

function CaptureScreenshot(windowId = null) {
	return new Promise((resolve, reject) => {
		chrome.tabs.captureVisibleTab(windowId, { format: 'png' }, (dataUrl) => {
			resolve(dataUrl);
		});
	});
}

function UploadScreenshot(options) {
	const { folderId, token, dataUrl, filename } = options;

	const base64Data = dataUrl.replace(/^data:image\/(png|jpg|jpeg);base64,/, '');

	const metadata = {
		name: filename,
		mimeType: 'image/png',
		parents: [folderId],
	};

	const boundary = '-------314159265358979323846';
	const delimiter = '\r\n--' + boundary + '\r\n';
	const close_delimiter = '\r\n--' + boundary + '--';
	const contentType = metadata.mimeType || 'application/octet-stream';
	const multipartRequestBody =
		delimiter +
		'Content-Type: application/json\r\n\r\n' +
		JSON.stringify(metadata) +
		delimiter +
		'Content-Type: ' +
		contentType +
		'\r\n' +
		'Content-Transfer-Encoding: base64\r\n' +
		'\r\n' +
		base64Data +
		close_delimiter;

	return new Promise((resolve, reject) => {
		$.ajax({
			url: CONSTANTS.APIS.MULTIPART_UPLOAD,
			method: 'POST',
			crossDomain: true,
			headers: {
				Authorization: 'Bearer ' + token,
				'Content-Type': `multipart/related; boundary=${boundary}`,
			},
			data: multipartRequestBody,
		})
			.done(resolve)
			.fail(reject);
	});
}

function CreateFolder(folderName, token, folderId) {
	var data = {
		name: folderName,
		title: folderName,
		mimeType: 'application/vnd.google-apps.folder',
		parents: [folderId],
	};

	return new Promise((resolve, reject) => {
		$.ajax({
			url: CONSTANTS.APIS.FILES,
			method: 'POST',
			headers: {
				Authorization: 'Bearer ' + token,
				'Content-Type': 'application/json',
			},
			data: JSON.stringify(data),
		})
			.done((response) => {
				resolve(response);
			})
			.fail(reject);
	});
}

function GetFileUrls(fileId, token) {
	return new Promise((resolve, reject) => {
		$.ajax({
			url: `${CONSTANTS.APIS.FILES}/${fileId}?fields=webViewLink`,
			method: 'GET',
			crossDomain: true,
			headers: {
				Authorization: 'Bearer ' + token,
			},
		})
			.done(resolve)
			.fail(reject);
	});
}

export {
	getIdFromUrl,
	getAuthToken,
	GetSubFolderListPromise,
	CreateFolder,
	GetCurrentWindow,
	CaptureScreenshot,
	UploadScreenshot,
	GetFileUrls,
};
