/* Five semantic type sizes for both customer and admin, stored in Firebase.
   One implementation owns loading, live preview, validation and saving. */
import { store, subscribe, ready, mutate, saveNow, onStatus } from './data.js?v=20261104-emerald-gold2';

const FONTS = [
  { key: 'uiFontXs', css: '--text-xs', fallback: 10 },
  { key: 'uiFontSm', css: '--text-sm', fallback: 12 },
  { key: 'uiFontMd', css: '--text-md', fallback: 14 },
  { key: 'uiFontLg', css: '--text-lg', fallback: 18 },
  { key: 'uiFontXl', css: '--text-xl', fallback: 22 },
];
const MIN_FONT = 8;
const MAX_FONT = 36;
const controls = new Map(
  [...document.querySelectorAll('[data-ui-font]')]
    .map(input => [input.dataset.uiFont, input])
);
const status = document.getElementById('uiFontStatus');
const saveButton = document.getElementById('btnSaveUiTypography');
let draftDirty = false;
let savePending = false;
let saving = false;

function fontNumber(value, fallback) {
  if (value === null || value === undefined || String(value).trim() === '') return fallback;
  const number = Number(value);
  return Number.isFinite(number) && number >= MIN_FONT && number <= MAX_FONT
    ? Math.round(number) : fallback;
}

function currentValues(settings = {}) {
  return Object.fromEntries(FONTS.map(({ key, fallback }) =>
    [key, fontNumber(settings[key], fallback)]));
}

function applyValues(values) {
  for (const { key, css } of FONTS) {
    document.documentElement.style.setProperty(css, values[key] + 'px');
  }
}

function syncSavedValues() {
  if (draftDirty) return; // Never overwrite an actively edited preview.
  const values = currentValues(store.settings);
  applyValues(values);
  for (const { key } of FONTS) {
    const control = controls.get(key);
    if (control && control !== document.activeElement) {
      control.value = String(values[key]);
    }
  }
}

function showStatus(message, tone = '') {
  if (!status) return;
  status.textContent = message;
  status.dataset.status = tone;
}

function readDraft() {
  const values = currentValues(store.settings);
  for (const { key } of FONTS) {
    const input = controls.get(key);
    if (!input) continue;
    const raw = input.value.trim();
    const num = Number(raw);
    const valid = raw !== '' && Number.isInteger(num) && num >= MIN_FONT && num <= MAX_FONT;
    input.setCustomValidity(valid ? '' : 'Velg et helt antall piksler fra 8 til 36.');
    if (!valid) return null;
    values[key] = num;
  }
  return values;
}

function previewDraft() {
  draftDirty = true;
  const draft = readDraft();
  if (!draft) {
    showStatus('Skriv et helt tall mellom 8 og 36 px i hvert felt.', 'error');
    return;
  }
  applyValues(draft);
  showStatus('Forhåndsvisning vises nå. Endringene lagres når du går ut av feltet.', 'preview');
}

function commitDraft() {
  if (!draftDirty) return true;
  const values = readDraft();
  if (!values) {
    showStatus('Kontroller feltene: 8–36 px, kun hele tall.', 'error');
    return false;
  }
  draftDirty = false;
  applyValues(values);
  const current = currentValues(store.settings);
  for (const { key } of FONTS) controls.get(key).value = String(values[key]);
  if (FONTS.some(({ key }) => values[key] !== current[key])) {
    savePending = true;
    mutate(state => {
      Object.assign(state.settings, values);
    }); // Uses the existing 1-second Firebase autosave, no second write path.
    showStatus('Lagrer skriftstørrelsene i Firebase…', 'saving');
  } else {
    showStatus('Ingen endringer å lagre.', 'saved');
  }
  return true;
}

syncSavedValues();
subscribe(() => { if (!draftDirty) syncSavedValues(); });
ready().then(() => { if (!draftDirty) syncSavedValues(); })
  .catch(() => { if (!draftDirty) syncSavedValues(); });

if (controls.size) {
  for (const input of controls.values()) {
    input.addEventListener('input', previewDraft);
    input.addEventListener('change', commitDraft);
    input.addEventListener('blur', () => { if (draftDirty) commitDraft(); });
  }
  onStatus(({ state }) => {
    if (!savePending) return;
    if (state === 'saved') {
      savePending = false;
      showStatus('Skriftstørrelsene er lagret i Firebase og brukes i begge visninger.', 'saved');
    } else if (state === 'error') {
      showStatus('Kunne ikke lagre. Kontroller forbindelsen og prøv igjen.', 'error');
    }
  });
  saveButton?.addEventListener('click', async () => {
    if (saving || !commitDraft()) return;
    saving = true;
    saveButton.disabled = true;
    showStatus('Lagrer skriftstørrelsene i Firebase…', 'saving');
    try {
      const ok = await saveNow();
      savePending = !ok;
      showStatus(ok
        ? 'Skriftstørrelsene er lagret i Firebase og brukes i begge visninger.'
        : 'Lagringen feilet. Prøv igjen.', ok ? 'saved' : 'error');
    } catch {
      savePending = true;
      showStatus('Kunne ikke lagre. Prøv igjen.', 'error');
    } finally {
      saving = false;
      saveButton.disabled = false;
    }
  });
}
