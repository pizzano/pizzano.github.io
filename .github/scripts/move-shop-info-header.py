from pathlib import Path

JS = Path('demo/js/shop-info.js')
HTML = Path('demo/index.html')

js = JS.read_text(encoding='utf-8')
html = HTML.read_text(encoding='utf-8')

old_trigger_css = '''    .menu-overview-actions {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 8px;
      margin-left: auto;
      flex: 0 0 auto;
    }

    .shop-info-trigger {
      width: 44px;
      height: 44px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex: 0 0 44px;
      border: 1px solid #e3dbd6;
      border-radius: 14px;
      background: #fff;
      color: #5f493d;
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
      transition: transform .14s ease, background .14s ease, border-color .14s ease;
    }

    .shop-info-trigger:hover { background: #fff8f3; border-color: #d8cbc3; }
    .shop-info-trigger:active { transform: scale(.96); }
    .shop-info-trigger:focus-visible { outline: 3px solid rgba(255, 96, 0, .22); outline-offset: 2px; }
    .shop-info-trigger svg {
      width: 22px;
      height: 22px;
      fill: none;
      stroke: currentColor;
      stroke-width: 1.8;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
'''

new_trigger_css = '''    .shop-info-trigger {
      flex: none;
    }
'''

if old_trigger_css not in js:
    raise SystemExit('trigger css block not found')
js = js.replace(old_trigger_css, new_trigger_css, 1)

old_mobile_css = '''      .menu-overview-actions { gap: 6px; }
      .shop-info-trigger { width: 40px; height: 40px; flex-basis: 40px; border-radius: 13px; }
      .shop-info-trigger svg { width: 20px; height: 20px; }
      .shop-info-modal { padding: 14px; align-items: flex-end; }
'''
new_mobile_css = '''      .shop-info-modal { padding: 14px; align-items: flex-end; }
'''
if old_mobile_css not in js:
    raise SystemExit('mobile trigger css block not found')
js = js.replace(old_mobile_css, new_mobile_css, 1)

old_make_trigger = '''function makeTrigger() {
  let button = document.getElementById(TRIGGER_ID);
  if (button) return button;

  const allergenButton = document.getElementById('btnAllergens');
  const row = allergenButton?.closest('.menu-overview-row');
  if (!allergenButton || !row) return null;

  let actions = row.querySelector('.menu-overview-actions');
  if (!actions) {
    actions = document.createElement('div');
    actions.className = 'menu-overview-actions';
    row.insertBefore(actions, allergenButton);
    actions.appendChild(allergenButton);
  }

  button = document.createElement('button');
  button.className = 'shop-info-trigger';
  button.id = TRIGGER_ID;
  button.type = 'button';
  button.setAttribute('aria-label', 'Butikkinfo');
  button.setAttribute('aria-haspopup', 'dialog');
  button.setAttribute('aria-controls', MODAL_ID);
  button.innerHTML = storeIcon();
  actions.insertBefore(button, allergenButton);
  return button;
}
'''

new_make_trigger = '''function makeTrigger() {
  let button = document.getElementById(TRIGGER_ID);
  if (button) return button;

  const profileButton = document.getElementById('btnProfile');
  const actions = profileButton?.closest('.hdr-actions');
  if (!profileButton || !actions) return null;

  button = document.createElement('button');
  button.className = 'hdr-btn shop-info-trigger';
  button.id = TRIGGER_ID;
  button.type = 'button';
  button.setAttribute('aria-label', 'Butikkinfo');
  button.setAttribute('aria-haspopup', 'dialog');
  button.setAttribute('aria-controls', MODAL_ID);
  button.innerHTML = storeIcon();
  actions.insertBefore(button, profileButton);
  return button;
}
'''

if old_make_trigger not in js:
    raise SystemExit('makeTrigger block not found')
js = js.replace(old_make_trigger, new_make_trigger, 1)

old_version = '/demo/js/shop-info.js?v=20260917-shopinfo1'
new_version = '/demo/js/shop-info.js?v=20260917-shopinfo2'
if old_version not in html:
    raise SystemExit('shop info script version not found')
html = html.replace(old_version, new_version, 1)

JS.write_text(js, encoding='utf-8')
HTML.write_text(html, encoding='utf-8')
