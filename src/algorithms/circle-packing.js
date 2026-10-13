import { ArtAlgorithm } from './base.js';
import { hexToRgb, hsvToRgb, mixRgb, rgbCss } from '../lib/color.js';

// Placement stops once fewer than 0.4% of the recent attempts find room (or a cap is hit).
const WINDOW = 1500;
const MIN_SUCCESS_RATE = 0.004;
const MAX_CIRCLES = 6000;
const MAX_MS = 60_000;
// Gallery previews stop placing after 6 s, so with the gallery's hold they start over within 10 s.
const PREVIEW_MS = 6_000;

export class CirclePacking extends ArtAlgorithm {
  static meta = {
    name: 'Circle Packing',
    description:
      'Circles appear at random and grow until they touch a neighbor or the edge, packing the canvas before starting over.',
    slug: 'circle-packing',
    tags: ['geometry'],
    finite: true,
  };

  circles = []; // { x, y, r, style }
  growing = []; // circles still growing
  grid = null; // spatial hash: circle lists per cell, so overlap checks only look nearby
  recent = new Uint8Array(WINDOW);
  recentAt = 0;
  recentHits = 0;
  attempts = 0;
  placing = true;
  elapsed = 0;

  getControls() {
    return [
      { type: 'slider', key: 'maxRadius', label: 'Max Radius', min: 5, max: 80, step: 5, default: 40 },
      { type: 'slider', key: 'growSpeed', label: 'Grow Speed', min: 0.2, max: 3, step: 0.2, default: 1 },
      { type: 'slider', key: 'attemptsPerFrame', label: 'Attempts Per Frame', min: 1, max: 50, step: 1, default: 20 },
      { type: 'slider', key: 'minGap', label: 'Min Gap', min: 0, max: 5, step: 0.5, default: 1 },
      {
        type: 'select',
        key: 'colorMode',
        label: 'Color Mode',
        default: 'random',
        options: [
          { value: 'random', label: 'Random' },
          { value: 'palette', label: 'Palette' },
          { value: 'gradient', label: 'Gradient' },
        ],
      },
      { type: 'color', key: 'color1', label: 'Color 1', default: '#7c6aef' },
      { type: 'color', key: 'color2', label: 'Color 2', default: '#ef4444' },
      { type: 'color', key: 'bgColor', label: 'Background', default: '#0a0a0a' },
      { type: 'toggle', key: 'outlined', label: 'Outlined', default: false },
    ];
  }

  setup(p, params) {
    this.circles = [];
    this.growing = [];
    const size = 2 * params.maxRadius + params.minGap + 1;
    const cols = Math.ceil(p.width / size);
    const rows = Math.ceil(p.height / size);
    this.grid = { size, cols, rows, cells: Array.from({ length: cols * rows }, () => []) };
    this.recent.fill(0);
    this.recentAt = 0;
    this.recentHits = 0;
    this.attempts = 0;
    this.placing = true;
    this.elapsed = 0;
    p.background(params.bgColor);
  }

  reset(p, params) {
    this.setup(p, params);
  }

  isComplete() {
    return !this.placing && this.growing.length === 0;
  }

  colorFor(p, params, x, y) {
    const { colorMode } = params;
    if (colorMode === 'random') return rgbCss(hsvToRgb(Math.random() * 360, 0.7, 0.9));
    const c1 = hexToRgb(params.color1);
    const c2 = hexToRgb(params.color2);
    if (colorMode === 'palette') {
      return rgbCss(mixRgb(c1, c2, Math.min(1, Math.max(0, (x / p.width + y / p.height) / 2))));
    }
    const cx = p.width / 2;
    const cy = p.height / 2;
    return rgbCss(mixRgb(c1, c2, Math.min(1, Math.hypot(x - cx, y - cy) / Math.hypot(cx, cy))));
  }

  /** True if a circle at (x, y) with radius r would come closer than `gap` to any other circle. */
  overlaps(x, y, r, gap, self) {
    const { size, cols, rows, cells } = this.grid;
    const gx = Math.floor(x / size);
    const gy = Math.floor(y / size);
    for (let cy = Math.max(0, gy - 1); cy <= Math.min(rows - 1, gy + 1); cy++) {
      for (let cx = Math.max(0, gx - 1); cx <= Math.min(cols - 1, gx + 1); cx++) {
        for (const c of cells[cy * cols + cx]) {
          if (c === self) continue;
          const limit = r + c.r + gap;
          const dx = x - c.x;
          const dy = y - c.y;
          if (dx * dx + dy * dy < limit * limit) return true;
        }
      }
    }
    return false;
  }

  outside(p, x, y, r, gap) {
    return x - r - gap < 0 || x + r + gap > p.width || y - r - gap < 0 || y + r + gap > p.height;
  }

  /** The largest radius circle `c` could have without coming closer than `gap` to anything. */
  room(p, c, gap) {
    let room = Math.min(c.x, c.y, p.width - c.x, p.height - c.y) - gap;
    const { size, cols, rows, cells } = this.grid;
    const gx = Math.floor(c.x / size);
    const gy = Math.floor(c.y / size);
    for (let cy = Math.max(0, gy - 1); cy <= Math.min(rows - 1, gy + 1); cy++) {
      for (let cx = Math.max(0, gx - 1); cx <= Math.min(cols - 1, gx + 1); cx++) {
        for (const other of cells[cy * cols + cx]) {
          if (other !== c) room = Math.min(room, Math.hypot(c.x - other.x, c.y - other.y) - other.r - gap);
        }
      }
    }
    return room;
  }

  draw(p, params) {
    const { maxRadius, minGap } = params;
    this.elapsed += p.deltaTime;
    // Rates are per 60 fps frame (gallery cards draw at 30 fps or less).
    const pace = Math.min(2, p.deltaTime / (1000 / 60));
    const growSpeed = params.growSpeed * pace;

    if (this.placing) {
      const attempts = Math.max(1, Math.round(params.attemptsPerFrame * pace));
      for (let i = 0; i < attempts; i++) {
        const x = Math.random() * p.width;
        const y = Math.random() * p.height;
        const ok = !this.outside(p, x, y, 1, minGap) && !this.overlaps(x, y, 1, minGap, null);
        if (ok) {
          const c = { x, y, r: 1, style: this.colorFor(p, params, x, y) };
          this.circles.push(c);
          this.growing.push(c);
          const { size, cols } = this.grid;
          this.grid.cells[Math.floor(y / size) * cols + Math.floor(x / size)].push(c);
        }
        this.recentHits += (ok ? 1 : 0) - this.recent[this.recentAt];
        this.recent[this.recentAt] = ok ? 1 : 0;
        this.recentAt = (this.recentAt + 1) % WINDOW;
        this.attempts++;
      }
      const full = this.attempts >= WINDOW && this.recentHits / WINDOW < MIN_SUCCESS_RATE;
      const limit = this.interactive ? MAX_MS : PREVIEW_MS;
      if (full || this.circles.length >= MAX_CIRCLES || this.elapsed > limit) this.placing = false;
    }

    // Grow (right up to the nearest neighbour or edge), then draw only what changed: a bigger
    // circle simply covers its smaller self.
    const ctx = p.drawingContext;
    const stillGrowing = [];
    for (const c of this.growing) {
      const room = this.room(p, c, minGap);
      c.r = Math.max(c.r, Math.min(maxRadius, c.r + growSpeed, room));
      if (c.r < maxRadius && c.r < room) stillGrowing.push(c);
      this.drawCircle(ctx, params, c);
    }
    this.growing = stillGrowing;
  }

  drawCircle(ctx, params, c) {
    ctx.beginPath();
    if (params.outlined) {
      // Clear the previous, smaller ring first (only inside the new one: neighbours can be close).
      ctx.arc(c.x, c.y, Math.max(0, c.r - 0.5), 0, Math.PI * 2);
      ctx.fillStyle = params.bgColor;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(c.x, c.y, Math.max(0.5, c.r), 0, Math.PI * 2);
      ctx.lineWidth = 1;
      ctx.strokeStyle = c.style;
      ctx.stroke();
    } else {
      ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
      ctx.fillStyle = c.style;
      ctx.fill();
    }
  }

  redrawAll(p, params) {
    p.background(params.bgColor);
    for (const c of this.circles) this.drawCircle(p.drawingContext, params, c);
  }

  onParamChange(p, params, key) {
    // The spatial grid is sized for the radius and gap.
    if (key === 'maxRadius' || key === 'minGap') this.setup(p, params);
    else if (key === 'outlined' || key === 'bgColor') this.redrawAll(p, params);
  }
}
