/* KØL checkout UX — 3 clear customer steps: cart, contact, pickup */
(() => {
  'use strict';
  if (window.__KOL_CHECKOUT_3STEP__) return;
  window.__KOL_CHECKOUT_3STEP__ = true;

  const originalHandleCheckoutNext = handleCheckoutNext;
  const originalSyncCheckoutValidation = syncCheckoutValidation;

  function installStyles() {
    const style = document.createElement('style');
    style.id = 'kol-checkout-3step-styles';
    style.textContent = `
      #menuShell,
      #cartScreen .screen-scroll,
      #productScreen .screen-scroll,
      #accountScreen .screen-scroll,
      #infoScreen .screen-scroll,
      #rewardScreen .screen-scroll,
      #couponQrScreen .screen-scroll,
      #kasseScreen .screen-scroll,
      #allergenScreen .screen-scroll {
        overflow-y:scroll !important;
        -webkit-overflow-scrolling:touch;
        scrollbar-width:thin;
        scrollbar-gutter:stable;
      }
      #menuShell::-webkit-scrollbar,
      .screen-scroll::-webkit-scrollbar { width:7px; }
      #menuShell::-webkit-scrollbar-thumb,
      .screen-scroll::-webkit-scrollbar-thumb { background:#cfc7c1; border-radius:999px; }
      #menuShell::-webkit-scrollbar-track,
      .screen-scroll::-webkit-scrollbar-track { background:#f5f2ef; }

      #checkoutStep1,#checkoutStep2,#checkoutStep3 {
        padding:10px 10px 20px !important;
        box-sizing:border-box;
      }

      #cartScreen .checkout-progress {
        display:grid;
        grid-template-columns:repeat(3,minmax(0,1fr));
        gap:6px;
        margin:0 0 12px;
        padding:8px;
        border:1px solid #e9e4e0;
        border-radius:16px;
        background:#fff;
        box-shadow:0 3px 12px rgba(43,35,31,.025);
      }
      #cartScreen .checkout-progress-step {
        min-width:0;
        min-height:38px;
        display:flex;
        align-items:center;
        justify-content:flex-start;
        gap:7px;
        padding:5px 6px;
        border:0;
        border-radius:10px;
        background:transparent;
        color:#918781;
        font-size:11px;
        font-weight:750;
        line-height:1.15;
        text-align:left;
        cursor:pointer !important;
        user-select:none;
        -webkit-user-select:none;
        touch-action:manipulation;
      }
      #cartScreen .checkout-progress-step:hover { background:#f8f6f4; }
      #cartScreen .checkout-progress-step.future { cursor:default !important; }
      #cartScreen .checkout-progress-step.future:hover { background:transparent; }
      #cartScreen .checkout-progress-step:focus-visible { outline:2px solid #f36a2d; outline-offset:2px; }
      #cartScreen .checkout-progress-step i {
        width:26px;
        height:26px;
        flex:0 0 26px;
        display:grid;
        place-items:center;
        border:1px solid #e5ded9;
        border-radius:50%;
        background:#faf9f8;
        color:#8a817c;
        font-style:normal;
        font-size:11px;
      }
      #cartScreen .checkout-progress-step.active { color:#d95622; }
      #cartScreen .checkout-progress-step.active i { border-color:#f36a2d; background:#fff2eb; color:#e85c24; }
      #cartScreen .checkout-progress-step.done { color:#27765c; }
      #cartScreen .checkout-progress-step.done i { border-color:#b9dfd1; background:#eef9f5; color:#157253; }
      #cartScreen .checkout-progress-step span { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }

      #cartScreen .checkout-step-intro {
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:12px;
        margin:0 0 12px;
        padding:15px 14px;
        border:1px solid #e9e4e0;
        border-radius:16px;
        background:#fff;
        box-shadow:0 3px 12px rgba(43,35,31,.025);
      }
      #cartScreen .checkout-step-intro-main { display:flex; align-items:center; gap:11px; min-width:0; }
      #cartScreen .checkout-step-number {
        width:36px;height:36px;flex:0 0 36px;display:grid;place-items:center;
        border:1px solid #f0c6b5;border-radius:12px;background:#fff4ee;
        color:#db5621;font-size:13px;font-weight:800;
      }
      #cartScreen .checkout-step-intro strong { display:block; font-size:16px; color:#211d1b; }
      #cartScreen .checkout-step-intro small { display:block; margin-top:3px; color:#827873; font-size:11.5px; line-height:1.35; }
      #cartScreen .checkout-step-count {
        flex:0 0 auto;padding:6px 9px;border-radius:999px;background:#fff1ea;
        color:#d45422;font-size:10px;font-weight:800;text-transform:uppercase;
      }

      /* Contact and pickup are intentionally styled as the same white form card. */
      #checkoutStep2 .final-checkout-section,
      #checkoutStep3 .final-checkout-section {
        width:100%;
        margin:0;
        padding:0;
        border:1px solid #d8e9e0 !important;
        border-radius:15px !important;
        background:#fff !important;
        overflow:hidden;
        box-shadow:0 3px 12px rgba(43,35,31,.025) !important;
      }
      #checkoutStep2 #finalContactSection .final-section-head,
      #checkoutStep3 #finalPickupSection .final-section-head { display:none !important; }
      #checkoutStep2 .checkout-grid,
      #checkoutStep3 .pickup-options {
        width:100%;
        margin:0 !important;
        padding:12px !important;
        border:0 !important;
        border-radius:0 !important;
        background:#fff !important;
        box-shadow:none !important;
      }
      #checkoutStep3 .checkout-pickup-help {
        margin:0 0 10px;
        padding:10px 12px;
        border:1px solid #e9e2dd;
        border-radius:11px;
        background:#fff;
        color:#776e69;
        font-size:11.5px;
        line-height:1.4;
      }
      #checkoutStep3 .pickup-mode-row { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
      #checkoutStep3 .pickup-mode-btn {
        min-height:76px;
        padding:10px;
        border:1px solid #e5ddd8;
        border-radius:12px;
        background:#fff;
        color:#332d29;
        display:grid;
        grid-template-columns:26px minmax(0,1fr);
        align-items:center;
        gap:8px;
        text-align:left;
      }
      #checkoutStep3 .pickup-mode-btn strong { display:block; font-size:13px; line-height:1.2; font-weight:700; }
      #checkoutStep3 .pickup-mode-btn small { display:block; margin-top:4px; color:#817872; font-size:9.8px; line-height:1.25; font-weight:400; }
      #checkoutStep3 .pickup-mode-btn.active { border-color:#f09a76; background:#fff5f0; color:#bc4d25; }
      #checkoutStep3 .pickup-mode-btn.active .pickup-mode-check { border-color:#f36a2d; background:#f36a2d; color:#fff; }
      #checkoutStep3 .pickup-mode-btn.active small { color:#a76850; }
      #checkoutStep3 .pickup-time-grid {
        display:grid;
        grid-template-columns:repeat(2,minmax(0,1fr));
        gap:7px;
        margin-top:10px;
        padding-top:10px;
        border-top:1px solid #eee7e2;
      }
      #checkoutStep3 .pickup-time-btn {
        height:45px;
        border:1px solid #e4ddd8;
        border-radius:10px;
        background:#fff;
        color:#3b3531;
        font-size:13px;
        font-weight:600;
      }
      #checkoutStep3 .pickup-time-btn.active { border-color:#f36a2d; background:#fff2ec; color:#c34f25; }
      #checkoutStep3 .pickup-next-day-note { display:none !important; }

      @media (max-width:420px) {
        #cartScreen .checkout-progress { gap:3px; padding:6px; }
        #cartScreen .checkout-progress-step { gap:4px; padding:3px; font-size:9.8px; }
        #cartScreen .checkout-progress-step i { width:23px;height:23px;flex-basis:23px; }
        #cartScreen .checkout-step-intro { padding:13px 12px; }
        #cartScreen .checkout-step-intro strong { font-size:15px; }
      }
    `;
    document.head.appendChild(style);
  }

  function progressMarkup(current) {
    const items = [[1,'Bestilling'],[2,'Kontakt'],[3,'Hentetid']];
    return `<nav class="checkout-progress" aria-label="Bestillingssteg">${items.map(([step,label]) => {
      const done = step < current;
      const active = step === current;
      const future = step > current;
      const cls = done ? 'done' : active ? 'active' : 'future';
      return `<button type="button" class="checkout-progress-step ${cls}" data-checkout-step="${step}" aria-label="Gå til ${label}"><i>${done ? '✓' : step}</i><span>${label}</span></button>`;
    }).join('')}</nav>`;
  }

  function introMarkup(step,title,text) {
    return `<div class="checkout-step-intro"><div class="checkout-step-intro-main"><span class="checkout-step-number">${step}</span><div><strong>${title}</strong><small>${text}</small></div></div><span class="checkout-step-count">Steg ${step} / 3</span></div>`;
  }

  function prepareDom() {
    const step1 = $('#checkoutStep1');
    const step2 = $('#checkoutStep2');
    const pickupSection = $('#finalPickupSection');
    if (!step1 || !step2 || !pickupSection) return false;

    step1.querySelector('.checkout-title')?.remove();
    if (!step1.querySelector('.checkout-progress')) {
      step1.insertAdjacentHTML('afterbegin', `${progressMarkup(1)}${introMarkup(1,'Sjekk bestillingen','Kontroller varene før du går videre.')}`);
    }

    step2.querySelector('.checkout-title')?.remove();
    if (!step2.querySelector('.checkout-progress')) {
      step2.insertAdjacentHTML('afterbegin', `${progressMarkup(2)}${introMarkup(2,'Kontaktinformasjon','Skriv inn navn og telefonnummer så vi kan kjenne igjen bestillingen din.')}`);
    }

    let step3 = $('#checkoutStep3');
    if (!step3) {
      step3 = document.createElement('div');
      step3.id = 'checkoutStep3';
      step3.hidden = true;
      step3.innerHTML = `${progressMarkup(3)}${introMarkup(3,'Når vil du hente?','Velg snarest mulig eller et tidspunkt som passer deg.')}`;
      step2.insertAdjacentElement('afterend', step3);
    }

    if (pickupSection.parentElement !== step3) step3.appendChild(pickupSection);
    $('#finalContactSection .final-section-head')?.setAttribute('hidden','');
    $('#finalPickupSection .final-section-head')?.setAttribute('hidden','');

    if (!pickupSection.querySelector('.checkout-pickup-help')) {
      pickupSection.insertAdjacentHTML('afterbegin','<p class="checkout-pickup-help">Bestillingen sendes først når du trykker <strong>Send bestilling</strong>.</p>');
    }
    return true;
  }

  function contactReady() {
    const contact = checkoutContactState();
    return Boolean(contact.nameOk && contact.phoneOk);
  }

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
    next.classList.toggle('ready',!next.disabled);
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

    const current = Math.min(3,Math.max(1,Number(state.checkout.step)||1));
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
    document.body.classList.toggle('hide-tabs',focused);
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

    state.checkout.step = 2;
    originalHandleCheckoutNext();
    if (state.cart.length && state.checkout.step === 2) {
      state.checkout.step = 3;
      renderCheckoutStep();
    }
  };

  function bindControls() {
    const next = $('#checkoutNext');
    const back = $('#checkoutBack');
    const cartScreen = $('#cartScreen');

    if (next) next.onclick = handleCheckoutNext;
    if (back) {
      back.onclick = () => {
        document.activeElement?.blur?.();
        state.checkout.step = Math.max(1,(Number(state.checkout.step)||1)-1);
        renderCheckoutStep();
      };
    }

    /* Capture-phase delegation makes the completed progress steps reliably clickable. */
    cartScreen?.addEventListener('click', event => {
      const button = event.target.closest?.('[data-checkout-step]');
      if (!button || !cartScreen.contains(button)) return;
      const target = Number(button.dataset.checkoutStep);
      const current = Number(state.checkout.step)||1;
      if (!target || target >= current) return;
      event.preventDefault();
      event.stopPropagation();
      document.activeElement?.blur?.();
      state.checkout.step = target;
      renderCheckoutStep();
    }, true);

    ['checkoutName','checkoutPhone'].forEach(id => {
      const input = document.getElementById(id);
      if (!input) return;
      input.addEventListener('input',()=>requestAnimationFrame(setNextButton));
      input.addEventListener('blur',()=>requestAnimationFrame(setNextButton));
    });
  }

  installStyles();
  if (prepareDom()) {
    bindControls();
    renderCheckoutStep();
  }
})();
