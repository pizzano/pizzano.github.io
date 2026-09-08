(() => {
  'use strict';

  const ua = navigator.userAgent || '';
  const isAndroid = /Android/i.test(ua);
  const isIOS = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isMobile = isAndroid || isIOS;

  const isStandalone = () =>
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    window.navigator.standalone === true;

  if (!isMobile || isStandalone()) return;

  let deferredPrompt = null;
  let installCard = null;
  let helpModal = null;

  const style = document.createElement('style');
  style.textContent = `
    .pwa-install-card {
      display: grid;
      grid-template-columns: 44px minmax(0, 1fr) auto 30px;
      align-items: center;
      gap: 10px;
      margin-top: 12px;
      padding: 12px 10px 12px 12px;
      background: #fff8f3;
      border: 1px solid rgba(238, 103, 18, .22);
      border-radius: 16px;
      box-shadow: 0 5px 18px rgba(36, 25, 20, .07);
    }
    .pwa-install-icon {
      width: 44px;
      height: 44px;
      border-radius: 12px;
      display: grid;
      place-items: center;
      background: #ef6812;
      color: #fff;
      font-size: 23px;
      font-weight: 800;
      box-shadow: 0 4px 12px rgba(239, 104, 18, .22);
    }
    .pwa-install-copy {
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 2px;
      line-height: 1.2;
    }
    .pwa-install-copy strong {
      color: #2f2723;
      font-size: 14px;
    }
    .pwa-install-copy span {
      color: #746b66;
      font-size: 12px;
    }
    .pwa-install-btn {
      border: 0;
      border-radius: 11px;
      padding: 10px 13px;
      background: #ef6812;
      color: #fff;
      font: inherit;
      font-size: 13px;
      font-weight: 800;
      white-space: nowrap;
      cursor: pointer;
    }
    .pwa-install-close {
      width: 30px;
      height: 30px;
      border: 0;
      border-radius: 50%;
      background: transparent;
      color: #8b817b;
      font-size: 22px;
      line-height: 1;
      cursor: pointer;
    }
    .pwa-install-help-backdrop {
      position: fixed;
      inset: 0;
      z-index: 30000;
      display: grid;
      align-items: end;
      background: rgba(24, 17, 13, .48);
      padding: 16px;
      padding-bottom: calc(16px + env(safe-area-inset-bottom));
    }
    .pwa-install-help {
      width: min(100%, 520px);
      margin: 0 auto;
      background: #fff;
      border-radius: 22px;
      padding: 20px;
      box-shadow: 0 18px 60px rgba(0, 0, 0, .24);
    }
    .pwa-install-help-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      margin-bottom: 12px;
    }
    .pwa-install-help h2 {
      margin: 0;
      font-size: 20px;
      color: #2f2723;
    }
    .pwa-install-help-x {
      width: 36px;
      height: 36px;
      border: 0;
      border-radius: 50%;
      background: #f2efed;
      color: #4a413c;
      font-size: 24px;
    }
    .pwa-install-help p {
      margin: 0 0 14px;
      color: #665e59;
      line-height: 1.45;
      font-size: 14px;
    }
    .pwa-install-steps {
      display: grid;
      gap: 10px;
      margin: 0;
      padding: 0;
      list-style: none;
      counter-reset: pwa-step;
    }
    .pwa-install-steps li {
      counter-increment: pwa-step;
      display: grid;
      grid-template-columns: 30px 1fr;
      align-items: center;
      gap: 10px;
      color: #332b27;
      font-size: 14px;
    }
    .pwa-install-steps li::before {
      content: counter(pwa-step);
      width: 30px;
      height: 30px;
      display: grid;
      place-items: center;
      border-radius: 50%;
      background: #fff0e6;
      color: #df5d0d;
      font-weight: 800;
    }
    .pwa-install-done {
      width: 100%;
      margin-top: 18px;
      border: 0;
      border-radius: 13px;
      padding: 13px 16px;
      background: #33251f;
      color: #fff;
      font: inherit;
      font-weight: 800;
    }
    @media (max-width: 390px) {
      .pwa-install-card {
        grid-template-columns: 40px minmax(0, 1fr) auto 26px;
        gap: 8px;
        padding-left: 10px;
      }
      .pwa-install-icon { width: 40px; height: 40px; }
      .pwa-install-copy span { display: none; }
      .pwa-install-btn { padding: 9px 10px; }
    }
  `;
  document.head.appendChild(style);

  function hideCard() {
    if (installCard) installCard.hidden = true;
  }

  function showHelp() {
    if (helpModal) {
      helpModal.hidden = false;
      return;
    }

    const iosSteps = `
      <li>Trykk på <strong>Del</strong>-ikonet i nettleseren.</li>
      <li>Velg <strong>Legg til på Hjem-skjermen</strong>.</li>
      <li>Trykk <strong>Legg til</strong>. Åpne deretter KØL-ikonet fra hjemskjermen.</li>
    `;
    const androidSteps = `
      <li>Åpne nettlesermenyen <strong>⋮</strong>.</li>
      <li>Velg <strong>Installer app</strong> eller <strong>Legg til på startskjermen</strong>.</li>
      <li>Bekreft. Åpne deretter KØL-ikonet fra hjemskjermen.</li>
    `;

    helpModal = document.createElement('div');
    helpModal.className = 'pwa-install-help-backdrop';
    helpModal.innerHTML = `
      <section class="pwa-install-help" role="dialog" aria-modal="true" aria-label="Legg KØL til på hjemskjermen">
        <div class="pwa-install-help-head">
          <h2>Legg KØL på hjemskjermen</h2>
          <button class="pwa-install-help-x" type="button" aria-label="Lukk">×</button>
        </div>
        <p>Da åpnes bestillingssiden som en app, uten vanlig adressefelt i nettleseren.</p>
        <ol class="pwa-install-steps">${isIOS ? iosSteps : androidSteps}</ol>
        <button class="pwa-install-done" type="button">Skjønner</button>
      </section>
    `;

    const close = () => { helpModal.hidden = true; };
    helpModal.querySelector('.pwa-install-help-x').addEventListener('click', close);
    helpModal.querySelector('.pwa-install-done').addEventListener('click', close);
    helpModal.addEventListener('click', (event) => {
      if (event.target === helpModal) close();
    });
    document.body.appendChild(helpModal);
  }

  async function installApp() {
    if (deferredPrompt) {
      const promptEvent = deferredPrompt;
      deferredPrompt = null;
      try {
        await promptEvent.prompt();
        const choice = await promptEvent.userChoice;
        if (choice && choice.outcome === 'accepted') hideCard();
      } catch (_) {
        showHelp();
      }
      return;
    }
    showHelp();
  }

  function mountCard() {
    if (isStandalone() || installCard) return;
    const host = document.querySelector('.menu-overview');
    if (!host) return;

    installCard = document.createElement('div');
    installCard.className = 'pwa-install-card';
    installCard.innerHTML = `
      <div class="pwa-install-icon" aria-hidden="true">↗</div>
      <div class="pwa-install-copy">
        <strong>Bruk KØL som app</strong>
        <span>Legg siden på hjemskjermen</span>
      </div>
      <button class="pwa-install-btn" type="button">${isIOS ? 'Legg til' : 'Installer'}</button>
      <button class="pwa-install-close" type="button" aria-label="Skjul">×</button>
    `;
    installCard.querySelector('.pwa-install-btn').addEventListener('click', installApp);
    installCard.querySelector('.pwa-install-close').addEventListener('click', () => {
      installCard.hidden = true;
    });
    host.appendChild(installCard);
  }

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event;
    mountCard();
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    hideCard();
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountCard, { once: true });
  } else {
    mountCard();
  }
})();
