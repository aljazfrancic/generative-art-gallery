/**
 * Builds the parameter controls (sliders, colour pickers, toggles, selects) for an algorithm.
 * Every input gets a real <label>, so the controls work with screen readers and keyboards.
 */
export function buildControls(controlDefs, params, onChange) {
  const container = document.createElement('div');
  container.className = 'controls';
  const inputs = {};

  for (const ctrl of controlDefs) {
    const id = `ctl-${ctrl.key}`;
    const group = document.createElement('div');
    group.className = 'control';

    const label = document.createElement('label');
    label.className = 'control__label';
    label.htmlFor = id;
    label.textContent = ctrl.label;

    if (ctrl.type === 'slider') {
      const value = document.createElement('output');
      value.className = 'control__value';
      value.htmlFor = id;

      const head = document.createElement('div');
      head.className = 'control__head';
      head.append(label, value);

      const input = document.createElement('input');
      input.type = 'range';
      input.id = id;
      input.className = 'range';
      input.min = ctrl.min;
      input.max = ctrl.max;
      input.step = ctrl.step;
      input.addEventListener('input', () => {
        const val = parseFloat(input.value);
        params[ctrl.key] = val;
        showSlider(ctrl, input, value, val);
        onChange(ctrl.key, val);
      });

      group.append(head, input);
      inputs[ctrl.key] = (val) => {
        input.value = val;
        showSlider(ctrl, input, value, val);
      };
    } else if (ctrl.type === 'color') {
      group.classList.add('control--inline');
      const swatch = document.createElement('span');
      swatch.className = 'swatch';
      const input = document.createElement('input');
      input.type = 'color';
      input.id = id;
      const hex = document.createElement('span');
      hex.className = 'swatch__hex';
      hex.setAttribute('aria-hidden', 'true');
      input.addEventListener('input', () => {
        params[ctrl.key] = input.value;
        hex.textContent = input.value;
        onChange(ctrl.key, input.value);
      });
      swatch.append(hex, input);
      group.append(label, swatch);
      inputs[ctrl.key] = (val) => {
        input.value = val;
        hex.textContent = val;
      };
    } else if (ctrl.type === 'toggle') {
      group.classList.add('control--inline');
      const toggle = document.createElement('span');
      toggle.className = 'toggle';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.id = id;
      input.className = 'toggle__input';
      input.setAttribute('role', 'switch');
      const track = document.createElement('span');
      track.className = 'toggle__track';
      track.setAttribute('aria-hidden', 'true');
      input.addEventListener('change', () => {
        params[ctrl.key] = input.checked;
        onChange(ctrl.key, input.checked);
      });
      toggle.append(input, track);
      group.append(label, toggle);
      inputs[ctrl.key] = (val) => { input.checked = val; };
    } else if (ctrl.type === 'select') {
      const select = document.createElement('select');
      select.id = id;
      select.className = 'select';
      for (const opt of ctrl.options) {
        const option = document.createElement('option');
        option.value = opt.value;
        option.textContent = opt.label;
        select.appendChild(option);
      }
      select.addEventListener('change', () => {
        params[ctrl.key] = select.value;
        onChange(ctrl.key, select.value);
      });
      group.append(label, select);
      inputs[ctrl.key] = (val) => { select.value = val; };
    } else {
      continue;
    }

    inputs[ctrl.key](params[ctrl.key]);
    container.appendChild(group);
  }

  /** Reflects new values (after Randomize, Defaults or a theme change) without firing onChange. */
  function updateUI(newParams) {
    for (const ctrl of controlDefs) {
      const val = newParams[ctrl.key];
      if (val === undefined || !inputs[ctrl.key]) continue;
      params[ctrl.key] = val;
      inputs[ctrl.key](val);
    }
  }

  return { element: container, updateUI };
}

function showSlider(ctrl, input, output, val) {
  output.textContent = formatNum(val, ctrl.step);
  const pct = ((val - ctrl.min) / (ctrl.max - ctrl.min)) * 100;
  input.style.setProperty('--fill', `${Math.min(100, Math.max(0, pct))}%`);
}

function formatNum(n, step) {
  if (typeof n !== 'number') return String(n);
  const s = String(step);
  const decimals = s.includes('.') ? Math.min(4, s.length - s.indexOf('.') - 1) : 0;
  return n.toFixed(decimals);
}
