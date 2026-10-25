/**
 * Order links follow the deployed page URL, never a hard-coded domain or /demo/.
 *
 * https://site.no/demo/index.html -> https://site.no/demo/
 * https://site.no/demo/admin.html -> https://site.no/demo/
 * https://site.no/index.html      -> https://site.no/
 * https://other.no/shop/          -> https://other.no/shop/
 */
export function customerPageBaseUrl(pageUrl = window.location.href) {
  const current = new URL(pageUrl);
  if (!['https:', 'http:'].includes(current.protocol)) {
    throw new Error('Ugyldig adresse til bestillingssiden.');
  }
  const path = current.pathname;
  const directory = path.endsWith('/')
    ? path
    : path.slice(0, path.lastIndexOf('/') + 1);
  return current.origin + directory;
}

export function customerOrderLink(orderId, pageUrl = window.location.href) {
  const id = String(orderId || '').trim();
  if (!/^ord_[a-zA-Z0-9]{7,40}$/.test(id)) {
    throw new Error('Ugyldig bestillings-ID.');
  }
  const link = new URL(customerPageBaseUrl(pageUrl));
  link.searchParams.set('order', id);
  return link.href;
}
