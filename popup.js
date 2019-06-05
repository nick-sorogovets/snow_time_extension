// Array of API discovery doc URLs for APIs used by the quickstart
const DISCOVERY_DOCS = ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"];
// Authorization scopes required by the API; multiple scopes can be
// included, separated by spaces.
const SCOPES = 'https://www.googleapis.com/auth/drive.metadata.readonly';


let settings = {};
let data = {};

const DEFAULT_SETTINGS = {
  client_id: '384905528545-qdgr4vg5g577uh5rrv8apj2b3v54bj68.apps.googleusercontent.com',
  api_key: 'AIzaSyAnbGg5cnqwbLF-6HqXeQYhEwAKINL1GsE',
  domain: '',
  username: '',
};

function takeScreenshot() {
  chrome.extension.onRequest.addListener(function(screenshot) {
    console.log(screenshot.href);
    $("#screenshot-preview").attr('src', screenshot.href);

    $('#screenshot').removeClass('hidden');
    var today = new Date();
    var now = today.toISOString().substring(0, 10);

    var filename = `Screenshot_${settings.username}_${now}.png`;
    $("#screenshot-preview").attr('alt', filename);

    // if(!$('.g-savetodrive').attr('data-src')){
    //   $("#container").append(
    //     `<div class="g-savetodrive"
    //       data-src="${screenshot.href}"
    //       data-filename="${filename}"
    //       data-sitename="${settings.username}">
    //     </div>`);
    // }

    console.log(filename);

    data = {
      ...data,
      href: screenshot.href,
      filename: filename
    };

    // gapi.savetodrive.go('container');

    // gapi.savetodrive.render('container', {
    //   src: screenshot.href,
    //   filename: filename,
    //   sitename: settings.username
    // });

  });
  chrome.tabs.executeScript(null, {
    file: 'html2canvas.min.js',
  }, () => {
    chrome.tabs.executeScript(null, {
      file: 'parse-data.js',
    });
  });
}


function getListOfSubFolders(){
  const { domain } = settings;

  const folderId = domain.substring(domain.lastIndexOf('/')+1);

  $.ajax({
    url:'https://www.googleapis.com/drive/v3/files',
    crossDomain: true,
    headers: {
      'Authorization': 'Bearer ' + data.token
    },
    method: 'GET',
    data: {
      corpora: 'user',
      q: `mimeType = 'application/vnd.google-apps.folder' and '${folderId}' in parents`,
      supportsTeamDrives: true
    }
  })
  .done((response) => {
    data ={
      ...data,
      folders: response.files
    };

    renderFolderList(response.files);
  })
  .fail(function( jqXHR, textStatus ) {
    alert( "Request failed: " + textStatus );
  });

}

function renderFolderList(folders){
  $('#container').empty();

  folders.map(folder => {
    $('#container').append(`<div data-id="${folder.id}" class="folder">${folder.name}</div>`);
  });
}

function loadSettings() {
  chrome.storage.sync.get({
    domain: DEFAULT_SETTINGS.domain,
    username: DEFAULT_SETTINGS.username,
    api_key: DEFAULT_SETTINGS.api_key,
    client_id: DEFAULT_SETTINGS.client_id
  }, function(items) {
      settings = items;
      handleClientLoad();
  });

  chrome.webRequest.onHeadersReceived.addListener(
    function(info) {
        var headers = info.responseHeaders;
        for (var i=headers.length-1; i>=0; --i) {
            var header = headers[i].name.toLowerCase();
            if (header == 'x-frame-options' || header == 'frame-options') {
                headers.splice(i, 1); // Remove header
            }
        }
        return {responseHeaders: headers};
    },
    {
        urls: [ '*://*/*' ], // Pattern to match all http(s) pages
        types: [ 'sub_frame' ]
    },
    ['blocking', 'responseHeaders']
  );
}

function getAuthToken(options){
  chrome.identity.getAuthToken({ 'interactive': options.interactive }, options.callback);
}
/**
 *  On load, called to load the auth2 library and API client library.
 */
function handleClientLoad() {
  getAuthToken({
    'interactive': false,
    'callback': getAuthTokenSilentCallback,
  })
}

function getAuthTokenSilentCallback(token) {
  // Catch chrome error if user is not authorized.
  if (chrome.runtime.lastError) {
      console.error(chrome.runtime.lastError.message);
      showAuthNotification();
  } else {
      data = {
        ...data,
        token
      }
      console.log('Authentication success ', token);
  }
}

function showAuthNotification() {
  var options = {
      'id': 'start-auth',
      'iconUrl': 'icon.png',
      'title': 'SNOW screenshot uploader extensopn',
      'message': 'Click here to authorize access to GDrive',
  };
  createBasicNotification(options);
}

function createBasicNotification(options) {
  var notificationOptions = {
      'type': 'basic',
      'iconUrl': options.iconUrl, // Relative to Chrome dir or remote URL must be whitelisted in manifest.
      'title': options.title,
      'message': options.message,
      'isClickable': true,
  };
  chrome.notifications.create(options.id, notificationOptions, function (notificationId) { });
}

/**
 * User finished authorizing, start getting Gmail count.
 *
 * @param {string} token - Current users access_token.
 */
function getAuthTokenInteractiveCallback(token) {
  // Catch chrome error if user is not authorized.
  if (chrome.runtime.lastError) {
      console.error(chrome.runtime.lastError);
      showAuthNotification();
  } else {
     data = {
       ...data,
       token
     }
     console.log('Authentication success', token);
  }
}

/**
 *  Sign in the user upon button click.
 */
function handleAuthClick(event) {
  getAuthTokenInteractive();
}

function getAuthTokenInteractive(){
  getAuthToken({
    interactive: true,
    callback: getAuthTokenInteractiveCallback
  })
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
  chrome.notifications.clear(notificationId, function (wasCleared) { });
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
  })

  const callApiButton = document.getElementById('call_api_button');
  callApiButton.addEventListener('click', () => {
    getListOfSubFolders();
  })


  //Load Settings
  loadSettings();
})
