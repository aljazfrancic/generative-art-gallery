// Small colour helpers for hot loops: plain arrays and CSS strings instead of p5.Color objects.

/** '#rrggbb' (or '#rgb') → [r, g, b] in 0–255. */
export function hexToRgb(hex) {
  let h = hex.slice(1);
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function mixRgb(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

export function rgbCss(rgb, alpha = 1) {
  return alpha >= 1
    ? `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`
    : `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${+alpha.toFixed(3)})`;
}

/** HSV → RGB. h in degrees, s and v in 0–1. */
export function hsvToRgb(h, s, v) {
  h = (((h % 360) + 360) % 360) / 60;
  const i = Math.floor(h);
  const f = h - i;
  const p = v * (1 - s);
  const q = v * (1 - s * f);
  const t = v * (1 - s * (1 - f));
  let r, g, b;
  switch (i) {
    case 0: r = v; g = t; b = p; break;
    case 1: r = q; g = v; b = p; break;
    case 2: r = p; g = v; b = t; break;
    case 3: r = p; g = q; b = v; break;
    case 4: r = t; g = p; b = v; break;
    default: r = v; g = p; b = q;
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

/** Packs an opaque colour for a Uint32Array view over ImageData (little-endian byte order). */
export function packRgb(rgb) {
  return ((255 << 24) | (rgb[2] << 16) | (rgb[1] << 8) | rgb[0]) >>> 0;
}

/** A random vivid colour as '#rrggbb' (used by Randomize instead of muddy uniform RGB). */
export function randomVividHex() {
  const [r, g, b] = hsvToRgb(Math.random() * 360, 0.55 + Math.random() * 0.35, 0.8 + Math.random() * 0.2);
  return '#' + [r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('');
}
