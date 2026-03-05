import { ArtAlgorithm } from './base.js';

export class FlowField extends ArtAlgorithm {
  static meta = {
    name: 'Flow Field',
    description:
      'Particles trace paths through a Perlin noise vector field, leaving luminous trails that reveal hidden currents.',
    slug: 'flow-field',
    tags: ['noise', 'particles'],
  };

  particles = [];
  flowField = [];
  cols = 0;
  rows = 0;

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
    const scl = 20;
    this.cols = Math.ceil(p.width / scl);
    this.rows = Math.ceil(p.height / scl);
    this.scl = scl;
    this.zOff = 0;
    this.flowField = new Array(this.cols * this.rows);
    this.initParticles(p, params);
    p.background(params.bgColor);
  }

  initParticles(p, params) {
    this.particles = [];
    const count = params.particleCount;
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: Math.random() * p.width,
        y: Math.random() * p.height,
        prevX: 0,
        prevY: 0,
        hue: Math.random(),
      });
    }
  }

  draw(p, params) {
    p.background(p.red(p.color(params.bgColor)), p.green(p.color(params.bgColor)), p.blue(p.color(params.bgColor)), params.trailFade);

    const { noiseScale, speed, noiseEvolution } = params;

    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        const angle = p.noise(x * noiseScale * 100, y * noiseScale * 100, this.zOff) * p.TWO_PI * 2;
        this.flowField[x + y * this.cols] = angle;
      }
    }

    const c1 = p.color(params.color1);
    const c2 = p.color(params.color2);

    for (const pt of this.particles) {
      const col = Math.floor(pt.x / this.scl);
      const row = Math.floor(pt.y / this.scl);

      if (col >= 0 && col < this.cols && row >= 0 && row < this.rows) {
        const angle = this.flowField[col + row * this.cols];
        pt.prevX = pt.x;
        pt.prevY = pt.y;
        pt.x += Math.cos(angle) * speed;
        pt.y += Math.sin(angle) * speed;
      }

      if (pt.x < 0 || pt.x > p.width || pt.y < 0 || pt.y > p.height) {
        pt.x = Math.random() * p.width;
        pt.y = Math.random() * p.height;
        pt.prevX = pt.x;
        pt.prevY = pt.y;
      }

      const lineColor = p.lerpColor(c1, c2, pt.hue);
      p.stroke(p.red(lineColor), p.green(lineColor), p.blue(lineColor), 60);
      p.strokeWeight(1);
      p.line(pt.prevX, pt.prevY, pt.x, pt.y);
    }

    this.zOff += noiseEvolution;

    while (this.particles.length < params.particleCount) {
      this.particles.push({
        x: Math.random() * p.width,
        y: Math.random() * p.height,
        prevX: 0,
        prevY: 0,
        hue: Math.random(),
      });
    }
    if (this.particles.length > params.particleCount) {
      this.particles.length = params.particleCount;
    }
  }

  reset(p, params) {
    p.background(params.bgColor);
    this.zOff = 0;
    this.initParticles(p, params);
  }
}
