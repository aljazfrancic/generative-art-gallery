# Generative Art Gallery

An interactive gallery of generative art algorithms built with p5.js. Explore flow fields, fractals, particle systems, reaction-diffusion patterns, and more — all rendered in real time with adjustable parameters.

**[Live Demo](https://aljazfrancic.github.io/generative-art-gallery/)**

## Features

- **13 generative art algorithms** with real-time rendering
- **Interactive controls** — sliders, color pickers, toggles, and dropdowns to shape each artwork
- **Dark / Light theme** — toggle between themes; thumbnails and backgrounds update to match
- **Tag filtering** — browse algorithms by category (fractal, math, particles, simulation, etc.)
- **Randomize** — generate unexpected variations with one click
- **Save as PNG** — export any creation at full resolution
- **Record video** — capture animations as WebM/MP4 directly in the browser
- **Fullscreen mode** — immersive viewing with native Fullscreen API
- **Shareable URLs** — parameter state is encoded in the URL for easy sharing
- **Keyboard shortcuts** — arrow keys to navigate, `R` to randomize, `S` to save, `F` for fullscreen
- **Mobile-friendly** — responsive layout, touch-optimized controls, collapsible sidebar, pinch-to-zoom and pan on supported algorithms
- **Gallery view** — continuously animated preview thumbnails with lazy loading and performance optimizations
- **No backend** — pure static site, deployable anywhere

## Algorithms

| Algorithm | Description |
|---|---|
| **Flow Field** | Particles trace paths through a Perlin noise vector field, leaving luminous trails that reveal hidden currents. |
| **Fractal Tree** | Recursive branching structures grow organically, swaying in a gentle procedural wind. |
| **Particle System** | Particles burst from the center with gravity, repulsion, and evolving color — a miniature fireworks engine. |
| **Wave Interference** | Overlapping sine waves create mesmerizing moiré interference patterns with vibrant color channels. |
| **Mandelbrot Set** | Explore the infinite complexity of the Mandelbrot and Julia fractals. Click to zoom in, right-click to zoom out. Supports pinch-to-zoom and pan on mobile. |
| **Voronoi Diagram** | Animated Voronoi cells colored by distance to drifting seed points. Pixel-rendered with random, gradient, or monochrome modes. |
| **Cellular Automata** | Conway's Game of Life on a wrapping grid. Choose Life, HighLife, or Day & Night rule variants with customizable colors. |
| **Spirograph** | Parametric hypotrochoid curves drawn incrementally with adjustable radii and pen distance. |
| **Reaction-Diffusion** | Gray-Scott model: two chemicals interact on a grid to form organic, evolving patterns. Chemical, heat, and ocean palettes. |
| **Perlin Landscape** | Scrolling 3D wireframe terrain rendered with Perlin noise and fake perspective projection. |
| **Lissajous Curves** | Parametric curves x = A·sin(a·t + δ), y = B·sin(b·t) drawn with trailing lines and optional rainbow coloring. |
| **Circle Packing** | Progressively fills the canvas with non-overlapping circles that grow until they touch edges or each other. |
| **Maze Generator** | Animated recursive backtracker maze generation with optional BFS path solution visualization. |

## Tech Stack

- **[p5.js](https://p5js.org/)** — Canvas rendering in instance mode
- **Vanilla JavaScript** — ES modules, no framework
- **[Vite](https://vite.dev/)** — Dev server and production build
- **CSS** — Custom properties, dark/light themes, responsive design, animated gradients
- **GitHub Actions** — Automated deployment to GitHub Pages

## Getting Started

```bash
# Clone the repository
git clone https://github.com/aljazfrancic/generative-art-gallery.git
cd generative-art-gallery

# Install dependencies
npm install

# Start the dev server
npm run dev
```

Open `http://localhost:5173/generative-art-gallery/` in your browser.

## Build

```bash
npm run build     # Output to dist/
npm run preview   # Preview the production build locally
```

## Deployment

The project deploys automatically to GitHub Pages via the included GitHub Actions workflow (`.github/workflows/deploy.yml`). Every push to `main` triggers a build and deployment.

To enable it on your fork:

1. Go to **Settings > Pages**
2. Set **Source** to **GitHub Actions**

The site will be available at `https://<username>.github.io/generative-art-gallery/`.

## Project Structure

```
src/
├── main.js              # App entry point, routing, theme, UI orchestration
├── gallery.js           # Gallery grid, lazy-loaded thumbnails, tag filtering
├── controls.js          # Dynamic parameter control builder (sliders, pickers, etc.)
├── export.js            # PNG save and fullscreen toggle
├── gif-export.js        # Video recording via MediaRecorder API
├── styles/
│   └── main.css         # All styling, themes, responsive layout
└── algorithms/
    ├── base.js           # ArtAlgorithm base class
    ├── registry.js       # Algorithm registry and slug lookup
    ├── flow-field.js
    ├── fractal-tree.js
    ├── particle-system.js
    ├── wave-interference.js
    ├── mandelbrot.js
    ├── voronoi.js
    ├── cellular-automata.js
    ├── spirograph.js
    ├── reaction-diffusion.js
    ├── perlin-landscape.js
    ├── lissajous.js
    ├── circle-packing.js
    └── maze-generator.js
```

## Adding a New Algorithm

1. Create a new file in `src/algorithms/`, e.g. `my-algorithm.js`
2. Extend the `ArtAlgorithm` base class:

```javascript
import { ArtAlgorithm } from './base.js';

export class MyAlgorithm extends ArtAlgorithm {
  static meta = {
    name: 'My Algorithm',
    description: 'A short description of what it does.',
    slug: 'my-algorithm',
    tags: ['category'],
  };

  getControls() {
    return [
      { type: 'slider', key: 'speed', label: 'Speed', min: 0.1, max: 5, step: 0.1, default: 1 },
      { type: 'color', key: 'color', label: 'Color', default: '#7c6aef' },
      { type: 'toggle', key: 'trails', label: 'Show Trails', default: true },
      { type: 'select', key: 'mode', label: 'Mode', options: ['A', 'B'], default: 'A' },
    ];
  }

  setup(p, params) {
    p.background(0);
  }

  draw(p, params) {
    // Your rendering logic here
  }

  reset(p, params) {
    p.background(0);
    this.setup(p, params);
  }
}
```

3. Register it in `src/algorithms/registry.js`:

```javascript
import { MyAlgorithm } from './my-algorithm.js';

export const algorithms = [
  // ...existing algorithms
  MyAlgorithm,
];
```

The gallery and art views will automatically pick up the new algorithm — no other changes needed.

## License

[MIT](LICENSE)
