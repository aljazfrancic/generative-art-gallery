import { ArtAlgorithm } from './base.js';

export class PerlinLandscape extends ArtAlgorithm {
  static meta = {
    name: 'Perlin Landscape',
    description:
      'Scrolling 3D wireframe terrain rendered as rows of triangle strips using Perlin noise, with fake perspective projection.',
    slug: 'perlin-landscape',
    tags: ['noise', '3d'],
  };

  yOffset = 0;

  getControls() {
    return [
      { type: 'slider', key: 'noiseScale', label: 'Noise Scale', min: 0.05, max: 0.3, step: 0.01, default: 0.1 },
      { type: 'slider', key: 'amplitude', label: 'Amplitude', min: 50, max: 300, step: 10, default: 150 },
      { type: 'slider', key: 'scrollSpeed', label: 'Scroll Speed', min: 0.5, max: 5, step: 0.5, default: 2 },
      { type: 'slider', key: 'gridSize', label: 'Grid Size', min: 10, max: 40, step: 2, default: 20 },
      { type: 'color', key: 'colorLow', label: 'Color Low', default: '#1a5276' },
      { type: 'color', key: 'colorHigh', label: 'Color High', default: '#e74c3c' },
      { type: 'toggle', key: 'wireframe', label: 'Wireframe', default: true },
      { type: 'color', key: 'bgColor', label: 'Background', default: '#0a0a0f' },
    ];
  }

  setup(p, params) {
    this.yOffset = 0;
    p.background(params.bgColor || '#0a0a0f');
  }

  getVertex(p, row, col, noiseScale, amplitude, gridSize, rowSpacing, perspectiveTilt, foreshorten, cLow, cHigh) {
    const worldY = this.yOffset + row * rowSpacing;
    const worldX = col * gridSize - gridSize * 0.5;
    const noiseVal = p.noise(worldX * noiseScale, worldY * noiseScale);
    const height = (noiseVal - 0.5) * amplitude;
    const screenX = p.width / 2 + worldX * Math.pow(foreshorten, row * 0.5);
    const screenY = row * rowSpacing * perspectiveTilt + height * 0.5;
    const normHeight = p.constrain((noiseVal + 0.5) / 1.5, 0, 1);
    const colVertex = p.lerpColor(cLow, cHigh, normHeight);
    return { x: screenX, y: screenY, c: colVertex };
  }

  draw(p, params) {
    const {
      noiseScale,
      amplitude,
      scrollSpeed,
      gridSize,
      colorLow,
      colorHigh,
      wireframe,
    } = params;

    const cLow = p.color(colorLow);
    const cHigh = p.color(colorHigh);

    p.background(params.bgColor || '#0a0a0f');
    p.noFill();

    const cols = Math.floor(p.width / gridSize) + 2;
    const rows = Math.floor(p.height / gridSize) + 2;
    const rowSpacing = gridSize * 0.8;
    const perspectiveTilt = 0.6;
    const foreshorten = 0.85;

    this.yOffset += scrollSpeed;

    if (wireframe) {
      p.strokeWeight(0.5);
      for (let row = 0; row < rows - 1; row++) {
        for (let col = 0; col < cols; col++) {
          const v0 = this.getVertex(p, row, col, noiseScale, amplitude, gridSize, rowSpacing, perspectiveTilt, foreshorten, cLow, cHigh);
          if (col < cols - 1) {
            const v1 = this.getVertex(p, row, col + 1, noiseScale, amplitude, gridSize, rowSpacing, perspectiveTilt, foreshorten, cLow, cHigh);
            p.stroke(p.lerpColor(v0.c, v1.c, 0.5));
            p.line(v0.x, v0.y, v1.x, v1.y);
          }
          const v2 = this.getVertex(p, row + 1, col, noiseScale, amplitude, gridSize, rowSpacing, perspectiveTilt, foreshorten, cLow, cHigh);
          p.stroke(p.lerpColor(v0.c, v2.c, 0.5));
          p.line(v0.x, v0.y, v2.x, v2.y);
        }
      }
      for (let col = 0; col < cols; col++) {
        const v0 = this.getVertex(p, rows - 1, col, noiseScale, amplitude, gridSize, rowSpacing, perspectiveTilt, foreshorten, cLow, cHigh);
        if (col < cols - 1) {
          const v1 = this.getVertex(p, rows - 1, col + 1, noiseScale, amplitude, gridSize, rowSpacing, perspectiveTilt, foreshorten, cLow, cHigh);
          p.stroke(p.lerpColor(v0.c, v1.c, 0.5));
          p.line(v0.x, v0.y, v1.x, v1.y);
        }
      }
    } else {
      for (let row = 0; row < rows - 1; row++) {
        for (let col = 0; col < cols - 1; col++) {
          const v00 = this.getVertex(p, row, col, noiseScale, amplitude, gridSize, rowSpacing, perspectiveTilt, foreshorten, cLow, cHigh);
          const v10 = this.getVertex(p, row, col + 1, noiseScale, amplitude, gridSize, rowSpacing, perspectiveTilt, foreshorten, cLow, cHigh);
          const v01 = this.getVertex(p, row + 1, col, noiseScale, amplitude, gridSize, rowSpacing, perspectiveTilt, foreshorten, cLow, cHigh);
          const v11 = this.getVertex(p, row + 1, col + 1, noiseScale, amplitude, gridSize, rowSpacing, perspectiveTilt, foreshorten, cLow, cHigh);

          const quadColor = p.lerpColor(v00.c, v11.c, 0.5);
          p.fill(quadColor);
          p.stroke(quadColor);
          p.strokeWeight(0.5);

          p.beginShape();
          p.vertex(v00.x, v00.y);
          p.vertex(v10.x, v10.y);
          p.vertex(v11.x, v11.y);
          p.vertex(v01.x, v01.y);
          p.endShape(p.CLOSE);
        }
      }
    }
  }

  reset(p, params) {
    this.yOffset = 0;
    super.reset(p, params);
  }
}
