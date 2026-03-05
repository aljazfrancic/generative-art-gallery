export function savePNG(p5Instance, algorithmName) {
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
  p5Instance.saveCanvas(`${algorithmName}-${timestamp}`, 'png');
}

export function toggleFullscreen(artView) {
  const fsElement = document.fullscreenElement || document.webkitFullscreenElement;

  if (!fsElement) {
    const request = artView.requestFullscreen || artView.webkitRequestFullscreen;
    if (request) {
      request.call(artView).catch(() => {
        artView.classList.toggle('fullscreen');
      });
    } else {
      artView.classList.toggle('fullscreen');
    }
  } else {
    const exit = document.exitFullscreen || document.webkitExitFullscreen;
    if (exit) {
      exit.call(document);
    }
    artView.classList.remove('fullscreen');
  }
}
