(() => {
  'use strict';

  const ua = navigator.userAgent || '';
  const isIOS = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isChromium = /Android|Chrome|Chromium|Edg|OPR|SamsungBrowser/i.test(ua) && !isIOS;

  const isStandalone = () =>
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    window.navigator.standalone === true;

  // iPhone/iPad Safari does not expose beforeinstallprompt. This button is
  // therefore only shown where the real browser install dialog can be used.
  if (!isChromium || isStandalone()) return;

  let deferredPrompt = null;
  let installCard = null;
  let installButton = null;

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

    .pwa-info-install-button:active:not(:disabled) {
      transform: scale(.99);
    }

    .pwa-info-install-button:disabled {
      opacity: .55;
      cursor: default;
    }
  `;
  document.head.appendChild(style);

  function setReady(ready) {
    if (!installButton) return;
    installButton.disabled = !ready;
    installButton.textContent = ready ? 'Installer app' : 'Klargjør installasjon…';
  }

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
        <span>Installer bestillingssiden på telefonen. Etterpå åpnes den som en app uten vanlig adressefelt.</span>
      </div>
      <button class="pwa-info-install-button" type="button" disabled>Klargjør installasjon…</button>
    `;

    installButton = installCard.querySelector('.pwa-info-install-button');

    const firstCard = infoView.querySelector('.card');
    if (firstCard) {
      firstCard.insertAdjacentElement('afterend', installCard);
    } else {
      infoView.appendChild(installCard);
    }

    installButton.addEventListener('click', async () => {
      if (!deferredPrompt) return;

      const promptEvent = deferredPrompt;
      deferredPrompt = null;
      setReady(false);

      try {
        await promptEvent.prompt();
        const choice = await promptEvent.userChoice;

        if (choice && choice.outcome === 'accepted') {
          installCard?.remove();
          installCard = null;
          installButton = null;
        }
      } catch (_) {
        // Browseren bestemmer når et nytt installasjonstilbud kan gis.
      }
    });

    setReady(Boolean(deferredPrompt));
    return installCard;
  }

  // Capture the browser's real install event so our Info button can open the
  // exact same native Android/Chromium installation dialog.
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event;
    ensureCard();
    setReady(true);
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    installCard?.remove();
    installCard = null;
    installButton = null;
  });

  // Keep the install option visible in Info even before Chrome has finished
  // checking installability. The button becomes active as soon as the native
  // beforeinstallprompt event arrives.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ensureCard, { once: true });
  } else {
    ensureCard();
  }
})();
