from pathlib import Path
import re

js_path = Path('demo/js/customer.js')
css_path = Path('demo/css/customer.css')
html_path = Path('demo/index.html')
sw_path = Path('demo/service-worker.js')

js = js_path.read_text(encoding='utf-8')

# Keep customer success notifications at exactly 2 seconds.
old_toast = "  toastTimer = setTimeout(() => {\n    el.toast.hidden = true;\n  }, 2200);"
new_toast = "  toastTimer = setTimeout(() => {\n    el.toast.hidden = true;\n  }, 2000);"
if old_toast in js:
    js = js.replace(old_toast, new_toast, 1)
elif new_toast not in js:
    raise SystemExit('Toast timer block not found')

# Turn the plain allergen line into a compact card with readable chips.
old_allergens = """    <div class=\"sheet-allergens\"><strong>Allergener</strong><span>${allergens.length ? allergens.map(escapeHtml).join(' · ') : 'Ingen registrerte allergener.'}</span></div>"""
new_allergens = """    <div class=\"sheet-allergens\" aria-label=\"Allergener\">
      <span class=\"sheet-allergens-label\">Allergener</span>
      <div class=\"sheet-allergen-chips\">
        ${allergens.length
          ? allergens.map((label) => `<span class=\"sheet-allergen-chip\">${ALLERGEN_ICONS[label] || '•'} ${escapeHtml(label)}</span>`).join('')
          : '<span class=\"sheet-allergen-none\">Ingen registrerte allergener</span>'}
      </div>
    </div>"""
if old_allergens in js:
    js = js.replace(old_allergens, new_allergens, 1)
elif 'sheet-allergen-chips' not in js:
    raise SystemExit('Allergen product block not found')

# Product name closes the sheet too.
close_marker = "el.sheetClose.addEventListener('click', closeSheet);\nel.sheetBackdrop.addEventListener('click', closeSheet);"
close_replacement = """el.sheetClose.addEventListener('click', closeSheet);
el.sheetBackdrop.addEventListener('click', closeSheet);
el.sheetTitle.addEventListener('click', closeSheet);
el.sheetTitle.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    closeSheet();
  }
});"""
if "el.sheetTitle.addEventListener('click', closeSheet);" not in js:
    if close_marker not in js:
        raise SystemExit('Sheet close listeners not found')
    js = js.replace(close_marker, close_replacement, 1)

# Favorite feedback after state has actually changed.
if "'Lagt til i favoritter.'" not in js:
    fav_pattern = re.compile(
        r"(el\.sheetFav\.addEventListener\('click', \(\) => \{.*?\n  renderMenu\(\);\n)(\}\);)",
        re.S,
    )
    fav_match = fav_pattern.search(js)
    if not fav_match:
        raise SystemExit('Favorite handler not found')
    fav_insert = "  toast(isFavorite(draft.itemId) ? 'Lagt til i favoritter.' : 'Fjernet fra favoritter.');\n"
    js = js[:fav_match.start()] + fav_match.group(1) + fav_insert + fav_match.group(2) + js[fav_match.end():]

# A second listener only reports the result; the original listener keeps all business logic.
feedback_marker = "// Product-sheet choice feedback"
if feedback_marker not in js:
    input_marker = "el.sheetBody.addEventListener('input', (event) => {"
    feedback_listener = """// Product-sheet choice feedback
el.sheetBody.addEventListener('change', (event) => {
  if (!draft) return;
  const target = event.target;
  const { item } = findItem(draft.itemId);
  if (!item) return;

  if (target.dataset.size) {
    const size = (item.sizes || []).find((entry) => entry.id === target.dataset.size);
    toast(size ? `Størrelse valgt: ${size.label}.` : 'Størrelse oppdatert.');
    return;
  }

  const groupId = target.dataset.group;
  const optionId = target.dataset.option;
  if (!groupId || !optionId) return;
  const group = getItemOptionGroups(item).find((entry) => entry.id === groupId);
  const option = group?.options?.find((entry) => entry.id === optionId);
  if (!option) return;
  const selected = (draft.selections[groupId] || []).includes(optionId);
  toast(`${option.label} ${selected ? 'valgt.' : 'fjernet.'}`);
});

"""
    if input_marker not in js:
        raise SystemExit('Sheet input listener marker not found')
    js = js.replace(input_marker, feedback_listener + input_marker, 1)

js_path.write_text(js, encoding='utf-8')

html = html_path.read_text(encoding='utf-8')
title_old = '<h2 id="sheetTitle">Produkt</h2>'
title_new = '<h2 id="sheetTitle" role="button" tabindex="0" aria-label="Lukk produktdetaljer">Produkt</h2>'
if title_old in html:
    html = html.replace(title_old, title_new, 1)
elif title_new not in html:
    raise SystemExit('Product sheet title not found')
html = re.sub(r'/demo/css/customer\.css\?v=[^\"\']+', '/demo/css/customer.css?v=20260913-1', html, count=1)
html = re.sub(r'/demo/js/customer\.js\?v=[^\"\']+', '/demo/js/customer.js?v=20260913-1', html, count=1)
html_path.write_text(html, encoding='utf-8')

css = css_path.read_text(encoding='utf-8')
marker = '/* ======================== Product sheet interaction polish ======================== */'
if marker not in css:
    css += r'''

/* ======================== Product sheet interaction polish ======================== */
#sheetTitle[role="button"] {
  cursor: pointer;
  border-radius: 8px;
  transition: color .15s ease, background .15s ease;
}
#sheetTitle[role="button"]:hover { color: var(--accent-dark); }
#sheetTitle[role="button"]:focus-visible {
  outline: 2px solid rgba(232, 98, 15, .28);
  outline-offset: 3px;
}

.sheet-allergens {
  display: block !important;
  margin: 12px 0 !important;
  padding: 11px 12px !important;
  border: 1px solid #eadfd8;
  border-radius: 12px;
  background: #fffaf6;
  color: var(--ink-2);
  font-size: 12px;
  line-height: 1.35;
}
.sheet-allergens-label {
  display: block;
  margin: 0 0 7px;
  color: var(--ink);
  font-size: 12px;
  font-weight: 750;
}
.sheet-allergen-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.sheet-allergen-chip,
.sheet-allergen-none {
  display: inline-flex;
  align-items: center;
  min-height: 27px;
  padding: 4px 8px;
  border: 1px solid #eadfd8;
  border-radius: 999px;
  background: #fff;
  color: #6c5549;
  font-size: 11px;
  font-weight: 650;
  line-height: 1.2;
}
.sheet-allergen-none {
  color: var(--ink-2);
  font-weight: 500;
}
@media (max-width: 639px) {
  .sheet-allergens { margin: 9px 0 !important; padding: 9px 10px !important; }
  .sheet-allergens-label { margin-bottom: 6px; font-size: 11.5px; }
  .sheet-allergen-chip,
  .sheet-allergen-none { min-height: 25px; padding: 3px 7px; font-size: 10.5px; }
}
'''
css_path.write_text(css, encoding='utf-8')

sw = sw_path.read_text(encoding='utf-8')
sw = re.sub(r"const CACHE_NAME = 'kol-demo-v\d+';", "const CACHE_NAME = 'kol-demo-v29';", sw, count=1)
sw_path.write_text(sw, encoding='utf-8')
