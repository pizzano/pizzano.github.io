(() => {
  const infoTitle = document.querySelector('#infoScreen .info-title');
  if (infoTitle) infoTitle.remove();

  const step1 = document.querySelector('#checkoutStep1');
  const step2 = document.querySelector('#checkoutStep2');
  const step3 = document.querySelector('#checkoutStep3');
  const pickupOptions = document.querySelector('#pickupOptions');
  const contactGrid = step3?.querySelector('.checkout-grid');
  const loginHint = document.querySelector('#checkoutLoginHint');
  if (!step1 || !step2 || !step3 || !pickupOptions || !contactGrid) return;

  const DEMO_TESTER_PHONE = '95557474';
  let pickupMode = '';
  pickupChoice = '';

  const title = step2.querySelector('.checkout-title');
  const titleStrong = title?.querySelector('strong');
  const titleSmall = title?.querySelector('small');
  if (titleStrong) titleStrong.textContent = 'Fullfør bestilling';
  if (titleSmall) titleSmall.textContent = 'Fyll inn kontaktinfo først, og velg deretter hentetid.';

  const contactSection = document.createElement('section');
  contactSection.className = 'final-checkout-section';
  contactSection.id = 'finalContactSection';
  const contactHead = document.createElement('div');
  contactHead.className = 'final-section-head';
  contactHead.innerHTML = '<span>1</span><div><strong>Navn og telefon</strong><small>Vi bruker dette bare for bestillingen din.</small></div>';
  if (loginHint) loginHint.hidden = true;
  contactSection.appendChild(contactHead);
  contactSection.appendChild(contactGrid);

  const pickupSection = document.createElement('section');
  pickupSection.className = 'final-checkout-section';
  pickupSection.id = 'finalPickupSection';
  pickupSection.innerHTML = '<div class="final-section-head"><span>2</span><div><strong>Velg hentetid</strong><small>Velg alltid Snarest mulig eller et bestemt tidspunkt.</small></div></div>';
  pickupSection.appendChild(pickupOptions);

  step2.appendChild(contactSection);
  step2.appendChild(pickupSection);
  step3.hidden = true;

  const nameInput = document.querySelector('#checkoutName');
  const phoneInput = document.querySelector('#checkoutPhone');
  if (nameInput) {
    nameInput.type = 'text';
    nameInput.autocomplete = 'name';
    nameInput.setAttribute('autocapitalize', 'words');
    nameInput.setAttribute('enterkeyhint', 'next');
  }
  if (phoneInput) {
    phoneInput.type = 'tel';
    phoneInput.autocomplete = 'tel-national';
    phoneInput.setAttribute('inputmode', 'tel');
    phoneInput.setAttribute('enterkeyhint', 'done');
    phoneInput.maxLength = 8;
  }

  const keyboardHint = document.createElement('small');
  keyboardHint.className = 'keyboard-hint';
  keyboardHint.textContent = 'Trykk Ferdig på tastaturet eller trykk utenfor feltet.';
  contactGrid.insertBefore(keyboardHint, document.querySelector('#checkoutConfirmCard'));

  function clockMinutes(value, fallback) {
    const match = String(value || fallback).match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return clockMinutes(fallback, '00:00');
    return Math.min(23, Number(match[1])) * 60 + Math.min(59, Number(match[2]));
  }

  function osloNowMinutes() {
    try {
      const parts = new Intl.DateTimeFormat('nb-NO', {
        timeZone: 'Europe/Oslo',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      }).formatToParts(new Date());
      const hour = Number(parts.find(part => part.type === 'hour')?.value || 0);
      const minute = Number(parts.find(part => part.type === 'minute')?.value || 0);
      return hour * 60 + minute;
    } catch {
      const now = new Date();
      return now.getHours() * 60 + now.getMinutes();
    }
  }

  function checkoutPhoneDigits() {
    return String(document.querySelector('#checkoutPhone')?.value || session || '').replace(/\D/g, '').slice(-8);
  }

  function isDemoTester() {
    return checkoutPhoneDigits() === DEMO_TESTER_PHONE;
  }

  function storeClockState() {
    const now = osloNowMinutes();
    const close = clockMinutes(ACTIVE_SITE_SETTINGS.orderCloseTime, '22:00');
    const tester = isDemoTester();
    const afterClose = now >= close;
    const minutesToClose = close - now;
    const closingSoon = !afterClose && minutesToClose <= 15;
    return {
      now,
      close,
      tester,
      afterClose,
      closingSoon,
      closedForCustomer: afterClose && !tester,
      scheduledAllowed: !afterClose && !closingSoon
    };
  }

  const pickupReady = () => {
    const state = storeClockState();
    if (state.closedForCustomer) return false;
    if (pickupChoice === 'asap') return true;
    return state.scheduledAllowed && /^\d{2}:\d{2}$/.test(String(pickupChoice || ''));
  };

  function syncPickupUi() {
    const state = storeClockState();
    pickupSection.classList.toggle('is-complete', pickupReady());
    pickupSection.classList.toggle('needs-choice', !pickupReady() && !state.closedForCustomer);
    pickupSection.classList.toggle('store-closed', state.closedForCustomer);
  }

  renderPickupTimes = function () {
    const state = storeClockState();
    const slots = state.scheduledAllowed ? pickupSlots() : [];

    if (state.closedForCustomer) {
      pickupMode = '';
      pickupChoice = '';
      pickupOptions.innerHTML = `
        <div class="store-hours-note store-closed-note">
          <strong>Kjøkkenet er stengt for bestilling</strong>
          <small>Online bestilling stenger kl. ${ACTIVE_SITE_SETTINGS.orderCloseTime || '22:00'}.</small>
        </div>`;
      syncPickupUi();
      return;
    }

    if (!state.scheduledAllowed && pickupMode === 'scheduled') {
      pickupMode = '';
      pickupChoice = '';
    }
    if (/^\d{2}:\d{2}$/.test(String(pickupChoice || '')) && !slots.includes(pickupChoice)) {
      pickupChoice = '';
      pickupMode = '';
    }
    if (pickupChoice === 'asap') pickupMode = 'asap';
    else if (/^\d{2}:\d{2}$/.test(String(pickupChoice || ''))) pickupMode = 'scheduled';

    const scheduledButton = state.scheduledAllowed && slots.length ? `
      <button type="button" class="pickup-mode-btn ${pickupMode === 'scheduled' ? 'active' : ''}" data-pickup-mode="scheduled">
        <span class="pickup-mode-check">${pickupMode === 'scheduled' ? '✓' : ''}</span>
        <span><strong>Velg hentetid</strong><small>Velg et tidspunkt</small></span>
      </button>` : '';

    const notice = state.afterClose && state.tester
      ? `<div class="store-hours-note demo-test-note"><strong>Demo testmodus</strong><small>Vanlige kunder kan ikke bestille etter kl. ${ACTIVE_SITE_SETTINGS.orderCloseTime || '22:00'}, men testkontoen din kan fortsatt sende en ordre.</small></div>`
      : state.closingSoon
        ? `<div class="store-hours-note"><strong>Vi stenger snart</strong><small>Det er mindre enn 15 minutter til stengetid. Derfor kan du bare velge Snarest mulig.</small></div>`
        : '';

    pickupOptions.innerHTML = `
      ${notice}
      <div class="pickup-mode-row ${scheduledButton ? '' : 'single-option'}">
        <button type="button" class="pickup-mode-btn ${pickupMode === 'asap' ? 'active' : ''}" data-pickup-mode="asap">
          <span class="pickup-mode-check">${pickupMode === 'asap' ? '✓' : ''}</span>
          <span><strong>Snarest mulig</strong><small>Hent så snart maten er klar</small></span>
        </button>
        ${scheduledButton}
      </div>
      <div class="pickup-time-grid" ${pickupMode === 'scheduled' && state.scheduledAllowed ? '' : 'hidden'}>
        ${slots.map(t => `<button type="button" class="pickup-time-btn ${pickupChoice === t ? 'active' : ''}" data-pickup-time="${t}">${t}</button>`).join('')}
      </div>`;

    pickupOptions.querySelectorAll('[data-pickup-mode]').forEach(btn => {
      btn.onclick = () => {
        pickupMode = btn.dataset.pickupMode;
        pickupChoice = pickupMode === 'asap' ? 'asap' : '';
        renderPickupTimes();
        syncCheckoutValidation();
      };
    });
    pickupOptions.querySelectorAll('[data-pickup-time]').forEach(btn => {
      btn.onclick = () => {
        pickupMode = 'scheduled';
        pickupChoice = btn.dataset.pickupTime;
        renderPickupTimes();
        syncCheckoutValidation();
      };
    });
    syncPickupUi();
  };

  syncCheckoutValidation = function () {
    const s = checkoutContactState();
    const state = storeClockState();
    const contactReady = s.nameOk && s.phoneOk;
    const timeReady = pickupReady();
    const nf = document.querySelector('#checkoutNameField');
    const pf = document.querySelector('#checkoutPhoneField');
    const card = document.querySelector('#checkoutConfirmCard');

    nf?.classList.toggle('valid', s.nameOk);
    pf?.classList.toggle('valid', s.phoneOk);
    if (card) {
      card.hidden = !contactReady;
      if (contactReady) card.querySelector('small').textContent = state.closedForCustomer
        ? 'Kontaktinfo er ferdig, men kjøkkenet er stengt.'
        : 'Kontaktinfo er ferdig. Velg hentetid nedenfor.';
    }
    contactSection.classList.toggle('is-complete', contactReady);
    syncPickupUi();

    const badge = step2.querySelector('.checkout-title > span');
    if (badge) {
      const complete = contactReady && timeReady && !state.closedForCustomer;
      badge.textContent = complete ? '✓' : '2';
      badge.classList.toggle('step-ok', complete);
    }

    if (checkoutStep === 2) {
      const next = document.querySelector('#checkoutNext');
      if (next) {
        const canPromptTime = contactReady && !timeReady && !state.closedForCustomer;
        const canSend = contactReady && timeReady && !state.closedForCustomer;
        next.disabled = !contactReady || state.closedForCustomer;
        next.classList.toggle('ready', canSend);
        next.classList.toggle('needs-time', canPromptTime);
        next.classList.toggle('store-closed', state.closedForCustomer);
        next.style.background = '';
        next.style.opacity = '1';
        next.style.cursor = next.disabled ? 'not-allowed' : 'pointer';
      }
    }
  };

  bindCheckoutValidation = function () {
    const n = document.querySelector('#checkoutName');
    const p = document.querySelector('#checkoutPhone');
    const bringIntoView = input => setTimeout(() => input?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 180);

    if (n && !n.dataset.twoStepValidationBound) {
      n.dataset.twoStepValidationBound = '1';
      ['input', 'change', 'blur'].forEach(ev => n.addEventListener(ev, syncCheckoutValidation));
      n.addEventListener('focus', () => bringIntoView(n));
      n.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
          e.preventDefault();
          p?.focus();
        }
      });
    }

    if (p && !p.dataset.twoStepValidationBound) {
      p.dataset.twoStepValidationBound = '1';
      ['input', 'change', 'blur'].forEach(ev => p.addEventListener(ev, () => {
        p.value = p.value.replace(/\D/g, '').slice(0, 8);
        renderPickupTimes();
        syncCheckoutValidation();
      }));
      p.addEventListener('focus', () => bringIntoView(p));
      p.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
          e.preventDefault();
          p.blur();
          if (checkoutContactState().nameOk && checkoutContactState().phoneOk && !pickupReady()) {
            setTimeout(() => pickupSection.scrollIntoView({ behavior: 'smooth', block: 'center' }), 80);
          }
        }
      });
    }

    if (!document.documentElement.dataset.checkoutKeyboardBound) {
      document.documentElement.dataset.checkoutKeyboardBound = '1';
      document.addEventListener('pointerdown', e => {
        const active = document.activeElement;
        if (!active || !['checkoutName', 'checkoutPhone'].includes(active.id)) return;
        if (e.target === active || e.target.closest('input, textarea')) return;
        active.blur();
      }, { capture: true });
    }

    syncCheckoutValidation();
    requestAnimationFrame(syncCheckoutValidation);
    setTimeout(syncCheckoutValidation, 120);
  };

  renderCheckoutStep = function () {
    step1.hidden = checkoutStep !== 1;
    step2.hidden = checkoutStep !== 2;
    step3.hidden = true;

    const back = document.querySelector('#checkoutBack');
    if (back) back.hidden = checkoutStep === 1;

    const step1Badge = step1.querySelector('.checkout-title > span');
    const step2Badge = step2.querySelector('.checkout-title > span');
    const contact = checkoutContactState();
    const state = storeClockState();
    const complete = contact.nameOk && contact.phoneOk && pickupReady() && !state.closedForCustomer;

    if (step1Badge) {
      step1Badge.textContent = cart.length ? '✓' : '1';
      step1Badge.classList.toggle('step-ok', !!cart.length);
    }
    if (step2Badge) {
      step2Badge.textContent = complete ? '✓' : '2';
      step2Badge.classList.toggle('step-ok', complete);
    }

    const next = document.querySelector('#checkoutNext');
    if (next) {
      next.textContent = checkoutStep === 2 ? 'Send bestilling' : 'Neste';
      if (checkoutStep === 1) {
        next.disabled = !cart.length;
        next.classList.toggle('ready', !!cart.length);
        next.classList.remove('needs-time', 'store-closed');
      } else {
        next.disabled = !(contact.nameOk && contact.phoneOk) || state.closedForCustomer;
        next.classList.toggle('ready', complete);
        next.classList.toggle('needs-time', contact.nameOk && contact.phoneOk && !pickupReady() && !state.closedForCustomer);
        next.classList.toggle('store-closed', state.closedForCustomer);
      }
      next.style.background = '';
      next.style.opacity = '1';
      next.style.cursor = next.disabled ? 'not-allowed' : 'pointer';
    }

    if (checkoutStep === 2) {
      renderPickupTimes();
      syncCheckoutValidation();
    }

    const cartOpen = !document.querySelector('#cartScreen').hidden;
    const focused = cartOpen && checkoutStep === 2;
    document.body.classList.toggle('hide-tabs', focused);
    document.querySelector('#cartScreen').style.top = focused ? 'var(--head)' : 'calc(var(--head) + var(--tabs))';
  };

  const originalPlaceOrder = placeOrder;
  placeOrder = function () {
    originalPlaceOrder();
    if (!cart.length) {
      pickupChoice = '';
      pickupMode = '';
    }
  };

  const back = document.querySelector('#checkoutBack');
  const next = document.querySelector('#checkoutNext');
  if (back) {
    back.onclick = () => {
      document.activeElement?.blur?.();
      checkoutStep = 1;
      renderCheckoutStep();
    };
  }
  if (next) {
    next.onclick = () => {
      if (checkoutStep === 1 && !cart.length) return;
      if (checkoutStep === 1) {
        checkoutStep = 2;
        renderCheckoutStep();
        const c = checkoutContactState();
        if (!c.nameOk) document.querySelector('#checkoutName')?.focus();
        else if (!c.phoneOk) document.querySelector('#checkoutPhone')?.focus();
        return;
      }

      const c = checkoutContactState();
      const state = storeClockState();
      if (!c.nameOk || !c.phoneOk) {
        syncCheckoutValidation();
        return;
      }
      if (state.closedForCustomer) {
        document.activeElement?.blur?.();
        pickupSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
        showToast(`Online bestilling er stengt etter kl. ${ACTIVE_SITE_SETTINGS.orderCloseTime || '22:00'}`);
        return;
      }
      if (!pickupReady()) {
        document.activeElement?.blur?.();
        pickupSection.classList.add('attention');
        pickupSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
        showToast('Velg hentetid før du sender bestillingen');
        setTimeout(() => pickupSection.classList.remove('attention'), 1400);
        return;
      }

      document.activeElement?.blur?.();
      placeOrder();
    };
  }

  bindCheckoutValidation();
  renderCheckoutStep();
})();