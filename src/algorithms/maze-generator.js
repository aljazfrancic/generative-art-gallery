import { ArtAlgorithm } from './base.js';

// Walls as bits per cell, in the order top, right, bottom, left.
const WALL = [1, 2, 4, 8];
const DX = [0, 1, 0, -1];
const DY = [-1, 0, 1, 0];
const OPPOSITE = [2, 3, 0, 1];
const LINE = 2; // wall thickness in px

export class MazeGenerator extends ArtAlgorithm {
  static meta = {
    name: 'Maze Generator',
    description:
      'A recursive backtracker carves a perfect maze cell by cell, then a breadth-first search traces the way through.',
    slug: 'maze-generator',
    tags: ['algorithm', 'classic'],
    finite: true,
  };

  cols = 0;
  rows = 0;
  ox = 0;
  oy = 0;
  walls = null;
  visited = null;
  stack = null;
  depth = 0;
  current = 0;
  marker = -1;
  state = 'generating'; // → 'solving' → 'done'
  path = null;
  shown = 0;

  getControls() {
    return [
      { type: 'slider', key: 'cellSize', label: 'Cell Size', min: 8, max: 40, step: 4, default: 20 },
      { type: 'color', key: 'wallColor', label: 'Wall Color', default: '#5c5c70' },
      { type: 'color', key: 'pathColor', label: 'Path Color', default: '#0a0a0a' },
      { type: 'slider', key: 'genSpeed', label: 'Gen Speed (steps/frame)', min: 1, max: 20, step: 1, default: 5 },
      { type: 'toggle', key: 'showSolution', label: 'Show Solution', default: true },
      { type: 'color', key: 'solveColor', label: 'Solution Color', default: '#7c6aef' },
      { type: 'color', key: 'accentColor', label: 'Accent Color', default: '#ef4444' },
    ];
  }

  setup(p, params) {
    const cs = params.cellSize;
    this.cols = Math.max(2, Math.floor((p.width - LINE * 2) / cs));
    this.rows = Math.max(2, Math.floor((p.height - LINE * 2) / cs));
    this.ox = Math.floor((p.width - this.cols * cs) / 2);
    this.oy = Math.floor((p.height - this.rows * cs) / 2);
    const n = this.cols * this.rows;
    this.walls = new Uint8Array(n).fill(15);
    this.visited = new Uint8Array(n);
    this.stack = new Int32Array(n);
    this.depth = 0;
    this.current = 0;
    this.visited[0] = 1;
    this.marker = -1;
    this.state = 'generating';
    this.path = null;
    this.shown = 0;
    this.redrawAll(p, params);
  }

  reset(p, params) {
    this.setup(p, params);
  }

  isComplete() {
    return this.state === 'done';
  }

  /** One backtracker step; returns [cell, direction] of a carved wall, or null. */
  generationStep() {
    const { cols, rows } = this;
    const x = this.current % cols;
    const y = Math.floor(this.current / cols);
    const options = [];
    for (let d = 0; d < 4; d++) {
      const nx = x + DX[d];
      const ny = y + DY[d];
      if (nx >= 0 && nx < cols && ny >= 0 && ny < rows && !this.visited[ny * cols + nx]) options.push(d);
    }
    if (options.length > 0) {
      const d = options[Math.floor(Math.random() * options.length)];
      const next = (y + DY[d]) * cols + x + DX[d];
      this.walls[this.current] &= ~WALL[d];
      this.walls[next] &= ~WALL[OPPOSITE[d]];
      this.stack[this.depth++] = this.current;
      this.visited[next] = 1;
      const carved = [this.current, d];
      this.current = next;
      return carved;
    }
    if (this.depth > 0) this.current = this.stack[--this.depth];
    else this.state = 'solving';
    return null;
  }

  /** Breadth-first search from the top-left to the bottom-right cell. */
  solve() {
    const { cols, walls } = this;
    const n = walls.length;
    const prev = new Int32Array(n).fill(-1);
    const queue = new Int32Array(n);
    let head = 0;
    let tail = 0;
    queue[tail++] = 0;
    prev[0] = 0;
    while (head < tail) {
      const cell = queue[head++];
      if (cell === n - 1) break;
      for (let d = 0; d < 4; d++) {
        if (walls[cell] & WALL[d]) continue;
        const next = cell + DY[d] * cols + DX[d];
        if (prev[next] === -1) {
          prev[next] = cell;
          queue[tail++] = next;
        }
      }
    }
    const path = [];
    for (let cell = n - 1; cell !== 0; cell = prev[cell]) path.push(cell);
    path.push(0);
    this.path = path.reverse();
    this.shown = 0;
  }

  // ---------- drawing (incremental: only what changed) ----------

  cellXY(cell, cs) {
    return [this.ox + (cell % this.cols) * cs, this.oy + Math.floor(cell / this.cols) * cs];
  }

  eraseWall(ctx, params, cell, d) {
    const cs = params.cellSize;
    const [x, y] = this.cellXY(cell, cs);
    // Cover the wall's thickness (plus antialiasing) but not its ends: whatever wall still meets
    // that corner keeps covering it.
    const t = LINE / 2 + 0.5;
    const e = LINE / 2;
    ctx.fillStyle = params.pathColor;
    if (d === 0) ctx.fillRect(x + e, y - t, cs - 2 * e, 2 * t);
    else if (d === 1) ctx.fillRect(x + cs - t, y + e, 2 * t, cs - 2 * e);
    else if (d === 2) ctx.fillRect(x + e, y + cs - t, cs - 2 * e, 2 * t);
    else ctx.fillRect(x - t, y + e, 2 * t, cs - 2 * e);
  }

  drawMarker(ctx, params, cell, color) {
    const cs = params.cellSize;
    const [x, y] = this.cellXY(cell, cs);
    const inset = color === params.pathColor ? LINE : LINE + 1;
    ctx.fillStyle = color;
    ctx.fillRect(x + inset, y + inset, cs - 2 * inset, cs - 2 * inset);
  }

  drawPath(ctx, params, from, to) {
    const cs = params.cellSize;
    ctx.strokeStyle = params.solveColor;
    ctx.lineWidth = Math.max(2, cs * 0.3);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    const [x0, y0] = this.cellXY(this.path[from], cs);
    ctx.moveTo(x0 + cs / 2, y0 + cs / 2);
    if (from === to) ctx.lineTo(x0 + cs / 2 + 0.01, y0 + cs / 2); // a dot, thanks to the round cap
    for (let i = from + 1; i <= to; i++) {
      const [x, y] = this.cellXY(this.path[i], cs);
      ctx.lineTo(x + cs / 2, y + cs / 2);
    }
    ctx.stroke();
  }

  redrawAll(p, params) {
    const ctx = p.drawingContext;
    const cs = params.cellSize;
    p.background(params.pathColor);
    ctx.strokeStyle = params.wallColor;
    ctx.lineWidth = LINE;
    ctx.lineCap = 'square';
    ctx.beginPath();
    for (let cell = 0; cell < this.walls.length; cell++) {
      const [x, y] = this.cellXY(cell, cs);
      const walls = this.walls[cell];
      if (walls & 1) { ctx.moveTo(x, y); ctx.lineTo(x + cs, y); }
      if (walls & 8) { ctx.moveTo(x, y); ctx.lineTo(x, y + cs); }
      if (walls & 2 && cell % this.cols === this.cols - 1) { ctx.moveTo(x + cs, y); ctx.lineTo(x + cs, y + cs); }
      if (walls & 4 && cell >= this.walls.length - this.cols) { ctx.moveTo(x, y + cs); ctx.lineTo(x + cs, y + cs); }
    }
    ctx.stroke();
    if (params.showSolution && this.path && this.shown > 0) this.drawPath(ctx, params, 0, this.shown - 1);
    if (this.state === 'generating' && this.marker >= 0) this.drawMarker(ctx, params, this.marker, params.accentColor);
  }

  draw(p, params) {
    const ctx = p.drawingContext;
    if (this.state === 'generating') {
      for (let i = 0; i < params.genSpeed && this.state === 'generating'; i++) {
        const carved = this.generationStep();
        if (carved) this.eraseWall(ctx, params, carved[0], carved[1]);
      }
      if (this.marker >= 0) this.drawMarker(ctx, params, this.marker, params.pathColor);
      this.marker = this.state === 'generating' ? this.current : -1;
      if (this.marker >= 0) this.drawMarker(ctx, params, this.marker, params.accentColor);
    }

    if (this.state === 'solving') {
      if (!params.showSolution) {
        this.state = 'done';
        return;
      }
      if (!this.path) this.solve();
      // Trace the whole path in about three seconds, whatever its length.
      const perFrame = Math.max(2, Math.ceil(this.path.length / 180));
      const from = Math.max(0, this.shown - 1);
      this.shown = Math.min(this.path.length, this.shown + perFrame);
      this.drawPath(ctx, params, from, this.shown - 1);
      if (this.shown >= this.path.length) this.state = 'done';
    }
  }

  onParamChange(p, params, key) {
    if (key === 'cellSize') {
      this.setup(p, params);
    } else if (key === 'showSolution') {
      if (params.showSolution && this.state === 'done' && !this.path) this.state = 'solving';
      this.redrawAll(p, params);
    } else if (key !== 'genSpeed') {
      this.redrawAll(p, params);
    }
  }
}
