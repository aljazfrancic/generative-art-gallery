import { ArtAlgorithm } from './base.js';
import { hexToRgb, mixRgb, packRgb } from '../lib/color.js';

const RULES = {
  life: { birth: [3], survive: [2, 3] },
  highlife: { birth: [3, 6], survive: [2, 3] },
  daynight: { birth: [3, 6, 7, 8], survive: [3, 4, 6, 7, 8] },
};
// The board counts as settled when it repeats every two generations, has mostly died down (under
// 0.5% of cells changing for a while), keeps a steady population (only blinkers and gliders
// left), or has simply run long enough.
const QUIET_SHARE = 0.005;
const QUIET_GENERATIONS = 60;
const STEADY_GENERATIONS = 150;
const MAX_GENERATIONS = 1000;

function lookup(counts) {
  const table = new Uint8Array(9);
  for (const n of counts) table[n] = 1;
  return table;
}

export class CellularAutomata extends ArtAlgorithm {
  static meta = {
    name: 'Cellular Automata',
    description:
      "Conway's Game of Life on a wrapping grid, with HighLife and Day & Night variants and fading trails. Starts over once the board settles.",
    slug: 'cellular-automata',
    tags: ['simulation', 'classic'],
    finite: true,
  };

  cols = 0;
  rows = 0;
  grids = null; // [generation t-1, t, scratch for t+1]
  heat = null; // trail brightness of recently dead cells
  generation = 0;
  quiet = 0;
  steady = 0;
  steadyPopulation = -1;
  settled = false;
  pending = 0; // ms owed to the next generation
  view = null; // offscreen canvas with one pixel per cell
  colors = null;

  getControls() {
    return [
      { type: 'slider', key: 'cellSize', label: 'Cell Size', min: 4, max: 20, step: 1, default: 8 },
      { type: 'slider', key: 'speed', label: 'Speed (generations/s)', min: 1, max: 30, step: 1, default: 10 },
      { type: 'slider', key: 'initialDensity', label: 'Initial Density', min: 0.1, max: 0.9, step: 0.05, default: 0.3 },
      { type: 'color', key: 'aliveColor', label: 'Alive Color', default: '#7c6aef' },
      { type: 'color', key: 'deadColor', label: 'Dead Color', default: '#0a0a0a' },
      { type: 'toggle', key: 'trails', label: 'Trails', default: true },
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
    const cols = Math.ceil(p.width / params.cellSize);
    const rows = Math.ceil(p.height / params.cellSize);
    const n = cols * rows;
    this.cols = cols;
    this.rows = rows;
    this.grids = [new Uint8Array(n), new Uint8Array(n), new Uint8Array(n)];
    this.heat = new Uint8Array(n);
    const cur = this.grids[1];
    for (let i = 0; i < n; i++) {
      cur[i] = Math.random() < params.initialDensity ? 1 : 0;
      this.heat[i] = cur[i] ? 255 : 0;
    }
    // Wrapped neighbour columns, so the inner loop needs no modulo.
    this.left = Int32Array.from({ length: cols }, (_, x) => (x - 1 + cols) % cols);
    this.right = Int32Array.from({ length: cols }, (_, x) => (x + 1) % cols);
    this.generation = 0;
    this.quiet = 0;
    this.steady = 0;
    this.steadyPopulation = -1;
    this.settled = false;
    this.pending = 0;

    if (!this.view || this.view.canvas.width !== cols || this.view.canvas.height !== rows) {
      this.destroy();
      const canvas = document.createElement('canvas');
      canvas.width = cols;
      canvas.height = rows;
      const ctx = canvas.getContext('2d');
      const image = ctx.createImageData(cols, rows);
      this.view = { canvas, ctx, image, pixels: new Uint32Array(image.data.buffer) };
    }
    this.render(p, params);
  }

  reset(p, params) {
    this.setup(p, params);
  }

  isComplete() {
    return this.settled;
  }

  step(params) {
    const [older, cur, next] = this.grids;
    const { cols, rows, left, right, heat } = this;
    const rule = RULES[params.ruleVariant] || RULES.life;
    const birth = lookup(rule.birth);
    const survive = lookup(rule.survive);
    let changes = 0;
    let population = 0;
    let repeats = true; // same as two generations ago?

    for (let y = 0; y < rows; y++) {
      const row = y * cols;
      const up = ((y - 1 + rows) % rows) * cols;
      const down = ((y + 1) % rows) * cols;
      for (let x = 0; x < cols; x++) {
        const l = left[x];
        const r = right[x];
        const neighbors =
          cur[up + l] + cur[up + x] + cur[up + r] + cur[row + l] + cur[row + r] + cur[down + l] + cur[down + x] + cur[down + r];
        const i = row + x;
        const alive = cur[i] ? survive[neighbors] : birth[neighbors];
        next[i] = alive;
        population += alive;
        if (alive !== cur[i]) changes++;
        if (alive !== older[i]) repeats = false;
        heat[i] = alive ? 255 : (heat[i] * 200) >> 8;
      }
    }
    this.grids = [cur, next, older];
    this.generation++;

    this.quiet = changes <= Math.max(4, cols * rows * QUIET_SHARE) ? this.quiet + 1 : 0;
    if (Math.abs(population - this.steadyPopulation) <= Math.max(2, this.steadyPopulation * 0.01)) {
      this.steady++;
    } else {
      this.steadyPopulation = population;
      this.steady = 0;
    }
    if (repeats || this.quiet >= QUIET_GENERATIONS || this.steady >= STEADY_GENERATIONS || this.generation >= MAX_GENERATIONS) {
      this.settled = true;
    }
  }

  render(p, params) {
    const key = `${params.aliveColor}${params.deadColor}${params.trails}`;
    if (!this.colors || this.colors.key !== key) {
      const alive = hexToRgb(params.aliveColor);
      const dead = hexToRgb(params.deadColor);
      // 32 trail shades from the dead colour towards (but well short of) the alive colour.
      const trail = Uint32Array.from({ length: 32 }, (_, k) => packRgb(mixRgb(dead, alive, params.trails ? (k / 31) * 0.45 : 0)));
      this.colors = { key, alive: packRgb(alive), trail };
    }
    const cur = this.grids[1];
    const { heat } = this;
    const { pixels, image, ctx, canvas } = this.view;
    const { alive, trail } = this.colors;
    for (let i = 0; i < cur.length; i++) pixels[i] = cur[i] ? alive : trail[heat[i] >> 3];
    ctx.putImageData(image, 0, 0);

    const main = p.drawingContext;
    main.imageSmoothingEnabled = false;
    main.drawImage(canvas, 0, 0, this.cols * params.cellSize, this.rows * params.cellSize);
  }

  draw(p, params) {
    if (this.settled) return;
    const interval = 1000 / params.speed;
    this.pending += p.deltaTime;
    let steps = 0;
    while (this.pending >= interval && steps < 3 && !this.settled) {
      this.step(params);
      this.pending -= interval;
      steps++;
    }
    if (steps === 3) this.pending = 0; // fell behind: drop the backlog rather than catch up
    if (steps > 0) this.render(p, params);
  }

  onParamChange(p, params, key) {
    if (key === 'cellSize' || key === 'initialDensity') {
      this.setup(p, params);
    } else if (key === 'ruleVariant') {
      this.quiet = 0;
      this.steady = 0;
      this.settled = false;
    } else if (key === 'aliveColor' || key === 'deadColor' || key === 'trails') {
      this.render(p, params);
    }
  }

  destroy() {
    if (this.view) {
      this.view.canvas.width = 0;
      this.view.canvas.height = 0;
      this.view = null;
    }
  }
}
