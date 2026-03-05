import { ArtAlgorithm } from './base.js';

export class ReactionDiffusion extends ArtAlgorithm {
  static meta = {
    name: 'Reaction-Diffusion',
    description: 'Gray-Scott model: two chemicals A and B interact on a grid to form organic, evolving patterns.',
    slug: 'reaction-diffusion',
    tags: ['simulation', 'organic'],
  };

  w = 0;
  h = 0;
  gridA = null;
  gridB = null;
  nextA = null;
  nextB = null;

  getControls() {
    return [
      { type: 'slider', key: 'feedRate', label: 'Feed Rate', min: 0.01, max: 0.08, step: 0.001, default: 0.055 },
      { type: 'slider', key: 'killRate', label: 'Kill Rate', min: 0.03, max: 0.07, step: 0.001, default: 0.062 },
      { type: 'slider', key: 'diffusionA', label: 'Diffusion A', min: 0.5, max: 1.5, step: 0.1, default: 1.0 },
      { type: 'slider', key: 'diffusionB', label: 'Diffusion B', min: 0.1, max: 0.8, step: 0.05, default: 0.5 },
      { type: 'slider', key: 'speed', label: 'Speed (iter/frame)', min: 1, max: 20, step: 1, default: 10 },
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
    ];
  }

  setup(p, params) {
    // Half resolution for performance
    this.w = Math.floor(p.width / 2);
    this.h = Math.floor(p.height / 2);

    this.gridA = new Float32Array(this.w * this.h);
    this.gridB = new Float32Array(this.w * this.h);
    this.nextA = new Float32Array(this.w * this.h);
    this.nextB = new Float32Array(this.w * this.h);

    this.initializeGrids();
    p.pixelDensity(1);
  }

  initializeGrids() {
    for (let i = 0; i < this.w * this.h; i++) {
      this.gridA[i] = 1;
      this.gridB[i] = 0;
    }

    // Seed a few random rectangles of B=1
    const numSeeds = 3 + Math.floor(Math.random() * 5);
    for (let s = 0; s < numSeeds; s++) {
      const rx = Math.floor(Math.random() * (this.w - 20));
      const ry = Math.floor(Math.random() * (this.h - 20));
      const rw = 5 + Math.floor(Math.random() * 15);
      const rh = 5 + Math.floor(Math.random() * 15);

      for (let dy = 0; dy < rh; dy++) {
        for (let dx = 0; dx < rw; dx++) {
          const x = (rx + dx + this.w) % this.w;
          const y = (ry + dy + this.h) % this.h;
          this.gridB[y * this.w + x] = 1;
        }
      }
    }
  }

  laplacianA(x, y) {
    const w = this.w;
    const h = this.h;
    const g = this.gridA;

    let sum = -4 * g[y * w + x];
    sum += g[((y - 1 + h) % h) * w + x];
    sum += g[((y + 1) % h) * w + x];
    sum += g[y * w + ((x - 1 + w) % w)];
    sum += g[y * w + ((x + 1) % w)];

    return sum;
  }

  laplacianB(x, y) {
    const w = this.w;
    const h = this.h;
    const g = this.gridB;

    let sum = -4 * g[y * w + x];
    sum += g[((y - 1 + h) % h) * w + x];
    sum += g[((y + 1) % h) * w + x];
    sum += g[y * w + ((x - 1 + w) % w)];
    sum += g[y * w + ((x + 1) % w)];

    return sum;
  }

  step(f, k, dA, dB) {
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const idx = y * this.w + x;
        const a = this.gridA[idx];
        const b = this.gridB[idx];

        const lapA = this.laplacianA(x, y);
        const lapB = this.laplacianB(x, y);

        const reaction = a * b * b;
        const newA = a + (dA * lapA - reaction + f * (1 - a));
        const newB = b + (dB * lapB + reaction - (k + f) * b);

        this.nextA[idx] = Math.max(0, Math.min(1, newA));
        this.nextB[idx] = Math.max(0, Math.min(1, newB));
      }
    }

    const tmpA = this.gridA;
    const tmpB = this.gridB;
    this.gridA = this.nextA;
    this.gridB = this.nextB;
    this.nextA = tmpA;
    this.nextB = tmpB;
  }

  colorForB(b, palette) {
    if (palette === 'chemical') {
      // Cyan-magenta style
      const t = Math.min(1, b * 2);
      return { r: Math.floor(255 * (1 - t)), g: Math.floor(128 + 127 * t), b: Math.floor(255 * t) };
    } else if (palette === 'heat') {
      let cr, cg, cb;
      if (b < 0.25) {
        const t = b * 4;
        cr = Math.floor(255 * t);
        cg = 0;
        cb = 0;
      } else if (b < 0.5) {
        const t = (b - 0.25) * 4;
        cr = 255;
        cg = Math.floor(255 * t);
        cb = 0;
      } else if (b < 0.75) {
        const t = (b - 0.5) * 4;
        cr = 255;
        cg = 255;
        cb = Math.floor(255 * t);
      } else {
        cr = 255;
        cg = 255;
        cb = 255;
      }
      return { r: cr, g: cg, b: cb };
    } else {
      // ocean: deep blue -> cyan -> white
      const t = Math.min(1, b * 1.5);
      return {
        r: Math.floor(50 * (1 - t) + 255 * t),
        g: Math.floor(100 * (1 - t) + 255 * t),
        b: Math.floor(200 * (1 - t) + 255 * t),
      };
    }
  }

  draw(p, params) {
    const { feedRate, killRate, diffusionA, diffusionB, speed, palette } = params;

    if (!this.gridA || this.gridA.length === 0) {
      this.setup(p, params);
    }

    for (let i = 0; i < speed; i++) {
      this.step(feedRate, killRate, diffusionA, diffusionB);
    }

    p.loadPixels();

    for (let py = 0; py < p.height; py++) {
      for (let px = 0; px < p.width; px++) {
        const gx = Math.floor(px / 2);
        const gy = Math.floor(py / 2);
        const b = this.gridB[gy * this.w + gx];

        const { r, g, b: bb } = this.colorForB(b, palette);

        const idx = 4 * (py * p.width + px);
        p.pixels[idx] = r;
        p.pixels[idx + 1] = g;
        p.pixels[idx + 2] = bb;
        p.pixels[idx + 3] = 255;
      }
    }

    p.updatePixels();
  }

  reset(p, params) {
    p.clear();
    this.setup(p, params); // Reallocates grids and reinitializes with fresh random seeds
  }
}
