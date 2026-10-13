import p5 from './lib/p5.js';

/**
 * Runs one algorithm on its own p5 canvas.
 *
 * p5's draw loop is switched off: the gallery steps every thumbnail from one shared,
 * time-budgeted loop and the art view drives its own, so this host owns the timing, the pixel
 * density and the finish → hold → restart cycle of finite pieces.
 */
export class Sketch {
  ready = false;
  destroyed = false;
  /** Frames drawn since the piece last (re)started. */
  frames = 0;

  #last = 0;
  #heldFor = 0;
  #size;
  #removeHooks = [];

  /**
   * @param {HTMLElement} node  element the canvas is created in
   * @param {import('./algorithms/base.js').ArtAlgorithm} algo
   * @param {object} params     live parameter object (controls mutate it)
   * @param {object} options    width/height (CSS px), density, holdMs, autoRestart(), onReady(sketch),
   *                            vary (restart with algo.variation() params, for gallery previews)
   */
  constructor(node, algo, params, { width, height, density = 1, holdMs = 3000, autoRestart = () => true, vary = false, onReady } = {}) {
    this.algo = algo;
    this.params = params;
    this.holdMs = holdMs;
    this.autoRestart = autoRestart;
    this.vary = vary;
    this.#size = { width, height, density };

    const hooks = p5.lifecycleHooks?.remove;
    const hookCount = hooks?.length ?? 0;
    this.p = new p5((p) => {
      p.setup = () => {
        if (this.destroyed) {
          // Torn down while p5 was still starting; now that the canvas exists, remove() can clean up.
          p.noLoop();
          this.#release(p);
          return;
        }
        const { width: w, height: h, density: d } = this.#size;
        p.createCanvas(w, h);
        p.pixelDensity(d);
        p.noLoop();
        algo.setup(p, params);
        this.ready = true;
        onReady?.(this);
      };
      p.draw = () => {};
    }, node);
    // p5 2.x pushes a per-sketch hook onto a static array and never takes it off again.
    this.#removeHooks = hooks ? hooks.slice(hookCount) : [];
  }

  get canvas() {
    return this.p.canvas;
  }

  /** Draws one frame (timed against the previous one) and handles auto-restart. */
  step(now = performance.now()) {
    if (!this.ready || this.destroyed) return;
    const dt = this.#last ? Math.min(Math.max(now - this.#last, 0), 100) : 1000 / 60;
    this.#last = now;
    this.#frame(dt);
  }

  /** Runs up to `count` frames back to back on a 60 fps clock (to show a still instead of motion). */
  fastForward(count, budgetMs = 50) {
    if (!this.ready || this.destroyed) return;
    const start = performance.now();
    for (let i = 0; i < count && performance.now() - start < budgetMs; i++) this.#frame(1000 / 60);
    this.#last = 0;
  }

  #frame(dt) {
    const p = this.p;
    p.deltaTime = dt;
    p.frameCount += 1;
    p.resetMatrix();
    this.algo.draw(p, this.params);
    this.frames += 1;

    if (this.algo.isComplete() && this.autoRestart()) {
      this.#heldFor += dt;
      if (this.#heldFor >= this.holdMs) {
        if (this.vary && this.algo.variation) Object.assign(this.params, this.algo.variation(this.params));
        this.restart();
      }
    } else {
      this.#heldFor = 0;
    }
  }

  /** Forgets the previous frame time, so a pause doesn't count as one long frame. */
  resume() {
    this.#last = 0;
  }

  restart() {
    if (!this.ready) return;
    this.#heldFor = 0;
    this.frames = 0;
    this.algo.reset(this.p, this.params);
  }

  resize(width, height) {
    this.#size = { ...this.#size, width, height };
    if (!this.ready) return;
    const p = this.p;
    if (width === p.width && height === p.height) return;
    p.resizeCanvas(width, height, true);
    this.#heldFor = 0;
    this.frames = 0;
    this.algo.resize(p, this.params);
  }

  get density() {
    return this.#size.density;
  }

  setDensity(density) {
    if (density === this.#size.density) return;
    this.#size = { ...this.#size, density };
    if (!this.ready) return;
    this.p.pixelDensity(density);
    this.#heldFor = 0;
    this.frames = 0;
    this.algo.resize(this.p, this.params);
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    // Before setup has run, the setup callback above finishes the job.
    if (this.ready) this.#release(this.p);
  }

  #release(p) {
    this.algo.destroy(p);
    // remove() aborts p5's internal AbortController. Without a reason that creates a DOMException
    // whose captured stack references this host (and the closed view), and p5 keeps it alive.
    p._removeAbortController?.abort('sketch removed');
    p.remove()?.catch?.(() => {});
    const hooks = p5.lifecycleHooks?.remove;
    for (const hook of this.#removeHooks) {
      try { hook.call(p); } catch {}
      const i = hooks ? hooks.indexOf(hook) : -1;
      if (i >= 0) hooks.splice(i, 1);
    }
    this.#removeHooks = [];
    // p5 keeps sketch instances reachable after remove() (its colour module decorates
    // p5.Color.prototype with closures over every instance), so free the pixels now and cut the
    // links back to our page: the closures over this host and the node the canvas lived in, which
    // would otherwise keep the whole closed view and its algorithm's buffers alive.
    if (p.canvas) {
      p.canvas.width = 0;
      p.canvas.height = 0;
    }
    p.setup = p.draw = () => {};
    p._userNode = null;
  }
}
