import { ArtAlgorithm } from './base.js';

export class Voronoi extends ArtAlgorithm {
  static meta = {
    name: 'Voronoi Diagram',
    description:
      'Animated Voronoi cells colored by distance to drifting seed points. Pixel-rendered with gradient or monochrome modes.',
    slug: 'voronoi',
    tags: ['geometry', 'interactive'],
  };

  seeds = [];
  resolution = 3;

  getControls() {
    return [
      { type: 'slider', key: 'pointCount', label: 'Point Count', min: 10, max: 100, step: 5, default: 30 },
      {
        type: 'select',
        key: 'colorMode',
        label: 'Color Mode',
        default: 'gradient',
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

  setup(p, params) {
    p.pixelDensity(1);
    this.initSeeds(p, params);
  }

  initSeeds(p, params) {
    this.seeds = [];
    const count = params.pointCount;
    for (let i = 0; i < count; i++) {
      this.seeds.push({
        x: p.random(p.width),
        y: p.random(p.height),
        vx: (p.random() - 0.5) * 2,
        vy: (p.random() - 0.5) * 2,
        hue: p.random(),
      });
    }
  }

  wrap(value, max) {
    return ((value % max) + max) % max;
  }

  distSq(x1, y1, x2, y2, w, h) {
    let dx = x2 - x1;
    let dy = y2 - y1;
    dx = Math.min(Math.abs(dx), Math.abs(dx + w), Math.abs(dx - w));
    dy = Math.min(Math.abs(dy), Math.abs(dy + h), Math.abs(dy - h));
    return dx * dx + dy * dy;
  }

  findNearestSeed(px, py) {
    let minDist = Infinity;
    let idx = 0;
    const w = this.pWidth;
    const h = this.pHeight;
    for (let i = 0; i < this.seeds.length; i++) {
      const s = this.seeds[i];
      const d = this.distSq(px, py, s.x, s.y, w, h);
      if (d < minDist) {
        minDist = d;
        idx = i;
      }
    }
    return { idx, dist: Math.sqrt(minDist) };
  }

  draw(p, params) {
    const { pointCount, colorMode, animationSpeed, showSeeds, color1, color2 } = params;

    while (this.seeds.length < pointCount) {
      this.seeds.push({
        x: p.random(p.width),
        y: p.random(p.height),
        vx: (p.random() - 0.5) * 2,
        vy: (p.random() - 0.5) * 2,
        hue: p.random(),
      });
    }
    if (this.seeds.length > pointCount) {
      this.seeds.length = pointCount;
    }

    this.pWidth = p.width;
    this.pHeight = p.height;

    const step = this.resolution;
    const maxDist = Math.sqrt(p.width * p.width + p.height * p.height) * 0.5;

    p.loadPixels();
    const d = p.pixels;

    for (let py = 0; py < p.height; py += step) {
      for (let px = 0; px < p.width; px += step) {
        const { idx, dist } = this.findNearestSeed(px, py);
        const seed = this.seeds[idx];

        let r, g, b;
        const t = p.constrain(dist / maxDist, 0, 1);

        if (colorMode === 'random') {
          p.colorMode(p.HSB, 360, 100, 100);
          const col = p.color(seed.hue * 360, 80, 90);
          r = p.red(col);
          g = p.green(col);
          b = p.blue(col);
          p.colorMode(p.RGB, 255);
        } else if (colorMode === 'gradient') {
          const c1 = p.color(color1);
          const c2 = p.color(color2);
          const col = p.lerpColor(c1, c2, t);
          r = p.red(col);
          g = p.green(col);
          b = p.blue(col);
        } else {
          const col = p.color(color1);
          const gray = p.lerpColor(col, p.color(0, 0, 0), t);
          r = p.red(gray);
          g = p.green(gray);
          b = p.blue(gray);
        }

        for (let dy = 0; dy < step && py + dy < p.height; dy++) {
          for (let dx = 0; dx < step && px + dx < p.width; dx++) {
            const i = 4 * ((py + dy) * p.width + (px + dx));
            d[i] = r;
            d[i + 1] = g;
            d[i + 2] = b;
            d[i + 3] = 255;
          }
        }
      }
    }

    p.updatePixels();

    if (showSeeds) {
      p.noStroke();
      p.fill(255, 255, 255, 200);
      for (const s of this.seeds) {
        p.ellipse(s.x, s.y, 4, 4);
      }
    }

    for (const s of this.seeds) {
      s.x += s.vx * animationSpeed;
      s.y += s.vy * animationSpeed;
      s.x = this.wrap(s.x, p.width);
      s.y = this.wrap(s.y, p.height);
    }
  }

  mouseMoved(p, params, mx, my) {
    this.mouseX = mx;
    this.mouseY = my;
  }

  reset(p, params) {
    this.initSeeds(p, params);
    this.mouseX = -1;
    this.mouseY = -1;
  }
}
