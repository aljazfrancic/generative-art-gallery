import { ArtAlgorithm } from './base.js';
import { icon } from '../icons.js';
import { packRgb } from '../lib/color.js';

const LUT_SIZE = 1024;
const BAILOUT = 256; // escape radius²: a large radius makes the colour bands blend smoothly
const MAX_ZOOM = 2e13; // past this, double precision turns the image into blocks
const PREVIEW_SAMPLES = 60_000;
const SETTLE_MS = 140; // full resolution starts once a gesture has paused this long

const clamp255 = (v) => (v < 0 ? 0 : v > 255 ? 255 : Math.round(v));

// At zoom 1 the whole set fits on screen: this much of the complex plane, whichever side is tighter.
const FIT = { mandelbrot: { x: -0.65, w: 3.3, h: 2.8 }, julia: { x: 0, w: 3.6, h: 2.6 } };

export class Mandelbrot extends ArtAlgorithm {
  static meta = {
    name: 'Mandelbrot Set',
    description:
      'Explore the Mandelbrot and Julia sets: click or pinch to zoom, drag to pan, scroll to zoom toward the pointer.',
    slug: 'mandelbrot',
    tags: ['fractal', 'math'],
    animated: false,
  };

  centerX = -0.5;
  centerY = 0;
  zoom = 1;
  params = null;
  // Rendering happens a slice at a time inside draw(): a quick low-resolution preview first,
  // then full resolution row by row, so the page stays responsive even on slow devices.
  job = null; // { stage: 'preview' | 'wait' | 'full', y }
  lastGesture = 0;
  image = null;
  pixels = null;
  preview = null;
  lut = null;
  lutKey = '';
  ui = null;

  getControls() {
    return [
      { type: 'slider', key: 'maxIter', label: 'Max Iterations', min: 50, max: 500, step: 10, default: 150 },
      { type: 'slider', key: 'colorSpeed', label: 'Color Cycle', min: 1, max: 20, step: 1, default: 8 },
      {
        type: 'select',
        key: 'palette',
        label: 'Palette',
        default: 'electric',
        options: [
          { value: 'electric', label: 'Electric' },
          { value: 'fire', label: 'Fire' },
          { value: 'ocean', label: 'Ocean' },
          { value: 'grayscale', label: 'Grayscale' },
        ],
      },
      { type: 'toggle', key: 'julia', label: 'Julia Mode', default: false },
      { type: 'slider', key: 'juliaR', label: 'Julia Real', min: -2, max: 2, step: 0.01, default: -0.7 },
      { type: 'slider', key: 'juliaI', label: 'Julia Imag', min: -2, max: 2, step: 0.01, default: 0.27 },
    ];
  }

  setup(p, params) {
    this.params = params;
    this.resetView(params);
    this.allocate(p);
    if (this.interactive && !this.ui) this.attachUI(p);
    this.invalidate();
  }

  reset(p, params) {
    this.resetView(params);
    this.invalidate();
  }

  /** A new canvas size keeps the current view. */
  resize(p) {
    this.allocate(p);
    this.invalidate();
  }

  isIdle() {
    return this.job === null;
  }

  resetView(params) {
    this.centerX = FIT[params.julia ? 'julia' : 'mandelbrot'].x;
    this.centerY = 0;
    this.zoom = 1;
  }

  /** Complex-plane units per pixel of a w×h view (CSS or device pixels alike). */
  unit(w, h) {
    const fit = FIT[this.params?.julia ? 'julia' : 'mandelbrot'];
    return Math.max(fit.w / w, fit.h / h) / this.zoom;
  }

  allocate(p) {
    // Render at the canvas's full device resolution.
    const W = p.canvas.width;
    const H = p.canvas.height;
    this.image = new ImageData(W, H);
    this.pixels = new Uint32Array(this.image.data.buffer);
    if (!this.preview) {
      const canvas = document.createElement('canvas');
      this.preview = { canvas, ctx: canvas.getContext('2d') };
    }
    const step = Math.max(2, Math.ceil(Math.sqrt((W * H) / PREVIEW_SAMPLES)));
    const { canvas, ctx } = this.preview;
    canvas.width = Math.ceil(W / step);
    canvas.height = Math.ceil(H / step);
    const image = ctx.createImageData(canvas.width, canvas.height);
    Object.assign(this.preview, { step, image, pixels: new Uint32Array(image.data.buffer) });
  }

  invalidate(gesture = false) {
    if (gesture) this.lastGesture = performance.now();
    this.job = { stage: 'preview', y: 0 };
    if (this.ui) this.ui.level.textContent = formatZoom(this.zoom);
  }

  draw(p, params) {
    const job = this.job;
    if (!job) return;
    if (job.stage === 'preview') {
      this.renderPreview(p, params);
      job.stage = 'wait';
    }
    if (job.stage === 'wait') {
      if (performance.now() - this.lastGesture < SETTLE_MS) return;
      job.stage = 'full';
    }

    const { width: W, height: H } = this.image;
    const rowsPerSlice = Math.max(1, Math.round(16384 / W));
    const deadline = performance.now() + (this.interactive ? 12 : 6);
    const y0 = job.y;
    do {
      const y1 = Math.min(H, job.y + rowsPerSlice);
      this.renderRows(params, job.y, y1, this.pixels, W, W, H, 1, params.maxIter);
      job.y = y1;
    } while (job.y < H && performance.now() < deadline);
    // putImageData works in device pixels and ignores the canvas transform.
    p.drawingContext.putImageData(this.image, 0, 0, 0, y0, W, job.y - y0);
    if (job.y >= H) this.job = null;
  }

  renderPreview(p, params) {
    const { canvas, ctx, image, pixels, step } = this.preview;
    this.renderRows(params, 0, canvas.height, pixels, canvas.width, this.image.width, this.image.height, step,
      Math.min(params.maxIter, 100));
    ctx.putImageData(image, 0, 0);
    const main = p.drawingContext;
    main.save();
    main.setTransform(1, 0, 0, 1, 0, 0);
    main.imageSmoothingEnabled = true;
    main.drawImage(canvas, 0, 0, canvas.width * step, canvas.height * step);
    main.restore();
  }

  /** Fills rows [y0, y1) of `out` (bw wide); each output pixel samples a step×step block of a W×H image. */
  renderRows(params, y0, y1, out, bw, W, H, step, maxIter) {
    const { colorSpeed, julia, juliaR, juliaI } = params;
    const lut = this.palette(params);
    const unit = this.unit(W, H); // complex-plane units per device pixel
    const xMin = this.centerX - (W / 2) * unit;
    const yMin = this.centerY - (H / 2) * unit;
    const inside = 0xff000000;
    const toLut = LUT_SIZE / 256;

    for (let y = y0; y < y1; y++) {
      const ci0 = yMin + (y + 0.5) * step * unit;
      let o = y * bw;
      for (let x = 0; x < bw; x++, o++) {
        const cr0 = xMin + (x + 0.5) * step * unit;
        let zr, zi, cr, ci;
        if (julia) {
          zr = cr0; zi = ci0; cr = juliaR; ci = juliaI;
        } else {
          // Points inside the main cardioid or the period-2 bulb never escape: skip iterating.
          const xq = cr0 - 0.25;
          const q = xq * xq + ci0 * ci0;
          if (q * (q + xq) <= 0.25 * ci0 * ci0 || (cr0 + 1) * (cr0 + 1) + ci0 * ci0 <= 0.0625) {
            out[o] = inside;
            continue;
          }
          zr = 0; zi = 0; cr = cr0; ci = ci0;
        }
        let zr2 = zr * zr;
        let zi2 = zi * zi;
        let i = 0;
        while (zr2 + zi2 <= BAILOUT && i < maxIter) {
          zi = 2 * zr * zi + ci;
          zr = zr2 - zi2 + cr;
          zr2 = zr * zr;
          zi2 = zi * zi;
          i++;
        }
        if (i >= maxIter) {
          out[o] = inside;
          continue;
        }
        // Continuous escape count, so neighbouring bands blend instead of stepping.
        const smooth = i + 1 - Math.log2(0.5 * Math.log(zr2 + zi2));
        let t = (smooth * colorSpeed) % 256;
        if (t < 0) t += 256;
        out[o] = lut[(t * toLut) | 0];
      }
    }
  }

  palette(params) {
    if (this.lutKey !== params.palette) {
      this.lut = Uint32Array.from({ length: LUT_SIZE }, (_, i) => packRgb(paletteColor(params.palette, i / LUT_SIZE)));
      this.lutKey = params.palette;
    }
    return this.lut;
  }

  onParamChange(p, params, key) {
    if (key === 'julia') this.resetView(params);
    this.invalidate();
  }

  // ---------- interaction (art view only) ----------

  zoomAt(p, x, y, factor, { gesture = false, recenter = false } = {}) {
    const unit = this.unit(p.width, p.height);
    const wx = this.centerX + (x - p.width / 2) * unit;
    const wy = this.centerY + (y - p.height / 2) * unit;
    this.zoom = Math.min(MAX_ZOOM, Math.max(0.25, this.zoom * factor));
    if (recenter) {
      this.centerX = wx;
      this.centerY = wy;
    } else {
      // Keep the point under the cursor in place.
      const unit2 = this.unit(p.width, p.height);
      this.centerX = wx - (x - p.width / 2) * unit2;
      this.centerY = wy - (y - p.height / 2) * unit2;
    }
    this.invalidate(gesture);
  }

  panBy(p, dx, dy) {
    const unit = this.unit(p.width, p.height);
    this.centerX -= dx * unit;
    this.centerY -= dy * unit;
    this.invalidate(true);
  }

  attachUI(p) {
    const canvas = p.canvas;
    const controller = new AbortController();
    const on = (type, fn, opts) => canvas.addEventListener(type, fn, { signal: controller.signal, ...opts });
    const pointers = new Map();
    let press = null; // { x, y, t, button, moved } while a single pointer is down
    let lastTap = 0;
    const local = (e) => {
      const r = canvas.getBoundingClientRect();
      return [e.clientX - r.left, e.clientY - r.top];
    };

    on('pointerdown', (e) => {
      canvas.setPointerCapture?.(e.pointerId);
      const [x, y] = local(e);
      pointers.set(e.pointerId, { x, y });
      press = pointers.size === 1 ? { x, y, t: performance.now(), button: e.button, moved: false } : null;
    });
    on('pointermove', (e) => {
      const pt = pointers.get(e.pointerId);
      if (!pt) return;
      const [x, y] = local(e);
      if (pointers.size === 1) {
        if (press && !press.moved && Math.hypot(x - press.x, y - press.y) > 4) press.moved = true;
        if (!press || press.moved) this.panBy(p, x - pt.x, y - pt.y);
      } else if (pointers.size === 2) {
        // Pinch: follow the midpoint and scale by the change in finger distance.
        const other = [...pointers.values()].find((q) => q !== pt);
        const before = Math.hypot(pt.x - other.x, pt.y - other.y);
        const after = Math.hypot(x - other.x, y - other.y);
        const mx = (x + other.x) / 2;
        const my = (y + other.y) / 2;
        this.panBy(p, mx - (pt.x + other.x) / 2, my - (pt.y + other.y) / 2);
        if (before > 0) this.zoomAt(p, mx, my, after / before, { gesture: true });
      }
      pt.x = x;
      pt.y = y;
    });
    const end = (e) => {
      if (!pointers.delete(e.pointerId)) return;
      const tap = e.type === 'pointerup' && press && !press.moved && performance.now() - press.t < 500;
      if (tap) {
        const [x, y] = local(e);
        const now = performance.now();
        if (e.pointerType === 'mouse') {
          // Click zooms in on the point, right-click zooms out.
          this.zoomAt(p, x, y, press.button === 2 ? 0.4 : 2.5, { recenter: true });
        } else if (now - lastTap < 320) {
          this.zoomAt(p, x, y, 2.5, { recenter: true }); // double-tap
          lastTap = 0;
        } else {
          lastTap = now;
        }
      }
      if (pointers.size === 0 || tap) press = null;
    };
    on('pointerup', end);
    on('pointercancel', end);
    on('wheel', (e) => {
      e.preventDefault();
      const [x, y] = local(e);
      const delta = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaY;
      this.zoomAt(p, x, y, Math.exp(-delta * 0.0015), { gesture: true });
    }, { passive: false });
    on('contextmenu', (e) => e.preventDefault());

    const overlay = document.createElement('div');
    overlay.className = 'zoom-controls';
    overlay.innerHTML = `
      <span class="zoom-controls__level"></span>
      <button class="icon-btn" type="button" data-zoom="in" aria-label="Zoom in" title="Zoom in">${icon('plus')}</button>
      <button class="icon-btn" type="button" data-zoom="out" aria-label="Zoom out" title="Zoom out">${icon('minus')}</button>
      <button class="icon-btn" type="button" data-zoom="home" aria-label="Reset view" title="Reset view">${icon('target')}</button>`;
    overlay.addEventListener('click', (e) => {
      const action = e.target.closest('[data-zoom]')?.dataset.zoom;
      if (action === 'in') this.zoomAt(p, p.width / 2, p.height / 2, 2.5);
      else if (action === 'out') this.zoomAt(p, p.width / 2, p.height / 2, 0.4);
      else if (action === 'home') this.reset(p, this.params);
    });
    (canvas.closest('.art-stage') || canvas.parentElement).appendChild(overlay);

    this.ui = {
      level: overlay.querySelector('.zoom-controls__level'),
      remove: () => {
        controller.abort();
        overlay.remove();
      },
    };
  }

  destroy() {
    this.ui?.remove();
    this.ui = null;
    if (this.preview) {
      this.preview.canvas.width = 0;
      this.preview.canvas.height = 0;
      this.preview = null;
    }
  }
}

function formatZoom(zoom) {
  if (zoom < 10) return `×${zoom.toFixed(1)}`;
  if (zoom < 10_000) return `×${Math.round(zoom)}`;
  return `×${zoom.toExponential(1).replace('e+', 'e')}`;
}

function paletteColor(palette, t) {
  let r, g, b;
  switch (palette) {
    case 'fire':
      r = t * 3 * 255;
      g = (t - 0.33) * 3 * 255;
      b = (t - 0.66) * 3 * 255;
      break;
    case 'ocean':
      r = 9 * (1 - t) * t * t * t * 255;
      g = 15 * (1 - t) * (1 - t) * t * t * 255;
      b = 8.5 * (1 - t) * (1 - t) * (1 - t) * t * 255 + t * 150;
      break;
    case 'grayscale':
      r = g = b = t * 255;
      break;
    case 'electric':
    default:
      r = (0.5 + 0.5 * Math.cos(Math.PI * 2 * t)) * 255;
      g = (0.5 + 0.5 * Math.cos(Math.PI * 2 * (t + 0.33))) * 255;
      b = (0.5 + 0.5 * Math.cos(Math.PI * 2 * (t + 0.67))) * 255;
  }
  return [clamp255(r), clamp255(g), clamp255(b)];
}
