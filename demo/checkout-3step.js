/* KØL checkout UX — 3 clear customer steps: cart, contact, pickup */
(() => {
  'use strict';
  if (window.__KOL_CHECKOUT_3STEP__) return;
  window.__KOL_CHECKOUT_3STEP__ = true;

  const originalHandleCheckoutNext = handleCheckoutNext;
  const originalSyncCheckoutValidation = syncCheckoutValidation;
  const stableRenderPickupTimes = renderPickupTimes;

  function installStyles() {
    const style = document.createElement('style');
    style.id = 'kol-checkout-3step-styles';
    style.textContent = `
      /* Always keep the main customer areas genuinely scrollable. */
      #menuShell,
      #cartScreen .screen-scroll,
      #productScreen .screen-scroll,
      #accountScreen .screen-scroll,
      #infoScreen .screen-scroll,
      #rewardScreen .screen-scroll,
      #couponQrScreen .screen-scroll,
      #kasseScreen .screen-scroll,
      #allergenScreen .screen-scroll {
        overflow-y: scroll !important;
        -webkit-overflow-scrolling: touch;
        overscroll-behavior-y: contain;
        scrollbar-gutter: stable;
        scrollbar-width: thin;
      }
      #menuShell::-webkit-scrollbar,
      .screen-scroll::-webkit-scrollbar { width: 7px; }
      #menuShell::-webkit-scrollbar-thumb,
      .screen-scroll::-webkit-scrollbar-thumb { background: #cfc7c1; border-radius: 999px; }
      #menuShell::-webkit-scrollbar-track,
      .screen-scroll::-webkit-scrollbar-track { background: #f5f2ef; }

      #cartScreen .checkout-progress {
        display:grid; grid-template-columns:repeat(3,1fr); gap:7px;
        margin:0 0 12px; padding:10px; border:1px solid #e9e4e0;
        border-radius:16px; background:#fff;
      }
      #cartScreen .checkout-progress-step {
        min-width:0; min-height:34px; display:flex; align-items:center; gap:7px;
        padding:4px 5px; border:0; border-radius:10px; background:transparent;
        color:#918781; font-size:11px; font-weight:750; line-height:1.15;
        text-align:left; cursor:default;
      }
      #cartScreen .checkout-progress-step.can-go-back { cursor:pointer; }
      #cartScreen .checkout-progress-step.can-go-back:hover { background:#f8f6f4; }
      #cartScreen .checkout-progress-step:focus-visible { outline:2px solid #f36a2d; outline-offset:2px; }
      #cartScreen .checkout-progress-step i {
        width:25px; height:25px; flex:0 0 25px; display:grid; place-items:center;
        border:1px solid #e5ded9; border-radius:50%; background:#faf9f8;
        color:#8a817c; font-style:normal; font-size:11px;
      }
      #cartScreen .checkout-progress-step.active { color:#d95622; }
      #cartScreen .checkout-progress-step.active i {
        border-color:#f36a2d; background:#fff2eb; color:#e85c24;
      }
      #cartScreen .checkout-progress-step.done { color:#27765c; }
      #cartScreen .checkout-progress-step.done i {
        border-color:#b9dfd1; background:#eef9f5; color:#157253;
      }
      #cartScreen .checkout-progress-step span { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }

      #cartScreen .checkout-step-intro {
        display:flex; align-items:center; justify-content:space-between; gap:12px;
        margin-bottom:10px; padding:15px 14px; border:1px solid #e9e4e0;
        border-radius:16px; background:#fff;
      }
      #cartScreen .checkout-step-intro-main { display:flex; align-items:center; gap:11px; min-width:0; }
      #cartScreen .checkout-step-number {
        width:36px; height:36px; flex:0 0 36px; display:grid; place-items:center;
        border:1px solid #f0c6b5; border-radius:12px; background:#fff4ee;
        color:#db5621; font-size:13px; font-weight:800;
      }
      #cartScreen .checkout-step-intro strong { display:block; font-size:16px; color:#211d1b; }
      #cartScreen .checkout-step-intro small { display:block; margin-top:3px; color:#827873; font-size:11.5px; line-height:1.35; }
      #cartScreen .checkout-step-count {
        flex:0 0 auto; padding:6px 9px; border-radius:999px; background:#fff1ea;
        color:#d45422; font-size:10px; font-weight:800; text-transform:uppercase;
      }

      /* Contact and pickup use the exact same card language. */
      #checkoutStep1,
      #checkoutStep2,
      #checkoutStep3 { padding:10px 10px 18px; }
      #checkoutStep2 .final-checkout-section,
      #checkoutStep3 .final-checkout-section {
        margin:0 0 11px; border:1px solid #dfe9e4; border-radius:15px;
        background:#fff; overflow:hidden; box-shadow:0 3px 12px rgba(43,35,31,.025);
      }
      #checkoutStep2 #finalContactSection .final-section-head,
      #checkoutStep3 #finalPickupSection .final-section-head { display:none !important; }
      #checkoutStep2 .checkout-grid,
      #checkoutStep3 .pickup-options {
        margin:0; padding:12px; border:0; border-radius:0; background:transparent; box-shadow:none;
      }
      #checkoutStep3 .pickup-options { display:block; }
      #checkoutStep3 .checkout-pickup-help {
        margin:0 2px 10px; padding:9px 11px; border:1px solid #eee5df;
        border-radius:11px; background:#fff; color:#776e69; font-size:11.5px; line-height:1.4;
      }
      #checkoutStep3 .pickup-mode-row { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
      #checkoutStep3 .pickup-mode-btn {
        min-height:72px; padding:10px; border:1px solid #e5ddd8; border-radius:12px;
        background:#fff; color:#332d29; display:grid; grid-template-columns:26px minmax(0,1fr);
        align-items:center; gap:8px; text-align:left;
      }
      #checkoutStep3 .pickup-mode-btn strong { display:block; font-size:13px; line-height:1.2; font-weight:700; }
      #checkoutStep3 .pickup-mode-btn small { display:block; margin-top:4px; color:#817872; font-size:9.8px; line-height:1.25; font-weight:400; }
      #checkoutStep3 .pickup-mode-btn.active { border-color:#f09a76; background:#fff5f0; color:#bc4d25; }
      #checkoutStep3 .pickup-mode-btn.active .pickup-mode-check { border-color:#f36a2d; background:#f36a2d; color:#fff; }
      #checkoutStep3 .pickup-mode-btn.active small { color:#a76850; }
      #checkoutStep3 .pickup-mode-btn:disabled { opacity:1; cursor:pointer; }
      #checkoutStep3 .pickup-time-grid {
        display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:7px;
        margin-top:10px; padding-top:10px; border-top:1px solid #eee7e2;
      }
      #checkoutStep3 .pickup-time-btn {
        height:45px; border:1px solid #e4ddd8; border-radius:10px; background:#fff;
        color:#3b3531; font-size:13px; font-weight:600;
      }
      #checkoutStep3 .pickup-time-btn.active { border-color:#f36a2d; background:#fff2ec; color:#c34f25; }
      #checkoutStep3 .pickup-next-day-note {
        margin:10px 0 0; padding:8px 10px; border-radius:10px;
        background:#f8f6f4; color:#635b56; font-size:11.5px; font-weight:650;
      }

      @media (max-width:420px) {
        #cartScreen .checkout-progress { gap:4px; padding:7px; }
        #cartScreen .checkout-progress-step { gap:4px; padding:3px; font-size:9.8px; }
        #cartScreen .checkout-progress-step i { width:23px; height:23px; flex-basis:23px; }
        #cartScreen .checkout-step-intro { padding:13px 12px; }
        #cartScreen .checkout-step-intro strong { font-size:15px; }
        #checkoutStep3 .pickup-mode-row { grid-template-columns:1fr 1fr; }
      }
    `;
    document.head.appendChild(style);
  }

  function progressMarkup(current) {
    const items = [
      [1, 'Bestilling'],
      [2, 'Kontakt'],
      [3, 'Hentetid'],
    ];
    return `<nav class="checkout-progress" aria-label="Bestillingssteg">${items.map(([step, label]) => {
      const done = step < current;
      const cls = `${done ? 'done' : step === current ? 'active' : ''}${step < current ? ' can-go-back' : ''}`;
      const disabled = step > current ? ' disabled' : '';
      return `<button type="button" class="checkout-progress-step ${cls}" data-checkout-step="${step}"${disabled}><i>${done ? '✓' : step}</i><span>${label}</span></button>`;
    }).join('')}</nav>`;
  }

  function introMarkup(step, title, text) {
    return `
      <div class="checkout-step-intro">
        <div class="checkout-step-intro-main">
          <span class="checkout-step-number">${step}</span>
          <div><strong>${title}</strong><small>${text}</small></div>
        </div>
        <span class="checkout-step-count">Steg ${step} / 3</span>
      </div>`;
  }

  function bindProgressNavigation(root) {
    root?.querySelectorAll('[data-checkout-step]').forEach(button => {
      button.onclick = () => {
        const target = Number(button.dataset.checkoutStep);
        const current = Number(state.checkout.step) || 1;
        if (!target || target >= current) return;
        document.activeElement?.blur?.();
        state.checkout.step = target;
        renderCheckoutStep();
      };
    });
  }

  function prepareDom() {
    const step1 = $('#checkoutStep1');
    const step2 = $('#checkoutStep2');
    const pickupSection = $('#finalPickupSection');
    if (!step1 || !step2 || !pickupSection) return false;

    step1.querySelector('.checkout-title')?.remove();
    if (!step1.querySelector('.checkout-progress')) {
      step1.insertAdjacentHTML('afterbegin', `${progressMarkup(1)}${introMarkup(1, 'Sjekk bestillingen', 'Kontroller varene før du går videre.')}`);
    }

    step2.querySelector('.checkout-title')?.remove();
    if (!step2.querySelector('.checkout-progress')) {
      step2.insertAdjacentHTML('afterbegin', `${progressMarkup(2)}${introMarkup(2, 'Kontaktinformasjon', 'Skriv inn navn og telefonnummer så vi kan kjenne igjen bestillingen din.')}`);
    }

    let step3 = $('#checkoutStep3');
    if (!step3) {
      step3 = document.createElement('div');
      step3.id = 'checkoutStep3';
      step3.hidden = true;
      step3.innerHTML = `${progressMarkup(3)}${introMarkup(3, 'Når vil du hente?', 'Velg snarest mulig eller et tidspunkt som passer deg.')}<p class="checkout-pickup-help">Bestillingen sendes først når du trykker <strong>Send bestilling</strong>.</p>`;
      step2.insertAdjacentElement('afterend', step3);
    }
    if (pickupSection.parentElement !== step3) step3.appendChild(pickupSection);

    const contactHead = $('#finalContactSection .final-section-head');
    if (contactHead) contactHead.hidden = true;
    const pickupHead = $('#finalPickupSection .final-section-head');
    if (pickupHead) pickupHead.hidden = true;

    bindProgressNavigation(step1);
    bindProgressNavigation(step2);
    bindProgressNavigation(step3);
    return true;
  }

  function contactReady() {
    const contact = checkoutContactState();
    return Boolean(contact.nameOk && contact.phoneOk);
  }

  function enhancePickupButtons() {
    const host = $('#pickupOptions');
    if (!host) return;

    const asap = host.querySelector('[data-pickup-mode="asap"]');
    if (asap?.disabled) {
      const firstTime = host.querySelector('[data-pickup-time]')?.dataset.pickupTime || '';
      asap.disabled = false;
      asap.removeAttribute('disabled');
      const small = asap.querySelector('small');
      if (small && firstTime) small.textContent = `Neste ledige hentetid: ${firstTime}`;
      asap.onclick = () => {
        const firstAvailable = host.querySelector('[data-pickup-time]')?.dataset.pickupTime || '';
        if (!firstAvailable) return;
        state.checkout.pickupMode = 'scheduled';
        state.checkout.pickupChoice = firstAvailable;
        renderPickupTimes();
        syncCheckoutValidation();
      };
    }
  }

  renderPickupTimes = function renderPickupTimesThreeStep() {
    stableRenderPickupTimes();
    enhancePickupButtons();
  };

  function setNextButton() {
    const next = $('#checkoutNext');
    if (!next) return;

    if (state.checkout.step === 1) {
      next.textContent = 'Neste: Kontakt';
      next.disabled = !state.cart.length;
    } else if (state.checkout.step === 2) {
      next.textContent = 'Neste: Hentetid';
      next.disabled = !contactReady();
    } else {
      next.textContent = 'Send bestilling';
      next.disabled = !pickupReady();
    }

    next.classList.toggle('ready', !next.disabled);
    next.style.opacity = next.disabled ? '.55' : '1';
    next.style.cursor = next.disabled ? 'not-allowed' : 'pointer';
  }

  syncCheckoutValidation = function syncCheckoutValidationThreeStep() {
    originalSyncCheckoutValidation();
    setNextButton();
  };

  renderCheckoutStep = function renderCheckoutStepThreeStep() {
    prepareDom();
    const step1 = $('#checkoutStep1');
    const step2 = $('#checkoutStep2');
    const step3 = $('#checkoutStep3');
    if (!step1 || !step2 || !step3) return;

    const current = Math.min(3, Math.max(1, Number(state.checkout.step) || 1));
    state.checkout.step = current;
    step1.hidden = current !== 1;
    step2.hidden = current !== 2;
    step3.hidden = current !== 3;

    const back = $('#checkoutBack');
    if (back) back.hidden = current === 1;

    if (current === 2) {
      const contact = checkoutContactState();
      if (contact.nameOk && contact.phoneOk) $('#checkoutConfirmCard')?.removeAttribute('hidden');
    }
    if (current === 3) renderPickupTimes();

    setNextButton();

    const cartOpen = !$('#cartScreen').hidden;
    const focused = cartOpen && current > 1;
    document.body.classList.toggle('hide-tabs', focused);
    $('#cartScreen').style.top = focused ? 'var(--head)' : 'calc(var(--head) + var(--tabs))';

    const scroll = $('#cartScreen .screen-scroll');
    if (scroll) scroll.scrollTop = 0;
  };

  handleCheckoutNext = function handleCheckoutNextThreeStep() {
    if (state.checkout.step === 1) {
      if (!state.cart.length) return;
      state.checkout.step = 2;
      renderCheckoutStep();
      const contact = checkoutContactState();
      if (!contact.nameOk) $('#checkoutName')?.focus();
      else if (!contact.phoneOk) $('#checkoutPhone')?.focus();
      return;
    }

    if (state.checkout.step === 2) {
      if (!contactReady()) {
        syncCheckoutValidation();
        const contact = checkoutContactState();
        if (!contact.nameOk) $('#checkoutName')?.focus();
        else if (!contact.phoneOk) $('#checkoutPhone')?.focus();
        return;
      }
      document.activeElement?.blur?.();
      state.checkout.step = 3;
      renderCheckoutStep();
      return;
    }

    if (!pickupReady()) {
      syncCheckoutValidation();
      return;
    }

    // Reuse the proven original submit path. It expects the old final step to be step 2.
    state.checkout.step = 2;
    originalHandleCheckoutNext();
    if (state.cart.length && state.checkout.step === 2) {
      state.checkout.step = 3;
      renderCheckoutStep();
    }
  };

  function bindThreeStepControls() {
    const next = $('#checkoutNext');
    const back = $('#checkoutBack');
    if (next) next.onclick = handleCheckoutNext;
    if (back) {
      back.onclick = () => {
        document.activeElement?.blur?.();
        state.checkout.step = Math.max(1, (Number(state.checkout.step) || 1) - 1);
        renderCheckoutStep();
      };
    }

    ['checkoutName', 'checkoutPhone'].forEach(id => {
      const input = document.getElementById(id);
      if (!input) return;
      input.addEventListener('input', () => requestAnimationFrame(setNextButton));
      input.addEventListener('blur', () => requestAnimationFrame(setNextButton));
    });
  }

  installStyles();
  if (prepareDom()) {
    bindThreeStepControls();
    renderCheckoutStep();
  }
})();
