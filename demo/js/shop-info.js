import {
  store,
  ready,
  subscribe,
  getOpenState,
  getPickupSlots,
} from './data.js?v=20261001-shopinfo1';

const STYLE_ID = 'shopInfoStyles';
const MODAL_ID = 'shopInfoModal';
const TRIGGER_ID = 'profileShopInfo';

function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .shop-info-trigger { flex: none; }
    .shop-info-modal[hidden] { display: none !important; }
    .shop-info-modal {
      position: fixed;
      inset: 0;
      z-index: 10000;
      display: grid;
      place-items: center;
      padding: 20px;
      background: rgba(25, 17, 13, .56);
      backdrop-filter: blur(7px);
      -webkit-backdrop-filter: blur(7px);
    }
    .shop-info-dialog {
      width: min(100%, 520px);
      max-height: min(88vh, 760px);
      overflow: auto;
      overscroll-behavior: contain;
      border: 1px solid rgba(69, 48, 37, .08);
      border-radius: 24px;
      background: #fff;
      color: #241914;
      box-shadow: 0 28px 90px rgba(38, 21, 12, .30);
      animation: shopInfoIn .18s ease-out;
    }
    @keyframes shopInfoIn {
      from { opacity: 0; transform: translateY(10px) scale(.985); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }
    .shop-info-hero {
      position: relative;
      padding: 24px 58px 20px 22px;
      background:
        radial-gradient(circle at top right, rgba(242, 101, 15, .16), transparent 42%),
        linear-gradient(145deg, #fffaf6 0%, #fff 70%);
      border-bottom: 1px solid #eee6e1;
    }
    .shop-info-close {
      position: absolute;
      top: 14px;
      right: 14px;
      width: 38px;
      height: 38px;
      display: grid;
      place-items: center;
      border: 1px solid #eadfd9;
      border-radius: 12px;
      background: rgba(255,255,255,.82);
      color: #49362d;
      font: 400 25px/1 Arial, sans-serif;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(48, 30, 20, .06);
    }
    .shop-info-brandline {
      display: flex;
      align-items: center;
      gap: 12px;
      min-width: 0;
    }
    .shop-info-mark {
      width: 44px;
      height: 44px;
      flex: none;
      display: grid;
      place-items: center;
      border-radius: 14px;
      background: #f2650f;
      color: #fff;
      box-shadow: 0 8px 18px rgba(242, 101, 15, .22);
    }
    .shop-info-mark svg { width: 24px; height: 24px; }
    .shop-info-kicker {
      margin: 0 0 2px;
      color: #9d7f6f;
      font-size: 10px;
      font-weight: 800;
      letter-spacing: .10em;
      text-transform: uppercase;
    }
    .shop-info-title {
      margin: 0;
      font-size: 22px;
      line-height: 1.15;
      font-weight: 850;
      letter-spacing: -.025em;
    }
    .shop-info-status {
      margin-top: 16px;
      display: flex;
      align-items: center;
      gap: 9px;
      min-height: 40px;
      padding: 9px 12px;
      border-radius: 12px;
      background: #eefaf2;
      color: #166a37;
      font-size: 12.5px;
      font-weight: 750;
    }
    .shop-info-status[data-open="false"] {
      background: #fff2f0;
      color: #b73b31;
    }
    .shop-info-status-dot {
      width: 9px;
      height: 9px;
      flex: none;
      border-radius: 50%;
      background: currentColor;
      box-shadow: 0 0 0 4px color-mix(in srgb, currentColor 13%, transparent);
    }
    .shop-info-content { padding: 18px 22px 22px; }
    .shop-info-section + .shop-info-section { margin-top: 18px; }
    .shop-info-section-title {
      margin: 0 0 9px;
      color: #7f6a5e;
      font-size: 10.5px;
      font-weight: 850;
      letter-spacing: .08em;
      text-transform: uppercase;
    }
    .shop-info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 9px;
    }
    .shop-info-card {
      min-width: 0;
      padding: 13px;
      border: 1px solid #ece4df;
      border-radius: 14px;
      background: #fcfbfa;
    }
    .shop-info-card.is-wide { grid-column: 1 / -1; }
    .shop-info-card-head {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 6px;
      color: #947a6c;
      font-size: 11px;
      font-weight: 750;
    }
    .shop-info-card-head svg {
      width: 17px;
      height: 17px;
      flex: none;
      color: #f2650f;
    }
    .shop-info-value,
    .shop-info-value:visited {
      display: block;
      color: #2e211b;
      font-size: 14px;
      line-height: 1.42;
      font-weight: 700;
      text-decoration: none;
      overflow-wrap: anywhere;
    }
    .shop-info-subvalue {
      display: block;
      margin-top: 3px;
      color: #8c776b;
      font-size: 11.5px;
      line-height: 1.42;
    }
    a.shop-info-value:hover { text-decoration: underline; text-underline-offset: 3px; }
    .shop-info-times {
      display: flex;
      gap: 6px;
      overflow-x: auto;
      padding: 1px 0 2px;
      scrollbar-width: none;
    }
    .shop-info-times::-webkit-scrollbar { display: none; }
    .shop-info-time {
      flex: none;
      min-width: 58px;
      padding: 7px 10px;
      border: 1px solid #f2d1bc;
      border-radius: 999px;
      background: #fff6ef;
      color: #d55a0b;
      font-size: 11.5px;
      font-weight: 800;
      text-align: center;
    }
    .shop-info-time.is-asap {
      background: #f2650f;
      border-color: #f2650f;
      color: #fff;
    }
    .shop-info-empty-time {
      color: #8f7a6e;
      font-size: 12px;
      font-weight: 650;
    }
    .shop-info-actions {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      margin-top: 18px;
    }
    .shop-info-action,
    .shop-info-action:visited {
      min-height: 42px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 7px;
      border: 1px solid #e7ddd7;
      border-radius: 12px;
      background: #fff;
      color: #34251e;
      font-size: 12px;
      font-weight: 800;
      text-decoration: none;
    }
    .shop-info-action.is-primary {
      border-color: #f2650f;
      background: #f2650f;
      color: #fff;
    }
    .shop-info-action[hidden] { display: none !important; }
    .shop-info-action svg { width: 16px; height: 16px; }
    body.shop-info-open { overflow: hidden !important; }

    html[data-theme="dark"] .shop-info-dialog {
      border-color: #44362f;
      background: #201814;
      color: #f7f1ed;
    }
    html[data-theme="dark"] .shop-info-hero {
      background:
        radial-gradient(circle at top right, rgba(242, 101, 15, .18), transparent 42%),
        linear-gradient(145deg, #2a1e19 0%, #201814 70%);
      border-bottom-color: #3b2d27;
    }
    html[data-theme="dark"] .shop-info-close {
      border-color: #4a3931;
      background: #2d211c;
      color: #f5ece7;
    }
    html[data-theme="dark"] .shop-info-kicker,
    html[data-theme="dark"] .shop-info-section-title,
    html[data-theme="dark"] .shop-info-card-head,
    html[data-theme="dark"] .shop-info-subvalue,
    html[data-theme="dark"] .shop-info-empty-time {
      color: #bba89e;
    }
    html[data-theme="dark"] .shop-info-card {
      border-color: #42332c;
      background: #281e19;
    }
    html[data-theme="dark"] .shop-info-value,
    html[data-theme="dark"] .shop-info-value:visited {
      color: #f8f2ee;
    }
    html[data-theme="dark"] .shop-info-action {
      border-color: #4a3931;
      background: #2a201b;
      color: #f6efeb;
    }
    html[data-theme="dark"] .shop-info-time {
      border-color: #70432b;
      background: #342319;
      color: #ffad76;
    }
    html[data-theme="dark"] .shop-info-time.is-asap {
      background: #f2650f;
      border-color: #f2650f;
      color: #fff;
    }

    @media (max-width: 520px) {
      .shop-info-modal {
        padding: 0;
        place-items: end center;
      }
      .shop-info-dialog {
        width: 100%;
        max-height: 90vh;
        border-radius: 24px 24px 0 0;
        border-bottom: 0;
      }
      .shop-info-grid { grid-template-columns: 1fr; }
      .shop-info-card.is-wide { grid-column: auto; }
      .shop-info-actions { position: sticky; bottom: 0; padding-top: 10px; background: inherit; }
    }
  `;
  document.head.appendChild(style);
}

function storeIcon() {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 10.2V20h16v-9.8"/>
      <path d="M3 9.2 5.2 4h13.6L21 9.2"/>
      <path d="M3 9.2c0 1.4 1 2.5 2.4 2.5S8 10.6 8 9.2c0 1.4 1 2.5 2.5 2.5S13 10.6 13 9.2c0 1.4 1 2.5 2.5 2.5S18 10.6 18 9.2c0 1.4 1 2.5 2.5 2.5"/>
      <path d="M8.2 20v-5h7.6v5"/>
    </svg>`;
}

function icon(kind) {
  const icons = {
    hours: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></svg>',
    pickup: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8h14l-1 12H6L5 8Z"/><path d="M8 8a4 4 0 0 1 8 0"/></svg>',
    address: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s6-5.2 6-11a6 6 0 1 0-12 0c0 5.8 6 11 6 11Z"/><circle cx="12" cy="10" r="2"/></svg>',
    phone: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.1 3.5 4.4 5.1c-.8.5-.9 1.5-.6 2.4 2 5.9 6.8 10.7 12.7 12.7.9.3 1.9.2 2.4-.6l1.6-2.7-4.3-2.1-1.5 2c-3.1-1.4-6.1-4.4-7.5-7.5l2-1.5-2.1-4.3Z"/></svg>',
    payment: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 9h18M7 15h4"/></svg>',
    order: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h10"/></svg>',
    map: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18-6 3V6l6-3 6 3 6-3v15l-6 3-6-3Z"/><path d="M9 3v15M15 6v15"/></svg>',
  };
  return icons[kind] || '';
}

function buildModal() {
  if (document.getElementById(MODAL_ID)) return document.getElementById(MODAL_ID);

  const modal = document.createElement('div');
  modal.className = 'shop-info-modal';
  modal.id = MODAL_ID;
  modal.hidden = true;
  modal.innerHTML = `
    <section class="shop-info-dialog" role="dialog" aria-modal="true" aria-labelledby="shopInfoTitle">
      <div class="shop-info-hero">
        <button class="shop-info-close" id="shopInfoClose" type="button" aria-label="Lukk">×</button>
        <div class="shop-info-brandline">
          <span class="shop-info-mark">${storeIcon()}</span>
          <div>
            <p class="shop-info-kicker">Restaurantinformasjon</p>
            <h2 class="shop-info-title" id="shopInfoTitle">KØL Grill &amp; Pizza</h2>
          </div>
        </div>
        <div class="shop-info-status" id="shopInfoStatus" data-open="true">
          <span class="shop-info-status-dot" aria-hidden="true"></span>
          <span id="shopInfoStatusText">—</span>
        </div>
      </div>

      <div class="shop-info-content">
        <section class="shop-info-section">
          <h3 class="shop-info-section-title">Bestilling & henting</h3>
          <div class="shop-info-grid">
            <div class="shop-info-card">
              <div class="shop-info-card-head">${icon('hours')}<span>Bestillingstider</span></div>
              <span class="shop-info-value" id="shopInfoHours">—</span>
              <span class="shop-info-subvalue" id="shopInfoDays">—</span>
            </div>
            <div class="shop-info-card">
              <div class="shop-info-card-head">${icon('pickup')}<span>Estimert hentetid</span></div>
              <span class="shop-info-value" id="shopInfoPrep">—</span>
              <span class="shop-info-subvalue" id="shopInfoPickupInfo">—</span>
            </div>
            <div class="shop-info-card is-wide">
              <div class="shop-info-card-head">${icon('order')}<span>Neste hentetider</span></div>
              <div class="shop-info-times" id="shopInfoTimes"></div>
            </div>
          </div>
        </section>

        <section class="shop-info-section">
          <h3 class="shop-info-section-title">Praktisk informasjon</h3>
          <div class="shop-info-grid">
            <div class="shop-info-card is-wide">
              <div class="shop-info-card-head">${icon('address')}<span>Adresse</span></div>
              <a class="shop-info-value" id="shopInfoAddress" href="#" target="_blank" rel="noopener">—</a>
            </div>
            <div class="shop-info-card">
              <div class="shop-info-card-head">${icon('phone')}<span>Telefon</span></div>
              <a class="shop-info-value" id="shopInfoPhone" href="#">—</a>
            </div>
            <div class="shop-info-card">
              <div class="shop-info-card-head">${icon('payment')}<span>Betaling</span></div>
              <span class="shop-info-value" id="shopInfoPayment">—</span>
            </div>
          </div>
        </section>

        <div class="shop-info-actions">
          <a class="shop-info-action is-primary" id="shopInfoCall" href="#">${icon('phone')} Ring restauranten</a>
          <a class="shop-info-action" id="shopInfoMap" href="#" target="_blank" rel="noopener">${icon('map')} Vis adresse</a>
        </div>
      </div>
    </section>`;

  document.body.appendChild(modal);
  return modal;
}

function makeTrigger() {
  return document.getElementById(TRIGGER_ID);
}


function cleanPhone(value) {
  return String(value || '').replace(/[^+\d]/g, '');
}

function addressText(settings) {
  const street = String(settings.streetAddress || '').trim();
  const postalCity = [settings.postalCode, settings.city]
    .map((part) => String(part || '').trim())
    .filter(Boolean)
    .join(' ');
  return [street, postalCity].filter(Boolean).join(', ') || 'Ikke registrert';
}

function setLinkState(node, href, text) {
  if (!node) return;
  node.textContent = text;
  if (href) {
    node.href = href;
    node.removeAttribute('aria-disabled');
  } else {
    node.removeAttribute('href');
    node.setAttribute('aria-disabled', 'true');
  }
}

function renderShopInfo() {
  const settings = store.settings || {};
  const enabled = settings.shopInfoEnabled !== false;
  const trigger = document.getElementById(TRIGGER_ID);
  const modal = document.getElementById(MODAL_ID);

  if (trigger) {
    trigger.hidden = !enabled;
    trigger.style.display = enabled ? '' : 'grid';
  }
  if (!enabled && modal && !modal.hidden) closeModal();
  if (!enabled) return;

  const state = getOpenState();
  const slots = getPickupSlots();
  const name = String(settings.restaurantName || 'KØL Grill & Pizza').trim();
  const address = addressText(settings);
  const phone = String(settings.phone || '').trim();
  const orderOpen = String(settings.orderOpenTime || '').trim();
  const orderClose = String(settings.orderCloseTime || '').trim();
  const days = String(settings.openingDays || '').trim();
  const prep = Math.max(0, Number(settings.prepMinutes) || 0);
  const pickupInfo = String(settings.pickupInfo || 'Henting i restauranten').trim();
  const payment = String(settings.paymentInfo || 'Betaling ved henting').trim();
  const mapHref =
    address && address !== 'Ikke registrert'
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
      : '';

  const title = document.getElementById('shopInfoTitle');
  const status = document.getElementById('shopInfoStatus');
  const statusText = document.getElementById('shopInfoStatusText');
  const hours = document.getElementById('shopInfoHours');
  const daysEl = document.getElementById('shopInfoDays');
  const prepEl = document.getElementById('shopInfoPrep');
  const pickupEl = document.getElementById('shopInfoPickupInfo');
  const timesEl = document.getElementById('shopInfoTimes');
  const addressEl = document.getElementById('shopInfoAddress');
  const phoneEl = document.getElementById('shopInfoPhone');
  const paymentEl = document.getElementById('shopInfoPayment');
  const callEl = document.getElementById('shopInfoCall');
  const mapEl = document.getElementById('shopInfoMap');

  if (title) title.textContent = name;
  if (status) status.dataset.open = String(state.open);
  if (statusText) {
    statusText.textContent = state.open
      ? `Åpent for bestilling · stenger ${state.closesAt}`
      : state.reason === 'manuelt'
        ? 'Midlertidig stengt for bestilling'
        : `Stengt nå · åpner ${state.opensAt}`;
  }
  if (hours) hours.textContent = orderOpen && orderClose ? `${orderOpen}–${orderClose}` : 'Ikke registrert';
  if (daysEl) daysEl.textContent = days || 'Åpningsdager ikke registrert';
  if (prepEl) prepEl.textContent = prep ? `Ca. ${prep} min` : 'Snarest mulig';
  if (pickupEl) pickupEl.textContent = pickupInfo || 'Henting i restauranten';
  if (paymentEl) paymentEl.textContent = payment || 'Ikke registrert';

  if (timesEl) {
    if (slots.length) {
      timesEl.innerHTML = slots
        .slice(0, 7)
        .map((slot, index) => {
          const asap = index === 0 && String(slot.label || '').toLocaleLowerCase('no').includes('snarest');
          return `<span class="shop-info-time${asap ? ' is-asap' : ''}">${String(slot.label || '')}</span>`;
        })
        .join('');
    } else {
      timesEl.innerHTML = '<span class="shop-info-empty-time">Ingen hentetider tilgjengelig akkurat nå.</span>';
    }
  }

  if (addressEl) {
    addressEl.textContent = address;
    if (mapHref) {
      addressEl.href = mapHref;
      addressEl.removeAttribute('aria-disabled');
    } else {
      addressEl.removeAttribute('href');
      addressEl.setAttribute('aria-disabled', 'true');
    }
  }

  const phoneHref = phone ? `tel:${cleanPhone(phone)}` : '';
  setLinkState(phoneEl, phoneHref, phone || 'Ikke registrert');

  if (callEl) {
    callEl.hidden = !phoneHref;
    if (phoneHref) callEl.href = phoneHref;
  }
  if (mapEl) {
    mapEl.hidden = !mapHref;
    if (mapHref) mapEl.href = mapHref;
  }
}

let lastFocused = null;

function openModal() {
  if (store.settings?.shopInfoEnabled === false) return;
  const modal = document.getElementById(MODAL_ID);
  if (!modal) return;
  lastFocused = document.activeElement;
  renderShopInfo();
  modal.hidden = false;
  document.body.classList.add('shop-info-open');
  requestAnimationFrame(() => document.getElementById('shopInfoClose')?.focus());
}

function closeModal() {
  const modal = document.getElementById(MODAL_ID);
  if (!modal || modal.hidden) return;
  modal.hidden = true;
  document.body.classList.remove('shop-info-open');
  if (lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus();
}

function init() {
  injectStyles();
  const modal = buildModal();
  const trigger = makeTrigger();
  if (!modal || !trigger) return;

  trigger.addEventListener('click', openModal);
  document.getElementById('shopInfoClose')?.addEventListener('click', closeModal);

  modal.addEventListener('click', (event) => {
    if (event.target === modal) closeModal();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !modal.hidden) closeModal();
  });

  subscribe(renderShopInfo);
  ready().then(renderShopInfo).catch(renderShopInfo);
  renderShopInfo();
}

init();
