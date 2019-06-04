((document) => {

  const init = () => {
    const container = document.body;
    html2canvas(container).then(function(canvas) {

      const request = {
        data: canvas,
        href: canvas.toDataURL("image/png")
      }
      chrome.extension.sendRequest(request);
    });
  };

  init();
})(document);