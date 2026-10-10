import {
  store,
  ready,
  subscribe,
  getOpenState,
  getPickupSlots,
} from './data.js?v=20261010-mobileonly1';

const MODAL_ID = 'shopInfoModal';
const TRIGGER_ID = 'profileShopInfo';

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
  const modal = buildModal();
  const trigger = document.getElementById(TRIGGER_ID);
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
