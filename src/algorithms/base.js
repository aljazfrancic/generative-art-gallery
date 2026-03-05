export class ArtAlgorithm {
  static meta = {
    name: 'Untitled',
    description: '',
    slug: 'untitled',
  };

  getControls() {
    return [];
  }

  setup(p, params) {}

  draw(p, params) {}

  mouseMoved(p, params, mx, my) {}

  reset(p, params) {
    p.clear();
    this.setup(p, params);
  }

  randomize(controls) {
    const params = {};
    for (const ctrl of controls) {
      if (ctrl.type === 'slider') {
        const range = ctrl.max - ctrl.min;
        params[ctrl.key] = ctrl.min + Math.random() * range;
        params[ctrl.key] = Math.round(params[ctrl.key] / ctrl.step) * ctrl.step;
      } else if (ctrl.type === 'color') {
        params[ctrl.key] = '#' + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0');
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
