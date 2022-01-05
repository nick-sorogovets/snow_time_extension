const DEFAULT_SETTINGS = {
	folder_url: '',
	username: '',
	auto_screenshot: false,
	auto_upload: false,
};
const CONTROLS = {
	folder_url: '#folder-url',
	username: '#username',
	auto_screenshot: '#auto_screenshot',
	auto_upload: '#auto_upload',
	status_lbl: '#status',
};

// Saves options to chrome.storage
function save_options(event) {
	event.preventDefault();

	const folder_url = $(CONTROLS.folder_url).val();
	const username = $(CONTROLS.username).val();
	const auto_screenshot = $(CONTROLS.auto_screenshot).prop('checked');
	const auto_upload = $(CONTROLS.auto_upload).prop('checked');

	var validateUrlRegexp = new RegExp('.*/drive/folders/([^?]+)');
	if (!validateUrlRegexp.test(folder_url)) {
		$(CONTROLS.folder_url).addClass('error');
		$(CONTROLS.status_lbl).html(`<strong style="color:red">Invalid folder url</strong>`);
		return;
	}

	var request = new Request(folder_url, {
		method: 'GET',
		mode: 'cors',
		headers: {
			'Access-Control-Allow-Origin': '*',
		},
	});

	fetch(request)
		.then((response) => {
			if (response.ok) {
				chrome.storage.sync.set(
					{
						folder_url,
						username,
						auto_screenshot,
						auto_upload,
					},
					function () {
						// Update status to let user know options were saved.
						$(CONTROLS.status_lbl).text('Settings saved.');

						setTimeout(function () {
							$(CONTROLS.status_lbl).text('');
							redirectToOrigin();
						}, 1000);
					}
				);
			} else {
				$(CONTROLS.folder_url).addClass('error');
				$(CONTROLS.status_lbl).html(
					`<strong style="color:red">Check Folder Url Error: ${response.status} ${response.statusText}</strong>`
				);
			}
		})
		.catch((error) => {
			alert(`Could not load url. Err: ${error}`);
		});
}

function redirectToOrigin() {
	const params = new URLSearchParams(document.location.search);

	var origin = params.get('origin');
	if (origin) {
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
			auto_upload: DEFAULT_SETTINGS.auto_upload,
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
