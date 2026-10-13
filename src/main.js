import { getAlgorithmBySlug } from './algorithms/registry.js';
import { showGallery } from './gallery.js';
import { showArtView } from './art-view.js';
import { initTheme } from './theme.js';
import { loadSketch } from './sketch-loader.js';

const app = document.getElementById('app');
let teardown = null;
let currentSlug; // undefined until the first route: null for the gallery, else the artwork's slug

initTheme();
history.scrollRestoration = 'manual'; // the gallery restores its own scroll position
loadSketch().catch(() => {}); // start downloading p5 while the page renders; failures surface later

function route() {
  const match = /^#\/art\/([^?]+)(?:\?(.*))?$/.exec(location.hash);
  const AlgoClass = match && getAlgorithmBySlug(match[1]);
  if (match && !AlgoClass) {
    history.replaceState(null, '', '#/');
  }

  const previousSlug = currentSlug;
  teardown?.();
  teardown = null;

  if (AlgoClass) {
    currentSlug = AlgoClass.meta.slug;
    window.scrollTo(0, 0);
    teardown = showArtView(app, AlgoClass, match[2] || '', { focus: previousSlug !== undefined });
  } else {
    currentSlug = null;
    teardown = showGallery(app);
    // Coming back from an artwork: put keyboard focus on its card.
    if (previousSlug) app.querySelector(`.card[href="#/art/${previousSlug}"]`)?.focus({ preventScroll: true });
  }
}

window.addEventListener('hashchange', route);
route();
