// p5 and the sketch host are a separate chunk, so the page can render before they've downloaded.
let pending = null;

export function loadSketch() {
  pending ??= import('./sketch.js').then(
    (module) => module.Sketch,
    (error) => {
      pending = null; // allow a retry, e.g. after a network hiccup
      throw error;
    },
  );
  return pending;
}
