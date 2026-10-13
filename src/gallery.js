import { algorithms } from './algorithms/registry.js';
import { loadSketch } from './sketch-loader.js';
import { applyCanvasTheme, createThemeSwitch, onThemeChange } from './theme.js';
import { canvasDensity, lowEnd, prefersReducedMotion } from './perf.js';
import { icon } from './icons.js';

const REPO_URL = 'https://github.com/aljazfrancic/generative-art-gallery';
const AUTHOR_URL = 'https://aljazfrancic.github.io/';

// All thumbnails share one animation loop with a time budget per frame: on a slow device they
// simply update less often instead of making scrolling janky. Each is capped at 30 fps.
const BUDGET_MS = lowEnd ? 4 : 8;
const FRAME_INTERVAL = 1000 / (lowEnd ? 20 : 30);
// With reduced motion, each thumbnail is run this many frames out of sight, then shown as a still.
const STILL_FRAMES = 150;

let view = null; // built once, then kept (with its running thumbnails) while an artwork is open
let savedScroll = 0;
let rafId = 0;
const thumbs = [];
const queue = [];
let queueTimer = 0;

export function showGallery(app) {
  view ??= build();
  app.appendChild(view);
  document.title = 'Generative Art Gallery';
  for (const t of thumbs) retheme(t); // the theme may have changed while an artwork was open
  window.scrollTo(0, savedScroll);
  wake();
  return () => {
    savedScroll = window.scrollY;
    cancelAnimationFrame(rafId);
    rafId = 0;
    view.remove();
  };
}

function build() {
  const root = document.createElement('div');
  root.className = 'gallery is-entering';
  setTimeout(() => root.classList.remove('is-entering'), 1500);
  const tags = [...new Set(algorithms.flatMap((a) => a.meta.tags || []))].sort();
  root.innerHTML = `
    <div class="page-controls">
      <a class="icon-btn" href="${REPO_URL}" target="_blank" rel="noopener" aria-label="Source code on GitHub" title="Source code on GitHub">${icon('github')}</a>
    </div>
    <header class="hero">
      <img class="hero__mark" src="${import.meta.env.BASE_URL}favicon.svg" alt="" width="64" height="64">
      <h1 class="hero__title">Generative Art Gallery</h1>
      <p class="hero__lead">${algorithms.length} algorithms drawing in real time, right in your browser. Open one to shape it with its parameters, then save it as an image or a video.</p>
      <div class="filters" role="group" aria-label="Filter by tag">
        <button class="chip is-active" type="button" data-tag="" aria-pressed="true">All</button>
        ${tags.map((tag) => `<button class="chip" type="button" data-tag="${tag}" aria-pressed="false">${tag}</button>`).join('')}
      </div>
    </header>
    <main class="grid" aria-label="Artworks"></main>
    <footer class="footer">
      <p>Made by <a href="${AUTHOR_URL}">Aljaž Frančič</a> · <a href="${REPO_URL}" target="_blank" rel="noopener">Source on GitHub</a> · MIT License</p>
    </footer>`;
  root.querySelector('.page-controls').appendChild(createThemeSwitch());

  const grid = root.querySelector('.grid');
  algorithms.forEach((AlgoClass, i) => {
    const { meta } = AlgoClass;
    const card = document.createElement('a');
    card.className = 'card';
    card.href = `#/art/${meta.slug}`;
    card.style.setProperty('--i', i);
    card.setAttribute('aria-labelledby', `title-${meta.slug}`);
    card.setAttribute('aria-describedby', `desc-${meta.slug}`);
    card.innerHTML = `
      <div class="card__media"><div class="skeleton" aria-hidden="true"></div></div>
      <div class="card__body">
        <div class="card__heading">
          <span class="card__index" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span>
          <h2 class="card__title" id="title-${meta.slug}">${meta.name}</h2>
        </div>
        <p class="card__desc" id="desc-${meta.slug}">${meta.description}</p>
        <ul class="card__tags">${(meta.tags || []).map((tag) => `<li>${tag}</li>`).join('')}</ul>
      </div>`;
    grid.appendChild(card);
    thumbs.push({
      AlgoClass,
      card,
      media: card.querySelector('.card__media'),
      sketch: null,
      params: null,
      defaults: null,
      visible: false,
      queued: false,
      still: false,
      lastDraw: 0,
      resizeTimer: 0,
    });
  });

  setUpFilters(root);
  setUpTilt(grid);

  const byElement = new Map(thumbs.flatMap((t) => [[t.card, t], [t.media, t]]));
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      const t = byElement.get(entry.target);
      t.visible = entry.isIntersecting;
      if (t.visible && !t.queued) enqueue(t);
    }
    wake();
  }, { rootMargin: '200px 0px' });
  for (const t of thumbs) observer.observe(t.card);

  // Cards change size with the window; their canvases follow (debounced).
  const resizer = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const t = byElement.get(entry.target);
      const { width, height } = entry.contentRect;
      if (!t.sketch || width === 0 || height === 0) continue;
      clearTimeout(t.resizeTimer);
      t.resizeTimer = setTimeout(() => t.sketch.resize(Math.round(width), Math.round(height)), 150);
    }
  });
  for (const t of thumbs) resizer.observe(t.media);

  onThemeChange(() => {
    if (view?.isConnected) for (const t of thumbs) retheme(t);
  });
  return root;
}

function setUpFilters(root) {
  const chips = [...root.querySelectorAll('.chip')];
  const selected = new Set();
  root.querySelector('.filters').addEventListener('click', (e) => {
    const tag = e.target.closest('.chip')?.dataset.tag;
    if (tag === undefined) return;
    if (!tag) selected.clear();
    else if (selected.has(tag)) selected.delete(tag);
    else selected.add(tag);
    for (const chip of chips) {
      const on = chip.dataset.tag ? selected.has(chip.dataset.tag) : selected.size === 0;
      chip.classList.toggle('is-active', on);
      chip.setAttribute('aria-pressed', String(on));
    }
    for (const t of thumbs) {
      t.card.hidden = selected.size > 0 && !(t.AlgoClass.meta.tags || []).some((x) => selected.has(x));
    }
  });
}

/** A slight 3D tilt towards the pointer, for mice only and never with reduced motion. */
function setUpTilt(grid) {
  if (prefersReducedMotion() || !matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  let pending = null;
  grid.addEventListener('pointermove', (e) => {
    const card = e.target.closest('.card');
    if (!card) return;
    const first = pending === null;
    pending = { card, x: e.clientX, y: e.clientY };
    if (!first) return;
    requestAnimationFrame(() => {
      const { card: c, x, y } = pending;
      pending = null;
      const r = c.getBoundingClientRect();
      c.style.setProperty('--ry', `${((x - r.left) / r.width - 0.5) * 6}deg`);
      c.style.setProperty('--rx', `${-((y - r.top) / r.height - 0.5) * 6}deg`);
    });
  });
  grid.addEventListener('pointerout', (e) => {
    const card = e.target.closest('.card');
    if (card && !card.contains(e.relatedTarget)) {
      card.style.removeProperty('--rx');
      card.style.removeProperty('--ry');
    }
  });
}

// ---------- thumbnails ----------

function enqueue(t) {
  t.queued = true;
  queue.push(t);
  if (!queueTimer) queueTimer = setTimeout(drainQueue, 0);
}

// One new sketch at a time, a little apart, so starting them doesn't stall scrolling.
async function drainQueue() {
  queueTimer = 0;
  const t = queue.shift();
  if (!t) return;
  try {
    await createThumbnail(t);
  } catch (error) {
    console.error(error);
    t.queued = false; // try again the next time it scrolls into view
  }
  if (queue.length && !queueTimer) queueTimer = setTimeout(drainQueue, 60);
}

async function createThumbnail(t) {
  const Sketch = await loadSketch();
  const algo = new t.AlgoClass();
  t.defaults = algo.getDefaultParams();
  t.params = { ...t.defaults };
  applyCanvasTheme(t.params, t.defaults);
  const { width, height } = t.media.getBoundingClientRect();
  t.sketch = new Sketch(t.media, algo, t.params, {
    width: Math.max(1, Math.round(width)),
    height: Math.max(1, Math.round(height)),
    density: canvasDensity(),
    holdMs: 2500,
    vary: true,
    onReady: () => {
      t.media.querySelector('.skeleton')?.remove();
      t.media.classList.add('is-ready');
      wake();
    },
  });
}

function retheme(t) {
  if (t.params && applyCanvasTheme(t.params, t.defaults) && t.sketch?.ready) {
    t.sketch.restart();
    t.still = false;
  }
}

function wake() {
  if (!rafId && view?.isConnected) rafId = requestAnimationFrame(tick);
}

function tick(now) {
  rafId = 0;
  const reduced = prefersReducedMotion();
  const due = [];
  let active = 0;
  for (const t of thumbs) {
    if (!t.visible || !t.sketch?.ready || t.still || t.sketch.algo.isIdle()) continue;
    active++;
    if (reduced || now - t.lastDraw >= FRAME_INTERVAL - 2) due.push(t);
  }
  due.sort((a, b) => a.lastDraw - b.lastDraw); // longest-waiting first, so every thumbnail gets its turn

  const start = performance.now();
  for (const t of due) {
    if (reduced) {
      // Run up to the still frame in one go rather than animating.
      t.sketch.fastForward(STILL_FRAMES - t.sketch.frames, BUDGET_MS * 4);
      if (t.sketch.frames >= STILL_FRAMES) t.still = true;
    } else {
      t.sketch.step(now);
    }
    t.lastDraw = now;
    if (performance.now() - start > BUDGET_MS) break;
  }
  if (active > 0) rafId = requestAnimationFrame(tick);
}
