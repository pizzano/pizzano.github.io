(() => {
  'use strict';

  // Customer-side enhancements that sit on top of the main app module.
  if (!document.getElementById('allergenUiModule')) {
    const script = document.createElement('script');
    script.id = 'allergenUiModule';
    script.type = 'module';
    script.src = '/demo/js/allergen-ui.js?v=20260908-4';
    document.head.appendChild(script);
  }

  const isStandalone = () =>
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    window.navigator.standalone === true;

  if (isStandalone()) return;

  let deferredPrompt = null;
  let installCard = null;

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
        // Native install UI is controlled by the browser.
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
