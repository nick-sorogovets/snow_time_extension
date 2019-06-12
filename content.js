(($, document) => {
	var snow_submit_button = document.querySelector("div.header.row > div > div > div.btn-group.ng-scope > button:nth-child(1)")

  const init = function () {
    const result = scrapePage();
    chrome.extension.sendRequest(result);
  };

  init();
})(jQuery, document);
