const SUBMIT_SELECTOR =
	'div.header.row > div > div > div.btn-group.ng-scope > button:nth-child(1)';
const WEEK_SELECTOR =
	'div.header.row > div.date-selector.col-md-6 > div.date-range > div';

const MAX_RETRIES = 30;

function init(retries = 0) {
	const submitBtn = document.querySelector(SUBMIT_SELECTOR);
	const weekEl = document.querySelector(WEEK_SELECTOR);

	if (!submitBtn || !weekEl) {
		if (retries < MAX_RETRIES) setTimeout(() => init(retries + 1), 1000);
		return;
	}

	if (submitBtn.dataset.snowBound === '1') return;
	submitBtn.dataset.snowBound = '1';

	const weekName = weekEl.innerText.trim();

	chrome.runtime
		.sendMessage({ action: 'init', week_name: weekName })
		.then((response) => {
			if (response && response.name) {
				chrome.runtime
					.sendMessage({ action: 'get_submit_label' })
					.then((labelResponse) => {
						submitBtn.innerText = labelResponse?.label || 'Submit & Upload';
					})
					.catch(() => {
						submitBtn.innerText = 'Submit & Upload';
					});
			}
		})
		.catch(() => {});

	submitBtn.addEventListener('click', () => {
		setTimeout(() => {
			chrome.runtime
				.sendMessage({
					action: 'submit_pressed',
					week_name: weekEl.innerText.trim(),
				})
				.catch(() => {});
		}, 0);
	});
}

init();
