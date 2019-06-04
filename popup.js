// Array of API discovery doc URLs for APIs used by the quickstart
const DISCOVERY_DOCS = ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"];
// Authorization scopes required by the API; multiple scopes can be
// included, separated by spaces.
const SCOPES = 'https://www.googleapis.com/auth/drive.file';


let settings = {};
const DEFAULT_SETTINGS = {
  client_id: '384905528545-odq6f69luso57hjce3qbob32qe5a1qe4.apps.googleusercontent.com',
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

    $("#container").append(`<div class="g-savetodrive"
    data-src="${screenshot.href}"
    data-filename="${filename}"
    data-sitename="${settings.username}">
 </div>`);

    console.log(filename);

    gapi.savetodrive.go('container');

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

document.addEventListener('DOMContentLoaded', () => {
  const btnGetData = document.getElementById('btn-get-data');
  btnGetData.addEventListener('click', () => {
    takeScreenshot();
  });

 

  const authorizeButton = document.getElementById('authorize_button');
  authorizeButton.addEventListener('click', () => {
    handleAuthClick();
  })
  const signoutButton = document.getElementById('signout_button');
  signoutButton.addEventListener('click', () => {
    handleSignoutClick();
  })



  //loadSettings();
})

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


      /**
       *  On load, called to load the auth2 library and API client library.
       */
      function handleClientLoad() {
        gapi.load('client:auth2', initClient);
      }

      /**
       *  Initializes the API client library and sets up sign-in state
       *  listeners.
       */
      function initClient() {
        console.log('Init client Started');
        const params = {
          apiKey: settings.api_key,
          clientId: settings.client_id,
          discoveryDocs: DISCOVERY_DOCS,
          scope: SCOPES
        };
        console.log(params);
        gapi.client.init(params).then(function(resp) {
          console.log('Client initialized');
         // Listen for sign-in state changes.
         gapi.auth2.getAuthInstance().isSignedIn.listen(updateSigninStatus);

         // Handle the initial sign-in state.
         updateSigninStatus(gapi.auth2.getAuthInstance().isSignedIn.get());
        }).catch(error => {
          console.log(error);
        });

      }

      /**
       *  Called when the signed in status changes, to update the UI
       *  appropriately. After a sign-in, the API is called.
       */
      function updateSigninStatus(isSignedIn) {
        const authorizeButton = document.getElementById('authorize_button');
        const signoutButton = document.getElementById('signout_button');
        if (isSignedIn) {
          authorizeButton.style.display = 'none';
          signoutButton.style.display = 'block';
          listFiles();
        } else {
          authorizeButton.style.display = 'block';
          signoutButton.style.display = 'none';
        }
      }

      /**
       *  Sign in the user upon button click.
       */
      function handleAuthClick(event) {
        gapi.auth2.getAuthInstance().signIn();
      }

      /**
       *  Sign out the user upon button click.
       */
      function handleSignoutClick(event) {
        gapi.auth2.getAuthInstance().signOut();
      }

      /**
       * Append a pre element to the body containing the given message
       * as its text node. Used to display the results of the API call.
       *
       * @param {string} message Text to be placed in pre element.
       */
      function appendPre(message) {
        var pre = document.getElementById('content');
        var textContent = document.createTextNode(message + '\n');
        pre.appendChild(textContent);
      }

      /**
       * Print files.
       */
      function listFiles() {
        gapi.client.drive.files.list({
          'pageSize': 10,
          'fields': "nextPageToken, files(id, name)"
        }).then(function(response) {
          appendPre('Files:');
          var files = response.result.files;
          if (files && files.length > 0) {
            for (var i = 0; i < files.length; i++) {
              var file = files[i];
              appendPre(file.name + ' (' + file.id + ')');
            }
          } else {
            appendPre('No files found.');
          }
        });
      }
