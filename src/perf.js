// Device capability hints. Everything here is a starting point: the art view also
// measures real frame times and lowers the resolution when a device can't keep up.

const nav = typeof navigator !== 'undefined' ? navigator : {};
const cores = nav.hardwareConcurrency || 4;
const memoryGB = nav.deviceMemory || 4; // Chromium only; rounded down to a power of two
const saveData = !!nav.connection?.saveData;

/** Few cores, little memory or Data Saver: render at 1x and keep budgets small. */
export const lowEnd = saveData || memoryGB <= 2 || cores <= 2 || (cores <= 4 && memoryGB <= 4);

const reducedMotionQuery = typeof matchMedia === 'function'
  ? matchMedia('(prefers-reduced-motion: reduce)')
  : { matches: false };

export function prefersReducedMotion() {
  return reducedMotionQuery.matches;
}

/** Canvas pixel density: crisp on HiDPI screens, but never above 2x (1x on low-end devices). */
export function canvasDensity() {
  const dpr = window.devicePixelRatio || 1;
  return Math.max(1, Math.min(dpr, lowEnd ? 1 : 2));
}
