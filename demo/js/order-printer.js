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
/* Draw the full receipt as a high-contrast image, then send Epson's packed
 * 1-bit raster. Epson's <image> XML element does NOT accept PNG/JPEG bytes. */
const RASTER_WIDTH = 576; // TM-T20II 80mm paper at 203dpi (72mm printable)
const RASTER_MARGIN = 17;
const RASTER_INNER = RASTER_WIDTH - RASTER_MARGIN * 2;

function paintKitchenReceipt(ctx, order, reprint) {
  let y = 16;
  const c = ctx;
  const black = '#101010';
  const margin = RASTER_MARGIN;
  c.fillStyle = '#ffffff';
  c.fillRect(0, 0, RASTER_WIDTH, c.canvas.height);
  c.textBaseline = 'top';

  function font(px = 22, heavy = false, italic = false) {
    c.font = (italic ? 'italic ' : '') + (heavy ? '800 ' : '500 ') + px + 'px Arial, Helvetica, sans-serif';
    c.fillStyle = black;
  }

  // Unlike fixed-column ESC/POS text, canvas measures each word before wrapping.
  function wrapped(value, width, px = 22, heavy = false, italic = false) {
    font(px, heavy, italic);
    const words = String(value ?? '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
    const lines = [];
    let row = '';
    for (const word of words) {
      if (!row) { row = word; continue; }
      const combined = row + ' ' + word;
      if (c.measureText(combined).width <= width) row = combined;
      else { lines.push(row); row = word; }
    }
    if (row) lines.push(row);
    const fitted = [];
    for (const line of lines) {
      if (c.measureText(line).width <= width) { fitted.push(line); continue; }
      let fragment = '';
      for (const letter of line) {
        if (fragment && c.measureText(fragment + letter).width > width) {
          fitted.push(fragment);
          fragment = '';
        }
        fragment += letter;
      }
      if (fragment) fitted.push(fragment);
    }
    return fitted.length ? fitted : [''];
  }
  function blockText(value, x, width, px = 22, heavy = false, step = 27, italic = false) {
    const lines = wrapped(value, width, px, heavy, italic);
    font(px, heavy, italic);
    for (const line of lines) {
      c.fillText(line, x, y);
      y += step;
    }
  }
  function rule() {
    c.fillStyle = '#151515';
    c.fillRect(margin, y, RASTER_INNER, 2);
    y += 17;
  }
  function strip(left, right = '', height = 51) {
    c.fillStyle = black;
    c.fillRect(margin, y, RASTER_INNER, height);
    c.fillStyle = '#fff';
    c.font = '800 28px Arial, Helvetica, sans-serif';
    c.textBaseline = 'middle';
    c.fillText(String(left), margin + 15, y + height / 2, RASTER_INNER - 40);
    if (right) {
      c.textAlign = 'right';
      c.fillText(String(right), RASTER_WIDTH - margin - 15, y + height / 2,
        Math.min(RASTER_INNER * .55, RASTER_INNER - c.measureText(String(left)).width - 32));
      c.textAlign = 'left';
    }
    c.textBaseline = 'top';
    y += height + 10;
  }
  function field(label, value, important = false) {
    const l = String(label);
    const r = String(value ?? '—');
    font(21, false);
    const labelWidth = c.measureText(l).width;
    font(22, important);
    if (labelWidth + c.measureText(r).width < RASTER_INNER - 12) {
      font(21);
      c.fillText(l, margin, y);
      font(22, important);
      c.textAlign = 'right';
      c.fillText(r, RASTER_WIDTH - margin, y);
      c.textAlign = 'left';
      y += 33;
    } else {
      font(20);
      c.fillText(l, margin, y);
      y += 25;
      blockText(r, margin + 16, RASTER_INNER - 16, 22, important, 29);
      y += 4;
    }
  }

  c.textAlign = 'center';
  font(27, true);
  c.fillText('KØL GRILL & PIZZA', RASTER_WIDTH / 2, y);
  y += 34;
  font(17, false);
  c.fillText(reprint ? 'KOPI / NY UTSKRIFT' : 'KJØKKENBESTILLING', RASTER_WIDTH / 2, y);
  y += 32;
  c.textAlign = 'left';

  strip('Henting');
  const pickupTime = isScheduled(order)
    ? pickupLabel(order)
    : (Number(order.estimatedMinutes) > 0 ? Math.round(Number(order.estimatedMinutes)) + ' minutt' : '');
  strip(isScheduled(order) ? 'Planlagt' : 'Snarest', pickupTime);
  strip(dateTime(order.createdAt));

  const readyTimestamp = Number(order.estimatedReadyAt) || Number(order.scheduledPickupAt);
  if (readyTimestamp > 0) {
    font(19, true);
    c.fillText('Forventet hentetid: ' + dateTime(readyTimestamp), margin + 3, y);
    y += 35;
  }
  y += 8;
  font(21, true);
  c.fillText('Enheter', margin, y);
  y += 38;

  const lines = Array.isArray(order.lines) ? order.lines : [];
  if (!lines.length) blockText('Ingen varer registrert.', margin, RASTER_INNER, 22, false, 28);

  for (const line of lines) {
    const qty = Math.max(1, Math.floor(Number(line.quantity) || 1));
    const name = qty + '× ' + String(line.name || 'Produkt');
    const titleY = y;
    // Keep a check box to the right, like the supplied reference receipt.
    c.lineWidth = 2;
    c.strokeStyle = black;
    c.strokeRect(RASTER_WIDTH - margin - 26, titleY + 3, 23, 23);
    blockText(name, margin, RASTER_INNER - 46, 25, true, 31);
    font(21, true);
    c.textAlign = 'right';
    c.fillText(money(line.price), RASTER_WIDTH - margin - 2, y);
    c.textAlign = 'left';
    y += 30;

    if (line.size) blockText('Størrelse: ' + line.size, margin + 17, RASTER_INNER - 24, 21, true, 27, true);

    const opts = Array.isArray(line.optionDetails) && line.optionDetails.length
      ? line.optionDetails
      : (Array.isArray(line.options) ? line.options : []).map(opt =>
          typeof opt === 'string' ? { label: opt } : opt);

    for (const opt of opts) {
      if (!opt) continue;
      const label = typeof opt === 'string' ? opt : String(opt.label || '');
      if (!label) continue;
      const detail = (opt.groupTitle ? opt.groupTitle + ': ' : '') + label;
      const supplement = Number(opt.price) > 0 ? ' (+' + money(opt.price) + ')' : '';
      blockText(detail + supplement, margin + 17, RASTER_INNER - 25, 20, true, 27, true);
    }
    if (Array.isArray(line.removedIngredients) && line.removedIngredients.length) {
      blockText('UTEN: ' + line.removedIngredients.join(', '), margin + 17, RASTER_INNER - 25, 21, true, 28);
    }
    if (line.comment) blockText('Kommentar: ' + line.comment, margin + 17, RASTER_INNER - 25, 21, true, 28);
    if (line.loyaltyFree) blockText('GRATIS PIZZA / BONUS', margin + 17, RASTER_INNER - 25, 20, true, 27);
    y += 16;
  }

  if (order.comment) {
    rule();
    blockText('ORDREKOMMENTAR:', margin, RASTER_INNER, 22, true, 29);
    blockText(order.comment, margin, RASTER_INNER, 22, true, 29);
    y += 8;
  }

  y += 4;
  rule();
  font(27, true);
  c.fillText('Bestillingsdetaljer:', margin, y);
  y += 44;
  const id = String(order.id || '—');
  field('Nummer:', id.length > 22 ? id.slice(-18) : id, true);
  const acceptedAt = Number(order.estimatedAt) || (
    ['bekreftet', 'tilberedning'].includes(order.status) ? Number(order.statusUpdatedAt) : 0
  );
  field('Bekreftet kl.:', dateTime(acceptedAt));
  const names = String(order.customerName || '').trim().split(/\s+/).filter(Boolean);
  field('Fornavn:', names.shift() || '—', true);
  field('Etternavn:', names.join(' ') || '—', true);
  field('Telefon:', order.phone || 'Ikke oppgitt', true);

  y += 7;
  rule();
  if (Number(order.subtotal) > 0) field('Delsum:', money(order.subtotal));
  const total = Number(order.total) || 0;
  field('Herav MVA (15 %):', money(total * 15 / 115));
  y += 5;
  strip('TOTALT', money(total), 57);
  y += 15;
  font(18, true);
  c.textAlign = 'center';
  c.fillText('KØL Grill & Pizza · Takk!', RASTER_WIDTH / 2, y);
  c.textAlign = 'left';
  y += 48;
  return y;
}

export function renderKitchenReceiptCanvas(order, { reprint = false } = {}) {
  if (!order || !order.id) throw new Error('Bestillingen mangler ordre-ID.');
  const canvas = document.createElement('canvas');
  canvas.width = RASTER_WIDTH;
  canvas.height = 1600;
  let height = 0;
  for (let attempt = 0; attempt < 6; attempt++) {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('Nettbrettet kan ikke tegne kvitteringen.');
    height = paintKitchenReceipt(ctx, order, reprint);
    if (height <= canvas.height) break;
    if (height > 24000) throw new Error('Bestillingen er for lang for én kvittering.');
    canvas.height = Math.max(canvas.height * 2, Math.ceil(height / 100) * 100);
  }
  if (height > canvas.height) throw new Error('Kvitteringsbildet er for langt.');
  const compact = document.createElement('canvas');
  compact.width = RASTER_WIDTH;
  compact.height = height;
  const context = compact.getContext('2d', { willReadFrequently: true });
  context.drawImage(canvas, 0, 0, RASTER_WIDTH, height, 0, 0, RASTER_WIDTH, height);
  return compact;
}

function packed1BitRaster(canvas) {
  const width = canvas.width;
  const rowBytes = width / 8;
  if (!Number.isInteger(rowBytes)) throw new Error('Bitmap-bredden må deles på åtte.');
  const context = canvas.getContext('2d', { willReadFrequently: true });
  const chunkHeight = 320; // Keep each ePOS image chunk reasonably small.
  const images = [];

  for (let top = 0; top < canvas.height; top += chunkHeight) {
    const height = Math.min(chunkHeight, canvas.height - top);
    const rgba = context.getImageData(0, top, width, height).data;
    const bytes = new Uint8Array(rowBytes * height);
    for (let yy = 0; yy < height; yy++) {
      const row = yy * width;
      const packedRow = yy * rowBytes;
      for (let xx = 0; xx < width; xx++) {
        const i = (row + xx) * 4;
        const luminance = (rgba[i] * 299 + rgba[i + 1] * 587 + rgba[i + 2] * 114) / 1000;
        // Black = 1, white = 0. Anti-aliasing is thresholded for thermal printing.
        if (rgba[i + 3] > 128 && luminance < 170) {
          bytes[packedRow + (xx >> 3)] |= 0x80 >> (xx & 7);
        }
      }
    }
    // ePOS-Print XML <image> requires base64 of packed raster bytes,
    // not base64 of a PNG/JPEG file.
    let binary = '';
    for (let i = 0; i < bytes.length; i += 8192) {
      binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    }
    images.push('<image width="' + width + '" height="' + height +
      '" color="color_1" mode="mono" align="center">' + btoa(binary) + '</image>');
  }
  return images.join('') + '<feed line="3"/><cut type="feed"/>';
}

async function bitmapReceiptXml(order, reprint = false) {
  // Ensure that the Android system fonts have finished loading before rasterization.
  try { await document.fonts?.ready; } catch {}
  const canvas = renderKitchenReceiptCanvas(order, { reprint });
  return packed1BitRaster(canvas);
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
  const content = await bitmapReceiptXml(order, reprint);
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
