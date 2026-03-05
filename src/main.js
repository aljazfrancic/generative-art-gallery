import p5 from 'p5';
import { algorithms, getAlgorithmBySlug } from './algorithms/registry.js';
import { renderGallery, destroyGallery } from './gallery.js';
import { buildControls } from './controls.js';
import { savePNG, toggleFullscreen } from './export.js';

const app = document.getElementById('app');
let currentP5 = null;
let currentAlgo = null;
let currentParams = {};
let resizeHandler = null;

function route() {
  cleanup();
  const hash = location.hash || '#/';

  if (hash.startsWith('#/art/')) {
    const slug = hash.replace('#/art/', '');
    showArtView(slug);
  } else {
    showGallery();
  }
}

function cleanup() {
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

function showGallery() {
  const view = document.createElement('div');
  view.className = 'gallery-view';

  const header = document.createElement('header');
  header.className = 'gallery-header';
  header.innerHTML = `
    <h1>Generative Art Gallery</h1>
    <p>Interactive algorithmic art — click to explore</p>
  `;
  view.appendChild(header);

  const grid = document.createElement('div');
  grid.className = 'gallery-grid';
  view.appendChild(grid);

  app.appendChild(view);
  renderGallery(grid, algorithms);
}

function showArtView(slug) {
  const AlgoClass = getAlgorithmBySlug(slug);
  if (!AlgoClass) {
    location.hash = '#/';
    return;
  }

  const idx = algorithms.indexOf(AlgoClass);
  const prevAlgo = algorithms[(idx - 1 + algorithms.length) % algorithms.length];
  const nextAlgo = algorithms[(idx + 1) % algorithms.length];

  const algo = new AlgoClass();
  currentAlgo = algo;
  currentParams = algo.getDefaultParams();

  const view = document.createElement('div');
  view.className = 'art-view';

  // Main area
  const main = document.createElement('div');
  main.className = 'art-main';

  // Top bar
  const topbar = document.createElement('div');
  topbar.className = 'art-topbar';

  const topbarLeft = document.createElement('div');
  topbarLeft.className = 'art-topbar-left';
  topbarLeft.innerHTML = `
    <button class="btn-back" onclick="location.hash='#/'">&larr; Gallery</button>
    <h2>${AlgoClass.meta.name}</h2>
  `;

  const topbarNav = document.createElement('div');
  topbarNav.className = 'art-topbar-nav';
  topbarNav.innerHTML = `
    <button class="btn btn-icon" title="${prevAlgo.meta.name}">&larr;</button>
    <button class="btn btn-icon" title="${nextAlgo.meta.name}">&rarr;</button>
  `;
  topbarNav.children[0].addEventListener('click', () => {
    location.hash = `#/art/${prevAlgo.meta.slug}`;
  });
  topbarNav.children[1].addEventListener('click', () => {
    location.hash = `#/art/${nextAlgo.meta.slug}`;
  });

  const sidebarToggle = document.createElement('button');
  sidebarToggle.className = 'btn btn-icon btn-sidebar-toggle';
  sidebarToggle.title = 'Toggle Controls';
  sidebarToggle.textContent = '☰';
  sidebarToggle.addEventListener('click', () => {
    view.classList.toggle('sidebar-open');
  });

  topbar.appendChild(topbarLeft);
  topbar.appendChild(sidebarToggle);
  topbar.appendChild(topbarNav);

  const canvasContainer = document.createElement('div');
  canvasContainer.className = 'art-canvas-container';

  main.appendChild(topbar);
  main.appendChild(canvasContainer);

  // Sidebar
  const sidebar = document.createElement('aside');
  sidebar.className = 'art-sidebar';

  // Description section
  const descSection = document.createElement('div');
  descSection.className = 'sidebar-section';
  descSection.innerHTML = `
    <h3>About</h3>
    <p class="sidebar-description">${AlgoClass.meta.description}</p>
  `;
  sidebar.appendChild(descSection);

  // Controls section
  const controlSection = document.createElement('div');
  controlSection.className = 'sidebar-section';
  controlSection.innerHTML = '<h3>Parameters</h3>';

  const controlDefs = algo.getControls();
  const { element: controlsEl, updateUI } = buildControls(
    controlDefs,
    currentParams,
    (key, value) => {
      if (algo.onParamChange) {
        algo.onParamChange(currentP5, currentParams, key);
      }
    }
  );
  controlSection.appendChild(controlsEl);
  sidebar.appendChild(controlSection);

  // Actions section
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
  saveBtn.addEventListener('click', () => {
    savePNG(currentP5, AlgoClass.meta.slug);
  });

  const fullscreenBtn = document.createElement('button');
  fullscreenBtn.className = 'btn';
  fullscreenBtn.textContent = '⛶ Fullscreen';
  fullscreenBtn.addEventListener('click', () => {
    toggleFullscreen(view);
    if (currentP5) {
      setTimeout(() => {
        const { w, h } = canvasDimensions(canvasContainer);
        currentP5.resizeCanvas(w, h);
        if (currentAlgo && currentAlgo.reset) {
          currentAlgo.reset(currentP5, currentParams);
        }
      }, 50);
    }
  });

  actions.appendChild(randomizeBtn);
  actions.appendChild(resetBtn);
  actions.appendChild(saveBtn);
  actions.appendChild(fullscreenBtn);
  actionsSection.appendChild(actions);
  sidebar.appendChild(actionsSection);

  view.appendChild(main);
  view.appendChild(sidebar);
  app.appendChild(view);

  // Create p5 instance
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

  resizeHandler = () => {
    if (!currentP5) return;
    const { w, h } = canvasDimensions(canvasContainer);
    currentP5.resizeCanvas(w, h);
    if (currentAlgo && currentAlgo.reset) {
      currentAlgo.reset(currentP5, currentParams);
    }
  };
  window.addEventListener('resize', resizeHandler);
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
