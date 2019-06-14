(document => {
	const init = function() {
		const snow_submit_button = document.querySelector(
			'div.header.row > div > div > div.btn-group.ng-scope > button:nth-child(1)'
		);
		const weekName = document.querySelector(
			'div.header.row > div.date-selector.col-md-6 > div.date-range > div'
		);
		if (snow_submit_button && weekName) {
			snow_submit_button.addEventListener('click', () => {
				CaptureScreenshot().then(dataUrl => {
					setTimeout(() => {
						const msg = {
							action: 'submit_pressed',
							week_name: weekName.innerText,
							dataUrl
						};
						chrome.runtime.sendMessage(msg, function(response) {
							alert(`Thank you for upload screenshot '${response.name}'`);
						});
					}, 500);
				});
			});
		}
		if (weekName) {
			const initMessage = {
				action: 'init',
				week_name: weekName.innerText
			};
			chrome.runtime.sendMessage(initMessage);
		} else {
			setTimeout(init, 1000);
		}
	};

	document.onreadystatechange = () => {
		if (document.readyState === 'complete') {
			init();
		}
	};

	function CaptureScreenshot() {
		return new Promise((resolve, reject) => {
			chrome.tabs.captureVisibleTab(null, { format: 'png' }, dataUrl => {
				resolve(dataUrl);
			});
		});
	}
})(document);
