(document => {
	const init = function () {
		const snow_submit_button = document.querySelector(
			'div.header.row > div > div > div.btn-group.ng-scope > button:nth-child(1)'
		);
		const weekName = document.querySelector(
			'div.header.row > div.date-selector.col-md-6 > div.date-range > div'
		);
		if (snow_submit_button && weekName) {
			snow_submit_button.addEventListener('click', () => {
				setTimeout(() => {
					const msg = {
						action: 'submit_pressed',
						week_name: weekName.innerText,
					};

					chrome.runtime.sendMessage(msg, response => {
						if (response && response.name) {
							alert(`Thank you for upload screenshot '${response.name}'`);
						}
					});
				}, 0);
			});

			const initMessage = {
				action: 'init',
				week_name: weekName.innerText
			};
			
			chrome.runtime.sendMessage(initMessage, response => {
				if(weekName.innerText === response.name){
					snow_submit_button.innerText = "Submit & Upload";
				} else {
					snow_submit_button.innerText = "Submit";
				}
			});
		} else {
			setTimeout(init, 1000);
		}
	};

	init();
})(document);
