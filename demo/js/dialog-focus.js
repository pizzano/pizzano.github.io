/* Shared keyboard focus control for customer/admin overlays.
 * No global listeners: callers decide which dialog is active. */
const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),' +
  'textarea:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

export function dialogFocusables(dialog) {
  if (!dialog || dialog.hidden) return [];
  return [...dialog.querySelectorAll(FOCUSABLE)].filter(element =>
    !element.closest('[hidden]') && element.getClientRects().length > 0
  );
}

export function focusDialog(dialog) {
  if (!dialog || dialog.hidden) return;
  const first = dialogFocusables(dialog)[0];
  (first || dialog).focus({ preventScroll: true });
}

export function trapDialogTab(event, dialog) {
  if (event.key !== 'Tab' || !dialog || dialog.hidden) return false;
  const items = dialogFocusables(dialog);
  const first = items[0] || dialog;
  const last = items.at(-1) || first;
  const outside = !dialog.contains(document.activeElement);
  if (event.shiftKey && (outside || document.activeElement === first)) {
    event.preventDefault();
    last.focus({ preventScroll: true });
  } else if (!event.shiftKey && (outside || document.activeElement === last)) {
    event.preventDefault();
    first.focus({ preventScroll: true });
  }
  return true;
}
