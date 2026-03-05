import { ArtAlgorithm } from './base.js';

export class Mandelbrot extends ArtAlgorithm {
  static meta = {
    name: 'Mandelbrot Set',
    description:
      'Explore the infinite complexity of the Mandelbrot and Julia fractals. Click to zoom in, right-click to zoom out.',
    slug: 'mandelbrot',
    tags: ['fractal', 'math'],
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

    const viewSize = () => {
      const aspect = p.width / p.height;
      const viewH = 3.5 / this.zoom;
      return { viewW: viewH * aspect, viewH };
    };

    const zoomAt = (px, py, zoomIn) => {
      const { viewW, viewH } = viewSize();
      this.centerX += (px - p.width / 2) * (viewW / p.width);
      this.centerY += (py - p.height / 2) * (viewH / p.height);
      this.zoom *= zoomIn ? 2.5 : 0.5;
      this.render(p, params);
    };

    let renderTimeout = null;
    let isGesturing = false;

    const scheduleRender = () => {
      clearTimeout(renderTimeout);
      renderTimeout = setTimeout(() => {
        this.render(p, params);
        isGesturing = false;
      }, 150);
    };

    const renderPreview = () => {
      if (!isGesturing) {
        isGesturing = true;
      }
      this.renderFast(p, params);
      scheduleRender();
    };

    const panBy = (dx, dy) => {
      const { viewW, viewH } = viewSize();
      this.centerX -= dx * (viewW / p.width);
      this.centerY -= dy * (viewH / p.height);
      renderPreview();
    };

    const zoomBy = (factor) => {
      this.zoom *= factor;
      renderPreview();
    };

    const canvasEl = p.canvas;
    const container = canvasEl.parentElement;
    const isThumbnail = container && container.classList.contains('gallery-card-canvas');

    if (isThumbnail) return;

    const sidebarIsOpen = () => {
      const artView = canvasEl.closest('.art-view');
      return artView && artView.classList.contains('sidebar-open');
    };

    // Desktop: click to zoom, drag to pan
    let isDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let hasDragged = false;

    canvasEl.addEventListener('mousedown', (e) => {
      if (sidebarIsOpen()) return;
      isDragging = true;
      hasDragged = false;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
    });

    window.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const dx = e.clientX - dragStartX;
      const dy = e.clientY - dragStartY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) hasDragged = true;
      if (hasDragged) {
        panBy(dx, dy);
        dragStartX = e.clientX;
        dragStartY = e.clientY;
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (!isDragging) return;
      isDragging = false;
      if (!hasDragged && !sidebarIsOpen()) {
        const rect = canvasEl.getBoundingClientRect();
        const px = e.clientX - rect.left;
        const py = e.clientY - rect.top;
        if (px >= 0 && px <= p.width && py >= 0 && py <= p.height) {
          zoomAt(px, py, e.button !== 2);
        }
      }
    });

    // Mouse wheel zoom
    canvasEl.addEventListener('wheel', (e) => {
      if (sidebarIsOpen()) return;
      e.preventDefault();
      zoomBy(e.deltaY < 0 ? 1.3 : 0.77);
    }, { passive: false });

    // Touch: one finger = pan, two fingers = pinch zoom
    let lastTouches = null;

    canvasEl.addEventListener('touchstart', (e) => {
      if (sidebarIsOpen()) return;
      e.preventDefault();
      lastTouches = Array.from(e.touches).map(t => ({ x: t.clientX, y: t.clientY }));
    }, { passive: false });

    canvasEl.addEventListener('touchmove', (e) => {
      if (sidebarIsOpen() || !lastTouches) return;
      e.preventDefault();
      const current = Array.from(e.touches).map(t => ({ x: t.clientX, y: t.clientY }));

      if (current.length === 1 && lastTouches.length === 1) {
        const dx = current[0].x - lastTouches[0].x;
        const dy = current[0].y - lastTouches[0].y;
        panBy(dx, dy);
      } else if (current.length >= 2 && lastTouches.length >= 2) {
        const prevDist = Math.hypot(lastTouches[1].x - lastTouches[0].x, lastTouches[1].y - lastTouches[0].y);
        const currDist = Math.hypot(current[1].x - current[0].x, current[1].y - current[0].y);
        if (prevDist > 0) {
          zoomBy(currDist / prevDist);
        }

        const prevMidX = (lastTouches[0].x + lastTouches[1].x) / 2;
        const prevMidY = (lastTouches[0].y + lastTouches[1].y) / 2;
        const currMidX = (current[0].x + current[1].x) / 2;
        const currMidY = (current[0].y + current[1].y) / 2;
        panBy(currMidX - prevMidX, currMidY - prevMidY);
      }

      lastTouches = current;
    }, { passive: false });

    canvasEl.addEventListener('touchend', (e) => {
      if (e.touches.length === 0) {
        lastTouches = null;
      } else {
        lastTouches = Array.from(e.touches).map(t => ({ x: t.clientX, y: t.clientY }));
      }
    });

    // +/- zoom buttons
    if (container && !container.querySelector('.zoom-controls')) {
      const zoomControls = document.createElement('div');
      zoomControls.className = 'zoom-controls';

      const zoomInBtn = document.createElement('button');
      zoomInBtn.className = 'btn btn-icon zoom-btn';
      zoomInBtn.textContent = '+';
      zoomInBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        zoomBy(2.5);
      });

      const zoomOutBtn = document.createElement('button');
      zoomOutBtn.className = 'btn btn-icon zoom-btn';
      zoomOutBtn.textContent = '−';
      zoomOutBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        zoomBy(0.4);
      });

      zoomControls.appendChild(zoomInBtn);
      zoomControls.appendChild(zoomOutBtn);
      container.style.position = 'relative';
      container.appendChild(zoomControls);
    }
  }

  draw() {}

  renderFast(p, params) {
    const step = 4;
    const { maxIter, colorSpeed, palette, julia, juliaR, juliaI } = params;
    const w = p.width;
    const h = p.height;
    const fastIter = Math.min(maxIter, 60);

    p.loadPixels();

    const aspect = w / h;
    const viewH = 3.5 / this.zoom;
    const viewW = viewH * aspect;
    const xMin = this.centerX - viewW / 2;
    const yMin = this.centerY - viewH / 2;
    const xScale = viewW / w;
    const yScale = viewH / h;

    for (let px = 0; px < w; px += step) {
      for (let py = 0; py < h; py += step) {
        const x0 = xMin + px * xScale;
        const y0 = yMin + py * yScale;

        let x, y, cx, cy;
        if (julia) { x = x0; y = y0; cx = juliaR; cy = juliaI; }
        else { x = 0; y = 0; cx = x0; cy = y0; }

        let iter = 0, xx = x * x, yy = y * y;
        while (xx + yy <= 4 && iter < fastIter) {
          y = 2 * x * y + cy;
          x = xx - yy + cx;
          xx = x * x; yy = y * y;
          iter++;
        }

        let r, g, b;
        if (iter === fastIter) { r = 0; g = 0; b = 0; }
        else {
          const smooth = iter + 1 - Math.log(Math.log(Math.sqrt(xx + yy))) / Math.log(2);
          const t = (smooth * colorSpeed) % 256;
          [r, g, b] = this.getPaletteColor(palette, t / 256);
        }

        for (let sx = 0; sx < step && px + sx < w; sx++) {
          for (let sy = 0; sy < step && py + sy < h; sy++) {
            const idx = 4 * ((py + sy) * w + (px + sx));
            p.pixels[idx] = r;
            p.pixels[idx + 1] = g;
            p.pixels[idx + 2] = b;
            p.pixels[idx + 3] = 255;
          }
        }
      }
    }

    p.updatePixels();
  }

  render(p, params) {
    const { maxIter, colorSpeed, palette, julia, juliaR, juliaI } = params;
    const w = p.width;
    const h = p.height;

    p.loadPixels();

    const aspect = w / h;
    const viewH = 3.5 / this.zoom;
    const viewW = viewH * aspect;
    const xMin = this.centerX - viewW / 2;
    const yMin = this.centerY - viewH / 2;
    const xScale = viewW / w;
    const yScale = viewH / h;

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
