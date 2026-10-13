export function timestamp() {
  return new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.hidden = true;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoking straight after click() can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/** Saves the canvas at its full pixel resolution. */
export function savePNG(canvas, name) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('The canvas could not be encoded'));
        return;
      }
      downloadBlob(blob, `${name}-${timestamp()}.png`);
      resolve();
    }, 'image/png');
  });
}

// ---------- fullscreen ----------

export function fullscreenElement() {
  return document.fullscreenElement || document.webkitFullscreenElement || null;
}

export function canFullscreen(el) {
  return !!(el.requestFullscreen || el.webkitRequestFullscreen);
}

/** Resolves to true once fullscreen was requested successfully. */
export async function enterFullscreen(el) {
  const request = el.requestFullscreen || el.webkitRequestFullscreen;
  if (!request) return false;
  try {
    // Older Safari returns undefined rather than a promise; awaiting that is harmless.
    await request.call(el);
    return true;
  } catch {
    return false;
  }
}

export function exitFullscreen() {
  if (!fullscreenElement()) return;
  const exit = document.exitFullscreen || document.webkitExitFullscreen;
  try {
    exit?.call(document)?.catch?.(() => {});
  } catch {}
}

export function onFullscreenChange(fn) {
  document.addEventListener('fullscreenchange', fn);
  document.addEventListener('webkitfullscreenchange', fn);
  return () => {
    document.removeEventListener('fullscreenchange', fn);
    document.removeEventListener('webkitfullscreenchange', fn);
  };
}
