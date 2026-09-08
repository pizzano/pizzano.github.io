(() => {
  'use strict';

  const ua = navigator.userAgent || '';
  const isAndroid = /Android/i.test(ua);

  const isStandalone = () =>
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    window.navigator.standalone === true;

  if (!isAndroid || isStandalone()) return;

  let deferredPrompt = null;
  let installCard = null;

  const style = document.createElement('style');
  style.textContent = `
    .pwa-info-install-card {
      display: none;
      gap: 12px;
      align-items: center;
    }

    .pwa-info-install-card.is-ready {
      display: grid;
      grid-template-columns: 48px minmax(0, 1fr);
    }

    .pwa-info-install-icon {
      width: 48px;
      height: 48px;
      border-radius: 14px;
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
      margin-bottom: 3px;
      font-size: 16px;
      color: #2f2723;
    }

    .pwa-info-install-copy span {
      display: block;
      color: #746b66;
      font-size: 13px;
      line-height: 1.35;
    }

    .pwa-info-install-button {
      grid-column: 1 / -1;
      width: 100%;
      border: 0;
      border-radius: 14px;
      padding: 14px 16px;
      margin-top: 2px;
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

  function ensureCard() {
    if (installCard) return installCard;

    const infoView = document.getElementById('viewInfo');
    if (!infoView) return null;

    installCard = document.createElement('div');
    installCard.className = 'card pwa-info-install-card';
    installCard.innerHTML = `
      <div class="pwa-info-install-icon" aria-hidden="true">
        <img src="/demo/icons/kol-icon-192.png" alt="">
      </div>
      <div class="pwa-info-install-copy">
        <strong>Installer KØL-appen</strong>
        <span>Legg bestillingssiden på startskjermen og åpne den uten vanlig adressefelt.</span>
      </div>
      <button class="pwa-info-install-button" type="button">Installer app</button>
    `;

    const firstCard = infoView.querySelector('.card');
    if (firstCard) {
      firstCard.insertAdjacentElement('afterend', installCard);
    } else {
      infoView.appendChild(installCard);
    }

    installCard.querySelector('.pwa-info-install-button').addEventListener('click', async () => {
      if (!deferredPrompt) return;

      const promptEvent = deferredPrompt;
      deferredPrompt = null;

      try {
        await promptEvent.prompt();
        const choice = await promptEvent.userChoice;

        if (choice && choice.outcome === 'accepted') {
          installCard?.remove();
          installCard = null;
        } else {
          // Chrome bruker prompt-eventet kun én gang. Dersom brukeren avbryter,
          // skjuler vi knappen til nettleseren tilbyr installasjon på nytt.
          installCard?.classList.remove('is-ready');
        }
      } catch (_) {
        installCard?.classList.remove('is-ready');
      }
    });

    return installCard;
  }

  window.addEventListener('beforeinstallprompt', (event) => {
    // Vi stopper bare nettleserens tilfeldige/menybaserte håndtering slik at
    // den samme ekte Android-installasjonsdialogen kan åpnes fra vår Info-knapp.
    event.preventDefault();
    deferredPrompt = event;

    const card = ensureCard();
    if (card) card.classList.add('is-ready');
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    installCard?.remove();
    installCard = null;
  });
})();
