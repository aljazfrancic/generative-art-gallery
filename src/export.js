export function savePNG(p5Instance, algorithmName) {
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
  p5Instance.saveCanvas(`${algorithmName}-${timestamp}`, 'png');
}

export function toggleFullscreen(artView) {
  artView.classList.toggle('fullscreen');
}
