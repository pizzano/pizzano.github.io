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
      #cartScreen .checkout-progress {
        display:grid; grid-template-columns:repeat(3,1fr); gap:7px;
        margin:0 0 12px; padding:10px; border:1px solid #e9e4e0;
        border-radius:16px; background:#fff;
      }
      #cartScreen .checkout-progress-step {
        min-width:0; display:flex; align-items:center; gap:7px;
        color:#918781; font-size:11px; font-weight:750; line-height:1.15;
      }
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
      #checkoutStep2 .final-checkout-section,
      #checkoutStep3 .final-checkout-section { margin-top:0; }
      #checkoutStep2 #finalContactSection .final-section-head,
      #checkoutStep3 #finalPickupSection .final-section-head { display:none; }
      #checkoutStep3 .pickup-options { padding-top:2px; }
      #checkoutStep3 .checkout-pickup-help {
        margin:0 0 10px; color:#776e69; font-size:12px; line-height:1.45;
      }
      @media (max-width:420px) {
        #cartScreen .checkout-progress { gap:5px; padding:8px; }
        #cartScreen .checkout-progress-step { gap:5px; font-size:9.8px; }
        #cartScreen .checkout-progress-step i { width:23px; height:23px; flex-basis:23px; }
        #cartScreen .checkout-step-intro { padding:13px 12px; }
        #cartScreen .checkout-step-intro strong { font-size:15px; }
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
    return `<div class="checkout-progress" aria-label="Bestillingssteg">${items.map(([step, label]) => {
      const done = step < current;
      const cls = done ? 'done' : step === current ? 'active' : '';
      return `<div class="checkout-progress-step ${cls}"><i>${done ? '✓' : step}</i><span>${label}</span></div>`;
    }).join('')}</div>`;
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
