// Parameter values come from shared links and from Randomize. Every value is validated against
// its control so a link like ?depth=40 or ?cellSize=0 can't freeze the visitor's tab.

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

function decimalsOf(step) {
  const s = String(step);
  return s.includes('.') ? s.length - s.indexOf('.') - 1 : 0;
}

/** Clamps to the slider's range and snaps to its step (without float noise like 0.30000000000000004). */
export function snapToStep(ctrl, value) {
  const clamped = Math.min(ctrl.max, Math.max(ctrl.min, value));
  const snapped = ctrl.min + Math.round((clamped - ctrl.min) / ctrl.step) * ctrl.step;
  return Number(Math.min(ctrl.max, snapped).toFixed(decimalsOf(ctrl.step)));
}

/** Returns a valid value for the control, or undefined if `raw` can't be used. */
export function sanitizeParam(ctrl, raw) {
  switch (ctrl.type) {
    case 'slider': {
      const n = typeof raw === 'number' ? raw : Number.parseFloat(raw);
      return Number.isFinite(n) ? snapToStep(ctrl, n) : undefined;
    }
    case 'color': {
      if (typeof raw !== 'string' || !HEX.test(raw)) return undefined;
      const hex = raw.toLowerCase();
      return hex.length === 4 ? '#' + [...hex.slice(1)].map((c) => c + c).join('') : hex;
    }
    case 'toggle':
      if (raw === true || raw === 'true' || raw === '1') return true;
      if (raw === false || raw === 'false' || raw === '0') return false;
      return undefined;
    case 'select':
      return ctrl.options.some((o) => o.value === raw) ? raw : undefined;
    default:
      return undefined;
  }
}

/** Defaults, overridden by whatever valid values the query string carries. */
export function paramsFromQuery(controls, defaults, query) {
  const params = { ...defaults };
  if (!query) return params;
  const search = new URLSearchParams(query);
  for (const ctrl of controls) {
    if (!search.has(ctrl.key)) continue;
    const value = sanitizeParam(ctrl, search.get(ctrl.key));
    if (value !== undefined) params[ctrl.key] = value;
  }
  return params;
}

/** Query string with only the values that differ from the defaults, so links stay short. */
export function paramsToQuery(controls, defaults, params) {
  const search = new URLSearchParams();
  for (const ctrl of controls) {
    const value = params[ctrl.key];
    if (value !== undefined && value !== defaults[ctrl.key]) search.set(ctrl.key, String(value));
  }
  return search.toString();
}
