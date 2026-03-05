import p5 from 'p5';

const thumbnailInstances = [];
const cardInstanceMap = new Map();
let galleryObserver = null;
let initQueue = [];
let initTimer = null;

const DARK_BG_COLORS = ['#0a0a0a', '#000000', '#0a0a0f', '#0a0f14'];
const LIGHT_BG = '#f5f5f5';
const BG_KEYS = ['bgColor', 'deadColor', 'pathColor'];

function applyThemeBgOverrides(params) {
  const light = document.documentElement.getAttribute('data-theme') === 'light';
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



function processInitQueue() {
  if (initQueue.length === 0) {
    initTimer = null;
    return;
  }
  const { canvasWrap, AlgoClass, skeleton, card } = initQueue.shift();
  const instance = createThumbnail(canvasWrap, AlgoClass, skeleton);
  if (instance) cardInstanceMap.set(card, instance);
  initTimer = setTimeout(processInitQueue, 150);
}

export function renderGallery(container, algorithms) {
  galleryObserver = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      const card = entry.target;

      if (entry.isIntersecting) {
        const existing = cardInstanceMap.get(card);
        if (existing) {
          existing.loop();
        } else if (!card.dataset.queued) {
          card.dataset.queued = '1';
          const canvasWrap = card.querySelector('.gallery-card-canvas');
          const skeleton = canvasWrap?.querySelector('.skeleton-shimmer');
          const slug = card.dataset.algoSlug;
          const AlgoClass = algorithms.find(a => a.meta.slug === slug);
          if (AlgoClass && canvasWrap) {
            initQueue.push({ canvasWrap, AlgoClass, skeleton, card });
            if (!initTimer) processInitQueue();
          }
        }
      } else {
        const existing = cardInstanceMap.get(card);
        if (existing) existing.noLoop();
      }
    }
  }, { rootMargin: '200px' });

  for (const AlgoClass of algorithms) {
    const card = document.createElement('div');
    card.className = 'gallery-card';
    card.dataset.algoSlug = AlgoClass.meta.slug;
    card.addEventListener('click', () => {
      location.hash = `#/art/${AlgoClass.meta.slug}`;
    });

    let ticking = false;
    let lastX = 0, lastY = 0;
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      lastX = (e.clientX - rect.left) / rect.width - 0.5;
      lastY = (e.clientY - rect.top) / rect.height - 0.5;
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(() => {
          card.style.transform = `perspective(600px) rotateY(${lastX * 6}deg) rotateX(${-lastY * 6}deg) translateY(-4px) scale(1.01)`;
          ticking = false;
        });
      }
    });
    card.addEventListener('mouseleave', () => {
      card.style.transform = '';
    });

    const canvasWrap = document.createElement('div');
    canvasWrap.className = 'gallery-card-canvas';
    const skeleton = document.createElement('div');
    skeleton.className = 'skeleton-shimmer';
    canvasWrap.appendChild(skeleton);

    const info = document.createElement('div');
    info.className = 'gallery-card-info';

    const tags = (AlgoClass.meta.tags || []);
    const tagHtml = tags.map(t => `<span class="card-tag">${t}</span>`).join('');

    info.innerHTML = `
      <h3>${AlgoClass.meta.name}</h3>
      <p>${AlgoClass.meta.description}</p>
      ${tagHtml ? `<div class="card-tags">${tagHtml}</div>` : ''}
    `;

    card.appendChild(canvasWrap);
    card.appendChild(info);
    container.appendChild(card);

    galleryObserver.observe(card);
  }
}

function createThumbnail(container, AlgoClass, skeleton) {
  const algo = new AlgoClass();
  const params = algo.getDefaultParams();
  applyThemeBgOverrides(params);
  const fps = 10;

  let instance;
  const sketch = (p) => {
    p.setup = () => {
      const rect = container.getBoundingClientRect();
      const w = Math.min(Math.floor(rect.width), 300);
      const h = Math.min(Math.floor(rect.height), 225);
      p.pixelDensity(1);
      const canvas = p.createCanvas(w, h);
      canvas.parent(container);
      p.frameRate(fps);
      algo.setup(p, params);
      canvas.elt.style.width = '100%';
      canvas.elt.style.height = '100%';
      if (skeleton && skeleton.parentNode) skeleton.remove();
    };

    p.draw = () => {
      algo.draw(p, params);
    };
  };

  instance = new p5(sketch);
  thumbnailInstances.push(instance);
  return instance;
}

export function destroyGallery() {
  if (initTimer) {
    clearTimeout(initTimer);
    initTimer = null;
  }
  initQueue = [];
  if (galleryObserver) {
    galleryObserver.disconnect();
    galleryObserver = null;
  }
  for (const inst of thumbnailInstances) {
    inst.remove();
  }
  thumbnailInstances.length = 0;
  cardInstanceMap.clear();
}
