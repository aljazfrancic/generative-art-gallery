import { ArtAlgorithm } from './base.js';
import { hsvToRgb, rgbCss } from '../lib/color.js';

const MAX_SEEDS = 100;
const NEAREST = 12; // clip by the closest neighbours first, so the far ones can be skipped

export class Voronoi extends ArtAlgorithm {
  static meta = {
    name: 'Voronoi Diagram',
    description:
      'Drifting seed points carve a wrapping plane into Voronoi cells, filled with flat color or shaded by distance to their seed.',
    slug: 'voronoi',
    tags: ['geometry'],
  };

  sx = new Float64Array(MAX_SEEDS);
  sy = new Float64Array(MAX_SEEDS);
  vx = new Float64Array(MAX_SEEDS);
  vy = new Float64Array(MAX_SEEDS);
  colors = [];
  count = 0;
  // Scratch space: candidate sites (every seed plus its 8 wrapped copies) and clipping buffers.
  cand = new Float64Array(MAX_SEEDS * 9 * 2);
  candD = new Float64Array(MAX_SEEDS * 9);
  used = new Uint8Array(MAX_SEEDS * 9);
  bufA = new Float64Array(4096);
  bufB = new Float64Array(4096);
  cells = []; // per seed: { pts: Float64Array, n, minX, minY, maxX, maxY }

  getControls() {
    return [
      { type: 'slider', key: 'pointCount', label: 'Point Count', min: 10, max: MAX_SEEDS, step: 5, default: 30 },
      {
        type: 'select',
        key: 'colorMode',
        label: 'Color Mode',
        default: 'random',
        options: [
          { value: 'random', label: 'Random' },
          { value: 'gradient', label: 'Gradient' },
          { value: 'monochrome', label: 'Monochrome' },
        ],
      },
      { type: 'slider', key: 'animationSpeed', label: 'Animation Speed', min: 0.1, max: 3, step: 0.1, default: 1 },
      { type: 'toggle', key: 'showSeeds', label: 'Show Seeds', default: true },
      { type: 'color', key: 'color1', label: 'Color 1', default: '#7c6aef' },
      { type: 'color', key: 'color2', label: 'Color 2', default: '#ef4444' },
    ];
  }

  setup(p) {
    this.count = 0;
    this.addSeeds(p, 0, MAX_SEEDS);
  }

  reset(p, params) {
    this.setup(p, params);
  }

  addSeeds(p, from, to) {
    for (let i = from; i < to; i++) {
      this.sx[i] = Math.random() * p.width;
      this.sy[i] = Math.random() * p.height;
      this.vx[i] = (Math.random() - 0.5) * 2;
      this.vy[i] = (Math.random() - 0.5) * 2;
      this.colors[i] = rgbCss(hsvToRgb(Math.random() * 360, 0.8, 0.9));
    }
  }

  /** Clips the convex polygon src (n vertices) to the half-plane x·nx + y·ny <= k; returns the new count. */
  clip(src, n, dst, nx, ny, k) {
    let m = 0;
    for (let a = 0; a < n; a++) {
      const ax = src[2 * a];
      const ay = src[2 * a + 1];
      const b = a + 1 === n ? 0 : a + 1;
      const bx = src[2 * b];
      const by = src[2 * b + 1];
      const da = ax * nx + ay * ny - k;
      const db = bx * nx + by * ny - k;
      if (da <= 0) {
        dst[m++] = ax;
        dst[m++] = ay;
      }
      if ((da <= 0) !== (db <= 0)) {
        const t = da / (da - db);
        dst[m++] = ax + (bx - ax) * t;
        dst[m++] = ay + (by - ay) * t;
      }
    }
    return m / 2;
  }

  /** The Voronoi cell of seed i on the torus: the w×h box around it, cut by bisectors with every other site. */
  computeCell(i, w, h) {
    const x = this.sx[i];
    const y = this.sy[i];
    const total = this.count * 9;
    const { cand, candD, used } = this;
    for (let j = 0; j < total; j++) {
      const dx = cand[2 * j] - x;
      const dy = cand[2 * j + 1] - y;
      candD[j] = j % this.count === i ? Infinity : dx * dx + dy * dy; // its own copies make the box
      used[j] = 0;
    }

    let src = this.bufA;
    let dst = this.bufB;
    src.set([x - w / 2, y - h / 2, x + w / 2, y - h / 2, x + w / 2, y + h / 2, x - w / 2, y + h / 2]);
    let n = 4;
    const cut = (j) => {
      const cx = cand[2 * j];
      const cy = cand[2 * j + 1];
      n = this.clip(src, n, dst, cx - x, cy - y, (cx * cx + cy * cy - x * x - y * y) / 2);
      [src, dst] = [dst, src];
      used[j] = 1;
    };

    // Nearest sites first: they shape most of the cell.
    for (let pass = 0; pass < NEAREST; pass++) {
      let best = -1;
      for (let j = 0; j < total; j++) if (!used[j] && candD[j] !== Infinity && (best < 0 || candD[j] < candD[best])) best = j;
      if (best < 0) break;
      cut(best);
    }
    // Any remaining site closer than twice the cell's radius may still cut it.
    let r2 = 0;
    for (let v = 0; v < n; v++) {
      const dx = src[2 * v] - x;
      const dy = src[2 * v + 1] - y;
      r2 = Math.max(r2, dx * dx + dy * dy);
    }
    for (let j = 0; j < total; j++) if (!used[j] && candD[j] < 4 * r2) cut(j);

    const cell = this.cells[i] || (this.cells[i] = { pts: new Float64Array(256), n: 0 });
    if (cell.pts.length < n * 2) cell.pts = new Float64Array(n * 4);
    cell.pts.set(src.subarray(0, n * 2));
    cell.n = n;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let v = 0; v < n; v++) {
      minX = Math.min(minX, src[2 * v]);
      maxX = Math.max(maxX, src[2 * v]);
      minY = Math.min(minY, src[2 * v + 1]);
      maxY = Math.max(maxY, src[2 * v + 1]);
    }
    Object.assign(cell, { minX, minY, maxX, maxY });
  }

  draw(p, params) {
    const ctx = p.drawingContext;
    const w = p.width;
    const h = p.height;
    const { colorMode, showSeeds, color1, color2 } = params;

    const target = Math.min(params.pointCount, MAX_SEEDS);
    this.count = target;

    // Drift (wrapping around the edges).
    for (let i = 0; i < target; i++) {
      this.sx[i] = (((this.sx[i] + this.vx[i] * params.animationSpeed) % w) + w) % w;
      this.sy[i] = (((this.sy[i] + this.vy[i] * params.animationSpeed) % h) + h) % h;
    }

    for (let o = 0, j = 0; o < 9; o++) {
      const ox = ((o % 3) - 1) * w;
      const oy = (Math.floor(o / 3) - 1) * h;
      for (let i = 0; i < target; i++, j++) {
        this.cand[2 * j] = this.sx[i] + ox;
        this.cand[2 * j + 1] = this.sy[i] + oy;
      }
    }
    for (let i = 0; i < target; i++) this.computeCell(i, w, h);

    // Distance shading reaches its second colour at about a typical cell radius.
    const reach = Math.sqrt((w * h) / (Math.PI * target)) * 1.6;
    ctx.lineWidth = 1;
    ctx.lineJoin = 'round';
    for (let i = 0; i < target; i++) {
      const cell = this.cells[i];
      // Cells that cross an edge are drawn again on the far side.
      for (let oy = -h; oy <= h; oy += h) {
        if (cell.maxY + oy < 0 || cell.minY + oy > h) continue;
        for (let ox = -w; ox <= w; ox += w) {
          if (cell.maxX + ox < 0 || cell.minX + ox > w) continue;
          let style;
          if (colorMode === 'random') {
            style = this.colors[i];
          } else {
            const g = ctx.createRadialGradient(this.sx[i] + ox, this.sy[i] + oy, 0, this.sx[i] + ox, this.sy[i] + oy, reach);
            g.addColorStop(0, color1);
            g.addColorStop(1, colorMode === 'gradient' ? color2 : '#000000');
            style = g;
          }
          ctx.beginPath();
          ctx.moveTo(cell.pts[0] + ox, cell.pts[1] + oy);
          for (let v = 1; v < cell.n; v++) ctx.lineTo(cell.pts[2 * v] + ox, cell.pts[2 * v + 1] + oy);
          ctx.closePath();
          ctx.fillStyle = style;
          ctx.fill();
          // Same colour on the outline hides hairline seams between neighbouring cells.
          ctx.strokeStyle = style;
          ctx.stroke();
        }
      }
    }

    if (showSeeds) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.beginPath();
      for (let i = 0; i < target; i++) {
        ctx.moveTo(this.sx[i] + 2, this.sy[i]);
        ctx.arc(this.sx[i], this.sy[i], 2, 0, Math.PI * 2);
      }
      ctx.fill();
    }
  }
}
