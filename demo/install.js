(() => {
  'use strict';

  const ua = navigator.userAgent || '';
  const isIOS = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isOpera = /OPR\//i.test(ua) || /Opera/i.test(ua);
  const isChromium = /Android|Chrome|Chromium|Edg|OPR|SamsungBrowser/i.test(ua) && !isIOS;

  const isStandalone = () =>
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    window.navigator.standalone === true;

  if (!isChromium || isStandalone()) return;

  let deferredPrompt = null;
  let installCard = null;
  let installButton = null;
  let installHelp = null;

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

    .pwa-info-install-help {
      grid-column: 1 / -1;
      margin: 0;
      padding: 12px 14px;
      border-radius: 12px;
      background: #f4eee9;
      color: #4d433d;
      font-size: 13px;
      line-height: 1.45;
    }
  `;
  document.head.appendChild(style);

  function setReady(ready) {
    if (!installButton) return;
    installButton.disabled = !ready;
    installButton.textContent = ready ? 'Installer app' : 'Klargjør installasjon…';
  }

  function setOperaFallback() {
    if (!installButton || deferredPrompt) return;
    installButton.disabled = false;
    installButton.textContent = 'Installer via Opera';
  }

  function showOperaHelp() {
    if (!installHelp) return;
    installHelp.hidden = false;
    installHelp.innerHTML = 'Opera gir ikke nettsiden tilgang til den native installasjonsdialogen. Trykk <strong>⋮</strong> i Opera og velg <strong>Installer app</strong> eller <strong>Legg til på startskjermen</strong>.';
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
      <p class="pwa-info-install-help" hidden></p>
    `;

    installButton = installCard.querySelector('.pwa-info-install-button');
    installHelp = installCard.querySelector('.pwa-info-install-help');

    const firstCard = infoView.querySelector('.card');
    if (firstCard) {
      firstCard.insertAdjacentElement('afterend', installCard);
    } else {
      infoView.appendChild(installCard);
    }

    installButton.addEventListener('click', async () => {
      if (!deferredPrompt) {
        if (isOpera) showOperaHelp();
        return;
      }

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
          installHelp = null;
          return;
        }
      } catch (_) {
        // Browseren bestemmer når et nytt installasjonstilbud kan gis.
      }

      if (isOpera) setOperaFallback();
    });

    if (deferredPrompt) setReady(true);
    else if (isOpera) setOperaFallback();
    else setReady(false);

    return installCard;
  }

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event;
    ensureCard();
    if (installHelp) installHelp.hidden = true;
    setReady(true);
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    installCard?.remove();
    installCard = null;
    installButton = null;
    installHelp = null;
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ensureCard, { once: true });
  } else {
    ensureCard();
  }
})();
