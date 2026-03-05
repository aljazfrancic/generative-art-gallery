/**
 * Video export module using MediaRecorder API.
 * Records the canvas as WebM or MP4 video (no external dependencies).
 */

let mediaRecorder = null;
let chunks = [];
let recording = false;
let timeoutId = null;

/**
 * Returns true if recording is in progress.
 * @returns {boolean}
 */
export function isRecording() {
  return recording;
}

/**
 * Checks if the recording API is available in the current environment.
 * @returns {boolean}
 */
export function isSupported() {
  return (
    typeof MediaRecorder !== 'undefined' &&
    typeof HTMLCanvasElement !== 'undefined' &&
    typeof HTMLCanvasElement.prototype.captureStream === 'function'
  );
}

/**
 * Starts recording the canvas as video.
 * @param {HTMLCanvasElement|{canvas: HTMLCanvasElement}} canvasOrP5 - Canvas element or p5 instance with .canvas
 * @param {number} durationMs - Recording duration in milliseconds (default: 3000)
 * @param {() => void} [onComplete] - Callback when recording finishes and download begins
 * @returns {boolean} - False if recording could not start
 */
export function startRecording(canvasOrP5, durationMs = 3000, onComplete) {
  if (recording) return false;
  if (!isSupported()) return false;

  const canvas = canvasOrP5?.canvas ?? canvasOrP5;
  if (!canvas || !(canvas instanceof HTMLCanvasElement)) return false;

  if (durationMs <= 0) return false;

  const stream = canvas.captureStream(15);
  const mimeType = getSupportedMimeType();

  try {
    mediaRecorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: 2500000,
    });
  } catch (e) {
    return false;
  }

  chunks = [];
  recording = true;

  mediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  mediaRecorder.onstop = () => {
    const mimeTypeUsed = mediaRecorder?.mimeType ?? mimeType;
    recording = false;
    mediaRecorder = null;

    const blob = new Blob(chunks, { type: mimeTypeUsed });
    chunks = [];

    const ext = mimeTypeUsed.includes('webm') ? 'webm' : 'mp4';
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `generative-art-${Date.now()}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);

    if (typeof onComplete === 'function') onComplete();
  };

  mediaRecorder.onerror = () => {
    recording = false;
    mediaRecorder = null;
    chunks = [];
  };

  try {
    mediaRecorder.start(100);
  } catch (e) {
    recording = false;
    mediaRecorder = null;
    return false;
  }

  timeoutId = setTimeout(() => {
    stopRecording();
  }, durationMs);

  return true;
}

/**
 * Stops recording early. No-op if not recording.
 */
export function stopRecording() {
  if (!recording) return;
  clearTimeout(timeoutId);
  timeoutId = null;
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
  }
}

/**
 * @returns {string} Best supported MIME type for MediaRecorder
 */
function getSupportedMimeType() {
  const types = [
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
    'video/mp4',
  ];
  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return 'video/webm';
}
