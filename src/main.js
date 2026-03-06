import p5 from 'p5';
import { algorithms, getAlgorithmBySlug } from './algorithms/registry.js';
import { renderGallery, destroyGallery } from './gallery.js';
import { buildControls } from './controls.js';
import { savePNG, toggleFullscreen } from './export.js';
import { startRecording, stopRecording, isRecording, isSupported as isRecordingSupported } from './gif-export.js';

const app = document.getElementById('app');
let currentP5 = null;
let currentAlgo = null;
let currentParams = {};
let resizeHandler = null;
let keyHandler = null;
let sidebarOpen = false;

// ---------- theme ----------
function initTheme() {
  const saved = localStorage.getItem('theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
}
function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'light' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
}
function isLightTheme() {
  return document.documentElement.getAttribute('data-theme') === 'light';
}

const DARK_BG_COLORS = ['#0a0a0a', '#000000', '#0a0a0f', '#0a0f14'];
const LIGHT_BG = '#f5f5f5';
const BG_KEYS = ['bgColor', 'deadColor', 'pathColor'];

function applyThemeBgOverrides(params) {
  const light = isLightTheme();
  for (const key of BG_KEYS) {
    if (!(key in params)) continue;
    const val = params[key].toLowerCase();
    if (light && DARK_BG_COLORS.includes(val)) {
      params[key] = LIGHT_BG;
    } else if (!light && val === LIGHT_BG) {
      params[key] = '#0a0a0a';
    }
  }
}
initTheme();

// ---------- routing ----------
function route() {
  cleanup();
  const hash = location.hash || '#/';
  if (hash.startsWith('#/art/')) {
    const slug = hash.replace('#/art/', '').split('?')[0];
    const queryStr = hash.includes('?') ? hash.split('?')[1] : '';
    showArtView(slug, queryStr);
  } else {
    showGallery();
  }
}

function cleanup() {
  if (keyHandler) {
    window.removeEventListener('keydown', keyHandler);
    keyHandler = null;
  }
  if (resizeHandler) {
    window.removeEventListener('resize', resizeHandler);
    resizeHandler = null;
  }
  if (currentP5) {
    currentP5.remove();
    currentP5 = null;
  }
  currentAlgo = null;
  destroyGallery();
  app.innerHTML = '';
}

// ---------- gallery ----------
function showGallery() {
  sidebarOpen = false;
  const view = document.createElement('div');
  view.className = 'gallery-view';

  const header = document.createElement('header');
  header.className = 'gallery-header';

  const titleRow = document.createElement('div');
  titleRow.className = 'gallery-title-row';
  titleRow.innerHTML = `<h1>Generative Art Gallery</h1>`;

  const themeBtn = document.createElement('button');
  themeBtn.className = 'btn btn-icon btn-theme';
  themeBtn.title = 'Toggle Theme';
  themeBtn.textContent = document.documentElement.getAttribute('data-theme') === 'light' ? '🌙' : '☀️';
  themeBtn.addEventListener('click', () => {
    toggleTheme();
    themeBtn.textContent = document.documentElement.getAttribute('data-theme') === 'light' ? '🌙' : '☀️';
    destroyGallery();
    grid.innerHTML = '';
    renderGallery(grid, algorithms);
  });
  titleRow.appendChild(themeBtn);

  const subtitle = document.createElement('p');
  subtitle.textContent = 'Interactive algorithmic art — tap to explore';

  header.appendChild(titleRow);
  header.appendChild(subtitle);

  const tagBar = document.createElement('div');
  tagBar.className = 'tag-bar';

  const allTags = [...new Set(algorithms.flatMap(a => a.meta.tags || []))].sort();
  const selectedTags = new Set();

  for (const tag of allTags) {
    const pill = document.createElement('button');
    pill.className = 'tag-pill';
    pill.textContent = tag;
    pill.addEventListener('click', () => {
      if (selectedTags.has(tag)) {
        selectedTags.delete(tag);
        pill.classList.remove('active');
      } else {
        selectedTags.add(tag);
        pill.classList.add('active');
      }
      filterGallery();
    });
    tagBar.appendChild(pill);
  }

  header.appendChild(tagBar);
  view.appendChild(header);

  const grid = document.createElement('div');
  grid.className = 'gallery-grid';
  view.appendChild(grid);
  app.appendChild(view);

  renderGallery(grid, algorithms);

  function filterGallery() {
    const cards = grid.querySelectorAll('.gallery-card');
    cards.forEach((card, i) => {
      const algo = algorithms[i];
      const tags = algo.meta.tags || [];
      const matches = selectedTags.size === 0 || tags.some(t => selectedTags.has(t));
      card.style.display = matches ? '' : 'none';
    });
  }
}

// ---------- art view ----------
function showArtView(slug, queryStr) {
  const AlgoClass = getAlgorithmBySlug(slug);
  if (!AlgoClass) { location.hash = '#/'; return; }

  const idx = algorithms.indexOf(AlgoClass);
  const prevAlgo = algorithms[(idx - 1 + algorithms.length) % algorithms.length];
  const nextAlgo = algorithms[(idx + 1) % algorithms.length];

  const algo = new AlgoClass();
  currentAlgo = algo;
  currentParams = algo.getDefaultParams();

  // merge URL params
  if (queryStr) {
    const urlParams = new URLSearchParams(queryStr);
    for (const [key, val] of urlParams.entries()) {
      if (key in currentParams) {
        const existing = currentParams[key];
        if (typeof existing === 'boolean') currentParams[key] = val === 'true';
        else if (typeof existing === 'number') currentParams[key] = parseFloat(val);
        else currentParams[key] = val;
      }
    }
  }

  applyThemeBgOverrides(currentParams);

  let artViewUpdateUI = null;

  const view = document.createElement('div');
  view.className = sidebarOpen ? 'art-view sidebar-open' : 'art-view';

  const main = document.createElement('div');
  main.className = 'art-main';

  // top bar
  const topbar = document.createElement('div');
  topbar.className = 'art-topbar';

  const topbarLeft = document.createElement('div');
  topbarLeft.className = 'art-topbar-left';
  topbarLeft.innerHTML = `
    <button class="btn-back" onclick="location.hash='#/'">⬅️ Gallery</button>
    <h2>${AlgoClass.meta.name}</h2>
  `;

  const topbarRight = document.createElement('div');
  topbarRight.className = 'art-topbar-nav';

  const themeBtn = document.createElement('button');
  themeBtn.className = 'btn btn-icon btn-theme';
  themeBtn.title = 'Toggle Theme';
  themeBtn.textContent = isLightTheme() ? '🌙' : '☀️';
  themeBtn.addEventListener('click', () => {
    toggleTheme();
    themeBtn.textContent = isLightTheme() ? '🌙' : '☀️';
    applyThemeBgOverrides(currentParams);
    if (artViewUpdateUI) artViewUpdateUI(currentParams);
    if (currentP5 && currentAlgo) currentAlgo.reset(currentP5, currentParams);
  });

  const prevBtn = document.createElement('button');
  prevBtn.className = 'btn btn-icon';
  prevBtn.title = prevAlgo.meta.name;
  prevBtn.innerHTML = '⬅️';
  prevBtn.addEventListener('click', () => { location.hash = `#/art/${prevAlgo.meta.slug}`; });

  const nextBtn = document.createElement('button');
  nextBtn.className = 'btn btn-icon';
  nextBtn.title = nextAlgo.meta.name;
  nextBtn.innerHTML = '➡️';
  nextBtn.addEventListener('click', () => { location.hash = `#/art/${nextAlgo.meta.slug}`; });

  const sidebarToggle = document.createElement('button');
  sidebarToggle.className = 'btn btn-icon btn-sidebar-toggle';
  sidebarToggle.title = 'Toggle Controls';
  sidebarToggle.textContent = '⚙️';
  sidebarToggle.addEventListener('click', () => {
    view.classList.toggle('sidebar-open');
    sidebarOpen = view.classList.contains('sidebar-open');
  });

  topbarRight.appendChild(themeBtn);
  topbarRight.appendChild(prevBtn);
  topbarRight.appendChild(nextBtn);
  topbarRight.appendChild(sidebarToggle);

  topbar.appendChild(topbarLeft);
  topbar.appendChild(topbarRight);

  const canvasContainer = document.createElement('div');
  canvasContainer.className = 'art-canvas-container';

  main.appendChild(topbar);
  main.appendChild(canvasContainer);

  // sidebar
  const sidebar = document.createElement('aside');
  sidebar.className = 'art-sidebar';

  const descSection = document.createElement('div');
  descSection.className = 'sidebar-section';
  descSection.innerHTML = `
    <h3>About</h3>
    <p class="sidebar-description">${AlgoClass.meta.description}</p>
  `;
  sidebar.appendChild(descSection);

  // controls
  const controlSection = document.createElement('div');
  controlSection.className = 'sidebar-section';
  controlSection.innerHTML = '<h3>Parameters</h3>';

  const controlDefs = algo.getControls();

  function updateHash() {
    const paramStr = new URLSearchParams(currentParams).toString();
    const newHash = `#/art/${slug}?${paramStr}`;
    history.replaceState(null, '', newHash);
  }

  const { element: controlsEl, updateUI } = buildControls(
    controlDefs, currentParams,
    (key, value) => {
      if (algo.onParamChange) algo.onParamChange(currentP5, currentParams, key);
      updateHash();
    }
  );
  artViewUpdateUI = updateUI;
  controlSection.appendChild(controlsEl);
  sidebar.appendChild(controlSection);

  // actions
  const actionsSection = document.createElement('div');
  actionsSection.className = 'sidebar-section';
  actionsSection.innerHTML = '<h3>Actions</h3>';
  const actions = document.createElement('div');
  actions.className = 'sidebar-actions';

  const randomizeBtn = document.createElement('button');
  randomizeBtn.className = 'btn';
  randomizeBtn.textContent = '🎲 Randomize';
  randomizeBtn.addEventListener('click', () => {
    const newParams = algo.randomize(controlDefs);
    Object.assign(currentParams, newParams);
    updateUI(currentParams);
    algo.reset(currentP5, currentParams);
    updateHash();
  });

  const resetBtn = document.createElement('button');
  resetBtn.className = 'btn';
  resetBtn.textContent = '↺ Reset';
  resetBtn.addEventListener('click', () => {
    algo.reset(currentP5, currentParams);
  });

  const saveBtn = document.createElement('button');
  saveBtn.className = 'btn btn-accent';
  saveBtn.textContent = '💾 Save PNG';
  saveBtn.addEventListener('click', () => { savePNG(currentP5, AlgoClass.meta.slug); });

  const copyLinkBtn = document.createElement('button');
  copyLinkBtn.className = 'btn';
  copyLinkBtn.textContent = '🔗 Copy Link';
  copyLinkBtn.addEventListener('click', () => {
    updateHash();
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      copyLinkBtn.textContent = '✓ Copied!';
      setTimeout(() => { copyLinkBtn.textContent = '🔗 Copy Link'; }, 1500);
    }).catch(() => {
      copyLinkBtn.textContent = '⚠ Failed';
      setTimeout(() => { copyLinkBtn.textContent = '🔗 Copy Link'; }, 1500);
    });
  });

  const recordBtn = document.createElement('button');
  recordBtn.className = 'btn';
  recordBtn.textContent = '⏺ Record Video';
  if (isRecordingSupported()) {
    recordBtn.addEventListener('click', () => {
      if (isRecording()) {
        stopRecording();
        recordBtn.textContent = '⏺ Record Video';
        recordBtn.classList.remove('recording');
      } else {
        const started = startRecording(currentP5, 5000, () => {
          recordBtn.textContent = '⏺ Record Video';
          recordBtn.classList.remove('recording');
        });
        if (started) {
          recordBtn.textContent = '⏹ Stop Recording';
          recordBtn.classList.add('recording');
        }
      }
    });
  } else {
    recordBtn.disabled = true;
    recordBtn.title = 'Recording not supported in this browser';
  }

  const fullscreenBtn = document.createElement('button');
  fullscreenBtn.className = 'btn';
  fullscreenBtn.textContent = '⛶ Fullscreen';
  fullscreenBtn.addEventListener('click', () => {
    toggleFullscreen(view);
    if (currentP5) {
      setTimeout(() => {
        const { w, h } = canvasDimensions(canvasContainer);
        currentP5.resizeCanvas(w, h);
        if (currentAlgo && currentAlgo.reset) currentAlgo.reset(currentP5, currentParams);
      }, 50);
    }
  });

  actions.appendChild(randomizeBtn);
  actions.appendChild(resetBtn);
  actions.appendChild(saveBtn);
  actions.appendChild(copyLinkBtn);
  if (slug !== 'mandelbrot') actions.appendChild(recordBtn);
  actions.appendChild(fullscreenBtn);
  actionsSection.appendChild(actions);
  sidebar.appendChild(actionsSection);

  // keyboard shortcuts help
  const helpSection = document.createElement('div');
  helpSection.className = 'sidebar-section shortcuts-section';
  helpSection.innerHTML = `
    <h3>Keyboard Shortcuts</h3>
    <div class="shortcuts-list">
      <span class="shortcut"><kbd>⬅️</kbd><kbd>➡️</kbd> Prev / Next</span>
      <span class="shortcut"><kbd>S</kbd> Save PNG</span>
      <span class="shortcut"><kbd>F</kbd> Fullscreen</span>
      <span class="shortcut"><kbd>R</kbd> Randomize</span>
      <span class="shortcut"><kbd>Esc</kbd> Back / Close</span>
    </div>
  `;
  sidebar.appendChild(helpSection);

  view.appendChild(main);
  view.appendChild(sidebar);

  // transition
  view.style.opacity = '0';
  view.style.transform = 'translateY(8px)';
  app.appendChild(view);
  requestAnimationFrame(() => {
    view.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
    view.style.opacity = '1';
    view.style.transform = 'translateY(0)';
  });

  // p5 instance
  const sketch = (p) => {
    p.setup = () => {
      const { w, h } = canvasDimensions(canvasContainer);
      const canvas = p.createCanvas(w, h);
      canvas.parent(canvasContainer);
      algo.setup(p, currentParams);
    };
    p.draw = () => {
      algo.draw(p, currentParams);
    };
  };

  currentP5 = new p5(sketch);

  canvasContainer.addEventListener('contextmenu', (e) => e.preventDefault());
  canvasContainer.addEventListener('click', () => { view.classList.remove('sidebar-open'); sidebarOpen = false; });

  resizeHandler = () => {
    if (!currentP5) return;
    const { w, h } = canvasDimensions(canvasContainer);
    currentP5.resizeCanvas(w, h);
    if (currentAlgo && currentAlgo.reset) currentAlgo.reset(currentP5, currentParams);
  };
  window.addEventListener('resize', resizeHandler);

  // keyboard shortcuts
  keyHandler = (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;
    switch (e.key) {
      case 'ArrowLeft':
        location.hash = `#/art/${prevAlgo.meta.slug}`;
        break;
      case 'ArrowRight':
        location.hash = `#/art/${nextAlgo.meta.slug}`;
        break;
      case 's': case 'S':
        savePNG(currentP5, AlgoClass.meta.slug);
        break;
      case 'f': case 'F':
        fullscreenBtn.click();
        break;
      case 'r': case 'R':
        randomizeBtn.click();
        break;
      case 'Escape':
        if (view.classList.contains('sidebar-open')) { view.classList.remove('sidebar-open'); sidebarOpen = false; }
        else location.hash = '#/';
        break;
    }
  };
  window.addEventListener('keydown', keyHandler);
}

function canvasDimensions(container) {
  const rect = container.getBoundingClientRect();
  const pad = window.innerWidth <= 600 ? 8 : 32;
  const w = Math.floor(rect.width - pad);
  const h = Math.floor(rect.height - pad);
  return { w: Math.max(w, 200), h: Math.max(h, 200) };
}

window.addEventListener('hashchange', route);

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', route);
} else {
  route();
}
