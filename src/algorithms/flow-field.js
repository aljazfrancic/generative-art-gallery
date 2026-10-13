import { ArtAlgorithm } from './base.js';
import { hexToRgb, mixRgb, rgbCss } from '../lib/color.js';

const MAX_PARTICLES = 5000;
const CELL = 20; // flow-field grid spacing in px
const BATCHES = 12; // particles are stroked in this many colour batches instead of one by one

export class FlowField extends ArtAlgorithm {
  static meta = {
    name: 'Flow Field',
    description:
      'Particles trace paths through a Perlin noise vector field, leaving luminous trails that reveal hidden currents.',
    slug: 'flow-field',
    tags: ['noise', 'particles'],
  };

  // Particle state in flat typed arrays: no per-particle objects to allocate or collect.
  x = new Float32Array(MAX_PARTICLES);
  y = new Float32Array(MAX_PARTICLES);
  age = new Uint16Array(MAX_PARTICLES);
  life = new Uint16Array(MAX_PARTICLES);
  cols = 0;
  rows = 0;
  fieldCos = null;
  fieldSin = null;
  zOff = 0;
  frame = 0;

  getControls() {
    return [
      { type: 'slider', key: 'particleCount', label: 'Particles', min: 200, max: 5000, step: 100, default: 2000 },
      { type: 'slider', key: 'noiseScale', label: 'Noise Scale', min: 0.002, max: 0.02, step: 0.001, default: 0.006 },
      { type: 'slider', key: 'speed', label: 'Speed', min: 0.5, max: 6, step: 0.25, default: 2 },
      { type: 'slider', key: 'trailFade', label: 'Trail Fade', min: 1, max: 50, step: 1, default: 8 },
      { type: 'slider', key: 'noiseEvolution', label: 'Evolution', min: 0, max: 0.01, step: 0.0005, default: 0.002 },
      { type: 'color', key: 'color1', label: 'Color A', default: '#7c6aef' },
      { type: 'color', key: 'color2', label: 'Color B', default: '#ef4444' },
      { type: 'color', key: 'bgColor', label: 'Background', default: '#0a0a0a' },
    ];
  }

  setup(p, params) {
    this.cols = Math.ceil(p.width / CELL) + 1;
    this.rows = Math.ceil(p.height / CELL) + 1;
    this.fieldCos = new Float32Array(this.cols * this.rows);
    this.fieldSin = new Float32Array(this.cols * this.rows);
    // A random slice of noise space gives every run its own currents.
    this.zOff = Math.random() * 1000;
    for (let i = 0; i < MAX_PARTICLES; i++) this.spawn(p, i, true);
    p.background(params.bgColor);
  }

  reset(p, params) {
    this.setup(p, params);
  }

  // Particles live a limited time, so they don't all end up stuck in the field's sinks.
  spawn(p, i, randomAge) {
    this.x[i] = Math.random() * p.width;
    this.y[i] = Math.random() * p.height;
    this.life[i] = 80 + Math.floor(Math.random() * 320);
    this.age[i] = randomAge ? Math.floor(Math.random() * this.life[i]) : 0;
  }

  draw(p, params) {
    const ctx = p.drawingContext;
    const w = p.width;
    const h = p.height;
    // Fading by a few percent every frame stalls short of the background (8-bit rounding) and
    // leaves grey ghost trails. Fading every few frames by an equivalent larger step doesn't.
    const perFrame = params.trailFade / 255;
    const every = Math.min(4, Math.max(1, Math.ceil(Math.log(1 - 0.08) / Math.log(1 - perFrame))));
    if (++this.frame % every === 0) {
      ctx.fillStyle = rgbCss(hexToRgb(params.bgColor), 1 - (1 - perFrame) ** every);
      ctx.fillRect(0, 0, w, h);
    }

    const ns = params.noiseScale * 100;
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const angle = p.noise(c * ns, r * ns, this.zOff) * Math.PI * 4;
        const i = r * this.cols + c;
        this.fieldCos[i] = Math.cos(angle);
        this.fieldSin[i] = Math.sin(angle);
      }
    }
    this.zOff += params.noiseEvolution;

    const count = Math.min(params.particleCount, MAX_PARTICLES);
    const c1 = hexToRgb(params.color1);
    const c2 = hexToRgb(params.color2);
    const { speed } = params;
    const { x, y, age, life, fieldCos, fieldSin, cols } = this;
    ctx.lineWidth = 1;
    for (let b = 0; b < BATCHES; b++) {
      ctx.strokeStyle = rgbCss(mixRgb(c1, c2, (b + 0.5) / BATCHES), 60 / 255);
      ctx.beginPath();
      const end = Math.floor(((b + 1) * count) / BATCHES);
      for (let i = Math.floor((b * count) / BATCHES); i < end; i++) {
        const px = x[i];
        const py = y[i];
        const cell = ((py / CELL) | 0) * cols + ((px / CELL) | 0);
        const nx = px + fieldCos[cell] * speed;
        const ny = py + fieldSin[cell] * speed;
        if (nx < 0 || nx >= w || ny < 0 || ny >= h || ++age[i] > life[i]) {
          this.spawn(p, i, false);
          continue;
        }
        ctx.moveTo(px, py);
        ctx.lineTo(nx, ny);
        x[i] = nx;
        y[i] = ny;
      }
      ctx.stroke();
    }
  }
}
