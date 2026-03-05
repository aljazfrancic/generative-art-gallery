import { ArtAlgorithm } from './base.js';

export class ParticleSystem extends ArtAlgorithm {
  static meta = {
    name: 'Particle System',
    description:
      'Particles burst from the center with gravity, repulsion, and evolving color — a miniature fireworks engine.',
    slug: 'particle-system',
  };

  particles = [];
  hueOffset = 0;

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
    p.colorMode(p.HSB, 360, 100, 100, 100);
    p.background(0, 0, 4);
    this.particles = [];
    this.hueOffset = 0;
  }

  draw(p, params) {
    p.colorMode(p.HSB, 360, 100, 100, 100);
    p.background(0, 0, 4, params.trailFade);

    const { spawnRate, maxParticles, gravity, initialSpeed, size, lifetime, colorMode } = params;

    for (let i = 0; i < spawnRate && this.particles.length < maxParticles; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = (0.5 + Math.random()) * initialSpeed;
      this.particles.push({
        x: p.width / 2,
        y: p.height / 2,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0,
        maxLife: lifetime * (0.5 + Math.random() * 0.5),
        hue: this.hueOffset + Math.random() * 60,
      });
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.vx *= 0.99;
      pt.vy *= 0.99;
      pt.vy += gravity;
      pt.x += pt.vx;
      pt.y += pt.vy;
      pt.life++;

      const progress = pt.life / pt.maxLife;
      const alpha = Math.max(0, (1 - progress) * 80);
      const s = size * (1 - progress * 0.5);

      const col = this.getColor(colorMode, pt.hue, progress);
      p.noStroke();
      p.fill(col[0], col[1], col[2], alpha);
      p.ellipse(pt.x, pt.y, s, s);

      if (pt.life > pt.maxLife) {
        this.particles.splice(i, 1);
      }
    }

    this.hueOffset = (this.hueOffset + 0.5) % 360;
  }

  getColor(mode, hue, progress) {
    switch (mode) {
      case 'fire':
        return [30 - progress * 30, 100, 100 - progress * 40];
      case 'ice':
        return [200 + progress * 40, 60, 100 - progress * 30];
      case 'neon':
        return [hue % 360, 100, 100];
      case 'rainbow':
      default:
        return [hue % 360, 80, 100 - progress * 30];
    }
  }

  reset(p, params) {
    this.particles = [];
    this.hueOffset = 0;
    p.colorMode(p.HSB, 360, 100, 100, 100);
    p.background(0, 0, 4);
  }
}
