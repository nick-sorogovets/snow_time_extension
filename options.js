const DEFAULT_SETTINGS = {
	folder_url: '',
	username: '',
	auto_screenshot: false,
	auto_upload: false,
};
// Saves options to chrome.storage
function save_options(event) {
	event.preventDefault();

	const folder_url = $('#folder-url').val();
	const username = $('#username').val();
	const auto_screenshot = $('#auto_screenshot').prop('checked');
	const auto_upload = $('#auto_upload').prop('checked');

	chrome.storage.sync.set(
		{
			folder_url,
			username,
			auto_screenshot,
			auto_upload
		},
		function () {
			// Update status to let user know options were saved.
			$('#status').text('Settings saved.');

			setTimeout(function () {
				$('#status').text('');
				redirectToOrigin();
			}, 1000);
		}
	);
}

function redirectToOrigin() {
	const params = new URLSearchParams(document.location.search);

	var origin = params.get('origin');
	if(origin){
		window.location = origin;
	} else {
		window.close();
	}
}

// Restores extension settings
// stored in chrome.storage.
function restore_options() {
	// Use default values localhost settings
	chrome.storage.sync.get(
		{
			folder_url: DEFAULT_SETTINGS.folder_url,
			username: DEFAULT_SETTINGS.username,
			auto_screenshot: DEFAULT_SETTINGS.auto_screenshot,
			auto_upload: DEFAULT_SETTINGS.auto_upload
		},
		function (items) {
			$('#folder-url').val(items.folder_url);
			$('#username').val(items.username);
			$('#auto_screenshot').prop('checked', items.auto_screenshot);
			$('#auto_upload').prop('checked', items.auto_upload);
		}
	);

	$('#settingsForm').submit(save_options);
}
$(document).ready(restore_options);
