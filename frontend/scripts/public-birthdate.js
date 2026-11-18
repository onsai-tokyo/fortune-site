// Progressive enhancement: retain the original input ID/value for the calculators.
// Without JavaScript, the native date input remains available.
export function birthDateError(parts, { min = '1900-01-01', max, required = true } = {}) {
  if (parts.every(part => !part) && !required) return '';
  if (parts.some(part => !part)) return '年・月・日をすべて選んでください。';
  const [year, month, day] = parts.map(Number);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return '実在する生年月日を選んでください。';
  const value = parts.join('-');
  if (value < min || (max && value > max)) return '選択できる範囲の生年月日を選んでください。';
  return '';
}

export function enhanceBirthDates(root = document) {
  const now = new Date();
  const today = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');
  for (const input of root.querySelectorAll('input[type="date"]:not([data-birthdate-enhanced])')) {
    if (input.disabled) continue;
    const required = input.required;
    const label = input.labels?.[0];
    const fieldset = document.createElement('fieldset');
    fieldset.className = 'birth-date-fields';
    const legend = document.createElement('legend');
    legend.textContent = label?.textContent.trim() || '生年月日';
    fieldset.append(legend);
    const grid = document.createElement('div');
    grid.className = 'birth-date-parts';
    fieldset.append(grid);
    const originalParts = input.value.split('-');
    const currentYear = now.getFullYear();
    const firstYear = Math.max(1900, Number(input.min.slice(0, 4)) || 1900);
    const lastYear = Math.min(currentYear, Number(input.max.slice(0, 4)) || currentYear);
    const fields = ['年', '月', '日'].map((unit, index) => {
      const wrapper = document.createElement('label');
      const caption = document.createElement('span');
      caption.className = 'field-label';
      caption.textContent = `生まれた${unit}`;
      const select = document.createElement('select');
      select.id = `${input.id}-${['year', 'month', 'day'][index]}`;
      select.required = required;
      select.autocomplete = ['bday-year', 'bday-month', 'bday-day'][index];
      select.setAttribute('aria-label', `生まれた${unit}`);
      select.add(new Option(unit, ''));
      const values = index === 0
        ? Array.from({ length: lastYear - firstYear + 1 }, (_, i) => lastYear - i)
        : Array.from({ length: index === 1 ? 12 : 31 }, (_, i) => i + 1);
      for (const value of values) select.add(new Option(`${value}${unit}`, index === 0 ? String(value) : String(value).padStart(2, '0')));
      select.value = originalParts[index] || '';
      wrapper.append(caption, select);
      grid.append(wrapper);
      return select;
    });
    label?.remove();
    input.after(fieldset);
    // Only the visible selects participate in native form validation.
    // All existing calculator scripts still read the original input's value.
    input.hidden = true;
    input.disabled = true;
    input.dataset.birthdateEnhanced = 'true';
    let syncing = false;
    const sync = () => {
      const parts = fields.map(field => field.value);
      const error = birthDateError(parts, { min: input.min || '1900-01-01', max: input.max || today, required });
      fields[2].setCustomValidity(parts.every(Boolean) ? error : '');
      input.value = error ? '' : parts.join('-');
      syncing = true;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      syncing = false;
    };
    for (const field of fields) field.addEventListener('change', sync);
    input.addEventListener('change', () => {
      if (syncing) return;
      const parts = input.value.split('-');
      fields.forEach((field, index) => { field.value = parts[index] || ''; });
      sync();
    });
    input.form?.addEventListener('reset', () => queueMicrotask(sync));
    sync();
  }
}

if (typeof document !== 'undefined') enhanceBirthDates();
