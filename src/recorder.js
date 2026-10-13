/**
 * Records the canvas to a WebM or MP4 file with the MediaRecorder API (no dependencies).
 */
import { downloadBlob, timestamp } from './export.js';

let session = null; // { recorder, timer, discard() }

export function isRecordingSupported() {
  return (
    typeof MediaRecorder !== 'undefined' &&
    typeof HTMLCanvasElement !== 'undefined' &&
    typeof HTMLCanvasElement.prototype.captureStream === 'function'
  );
}

export function isRecording() {
  return session !== null;
}

/**
 * Starts recording `canvas`. `onStop(saved)` runs when the recording ends, with saved = true
 * if a file was downloaded.
 * @returns {boolean} false if recording could not start
 */
export function startRecording(canvas, { durationMs = 5000, fps = 30, name = 'generative-art', onStop } = {}) {
  if (session || !isRecordingSupported() || durationMs <= 0) return false;

  const mimeType = pickMimeType();
  let recorder;
  try {
    const stream = canvas.captureStream(fps);
    recorder = new MediaRecorder(stream, { ...(mimeType && { mimeType }), videoBitsPerSecond: 6_000_000 });
  } catch {
    return false;
  }

  const chunks = [];
  let discarded = false;

  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };
  // A recording error is followed by a stop event; just make sure the broken file isn't saved.
  recorder.onerror = () => {
    discarded = true;
  };
  recorder.onstop = () => {
    clearTimeout(session?.timer);
    session = null;
    recorder.stream.getTracks().forEach((track) => track.stop());
    const type = recorder.mimeType || mimeType || 'video/webm';
    const saved = !discarded && chunks.length > 0;
    if (saved) {
      const ext = type.includes('mp4') ? 'mp4' : 'webm';
      downloadBlob(new Blob(chunks, { type }), `${name}-${timestamp()}.${ext}`);
    }
    onStop?.(saved);
  };

  try {
    recorder.start(250);
  } catch {
    recorder.stream.getTracks().forEach((track) => track.stop());
    return false;
  }

  session = {
    recorder,
    timer: setTimeout(() => stopRecording(), durationMs),
    discard: () => { discarded = true; },
  };
  return true;
}

/** Stops early. With { discard: true } (for example when leaving the page) nothing is downloaded. */
export function stopRecording({ discard = false } = {}) {
  if (!session) return;
  clearTimeout(session.timer);
  if (discard) session.discard();
  if (session.recorder.state !== 'inactive') session.recorder.stop();
}

function pickMimeType() {
  const types = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4'];
  return types.find((type) => MediaRecorder.isTypeSupported(type)) || '';
}
