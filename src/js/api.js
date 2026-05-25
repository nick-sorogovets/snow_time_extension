import { captureTab, captureVisibleTab } from './capture.js';

const DRIVE_API = 'https://www.googleapis.com/drive/v3/files';
const DRIVE_UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';

function getAuthToken({ interactive = false } = {}) {
	return new Promise((resolve, reject) => {
		chrome.identity.getAuthToken({ interactive }, (token) => {
			if (chrome.runtime.lastError || !token) {
				reject(new Error(chrome.runtime.lastError?.message || 'No auth token'));
				return;
			}
			resolve(token);
		});
	});
}

function removeCachedAuthToken(token) {
	return new Promise((resolve) => {
		if (!token) return resolve();
		chrome.identity.removeCachedAuthToken({ token }, () => resolve());
	});
}

async function driveFetch(url, { method = 'GET', token, body, headers = {} } = {}) {
	const response = await fetch(url, {
		method,
		headers: {
			Authorization: `Bearer ${token}`,
			Accept: 'application/json',
			...headers,
		},
		body,
	});
	const text = await response.text();
	const data = text ? JSON.parse(text) : {};
	if (!response.ok) {
		const message = data?.error?.message || `${response.status} ${response.statusText}`;
		const err = new Error(message);
		err.status = response.status;
		err.body = data;
		throw err;
	}
	return data;
}

async function GetSubFolderList(token, parentId) {
	const params = new URLSearchParams({
		q: `mimeType = 'application/vnd.google-apps.folder' and '${parentId}' in parents and trashed = false`,
		fields: 'files(id,name)',
		pageSize: '100',
		orderBy: 'name',
	});
	const data = await driveFetch(`${DRIVE_API}?${params}`, { token });
	return data.files || [];
}

async function CreateFolder(token, name, parentId) {
	const body = JSON.stringify({
		name,
		mimeType: 'application/vnd.google-apps.folder',
		parents: parentId ? [parentId] : undefined,
	});
	return driveFetch(DRIVE_API, {
		method: 'POST',
		token,
		body,
		headers: { 'Content-Type': 'application/json' },
	});
}

async function GetFile(token, fileId, fields = 'id,name,webViewLink,parents') {
	const params = new URLSearchParams({ fields });
	return driveFetch(`${DRIVE_API}/${fileId}?${params}`, { token });
}

function GetCurrentWindow() {
	return new Promise((resolve) => chrome.windows.getCurrent({}, resolve));
}

function CaptureScreenshot(windowId = null) {
	return captureVisibleTab(windowId);
}

async function UploadScreenshot({ token, folderId, dataUrl, filename }) {
	const base64Data = dataUrl.replace(/^data:image\/(png|jpe?g);base64,/, '');
	const metadata = {
		name: filename,
		mimeType: 'image/png',
		parents: folderId ? [folderId] : undefined,
	};
	const boundary = '-------314159265358979323846';
	const delimiter = `\r\n--${boundary}\r\n`;
	const closeDelimiter = `\r\n--${boundary}--`;

	const body =
		delimiter +
		'Content-Type: application/json\r\n\r\n' +
		JSON.stringify(metadata) +
		delimiter +
		'Content-Type: image/png\r\n' +
		'Content-Transfer-Encoding: base64\r\n\r\n' +
		base64Data +
		closeDelimiter;

	return driveFetch(`${DRIVE_UPLOAD}&fields=id,name,webViewLink`, {
		method: 'POST',
		token,
		body,
		headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
	});
}

export {
	getAuthToken,
	removeCachedAuthToken,
	GetSubFolderList,
	CreateFolder,
	GetFile,
	GetCurrentWindow,
	captureTab,
	captureVisibleTab,
	CaptureScreenshot,
	UploadScreenshot,
};
