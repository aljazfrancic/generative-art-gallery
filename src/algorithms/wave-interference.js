import { ArtAlgorithm } from './base.js';

export class WaveInterference extends ArtAlgorithm {
  static meta = {
    name: 'Wave Interference',
    description:
      'Overlapping sine waves create mesmerizing moiré interference patterns with vibrant color channels.',
    slug: 'wave-interference',
    tags: ['math', 'patterns'],
  };

  time = 0;

  getControls() {
    return [
      { type: 'slider', key: 'waveCount', label: 'Wave Sources', min: 2, max: 8, step: 1, default: 4 },
      { type: 'slider', key: 'frequency', label: 'Frequency', min: 0.01, max: 0.1, step: 0.005, default: 0.04 },
      { type: 'slider', key: 'amplitude', label: 'Amplitude', min: 0.2, max: 1.5, step: 0.05, default: 1 },
      { type: 'slider', key: 'speed', label: 'Speed', min: 0.005, max: 0.08, step: 0.005, default: 0.03 },
      { type: 'slider', key: 'resolution', label: 'Resolution', min: 2, max: 8, step: 1, default: 4 },
      { type: 'toggle', key: 'colorChannels', label: 'Split RGB', default: true },
      { type: 'color', key: 'color1', label: 'Color A', default: '#7c6aef' },
      { type: 'color', key: 'color2', label: 'Color B', default: '#ef4444' },
      { type: 'color', key: 'bgColor', label: 'Background', default: '#000000' },
    ];
  }

  setup(p, params) {
    this.time = 0;
    this.sources = this.generateSources(p, params.waveCount);
    p.background(params.bgColor || 0);
    p.pixelDensity(1);
  }

  generateSources(p, count) {
    const sources = [];
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const r = Math.min(p.width, p.height) * 0.3;
      sources.push({
        x: p.width / 2 + Math.cos(angle) * r,
        y: p.height / 2 + Math.sin(angle) * r,
        phase: (i / count) * Math.PI * 2,
      });
    }
    return sources;
  }

  draw(p, params) {
    const { frequency, speed, resolution, colorChannels, waveCount, amplitude } = params;

    if (!this.sources || this.sources.length !== waveCount) {
      this.sources = this.generateSources(p, waveCount);
    }

    p.loadPixels();

    const step = Math.max(1, Math.round(resolution));

    for (let x = 0; x < p.width; x += step) {
      for (let y = 0; y < p.height; y += step) {
        let valR = 0;
        let valG = 0;
        let valB = 0;

        for (let i = 0; i < this.sources.length; i++) {
          const src = this.sources[i];
          const dx = x - src.x;
          const dy = y - src.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const wave = Math.sin(dist * frequency - this.time + src.phase) * amplitude;

          if (colorChannels) {
            const channelOffset = (i % 3);
            if (channelOffset === 0) valR += wave;
            else if (channelOffset === 1) valG += wave;
            else valB += wave;
          } else {
            valR += wave;
            valG += wave;
            valB += wave;
          }
        }

        const c1 = p.color(params.color1);
        const c2 = p.color(params.color2);

        const r = p.map(valR, -amplitude * waveCount, amplitude * waveCount, p.red(c2), p.red(c1));
        const g = p.map(valG, -amplitude * waveCount, amplitude * waveCount, p.green(c2), p.green(c1));
        const b = p.map(valB, -amplitude * waveCount, amplitude * waveCount, p.blue(c2), p.blue(c1));

        for (let sx = 0; sx < step && x + sx < p.width; sx++) {
          for (let sy = 0; sy < step && y + sy < p.height; sy++) {
            const idx = 4 * ((y + sy) * p.width + (x + sx));
            p.pixels[idx] = r;
            p.pixels[idx + 1] = g;
            p.pixels[idx + 2] = b;
            p.pixels[idx + 3] = 255;
          }
        }
      }
    }

    p.updatePixels();
    this.time += speed;
  }

  onParamChange(p, params, key) {
    if (key === 'waveCount') {
      this.sources = this.generateSources(p, params.waveCount);
    }
  }

  reset(p, params) {
    this.time = 0;
    this.sources = this.generateSources(p, params.waveCount);
    p.background(params.bgColor || 0);
  }
}
