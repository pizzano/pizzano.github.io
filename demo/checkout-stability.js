/*
 * CHECKOUT PICKUP STABILITY
 * TEST MODE: time restrictions are temporarily disabled while the checkout is being tested.
 * Restore normal clock-based availability before production launch.
 */
(() => {
  if (window.__KOL_CHECKOUT_STABILITY__) return;
  window.__KOL_CHECKOUT_STABILITY__ = true;

  const PICKUP_TEST_MODE = true;
  let pickupDayOffset = 0;

  const parseClock = (value, fallback) => {
    const match = String(value || fallback).match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return fallback.split(':').map(Number);
    return [Math.min(23, Number(match[1])), Math.min(59, Number(match[2]))];
  };

  const roundUpQuarter = date => {
    const rounded = new Date(date);
    rounded.setSeconds(0, 0);
    const remainder = rounded.getMinutes() % 15;
    if (remainder) rounded.setMinutes(rounded.getMinutes() + (15 - remainder));
    return rounded;
  };

  function pickupWindow() {
    const now = new Date();
    const [openHour, openMinute] = parseClock(activeSiteSettings.orderOpenTime, '14:00');
    const [closeHour, closeMinute] = parseClock(activeSiteSettings.orderCloseTime, '22:00');

    let open = new Date(now);
    let close = new Date(now);
    open.setHours(openHour, openMinute, 0, 0);
    close.setHours(closeHour, closeMinute, 0, 0);

    if (PICKUP_TEST_MODE) {
      pickupDayOffset = 0;
      const slots = [];
      for (let cursor = new Date(open); cursor < close; cursor.setMinutes(cursor.getMinutes() + 15)) {
        slots.push(`${String(cursor.getHours()).padStart(2, '0')}:${String(cursor.getMinutes()).padStart(2, '0')}`);
      }
      return { slots, asapAvailable: true, dayOffset: 0 };
    }

    const lead = Math.max(0, Number(activeSiteSettings.minPreorderMinutes) || 0);
    let asapAvailable = now >= open && now < close;
    let start = roundUpQuarter(new Date(now.getTime() + lead * 60000));
    pickupDayOffset = 0;

    if (now < open) {
      start = new Date(open);
      asapAvailable = false;
    } else if (now >= close || start >= close) {
      pickupDayOffset = 1;
      open = new Date(open);
      close = new Date(close);
      open.setDate(open.getDate() + 1);
      close.setDate(close.getDate() + 1);
      start = new Date(open);
      asapAvailable = false;
    } else if (start < open) {
      start = new Date(open);
    }

    const slots = [];
    for (let cursor = new Date(start); cursor < close; cursor.setMinutes(cursor.getMinutes() + 15)) {
      slots.push(`${String(cursor.getHours()).padStart(2, '0')}:${String(cursor.getMinutes()).padStart(2, '0')}`);
    }

    return { slots, asapAvailable, dayOffset: pickupDayOffset };
  }

  pickupSlots = () => pickupWindow().slots;

  renderPickupTimes = function renderPickupTimesStable() {
    const host = $('#pickupOptions');
    if (!host) return;

    const windowInfo = pickupWindow();
    const slots = windowInfo.slots;
    const selectedTime = String(state.checkout.pickupChoice || '');

    if (/^\d{2}:\d{2}$/.test(selectedTime) && !slots.includes(selectedTime)) {
      state.checkout.pickupChoice = '';
      state.checkout.pickupMode = '';
    }

    if (state.checkout.pickupChoice === 'asap' && !windowInfo.asapAvailable) {
      state.checkout.pickupChoice = '';
      state.checkout.pickupMode = '';
    }

    if (state.checkout.pickupChoice === 'asap') state.checkout.pickupMode = 'asap';
    else if (/^\d{2}:\d{2}$/.test(String(state.checkout.pickupChoice || ''))) state.checkout.pickupMode = 'scheduled';

    const nextDayNote = windowInfo.dayOffset === 1
      ? '<div class="pickup-next-day-note">Neste åpningsdag · I morgen</div>'
      : '';

    host.innerHTML = `
      <div class="pickup-mode-row">
        <button type="button" class="pickup-mode-btn ${state.checkout.pickupMode === 'asap' ? 'active' : ''}" data-pickup-mode="asap" ${windowInfo.asapAvailable ? '' : 'disabled'}>
          <span class="pickup-mode-check">${state.checkout.pickupMode === 'asap' ? '✓' : ''}</span>
          <span><strong>Snarest mulig</strong><small>Hent så snart maten er klar</small></span>
        </button>
        <button type="button" class="pickup-mode-btn ${state.checkout.pickupMode === 'scheduled' ? 'active' : ''}" data-pickup-mode="scheduled">
          <span class="pickup-mode-check">${state.checkout.pickupMode === 'scheduled' ? '✓' : ''}</span>
          <span><strong>Velg hentetid</strong><small>Velg et tidspunkt</small></span>
        </button>
      </div>
      ${nextDayNote}
      <div class="pickup-time-grid" ${state.checkout.pickupMode === 'scheduled' ? '' : 'hidden'}>
        ${slots.map(time => `<button type="button" class="pickup-time-btn ${state.checkout.pickupChoice === time ? 'active' : ''}" data-pickup-time="${time}">${time}</button>`).join('')}
      </div>`;

    host.querySelectorAll('[data-pickup-mode]').forEach(button => {
      button.onclick = () => {
        if (button.disabled) return;
        state.checkout.pickupMode = button.dataset.pickupMode;
        state.checkout.pickupChoice = state.checkout.pickupMode === 'asap' ? 'asap' : '';
        renderPickupTimes();
        syncCheckoutValidation();
      };
    });

    host.querySelectorAll('[data-pickup-time]').forEach(button => {
      button.onclick = () => {
        state.checkout.pickupMode = 'scheduled';
        state.checkout.pickupChoice = button.dataset.pickupTime;
        renderPickupTimes();
        syncCheckoutValidation();
      };
    });

    syncPickupUi();
  };

  const originalBuildAdminOrderPayload = buildAdminOrderPayload;
  buildAdminOrderPayload = function buildAdminOrderPayloadStable(input) {
    const payload = originalBuildAdminOrderPayload(input);
    if (payload?.pickup?.mode === 'scheduled') {
      const date = new Date();
      date.setDate(date.getDate() + pickupDayOffset);
      payload.pickup.date = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      payload.pickup.dayOffset = pickupDayOffset;
    }
    return payload;
  };

  if (window.KOLIntegration) {
    window.KOLIntegration.buildAdminOrderPayload = buildAdminOrderPayload;
  }
})();
