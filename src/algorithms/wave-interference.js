import { ArtAlgorithm } from './base.js';
import { hexToRgb, mixRgb, packRgb } from '../lib/color.js';

// Sine lookup table: the field needs a sine per grid sample and source, every frame.
const SINE_SIZE = 4096;
const SINE_MASK = SINE_SIZE - 1;
const TO_INDEX = SINE_SIZE / (Math.PI * 2);
const SINE = Float32Array.from({ length: SINE_SIZE }, (_, i) => Math.sin(i / TO_INDEX));

export class WaveInterference extends ArtAlgorithm {
  static meta = {
    name: 'Wave Interference',
    description:
      'Circular waves from several sources overlap into shifting moiré interference patterns, with optional split color channels.',
    slug: 'wave-interference',
    tags: ['math', 'patterns'],
  };

  time = 0;
  sources = [];
  // The field is computed on a coarse grid (one sample per `resolution` px) and scaled up by the GPU.
  grid = null; // { cols, rows, step, canvas, ctx, image, pixels, dist: Float32Array[], acc: Float32Array[] }
  lut = null;
  lutKey = '';
  scaledFor = null; // frequency the sources' table indices were computed for

  getControls() {
    return [
      { type: 'slider', key: 'waveCount', label: 'Wave Sources', min: 2, max: 8, step: 1, default: 4 },
      { type: 'slider', key: 'frequency', label: 'Frequency', min: 0.01, max: 0.1, step: 0.005, default: 0.04 },
      { type: 'slider', key: 'amplitude', label: 'Amplitude', min: 0.2, max: 1.5, step: 0.05, default: 1 },
      { type: 'slider', key: 'speed', label: 'Speed', min: 0.005, max: 0.08, step: 0.005, default: 0.03 },
      { type: 'slider', key: 'resolution', label: 'Resolution (px)', min: 2, max: 8, step: 1, default: 4 },
      { type: 'toggle', key: 'colorChannels', label: 'Split RGB', default: true },
      { type: 'color', key: 'color1', label: 'Crest Color', default: '#7c6aef' },
      { type: 'color', key: 'color2', label: 'Trough Color', default: '#ef4444' },
      { type: 'color', key: 'bgColor', label: 'Background', default: '#000000' },
    ];
  }

  setup(p, params) {
    this.time = 0;
    this.build(p, params);
  }

  reset(p, params) {
    this.setup(p, params);
  }

  build(p, params) {
    const step = Math.max(1, Math.round(params.resolution));
    const cols = Math.ceil(p.width / step);
    const rows = Math.ceil(p.height / step);
    if (!this.grid || this.grid.cols !== cols || this.grid.rows !== rows) {
      this.destroy();
      const canvas = document.createElement('canvas');
      canvas.width = cols;
      canvas.height = rows;
      const ctx = canvas.getContext('2d');
      const image = ctx.createImageData(cols, rows);
      this.grid = { cols, rows, canvas, ctx, image, pixels: new Uint32Array(image.data.buffer) };
      this.grid.acc = [0, 1, 2].map(() => new Float32Array(cols * rows));
    }
    this.grid.step = step;

    // Sources sit on a ring around the centre; distances from every grid sample are fixed.
    const count = params.waveCount;
    const ring = Math.min(p.width, p.height) * 0.3;
    this.sources = [];
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const sx = p.width / 2 + Math.cos(angle) * ring;
      const sy = p.height / 2 + Math.sin(angle) * ring;
      const dist = new Float32Array(cols * rows);
      for (let gy = 0, k = 0; gy < rows; gy++) {
        const dy = gy * step - sy;
        for (let gx = 0; gx < cols; gx++, k++) {
          const dx = gx * step - sx;
          dist[k] = Math.sqrt(dx * dx + dy * dy);
        }
      }
      this.sources.push({ dist, index: new Float32Array(cols * rows), phase: (i / count) * Math.PI * 2 });
    }
    this.scaledFor = null;
  }

  /** Each sample's distance turned into a sine-table index (only when the frequency changes). */
  scaleSources(frequency) {
    if (this.scaledFor === frequency) return;
    const k = frequency * TO_INDEX;
    for (const { dist, index } of this.sources) {
      for (let i = 0; i < dist.length; i++) index[i] = dist[i] * k;
    }
    this.scaledFor = frequency;
  }

  /** 256 colours from trough (color2) through the background to crest (color1). */
  palette(params) {
    const key = `${params.color1}${params.color2}${params.bgColor}`;
    if (this.lutKey !== key) {
      const bg = hexToRgb(params.bgColor);
      const crest = hexToRgb(params.color1);
      const trough = hexToRgb(params.color2);
      const colors = [];
      for (let i = 0; i < 256; i++) {
        const v = (i / 255) * 2 - 1;
        colors.push(v >= 0 ? mixRgb(bg, crest, v) : mixRgb(bg, trough, -v));
      }
      this.lut = {
        packed: Uint32Array.from(colors, packRgb),
        r: Uint8Array.from(colors, (c) => c[0]),
        g: Uint8Array.from(colors, (c) => c[1]),
        b: Uint8Array.from(colors, (c) => c[2]),
      };
      this.lutKey = key;
    }
    return this.lut;
  }

  draw(p, params) {
    const { frequency, amplitude, colorChannels } = params;
    if (Math.max(1, Math.round(params.resolution)) !== this.grid.step || this.sources.length !== params.waveCount) {
      this.build(p, params);
    }
    const { cols, rows, step, canvas, ctx, image, pixels, acc } = this.grid;
    const cells = cols * rows;
    const channels = colorChannels ? 3 : 1;
    for (let c = 0; c < channels; c++) acc[c].fill(0);

    // Sum the waves, one source at a time (cache-friendly).
    this.scaleSources(frequency);
    for (let i = 0; i < this.sources.length; i++) {
      const { index, phase } = this.sources[i];
      const target = acc[colorChannels ? i % 3 : 0];
      const offset = (phase - this.time) * TO_INDEX;
      for (let k = 0; k < cells; k++) target[k] += SINE[((index[k] + offset) | 0) & SINE_MASK];
    }

    // Normalise each channel by the number of waves it sums (≈ their typical amplitude), then colour.
    const lut = this.palette(params);
    const gain = (n) => (amplitude * 127.5) / Math.sqrt(Math.max(1, n));
    const index = (v, g) => {
      const i = (127.5 + v * g) | 0;
      return i < 0 ? 0 : i > 255 ? 255 : i;
    };
    if (colorChannels) {
      const n = this.sources.length;
      const gr = gain(Math.ceil(n / 3));
      const gg = gain(Math.ceil((n - 1) / 3));
      const gb = gain(Math.ceil((n - 2) / 3));
      const [ar, ag, ab] = acc;
      for (let k = 0; k < cells; k++) {
        pixels[k] =
          ((255 << 24) | (lut.b[index(ab[k], gb)] << 16) | (lut.g[index(ag[k], gg)] << 8) | lut.r[index(ar[k], gr)]) >>> 0;
      }
    } else {
      const g = gain(this.sources.length);
      const a = acc[0];
      for (let k = 0; k < cells; k++) pixels[k] = lut.packed[index(a[k], g)];
    }
    ctx.putImageData(image, 0, 0);

    const main = p.drawingContext;
    main.imageSmoothingEnabled = true;
    main.drawImage(canvas, 0, 0, cols * step, rows * step);
    this.time = (this.time + params.speed) % (Math.PI * 2);
  }

  onParamChange(p, params, key) {
    if (key === 'waveCount' || key === 'resolution') this.build(p, params);
  }

  destroy() {
    if (this.grid) {
      this.grid.canvas.width = 0;
      this.grid.canvas.height = 0;
      this.grid = null;
    }
  }
}
