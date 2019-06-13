((document) => {
	const snow_submit_button = document.querySelector("div.header.row > div > div > div.btn-group.ng-scope > button:nth-child(1)");
	const weekName = document.querySelector("div.header.row > div.date-selector.col-md-6 > div.date-range > div");
	snow_submit_button.addEventListener('click', () => {
		setTimeout(() => {
			const msg = {
				action: 'submit_pressed',
				week_name: weekName.innerText
			};
			chrome.runtime.sendMessage(msg);
		}, 500);
	});


  const init = function () {
    const initMessage = {
			action: 'init',
			submit_btn: JSON.stringify(snow_submit_button),
			weekName: weekName.innerText,
		}
		chrome.runtime.sendMessage(initMessage);
  };

  init();
})(document);
