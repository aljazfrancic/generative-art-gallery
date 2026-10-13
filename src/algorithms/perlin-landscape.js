import { ArtAlgorithm } from './base.js';
import { hexToRgb, mixRgb, rgbCss } from '../lib/color.js';

const SHADES = 8; // edges are stroked in batches: height shade × fog level
const FOG_LEVELS = 8;

export class PerlinLandscape extends ArtAlgorithm {
  static meta = {
    name: 'Perlin Landscape',
    description:
      'Fly over endless Perlin-noise terrain, drawn as a perspective wireframe that fades into the horizon.',
    slug: 'perlin-landscape',
    tags: ['noise', '3d'],
  };

  travel = 0; // rows flown so far
  rows = []; // projected rows, nearest first: { c0, n, z, sx, sy, hv }
  styles = null;
  stylesKey = '';
  batches = Array.from({ length: SHADES }, () => []);

  getControls() {
    return [
      { type: 'slider', key: 'noiseScale', label: 'Noise Scale', min: 0.05, max: 0.3, step: 0.01, default: 0.1 },
      { type: 'slider', key: 'amplitude', label: 'Amplitude', min: 50, max: 300, step: 10, default: 150 },
      { type: 'slider', key: 'scrollSpeed', label: 'Flight Speed', min: 0.5, max: 5, step: 0.5, default: 2 },
      { type: 'slider', key: 'gridSize', label: 'Grid Size', min: 10, max: 40, step: 2, default: 20 },
      { type: 'color', key: 'colorLow', label: 'Color Low', default: '#1a5276' },
      { type: 'color', key: 'colorHigh', label: 'Color High', default: '#e74c3c' },
      { type: 'toggle', key: 'wireframe', label: 'Wireframe', default: true },
      { type: 'color', key: 'bgColor', label: 'Background', default: '#0a0a0f' },
    ];
  }

  setup(p, params) {
    this.travel = 0;
    p.background(params.bgColor);
  }

  reset(p, params) {
    this.setup(p, params);
  }

  /** Edge colours by height shade and distance, fading into the background with fog. */
  stylesFor(params) {
    const key = `${params.colorLow}${params.colorHigh}${params.bgColor}`;
    if (this.stylesKey !== key) {
      const low = hexToRgb(params.colorLow);
      const high = hexToRgb(params.colorHigh);
      const bg = hexToRgb(params.bgColor);
      this.styles = [];
      for (let f = 0; f < FOG_LEVELS; f++) {
        const fog = ((f + 0.5) / FOG_LEVELS) ** 1.3 * 0.94;
        for (let s = 0; s < SHADES; s++) {
          this.styles.push(rgbCss(mixRgb(mixRgb(low, high, (s + 0.5) / SHADES), bg, fog)));
        }
      }
      this.stylesKey = key;
    }
    return this.styles;
  }

  draw(p, params) {
    const ctx = p.drawingContext;
    const w = p.width;
    const h = p.height;
    const { noiseScale: ns, amplitude, scrollSpeed, gridSize, wireframe } = params;

    // Camera: the nearest row meets the bottom edge, the farthest sits just below the horizon.
    const horizon = h * 0.34;
    const focal = h * 1.15;
    const zNear = focal * 0.5;
    const camHeight = (h - horizon) * (zNear / focal);
    const depth = focal * 5.5;
    const rowCount = Math.round(Math.min(120, Math.max(24, (1500 / gridSize) * Math.sqrt(h / 800))));
    const spacing = depth / rowCount;
    const amp = (amplitude / 150) * camHeight * 0.55;

    this.travel += scrollSpeed * 2 * (p.deltaTime / 1000);
    const base = Math.floor(this.travel);
    const frac = this.travel - base;

    ctx.fillStyle = params.bgColor;
    ctx.fillRect(0, 0, w, h);
    const high = hexToRgb(params.colorHigh);
    const glow = ctx.createLinearGradient(0, horizon - h * 0.22, 0, horizon + h * 0.1);
    glow.addColorStop(0, rgbCss(high, 0));
    glow.addColorStop(0.8, rgbCss(high, 0.14));
    glow.addColorStop(1, rgbCss(high, 0));
    ctx.fillStyle = glow;
    ctx.fillRect(0, horizon - h * 0.22, w, h * 0.32);

    // Project the visible stretch of every row. The terrain is fixed in the world; the camera moves.
    for (let k = 0; k <= rowCount; k++) {
      const z = zNear + (k - frac) * spacing;
      const s = focal / Math.max(z, 1);
      const half = Math.ceil(w / 2 / s / spacing) + 1;
      const n = half * 2 + 1;
      let row = this.rows[k];
      if (!row || row.sx.length < n) {
        row = this.rows[k] = { sx: new Float32Array(n + 16), sy: new Float32Array(n + 16), hv: new Float32Array(n + 16) };
      }
      row.c0 = -half;
      row.n = n;
      row.z = z;
      const nz = (base + k) * ns;
      for (let i = 0; i < n; i++) {
        const c = i - half;
        // Offset keeps the input positive: p5's noise() mirrors negative coordinates.
        const v = p.noise(c * ns + 1000, nz);
        row.sx[i] = w / 2 + c * spacing * s;
        row.sy[i] = horizon + (camHeight - (v - 0.5) * 2 * amp) * s;
        row.hv[i] = v;
      }
    }

    // Strips between neighbouring rows, far to near, so nearer hills hide what lies behind them.
    const styles = this.stylesFor(params);
    const shadeOf = (v) => Math.min(SHADES - 1, Math.max(0, Math.floor(((v - 0.25) / 0.5) * SHADES)));
    ctx.lineWidth = 1;
    for (let k = rowCount - 1; k >= 0; k--) {
      const near = this.rows[k];
      const far = this.rows[k + 1];
      // The columns both rows share (nearer rows are narrower), as indices into each row.
      const first = Math.max(near.c0, far.c0);
      const quads = Math.min(near.c0 + near.n, far.c0 + far.n) - 1 - first;
      if (quads < 1) continue;
      const a = first - near.c0;
      const b = first - far.c0;
      const fog = Math.min(FOG_LEVELS - 1, Math.max(0, Math.floor(((near.z - zNear) / depth) * FOG_LEVELS)));

      if (wireframe) {
        // Hidden lines: cover the strip with the background, then stroke its far and side edges
        // on top. Its near edge is the far edge of the next strip, so every edge is drawn once.
        ctx.fillStyle = params.bgColor;
        ctx.beginPath();
        ctx.moveTo(far.sx[b], far.sy[b]);
        for (let i = 1; i <= quads; i++) ctx.lineTo(far.sx[b + i], far.sy[b + i]);
        for (let i = quads; i >= 0; i--) ctx.lineTo(near.sx[a + i], near.sy[a + i]);
        ctx.fill();
        for (let i = 0; i <= quads; i++) {
          const f = b + i;
          const n = a + i;
          if (i < quads) {
            this.batches[shadeOf((far.hv[f] + far.hv[f + 1]) / 2)].push(far.sx[f], far.sy[f], far.sx[f + 1], far.sy[f + 1]);
            if (k === 0) {
              this.batches[shadeOf((near.hv[n] + near.hv[n + 1]) / 2)].push(near.sx[n], near.sy[n], near.sx[n + 1], near.sy[n + 1]);
            }
          }
          this.batches[shadeOf((far.hv[f] + near.hv[n]) / 2)].push(far.sx[f], far.sy[f], near.sx[n], near.sy[n]);
        }
        for (let shade = 0; shade < SHADES; shade++) {
          const segs = this.batches[shade];
          if (segs.length === 0) continue;
          ctx.strokeStyle = styles[fog * SHADES + shade];
          ctx.beginPath();
          for (let i = 0; i < segs.length; i += 4) {
            ctx.moveTo(segs[i], segs[i + 1]);
            ctx.lineTo(segs[i + 2], segs[i + 3]);
          }
          ctx.stroke();
          segs.length = 0;
        }
      } else {
        // Solid terrain: each quad in its height colour, outlined in the same colour to hide seams.
        for (let i = 0; i < quads; i++) {
          const f = b + i;
          const n = a + i;
          const shade = shadeOf((near.hv[n] + near.hv[n + 1] + far.hv[f] + far.hv[f + 1]) / 4);
          this.batches[shade].push(near.sx[n], near.sy[n], near.sx[n + 1], near.sy[n + 1], far.sx[f + 1], far.sy[f + 1], far.sx[f], far.sy[f]);
        }
        ctx.lineJoin = 'round';
        for (let shade = 0; shade < SHADES; shade++) {
          const q = this.batches[shade];
          if (q.length === 0) continue;
          ctx.fillStyle = ctx.strokeStyle = styles[fog * SHADES + shade];
          ctx.beginPath();
          for (let i = 0; i < q.length; i += 8) {
            ctx.moveTo(q[i], q[i + 1]);
            ctx.lineTo(q[i + 2], q[i + 3]);
            ctx.lineTo(q[i + 4], q[i + 5]);
            ctx.lineTo(q[i + 6], q[i + 7]);
            ctx.closePath();
          }
          ctx.fill();
          ctx.stroke();
          q.length = 0;
        }
      }
    }
  }
}
