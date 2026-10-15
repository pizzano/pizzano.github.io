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
export const DEFAULT_PRINTER_TYPOGRAPHY = Object.freeze({
  printerQtySize: 39,
  printerItemNameSize: 35,
  printerSizeTextSize: 28,
  printerExtraTextSize: 22,
  printerPriceSize: 24,
  printerSidePadding: 5,
});
export const PRINTER_TYPOGRAPHY_LIMITS = Object.freeze({
  printerQtySize: [28, 52],
  printerItemNameSize: [25, 45],
  printerSizeTextSize: [19, 38],
  printerExtraTextSize: [16, 33],
  printerPriceSize: [19, 34],
  printerSidePadding: [2, 18],
});
export function normalizePrinterTypography(source = {}) {
  const input = source && typeof source === 'object' ? source : {};
  return Object.fromEntries(Object.entries(DEFAULT_PRINTER_TYPOGRAPHY).map(([key, fallback]) => {
    const value = Number(input[key]);
    const [minimum, maximum] = PRINTER_TYPOGRAPHY_LIMITS[key];
    return [key, Number.isFinite(value) && value > 0
      ? Math.min(maximum, Math.max(minimum, Math.round(value)))
      : fallback];
  }));
}

function paintKitchenReceipt(ctx, order, reprint, typography) {
  const c = ctx;
  const ink = '#050505';
  const x = typography.printerSidePadding;
  const right = RASTER_WIDTH - x;
  const wide = RASTER_WIDTH - x * 2;
  let y = 18;
  c.fillStyle = '#fff';
  c.fillRect(0, 0, RASTER_WIDTH, c.canvas.height);
  c.textBaseline = 'top';
  c.textAlign = 'left';

  const type = (px, heavy = false, italic = false, color = ink) => {
    c.font = (italic ? 'italic ' : '') + (heavy ? '900 ' : '500 ') +
      px + 'px Arial, Helvetica, sans-serif';
    c.fillStyle = color;
  };
  const line = (a, b, yy, weight = 2, dash = false) => {
    c.save();
    c.strokeStyle = ink;
    c.lineWidth = weight;
    if (dash) c.setLineDash([11, 8]);
    c.beginPath(); c.moveTo(a, yy); c.lineTo(b, yy); c.stroke();
    c.restore();
  };
  const words = (value, width, px, heavy = false) => {
    type(px, heavy);
    const result = [];
    const paragraphs = String(value == null ? '' : value).split(/\r?\n/);
    for (const paragraph of paragraphs) {
      let row = '';
      for (const word of paragraph.trim().split(/\s+/).filter(Boolean)) {
        const candidate = row ? row + ' ' + word : word;
        if (row && c.measureText(candidate).width > width) {
          result.push(row);
          row = word;
        } else row = candidate;
        while (row.length > 1 && c.measureText(row).width > width) {
          let last = row.length - 1;
          while (last > 1 && c.measureText(row.slice(0, last)).width > width) last--;
          result.push(row.slice(0, last));
          row = row.slice(last);
        }
      }
      if (row) result.push(row);
    }
    return result.length ? result : [''];
  };
  const textLines = (value, left, maxWidth, px = 22, heavy = false, step = 27, italic = false) => {
    const rows = words(value, maxWidth, px, heavy);
    type(px, heavy, italic);
    for (const row of rows) {
      c.fillText(row, left, y, maxWidth);
      y += step;
    }
  };
  const field = (label, value, heavy = false) => {
    const v = String(value == null || value === '' ? '—' : value);
    type(22, true);
    const lw = c.measureText(label).width;
    type(22, heavy);
    const vw = c.measureText(v).width;
    if (lw + vw + 18 <= wide) {
      type(22, true);
      c.fillText(label, x + 2, y);
      type(22, heavy);
      c.textAlign = 'right';
      c.fillText(v, right - 2, y);
      c.textAlign = 'left';
      y += 36;
    } else {
      type(22, true);
      c.fillText(label, x + 2, y);
      y += 29;
      textLines(v, x + 20, wide - 24, 22, heavy, 29);
      y += 3;
    }
  };
  const blackBox = (value, yTop, width, height, px = 40) => {
    c.fillStyle = ink;
    c.fillRect(x, yTop, width, height);
    type(px, true, false, '#fff');
    c.textBaseline = 'middle';
    c.fillText(value, x + 14, yTop + height / 2, width - 23);
    c.textBaseline = 'top';
  };
  const section = (label) => {
    type(28, true);
    c.fillText(label, x + 2, y);
    const span = Math.min(wide - 10, c.measureText(label).width + 15);
    line(x + span, right, y + 23, 3);
    y += 49;
  };
  const clockIcon = (cx, cy) => {
    c.save();
    c.lineWidth = 4;
    c.strokeStyle = ink;
    c.beginPath(); c.arc(cx, cy, 15, 0, Math.PI * 2); c.stroke();
    c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx, cy - 10); c.lineTo(cx + 9, cy + 4); c.stroke();
    c.beginPath(); c.moveTo(cx - 8, cy - 22); c.lineTo(cx + 8, cy - 22); c.stroke();
    c.restore();
  };

  const desiredReadyAt = Number(order.estimatedReadyAt) || Number(order.scheduledPickupAt) || 0;
  const hhmm = desiredReadyAt > 0
    ? new Intl.DateTimeFormat('nb-NO', {
      timeZone: 'Europe/Oslo', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    }).format(new Date(desiredReadyAt))
    : (/^\d{1,2}:\d{2}$/.test(String(order.pickup || '')) ? order.pickup : '—');
  type(61, true);
  c.fillText('Hentetid: ' + hhmm, x + 1, y, wide - 2);
  y += 83;
  if (reprint) {
    type(19, true);
    c.fillText('KOPI / NY UTSKRIFT', x + 4, y);
    y += 29;
  }

  const barHeight = 72;
  const blackWidth = isScheduled(order) ? 310 : 304;
  blackBox(isScheduled(order) ? 'Planlagt' : 'Snarest', y, blackWidth, barHeight, 43);
  c.strokeStyle = ink;
  c.lineWidth = 3;
  c.strokeRect(x + blackWidth, y + 1.5, wide - blackWidth - 1.5, barHeight - 3);
  clockIcon(x + blackWidth + 35, y + barHeight / 2);
  const estimate = Math.round(Number(order.estimatedMinutes) || 0);
  const duration = isScheduled(order) ? hhmm
    : (estimate > 0 ? estimate + (estimate === 1 ? ' minutt' : ' minutt') : '—');
  type(30, true);
  c.textAlign = 'right';
  c.fillText(duration, right - 11, y + 20, wide - blackWidth - 65);
  c.textAlign = 'left';
  y += barHeight + 30;
  line(x, right, y, 3);
  y += 24;
  section('ENHETER');

  const entries = Array.isArray(order.lines) ? order.lines : [];
  if (!entries.length) textLines('Ingen varer registrert', x + 2, wide, 24, false, 34);
  entries.forEach((item, index) => {
    if (index) {
      y += 9; line(x, right, y, 2, true); y += 19;
    }
    const quantity = Math.max(1, Math.floor(Number(item.quantity) || 1));
    const countText = quantity + 'x';
    const name = String(item.name || 'Produkt');
    const entryTop = y;
    // Use almost the entire 576-dot printable span; reserve the right edge for
    // the checkbox and price, then give the name all remaining available width.
    c.strokeStyle = ink;
    c.lineWidth = 3;
    c.strokeRect(right - 35, entryTop + 4, 32, 32);
    type(typography.printerPriceSize, true);
    c.textAlign = 'right';
    c.fillText(money(item.price), right - 43, entryTop + 5, 150);
    c.textAlign = 'left';

    type(typography.printerQtySize, true);
    const countWidth = c.measureText(countText).width;
    c.fillText(countText, x + 1, entryTop);
    const nameX = x + countWidth + 14;
    const nameMaxWidth = Math.max(110, (right - 202) - nameX);
    const itemNameRows = words(name, nameMaxWidth, typography.printerItemNameSize, false);
    let rowY = entryTop + Math.max(1, Math.round((typography.printerQtySize - typography.printerItemNameSize) / 3));
    type(typography.printerItemNameSize, false);
    for (const nameRow of itemNameRows) {
      c.fillText(nameRow, nameX, rowY, nameMaxWidth);
      rowY += typography.printerItemNameSize + 6;
    }
    y = Math.max(entryTop + typography.printerQtySize + 11, rowY + 3, entryTop + 43);

    const addLine = (heading, description, isSize = false) => {
      if (!description) return;
      const indent = x + Math.min(52, Math.round(countWidth + 10));
      const available = right - indent - 5;
      const headingText = heading + ': ';
      if (isSize) {
        type(21, false);
        const labelWidth = c.measureText(headingText).width;
        type(typography.printerSizeTextSize, true);
        const valueWidth = c.measureText(String(description)).width;
        if (labelWidth + valueWidth <= available) {
          type(21, false);
          c.fillText(headingText, indent, y + 3);
          type(typography.printerSizeTextSize, true);
          c.fillText(String(description), indent + labelWidth, y, available - labelWidth);
          y += Math.max(31, typography.printerSizeTextSize + 5);
        } else {
          textLines(headingText.trim(), indent, available, 21, false, 27);
          textLines(description, indent, available, typography.printerSizeTextSize,
            true, typography.printerSizeTextSize + 5);
        }
      } else {
        textLines(headingText + description, indent, available, typography.printerExtraTextSize,
          false, typography.printerExtraTextSize + 7);
      }
    };
    if (item.size) addLine('Størrelse', item.size, true);
    const options = Array.isArray(item.optionDetails) && item.optionDetails.length
      ? item.optionDetails
      : (Array.isArray(item.options) ? item.options : []).map(opt =>
        typeof opt === 'string' ? {label: opt} : opt);
    for (const opt of options) {
      if (!opt) continue;
      const optionName = typeof opt === 'string' ? opt : opt.label;
      if (!optionName) continue;
      const title = opt.groupTitle || 'Alternativer';
      const supplement = Number(opt.price) > 0 ? ' (+' + money(opt.price) + ')' : '';
      addLine(title, String(optionName) + supplement);
    }
    if (Array.isArray(item.removedIngredients) && item.removedIngredients.length)
      addLine('Uten', item.removedIngredients.join(', '));
    if (item.comment) addLine('Kommentar', item.comment);
    if (item.loyaltyFree) addLine('Bonus', 'Gratis pizza');
    y += 17;
  });

  if (order.comment) {
    y += 5; line(x, right, y, 2); y += 19;
    textLines('Kommentar: ' + order.comment, x + 4, wide - 8, 22, true, 29);
    y += 11;
  }

  y += 8;
  line(x, right, y, 3);
  y += 20;
  section('BESTILLINGSDETALJER');
  const id = String(order.id || '—');
  field('Nummer:', id, false);
  const accepted = Number(order.estimatedAt) || (
    ['bekreftet', 'tilberedning'].includes(order.status) ? Number(order.statusUpdatedAt) : 0
  );
  field('Bekreftet kl.:', dateTime(accepted));
  field('Fornavn/Etternavn:', String(order.customerName || '—'), true);
  field('Telefon:', String(order.phone || 'Ikke oppgitt'), true);

  y += 11; line(x, right, y, 3); y += 22;
  if (Number(order.subtotal) > 0) field('Delsum:', money(order.subtotal));
  const total = Number(order.total) || 0;
  field('Herav MVA (15 %):', money(total * 15 / 115));

  y += 12;
  c.fillStyle = ink;
  c.fillRect(x, y, wide, 78);
  type(42, true, false, '#fff');
  c.textBaseline = 'middle';
  c.fillText('Totalt', x + 20, y + 39);
  c.textAlign = 'right';
  c.fillText(money(total), right - 18, y + 39, wide * .55);
  c.textAlign = 'left';
  c.textBaseline = 'top';
  y += 96;
  return y;
}

export function renderKitchenReceiptCanvas(order, { reprint = false, typography = {} } = {}) {
  if (!order || !order.id) throw new Error('Bestillingen mangler ordre-ID.');
  const chosenTypography = normalizePrinterTypography(typography);
  const canvas = document.createElement('canvas');
  canvas.width = RASTER_WIDTH;
  canvas.height = 1600;
  let height = 0;
  for (let attempt = 0; attempt < 6; attempt++) {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('Nettbrettet kan ikke tegne kvitteringen.');
    height = paintKitchenReceipt(ctx, order, reprint, chosenTypography);
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

async function bitmapReceiptXml(order, reprint = false, typography = {}) {
  // Ensure that the Android system fonts have finished loading before rasterization.
  try { await document.fonts?.ready; } catch {}
  const canvas = renderKitchenReceiptCanvas(order, { reprint, typography });
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

/* Manual/periodic printer status check: a no-paper Epson ePOS command.
 * Never treat navigator.onLine or the Firebase icon as printer health. */
export async function checkEpsonConnection() {
  const config = printerSettings();
  const endpoint = config.scheme + '://' + config.host +
    '/cgi-bin/epos/service.cgi?devid=' + encodeURIComponent(config.deviceId) + '&timeout=6000';
  const body = '<?xml version="1.0" encoding="UTF-8"?>' +
    '<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body>' +
    '<epos-print xmlns="' + EPOS_NS + '"></epos-print></s:Body></s:Envelope>';
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: '""' },
      body, cache: 'no-store', signal: controller.signal
    });
    if (!response.ok) throw new Error('HTTP ' + response.status);
    const documentXml = new DOMParser().parseFromString(await response.text(), 'text/xml');
    const node = documentXml.getElementsByTagNameNS(EPOS_NS, 'response')[0] ||
      documentXml.getElementsByTagName('response')[0];
    if (!node || !['true', '1'].includes(String(node.getAttribute('success')))) {
      throw new Error('Epson kunne ikke bekrefte tilkoblingen.');
    }
    return true;
  } finally {
    window.clearTimeout(timer);
  }
}

export async function printKitchenTicket(order, { reprint = false, typography = {} } = {}) {
  const config = printerSettings();
  const endpoint = config.scheme + '://' + config.host +
    '/cgi-bin/epos/service.cgi?devid=' + encodeURIComponent(config.deviceId) + '&timeout=10000';
  const content = await bitmapReceiptXml(order, reprint, typography);
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
