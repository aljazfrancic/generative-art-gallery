import { sunIcon, moonIcon } from './icons.js';

// Same behaviour as the switch on aljazfrancic.github.io: follow the system theme, and remember
// a choice only while it differs from it. The key is not "theme" or "home-theme" because every
// project site under that origin shares one localStorage.
const STORAGE_KEY = 'gallery-theme';
const PAGE_BG = { dark: '#0b0b0f', light: '#f6f6f8' }; // keep in sync with --bg in main.css

const systemDark = matchMedia('(prefers-color-scheme: dark)');
const listeners = new Set();
let fadeTimer = 0;

function saved() {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === 'light' || value === 'dark' ? value : null;
  } catch {
    return null;
  }
}

function systemTheme() {
  return systemDark.matches ? 'dark' : 'light';
}

export function currentTheme() {
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
}

export function isLightTheme() {
  return currentTheme() === 'light';
}

function apply(theme) {
  const root = document.documentElement;
  const changed = root.dataset.theme !== theme;
  root.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', PAGE_BG[theme]);
  for (const input of document.querySelectorAll('.theme-switch__input')) input.checked = theme === 'dark';
  if (changed) for (const fn of listeners) fn(theme);
}

function sync() {
  apply(saved() ?? systemTheme());
}

export function toggleTheme() {
  const next = currentTheme() === 'dark' ? 'light' : 'dark';
  try {
    if (next === systemTheme()) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, next);
  } catch {}
  // Cross-fade the interface colours for this one change only.
  const root = document.documentElement;
  root.classList.add('theme-switching');
  clearTimeout(fadeTimer);
  fadeTimer = setTimeout(() => root.classList.remove('theme-switching'), 450);
  apply(next);
}

/** Calls fn(theme) after every theme change. Returns an unsubscribe function. */
export function onThemeChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function initTheme() {
  systemDark.addEventListener('change', sync);
  addEventListener('pageshow', sync); // back/forward cache, or a change made in another tab
  addEventListener('storage', (e) => { if (e.key === STORAGE_KEY) sync(); });
  sync();
}

/** The sun/moon switch: checked means dark. */
export function createThemeSwitch() {
  const label = document.createElement('label');
  label.className = 'theme-switch';
  label.title = 'Switch color theme';
  label.innerHTML = `
    <input class="theme-switch__input" type="checkbox" role="switch" aria-label="Dark theme">
    <span class="theme-switch__track" aria-hidden="true">
      ${sunIcon('theme-switch__icon')}
      ${moonIcon('theme-switch__icon')}
      <span class="theme-switch__thumb">
        ${sunIcon('theme-switch__glyph theme-switch__glyph--sun')}
        ${moonIcon('theme-switch__glyph theme-switch__glyph--moon')}
      </span>
    </span>`;
  const input = label.querySelector('input');
  input.checked = currentTheme() === 'dark';
  input.addEventListener('change', () => {
    if (input.checked !== (currentTheme() === 'dark')) toggleTheme();
  });
  return label;
}

// ---------- canvas backgrounds ----------
// Background-like parameters follow the theme, unless the user picked their own colour.

export const CANVAS_BG = { dark: '#0a0a0a', light: '#f5f5f5' };
const BG_KEYS = ['bgColor', 'deadColor', 'pathColor'];
// Dark backgrounds used as defaults, including those of earlier versions (old shared links).
const DARK_DEFAULTS = new Set(['#0a0a0a', '#000000', '#0a0a0f', '#0a0f14']);

/**
 * Swaps default dark backgrounds for the light canvas colour (and back) to match the theme.
 * Returns true if any value changed.
 */
export function applyCanvasTheme(params, defaults) {
  const light = isLightTheme();
  let changed = false;
  for (const key of BG_KEYS) {
    if (typeof params[key] !== 'string') continue;
    const value = params[key].toLowerCase();
    let next = value;
    if (light && DARK_DEFAULTS.has(value)) next = CANVAS_BG.light;
    else if (!light && value === CANVAS_BG.light) next = defaults?.[key] ?? CANVAS_BG.dark;
    if (next !== value) {
      params[key] = next;
      changed = true;
    }
  }
  return changed;
}

export function isBackgroundKey(key) {
  return BG_KEYS.includes(key);
}
