import { snapToStep } from '../params.js';
import { randomVividHex } from '../lib/color.js';
import { isBackgroundKey } from '../theme.js';

export class ArtAlgorithm {
  static meta = {
    name: 'Untitled',
    description: '',
    slug: 'untitled',
    tags: [],
    // finite: true   — the piece ends (see isComplete) and the host can restart it
    // animated: false — drawn on demand only (no pause or recording)
  };

  /** True in the full-screen art view, false for gallery thumbnails. */
  interactive = false;

  /** Pointer over the canvas in CSS pixels, { x, y, down }, or null. Set by the art view. */
  pointer = null;

  getControls() {
    return [];
  }

  setup(p, params) {}

  draw(p, params) {}

  reset(p, params) {
    p.clear();
    this.setup(p, params);
  }

  /** Called after the canvas changed size or pixel density. Most pieces simply start over. */
  resize(p, params) {
    this.reset(p, params);
  }

  /** Called after a control changed `params[key]`. */
  onParamChange(p, params, key) {}

  /** Finite pieces return true once they are finished; the host holds the frame, then restarts. */
  isComplete() {
    return false;
  }

  /** True while an on-demand piece has nothing left to draw (lets hosts skip frames). */
  isIdle() {
    return false;
  }

  /** Releases anything held outside the canvas (listeners, offscreen buffers). */
  destroy(p) {}

  randomize(controls) {
    const params = {};
    for (const ctrl of controls) {
      // Backgrounds stay in step with the theme.
      if (isBackgroundKey(ctrl.key)) continue;
      if (ctrl.type === 'slider') {
        params[ctrl.key] = snapToStep(ctrl, ctrl.min + Math.random() * (ctrl.max - ctrl.min));
      } else if (ctrl.type === 'color') {
        params[ctrl.key] = randomVividHex();
      } else if (ctrl.type === 'toggle') {
        params[ctrl.key] = Math.random() > 0.5;
      } else if (ctrl.type === 'select') {
        const opts = ctrl.options;
        params[ctrl.key] = opts[Math.floor(Math.random() * opts.length)].value;
      }
    }
    return params;
  }

  getDefaultParams() {
    const params = {};
    for (const ctrl of this.getControls()) {
      if (ctrl.default !== undefined) {
        params[ctrl.key] = ctrl.default;
      }
    }
    return params;
  }
}
