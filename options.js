const DEFAULT_SETTINGS = {
	folder_url: '',
	username: ''
};
// Saves options to chrome.storage
function save_options(event) {
	event.preventDefault();

	const folder_url = $('#folder-url').val();
	const username = $('#username').val();

	chrome.storage.sync.set(
		{
			folder_url,
			username
		},
		function () {
			// Update status to let user know options were saved.
			$('#status').text('Settings saved.');

			setTimeout(function () {
				$('#status').text('');
			}, 2000);
		}
	);
}

// Restores extension settings
// stored in chrome.storage.
function restore_options() {
	// Use default values localhost settings
	chrome.storage.sync.get(
		{
			folder_url: DEFAULT_SETTINGS.folder_url,
			username: DEFAULT_SETTINGS.username
		},
		function (items) {
			$('#folder-url').val(items.folder_url);
			$('#username').val(items.username);
		}
	);

	$('#settingsForm').submit(save_options);
}
$(document).ready(restore_options);
