let settings = {};
const DEFAULT_SETTINGS = {
	folder_url: '',
	username: '',
	auto_screenshot: false,
	auto_upload: false
};

chrome.webNavigation.onDOMContentLoaded.addListener(
	function() {
		loadSettings();
		alert('This is SNOW Time portal!');
	},
	{ url: [{ urlMatches: 'https://coxauto.service-now.com/time' }] }
);

function subscribeOnSubmitClick() {
	chrome.runtime.onMessage.addListener(
		function(request, sender, sendResponse) {
			console.log(sender.tab ?
									"from a content script:" + sender.tab.url :
									"from the extension");
			
			console.log(request);
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
