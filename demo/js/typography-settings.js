/* Shared live typography: Firebase menu.settings is the single source. */
import { store, subscribe, ready, mutate } from './data.js?v=20261103-polling-optim1';

const fields = [
  ['uiFontXs', '--text-xs', 10],
  ['uiFontSm', '--text-sm', 12],
  ['uiFontMd', '--text-md', 14],
  ['uiFontLg', '--text-lg', 18],
];
const clamp = (value, fallback) => {
  const n = Number(value);
  return Number.isFinite(n) && n >= 8 && n <= 30 ? Math.round(n) : fallback;
};
let editing = false;
function apply(settings = {}) {
  for (const [key, variable, fallback] of fields) {
    const n = clamp(settings[key], fallback);
    document.documentElement.style.setProperty(variable, n + 'px');
    const input = document.querySelector('[data-ui-font="' + key + '"]');
    if (input && !editing && document.activeElement !== input) input.value = String(n);
  }
}
apply();
subscribe(() => apply(store.settings));
ready().then(() => apply(store.settings)).catch(() => apply());
const controls = [...document.querySelectorAll('[data-ui-font]')];
const status = document.getElementById('uiFontStatus');
if (controls.length) {
  controls.forEach(input => {
    input.addEventListener('focus', () => { editing = true; });
    input.addEventListener('input', () => {
      const values = Object.fromEntries(controls.map((field,i) =>
        [fields[i][0], clamp(field.value, fields[i][2])]));
      fields.forEach(([key,variable]) => document.documentElement.style.setProperty(variable, values[key] + 'px'));
      if (status) status.textContent = 'Forhåndsvisning – lagres når du endrer feltet.';
    });
    input.addEventListener('change', () => {
      const values = Object.fromEntries(controls.map((field,i) =>
        [fields[i][0], clamp(field.value, fields[i][2])]));
      const sorted = Object.values(values);
      if (!sorted.every((v,i) => i === 0 || v > sorted[i-1])) {
        if (status) status.textContent = 'Størrelsene må øke fra ekstra liten til stor.';
        input.setCustomValidity('Størrelsene må være stigende.');
        input.reportValidity();
        return;
      }
      controls.forEach(field => field.setCustomValidity(''));
      mutate(state => { Object.assign(state.settings, values); });
      controls.forEach((field,i) => { field.value = String(sorted[i]); });
      if (status) status.textContent = 'Endringene synkroniseres med Firebase. «Lagre endringer» kan også brukes.';
    });
    input.addEventListener('blur', () => { editing = controls.some(field => document.activeElement === field); });
  });
}
