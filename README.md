# Generative Art Gallery

An interactive gallery of generative art algorithms built with p5.js. Explore flow fields, fractals, particle systems, and more — all rendered in real time with adjustable parameters.

**[Live Demo](https://aljazfrancic.github.io/generative-art-gallery/)**

## Features

- **5 generative art algorithms** with real-time rendering
- **Interactive controls** — sliders, color pickers, toggles, and dropdowns to shape each artwork
- **Randomize** — generate unexpected variations with one click
- **Save as PNG** — export any creation at full resolution
- **Fullscreen mode** — immersive viewing with native Fullscreen API
- **Mobile-friendly** — responsive layout, touch-optimized controls, collapsible sidebar
- **Gallery view** — animated preview thumbnails for every algorithm
- **No backend** — pure static site, deployable anywhere

## Algorithms

| Algorithm | Description |
|---|---|
| **Flow Field** | Particles trace paths through a Perlin noise vector field, leaving luminous trails that reveal hidden currents. |
| **Fractal Tree** | Recursive branching structures grow organically, swaying in a gentle procedural wind. |
| **Particle System** | Particles burst from the center with gravity, repulsion, and evolving color — a miniature fireworks engine. |
| **Wave Interference** | Overlapping sine waves create mesmerizing moiré interference patterns with vibrant color channels. |
| **Mandelbrot Set** | Explore the infinite complexity of the Mandelbrot and Julia fractals. Click (or tap) to zoom in, right-click to zoom out. |

## Tech Stack

- **[p5.js](https://p5js.org/)** — Canvas rendering in instance mode
- **Vanilla JavaScript** — ES modules, no framework
- **[Vite](https://vite.dev/)** — Dev server and production build
- **CSS** — Custom properties, responsive design, dark theme
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
  };

  getControls() {
    return [
      { type: 'slider', key: 'speed', label: 'Speed', min: 0.1, max: 5, step: 0.1, default: 1 },
      { type: 'color', key: 'color', label: 'Color', default: '#7c6aef' },
      { type: 'toggle', key: 'trails', label: 'Show Trails', default: true },
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
