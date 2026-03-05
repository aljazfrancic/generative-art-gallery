import { FlowField } from './flow-field.js';
import { FractalTree } from './fractal-tree.js';
import { ParticleSystem } from './particle-system.js';
import { WaveInterference } from './wave-interference.js';
import { Mandelbrot } from './mandelbrot.js';
import { Voronoi } from './voronoi.js';
import { CellularAutomata } from './cellular-automata.js';
import { Spirograph } from './spirograph.js';
import { ReactionDiffusion } from './reaction-diffusion.js';
import { PerlinLandscape } from './perlin-landscape.js';
import { Lissajous } from './lissajous.js';
import { CirclePacking } from './circle-packing.js';
import { MazeGenerator } from './maze-generator.js';

export const algorithms = [
  FlowField,
  FractalTree,
  ParticleSystem,
  WaveInterference,
  Mandelbrot,
  Voronoi,
  CellularAutomata,
  Spirograph,
  ReactionDiffusion,
  PerlinLandscape,
  Lissajous,
  CirclePacking,
  MazeGenerator,
];

export function getAlgorithmBySlug(slug) {
  return algorithms.find((a) => a.meta.slug === slug) || null;
}
