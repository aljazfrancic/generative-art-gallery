import { algorithms } from './algorithms/registry.js';
import { buildControls } from './controls.js';
import { loadSketch } from './sketch-loader.js';
import { applyCanvasTheme, createThemeSwitch, onThemeChange } from './theme.js';
import { paramsFromQuery, paramsToQuery } from './params.js';
import { canvasDensity, prefersReducedMotion } from './perf.js';
import { icon } from './icons.js';
import { toast } from './toast.js';
import { savePNG, canFullscreen, enterFullscreen, exitFullscreen, fullscreenElement, onFullscreenChange } from './export.js';
import { isRecordingSupported, isRecording, startRecording, stopRecording } from './recorder.js';

const HOLD_MS = 4000; // how long a finished piece stays up before it starts over
const CHROME_HIDE_MS = 2500; // in full screen, the bar hides after this long without pointer activity
const STILL_FRAMES = 150; // with reduced motion, the piece is run this far and then paused
const RECORD_SECONDS = 5;
const AUTO_RESTART_KEY = 'gallery-autorestart';

let panelOpen = false; // remembered while moving between artworks

function readAutoRestart() {
  try {
    return localStorage.getItem(AUTO_RESTART_KEY) !== 'off';
  } catch {
    return true;
  }
}

const pad = (n) => String(n).padStart(2, '0');

/**
 * Opens an artwork. `focus` moves keyboard focus into the view (after navigating within the app;
 * not on a direct visit, where it would only show a stray focus ring).
 */
export function showArtView(app, AlgoClass, query, { focus = false } = {}) {
  const { meta } = AlgoClass;
  const index = algorithms.indexOf(AlgoClass);
  const prev = algorithms[(index - 1 + algorithms.length) % algorithms.length];
  const next = algorithms[(index + 1) % algorithms.length];
  const animated = meta.animated !== false;
  const canRecord = animated && isRecordingSupported();
  const canShare = matchMedia('(pointer: coarse)').matches && typeof navigator.share === 'function';

  const algo = new AlgoClass();
  algo.interactive = true;
  const controls = algo.getControls();
  const defaults = algo.getDefaultParams();
  const params = paramsFromQuery(controls, defaults, query);
  applyCanvasTheme(params, defaults);

  document.title = `${meta.name} · Generative Art Gallery`;

  const view = document.createElement('div');
  view.className = 'art-view';
  view.innerHTML = `
    <header class="art-bar">
      <div class="art-bar__start">
        <a class="icon-btn art-bar__back" href="#/" aria-label="Back to the gallery" title="Back to the gallery (Esc)">${icon('back')}</a>
        <div class="art-title">
          <span class="art-title__index">${pad(index + 1)} / ${pad(algorithms.length)}</span>
          <h1 class="art-title__name">${meta.name}</h1>
        </div>
      </div>
      <nav class="art-bar__end" aria-label="Artwork">
        <a class="icon-btn" href="#/art/${prev.meta.slug}" aria-label="Previous: ${prev.meta.name}" title="Previous: ${prev.meta.name} (←)">${icon('prev')}</a>
        <a class="icon-btn" href="#/art/${next.meta.slug}" aria-label="Next: ${next.meta.name}" title="Next: ${next.meta.name} (→)">${icon('next')}</a>
        ${animated ? `<button class="icon-btn" type="button" data-action="pause" aria-label="Pause" title="Pause (Space)">${icon('pause')}</button>` : ''}
        <span data-slot="theme"></span>
        <button class="icon-btn" type="button" data-action="panel" aria-controls="art-panel" aria-expanded="false" aria-label="Controls" title="Controls (C)">${icon('sliders')}</button>
      </nav>
    </header>
    <div class="art-stage">
      <div class="art-stage__canvas" role="img" aria-label="${meta.name}: ${meta.description}"></div>
      <div class="art-badge" hidden>${icon('pause')}<span>Paused</span></div>
    </div>
    <div class="art-scrim" aria-hidden="true"></div>
    <aside class="art-panel" id="art-panel" aria-label="Controls">
      <div class="panel__head">
        <h2 class="panel__title">${meta.name}</h2>
        <button class="icon-btn" type="button" data-action="panel-close" aria-label="Close controls" title="Close (Esc)">${icon('close')}</button>
      </div>
      <section class="panel__section">
        <p class="panel__desc">${meta.description}</p>
        <ul class="card__tags">${(meta.tags || []).map((tag) => `<li>${tag}</li>`).join('')}</ul>
      </section>
      <section class="panel__section">
        <h3 class="panel__heading">Parameters</h3>
        <div data-slot="controls"></div>
      </section>
      <section class="panel__section">
        <h3 class="panel__heading">Actions</h3>
        <div class="actions">
          <button class="btn" type="button" data-action="randomize" title="Randomize (R)">${icon('dice')}<span>Randomize</span></button>
          <button class="btn" type="button" data-action="restart">${icon('restart')}<span>${animated ? 'Restart' : 'Reset view'}</span></button>
          <button class="btn" type="button" data-action="defaults">${icon('defaults')}<span>Defaults</span></button>
          <button class="btn" type="button" data-action="share">${icon(canShare ? 'share' : 'link')}<span>${canShare ? 'Share' : 'Copy link'}</span></button>
          <button class="btn btn--accent" type="button" data-action="save" title="Save PNG (S)">${icon('download')}<span>Save PNG</span></button>
          ${canRecord ? `<button class="btn" type="button" data-action="record">${icon('record')}<span>Record ${RECORD_SECONDS}s</span></button>` : ''}
          <button class="btn" type="button" data-action="fullscreen" title="Full screen (F)">${icon('expand')}<span>Full screen</span></button>
        </div>
        ${meta.finite ? `
        <div class="control control--inline control--setting">
          <label class="control__label" for="auto-restart">Auto-restart<small>Start over a few seconds after the piece finishes</small></label>
          <span class="toggle"><input class="toggle__input" type="checkbox" role="switch" id="auto-restart"><span class="toggle__track" aria-hidden="true"></span></span>
        </div>` : ''}
      </section>
      <section class="panel__section panel__shortcuts">
        <h3 class="panel__heading">Keyboard</h3>
        <dl class="shortcuts">
          <div><dt><kbd>←</kbd> <kbd>→</kbd></dt><dd>Previous / next</dd></div>
          ${animated ? '<div><dt><kbd>Space</kbd></dt><dd>Pause / play</dd></div>' : ''}
          <div><dt><kbd>R</kbd></dt><dd>Randomize</dd></div>
          <div><dt><kbd>S</kbd></dt><dd>Save PNG</dd></div>
          <div><dt><kbd>F</kbd></dt><dd>Full screen</dd></div>
          <div><dt><kbd>C</kbd></dt><dd>Show / hide controls</dd></div>
          <div><dt><kbd>Esc</kbd></dt><dd>Close / back</dd></div>
        </dl>
      </section>
    </aside>`;

  const $ = (selector) => view.querySelector(selector);
  const host = $('.art-stage__canvas');
  const badge = $('.art-badge');
  const pauseButton = $('[data-action="pause"]');
  const panelButton = $('[data-action="panel"]');
  const fullscreenButton = $('[data-action="fullscreen"]');
  $('[data-slot="theme"]').replaceWith(createThemeSwitch());

  let sketch = null; // created once p5 has loaded
  let closed = false;

  const { element: controlsElement, updateUI } = buildControls(controls, params, (key) => {
    if (sketch?.ready) algo.onParamChange(sketch.p, params, key);
    scheduleHashUpdate();
  });
  $('[data-slot="controls"]').replaceWith(controlsElement);

  let autoRestart = readAutoRestart();
  const autoRestartInput = $('#auto-restart');
  if (autoRestartInput) {
    autoRestartInput.checked = autoRestart;
    autoRestartInput.addEventListener('change', () => {
      autoRestart = autoRestartInput.checked;
      try {
        if (autoRestart) localStorage.removeItem(AUTO_RESTART_KEY);
        else localStorage.setItem(AUTO_RESTART_KEY, 'off');
      } catch {}
    });
  }

  // ---------- sketch and frame loop ----------

  let rafId = 0;
  let paused = false;
  let lastStep = 0;
  const canvasSize = () => ({
    width: Math.max(1, Math.round(host.clientWidth)),
    height: Math.max(1, Math.round(host.clientHeight)),
  });

  loadSketch().then((Sketch) => {
    if (closed) return;
    sketch = new Sketch(host, algo, params, {
      ...canvasSize(),
      density: canvasDensity(),
      holdMs: HOLD_MS,
      autoRestart: () => autoRestart,
      onReady: () => {
        if (animated && prefersReducedMotion()) {
          sketch.fastForward(STILL_FRAMES, 400);
          setPaused(true);
        }
        rafId = requestAnimationFrame(frame);
      },
    });
  }).catch((error) => {
    console.error(error);
    toast('The drawing library failed to load. Check your connection and reload.');
  });

  function frame(now) {
    rafId = requestAnimationFrame(frame);
    if (paused || !sketch?.ready) return;
    // At most 60 fps (also on 120 Hz screens): the pieces advance by frame.
    if (now - lastStep < 1000 / 60 - 3) return;
    lastStep = now;
    if (algo.isIdle()) return;
    sketch.step(now);
    watchFrameRate(now);
  }

  // If the device can't keep up, render fewer pixels (2x → 1.5x → 1x).
  const fps = { start: 0, frames: 0, slow: 0, drops: 0 };
  const resetFrameRate = () => { fps.start = 0; };
  function watchFrameRate(now) {
    if (!fps.start) {
      fps.start = now;
      fps.frames = 0;
      return;
    }
    fps.frames++;
    if (now - fps.start < 1000) return;
    const rate = (fps.frames * 1000) / (now - fps.start);
    fps.start = now;
    fps.frames = 0;
    if (rate < 28 && sketch.density > 1 && fps.drops < 2) {
      if (++fps.slow >= 2) {
        fps.slow = 0;
        fps.drops++;
        sketch.setDensity(Math.max(1, sketch.density - 0.5));
        resetFrameRate();
      }
    } else {
      fps.slow = 0;
    }
  }
  document.addEventListener('visibilitychange', resetFrameRate);

  function setPaused(on) {
    paused = on;
    badge.hidden = !on;
    if (pauseButton) {
      pauseButton.innerHTML = icon(on ? 'play' : 'pause');
      pauseButton.setAttribute('aria-label', on ? 'Play' : 'Pause');
      pauseButton.title = on ? 'Play (Space)' : 'Pause (Space)';
    }
    if (!on) {
      sketch?.resume();
      resetFrameRate();
    }
  }

  // ---------- canvas size ----------

  let resizeTimer = 0;
  const resizer = new ResizeObserver(() => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (!sketch) return;
      const { width, height } = canvasSize();
      sketch.resize(width, height);
      if (paused) sketch.fastForward(1);
      resetFrameRate();
    }, 120);
  });
  resizer.observe(host);

  // ---------- pointer, for pieces that react to it ----------

  const local = (e) => {
    const r = host.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  host.addEventListener('pointerdown', (e) => { algo.pointer = { ...local(e), down: true }; });
  host.addEventListener('pointermove', (e) => {
    algo.pointer = { ...local(e), down: (e.buttons & 1) === 1 };
  });
  host.addEventListener('pointerup', (e) => {
    algo.pointer = e.pointerType === 'mouse' ? { ...local(e), down: false } : null;
  });
  host.addEventListener('pointerleave', () => { algo.pointer = null; });
  host.addEventListener('pointercancel', () => { algo.pointer = null; });

  // ---------- panel, full screen and actions ----------

  function setPanel(open) {
    panelOpen = open;
    view.classList.toggle('panel-open', open);
    panelButton.setAttribute('aria-expanded', String(open));
    if (open) showChrome();
  }
  $('.art-scrim').addEventListener('click', () => setPanel(false));

  let chromeTimer = 0;
  function showChrome() {
    view.classList.remove('chrome-hidden');
    clearTimeout(chromeTimer);
    if (view.classList.contains('is-immersive')) {
      chromeTimer = setTimeout(() => {
        if (!panelOpen) view.classList.add('chrome-hidden');
      }, CHROME_HIDE_MS);
    }
  }
  view.addEventListener('pointermove', showChrome);
  view.addEventListener('pointerdown', showChrome);

  function setImmersive(on) {
    view.classList.toggle('is-immersive', on);
    fullscreenButton.innerHTML = `${icon(on ? 'shrink' : 'expand')}<span>${on ? 'Exit full screen' : 'Full screen'}</span>`;
    if (on) setPanel(false);
    showChrome();
  }

  function toggleFullscreen() {
    if (fullscreenElement()) {
      exitFullscreen();
    } else if (view.classList.contains('is-immersive')) {
      setImmersive(false);
    } else if (canFullscreen(view)) {
      // iPhone Safari has no element full screen; there the bar just hides itself.
      enterFullscreen(view).then((ok) => {
        if (!ok && !closed) setImmersive(true);
      });
    } else {
      setImmersive(true);
    }
  }
  const offFullscreen = onFullscreenChange(() => setImmersive(fullscreenElement() === view));

  view.addEventListener('click', (e) => {
    const button = e.target.closest('[data-action]');
    switch (button?.dataset.action) {
      case 'pause': setPaused(!paused); break;
      case 'panel': setPanel(!panelOpen); break;
      case 'panel-close': setPanel(false); break;
      case 'randomize': randomize(); break;
      case 'restart': restart(); break;
      case 'defaults': applyParams({ ...defaults }); break;
      case 'share': share(); break;
      case 'save': save(); break;
      case 'record': toggleRecording(button); break;
      case 'fullscreen': toggleFullscreen(); break;
    }
  });

  function restart() {
    sketch?.restart();
    if (paused) setPaused(false);
  }

  function applyParams(next) {
    applyCanvasTheme(next, defaults);
    updateUI(next);
    restart();
    scheduleHashUpdate();
  }

  function randomize() {
    applyParams({ ...params, ...algo.randomize(controls) });
  }

  // Links carry only what differs from the defaults as the current theme shows them, so a
  // background left at its default follows each visitor's own theme.
  function artworkHash() {
    const themedDefaults = { ...defaults };
    applyCanvasTheme(themedDefaults, defaults);
    const query = paramsToQuery(controls, themedDefaults, params);
    return `#/art/${meta.slug}${query ? `?${query}` : ''}`;
  }

  function shareUrl() {
    return `${location.origin}${location.pathname}${artworkHash()}`;
  }

  async function share() {
    const url = shareUrl();
    if (canShare) {
      try {
        await navigator.share({ title: `${meta.name} · Generative Art Gallery`, url });
        return;
      } catch (error) {
        if (error?.name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      toast('Link copied');
    } catch {
      toast('Could not copy the link');
    }
  }

  async function save() {
    if (!sketch?.ready) return;
    try {
      await savePNG(sketch.canvas, meta.slug);
      toast('Saved PNG');
    } catch {
      toast('Could not save the image');
    }
  }

  let countdown = 0;
  function setRecordLabel(button, secondsLeft) {
    const recording = secondsLeft !== null;
    button.classList.toggle('is-recording', recording);
    button.innerHTML = recording
      ? `${icon('stop')}<span>Stop · ${Math.max(0, secondsLeft)}s</span>`
      : `${icon('record')}<span>Record ${RECORD_SECONDS}s</span>`;
  }

  function toggleRecording(button) {
    if (isRecording()) {
      stopRecording();
      return;
    }
    if (!sketch?.ready) return;
    const started = startRecording(sketch.canvas, {
      durationMs: RECORD_SECONDS * 1000,
      name: meta.slug,
      onStop: (saved) => {
        clearInterval(countdown);
        if (!closed) setRecordLabel(button, null);
        if (saved) toast('Video saved');
      },
    });
    if (!started) {
      toast('Recording is not available in this browser');
      return;
    }
    if (paused) setPaused(false);
    let left = RECORD_SECONDS;
    setRecordLabel(button, left);
    countdown = setInterval(() => setRecordLabel(button, --left), 1000);
  }

  // Keep the address bar in step with the parameters, so the URL can be shared as is.
  let hashTimer = 0;
  function scheduleHashUpdate() {
    clearTimeout(hashTimer);
    hashTimer = setTimeout(() => history.replaceState(null, '', artworkHash()), 250);
  }

  const offTheme = onThemeChange(() => {
    if (!applyCanvasTheme(params, defaults)) return;
    updateUI(params);
    sketch?.restart();
    scheduleHashUpdate();
  });

  // ---------- keyboard ----------

  function onKey(e) {
    // Leave browser shortcuts such as Ctrl+F or Cmd+S alone.
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const target = e.target instanceof Element ? e.target : null;
    // Keys typed into a control belong to it, except Esc, which still closes the panel.
    if (e.key !== 'Escape' && target?.closest('input, select, textarea, [contenteditable]')) return;
    switch (e.key) {
      case 'ArrowLeft':
        location.hash = `#/art/${prev.meta.slug}`;
        break;
      case 'ArrowRight':
        location.hash = `#/art/${next.meta.slug}`;
        break;
      case ' ':
        // Space on a focused button or link activates it instead.
        if (!animated || target?.closest('button, a')) return;
        e.preventDefault();
        setPaused(!paused);
        break;
      case 'r': case 'R':
        randomize();
        break;
      case 's': case 'S':
        save();
        break;
      case 'f': case 'F':
        toggleFullscreen();
        break;
      case 'c': case 'C':
        setPanel(!panelOpen);
        break;
      case 'Escape':
        if (panelOpen) setPanel(false);
        else if (fullscreenElement()) return;
        else if (view.classList.contains('is-immersive')) setImmersive(false);
        else location.hash = '#/';
        break;
      default:
        return;
    }
    showChrome();
  }
  window.addEventListener('keydown', onKey);

  app.appendChild(view);
  setPanel(panelOpen);
  if (focus) $('.art-bar__back').focus({ preventScroll: true });

  return () => {
    closed = true;
    cancelAnimationFrame(rafId);
    clearTimeout(hashTimer);
    clearTimeout(resizeTimer);
    clearTimeout(chromeTimer);
    clearInterval(countdown);
    stopRecording({ discard: true });
    resizer.disconnect();
    offTheme();
    offFullscreen();
    window.removeEventListener('keydown', onKey);
    document.removeEventListener('visibilitychange', resetFrameRate);
    exitFullscreen();
    sketch?.destroy();
    view.remove();
  };
}
