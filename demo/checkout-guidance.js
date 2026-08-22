/* KØL checkout guidance — keep final send clickable, but require pickup choice */
(() => {
  'use strict';
  if (window.__KOL_CHECKOUT_GUIDANCE__) return;
  window.__KOL_CHECKOUT_GUIDANCE__ = true;

  const previousRenderCheckoutStep = renderCheckoutStep;
  const previousSyncCheckoutValidation = syncCheckoutValidation;
  const previousHandleCheckoutNext = handleCheckoutNext;

  function installStyles() {
    const style = document.createElement('style');
    style.id = 'kol-checkout-guidance-styles';
    style.textContent = `
      #checkoutStep3 .pickup-choice-warning {
        display:none;
        margin:0 0 10px;
        padding:10px 12px;
        border:1px solid #f0b59d;
        border-radius:11px;
        background:#fff5f0;
        color:#b94b24;
        font-size:12px;
        font-weight:650;
        line-height:1.4;
      }
      #checkoutStep3 .pickup-choice-warning.show { display:block; }
      #checkoutStep3 #finalPickupSection.pickup-attention {
        border-color:#f36a2d !important;
        box-shadow:0 0 0 3px rgba(243,106,45,.12), 0 3px 12px rgba(43,35,31,.025) !important;
      }
      #checkoutStep3 #finalPickupSection.pickup-attention .pickup-mode-btn {
        animation:kolPickupNudge .28s ease 2;
      }
      @keyframes kolPickupNudge {
        0%,100% { transform:translateX(0); }
        50% { transform:translateX(3px); }
      }
      #checkoutNext.needs-pickup-choice {
        background:#f5b091 !important;
        color:#fff !important;
        opacity:1 !important;
        cursor:pointer !important;
        pointer-events:auto !important;
      }
    `;
    document.head.appendChild(style);
  }

  function ensureWarning() {
    const section = document.getElementById('finalPickupSection');
    if (!section) return null;
    let warning = section.querySelector('.pickup-choice-warning');
    if (!warning) {
      warning = document.createElement('div');
      warning.className = 'pickup-choice-warning';
      warning.setAttribute('role', 'alert');
      warning.setAttribute('aria-live', 'assertive');
      warning.textContent = 'Velg hentetid før du sender bestillingen.';
      const options = document.getElementById('pickupOptions');
      if (options) section.insertBefore(warning, options);
      else section.prepend(warning);
    }
    return warning;
  }

  function hideWarning() {
    ensureWarning()?.classList.remove('show');
    document.getElementById('finalPickupSection')?.classList.remove('pickup-attention');
  }

  function focusPickupChoice() {
    const section = document.getElementById('finalPickupSection');
    const warning = ensureWarning();
    if (!section || !warning) return;

    warning.classList.add('show');
    section.classList.remove('pickup-attention');
    void section.offsetWidth;
    section.classList.add('pickup-attention');
    section.scrollIntoView({ behavior:'smooth', block:'center' });

    window.setTimeout(() => {
      section.querySelector('.pickup-mode-btn')?.focus({ preventScroll:true });
    }, 260);
  }

  function syncFinalButton() {
    const next = document.getElementById('checkoutNext');
    if (!next || Number(state.checkout.step) !== 3) return;

    const ready = pickupReady();
    if (!ready) {
      next.disabled = false;
      next.classList.remove('ready');
      next.classList.add('needs-pickup-choice');
      next.style.opacity = '1';
      next.style.cursor = 'pointer';
      next.setAttribute('aria-disabled', 'true');
    } else {
      next.disabled = false;
      next.classList.remove('needs-pickup-choice');
      next.classList.add('ready');
      next.removeAttribute('aria-disabled');
      hideWarning();
    }
  }

  syncCheckoutValidation = function syncCheckoutValidationWithGuidance() {
    previousSyncCheckoutValidation();
    syncFinalButton();
  };

  renderCheckoutStep = function renderCheckoutStepWithGuidance() {
    previousRenderCheckoutStep();
    ensureWarning();
    syncFinalButton();
  };

  handleCheckoutNext = function handleCheckoutNextWithGuidance() {
    if (Number(state.checkout.step) === 3 && !pickupReady()) {
      focusPickupChoice();
      syncFinalButton();
      return;
    }
    previousHandleCheckoutNext();
  };

  function bind() {
    const next = document.getElementById('checkoutNext');
    if (next) next.onclick = handleCheckoutNext;

    const pickup = document.getElementById('pickupOptions');
    if (pickup) {
      pickup.addEventListener('click', () => {
        requestAnimationFrame(() => {
          if (pickupReady()) hideWarning();
          syncFinalButton();
        });
      });
    }
  }

  installStyles();
  ensureWarning();
  bind();
  syncFinalButton();
})();
