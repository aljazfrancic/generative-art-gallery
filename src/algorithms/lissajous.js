import { ArtAlgorithm } from './base.js';
import { hsvToRgb, rgbCss } from '../lib/color.js';

const DT = 0.01; // curve parameter advanced per point
const MAX_TRAIL = 2000;
const SEGMENTS = 24; // the trail is stroked in this many pieces, fading towards its tail

export class Lissajous extends ArtAlgorithm {
  static meta = {
    name: 'Lissajous Curves',
    description:
      'Parametric curves x = A·sin(a·t + δ), y = B·sin(b·t), traced with a fading trail while the phase slowly drifts.',
    slug: 'lissajous',
    tags: ['math', 'curves'],
  };

  // Trail as a ring buffer of points.
  xs = new Float32Array(MAX_TRAIL);
  ys = new Float32Array(MAX_TRAIL);
  head = 0;
  count = 0;
  t = 0;
  drift = 0;
  carry = 0; // fractional points carried over to the next frame

  getControls() {
    return [
      { type: 'slider', key: 'freqA', label: 'Frequency A', min: 1, max: 10, step: 1, default: 3 },
      { type: 'slider', key: 'freqB', label: 'Frequency B', min: 1, max: 10, step: 1, default: 2 },
      { type: 'slider', key: 'phase', label: 'Phase (δ)', min: 0, max: 6.28, step: 0.01, default: 1.57 },
      { type: 'slider', key: 'phaseDrift', label: 'Phase Drift (rad/s)', min: 0, max: 1, step: 0.05, default: 0.2 },
      { type: 'slider', key: 'trailLength', label: 'Trail Length', min: 50, max: 2000, step: 50, default: 500 },
      { type: 'color', key: 'strokeColor', label: 'Stroke Color', default: '#7c6aef' },
      { type: 'slider', key: 'lineWeight', label: 'Line Weight', min: 0.5, max: 4, step: 0.5, default: 1.5 },
      { type: 'slider', key: 'speed', label: 'Speed', min: 0.5, max: 5, step: 0.5, default: 2 },
      { type: 'color', key: 'bgColor', label: 'Background', default: '#0a0a0a' },
      { type: 'toggle', key: 'rainbow', label: 'Rainbow', default: false },
    ];
  }

  setup(p, params) {
    this.head = 0;
    this.count = 0;
    this.t = 0;
    this.drift = 0;
    this.carry = 0;
    p.background(params.bgColor);
  }

  reset(p, params) {
    this.setup(p, params);
  }

  draw(p, params) {
    const ctx = p.drawingContext;
    const { freqA, freqB, trailLength, lineWeight, rainbow } = params;
    ctx.fillStyle = params.bgColor;
    ctx.fillRect(0, 0, p.width, p.height);

    const A = p.width * 0.4;
    const B = p.height * 0.4;
    const cx = p.width / 2;
    const cy = p.height / 2;

    this.drift += params.phaseDrift * (p.deltaTime / 1000);
    const delta = params.phase + this.drift;
    this.carry += params.speed;
    const n = Math.floor(this.carry);
    this.carry -= n;
    for (let i = 0; i < n; i++) {
      this.xs[this.head] = cx + A * Math.sin(freqA * this.t + delta);
      this.ys[this.head] = cy + B * Math.sin(freqB * this.t);
      this.head = (this.head + 1) % MAX_TRAIL;
      this.count = Math.min(this.count + 1, MAX_TRAIL);
      this.t += DT;
    }

    const len = Math.min(this.count, trailLength);
    if (len < 2) return;
    const first = this.head - len + MAX_TRAIL; // ring index of the oldest visible point
    const at = (k) => (first + k) % MAX_TRAIL;

    ctx.lineWidth = lineWeight;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const pieces = Math.min(SEGMENTS, len - 1);
    for (let s = 0; s < pieces; s++) {
      const k0 = Math.floor((s * (len - 1)) / pieces);
      const k1 = Math.floor(((s + 1) * (len - 1)) / pieces);
      ctx.globalAlpha = 0.06 + 0.94 * ((s + 1) / pieces) ** 1.6;
      ctx.strokeStyle = rainbow ? rgbCss(hsvToRgb(((s + 0.5) / pieces) * 360, 0.8, 0.95)) : params.strokeColor;
      ctx.beginPath();
      ctx.moveTo(this.xs[at(k0)], this.ys[at(k0)]);
      for (let k = k0 + 1; k <= k1; k++) ctx.lineTo(this.xs[at(k)], this.ys[at(k)]);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // The pen.
    const last = at(len - 1);
    ctx.fillStyle = rainbow ? rgbCss(hsvToRgb(350, 0.8, 0.95)) : params.strokeColor;
    ctx.beginPath();
    ctx.arc(this.xs[last], this.ys[last], lineWeight * 1.6 + 1, 0, Math.PI * 2);
    ctx.fill();
  }
}
