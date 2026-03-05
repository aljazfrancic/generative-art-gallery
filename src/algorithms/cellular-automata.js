import { ArtAlgorithm } from './base.js';

export class CellularAutomata extends ArtAlgorithm {
  static meta = {
    name: 'Cellular Automata',
    description:
      "Conway's Game of Life on a wrapping grid. Choose Life, HighLife, or Day & Night rule variants with customizable colors.",
    slug: 'cellular-automata',
    tags: ['simulation', 'classic'],
  };

  grid = [];
  nextGrid = [];
  cols = 0;
  rows = 0;
  frameCounter = 0;

  getControls() {
    return [
      { type: 'slider', key: 'cellSize', label: 'Cell Size', min: 4, max: 20, step: 1, default: 8 },
      { type: 'slider', key: 'speed', label: 'Speed (FPS)', min: 1, max: 30, step: 1, default: 10 },
      { type: 'slider', key: 'initialDensity', label: 'Initial Density', min: 0.1, max: 0.9, step: 0.05, default: 0.3 },
      { type: 'color', key: 'aliveColor', label: 'Alive Color', default: '#7c6aef' },
      { type: 'color', key: 'deadColor', label: 'Dead Color', default: '#0a0a0a' },
      {
        type: 'select',
        key: 'ruleVariant',
        label: 'Rule Variant',
        default: 'life',
        options: [
          { value: 'life', label: 'Life (B3/S23)' },
          { value: 'highlife', label: 'HighLife (B36/S23)' },
          { value: 'daynight', label: 'Day & Night (B3678/S34678)' },
        ],
      },
    ];
  }

  setup(p, params) {
    this.cols = Math.ceil(p.width / params.cellSize);
    this.rows = Math.ceil(p.height / params.cellSize);
    this.initGrid(p, params);
  }

  initGrid(p, params) {
    this.grid = [];
    this.nextGrid = [];
    const density = params.initialDensity;
    for (let y = 0; y < this.rows; y++) {
      this.grid[y] = [];
      this.nextGrid[y] = [];
      for (let x = 0; x < this.cols; x++) {
        this.grid[y][x] = p.random() < density ? 1 : 0;
      }
    }
    this.frameCounter = 0;
  }

  countNeighbors(x, y) {
    let count = 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = ((x + dx) % this.cols + this.cols) % this.cols;
        const ny = ((y + dy) % this.rows + this.rows) % this.rows;
        count += this.grid[ny][nx];
      }
    }
    return count;
  }

  survives(alive, neighbors, variant) {
    if (alive) {
      if (variant === 'life' || variant === 'highlife') {
        return neighbors === 2 || neighbors === 3;
      }
      if (variant === 'daynight') {
        return [3, 4, 6, 7, 8].includes(neighbors);
      }
    } else {
      if (variant === 'life') {
        return neighbors === 3;
      }
      if (variant === 'highlife') {
        return neighbors === 3 || neighbors === 6;
      }
      if (variant === 'daynight') {
        return [3, 6, 7, 8].includes(neighbors);
      }
    }
    return false;
  }

  step(params) {
    const variant = params.ruleVariant;
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        const n = this.countNeighbors(x, y);
        this.nextGrid[y][x] = this.survives(this.grid[y][x], n, variant) ? 1 : 0;
      }
    }
    [this.grid, this.nextGrid] = [this.nextGrid, this.grid];
  }

  draw(p, params) {
    p.background(params.deadColor);

    const targetFrames = Math.max(1, Math.floor(60 / params.speed));
    this.frameCounter++;
    if (this.frameCounter >= targetFrames) {
      this.frameCounter = 0;
      this.step(params);
    }

    const cs = params.cellSize;
    const aliveCol = p.color(params.aliveColor);

    p.noStroke();
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        if (this.grid[y][x]) {
          p.fill(aliveCol);
          p.rect(x * cs, y * cs, cs, cs);
        }
      }
    }
  }

  reset(p, params) {
    this.initGrid(p, params);
  }
}
