/* Reusable, side-effect-free customer display formatting. */
export function escapeHtml(text) {
  return String(text == null ? '' : text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function profileInitials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '';
  if (parts.length === 1) return parts[0].slice(0, 1).toLocaleUpperCase('no');
  return (parts[0][0] + parts[parts.length - 1][0]).toLocaleUpperCase('no');
}

export function formatProfilePhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '').slice(0, 8);
  if (!digits) return 'Kundeprofil';
  return '+47 ' + digits.replace(/(\d{2})(?=\d)/g, '$1 ').trim();
}

export function orderStatusClass(status) {
  const value = String(status || '').toLocaleLowerCase('no');
  if (value.includes('avvist')) return 'is-rejected';
  if (value.includes('klar')) return 'is-ready';
  if (value.includes('ferdig') || value.includes('fullført')) return 'is-done';
  if (value.includes('bekreftet') || value.includes('tilbered')) return 'is-active';
  return 'is-new';
}
