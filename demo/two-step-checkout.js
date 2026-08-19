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

  const title = step2.querySelector('.checkout-title');
  const titleStrong = title?.querySelector('strong');
  const titleSmall = title?.querySelector('small');
  if (titleStrong) titleStrong.textContent = 'Fullfør bestilling';
  if (titleSmall) titleSmall.textContent = 'Hentetid og kontaktinformasjon.';

  const pickupSection = document.createElement('section');
  pickupSection.className = 'final-checkout-section';
  pickupSection.id = 'finalPickupSection';
  pickupSection.innerHTML = '<div class="final-section-head"><span>1</span><div><strong>Hentetid</strong><small>Velg når du ønsker å hente.</small></div></div>';
  pickupSection.appendChild(pickupOptions);

  const contactSection = document.createElement('section');
  contactSection.className = 'final-checkout-section';
  contactSection.id = 'finalContactSection';
  const contactHead = document.createElement('div');
  contactHead.className = 'final-section-head';
  contactHead.innerHTML = '<span>2</span><div><strong>Kontaktinformasjon</strong></div>';
  if (loginHint) contactHead.lastElementChild.appendChild(loginHint);
  contactSection.appendChild(contactHead);
  contactSection.appendChild(contactGrid);

  step2.appendChild(pickupSection);
  step2.appendChild(contactSection);
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

  syncCheckoutValidation = function () {
    const s = checkoutContactState();
    const ready = s.nameOk && s.phoneOk;
    const nf = document.querySelector('#checkoutNameField');
    const pf = document.querySelector('#checkoutPhoneField');
    const card = document.querySelector('#checkoutConfirmCard');
    nf?.classList.toggle('valid', s.nameOk);
    pf?.classList.toggle('valid', s.phoneOk);
    if (card) card.hidden = !ready;
    pickupSection.classList.toggle('is-complete', !!pickupChoice);
    contactSection.classList.toggle('is-complete', ready);
    const badge = step2.querySelector('.checkout-title > span');
    if (badge) {
      badge.textContent = ready ? '✓' : '2';
      badge.classList.toggle('step-ok', ready);
    }
    if (checkoutStep === 2) {
      const next = document.querySelector('#checkoutNext');
      if (next) {
        next.disabled = !ready;
        next.classList.toggle('ready', ready);
        next.style.background = ready ? '' : '#d4cfcb';
        next.style.opacity = ready ? '1' : '.78';
        next.style.cursor = ready ? 'pointer' : 'not-allowed';
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
        syncCheckoutValidation();
      }));
      p.addEventListener('focus', () => bringIntoView(p));
      p.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
          e.preventDefault();
          p.blur();
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

    if (step1Badge) {
      step1Badge.textContent = cart.length ? '✓' : '1';
      step1Badge.classList.toggle('step-ok', !!cart.length);
    }
    if (step2Badge) {
      step2Badge.textContent = contact.nameOk && contact.phoneOk ? '✓' : '2';
      step2Badge.classList.toggle('step-ok', contact.nameOk && contact.phoneOk);
    }

    const next = document.querySelector('#checkoutNext');
    if (next) {
      next.textContent = checkoutStep === 2 ? 'Send bestilling' : 'Neste';
      next.disabled = (checkoutStep === 1 && !cart.length) || (checkoutStep === 2 && !(contact.nameOk && contact.phoneOk));
      next.style.background = next.disabled ? '#d4cfcb' : '';
      next.style.opacity = next.disabled ? '.78' : '1';
      next.style.cursor = next.disabled ? 'not-allowed' : 'pointer';
      next.classList.toggle('ready', !next.disabled);
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
      if (!c.nameOk || !c.phoneOk) {
        syncCheckoutValidation();
        return;
      }
      document.activeElement?.blur?.();
      placeOrder();
    };
  }

  bindCheckoutValidation();
  renderCheckoutStep();
})();
