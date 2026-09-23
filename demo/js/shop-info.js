import { store, ready, subscribe } from './data.js?v=20260922-menulayout1';

const STYLE_ID = 'shopInfoStyles';
const MODAL_ID = 'shopInfoModal';
const TRIGGER_ID = 'btnShopInfo';

function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .shop-info-trigger {
      flex: none;
    }

    .shop-info-modal[hidden] { display: none !important; }
    .shop-info-modal {
      position: fixed;
      inset: 0;
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      background: rgba(25, 17, 13, .48);
      backdrop-filter: blur(2px);
      -webkit-backdrop-filter: blur(2px);
    }

    .shop-info-dialog {
      position: relative;
      width: min(100%, 430px);
      max-height: min(82vh, 680px);
      overflow: auto;
      overscroll-behavior: contain;
      border-radius: 22px;
      background: #fff;
      color: #241914;
      box-shadow: 0 24px 70px rgba(38, 21, 12, .24);
      padding: 24px 22px 22px;
      animation: shopInfoIn .16s ease-out;
    }

    @keyframes shopInfoIn {
      from { opacity: 0; transform: translateY(8px) scale(.985); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }

    .shop-info-close {
      position: absolute;
      top: 14px;
      right: 14px;
      width: 38px;
      height: 38px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border: 0;
      border-radius: 50%;
      background: #f5f1ee;
      color: #4c3a31;
      font: 400 28px/1 Arial, sans-serif;
      cursor: pointer;
    }

    .shop-info-close:active { transform: scale(.96); }
    .shop-info-kicker {
      margin: 0 46px 4px 0;
      color: #f15a00;
      font-size: 12px;
      font-weight: 800;
      letter-spacing: .08em;
      text-transform: uppercase;
    }

    .shop-info-title {
      margin: 0 46px 18px 0;
      font-size: 23px;
      line-height: 1.18;
      font-weight: 850;
      letter-spacing: -.02em;
    }

    .shop-info-list {
      display: grid;
      gap: 0;
      border-top: 1px solid #eee7e2;
    }

    .shop-info-row {
      display: grid;
      grid-template-columns: 34px minmax(0, 1fr);
      gap: 11px;
      align-items: start;
      padding: 14px 0;
      border-bottom: 1px solid #eee7e2;
    }

    .shop-info-row-icon {
      width: 32px;
      height: 32px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 10px;
      background: #fff3ea;
      color: #f15a00;
    }

    .shop-info-row-icon svg {
      width: 18px;
      height: 18px;
      fill: none;
      stroke: currentColor;
      stroke-width: 1.8;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    .shop-info-row-copy { min-width: 0; }
    .shop-info-label {
      display: block;
      margin-bottom: 3px;
      color: #8a7468;
      font-size: 12px;
      font-weight: 700;
    }

    .shop-info-value,
    .shop-info-value:visited {
      display: block;
      color: #2c201a;
      font-size: 15px;
      line-height: 1.42;
      font-weight: 650;
      text-decoration: none;
      overflow-wrap: anywhere;
    }

    a.shop-info-value:hover { text-decoration: underline; text-underline-offset: 3px; }
    body.shop-info-open { overflow: hidden !important; }

    @media (max-width: 420px) {
      .shop-info-modal { padding: 14px; align-items: flex-end; }
      .shop-info-dialog { width: 100%; border-radius: 22px 22px 18px 18px; padding: 22px 19px 20px; }
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

function rowIcon(kind) {
  const icons = {
    address: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s6-5.2 6-11a6 6 0 1 0-12 0c0 5.8 6 11 6 11Z"/><circle cx="12" cy="10" r="2"/></svg>',
    phone: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.1 3.5 4.4 5.1c-.8.5-.9 1.5-.6 2.4 2 5.9 6.8 10.7 12.7 12.7.9.3 1.9.2 2.4-.6l1.6-2.7-4.3-2.1-1.5 2c-3.1-1.4-6.1-4.4-7.5-7.5l2-1.5-2.1-4.3Z"/></svg>',
    email: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/></svg>',
    hours: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></svg>',
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
      <button class="shop-info-close" id="shopInfoClose" type="button" aria-label="Lukk">×</button>
      <p class="shop-info-kicker">Butikkinfo</p>
      <h2 class="shop-info-title" id="shopInfoTitle">KØL Grill &amp; Pizza</h2>
      <div class="shop-info-list">
        <div class="shop-info-row">
          <span class="shop-info-row-icon">${rowIcon('address')}</span>
          <div class="shop-info-row-copy"><span class="shop-info-label">Adresse</span><span class="shop-info-value" id="shopInfoAddress">—</span></div>
        </div>
        <div class="shop-info-row">
          <span class="shop-info-row-icon">${rowIcon('phone')}</span>
          <div class="shop-info-row-copy"><span class="shop-info-label">Telefon</span><a class="shop-info-value" id="shopInfoPhone" href="#">—</a></div>
        </div>
        <div class="shop-info-row">
          <span class="shop-info-row-icon">${rowIcon('email')}</span>
          <div class="shop-info-row-copy"><span class="shop-info-label">E-post</span><a class="shop-info-value" id="shopInfoEmail" href="#">Ikke registrert</a></div>
        </div>
        <div class="shop-info-row">
          <span class="shop-info-row-icon">${rowIcon('hours')}</span>
          <div class="shop-info-row-copy"><span class="shop-info-label">Åpningstider</span><span class="shop-info-value" id="shopInfoHours">—</span></div>
        </div>
      </div>
    </section>`;

  document.body.appendChild(modal);
  return modal;
}

function makeTrigger() {
  let button = document.getElementById(TRIGGER_ID);
  if (button) return button;

  const profileButton = document.getElementById('btnProfile');
  const themeButton = document.getElementById('btnTheme');
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
  actions.insertBefore(button, themeButton || profileButton);
  return button;
}

function cleanPhone(value) {
  return String(value || '').replace(/[^+\d]/g, '');
}

function cleanEmail(value) {
  return String(value || '').trim();
}

function renderShopInfo() {
  const settings = store.settings || {};
  const name = String(settings.restaurantName || 'KØL Grill & Pizza').trim();
  const addressParts = [settings.streetAddress, settings.postalCode, settings.city]
    .map((part) => String(part || '').trim())
    .filter(Boolean);
  const address = addressParts.length ? `${addressParts[0] || ''}${addressParts.length > 1 ? `, ${addressParts.slice(1).join(' ')}` : ''}` : 'Ikke registrert';
  const phone = String(settings.phone || '').trim();
  const email = cleanEmail(settings.email);
  const days = String(settings.openingDays || '').trim();
  const hours = String(settings.openingTime || '').trim();

  const title = document.getElementById('shopInfoTitle');
  const addressEl = document.getElementById('shopInfoAddress');
  const phoneEl = document.getElementById('shopInfoPhone');
  const emailEl = document.getElementById('shopInfoEmail');
  const hoursEl = document.getElementById('shopInfoHours');

  if (title) title.textContent = name;
  if (addressEl) addressEl.textContent = address;

  if (phoneEl) {
    phoneEl.textContent = phone || 'Ikke registrert';
    if (phone) {
      phoneEl.href = `tel:${cleanPhone(phone)}`;
      phoneEl.removeAttribute('aria-disabled');
    } else {
      phoneEl.removeAttribute('href');
      phoneEl.setAttribute('aria-disabled', 'true');
    }
  }

  if (emailEl) {
    emailEl.textContent = email || 'Ikke registrert';
    if (email) {
      emailEl.href = `mailto:${email}`;
      emailEl.removeAttribute('aria-disabled');
    } else {
      emailEl.removeAttribute('href');
      emailEl.setAttribute('aria-disabled', 'true');
    }
  }

  if (hoursEl) {
    hoursEl.textContent = [days, hours].filter(Boolean).join(' · ') || 'Ikke registrert';
  }
}

let lastFocused = null;

function openModal() {
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
