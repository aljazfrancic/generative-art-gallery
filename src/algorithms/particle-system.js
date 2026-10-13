import { ArtAlgorithm } from './base.js';
import { hexToRgb, hsvToRgb, rgbCss } from '../lib/color.js';

const MAX = 2000;
const HUES = 24; // particles are filled in batches of similar colour and age
const AGES = 6;

export class ParticleSystem extends ArtAlgorithm {
  static meta = {
    name: 'Particle System',
    description:
      'Particles burst from the center under gravity and drag, shifting color as they age. Sweep the pointer through them to scatter them.',
    slug: 'particle-system',
    tags: ['particles', 'physics'],
  };

  x = new Float32Array(MAX);
  y = new Float32Array(MAX);
  vx = new Float32Array(MAX);
  vy = new Float32Array(MAX);
  life = new Float32Array(MAX);
  maxLife = new Float32Array(MAX);
  hue = new Float32Array(MAX);
  count = 0;
  hueOffset = 0;
  batches = Array.from({ length: HUES * AGES }, () => []);
  styles = null;
  stylesMode = '';

  getControls() {
    return [
      { type: 'slider', key: 'maxParticles', label: 'Max Particles', min: 50, max: 2000, step: 50, default: 500 },
      { type: 'slider', key: 'spawnRate', label: 'Spawn Rate', min: 1, max: 20, step: 1, default: 5 },
      { type: 'slider', key: 'gravity', label: 'Gravity', min: -0.2, max: 0.5, step: 0.01, default: 0.05 },
      { type: 'slider', key: 'initialSpeed', label: 'Launch Speed', min: 1, max: 12, step: 0.5, default: 5 },
      { type: 'slider', key: 'size', label: 'Particle Size', min: 1, max: 10, step: 0.5, default: 3 },
      { type: 'slider', key: 'lifetime', label: 'Lifetime', min: 30, max: 300, step: 10, default: 150 },
      { type: 'slider', key: 'trailFade', label: 'Trail Fade', min: 2, max: 40, step: 1, default: 12 },
      {
        type: 'select',
        key: 'colorMode',
        label: 'Color Mode',
        default: 'rainbow',
        options: [
          { value: 'rainbow', label: 'Rainbow Cycle' },
          { value: 'fire', label: 'Fire' },
          { value: 'ice', label: 'Ice' },
          { value: 'neon', label: 'Neon' },
        ],
      },
      { type: 'color', key: 'bgColor', label: 'Background', default: '#0a0a0a' },
    ];
  }

  setup(p, params) {
    this.count = 0;
    this.hueOffset = 0;
    p.background(params.bgColor);
  }

  reset(p, params) {
    this.setup(p, params);
  }

  /** HSB colour (h 0–360, s and b 0–100) for a particle of the given hue and age (0–1). */
  colorOf(mode, hue, progress) {
    switch (mode) {
      case 'fire':
        return [30 - progress * 30, 100, 100 - progress * 40];
      case 'ice':
        return [200 + progress * 40, 60, 100 - progress * 30];
      case 'neon':
        return [hue, 100, 100];
      case 'rainbow':
      default:
        return [hue, 80, 100 - progress * 30];
    }
  }

  /** One fill style per (hue, age) batch; alpha fades out with age. */
  stylesFor(mode) {
    if (this.stylesMode !== mode) {
      this.styles = [];
      for (let h = 0; h < HUES; h++) {
        for (let a = 0; a < AGES; a++) {
          const progress = (a + 0.5) / AGES;
          const [hh, s, b] = this.colorOf(mode, ((h + 0.5) / HUES) * 360, progress);
          this.styles.push(rgbCss(hsvToRgb(hh, s / 100, b / 100), (1 - progress) * 0.8));
        }
      }
      this.stylesMode = mode;
    }
    return this.styles;
  }

  draw(p, params) {
    const ctx = p.drawingContext;
    const w = p.width;
    const h = p.height;
    const { x, y, vx, vy, life, maxLife, hue } = this;
    ctx.fillStyle = rgbCss(hexToRgb(params.bgColor), params.trailFade / 100);
    ctx.fillRect(0, 0, w, h);

    const max = Math.min(params.maxParticles, MAX);
    for (let i = 0; i < params.spawnRate && this.count < max; i++) {
      const n = this.count++;
      const angle = Math.random() * Math.PI * 2;
      const speed = (0.5 + Math.random()) * params.initialSpeed;
      x[n] = w / 2;
      y[n] = h / 2;
      vx[n] = Math.cos(angle) * speed;
      vy[n] = Math.sin(angle) * speed;
      life[n] = 0;
      maxLife[n] = params.lifetime * (0.5 + Math.random() * 0.5);
      hue[n] = (this.hueOffset + Math.random() * 60) % 360;
    }

    // Move, push away from the pointer, and drop dead particles (swap with the last one).
    const ptr = this.pointer;
    const reach = Math.min(w, h) * 0.2;
    for (let i = this.count - 1; i >= 0; i--) {
      if (++life[i] > maxLife[i]) {
        const last = --this.count;
        x[i] = x[last]; y[i] = y[last]; vx[i] = vx[last]; vy[i] = vy[last];
        life[i] = life[last]; maxLife[i] = maxLife[last]; hue[i] = hue[last];
        continue;
      }
      vx[i] *= 0.99;
      vy[i] = vy[i] * 0.99 + params.gravity;
      if (ptr) {
        const dx = x[i] - ptr.x;
        const dy = y[i] - ptr.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < reach * reach && d2 > 1) {
          const d = Math.sqrt(d2);
          const force = (1 - d / reach) * 1.6;
          vx[i] += (dx / d) * force;
          vy[i] += (dy / d) * force;
        }
      }
      x[i] += vx[i];
      y[i] += vy[i];
    }

    // Group by colour and age, then fill each group as one path.
    const neutralHue = params.colorMode === 'fire' || params.colorMode === 'ice';
    for (let i = 0; i < this.count; i++) {
      const progress = life[i] / maxLife[i];
      const a = Math.min(AGES - 1, (progress * AGES) | 0);
      const hb = neutralHue ? 0 : Math.min(HUES - 1, ((hue[i] / 360) * HUES) | 0);
      this.batches[hb * AGES + a].push(i);
    }
    const styles = this.stylesFor(params.colorMode);
    for (let k = 0; k < this.batches.length; k++) {
      const batch = this.batches[k];
      if (batch.length === 0) continue;
      ctx.fillStyle = styles[k];
      ctx.beginPath();
      for (const i of batch) {
        const r = (params.size * (1 - (life[i] / maxLife[i]) * 0.5)) / 2;
        ctx.moveTo(x[i] + r, y[i]);
        ctx.arc(x[i], y[i], r, 0, Math.PI * 2);
      }
      ctx.fill();
      batch.length = 0;
    }

    this.hueOffset = (this.hueOffset + 0.5) % 360;
  }
}
