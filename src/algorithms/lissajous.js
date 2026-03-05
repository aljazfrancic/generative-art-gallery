import { ArtAlgorithm } from './base.js';

export class Lissajous extends ArtAlgorithm {
  static meta = {
    name: 'Lissajous Curves',
    description:
      'Parametric curves x = A·sin(a·t + δ), y = B·sin(b·t) drawn with trailing lines and optional rainbow coloring.',
    slug: 'lissajous',
    tags: ['math', 'curves'],
  };

  trail = [];
  t = 0;

  getControls() {
    return [
      { type: 'slider', key: 'freqA', label: 'Frequency A', min: 1, max: 10, step: 1, default: 3 },
      { type: 'slider', key: 'freqB', label: 'Frequency B', min: 1, max: 10, step: 1, default: 2 },
      { type: 'slider', key: 'phase', label: 'Phase (δ)', min: 0, max: 6.28, step: 0.1, default: 1.57 },
      { type: 'slider', key: 'trailLength', label: 'Trail Length', min: 50, max: 2000, step: 50, default: 500 },
      { type: 'color', key: 'strokeColor', label: 'Stroke Color', default: '#7c6aef' },
      { type: 'slider', key: 'lineWeight', label: 'Line Weight', min: 0.5, max: 4, step: 0.5, default: 1.5 },
      { type: 'slider', key: 'speed', label: 'Speed', min: 0.5, max: 5, step: 0.5, default: 2 },
      { type: 'color', key: 'bgColor', label: 'Background', default: '#0a0a0a' },
      { type: 'toggle', key: 'rainbow', label: 'Rainbow', default: false },
    ];
  }

  setup(p, params) {
    this.trail = [];
    this.t = 0;
    const c = p.color(params.bgColor || '#0a0a0a');
    p.background(p.red(c), p.green(c), p.blue(c));
  }

  draw(p, params) {
    const {
      freqA,
      freqB,
      phase,
      trailLength,
      strokeColor,
      lineWeight,
      speed,
      bgColor,
      rainbow,
    } = params;

    const c = p.color(bgColor);
    p.background(p.red(c), p.green(c), p.blue(c));

    const A = p.width * 0.4;
    const B = p.height * 0.4;
    const cx = p.width / 2;
    const cy = p.height / 2;

    const pointsPerFrame = Math.max(1, Math.floor(speed));
    for (let i = 0; i < pointsPerFrame; i++) {
      const x = A * p.sin(freqA * this.t + phase);
      const y = B * p.sin(freqB * this.t);
      this.trail.push({ x: cx + x, y: cy + y });
      this.t += 0.01;
    }

    while (this.trail.length > trailLength) {
      this.trail.shift();
    }

    p.strokeWeight(lineWeight);
    p.noFill();

    if (rainbow) {
      p.colorMode(p.HSB, 360, 100, 100);
      for (let i = 1; i < this.trail.length; i++) {
        const hue = (i / this.trail.length) * 360;
        p.stroke(hue, 80, 95);
        p.line(this.trail[i - 1].x, this.trail[i - 1].y, this.trail[i].x, this.trail[i].y);
      }
      p.colorMode(p.RGB, 255);
    } else {
      p.stroke(strokeColor);
      for (let i = 1; i < this.trail.length; i++) {
        p.line(this.trail[i - 1].x, this.trail[i - 1].y, this.trail[i].x, this.trail[i].y);
      }
    }
  }

  reset(p, params) {
    this.trail = [];
    this.t = 0;
    super.reset(p, params);
  }
}
