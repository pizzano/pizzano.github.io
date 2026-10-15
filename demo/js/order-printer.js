/**
 * Epson TM-T20II / ePOS-Print, kun for /demo/Bestillinger.
 * Samme HTTPS SOAP-endepunkt som den fungerende test-printer.html.
 * Dette modulet endrer aldri bestilling, SMS eller e-post.
 */

const EPSON_DEFAULT = {
  host: '192.168.1.25',
  scheme: 'https',
  deviceId: 'local_printer'
};
const EPOS_NS = 'http://www.epson-pos.com/schemas/2011/03/epos-print';
const CHARS = 40;

function xml(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function wrap(text, width = CHARS) {
  const result = [];
  for (const paragraph of String(text ?? '').split(/\r?\n/)) {
    let current = '';
    for (const word of paragraph.trim().split(/\s+/).filter(Boolean)) {
      if (current && current.length + 1 + word.length > width) {
        result.push(current);
        current = '';
      }
      if (word.length > width) {
        if (current) { result.push(current); current = ''; }
        for (let i = 0; i < word.length; i += width) result.push(word.slice(i, i + width));
      } else {
        current = current ? current + ' ' + word : word;
      }
    }
    result.push(current);
  }
  return result;
}

function text(value) { return '<text>' + xml(value) + '&#10;</text>'; }
function rows(value, indent = '') {
  return wrap(value, CHARS - indent.length).map(line => text(indent + line)).join('');
}
function separator() { return text('-'.repeat(CHARS)); }
function bold(on) { return '<text em="' + (on ? 'true' : 'false') + '"/>'; }
function align(where) { return '<text align="' + where + '"/>'; }
function size(multiplier) { return '<text width="' + multiplier + '" height="' + multiplier + '"/>'; }
function money(amount) {
  const value = Number(amount);
  return (Number.isFinite(value) ? value : 0).toLocaleString('nb-NO', {
    minimumFractionDigits: 2, maximumFractionDigits: 2
  }) + ' kr';
}
function twoColumns(left, right) {
  const l = String(left || '').trim();
  const r = String(right || '').trim();
  if (l.length + 1 + r.length <= CHARS) {
    return text(l + ' '.repeat(CHARS - l.length - r.length) + r);
  }
  return rows(l) + text(r.padStart(CHARS, ' '));
}
function dateTime(time) {
  const stamp = Number(time);
  return stamp > 0 ? new Intl.DateTimeFormat('nb-NO', {
    timeZone: 'Europe/Oslo', day: 'numeric', month: 'long',
    hour: '2-digit', minute: '2-digit'
  }).format(new Date(stamp)) : '—';
}
function isScheduled(order) {
  return order.pickupMode === 'scheduled' || /^\d{1,2}:\d{2}$/.test(String(order.pickup || ''));
}
function pickupLabel(order) {
  if (isScheduled(order)) {
    const requested = String(order.pickup || '').trim();
    const scheduled = Number(order.scheduledPickupAt) || Number(order.estimatedReadyAt);
    return requested && /^\d{1,2}:\d{2}$/.test(requested)
      ? 'Kl. ' + requested
      : dateTime(scheduled);
  }
  return 'Snarest';
}
function receiptXml(order, reprint = false) {
  const id = String(order.id || '').trim();
  if (!id) throw new Error('Bestillingen har ikke et nummer.');
  const customerName = String(order.customerName || '').trim();
  const parts = customerName.split(/\s+/).filter(Boolean);
  const firstName = parts.shift() || '—';
  const lastName = parts.join(' ') || '—';
  const total = Number(order.total) || 0;
  const subtotal = Number(order.subtotal);
  const priceLines = Array.isArray(order.lines) ? order.lines : [];
  const acceptedAt = Number(order.estimatedAt) || (
    ['bekreftet', 'tilberedning'].includes(order.status) ? Number(order.statusUpdatedAt) : 0
  );

  let out = align('center') + size(2) + bold(true) + text('KØL GRILL & PIZZA') +
    size(1) + bold(false) + text('HENTING · KJØKKEN') +
    (reprint ? bold(true) + text('*** KOPI / NY UTSKRIFT ***') + bold(false) : '') +
    text('Bestilling #' + id.slice(-6).toUpperCase()) + separator() + align('left');

  const pickup = pickupLabel(order);
  out += bold(true) + twoColumns('Henting', isScheduled(order) ? 'PLANLAGT' : 'SNAREST');
  out += twoColumns(pickup, !isScheduled(order) && Number(order.estimatedMinutes) > 0
    ? String(Number(order.estimatedMinutes)) + ' min' : '') + bold(false);
  const pickupTime = Number(order.estimatedReadyAt) || Number(order.scheduledPickupAt) || 0;
  if (pickupTime) out += twoColumns('Forventet klar', dateTime(pickupTime));
  out += twoColumns('Mottatt', dateTime(order.createdAt));
  out += separator() + bold(true) + text('BESTILTE VARER') + bold(false);

  for (const line of priceLines) {
    const qty = Math.max(1, Number(line.quantity) || 1);
    const name = String(line.name || 'Produkt');
    out += bold(true) + twoColumns(qty + ' x ' + name, money(line.price)) + bold(false);
    if (line.size) out += rows('Størrelse: ' + line.size, '  ');
    const details = Array.isArray(line.optionDetails) ? line.optionDetails : [];
    if (details.length) {
      for (const opt of details) {
        if (!opt || !opt.label) continue;
        const descriptor = (opt.groupTitle ? opt.groupTitle + ': ' : '') + opt.label;
        const extra = Number(opt.price) || 0;
        out += rows('+ ' + descriptor + (extra > 0 ? ' (+' + money(extra) + ' per stk.)' : ''), '  ');
      }
    } else {
      for (const opt of Array.isArray(line.options) ? line.options : []) {
        if (opt) out += rows('+ ' + (typeof opt === 'string' ? opt : opt.label || ''), '  ');
      }
    }
    if (Array.isArray(line.removedIngredients) && line.removedIngredients.length) {
      out += rows('UTEN: ' + line.removedIngredients.join(', '), '  ');
    }
    if (line.comment) out += rows('Kommentar: ' + line.comment, '  ');
    if (line.loyaltyFree) out += rows('Gratis pizza / lojalitetsbonus', '  ');
    out += text('');
  }
  if (order.comment) out += bold(true) + rows('ORDREKOMMENTAR: ' + order.comment) + bold(false);
  out += separator() + bold(true) + text('BESTILLINGSDETALJER') + bold(false);
  out += twoColumns('Nummer:', id);
  out += twoColumns('Bekreftet kl.:', dateTime(acceptedAt));
  out += twoColumns('Fornavn:', firstName);
  out += twoColumns('Etternavn:', lastName);
  out += twoColumns('Telefon:', String(order.phone || 'Ikke oppgitt'));
  out += separator();
  if (Number.isFinite(subtotal) && subtotal > 0) out += twoColumns('Delsum', money(subtotal));
  out += twoColumns('Herav MVA (15 %)', money(total * 15 / 115));
  out += bold(true) + twoColumns('TOTALT', money(total)) + bold(false);
  out += align('center') + text('') + text('KØL Grill & Pizza') + '<feed line="3"/><cut type="feed"/>';
  return out;
}

function printerSettings() {
  let host = EPSON_DEFAULT.host;
  let scheme = EPSON_DEFAULT.scheme;
  let deviceId = EPSON_DEFAULT.deviceId;
  // Reuse values set on the independent demo printer test page when available.
  try {
    host = localStorage.getItem('kol_test_printer_ip') || host;
    scheme = localStorage.getItem('kol_test_printer_scheme') || scheme;
    deviceId = localStorage.getItem('kol_test_printer_device') || deviceId;
  } catch {}
  if (!/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host) || host.split('.').some(part => Number(part) > 255)) {
    throw new Error('Ugyldig IP-adresse for kvitteringsskriver.');
  }
  if (!['http', 'https'].includes(scheme) || !/^[\w-]{1,48}$/.test(deviceId)) {
    throw new Error('Ugyldige skriverinnstillinger.');
  }
  return { host, scheme, deviceId };
}

export async function printKitchenTicket(order, { reprint = false } = {}) {
  const config = printerSettings();
  const endpoint = config.scheme + '://' + config.host +
    '/cgi-bin/epos/service.cgi?devid=' + encodeURIComponent(config.deviceId) + '&timeout=10000';
  const content = receiptXml(order, reprint);
  // Epson TM-T20II ePOS-Print 5.0 uses the SOAP envelope proven by /demo/test-printer.html.
  const body = '<?xml version="1.0" encoding="UTF-8"?>' +
    '<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body>' +
    '<epos-print xmlns="' + EPOS_NS + '">' + content +
    '</epos-print></s:Body></s:Envelope>';

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 15000);
  let response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: '""' },
      body,
      cache: 'no-store',
      signal: controller.signal
    });
    if (!response.ok) throw new Error('HTTP ' + response.status + ' fra Epson.');
    const returned = await response.text();
    const documentXml = new DOMParser().parseFromString(returned, 'text/xml');
    if (documentXml.querySelector('parsererror')) throw new Error('Ugyldig svar fra Epson.');
    const responses = documentXml.getElementsByTagNameNS(EPOS_NS, 'response');
    const node = responses[0] || documentXml.getElementsByTagName('response')[0];
    if (!node) throw new Error('Ingen ePOS-bekreftelse fra skriveren.');
    if (!['true', '1'].includes(String(node.getAttribute('success')))) {
      throw new Error('Epson-feil: ' + (node.getAttribute('code') || 'Ukjent skriverfeil'));
    }
    return true;
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('Tidsavbrudd: Epson svarte ikke innen 15 sekunder.');
    if (error instanceof TypeError) throw new Error('Ingen kontakt med Epson. Sjekk samme Wi-Fi, IP og HTTPS.');
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
