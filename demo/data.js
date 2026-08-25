/**
 * data.js — Delt datalag for KØL Grill & Pizza.
 *
 * Brukes av både kundesiden (app.js) og adminpanelet (admin.js).
 * Datakilde: Firebase Realtime Database via REST — vanlige fetch()-kall mot
 * .json-endepunktene. Ingen Firebase SDK og ingen API-nøkkel.
 *
 * Databasestruktur (rot):
 *   sections[]         — kategorier med produkter
 *   optionGroups[]     — gjenbrukbart valggruppe-bibliotek
 *   allergenCatalog[]  — {id,label} for avkryssing i admin
 *   siteSettings{}     — adresse, åpningstid, hentetid, stengt-bryter
 *   popularItemIds[]   — produkter markert som populære
 *   orders{}           — innkomne ordre (nøkkel = ordre-ID)
 *   updatedAt          — tidsstempel for siste menyendring
 *
 * localStorage brukes kun som lokal kopi hvis nettverket er nede.
 */

/* ------------------------------------------------------------------ *
 * 1. Database (Firebase Realtime Database REST)
 * ------------------------------------------------------------------ */
export const DB_URL = 'https://bestill-19-default-rtdb.europe-west1.firebasedatabase.app';

const ORDERS_PATH = 'orders';
/** Hvor ofte kundesiden/admin ser etter endringer fra databasen (ms). */
const POLL_INTERVAL = 4000;
const SCHEMA_VERSION = 3;

const LOCAL_KEY = 'kol_menu_state_v2';
const CHANNEL_NAME = 'kol_menu_sync';

/* ------------------------------------------------------------------ *
 * 2. Hjelpefunksjoner
 * ------------------------------------------------------------------ */

let idCounter = 0;

/** Genererer en kort, unik ID. */
export function uid(prefix = 'id') {
  idCounter += 1;
  return `${prefix}_${Date.now().toString(36)}${idCounter.toString(36)}${Math.random()
    .toString(36)
    .slice(2, 6)}`;
}

/** Dyp klone uten avhengigheter. */
export function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

/** Formaterer pris som norsk beløp, f.eks. 175 kr. */
export function formatPrice(value) {
  const num = Number(value) || 0;
  const rounded = Math.round(num * 100) / 100;
  const text = Number.isInteger(rounded)
    ? String(rounded)
    : rounded.toFixed(2).replace('.', ',');
  return `${text} kr`;
}

/** Laveste pris blant størrelsene ("fra"-pris). */
export function getItemBasePrice(item) {
  if (!item || !Array.isArray(item.sizes) || item.sizes.length === 0) return 0;
  return item.sizes.reduce(
    (min, size) => Math.min(min, Number(size.price) || 0),
    Number(item.sizes[0].price) || 0
  );
}

/** Prisen på valgt størrelse, med defaultSizeIndex som fallback. */
export function getSizePrice(item, sizeId) {
  if (!item || !Array.isArray(item.sizes) || item.sizes.length === 0) return 0;
  const found = item.sizes.find((size) => size.id === sizeId);
  if (found) return Number(found.price) || 0;
  const index = Math.min(
    Math.max(Number(item.defaultSizeIndex) || 0, 0),
    item.sizes.length - 1
  );
  return Number(item.sizes[index].price) || 0;
}

/** Standard størrelse for et produkt. */
export function getDefaultSize(item) {
  if (!item || !Array.isArray(item.sizes) || item.sizes.length === 0) return null;
  const index = Math.min(
    Math.max(Number(item.defaultSizeIndex) || 0, 0),
    item.sizes.length - 1
  );
  return item.sizes[index];
}

/** Slår opp en valggruppe på ID. */
export function findOptionGroup(groupId) {
  return (store.optionGroups || []).find((group) => group.id === groupId) || null;
}

/** Finner produkt og seksjon på produkt-ID. */
export function findItem(itemId) {
  for (const section of store.sections || []) {
    for (const item of section.items || []) {
      if (item.id === itemId) return { item, section };
    }
  }
  return { item: null, section: null };
}

/** Valggrupper som faktisk finnes, i produktets rekkefølge. */
export function getItemOptionGroups(item) {
  if (!item || !Array.isArray(item.optionGroupIds)) return [];
  return item.optionGroupIds
    .map((groupId) => findOptionGroup(groupId))
    .filter(Boolean);
}

/** Antall produkter som bruker en valggruppe. */
export function countProductsUsingGroup(groupId) {
  let count = 0;
  for (const section of store.sections || []) {
    for (const item of section.items || []) {
      if ((item.optionGroupIds || []).includes(groupId)) count += 1;
    }
  }
  return count;
}

/**
 * Regner ut pris for én handlekurv-linje.
 */
export function computeLinePrice(item, sizeId, optionIds, quantity = 1) {
  const base = getSizePrice(item, sizeId);
  const addons = (optionIds || []).reduce((sum, optionId) => {
    for (const group of store.optionGroups || []) {
      const option = (group.options || []).find((opt) => opt.id === optionId);
      if (option) return sum + (Number(option.price) || 0);
    }
    return sum;
  }, 0);
  return (base + addons) * (Number(quantity) || 1);
}

/** Slår opp etiketter for valgte alternativer, gruppert. */
export function describeSelection(optionIds) {
  const labels = [];
  for (const optionId of optionIds || []) {
    for (const group of store.optionGroups || []) {
      const option = (group.options || []).find((opt) => opt.id === optionId);
      if (option) {
        labels.push({
          groupTitle: group.title,
          label: option.label,
          price: Number(option.price) || 0,
        });
        break;
      }
    }
  }
  return labels;
}

/* ------------------------------------------------------------------ *
 * 3. Allergener
 * ------------------------------------------------------------------ */

const DEFAULT_ALLERGENS = [
  { id: 'gluten', label: 'Hvete / gluten' },
  { id: 'melk', label: 'Melk' },
  { id: 'egg', label: 'Egg' },
  { id: 'soya', label: 'Soya' },
  { id: 'selleri', label: 'Selleri' },
  { id: 'sennep', label: 'Sennep' },
  { id: 'sesam', label: 'Sesam' },
  { id: 'fisk', label: 'Fisk' },
  { id: 'skalldyr', label: 'Skalldyr' },
  { id: 'peanøtter', label: 'Peanøtter' },
  { id: 'nøtter', label: 'Nøtter' },
  { id: 'sulfitter', label: 'Sulfitter' },
];

/** Hele allergenkatalogen (admin bruker den til avkryssing). */
export function getAllergenCatalog() {
  return store.allergenCatalog && store.allergenCatalog.length
    ? store.allergenCatalog
    : DEFAULT_ALLERGENS;
}

/** Etikett for én allergen-ID. */
export function allergenLabel(id) {
  const found = getAllergenCatalog().find((entry) => entry.id === id);
  return found ? found.label : String(id || '');
}

/** Liste med etiketter for et produkt. */
export function allergenLabels(item) {
  return (item && Array.isArray(item.allergens) ? item.allergens : []).map(allergenLabel);
}

/* ------------------------------------------------------------------ *
 * 4. Åpningstid og hentetid
 * ------------------------------------------------------------------ */

const DEFAULT_SETTINGS = {
  restaurantName: 'KØL Grill & Pizza',
  streetAddress: 'ØGARDSVEGEN 44',
  postalCode: '2100',
  city: 'SKARNES',
  country: 'Norway',
  phone: '+47 41 14 53 53',
  timezone: 'Europe/Oslo',
  openingDays: 'Mandag - Søndag',
  openingTime: '14:00 - 22:00',
  orderOpenTime: '14:00',
  orderCloseTime: '22:00',
  pickupInfo: 'Henting i restauranten',
  paymentInfo: 'Betaling ved henting',
  minPreorderMinutes: 0,
  prepMinutes: 25,
  slotIntervalMinutes: 15,
  manualClosed: false,
  closedMessage: 'Vi tar ikke imot bestillinger akkurat nå.',
};

/** '14:30' → 870 minutter. */
export function parseTime(text) {
  const match = /^(\d{1,2})[:.](\d{2})$/.exec(String(text || '').trim());
  if (!match) return null;
  const hour = Math.min(Number(match[1]), 23);
  const minute = Math.min(Number(match[2]), 59);
  return hour * 60 + minute;
}

/** 870 → '14:30'. */
export function formatMinutes(total) {
  const normalized = ((Math.round(Number(total) || 0) % 1440) + 1440) % 1440;
  const hour = Math.floor(normalized / 60);
  const minute = normalized % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

/** Klokken nå i restaurantens tidssone, som minutter etter midnatt. */
function nowMinutes(date = new Date()) {
  const timezone = (store.settings && store.settings.timezone) || 'Europe/Oslo';
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(date);
    const hour = Number(parts.find((p) => p.type === 'hour')?.value) || 0;
    const minute = Number(parts.find((p) => p.type === 'minute')?.value) || 0;
    return hour * 60 + minute;
  } catch (err) {
    return date.getHours() * 60 + date.getMinutes();
  }
}

/**
 * Om restauranten tar imot bestillinger nå.
 * @returns {{open:boolean, reason:string, label:string, opensAt:string, closesAt:string}}
 */
export function getOpenState() {
  const settings = store.settings || DEFAULT_SETTINGS;
  const opensAt = settings.orderOpenTime || '14:00';
  const closesAt = settings.orderCloseTime || '22:00';

  if (settings.manualClosed) {
    return {
      open: false,
      reason: 'manuelt',
      label: 'Stengt',
      opensAt,
      closesAt,
    };
  }

  const open = parseTime(opensAt);
  const close = parseTime(closesAt);
  if (open === null || close === null) {
    return { open: true, reason: '', label: 'Åpent', opensAt, closesAt };
  }

  const now = nowMinutes();
  const isOpen = close > open ? now >= open && now < close : now >= open || now < close;

  return {
    open: isOpen,
    reason: isOpen ? '' : 'utenfor_apningstid',
    label: isOpen ? 'Åpent nå' : 'Stengt nå',
    opensAt,
    closesAt,
  };
}

/**
 * Hentetider basert på tilberedningstid og intervall fra admin.
 * @returns {{value:string,label:string}[]}
 */
export function getPickupSlots() {
  const settings = store.settings || DEFAULT_SETTINGS;
  const state = getOpenState();
  if (!state.open) return [];

  const prep = Math.max(Number(settings.prepMinutes) || 0, 0);
  const interval = Math.min(Math.max(Number(settings.slotIntervalMinutes) || 15, 5), 60);
  const close = parseTime(settings.orderCloseTime) ?? 22 * 60;
  const open = parseTime(settings.orderOpenTime) ?? 14 * 60;

  const now = nowMinutes();
  const earliest = Math.max(now + prep, open + prep);
  const closeAdjusted = close > open ? close : close + 1440;

  const slots = [
    { value: 'asap', label: prep ? `Snarest (ca. ${prep} min)` : 'Snarest' },
  ];

  let cursor = Math.ceil(earliest / interval) * interval;
  while (cursor <= closeAdjusted - 10 && slots.length < 25) {
    const label = formatMinutes(cursor);
    slots.push({ value: label, label });
    cursor += interval;
  }
  return slots;
}

/* ------------------------------------------------------------------ *
 * 5. Ordrestatus
 * ------------------------------------------------------------------ */

export const ORDER_STATUSES = [
  { id: 'mottatt', label: 'Ny' },
  { id: 'tilberedning', label: 'Under tilberedning' },
  { id: 'klar', label: 'Klar' },
  { id: 'fullfort', label: 'Fullført' },
  { id: 'avvist', label: 'Avvist' },
];

/** Etikett for en ordrestatus. */
export function orderStatusLabel(status) {
  const found = ORDER_STATUSES.find((entry) => entry.id === status);
  return found ? found.label : 'Ny';
}

/* ------------------------------------------------------------------ *
 * 6. Startdata (kun fallback hvis databasen er tom)
 * ------------------------------------------------------------------ */

function seedState() {
  const size = (label, price) => ({ id: uid('sz'), label, price });
  return {
    schemaVersion: SCHEMA_VERSION,
    settings: { ...DEFAULT_SETTINGS },
    allergenCatalog: clone(DEFAULT_ALLERGENS),
    optionGroups: [
      {
        id: 'og_styrke',
        title: 'Velg styrke',
        selectionMode: 'single',
        required: true,
        maxSelections: 1,
        defaultOptionIds: ['opt_styrke_medium'],
        options: [
          { id: 'opt_styrke_mild', label: 'Mild', price: 0 },
          { id: 'opt_styrke_medium', label: 'Medium', price: 0 },
          { id: 'opt_styrke_sterk', label: 'Sterk', price: 0 },
        ],
      },
      {
        id: 'og_topping',
        title: 'Ekstra topping',
        selectionMode: 'multiple',
        required: false,
        maxSelections: 3,
        defaultOptionIds: [],
        options: [
          { id: 'opt_top_ost', label: 'Ekstra ost', price: 25 },
          { id: 'opt_top_skinke', label: 'Skinke', price: 20 },
          { id: 'opt_top_jalapeno', label: 'Jalapeño', price: 15 },
        ],
      },
    ],
    sections: [
      {
        id: 'pizza',
        title: 'PIZZA',
        note: '',
        imageUrl: '',
        type: 'pizza',
        loyaltyEligible: true,
        items: [
          {
            id: 'it_margherita',
            name: 'Margherita',
            description: 'Tomatsaus, ost, oregano',
            ingredients: 'Tomatsaus, ost, oregano',
            imageUrl: '',
            sizes: [size('Medium', 155), size('Stor', 245)],
            defaultSizeIndex: 0,
            allergens: ['gluten', 'melk'],
            optionGroupIds: ['og_topping'],
            hidden: false,
            soldOut: false,
          },
        ],
      },
      {
        id: 'drikker',
        title: 'DRIKKER',
        note: '',
        imageUrl: '',
        type: '',
        loyaltyEligible: false,
        items: [
          {
            id: 'it_cola',
            name: 'Coca-Cola',
            description: '0,5 l',
            ingredients: '',
            imageUrl: '',
            sizes: [size('0,5 l', 39)],
            defaultSizeIndex: 0,
            allergens: [],
            optionGroupIds: [],
            hidden: false,
            soldOut: false,
          },
        ],
      },
    ],
    popularItemIds: [],
    orders: [],
    updatedAt: Date.now(),
  };
}

/* ------------------------------------------------------------------ *
 * 7. Normalisering — sikrer at data alltid har riktig form
 * ------------------------------------------------------------------ */

function asArray(value) {
  if (Array.isArray(value)) return value.filter((entry) => entry !== null);
  if (value && typeof value === 'object') return Object.values(value);
  return [];
}

function normalizeSettings(raw) {
  const base = raw && typeof raw === 'object' ? raw : {};
  const settings = { ...DEFAULT_SETTINGS };
  for (const key of Object.keys(DEFAULT_SETTINGS)) {
    if (base[key] === undefined || base[key] === null) continue;
    const fallback = DEFAULT_SETTINGS[key];
    if (typeof fallback === 'number') {
      const num = Number(base[key]);
      settings[key] = Number.isFinite(num) ? num : fallback;
    } else if (typeof fallback === 'boolean') {
      settings[key] = base[key] === true || base[key] === 'true';
    } else {
      settings[key] = String(base[key]);
    }
  }
  settings.prepMinutes = Math.min(Math.max(settings.prepMinutes, 0), 240);
  settings.slotIntervalMinutes = Math.min(
    Math.max(settings.slotIntervalMinutes || 15, 5),
    60
  );
  settings.openingTime = `${settings.orderOpenTime} - ${settings.orderCloseTime}`;
  return settings;
}

function normalizeAllergenCatalog(raw) {
  const list = asArray(raw)
    .map((entry) => {
      if (typeof entry === 'string') {
        return { id: entry.toLowerCase(), label: entry };
      }
      if (!entry || typeof entry !== 'object') return null;
      const id = String(entry.id || entry.label || '').toLowerCase();
      if (!id) return null;
      return { id, label: String(entry.label || entry.id) };
    })
    .filter(Boolean);
  return list.length ? list : clone(DEFAULT_ALLERGENS);
}

function normalizeOrders(raw) {
  return asArray(raw)
    .map((order) => {
      if (!order || typeof order !== 'object') return null;
      return {
        id: order.id || uid('ord'),
        createdAt: Number(order.createdAt) || 0,
        customerName: String(order.customerName || ''),
        phone: String(order.phone || ''),
        pickup: String(order.pickup || ''),
        comment: String(order.comment || ''),
        type: String(order.type || 'henting'),
        status: ORDER_STATUSES.some((s) => s.id === order.status)
          ? order.status
          : 'mottatt',
        statusUpdatedAt: Number(order.statusUpdatedAt) || 0,
        discount: Number(order.discount) || 0,
        discountLabel: String(order.discountLabel || ''),
        subtotal: Number(order.subtotal) || 0,
        total: Number(order.total) || 0,
        lines: asArray(order.lines).map((line) => ({
          itemId: String(line.itemId || ''),
          name: String(line.name || ''),
          size: String(line.size || ''),
          comment: String(line.comment || ''),
          options: asArray(line.options).map((opt) =>
            typeof opt === 'string' ? opt : String(opt.label || '')
          ),
          quantity: Number(line.quantity) || 1,
          price: Number(line.price) || 0,
        })),
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.createdAt - a.createdAt);
}

function normalizeState(raw) {
  const base = raw && typeof raw === 'object' ? raw : {};
  const allergenCatalog = normalizeAllergenCatalog(base.allergenCatalog);
  const allergenIds = new Set(allergenCatalog.map((entry) => entry.id));
  const labelToId = new Map(
    allergenCatalog.map((entry) => [entry.label.toLowerCase(), entry.id])
  );

  const optionGroups = asArray(base.optionGroups).map((group) => ({
    id: group.id || uid('og'),
    title: typeof group.title === 'string' ? group.title : '',
    selectionMode: group.selectionMode === 'multiple' ? 'multiple' : 'single',
    required: Boolean(group.required),
    maxSelections: Number(group.maxSelections) > 0 ? Number(group.maxSelections) : 1,
    defaultOptionIds: asArray(group.defaultOptionIds).filter(
      (id) => typeof id === 'string'
    ),
    options: asArray(group.options).map((option) => ({
      id: option.id || uid('opt'),
      label: typeof option.label === 'string' ? option.label : '',
      price: Number(option.price) || 0,
    })),
  }));

  const groupIds = new Set(optionGroups.map((group) => group.id));

  const sections = asArray(base.sections).map((section) => ({
    id: section.id || uid('sec'),
    title: typeof section.title === 'string' ? section.title : '',
    note: typeof section.note === 'string' ? section.note : '',
    imageUrl: typeof section.imageUrl === 'string' ? section.imageUrl : '',
    type: typeof section.type === 'string' ? section.type : '',
    loyaltyEligible: Boolean(section.loyaltyEligible),
    items: asArray(section.items).map((item) => {
      const sizes = asArray(item.sizes).map((size) => ({
        id: size.id || uid('sz'),
        label: typeof size.label === 'string' ? size.label : '',
        price: Number(size.price) || 0,
      }));
      const maxIndex = Math.max(sizes.length - 1, 0);
      const ingredients =
        typeof item.ingredients === 'string' ? item.ingredients.trim() : '';
      const description =
        typeof item.description === 'string' ? item.description.trim() : '';
      return {
        id: item.id || uid('it'),
        name: typeof item.name === 'string' ? item.name.trim() : '',
        description: description || ingredients,
        ingredients: ingredients || description,
        imageUrl: typeof item.imageUrl === 'string' ? item.imageUrl : '',
        sizes,
        defaultSizeIndex: Math.min(
          Math.max(Number(item.defaultSizeIndex) || 0, 0),
          maxIndex
        ),
        allergens: asArray(item.allergens)
          .map((entry) => {
            const value = String(entry || '').toLowerCase();
            if (allergenIds.has(value)) return value;
            return labelToId.get(value) || '';
          })
          .filter(Boolean),
        optionGroupIds: asArray(item.optionGroupIds).filter((id) => groupIds.has(id)),
        hidden: Boolean(item.hidden),
        soldOut: Boolean(item.soldOut),
      };
    }),
  }));

  // Rydd defaults som ikke finnes blant alternativene.
  for (const group of optionGroups) {
    const optionIds = new Set(group.options.map((option) => option.id));
    group.defaultOptionIds = group.defaultOptionIds.filter((id) => optionIds.has(id));
    if (group.selectionMode === 'single') {
      group.maxSelections = 1;
      group.defaultOptionIds = group.defaultOptionIds.slice(0, 1);
    } else {
      group.maxSelections = Math.min(
        Math.max(group.maxSelections, 1),
        Math.max(group.options.length, 1)
      );
    }
  }

  const validItemIds = new Set(
    sections.flatMap((section) => section.items.map((item) => item.id))
  );

  return {
    schemaVersion: SCHEMA_VERSION,
    settings: normalizeSettings(base.settings || base.siteSettings),
    allergenCatalog,
    sections,
    optionGroups,
    popularItemIds: asArray(base.popularItemIds).filter((id) => validItemIds.has(id)),
    orders: normalizeOrders(base.orders),
    updatedAt: Number(base.updatedAt) || Date.now(),
  };
}

/* ------------------------------------------------------------------ *
 * 8. Tilstand, abonnenter og lagringsstatus
 * ------------------------------------------------------------------ */

/** Delt, mutérbar tilstand. Les fritt, skriv kun via mutate(). */
export const store = normalizeState(seedState());

const dataListeners = new Set();
const statusListeners = new Set();

/** SaveState: 'saved' | 'dirty' | 'saving' | 'error' */
let saveState = 'saved';
let saveError = '';

export function getSaveState() {
  return { state: saveState, message: saveError };
}

function emitData(origin) {
  for (const listener of dataListeners) {
    try {
      listener(store, origin);
    } catch (err) {
      console.error('Datalytter feilet:', err);
    }
  }
}

function emitStatus() {
  for (const listener of statusListeners) {
    try {
      listener(getSaveState());
    } catch (err) {
      console.error('Statuslytter feilet:', err);
    }
  }
}

function setSaveState(next, message = '') {
  saveState = next;
  saveError = message;
  emitStatus();
}

/** Abonnerer på dataendringer. Returnerer en avmeldingsfunksjon. */
export function subscribe(listener) {
  dataListeners.add(listener);
  return () => dataListeners.delete(listener);
}

/** Abonnerer på lagringsstatus. */
export function onStatus(listener) {
  statusListeners.add(listener);
  listener(getSaveState());
  return () => statusListeners.delete(listener);
}

function replaceMenuState(next) {
  const normalized = normalizeState(next);
  store.schemaVersion = normalized.schemaVersion;
  store.settings = normalized.settings;
  store.allergenCatalog = normalized.allergenCatalog;
  store.sections = normalized.sections;
  store.optionGroups = normalized.optionGroups;
  store.popularItemIds = normalized.popularItemIds;
  store.updatedAt = normalized.updatedAt;
}

/* ------------------------------------------------------------------ *
 * 9. Lagring: Firebase Realtime Database via REST (fetch + .json)
 * ------------------------------------------------------------------ */

const remoteEnabled = Boolean(DB_URL);
let remoteOnline = false;

/** Om appen er tilkoblet databasen eller kjører på lokal kopi. */
export const backendInfo = {
  get mode() {
    return remoteOnline ? 'firebase' : 'local';
  },
  get label() {
    if (!remoteEnabled) return 'Lokal kopi';
    return remoteOnline ? 'Firebase Realtime Database (REST)' : 'Frakoblet — lokal kopi';
  },
};

let channel = null;
if (typeof BroadcastChannel !== 'undefined') {
  try {
    channel = new BroadcastChannel(CHANNEL_NAME);
  } catch (err) {
    channel = null;
  }
}

let pollTimer = null;
let saveTimer = null;
let readyResolve;
const readyPromise = new Promise((resolve) => {
  readyResolve = resolve;
});

/** Løses når første datalasting er ferdig. */
export function ready() {
  return readyPromise;
}

function loadLocal() {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    console.warn('Kunne ikke lese lokal lagring:', err);
    return null;
  }
}

function writeLocal() {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(menuPayload()));
    if (channel) channel.postMessage({ type: 'state', updatedAt: store.updatedAt });
    return true;
  } catch (err) {
    console.warn('Kunne ikke skrive til lokal lagring:', err);
    return false;
  }
}

/** Leser fra databasen: GET <DB_URL>/<path>.json */
async function restGet(path) {
  const suffix = path ? `/${path}.json` : '/.json';
  const response = await fetch(`${DB_URL}${suffix}?_=${Date.now()}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`Kunne ikke hente data (${response.status})`);
  return response.json();
}

/** Skriver til databasen: PUT <DB_URL>/<path>.json */
async function restPut(path, data) {
  const response = await fetch(`${DB_URL}/${path}.json`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error(`Kunne ikke lagre (${response.status})`);
  return response.json();
}

/** Oppdaterer utvalgte felt: PATCH <DB_URL>/<path>.json */
async function restPatch(path, data) {
  const suffix = path ? `/${path}.json` : '/.json';
  const response = await fetch(`${DB_URL}${suffix}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error(`Kunne ikke lagre (${response.status})`);
  return response.json();
}

/** Menydelen som lagres til databasen (ordre røres ikke). */
function menuPayload() {
  return {
    schemaVersion: SCHEMA_VERSION,
    siteSettings: clone(store.settings),
    settings: clone(store.settings),
    allergenCatalog: clone(store.allergenCatalog),
    sections: clone(store.sections),
    optionGroups: clone(store.optionGroups),
    popularItemIds: clone(store.popularItemIds),
    updatedAt: store.updatedAt,
  };
}

/** Tar imot menydata fra databasen. Returnerer true hvis noe endret seg. */
function applyRemoteMenu(value) {
  if (!value || typeof value !== 'object' || !value.sections) return false;
  if (Number(value.updatedAt) === Number(store.updatedAt)) return false;
  replaceMenuState(value);
  return true;
}

/** Tar imot ordre fra databasen. Returnerer true hvis noe endret seg. */
function applyRemoteOrders(value) {
  const next = normalizeOrders(value);
  const before = JSON.stringify(store.orders.map((o) => [o.id, o.status]));
  const after = JSON.stringify(next.map((o) => [o.id, o.status]));
  store.orders = next;
  return before !== after;
}

/** Henter siste versjon fra databasen. */
async function pullRemote() {
  if (!remoteEnabled) return;
  try {
    const root = await restGet('');
    remoteOnline = true;
    const menuChanged =
      saveState === 'dirty' || saveState === 'saving' ? false : applyRemoteMenu(root);
    const ordersChanged = applyRemoteOrders(root && root.orders);
    if (menuChanged || ordersChanged) emitData('remote');
  } catch (err) {
    remoteOnline = false;
  }
}

/** Manuell oppfrisking (brukes av admin-knappen). */
export async function refreshFromDatabase() {
  await pullRemote();
  return remoteOnline;
}

/** Live-oppdatering ved jevnlig polling, samt når fanen får fokus igjen. */
function startPolling() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(pullRemote, POLL_INTERVAL);
  window.addEventListener('focus', pullRemote);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) pullRemote();
  });
}

async function persist() {
  setSaveState('saving');
  try {
    store.updatedAt = Date.now();
    if (remoteEnabled) {
      await restPatch('', menuPayload());
      remoteOnline = true;
    }
    writeLocal();
    setSaveState('saved');
    return true;
  } catch (err) {
    remoteOnline = false;
    writeLocal();
    console.error('Lagring feilet:', err);
    setSaveState('error', err && err.message ? err.message : 'Ukjent feil');
    return false;
  }
}

/** Lagrer umiddelbart (manuell «Lagre nå»). */
export async function saveNow() {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  return persist();
}

/**
 * Endrer tilstanden. Callback får store som argument.
 * Markerer «Endringer ikke lagret» og planlegger autolagring etter ~1 sekund.
 */
export function mutate(updater, options = {}) {
  const result = typeof updater === 'function' ? updater(store) : undefined;
  emitData('local');
  if (options.silent) return result;
  setSaveState('dirty');
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    persist();
  }, options.delay || 1000);
  return result;
}

/** Om det finnes ulagrede endringer. */
export function hasUnsavedChanges() {
  return saveState === 'dirty' || saveState === 'saving' || saveState === 'error';
}

/* ------------------------------------------------------------------ *
 * 10. Ordre
 * ------------------------------------------------------------------ */

const ORDERS_KEY = 'kol_orders_v1';

/** Lagrer en ordre. Returnerer ordren med ID. */
export async function submitOrder(order) {
  const record = {
    ...order,
    id: uid('ord'),
    createdAt: Date.now(),
    status: 'mottatt',
    statusUpdatedAt: Date.now(),
  };
  try {
    if (remoteEnabled) {
      await restPut(`${ORDERS_PATH}/${record.id}`, record);
      remoteOnline = true;
    }
  } catch (err) {
    console.warn('Kunne ikke lagre ordre i databasen:', err);
  }
  store.orders = normalizeOrders([record, ...store.orders]);
  emitData('local');
  try {
    const existing = JSON.parse(localStorage.getItem(ORDERS_KEY) || '[]');
    existing.unshift(record);
    localStorage.setItem(ORDERS_KEY, JSON.stringify(existing.slice(0, 30)));
  } catch (err) {
    console.warn('Kunne ikke lagre ordre lokalt:', err);
  }
  return record;
}

/** Oppdaterer status på en ordre (admin). */
export async function updateOrderStatus(orderId, status) {
  const order = store.orders.find((entry) => entry.id === orderId);
  if (!order) return false;
  const previous = order.status;
  order.status = status;
  order.statusUpdatedAt = Date.now();
  emitData('local');
  setSaveState('saving');
  try {
    if (remoteEnabled) {
      await restPatch(`${ORDERS_PATH}/${orderId}`, {
        status,
        statusUpdatedAt: order.statusUpdatedAt,
      });
      remoteOnline = true;
    }
    setSaveState('saved');
    return true;
  } catch (err) {
    order.status = previous;
    emitData('local');
    setSaveState('error', err && err.message ? err.message : 'Ukjent feil');
    return false;
  }
}

/** Alle ordre, nyeste først. */
export function getOrders() {
  return store.orders || [];
}

/** Enkel oppsummering til admin-dashbordet. */
export function getStats() {
  const sections = store.sections || [];
  const items = sections.flatMap((section) => section.items || []);
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const todays = (store.orders || []).filter(
    (order) => order.createdAt >= startOfDay.getTime()
  );
  const active = (store.orders || []).filter(
    (order) => order.status === 'mottatt' || order.status === 'tilberedning'
  );
  return {
    categoryCount: sections.length,
    itemCount: items.length,
    hiddenCount: items.filter((item) => item.hidden).length,
    soldOutCount: items.filter((item) => item.soldOut).length,
    groupCount: (store.optionGroups || []).length,
    newOrders: (store.orders || []).filter((order) => order.status === 'mottatt').length,
    activeOrders: active.length,
    todayOrders: todays.length,
    todayRevenue: todays
      .filter((order) => order.status !== 'avvist')
      .reduce((sum, order) => sum + (Number(order.total) || 0), 0),
  };
}

/** Henter kundens tidligere ordre (lokalt lagret). */
export function getLocalOrders() {
  try {
    return JSON.parse(localStorage.getItem(ORDERS_KEY) || '[]');
  } catch (err) {
    return [];
  }
}

/* ------------------------------------------------------------------ *
 * 11. Oppstart
 * ------------------------------------------------------------------ */

async function bootstrap() {
  // Start med lokal kopi slik at siden vises umiddelbart.
  const local = loadLocal();
  if (local) replaceMenuState(local);

  if (remoteEnabled) {
    try {
      const root = await restGet('');
      remoteOnline = true;
      if (root && typeof root === 'object' && root.sections) {
        replaceMenuState(root);
        applyRemoteOrders(root.orders);
      } else {
        // Databasen er tom: legg inn startmenyen én gang.
        store.updatedAt = Date.now();
        await restPatch('', menuPayload());
      }
    } catch (err) {
      remoteOnline = false;
      console.warn('Databasen er ikke tilgjengelig nå, bruker lokal kopi:', err);
    }
    startPolling();
  }

  writeLocal();
  setSaveState('saved');

  // Live-sync mellom faner i samme nettleser.
  if (channel) {
    channel.addEventListener('message', (event) => {
      if (!event.data || event.data.type !== 'state') return;
      const next = loadLocal();
      if (!next || Number(next.updatedAt) === Number(store.updatedAt)) return;
      replaceMenuState(next);
      emitData('remote');
    });
  }
  window.addEventListener('storage', (event) => {
    if (event.key !== LOCAL_KEY) return;
    const next = loadLocal();
    if (!next || Number(next.updatedAt) === Number(store.updatedAt)) return;
    replaceMenuState(next);
    emitData('remote');
  });

  emitData('init');
  readyResolve(store);
}

bootstrap();