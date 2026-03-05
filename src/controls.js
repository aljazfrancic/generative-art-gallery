export function buildControls(controlDefs, params, onChange) {
  const container = document.createElement('div');
  container.className = 'controls-container';
  const inputs = {};

  for (const ctrl of controlDefs) {
    if (ctrl.type === 'button') continue;

    const group = document.createElement('div');
    group.className = 'control-group';

    if (ctrl.type === 'slider') {
      const valueDisplay = document.createElement('span');
      valueDisplay.className = 'control-value';
      valueDisplay.textContent = formatNum(params[ctrl.key]);

      const label = document.createElement('label');
      label.className = 'control-label';
      label.innerHTML = `<span>${ctrl.label}</span>`;
      label.appendChild(valueDisplay);

      const input = document.createElement('input');
      input.type = 'range';
      input.min = ctrl.min;
      input.max = ctrl.max;
      input.step = ctrl.step;
      input.value = params[ctrl.key];
      input.addEventListener('input', () => {
        const val = parseFloat(input.value);
        params[ctrl.key] = val;
        valueDisplay.textContent = formatNum(val);
        onChange(ctrl.key, val);
      });

      group.appendChild(label);
      group.appendChild(input);
      inputs[ctrl.key] = { input, valueDisplay };
    } else if (ctrl.type === 'color') {
      const label = document.createElement('label');
      label.className = 'control-label';
      label.innerHTML = `<span>${ctrl.label}</span>`;

      const input = document.createElement('input');
      input.type = 'color';
      input.value = params[ctrl.key];
      input.addEventListener('input', () => {
        params[ctrl.key] = input.value;
        onChange(ctrl.key, input.value);
      });

      label.appendChild(input);
      group.appendChild(label);
      inputs[ctrl.key] = { input };
    } else if (ctrl.type === 'toggle') {
      const label = document.createElement('label');
      label.className = 'control-label';
      label.innerHTML = `<span>${ctrl.label}</span>`;

      const toggle = document.createElement('label');
      toggle.className = 'control-toggle';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = params[ctrl.key];
      const track = document.createElement('span');
      track.className = 'toggle-track';
      input.addEventListener('change', () => {
        params[ctrl.key] = input.checked;
        onChange(ctrl.key, input.checked);
      });
      toggle.appendChild(input);
      toggle.appendChild(track);

      label.appendChild(toggle);
      group.appendChild(label);
      inputs[ctrl.key] = { input };
    } else if (ctrl.type === 'select') {
      const label = document.createElement('label');
      label.className = 'control-label';
      label.innerHTML = `<span>${ctrl.label}</span>`;
      group.appendChild(label);

      const select = document.createElement('select');
      select.className = 'control-select';
      for (const opt of ctrl.options) {
        const option = document.createElement('option');
        option.value = opt.value;
        option.textContent = opt.label;
        if (params[ctrl.key] === opt.value) option.selected = true;
        select.appendChild(option);
      }
      select.addEventListener('change', () => {
        params[ctrl.key] = select.value;
        onChange(ctrl.key, select.value);
      });
      group.appendChild(select);
      inputs[ctrl.key] = { input: select };
    }

    container.appendChild(group);
  }

  function updateUI(newParams) {
    for (const ctrl of controlDefs) {
      if (ctrl.type === 'button' || !inputs[ctrl.key]) continue;
      const val = newParams[ctrl.key];
      if (val === undefined) continue;
      params[ctrl.key] = val;
      const { input, valueDisplay } = inputs[ctrl.key];
      if (ctrl.type === 'toggle') {
        input.checked = val;
      } else {
        input.value = val;
      }
      if (valueDisplay) {
        valueDisplay.textContent = formatNum(val);
      }
    }
  }

  return { element: container, updateUI };
}

function formatNum(n) {
  if (typeof n !== 'number') return n;
  return Number.isInteger(n) ? n.toString() : n.toFixed(2);
}
