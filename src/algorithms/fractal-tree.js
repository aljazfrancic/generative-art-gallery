import { ArtAlgorithm } from './base.js';
import { hexToRgb, mixRgb, rgbCss } from '../lib/color.js';

const GROW_MS = 2600;
const MAX_DEPTH = 12;

/** Stable pseudo-random value in [0, 1) for a branch, so leaves don't flicker between frames. */
function hash01(n) {
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

export class FractalTree extends ArtAlgorithm {
  static meta = {
    name: 'Fractal Tree',
    description: 'A recursive tree grows branch by branch, then sways in a gentle procedural wind.',
    slug: 'fractal-tree',
    tags: ['fractal', 'recursive'],
  };

  time = 0;
  grown = 0; // 0 → 1 while the tree grows in
  fit = { key: '', scale: 1 };
  // Branch segments per depth level (x1, y1, x2, y2) and leaves (x, y, r), refilled every frame.
  segs = Array.from({ length: MAX_DEPTH }, (_, level) => new Float32Array(4 << level));
  segCount = new Int32Array(MAX_DEPTH);
  leaves = new Float32Array(3 * (3 << (MAX_DEPTH - 2)));
  leafCount = 0;

  getControls() {
    return [
      { type: 'slider', key: 'angle', label: 'Branch Angle', min: 10, max: 60, step: 1, default: 25 },
      { type: 'slider', key: 'depth', label: 'Depth', min: 4, max: MAX_DEPTH, step: 1, default: 9 },
      { type: 'slider', key: 'trunkLen', label: 'Trunk Length', min: 50, max: 200, step: 5, default: 120 },
      { type: 'slider', key: 'shrink', label: 'Shrink Ratio', min: 0.55, max: 0.8, step: 0.01, default: 0.67 },
      { type: 'slider', key: 'windStrength', label: 'Wind', min: 0, max: 30, step: 1, default: 10 },
      { type: 'slider', key: 'thickness', label: 'Thickness', min: 1, max: 10, step: 0.5, default: 4 },
      { type: 'color', key: 'trunkColor', label: 'Trunk', default: '#8b6914' },
      { type: 'color', key: 'leafColor', label: 'Leaves', default: '#22c55e' },
      { type: 'color', key: 'bgColor', label: 'Background', default: '#0a0a0a' },
    ];
  }

  setup(p, params) {
    this.time = 0;
    this.grown = 0;
    p.background(params.bgColor);
  }

  reset(p, params) {
    this.setup(p, params);
  }

  /**
   * Walks the tree, filling segs/leaves. `levels` is how many levels have grown in (fractional
   * while growing); `wind` 0 gives the resting pose used to fit the tree to the canvas.
   */
  walk(params, len, levels, wind) {
    const depth = params.depth;
    const spread = (params.angle * Math.PI) / 180;
    const shrink = params.shrink;
    this.segCount.fill(0);
    this.leafCount = 0;

    const branch = (x, y, dir, length, level, index) => {
      const grownIn = levels - level;
      if (level >= depth || grownIn <= 0) return;
      const l = length * Math.min(1, grownIn);
      const x2 = x + Math.sin(dir) * l;
      const y2 = y - Math.cos(dir) * l;
      const seg = this.segs[level];
      const n = this.segCount[level]++ * 4;
      seg[n] = x; seg[n + 1] = y; seg[n + 2] = x2; seg[n + 3] = y2;
      if (grownIn < 1) return;
      if (depth - level <= 2) {
        const k = this.leafCount++ * 3;
        this.leaves[k] = x2;
        this.leaves[k + 1] = y2;
        this.leaves[k + 2] = 3 + hash01(index) * 2;
      }
      const sway = wind ? Math.sin(this.time + index * 0.5) * wind * ((level + 1) / depth) * 0.02 : 0;
      branch(x2, y2, dir + spread + sway, length * shrink, level + 1, index * 2 + 1);
      branch(x2, y2, dir - spread + sway, length * shrink, level + 1, index * 2 + 2);
    };
    branch(0, 0, 0, len, 0, 0);
  }

  /**
   * Scale that keeps the whole tree (at rest, fully grown) inside the canvas. Gallery previews
   * also zoom in, so the tree fills its card.
   */
  fitScale(p, params, len) {
    const key = `${p.width}x${p.height}|${params.depth}|${params.angle}|${params.shrink}|${len}`;
    if (this.fit.key !== key) {
      this.walk(params, len, params.depth, 0);
      let halfWidth = 1;
      let height = 1;
      for (let level = 0; level < params.depth; level++) {
        const seg = this.segs[level];
        for (let i = 0; i < this.segCount[level] * 4; i += 4) {
          halfWidth = Math.max(halfWidth, Math.abs(seg[i + 2]) + 5);
          height = Math.max(height, -seg[i + 3] + 5);
        }
      }
      // A little headroom for the wind.
      const scale = Math.min(this.interactive ? 1 : 3, (p.width * 0.45) / halfWidth, (p.height * 0.9) / height);
      this.fit = { key, scale };
    }
    return this.fit.scale;
  }

  draw(p, params) {
    const ctx = p.drawingContext;
    const { depth, thickness } = params;
    ctx.fillStyle = params.bgColor;
    ctx.fillRect(0, 0, p.width, p.height);

    this.time += (p.deltaTime / 1000) * 1.2;
    this.grown = Math.min(1, this.grown + p.deltaTime / GROW_MS);
    const ease = 1 - (1 - this.grown) ** 3;

    // Trunk length is given for an 800 px tall canvas; scale down further if the tree would overflow.
    const len = params.trunkLen * (p.height / 800);
    const scale = this.fitScale(p, params, len);
    this.walk(params, len, ease * depth, params.windStrength);

    ctx.save();
    ctx.translate(p.width / 2, p.height - 2);
    ctx.scale(scale, scale);
    ctx.lineCap = 'round';
    const trunk = hexToRgb(params.trunkColor);
    const leaf = hexToRgb(params.leafColor);
    const unit = p.height / 800;
    // Lines and leaves keep their size when the tree is shrunk to fit, and grow when it's zoomed.
    const shrunk = Math.min(1, scale);
    for (let level = 0; level < depth; level++) {
      const count = this.segCount[level];
      if (count === 0) break;
      const t = level / Math.max(1, depth - 1);
      ctx.strokeStyle = rgbCss(mixRgb(trunk, leaf, t * t));
      ctx.lineWidth = Math.max(0.6, thickness * unit * 0.74 ** level) / shrunk;
      ctx.beginPath();
      const seg = this.segs[level];
      for (let i = 0; i < count * 4; i += 4) {
        ctx.moveTo(seg[i], seg[i + 1]);
        ctx.lineTo(seg[i + 2], seg[i + 3]);
      }
      ctx.stroke();
    }
    if (this.leafCount > 0) {
      ctx.fillStyle = rgbCss(leaf, 150 / 255);
      ctx.beginPath();
      const leafScale = Math.max(0.5, unit) / shrunk;
      for (let i = 0; i < this.leafCount * 3; i += 3) {
        const r = this.leaves[i + 2] * leafScale;
        ctx.moveTo(this.leaves[i] + r, this.leaves[i + 1]);
        ctx.arc(this.leaves[i], this.leaves[i + 1], r, 0, Math.PI * 2);
      }
      ctx.fill();
    }
    ctx.restore();
  }
}
