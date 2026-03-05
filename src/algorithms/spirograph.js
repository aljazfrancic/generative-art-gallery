import { ArtAlgorithm } from './base.js';

export class Spirograph extends ArtAlgorithm {
  static meta = {
    name: 'Spirograph',
    description: 'Parametric hypotrochoid curves drawn incrementally with adjustable radii and pen distance.',
    slug: 'spirograph',
    tags: ['math', 'curves'],
  };

  t = 0;
  prevX = null;
  prevY = null;

  getControls() {
    return [
      { type: 'slider', key: 'outerRadius', label: 'Outer Radius (R)', min: 50, max: 200, step: 1, default: 120 },
      { type: 'slider', key: 'innerRadius', label: 'Inner Radius (r)', min: 10, max: 100, step: 1, default: 45 },
      { type: 'slider', key: 'penDistance', label: 'Pen Distance (d)', min: 10, max: 120, step: 1, default: 80 },
      { type: 'color', key: 'strokeColor', label: 'Stroke Color', default: '#7c6aef' },
      { type: 'slider', key: 'strokeWeight', label: 'Stroke Weight', min: 0.5, max: 4, step: 0.1, default: 1.5 },
      { type: 'slider', key: 'speed', label: 'Speed (points/frame)', min: 1, max: 20, step: 1, default: 8 },
      { type: 'slider', key: 'trailFade', label: 'Trail Fade', min: 0, max: 20, step: 1, default: 0 },
      { type: 'color', key: 'bgColor', label: 'Background', default: '#0a0a0a' },
    ];
  }

  setup(p, params) {
    this.t = 0;
    this.prevX = null;
    this.prevY = null;
    const c = p.color(params.bgColor);
    p.background(p.red(c), p.green(c), p.blue(c));
  }

  draw(p, params) {
    const { outerRadius, innerRadius, penDistance, strokeColor, strokeWeight, speed, trailFade, bgColor } = params;

    if (trailFade > 0) {
      const c = p.color(bgColor);
      p.background(p.red(c), p.green(c), p.blue(c), trailFade);
    }

    const R = outerRadius;
    const r = innerRadius;
    const d = penDistance;

    const cx = p.width / 2;
    const cy = p.height / 2;

    p.stroke(strokeColor);
    p.strokeWeight(strokeWeight);
    p.noFill();

    for (let i = 0; i < speed; i++) {
      const x = (R - r) * Math.cos(this.t) + d * Math.cos(((R - r) / r) * this.t);
      const y = (R - r) * Math.sin(this.t) - d * Math.sin(((R - r) / r) * this.t);

      const px = cx + x;
      const py = cy + y;

      if (this.prevX !== null && this.prevY !== null) {
        p.line(this.prevX, this.prevY, px, py);
      }

      this.prevX = px;
      this.prevY = py;
      this.t += 0.02;
    }
  }

  reset(p, params) {
    this.t = 0;
    this.prevX = null;
    this.prevY = null;
    p.clear();
    this.setup(p, params);
  }
}
