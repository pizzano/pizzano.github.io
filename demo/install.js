(() => {
  'use strict';

  const allergenStyles = document.createElement('link');
  allergenStyles.rel = 'stylesheet';
  allergenStyles.href = '/demo/allergen-modal.css?v=20260908-2';
  document.head.appendChild(allergenStyles);

  function commitAllergenSelectionWithoutClosing() {
    const modal = document.getElementById('allergenModal');
    const saveButton = document.getElementById('allergenSave');
    const openButton = document.getElementById('btnAllergens');

    if (!modal || modal.hidden || !saveButton || !openButton) return;

    // Bruk appens eksisterende lagring/rendering, men åpne velgeren igjen
    // i samme event-loop slik at brukeren ikke ser en lukking mellom valgene.
    saveButton.click();
    openButton.click();
  }

  document.addEventListener('click', (event) => {
    const allergenChoice = event.target.closest('#allergenPicker [data-allergen]');
    const resetButton = event.target.closest('#allergenReset');

    if (!allergenChoice && !resetButton) return;

    // Appens egen click-handler må først få oppdatere valgt/ikke valgt-status.
    setTimeout(commitAllergenSelectionWithoutClosing, 0);
  });

  const isStandalone = () =>
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    window.navigator.standalone === true;

  if (isStandalone()) return;

  let deferredPrompt = null;
  let installCard = null;

  const style = document.createElement('style');
  style.textContent = `
    .pwa-info-install-card {
      display: grid;
      grid-template-columns: 52px minmax(0, 1fr);
      gap: 12px;
      align-items: center;
      border: 1px solid rgba(239, 104, 18, .18);
      background: #fffaf6;
    }

    .pwa-info-install-icon {
      width: 52px;
      height: 52px;
      border-radius: 15px;
      display: grid;
      place-items: center;
      background: #33251f;
      overflow: hidden;
    }

    .pwa-info-install-icon img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .pwa-info-install-copy {
      min-width: 0;
    }

    .pwa-info-install-copy strong {
      display: block;
      margin-bottom: 4px;
      font-size: 17px;
      color: #2f2723;
    }

    .pwa-info-install-copy span {
      display: block;
      color: #746b66;
      font-size: 13px;
      line-height: 1.4;
    }

    .pwa-info-install-button {
      grid-column: 1 / -1;
      width: 100%;
      border: 0;
      border-radius: 14px;
      padding: 14px 16px;
      margin-top: 3px;
      background: #ef6812;
      color: #fff;
      font: inherit;
      font-size: 15px;
      font-weight: 800;
      cursor: pointer;
    }

    .pwa-info-install-button:active {
      transform: scale(.99);
    }
  `;
  document.head.appendChild(style);

  function removeCard() {
    installCard?.remove();
    installCard = null;
  }

  function showInstallCard() {
    if (!deferredPrompt || installCard || isStandalone()) return;

    const infoView = document.getElementById('viewInfo');
    if (!infoView) return;

    installCard = document.createElement('div');
    installCard.className = 'card pwa-info-install-card';
    installCard.innerHTML = `
      <div class="pwa-info-install-icon" aria-hidden="true">
        <img src="/demo/icons/kol-icon-192.png" alt="">
      </div>
      <div class="pwa-info-install-copy">
        <strong>Installer KØL-appen</strong>
        <span>Installer bestillingssiden på enheten og åpne den som en app uten vanlig adressefelt.</span>
      </div>
      <button class="pwa-info-install-button" type="button">Installer app</button>
    `;

    const cards = infoView.querySelectorAll('.card');
    const lastInfoCard = cards[cards.length - 1];
    const staffAccess = infoView.querySelector('.staff-access');

    if (lastInfoCard) lastInfoCard.insertAdjacentElement('afterend', installCard);
    else if (staffAccess) staffAccess.insertAdjacentElement('beforebegin', installCard);
    else infoView.appendChild(installCard);

    installCard.querySelector('.pwa-info-install-button').addEventListener('click', async () => {
      if (!deferredPrompt) {
        removeCard();
        return;
      }

      const promptEvent = deferredPrompt;
      deferredPrompt = null;

      try {
        await promptEvent.prompt();
        await promptEvent.userChoice;
      } catch (_) {
        // Native prompt is controlled by the browser.
      }

      removeCard();
    });
  }

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event;
    showInstallCard();
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    removeCard();
  });
})();
