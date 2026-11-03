/* Customer startup fallback; feature rendering stays in customer.js.
   The fallback runs independently if the main module fails to load. */
'use strict';
(() => {
  const cover = document.getElementById('appStartup');
  const spinner = document.getElementById('startupSpinner');
  const title = document.getElementById('startupTitle');
  const note = document.getElementById('startupNote');
  const retry = document.getElementById('startupRetry');
  if (!cover || !spinner || !title || !note || !retry) return;

  window.showCustomerStartupError = () => {
    if (cover.hidden) return;
    spinner.hidden = true;
    title.textContent = 'Kunne ikke laste menyen';
    note.textContent = 'Sjekk internettforbindelsen og prøv igjen.';
    retry.hidden = false;
    cover.setAttribute('aria-busy', 'false');
  };
  retry.addEventListener('click', () => window.location.reload());
  window.customerStartupTimeout = window.setTimeout(window.showCustomerStartupError, 16000);
})();
