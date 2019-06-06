let settings = {};
let data = {};

const DEFAULT_SETTINGS = {
    client_id: '384905528545-qdgr4vg5g577uh5rrv8apj2b3v54bj68.apps.googleusercontent.com',
    domain: '',
    username: ''
};

function takeScreenshot() {
    chrome.extension.onRequest.addListener(function(screenshot) {
        console.log(screenshot.href);
        $('#screenshot-preview').attr('src', screenshot.href);

        $('#screenshot').removeClass('hidden');
        var today = new Date();
        var now = today.toISOString().substring(0, 10);

        var filename = `${settings.username}_${now}.png`;
        $('#screenshot-preview').attr('alt', filename);

        console.log(filename);

        data = {
            ...data,
            href: screenshot.href,
            filename: filename
        };
    });
    chrome.tabs.executeScript(
        null,
        {
            file: 'html2canvas.min.js'
        },
        () => {
            chrome.tabs.executeScript(null, {
                file: 'parse-data.js'
            });
        }
    );
}

function getIdFromUrl(url) {
    return url.match(/[-\w]{25,}/);
}

function getListOfSubFolders(folderId = null) {
    const { domain } = settings;

    folderId = folderId || getIdFromUrl(domain);

    $.ajax({
        url: 'https://www.googleapis.com/drive/v3/files',
        method: 'GET',
        crossDomain: true,
        headers: {
            Authorization: 'Bearer ' + data.token
        },
        data: {
            corpora: 'user',
            q: `mimeType = 'application/vnd.google-apps.folder' and '${folderId}' in parents`,
            supportsTeamDrives: true
        }
    })
        .done(response => {
            data = {
                ...data,
                folders: response.files
            };

            renderFolderList(response.files);
        })
        .fail(function(jqXHR, textStatus) {
            alert('Request failed: ' + textStatus);
        });
}

function renderFolderList(folders) {
    $('#folders_list').empty();

    folders.map(folder => {
        let element = $(
            `<div data-id="${folder.id}" class="folder" onclick="selectSubFolderHandler">${
                folder.name
            }</div>`
        );
        element.click(folder.id, event => {
            data = {
                ...data,
                selectedFolder: folder
            };
            getListOfSubFolders(event.data);
            updateSelectedFolder();
        });
        $('#folders_list').append(element);
    });
}

function updateSelectedFolder() {
    const { selectedFolder } = data;
    if (selectedFolder) {
        $('#currentFolder').append(` > <strong>${selectedFolder.name}</strong>`);
    }
}

function uploadScreenshot() {
    const { selectedFolder, href, filename } = data;

    const base64Data = href.replace(/^data:image\/(png|jpg|jpeg);base64,/, '');

    const metadata = {
        name: filename,
        mimeType: 'image/png',
        parents: [selectedFolder.id]
    };

    const boundary = '-------314159265358979323846';
    const delimiter = '\r\n--' + boundary + '\r\n';
    const close_delimiter = '\r\n--' + boundary + '--';
    var contentType = metadata.mimeType || 'application/octet-stream';
    var multipartRequestBody =
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

    $.ajax({
        url: 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
        method: 'POST',
        crossDomain: true,
        headers: {
            Authorization: 'Bearer ' + data.token,
            'Content-Type': `multipart/related; boundary=${boundary}`
        },
        data: multipartRequestBody
    })
        .done(response => {
            console.log(response);
            $('#msg-success').removeClass('hidden');
        })
        .fail(function(jqXHR, textStatus) {
            alert('Request failed: ' + textStatus);
            $('#msg-error').removeClass('hidden');
        });
}

/**
 * Setting initialization
 */
function loadSettings() {
    chrome.storage.sync.get(
        {
            domain: DEFAULT_SETTINGS.domain,
            username: DEFAULT_SETTINGS.username
        },
        function(items) {
            settings = items;
            data = {
                ...data,
                selectedFolder: { id: getIdFromUrl(items.domain) }
            };
            handleClientLoad();
        }
    );

    // chrome.webRequest.onHeadersReceived.addListener(
    //     function(info) {
    //         var headers = info.responseHeaders;
    //         for (var i = headers.length - 1; i >= 0; --i) {
    //             var header = headers[i].name.toLowerCase();
    //             if (header == 'x-frame-options' || header == 'frame-options') {
    //                 headers.splice(i, 1); // Remove header
    //             }
    //         }
    //         return { responseHeaders: headers };
    //     },
    //     {
    //         urls: ['*://*/*'], // Pattern to match all http(s) pages
    //         types: ['sub_frame']
    //     },
    //     ['blocking', 'responseHeaders']
    // );
}

function getAuthToken(options) {
    chrome.identity.getAuthToken({ interactive: options.interactive }, options.callback);
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
        $('#authorize_button').show();
    } else {
        data = {
            ...data,
            token
        };
        console.log('Authentication success ', token);
        $('#authorize_button').hide();
    }
}

function showAuthNotification() {
    var options = {
        id: 'start-auth',
        iconUrl: 'icon.png',
        title: 'SNOW screenshot upload extension',
        message: 'Click here to authorize access to GDrive'
    };
    createBasicNotification(options);
}

function createBasicNotification(options) {
    var notificationOptions = {
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
        $('#authorize_button').show();
    } else {
        data = {
            ...data,
            token
        };
        $('#authorize_button').hide();
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
    const btnGetData = document.getElementById('btn-get-data');
    btnGetData.addEventListener('click', () => {
        takeScreenshot();
    });

    const authorizeButton = document.getElementById('authorize_button');
    authorizeButton.addEventListener('click', () => {
        handleAuthClick();
    });

    const callApiButton = document.getElementById('call_api_button');
    callApiButton.addEventListener('click', () => {
        getListOfSubFolders();
    });

    const uploadButton = document.getElementById('upload_screenshot_btn');
    uploadButton.addEventListener('click', () => {
        uploadScreenshot();
    });

    //Load Settings
    loadSettings();
});
