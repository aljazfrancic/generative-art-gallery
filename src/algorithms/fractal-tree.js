import { ArtAlgorithm } from './base.js';

export class FractalTree extends ArtAlgorithm {
  static meta = {
    name: 'Fractal Tree',
    description:
      'Recursive branching structures grow organically, swaying in a gentle procedural wind.',
    slug: 'fractal-tree',
  };

  time = 0;

  getControls() {
    return [
      { type: 'slider', key: 'angle', label: 'Branch Angle', min: 10, max: 60, step: 1, default: 25 },
      { type: 'slider', key: 'depth', label: 'Depth', min: 4, max: 12, step: 1, default: 9 },
      { type: 'slider', key: 'trunkLen', label: 'Trunk Length', min: 50, max: 200, step: 5, default: 120 },
      { type: 'slider', key: 'shrink', label: 'Shrink Ratio', min: 0.55, max: 0.8, step: 0.01, default: 0.67 },
      { type: 'slider', key: 'windStrength', label: 'Wind', min: 0, max: 30, step: 1, default: 10 },
      { type: 'slider', key: 'thickness', label: 'Thickness', min: 1, max: 10, step: 0.5, default: 4 },
      { type: 'color', key: 'trunkColor', label: 'Trunk', default: '#8B6914' },
      { type: 'color', key: 'leafColor', label: 'Leaves', default: '#22c55e' },
      { type: 'color', key: 'bgColor', label: 'Background', default: '#0a0a0a' },
    ];
  }

  setup(p, params) {
    p.background(params.bgColor);
    this.time = 0;
  }

  draw(p, params) {
    p.background(params.bgColor);

    const { depth, shrink, windStrength, thickness, trunkColor, leafColor, angle } = params;

    const scaledTrunkLen = Math.min(params.trunkLen, p.height * 0.28);

    p.push();
    p.translate(p.width / 2, p.height);

    this.time += 0.02;
    this.drawBranch(p, scaledTrunkLen, depth, angle, shrink, windStrength, thickness, trunkColor, leafColor, 0);

    p.pop();
  }

  drawBranch(p, len, depth, angle, shrink, wind, thickness, trunkColor, leafColor, branchIndex) {
    if (depth <= 0) return;

    const windOffset = Math.sin(this.time + branchIndex * 0.5) * wind * (1 - depth / 12) * 0.02;
    const sw = Math.max(1, thickness * (depth / 10));

    const progress = 1 - depth / 10;
    const tc = p.color(trunkColor);
    const lc = p.color(leafColor);
    const col = p.lerpColor(tc, lc, progress * progress);

    p.strokeWeight(sw);
    p.stroke(col);
    p.line(0, 0, 0, -len);
    p.translate(0, -len);

    if (depth <= 2) {
      p.noStroke();
      p.fill(p.red(lc), p.green(lc), p.blue(lc), 150);
      p.ellipse(0, 0, 6 + Math.random() * 4, 6 + Math.random() * 4);
    }

    const nextLen = len * shrink;

    p.push();
    p.rotate(p.radians(angle) + windOffset);
    this.drawBranch(p, nextLen, depth - 1, angle, shrink, wind, thickness, trunkColor, leafColor, branchIndex * 2 + 1);
    p.pop();

    p.push();
    p.rotate(-p.radians(angle) + windOffset);
    this.drawBranch(p, nextLen, depth - 1, angle, shrink, wind, thickness, trunkColor, leafColor, branchIndex * 2 + 2);
    p.pop();
  }

  reset(p, params) {
    this.time = 0;
    p.background(params.bgColor);
  }
}
