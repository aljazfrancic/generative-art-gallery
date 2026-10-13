import { ArtAlgorithm } from './base.js';
import { hexToRgb, mixRgb, packRgb } from '../lib/color.js';
import { GrayScottGL } from '../lib/gray-scott-gl.js';
import { lowEnd } from '../perf.js';

// Colour ramps from the background up through these stops as the concentration of B rises.
const PALETTES = {
  chemical: ['#0d9488', '#22d3ee', '#e879f9'],
  heat: ['#b91c1c', '#f97316', '#fef3c7'],
  ocean: ['#1d4ed8', '#22d3ee', '#ecfeff'],
};
const MAX_MS = 60_000; // start over after a minute even if the pattern is still changing
const PREVIEW_MS = 7_500; // gallery previews loop within 10 s: this long to grow, then the hold
const CHECK_FRAMES = 30;
const FROZEN = 7e-7; // mean change of B per iteration below which the pattern has stopped
const BRUSH_PX = 10; // radius of the drops left by dragging

// Phones and tablets: their GPUs are usually far weaker than a laptop's.
const touch = matchMedia('(pointer: coarse)').matches;

// How finely each engine simulates (cells for the canvas; the grid is scaled up to fit) and how
// many iterations it runs per 60 fps frame for each step of the Speed control. On the GPU,
// gallery cards get about a cell per CSS pixel and run faster, so they fill in before they loop.
const GPU = {
  cells: lowEnd ? 100_000 : touch ? 150_000 : 300_000,
  previewCells: lowEnd ? 40_000 : touch ? 60_000 : 150_000,
  minScale: 1,
  rate: 2,
  previewRate: 2,
};
const CPU = {
  cells: lowEnd ? 30_000 : 60_000, // one iteration costs ~1 ms per 70k cells on a laptop
  previewCells: lowEnd ? 30_000 : 60_000,
  minScale: 2,
};
const PREVIEW_SEED_SPACING = { gpu: 90, cpu: 45 }; // CSS px between seeds on gallery cards

/** The simulation on the CPU, where WebGL2 with float render targets isn't available. */
class CpuGrayScott {
  // The grid is padded by one cell on every side; the padding mirrors the opposite edge (wrapping).
  w = 0;
  h = 0;
  iterations = 0;
  #snapshot = null;
  #snapshotAt = 0;

  load(w, h, data) {
    const W = w + 2;
    if (w !== this.w || h !== this.h) {
      const size = W * (h + 2);
      this.a = new Float32Array(size);
      this.b = new Float32Array(size);
      this.a2 = new Float32Array(size);
      this.b2 = new Float32Array(size);
      this.destroy();
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      const image = ctx.createImageData(w, h);
      this.view = { canvas, ctx, image, pixels: new Uint32Array(image.data.buffer) };
      this.w = w;
      this.h = h;
    }
    for (let y = 0; y < h; y++) {
      for (let x = 0, i = (y + 1) * W + 1, j = y * w * 2; x < w; x++, i++, j += 2) {
        this.a[i] = data[j];
        this.b[i] = data[j + 1];
      }
    }
    this.#snapshot = null;
  }

  /** Runs up to `count` iterations, fewer if they take longer than `budgetMs`. */
  iterate(count, f, k, dA, dB, seed, budgetMs) {
    if (seed) this.#seed(seed.x, seed.y, seed.r);
    const start = performance.now();
    let i = 0;
    while (i < count) {
      this.#step(f, k, dA, dB);
      i++;
      if (performance.now() - start > budgetMs) break;
    }
    this.iterations += i;
  }

  #seed(cx, cy, radius) {
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

  #wrap(g) {
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
  #step(f, k, dA, dB) {
    this.#wrap(this.a);
    this.#wrap(this.b);
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

  /** { peak, change }: the highest B and its mean change per iteration since the last call. */
  sample() {
    const b = this.b;
    const stride = 7;
    const samples = Math.floor(b.length / stride);
    const first = !this.#snapshot || this.#snapshot.length !== samples;
    if (first) this.#snapshot = new Float32Array(samples);
    const snapshot = this.#snapshot;
    let change = 0;
    let peak = 0;
    for (let s = 0; s < samples; s++) {
      const v = b[s * stride];
      change += Math.abs(v - snapshot[s]);
      if (v > peak) peak = v;
      snapshot[s] = v;
    }
    const iterations = this.iterations - this.#snapshotAt;
    this.#snapshotAt = this.iterations;
    return { peak, change: first || iterations <= 0 ? null : change / samples / iterations };
  }

  /** Colours the grid and lets the canvas scale it up smoothly. */
  draw(ctx, scale, lut) {
    const { pixels, image, ctx: own, canvas } = this.view;
    const W = this.w + 2;
    const b = this.b;
    for (let y = 0, k = 0; y < this.h; y++) {
      let i = (y + 1) * W + 1;
      for (let x = 0; x < this.w; x++, i++, k++) {
        const v = (b[i] * 765) | 0; // B rarely exceeds ~0.35, so stretch it over the ramp
        pixels[k] = lut[v > 255 ? 255 : v];
      }
    }
    own.putImageData(image, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(canvas, 0, 0, this.w * scale, this.h * scale);
  }

  destroy() {
    if (this.view) {
      this.view.canvas.width = 0;
      this.view.canvas.height = 0;
      this.view = null;
    }
  }
}

export class ReactionDiffusion extends ArtAlgorithm {
  static meta = {
    name: 'Reaction-Diffusion',
    description:
      'Gray-Scott model: two chemicals react and diffuse into coral-like patterns. Drag across the canvas to seed new growth.',
    slug: 'reaction-diffusion',
    tags: ['simulation', 'organic'],
    finite: true,
  };

  engine = null;
  gpu = false;
  w = 0;
  h = 0;
  scale = 2;
  lut = null;
  lutKey = '';
  shown = ''; // palette of the frame on the canvas, or '' when it needs drawing
  elapsed = 0;
  frames = 0;
  stable = 0;
  settled = 0;
  fastest = 0;
  done = false;
  throttle = 1; // see pace()
  frameMs = 1000 / 60;

  getControls() {
    return [
      { type: 'slider', key: 'feedRate', label: 'Feed Rate', min: 0.01, max: 0.08, step: 0.001, default: 0.055 },
      { type: 'slider', key: 'killRate', label: 'Kill Rate', min: 0.03, max: 0.07, step: 0.001, default: 0.062 },
      { type: 'slider', key: 'diffusionA', label: 'Diffusion A', min: 0.5, max: 1.2, step: 0.05, default: 1.0 },
      { type: 'slider', key: 'diffusionB', label: 'Diffusion B', min: 0.1, max: 0.8, step: 0.05, default: 0.5 },
      { type: 'slider', key: 'speed', label: 'Speed', min: 1, max: 20, step: 1, default: 10 },
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
    if (!this.engine || this.engine.lost) {
      // Once per piece: the GPU if it can, else the CPU (also after the GPU context was lost).
      const lost = this.engine?.lost;
      this.engine?.destroy();
      this.engine = (!lost && GrayScottGL.create()) || new CpuGrayScott();
      this.gpu = this.engine instanceof GrayScottGL;
    }
    const preview = !this.interactive;
    const sizing = this.gpu ? GPU : CPU;
    const cells = preview ? sizing.previewCells : sizing.cells;
    this.scale = Math.max(sizing.minScale, Math.sqrt((p.width * p.height) / cells));
    this.w = Math.max(1, Math.ceil(p.width / this.scale));
    this.h = Math.max(1, Math.ceil(p.height / this.scale));
    this.engine.load(this.w, this.h, this.initialState(preview));

    this.elapsed = 0;
    this.frames = 0;
    this.stable = 0;
    this.settled = 0;
    this.fastest = 0;
    this.done = false;
    this.shown = '';
    p.background(params.bgColor);
  }

  reset(p, params) {
    this.setup(p, params);
  }

  isComplete() {
    return this.done;
  }

  /** A and B for every cell (interleaved, row by row): all A, with a few drops of B. */
  initialState(preview) {
    const { w, h } = this;
    const data = new Float32Array(w * h * 2);
    for (let i = 0; i < data.length; i += 2) data[i] = 1;
    const drop = (cx, cy, radius) => {
      for (let y = Math.max(0, Math.floor(cy - radius)); y <= Math.min(h - 1, cy + radius); y++) {
        for (let x = Math.max(0, Math.floor(cx - radius)); x <= Math.min(w - 1, cx + radius); x++) {
          if ((x - cx) ** 2 + (y - cy) ** 2 <= radius * radius) {
            data[(y * w + x) * 2] = 0.5;
            data[(y * w + x) * 2 + 1] = 1;
          }
        }
      }
    };
    if (preview) {
      // Spread out evenly on gallery cards, so the pattern has filled the card when it loops.
      const spacing = PREVIEW_SEED_SPACING[this.gpu ? 'gpu' : 'cpu'] / this.scale;
      const cols = Math.max(1, Math.round(w / spacing));
      const rows = Math.max(1, Math.round(h / spacing));
      for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
          const x = ((i + 0.5 + (Math.random() - 0.5) * 0.8) * w) / cols;
          const y = ((j + 0.5 + (Math.random() - 0.5) * 0.8) * h) / rows;
          drop(x, y, 2 + Math.random() * 3);
        }
      }
    } else {
      const seeds = 6 + Math.floor(Math.random() * 7);
      for (let s = 0; s < seeds; s++) drop(Math.random() * w, Math.random() * h, 2 + Math.random() * 3);
    }
    return data;
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
    if (this.engine.lost) {
      this.setup(p, params); // carries on on the CPU
      return;
    }
    const preview = !this.interactive;
    let seed = null;
    if (this.pointer?.down) {
      seed = { x: this.pointer.x / this.scale, y: this.pointer.y / this.scale, r: Math.max(2, BRUSH_PX / this.scale) };
      this.done = false;
      this.stable = 0;
      this.settled = 0;
    }

    if (!this.done) {
      const { feedRate, killRate, diffusionA, diffusionB, speed } = params;
      if (this.gpu) {
        let count = speed * (preview ? GPU.previewRate : GPU.rate);
        // Cards draw at 30 fps or less, so their iterations follow the clock to fill in on time.
        if (preview) count *= Math.min(2, p.deltaTime / (1000 / 60));
        else count *= this.pace(p.deltaTime);
        this.engine.iterate(Math.max(1, Math.round(count)), feedRate, killRate, diffusionA, diffusionB, seed);
      } else {
        // Capped by time, so slow devices evolve slower instead of freezing.
        this.engine.iterate(speed, feedRate, killRate, diffusionA, diffusionB, seed, preview ? 5 : 10);
      }
      this.elapsed += p.deltaTime;
      if (++this.frames % CHECK_FRAMES === 0) {
        const stats = this.engine.sample();
        if (stats) this.judge(stats);
      }
      if (this.elapsed > (preview ? PREVIEW_MS : MAX_MS)) this.done = true;
      this.shown = '';
    }

    // A finished piece is only drawn again when its colours change.
    const lut = this.palette(params);
    if (this.shown === this.lutKey) return;
    const main = p.drawingContext;
    if (this.gpu) {
      main.drawImage(this.engine.render(p.canvas.width, p.canvas.height, lut, this.lutKey), 0, 0, p.width, p.height);
    } else {
      this.engine.draw(main, this.scale, lut);
    }
    this.shown = this.lutKey;
  }

  /**
   * Share of the full view's iterations to run. GPUs differ a lot, so while frames come slower
   * than ~45 fps, fewer iterations run per frame until the frame rate recovers.
   */
  pace(dt) {
    this.frameMs += (dt - this.frameMs) * 0.1;
    if (this.frameMs > 22) this.throttle = Math.max(0.25, this.throttle * 0.98);
    else if (this.frameMs < 18) this.throttle = Math.min(1, this.throttle * 1.02);
    return this.throttle;
  }

  /** Finished once the pattern has died out or stopped changing; previews once growth has slowed. */
  judge({ peak, change }) {
    if (change !== null) {
      this.fastest = Math.max(this.fastest, change);
      this.stable = change < FROZEN ? this.stable + 1 : 0;
      this.settled = change < this.fastest * 0.15 ? this.settled + 1 : 0;
    }
    if (peak < 0.02 || this.stable >= 4 || (!this.interactive && this.settled >= 2)) this.done = true;
  }

  destroy() {
    this.engine?.destroy();
    this.engine = null;
  }
}
