import { ArtAlgorithm } from './base.js';

export class Mandelbrot extends ArtAlgorithm {
  static meta = {
    name: 'Mandelbrot Set',
    description:
      'Explore the infinite complexity of the Mandelbrot and Julia fractals. Click to zoom in, right-click to zoom out.',
    slug: 'mandelbrot',
  };

  centerX = -0.5;
  centerY = 0;
  zoom = 1;
  needsRedraw = true;
  isJulia = false;
  juliaR = -0.7;
  juliaI = 0.27;

  getControls() {
    return [
      { type: 'slider', key: 'maxIter', label: 'Max Iterations', min: 50, max: 500, step: 10, default: 150 },
      { type: 'slider', key: 'colorSpeed', label: 'Color Cycle', min: 1, max: 20, step: 1, default: 8 },
      {
        type: 'select',
        key: 'palette',
        label: 'Palette',
        default: 'electric',
        options: [
          { value: 'electric', label: 'Electric' },
          { value: 'fire', label: 'Fire' },
          { value: 'ocean', label: 'Ocean' },
          { value: 'grayscale', label: 'Grayscale' },
        ],
      },
      { type: 'toggle', key: 'julia', label: 'Julia Mode', default: false },
      { type: 'slider', key: 'juliaR', label: 'Julia Real', min: -2, max: 2, step: 0.01, default: -0.7 },
      { type: 'slider', key: 'juliaI', label: 'Julia Imag', min: -2, max: 2, step: 0.01, default: 0.27 },
    ];
  }

  setup(p, params) {
    this.centerX = -0.5;
    this.centerY = 0;
    this.zoom = 1;
    this.needsRedraw = true;
    p.pixelDensity(1);
    p.noLoop();
    this.render(p, params);

    const zoomAt = (px, py, zoomIn) => {
      const scaleX = 3.5 / this.zoom / p.width;
      const scaleY = 2.5 / this.zoom / p.height;
      this.centerX += (px - p.width / 2) * scaleX;
      this.centerY += (py - p.height / 2) * scaleY;
      this.zoom *= zoomIn ? 2.5 : 0.5;
      this.render(p, params);
    };

    const canvasEl = p.canvas;

    canvasEl.addEventListener('mousedown', (e) => {
      const rect = canvasEl.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      zoomAt(px, py, e.button !== 2);
    });

    canvasEl.addEventListener('touchstart', (e) => {
      if (!e.touches.length) return;
      e.preventDefault();
      const rect = canvasEl.getBoundingClientRect();
      const px = e.touches[0].clientX - rect.left;
      const py = e.touches[0].clientY - rect.top;
      zoomAt(px, py, true);
    }, { passive: false });

    const container = canvasEl.parentElement;
    if (container && !container.querySelector('.zoom-controls')) {
      const zoomControls = document.createElement('div');
      zoomControls.className = 'zoom-controls';

      const zoomIn = document.createElement('button');
      zoomIn.className = 'btn btn-icon zoom-btn';
      zoomIn.textContent = '+';
      zoomIn.addEventListener('click', (e) => {
        e.stopPropagation();
        zoomAt(p.width / 2, p.height / 2, true);
      });

      const zoomOut = document.createElement('button');
      zoomOut.className = 'btn btn-icon zoom-btn';
      zoomOut.textContent = '−';
      zoomOut.addEventListener('click', (e) => {
        e.stopPropagation();
        zoomAt(p.width / 2, p.height / 2, false);
      });

      zoomControls.appendChild(zoomIn);
      zoomControls.appendChild(zoomOut);
      container.style.position = 'relative';
      container.appendChild(zoomControls);
    }
  }

  draw() {}

  render(p, params) {
    const { maxIter, colorSpeed, palette, julia, juliaR, juliaI } = params;
    const w = p.width;
    const h = p.height;

    p.loadPixels();

    const xMin = this.centerX - 3.5 / this.zoom / 2;
    const yMin = this.centerY - 2.5 / this.zoom / 2;
    const xScale = 3.5 / this.zoom / w;
    const yScale = 2.5 / this.zoom / h;

    for (let px = 0; px < w; px++) {
      for (let py = 0; py < h; py++) {
        const x0 = xMin + px * xScale;
        const y0 = yMin + py * yScale;

        let x, y, cx, cy;
        if (julia) {
          x = x0;
          y = y0;
          cx = juliaR;
          cy = juliaI;
        } else {
          x = 0;
          y = 0;
          cx = x0;
          cy = y0;
        }

        let iter = 0;
        let xx = x * x;
        let yy = y * y;

        while (xx + yy <= 4 && iter < maxIter) {
          y = 2 * x * y + cy;
          x = xx - yy + cx;
          xx = x * x;
          yy = y * y;
          iter++;
        }

        const idx = 4 * (py * w + px);
        if (iter === maxIter) {
          p.pixels[idx] = 0;
          p.pixels[idx + 1] = 0;
          p.pixels[idx + 2] = 0;
        } else {
          const smooth = iter + 1 - Math.log(Math.log(Math.sqrt(xx + yy))) / Math.log(2);
          const t = (smooth * colorSpeed) % 256;
          const [r, g, b] = this.getPaletteColor(palette, t / 256);
          p.pixels[idx] = r;
          p.pixels[idx + 1] = g;
          p.pixels[idx + 2] = b;
        }
        p.pixels[idx + 3] = 255;
      }
    }

    p.updatePixels();
  }

  getPaletteColor(palette, t) {
    switch (palette) {
      case 'fire':
        return [
          Math.floor(Math.min(255, t * 3 * 255)),
          Math.floor(Math.max(0, (t - 0.33) * 3 * 255)),
          Math.floor(Math.max(0, (t - 0.66) * 3 * 255)),
        ];
      case 'ocean':
        return [
          Math.floor(9 * (1 - t) * t * t * t * 255),
          Math.floor(15 * (1 - t) * (1 - t) * t * t * 255),
          Math.floor(8.5 * (1 - t) * (1 - t) * (1 - t) * t * 255 + t * 150),
        ];
      case 'grayscale': {
        const v = Math.floor(t * 255);
        return [v, v, v];
      }
      case 'electric':
      default:
        return [
          Math.floor((0.5 + 0.5 * Math.cos(Math.PI * 2 * (t + 0.0))) * 255),
          Math.floor((0.5 + 0.5 * Math.cos(Math.PI * 2 * (t + 0.33))) * 255),
          Math.floor((0.5 + 0.5 * Math.cos(Math.PI * 2 * (t + 0.67))) * 255),
        ];
    }
  }

  onParamChange(p, params, key) {
    if (key === 'julia') {
      this.centerX = params.julia ? 0 : -0.5;
      this.centerY = 0;
      this.zoom = 1;
    }
    this.render(p, params);
  }

  reset(p, params) {
    this.centerX = params.julia ? 0 : -0.5;
    this.centerY = 0;
    this.zoom = 1;
    this.render(p, params);
  }
}
