import { FlowField } from './flow-field.js';
import { FractalTree } from './fractal-tree.js';
import { ParticleSystem } from './particle-system.js';
import { WaveInterference } from './wave-interference.js';
import { Mandelbrot } from './mandelbrot.js';

export const algorithms = [
  FlowField,
  FractalTree,
  ParticleSystem,
  WaveInterference,
  Mandelbrot,
];

export function getAlgorithmBySlug(slug) {
  return algorithms.find((a) => a.meta.slug === slug) || null;
}
