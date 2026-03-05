import { ArtAlgorithm } from './base.js';

export class CirclePacking extends ArtAlgorithm {
  static meta = {
    name: 'Circle Packing',
    description:
      'Progressively fills the canvas with non-overlapping circles that grow until they touch edges or each other.',
    slug: 'circle-packing',
    tags: ['geometry'],
  };

  circles = [];
  consecutiveFailures = 0;
  placementStopped = false;
  FAILURE_THRESHOLD = 1000;
  doneFrames = 0;

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
    this.consecutiveFailures = 0;
    this.placementStopped = false;
    this.doneFrames = 0;
    p.background(params.bgColor);
  }

  getColorForCircle(p, params, x, y, radius) {
    const { colorMode, color1, color2 } = params;
    const w = p.width;
    const h = p.height;
    const cx = w / 2;
    const cy = h / 2;

    if (colorMode === 'random') {
      p.colorMode(p.HSB, 360, 100, 100);
      const col = p.color(p.random(360), 70, 90);
      p.colorMode(p.RGB, 255);
      return col;
    }
    if (colorMode === 'palette') {
      const t = (x / w + y / h) / 2;
      return p.lerpColor(p.color(color1), p.color(color2), p.constrain(t, 0, 1));
    }
    // gradient: based on distance from center
    const dist = p.dist(x, y, cx, cy);
    const maxDist = p.dist(0, 0, cx, cy);
    const t = p.constrain(dist / maxDist, 0, 1);
    return p.lerpColor(p.color(color1), p.color(color2), t);
  }

  overlapsWithExisting(p, x, y, radius, minGap, excludeIndex = -1) {
    for (let i = 0; i < this.circles.length; i++) {
      if (i === excludeIndex) continue;
      const c = this.circles[i];
      const dist = p.dist(x, y, c.x, c.y);
      if (dist < radius + c.radius + minGap) {
        return true;
      }
    }
    return false;
  }

  canPlaceAt(p, x, y, minRadius, maxRadius, minGap) {
    if (x - minRadius - minGap < 0 || x + minRadius + minGap > p.width) return false;
    if (y - minRadius - minGap < 0 || y + minRadius + minGap > p.height) return false;
    if (this.overlapsWithExisting(p, x, y, minRadius, minGap)) return false;
    return true;
  }

  draw(p, params) {
    const { maxRadius, growSpeed, attemptsPerFrame, minGap, colorMode, color1, color2, bgColor, outlined } = params;

    if (!this.placementStopped) {
      let successCount = 0;
      for (let i = 0; i < attemptsPerFrame; i++) {
        if (this.consecutiveFailures >= this.FAILURE_THRESHOLD) {
          this.placementStopped = true;
          break;
        }
        const x = p.random(p.width);
        const y = p.random(p.height);
        if (this.canPlaceAt(p, x, y, 1, maxRadius, minGap)) {
          const color = this.getColorForCircle(p, params, x, y, 1);
          this.circles.push({ x, y, radius: 1, color, growing: true });
          this.consecutiveFailures = 0;
          successCount++;
        } else {
          this.consecutiveFailures++;
        }
      }
    }

    for (let i = 0; i < this.circles.length; i++) {
      const c = this.circles[i];
      if (c.growing) {
        c.radius += growSpeed;
        if (c.radius >= maxRadius) {
          c.radius = maxRadius;
          c.growing = false;
        } else if (
          c.x - c.radius - minGap < 0 ||
          c.x + c.radius + minGap > p.width ||
          c.y - c.radius - minGap < 0 ||
          c.y + c.radius + minGap > p.height
        ) {
          c.radius -= growSpeed;
          c.growing = false;
        } else if (this.overlapsWithExisting(p, c.x, c.y, c.radius, minGap, i)) {
          c.radius -= growSpeed;
          c.growing = false;
        }
      }
    }

    if (this.placementStopped && this.circles.every(c => !c.growing)) {
      this.doneFrames++;
      if (this.doneFrames >= 60) {
        this.setup(p, params);
        return;
      }
    }

    p.background(bgColor);

    if (outlined) {
      p.noFill();
      p.strokeWeight(1);
      for (const c of this.circles) {
        p.stroke(c.color);
        p.ellipse(c.x, c.y, c.radius * 2, c.radius * 2);
      }
      p.noStroke();
    } else {
      p.noStroke();
      for (const c of this.circles) {
        p.fill(c.color);
        p.ellipse(c.x, c.y, c.radius * 2, c.radius * 2);
      }
    }
  }

  reset(p, params) {
    this.circles = [];
    this.consecutiveFailures = 0;
    this.placementStopped = false;
    p.background(params.bgColor);
    this.setup(p, params);
  }
}
