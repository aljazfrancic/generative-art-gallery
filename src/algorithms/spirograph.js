import { ArtAlgorithm } from './base.js';
import { hexToRgb, hsvToRgb, rgbCss } from '../lib/color.js';

const DT = 0.02; // curve parameter advanced per point

function gcd(a, b) {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a || 1;
}

export class Spirograph extends ArtAlgorithm {
  static meta = {
    name: 'Spirograph',
    description: 'A pen traces a hypotrochoid until the figure closes, then a fresh drawing begins.',
    slug: 'spirograph',
    tags: ['math', 'curves'],
    finite: true,
  };

  t = 0;
  period = 0;
  prev = null;

  getControls() {
    return [
      { type: 'slider', key: 'outerRadius', label: 'Outer Radius (R)', min: 50, max: 200, step: 1, default: 120 },
      { type: 'slider', key: 'innerRadius', label: 'Inner Radius (r)', min: 10, max: 100, step: 1, default: 45 },
      { type: 'slider', key: 'penDistance', label: 'Pen Distance (d)', min: 10, max: 120, step: 1, default: 80 },
      { type: 'color', key: 'strokeColor', label: 'Stroke Color', default: '#7c6aef' },
      { type: 'toggle', key: 'rainbow', label: 'Rainbow', default: false },
      { type: 'slider', key: 'strokeWeight', label: 'Stroke Weight', min: 0.5, max: 4, step: 0.1, default: 1.5 },
      { type: 'slider', key: 'speed', label: 'Speed (points/frame)', min: 1, max: 20, step: 1, default: 8 },
      { type: 'slider', key: 'trailFade', label: 'Trail Fade', min: 0, max: 20, step: 1, default: 0 },
      { type: 'color', key: 'bgColor', label: 'Background', default: '#0a0a0a' },
    ];
  }

  setup(p, params) {
    this.t = 0;
    this.prev = null;
    // With whole-number radii the curve closes after r / gcd(R, r) turns of the inner wheel.
    const R = Math.round(params.outerRadius);
    const r = Math.max(1, Math.round(params.innerRadius));
    this.period = 2 * Math.PI * (r / gcd(R, r));
    p.background(params.bgColor);
  }

  reset(p, params) {
    this.setup(p, params);
  }

  isComplete() {
    return this.t >= this.period;
  }

  draw(p, params) {
    const ctx = p.drawingContext;
    if (params.trailFade > 0) {
      ctx.fillStyle = rgbCss(hexToRgb(params.bgColor), params.trailFade / 255);
      ctx.fillRect(0, 0, p.width, p.height);
    }
    if (this.isComplete()) return;

    const { outerRadius: R, innerRadius: r, penDistance: d } = params;
    const k = (R - r) / r;
    // Scale the figure to fill the canvas, whatever its size.
    const extent = Math.max(1, Math.abs(R - r) + d);
    const scale = (Math.min(p.width, p.height) * 0.46) / extent;
    const cx = p.width / 2;
    const cy = p.height / 2;
    const point = (t) => [
      cx + ((R - r) * Math.cos(t) + d * Math.cos(k * t)) * scale,
      cy + ((R - r) * Math.sin(t) - d * Math.sin(k * t)) * scale,
    ];

    ctx.lineWidth = params.strokeWeight;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (!this.prev) this.prev = point(this.t);
    if (!params.rainbow) {
      ctx.strokeStyle = params.strokeColor;
      ctx.beginPath();
      ctx.moveTo(this.prev[0], this.prev[1]);
    }

    for (let i = 0; i < params.speed && !this.isComplete(); i++) {
      this.t = Math.min(this.t + DT, this.period);
      const next = point(this.t);
      if (params.rainbow) {
        ctx.strokeStyle = rgbCss(hsvToRgb((this.t / this.period) * 360, 0.75, 0.95));
        ctx.beginPath();
        ctx.moveTo(this.prev[0], this.prev[1]);
        ctx.lineTo(next[0], next[1]);
        ctx.stroke();
      } else {
        ctx.lineTo(next[0], next[1]);
      }
      this.prev = next;
    }
    if (!params.rainbow) ctx.stroke();
  }

  onParamChange(p, params, key) {
    // A different wheel or pen draws a different figure, so start it from the beginning.
    if (key === 'outerRadius' || key === 'innerRadius' || key === 'penDistance' || key === 'bgColor') {
      this.setup(p, params);
    }
  }

  /** Gallery previews draw a different figure each time round. */
  variation() {
    for (let attempt = 0; attempt < 50; attempt++) {
      const R = 90 + Math.floor(Math.random() * 111);
      const r = 20 + Math.floor(Math.random() * 76);
      const turns = r / gcd(R, r);
      if (R !== r && turns >= 3 && turns <= 9) {
        return { outerRadius: R, innerRadius: r, penDistance: 25 + Math.floor(Math.random() * 90) };
      }
    }
    return {};
  }
}
