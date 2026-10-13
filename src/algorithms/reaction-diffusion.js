import { ArtAlgorithm } from './base.js';
import { hexToRgb, mixRgb, packRgb } from '../lib/color.js';
import { lowEnd } from '../perf.js';

// Colour ramps from the background up through these stops as the concentration of B rises.
const PALETTES = {
  chemical: ['#0d9488', '#22d3ee', '#e879f9'],
  heat: ['#b91c1c', '#f97316', '#fef3c7'],
  ocean: ['#1d4ed8', '#22d3ee', '#ecfeff'],
};
const MAX_MS = 60_000; // start over after a minute even if the pattern is still changing

export class ReactionDiffusion extends ArtAlgorithm {
  static meta = {
    name: 'Reaction-Diffusion',
    description:
      'Gray-Scott model: two chemicals react and diffuse into coral-like patterns. Drag across the canvas to seed new growth.',
    slug: 'reaction-diffusion',
    tags: ['simulation', 'organic'],
    finite: true,
  };

  // The grid is padded by one cell on every side; the padding mirrors the opposite edge (wrapping).
  w = 0;
  h = 0;
  scale = 2;
  a = null;
  b = null;
  a2 = null;
  b2 = null;
  view = null;
  lut = null;
  lutKey = '';
  elapsed = 0;
  checks = 0;
  stable = 0;
  snapshot = null;
  done = false;

  getControls() {
    return [
      { type: 'slider', key: 'feedRate', label: 'Feed Rate', min: 0.01, max: 0.08, step: 0.001, default: 0.055 },
      { type: 'slider', key: 'killRate', label: 'Kill Rate', min: 0.03, max: 0.07, step: 0.001, default: 0.062 },
      { type: 'slider', key: 'diffusionA', label: 'Diffusion A', min: 0.5, max: 1.2, step: 0.05, default: 1.0 },
      { type: 'slider', key: 'diffusionB', label: 'Diffusion B', min: 0.1, max: 0.8, step: 0.05, default: 0.5 },
      { type: 'slider', key: 'speed', label: 'Speed (iterations/frame)', min: 1, max: 20, step: 1, default: 10 },
      {
        type: 'select',
        key: 'palette',
        label: 'Palette',
        default: 'chemical',
        options: [
          { value: 'chemical', label: 'Chemical' },
          { value: 'heat', label: 'Heat' },
          { value: 'ocean', label: 'Ocean' },
        ],
      },
      { type: 'color', key: 'bgColor', label: 'Background', default: '#0a0a0a' },
    ];
  }

  setup(p, params) {
    // Simulate on a coarse grid (a cell per few pixels) and let the GPU scale it up smoothly.
    const budget = lowEnd ? 30_000 : 60_000; // cells; one iteration costs ~1 ms per 70k on a laptop
    this.scale = Math.max(2, Math.ceil(Math.sqrt((p.width * p.height) / budget)));
    this.w = Math.ceil(p.width / this.scale);
    this.h = Math.ceil(p.height / this.scale);
    const size = (this.w + 2) * (this.h + 2);
    this.a = new Float32Array(size).fill(1);
    this.b = new Float32Array(size);
    this.a2 = new Float32Array(size);
    this.b2 = new Float32Array(size);

    const seeds = 6 + Math.floor(Math.random() * 7);
    for (let s = 0; s < seeds; s++) {
      this.seed(Math.random() * this.w, Math.random() * this.h, 2 + Math.random() * 3);
    }

    this.destroy();
    const canvas = document.createElement('canvas');
    canvas.width = this.w;
    canvas.height = this.h;
    const ctx = canvas.getContext('2d');
    const image = ctx.createImageData(this.w, this.h);
    this.view = { canvas, ctx, image, pixels: new Uint32Array(image.data.buffer) };

    this.elapsed = 0;
    this.checks = 0;
    this.stable = 0;
    this.snapshot = null;
    this.done = false;
    p.background(params.bgColor);
  }

  reset(p, params) {
    this.setup(p, params);
  }

  isComplete() {
    return this.done;
  }

  /** Drops chemical B into a disc (grid coordinates). */
  seed(cx, cy, radius) {
    const W = this.w + 2;
    for (let y = Math.max(0, Math.floor(cy - radius)); y <= Math.min(this.h - 1, cy + radius); y++) {
      for (let x = Math.max(0, Math.floor(cx - radius)); x <= Math.min(this.w - 1, cx + radius); x++) {
        if ((x - cx) ** 2 + (y - cy) ** 2 <= radius * radius) {
          const i = (y + 1) * W + x + 1;
          this.b[i] = 1;
          this.a[i] = 0.5;
        }
      }
    }
  }

  wrap(g) {
    const W = this.w + 2;
    const H = this.h + 2;
    for (let x = 1; x <= this.w; x++) {
      g[x] = g[this.h * W + x];
      g[(H - 1) * W + x] = g[W + x];
    }
    for (let y = 0; y < H; y++) {
      g[y * W] = g[y * W + this.w];
      g[y * W + W - 1] = g[y * W + 1];
    }
  }

  /** One explicit-Euler step with Karl Sims' normalised 3×3 Laplacian (stable for D <= 1.25). */
  iterate(f, k, dA, dB) {
    this.wrap(this.a);
    this.wrap(this.b);
    const { a, b, a2, b2 } = this;
    const W = this.w + 2;
    for (let y = 1; y <= this.h; y++) {
      let i = y * W + 1;
      for (let x = 1; x <= this.w; x++, i++) {
        const av = a[i];
        const bv = b[i];
        const lapA = -av + 0.2 * (a[i - 1] + a[i + 1] + a[i - W] + a[i + W]) +
          0.05 * (a[i - W - 1] + a[i - W + 1] + a[i + W - 1] + a[i + W + 1]);
        const lapB = -bv + 0.2 * (b[i - 1] + b[i + 1] + b[i - W] + b[i + W]) +
          0.05 * (b[i - W - 1] + b[i - W + 1] + b[i + W - 1] + b[i + W + 1]);
        const abb = av * bv * bv;
        const na = av + dA * lapA - abb + f * (1 - av);
        const nb = bv + dB * lapB + abb - (k + f) * bv;
        a2[i] = na < 0 ? 0 : na > 1 ? 1 : na;
        b2[i] = nb < 0 ? 0 : nb > 1 ? 1 : nb;
      }
    }
    this.a = a2;
    this.b = b2;
    this.a2 = a;
    this.b2 = b;
  }

  palette(params) {
    const key = `${params.palette}${params.bgColor}`;
    if (this.lutKey !== key) {
      const stops = [params.bgColor, ...(PALETTES[params.palette] || PALETTES.chemical)].map(hexToRgb);
      const segments = stops.length - 1;
      this.lut = Uint32Array.from({ length: 256 }, (_, i) => {
        const t = (i / 255) * segments;
        const s = Math.min(segments - 1, Math.floor(t));
        return packRgb(mixRgb(stops[s], stops[s + 1], t - s));
      });
      this.lutKey = key;
    }
    return this.lut;
  }

  draw(p, params) {
    if (this.pointer?.down) {
      this.seed(this.pointer.x / this.scale, this.pointer.y / this.scale, 3);
      this.done = false;
      this.stable = 0;
    }

    if (!this.done) {
      // Iterations are capped by time, so slow devices evolve slower instead of freezing.
      const budget = this.interactive ? 10 : 5;
      const start = performance.now();
      for (let i = 0; i < params.speed; i++) {
        this.iterate(params.feedRate, params.killRate, params.diffusionA, params.diffusionB);
        if (performance.now() - start > budget) break;
      }
      this.elapsed += p.deltaTime;
      if (++this.checks % 30 === 0) this.checkProgress();
    }

    const lut = this.palette(params);
    const { pixels, image, ctx, canvas } = this.view;
    const W = this.w + 2;
    const b = this.b;
    for (let y = 0, k = 0; y < this.h; y++) {
      let i = (y + 1) * W + 1;
      for (let x = 0; x < this.w; x++, i++, k++) {
        const v = (b[i] * 765) | 0; // B rarely exceeds ~0.35, so stretch it over the ramp
        pixels[k] = lut[v > 255 ? 255 : v];
      }
    }
    ctx.putImageData(image, 0, 0);
    const main = p.drawingContext;
    main.imageSmoothingEnabled = true;
    main.drawImage(canvas, 0, 0, this.w * this.scale, this.h * this.scale);
  }

  /** Finished once the pattern has stopped changing, died out, or run for a minute. */
  checkProgress() {
    const b = this.b;
    const stride = 7;
    const samples = Math.floor(b.length / stride);
    if (!this.snapshot || this.snapshot.length !== samples) this.snapshot = new Float32Array(samples);
    let change = 0;
    let peak = 0;
    for (let s = 0; s < samples; s++) {
      const v = b[s * stride];
      change += Math.abs(v - this.snapshot[s]);
      if (v > peak) peak = v;
      this.snapshot[s] = v;
    }
    this.stable = change / samples < 2e-4 ? this.stable + 1 : 0;
    if (this.stable >= 4 || peak < 0.02 || this.elapsed > MAX_MS) this.done = true;
  }

  destroy() {
    if (this.view) {
      this.view.canvas.width = 0;
      this.view.canvas.height = 0;
      this.view = null;
    }
  }
}
