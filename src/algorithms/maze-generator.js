import { ArtAlgorithm } from './base.js';

const DX = [0, 1, 0, -1];
const DY = [-1, 0, 1, 0];
const WALL_TOP = 0;
const WALL_RIGHT = 1;
const WALL_BOTTOM = 2;
const WALL_LEFT = 3;

export class MazeGenerator extends ArtAlgorithm {
  static meta = {
    name: 'Maze Generator',
    description: 'Animated recursive backtracker maze generation with optional path solution visualization.',
    slug: 'maze-generator',
    tags: ['algorithm', 'classic'],
  };

  cols = 0;
  rows = 0;
  cells = [];
  stack = [];
  current = null;
  state = 'generating';
  solutionPath = [];
  solutionIndex = 0;

  getControls() {
    return [
      { type: 'slider', key: 'cellSize', label: 'Cell Size', min: 8, max: 40, step: 4, default: 20 },
      { type: 'color', key: 'wallColor', label: 'Wall Color', default: '#333333' },
      { type: 'color', key: 'pathColor', label: 'Path Color', default: '#0a0a0a' },
      { type: 'slider', key: 'genSpeed', label: 'Gen Speed (steps/frame)', min: 1, max: 20, step: 1, default: 5 },
      { type: 'toggle', key: 'showSolution', label: 'Show Solution', default: false },
      { type: 'color', key: 'solveColor', label: 'Solution Color', default: '#7c6aef' },
      { type: 'color', key: 'accentColor', label: 'Accent Color', default: '#ef4444' },
    ];
  }

  setup(p, params) {
    this.cols = Math.floor(p.width / params.cellSize);
    this.rows = Math.floor(p.height / params.cellSize);
    this.initCells();
    this.stack = [];
    this.current = { x: 0, y: 0 };
    this.state = 'generating';
    this.solutionPath = [];
    this.solutionIndex = 0;
  }

  initCells() {
    this.cells = [];
    for (let y = 0; y < this.rows; y++) {
      this.cells[y] = [];
      for (let x = 0; x < this.cols; x++) {
        this.cells[y][x] = {
          walls: [true, true, true, true],
          visited: false,
        };
      }
    }
  }

  getUnvisitedNeighbors(x, y) {
    const neighbors = [];
    for (let d = 0; d < 4; d++) {
      const nx = x + DX[d];
      const ny = y + DY[d];
      if (nx >= 0 && nx < this.cols && ny >= 0 && ny < this.rows && !this.cells[ny][nx].visited) {
        neighbors.push({ x: nx, y: ny, dir: d });
      }
    }
    return neighbors;
  }

  removeWall(x1, y1, x2, y2) {
    if (x2 === x1 + 1) {
      this.cells[y1][x1].walls[WALL_RIGHT] = false;
      this.cells[y2][x2].walls[WALL_LEFT] = false;
    } else if (x2 === x1 - 1) {
      this.cells[y1][x1].walls[WALL_LEFT] = false;
      this.cells[y2][x2].walls[WALL_RIGHT] = false;
    } else if (y2 === y1 + 1) {
      this.cells[y1][x1].walls[WALL_BOTTOM] = false;
      this.cells[y2][x2].walls[WALL_TOP] = false;
    } else if (y2 === y1 - 1) {
      this.cells[y1][x1].walls[WALL_TOP] = false;
      this.cells[y2][x2].walls[WALL_BOTTOM] = false;
    }
  }

  generationStep(p) {
    if (this.state !== 'generating' || !this.current) return;

    const { x, y } = this.current;
    this.cells[y][x].visited = true;

    const neighbors = this.getUnvisitedNeighbors(x, y);

    if (neighbors.length > 0) {
      const next = neighbors[Math.floor(p.random(neighbors.length))];
      this.removeWall(x, y, next.x, next.y);
      this.stack.push({ x, y });
      this.current = { x: next.x, y: next.y };
    } else if (this.stack.length > 0) {
      this.current = this.stack.pop();
    } else {
      this.state = 'done';
      this.current = null;
    }
  }

  computeSolution() {
    const start = { x: 0, y: 0 };
    const end = { x: this.cols - 1, y: this.rows - 1 };
    const prev = {};
    const queue = [start];
    prev[`${start.x},${start.y}`] = null;

    while (queue.length > 0) {
      const { x, y } = queue.shift();
      if (x === end.x && y === end.y) break;

      for (let d = 0; d < 4; d++) {
        if (this.cells[y][x].walls[d]) continue;
        const nx = x + DX[d];
        const ny = y + DY[d];
        if (nx >= 0 && nx < this.cols && ny >= 0 && ny < this.rows) {
          const key = `${nx},${ny}`;
          if (!(key in prev)) {
            prev[key] = { x, y };
            queue.push({ x: nx, y: ny });
          }
        }
      }
    }

    this.solutionPath = [];
    let cur = end;
    while (cur) {
      this.solutionPath.unshift(cur);
      const key = `${cur.x},${cur.y}`;
      cur = prev[key];
    }
    this.solutionIndex = 0;
  }

  draw(p, params) {
    const { cellSize, wallColor, pathColor, genSpeed, showSolution, solveColor, accentColor } = params;

    if (this.cols === 0 || this.rows === 0) {
      this.setup(p, params);
    }

    if (this.state === 'generating') {
      for (let i = 0; i < genSpeed; i++) {
        this.generationStep(p);
        if (this.state === 'done') break;
      }
    } else if (this.state === 'done' && showSolution && this.solutionPath.length === 0) {
      this.computeSolution();
    }

    p.background(pathColor);

    const cs = cellSize;
    const wallCol = p.color(wallColor);
    const accentCol = p.color(accentColor);
    const solveCol = p.color(solveColor);

    p.stroke(wallCol);
    p.strokeWeight(2);

    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        const cell = this.cells[y][x];
        const px = x * cs;
        const py = y * cs;

        if (cell.walls[WALL_TOP]) {
          p.line(px, py, px + cs, py);
        }
        if (cell.walls[WALL_RIGHT]) {
          p.line(px + cs, py, px + cs, py + cs);
        }
        if (cell.walls[WALL_BOTTOM]) {
          p.line(px + cs, py + cs, px, py + cs);
        }
        if (cell.walls[WALL_LEFT]) {
          p.line(px, py + cs, px, py);
        }
      }
    }

    if (this.current && this.state === 'generating') {
      p.noStroke();
      p.fill(accentCol);
      p.rect(this.current.x * cs + 2, this.current.y * cs + 2, cs - 4, cs - 4);
    }

    if (showSolution && this.solutionPath.length > 0) {
      p.noStroke();
      p.fill(solveCol);
      for (let i = 0; i <= this.solutionIndex; i++) {
        const cell = this.solutionPath[i];
        if (cell) {
          p.rect(cell.x * cs + 2, cell.y * cs + 2, cs - 4, cs - 4);
        }
      }
      if (this.solutionIndex < this.solutionPath.length - 1) {
        this.solutionIndex = Math.min(this.solutionIndex + 2, this.solutionPath.length - 1);
      }
    }
  }

  reset(p, params) {
    this.setup(p, params);
  }
}
