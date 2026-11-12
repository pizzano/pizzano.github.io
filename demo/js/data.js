import { createDataNormalizers, detectIngredientRules } from './data-normalization.js?v=20261105-product-notes2';
import { reportSystemError, monitorCriticalOperation, flushSystemErrorQueue } from './system-errors.js';
import { confirmationDeadline, confirmationExpired, ORDER_CONFIRM_WAIT_MS, customerPageBaseUrl } from './order-confirmation.js';
import { calculatePickupSlots } from './pickup-slots.js';
import { effectivePickupLead, capacityFilteredSlots, pickupLoadFresh } from './pickup-capacity.js';
import { metricClock, recordDuration } from './performance-metrics.js';
import { loyaltyPhone, pizzaBonus, historicalPizzaEvents, largePizza } from './loyalty.js?v=20261023-customerprofile1';
/**
 * data.js — Delt datalag for Restauranten.
 *
 * Brukes av både kundesiden (app.js) og adminpanelet (admin.js).
 * Datakilde: Firebase Realtime Database via REST — vanlige fetch()-kall mot
 * .json-endepunktene. Ingen Firebase SDK og ingen API-nøkkel.
 *
 * Databasestruktur (rot):
 *   sections[]         — kategorier med produkter
 *   optionGroups[]     — gjenbrukbart valggruppe-bibliotek
 *   allergenCatalog[]  — {id,label} for avkryssing i admin
 *   settings{}         — adresse, åpningstid, hentetid, stengt-bryter
 *   popularItemIds[]   — produkter markert som populære
 *   orders{}           — innkomne ordre (nøkkel = ordre-ID)
 *   updatedAt          — tidsstempel for siste menyendring
 *
 * Menyen hentes fra Firebase, uten varig kopi i localStorage.
 * Kundens siste fire bestillinger lagres separat på kundens enhet.
 */

/* ------------------------------------------------------------------ *
 * 1. Database (Firebase Realtime Database REST)
 * ------------------------------------------------------------------ */
export const DB_URL = String(window.BESTILL_CONFIG?.databaseUrl || '').replace(/\/$/, '');
const CUSTOMER_MODE = window.BESTILL_CONFIG?.customerOnly === true;
const CUSTOMER_ORDER_LIMIT = 4;
const CUSTOMER_ORDER_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const CUSTOMER_ORDER_POLL_MS = 8 * 1000;

const ORDERS_PATH = 'orders';
// Large order feed migration is opt-in. Firebase Rules and a trusted worker
// must first guarantee a complete and fresh staff-only materialized view.
const COMPACT_ORDERS_PATH = 'adminOrderFeed';
const COMPACT_ORDER_MAX_AGE_MS = 45000;
const COMPACT_ORDER_FEED_REQUESTED =
  !CUSTOMER_MODE && window.BESTILL_CONFIG?.trustedCompactOrderFeed === true;
// Retry local diagnostic events only on reconnection, never in the critical order path.
window.addEventListener('online', () => { void flushSystemErrorQueue(); });
// Restore failures from a previously offline tab after a fresh page load.
window.setTimeout(() => { if (navigator.onLine !== false) void flushSystemErrorQueue(); }, 8000);
/** Hvor ofte kundesiden/admin ser etter endringer fra databasen (ms). */
const FALLBACK_ORDERS_INTERVAL = CUSTOMER_MODE ? 5000 : 15000;
// Ordering always verifies the current menu. A browsing customer needs only
// a low-frequency background version check; staff edits stay at 30 seconds.
const FALLBACK_MENU_INTERVAL = CUSTOMER_MODE ? 10 * 60 * 1000 : 30000;
// A focus event can trigger a small version read only after one minute.
const CUSTOMER_MENU_RETURN_MIN_MS = 60 * 1000;
const SCHEMA_VERSION = 6;

const RETIRED_MENU_KEY = 'bestill_menu_state_v3';
// IndexedDB contains only the public customer menu. Never cache /orders,
// /customers, SMS/email receipts, or customer contact data here.
const CUSTOMER_MENU_CACHE_DB = 'kol-customer-public-menu-v1';
const CUSTOMER_MENU_CACHE_KEYS = [
  'restaurantName','restaurantLogo','streetAddress','postalCode','city','country',
  'phone','email','timezone','openingDays','weeklyHours','manualClosedUntil',
  'pickupInfo','paymentInfo','minPreorderMinutes','prepMinutes',
  'pickupLeadMinutes','slotIntervalMinutes','busyModeEnabled','busyExtraMinutes',
  'pickupCapacityEnabled','pickupCapacityMax','uiFontXs','uiFontSm','uiFontMd',
  'uiFontLg','uiFontXl','customerDarkModeEnabled','customerPalette',
  'customCustomerPalette','specialDaysConfig','shopInfoEnabled',
  'ingredientCustomizationEnabled','cartSuggestionsEnabled','cartSuggestionsMax',
  'cartSuggestionRules','quickKitchenNotesEnabled','quickKitchenNotesConfig',
  'manualClosed','closedMessage'
];
// Only temporary opaque order IDs, never order data. Reopening the browser
// requires a new link from the customer's email/SMS.
const SESSION_ORDER_IDS_KEY = 'bestill_session_order_ids_v1';
const RETIRED_ORDERS_KEY = 'bestill_orders_v2';
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
export function getItemOptionGroups(item, sizeId = null) {
  if (!item) return [];
  const sizes = sizeId === '*' ? item.sizes || [] : [(item.sizes || []).find(size=>size.id===(sizeId || getDefaultSize(item)?.id))].filter(Boolean);
  const attached = [...new Set([...(item.optionGroupIds || []), ...sizes.flatMap(size=>size.optionGroupIds || [])])];
  return [...new Set([...(item.optionGroupOrder || []).filter(id => attached.includes(id)), ...attached])].map(findOptionGroup).filter(Boolean);
}

/** Detach from both the product and all of its size-specific attachments. */
export function removeItemOptionGroup(item, groupId) {
  if (!item) return;
  item.optionGroupOrder = (item.optionGroupOrder || []).filter(id => id !== groupId);
  item.optionGroupIds = (item.optionGroupIds || []).filter(id => id !== groupId);
  for (const size of item.sizes || []) {
    size.optionGroupIds = (size.optionGroupIds || []).filter(id => id !== groupId);
  }
}

/**
 * Deler adminens ingrediensfelt i rene navn.
 * Komma, semikolon og linjeskift støttes slik at nye produkter er enkle å legge inn.
 */
export function splitIngredientNames(value) {
  const seen = new Set();
  return String(value || '')
    .split(/[,;\n]+/)
    .map((name) => name.trim().replace(/\s+/g, ' '))
    .filter((name) => {
      if (!name) return false;
      const key = name.toLocaleLowerCase('no');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

/**
 * Lager/stabiliserer ingrediensregler fra ingrediensteksten.
 * Nye ingredienser kan fjernes som standard; admin kan låse enkeltingredienser.
 */
export function buildIngredientRules(value, existing = []) {
  const previous = new Map(
    asArray(existing)
      .map((entry) => {
        if (typeof entry === 'string') return [entry.toLocaleLowerCase('no'), { name: entry, removable: true }];
        if (!entry || typeof entry !== 'object') return null;
        const name = String(entry.name || entry.label || '').trim();
        return name ? [name.toLocaleLowerCase('no'), { name, removable: entry.removable !== false }] : null;
      })
      .filter(Boolean)
  );
  return splitIngredientNames(value).map((name) => {
    const prior = previous.get(name.toLocaleLowerCase('no'));
    return { name, removable: prior ? prior.removable !== false : true };
  });
}

/** Normaliserte ingrediensregler for et produkt. */
export function getItemIngredientRules(item) {
  if (!item) return [];
  const source = item.ingredients || '';
  return buildIngredientRules(source, item.ingredientRules || []);
}

/** Antall produkter som bruker en valggruppe. */
export function countProductsUsingGroup(groupId) {
  let count = 0;
  for (const section of store.sections || []) {
    for (const item of section.items || []) {
      if ([...(item.optionGroupIds || []), ...(item.sizes || []).flatMap(size=>size.optionGroupIds || [])].includes(groupId)) count += 1;
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
  for (const optionId of new Set(optionIds || [])) {
    const quantity = (optionIds || []).filter(id=>id===optionId).length;
    for (const group of store.optionGroups || []) {
      const option = (group.options || []).find((opt) => opt.id === optionId);
      if (option) {
        labels.push({
          groupTitle: group.title,
          label: quantity > 1 ? `${quantity} × ${option.label}` : option.label,
          price: (Number(option.price) || 0) * quantity,
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
  restaurantName: '',
  restaurantLogo: '',
  streetAddress: '',
  postalCode: '',
  city: '',
  country: '',
  phone: '',
  email: '',
  timezone: 'Europe/Oslo',
  openingDays: '',
  weeklyHours: null,
  manualClosedUntil: 0,
  pickupInfo: 'Henting i restauranten',
  paymentInfo: 'Betaling ved henting',
  orderAlarmUrl: new URL('../soundreality-police-operation-siren-144229.mp3', import.meta.url).pathname,
  minPreorderMinutes: 0,
  prepMinutes: 25,
  pickupLeadMinutes: 30,
  slotIntervalMinutes: 15,
  // Opt-in operational controls. Existing restaurants keep the same pickup flow.
  busyModeEnabled: false,
  busyExtraMinutes: 15,
  pickupCapacityEnabled: false,
  pickupCapacityMax: 4,
  // Five UI text tiers shared by customer and admin; editable in restaurant settings.
  uiFontXs: 10,
  uiFontSm: 12,
  uiFontMd: 14,
  uiFontLg: 18,
  uiFontXl: 22,
  // Epson 80 mm thermal slip settings are independent of on-screen typography.
  printerQtySize: 39,
  printerItemNameSize: 35,
  printerSizeTextSize: 28,
  printerExtraTextSize: 22,
  printerPriceSize: 24,
  printerSidePadding: 5,
  adminMobileEnabled: true,
  adminDarkModeEnabled: true,
  customerDarkModeEnabled: true,
  customerPalette: 'reference',
  customCustomerPalette: '', // JSON string: custom seven-color light and dark themes.
  specialDaysConfig: '', // Compact JSON: enabled, animation and per-day overrides.
  shopInfoEnabled: true,
  ingredientCustomizationEnabled: true,
  // Optional customer extras: all settings live alongside the existing menu.
  cartSuggestionsEnabled: true,
  cartSuggestionsMax: 3,
  cartSuggestionRules: '', // JSON: pizza/burger/kebab/tallerken/other -> up to three item IDs.
  quickKitchenNotesEnabled: true,
  quickKitchenNotesConfig: '', // JSON: category -> permitted short kitchen requests.
  manualClosed: true,
  closedMessage: 'Vi tar ikke imot bestillinger akkurat nå.',
};

/** '14:30' → 870 minutter. */
export function parseTime(text) {
  const match = /^(\d{1,2})[:.](\d{2})$/.exec(String(text || '').trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}

/** 870 → '14:30'. */
export function formatMinutes(total) {
  const normalized = ((Math.round(Number(total) || 0) % 1440) + 1440) % 1440;
  const hour = Math.floor(normalized / 60);
  const minute = normalized % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}


/* Weekly opening hours are the sole schedule source for customer and admin.
 * Unconfigured days use 14:00–22:00 until weeklyHours is saved.
 * Day indices: Monday=0 ... Sunday=6 (Europe/Oslo). */
export const RESTAURANT_WEEKDAYS = Object.freeze([
  { id:'mon', short:'Man', name:'Mandag' }, { id:'tue', short:'Tir', name:'Tirsdag' },
  { id:'wed', short:'Ons', name:'Onsdag' }, { id:'thu', short:'Tor', name:'Torsdag' },
  { id:'fri', short:'Fre', name:'Fredag' }, { id:'sat', short:'Lør', name:'Lørdag' },
  { id:'sun', short:'Søn', name:'Søndag' },
]);
const HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/;
function validClock(text) { return typeof text==='string' && HH_MM.test(text) ? text : null; }
export function getWeeklyHours(settings=store.settings||DEFAULT_SETTINGS) {
  const open = '14:00';
  const close = '22:00';
  if (!Array.isArray(settings.weeklyHours) || settings.weeklyHours.length!==7)
    return RESTAURANT_WEEKDAYS.map(day=>({id:day.id,enabled:true,open,close}));
  return RESTAURANT_WEEKDAYS.map((day,i)=>{
    const raw=settings.weeklyHours[i]||{};
    return {
      id:day.id, enabled:raw.enabled!==false,
      open:validClock(raw.open)||open,
      close:validClock(raw.close)||close,
    };
  });
}
function localClock(date,timezone) {
  const parts=new Intl.DateTimeFormat('en-GB',{
    timeZone:timezone,hour:'2-digit',minute:'2-digit',weekday:'short',hour12:false,
  }).formatToParts(date);
  const hours=Number(parts.find(p=>p.type==='hour')?.value)||0;
  const minutes=Number(parts.find(p=>p.type==='minute')?.value)||0;
  const label=String(parts.find(p=>p.type==='weekday')?.value||'Mon').toLowerCase().slice(0,3);
  const weekdayIndex=['mon','tue','wed','thu','fri','sat','sun'].indexOf(label);
  return {minute:hours%24*60+minutes,weekday:weekdayIndex>=0?weekdayIndex:0};
}
function scheduleAt(settings,now) {
  const timezone=settings.timezone||'Europe/Oslo';
  let clock;
  try { clock=localClock(now,timezone); } catch {
    const d=now.getDay();clock={minute:now.getHours()*60+now.getMinutes(),weekday:(d+6)%7};
  }
  const week=getWeeklyHours(settings);
  const t=clock.minute,i=clock.weekday;
  const yesterday=week[(i+6)%7],today=week[i];
  const yStart=parseTime(yesterday.open),yEnd=parseTime(yesterday.close);
  const tStart=parseTime(today.open),tEnd=parseTime(today.close);
  let active=null;
  if(yesterday.enabled&&yStart!==null&&yEnd!==null&&yEnd<=yStart&&t<yEnd)
    active={end:yesterday.close,minutesToClose:yEnd-t,day:(i+6)%7};
  if(!active&&today.enabled&&tStart!==null&&tEnd!==null&&t>=tStart&&(tEnd<=tStart||t<tEnd))
    active={end:today.close,minutesToClose:(tEnd>tStart?tEnd-t:1440-t+tEnd),day:i};
  let upcoming=null;
  for(let offset=0;offset<=7;offset++){
    const day=week[(i+offset)%7];
    if(!day.enabled)continue;
    const minutes=parseTime(day.open);
    if(minutes===null)continue;
    const distance=offset*1440+minutes-t;
    if(distance>0){upcoming={start:day.open,day:(i+offset)%7,minutesUntilOpen:distance};break;}
  }
  return {
    open:Boolean(active),active,upcoming,
    opensAt:upcoming?.start||'—',
    closesAt:active?.end||today.close,
    opensOnDay:upcoming?.day??null,
    minutesUntilOpen:upcoming?.minutesUntilOpen??null,
  };
}

/** Returns the same truthful restaurant status to customer and staff.
 * Date parameter permits deterministic time-window tests. */
export function getOpenState(at=new Date()) {
  const settings=store.settings||DEFAULT_SETTINGS;
  const now=at instanceof Date?at:new Date(at);
  const scheduled=scheduleAt(settings,now);
  const until=Number(settings.manualClosedUntil)||0;
  const temporarilyClosed=settings.manualClosed===true && (until<=0||until>now.getTime());
  if(temporarilyClosed){
    const reopening=until>now.getTime()?scheduleAt(settings,new Date(until)):null;
    let opensAt=scheduled.opensAt;
    if(until>now.getTime()){
      if(reopening?.open){
        try{opensAt=new Intl.DateTimeFormat('nb-NO',{timeZone:settings.timezone||'Europe/Oslo',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(until));}
        catch{opensAt=formatMinutes(new Date(until).getHours()*60+new Date(until).getMinutes());}
      }else opensAt=reopening?.opensAt||opensAt;
    }
    return {open:false,reason:'manuelt',label:'Stengt',opensAt,closesAt:scheduled.closesAt,
      manualClosedUntil:until>now.getTime()?until:0,minutesToClose:0,
      opensOnDay:reopening?.opensOnDay??scheduled.opensOnDay,
      minutesUntilOpen:reopening?.minutesUntilOpen??scheduled.minutesUntilOpen};
  }
  // Forhåndsbestilling er kun tilgjengelig fra midnatt til dagens åpning,
  // på en dag som faktisk har åpningstid. Manuell stenging overstyrer alltid.
  const timezone=settings.timezone||'Europe/Oslo';
  let clock;
  try { clock=localClock(now,timezone); }
  catch { const d=now.getDay();clock={minute:now.getHours()*60+now.getMinutes(),weekday:(d+6)%7}; }
  const today=getWeeklyHours(settings)[clock.weekday];
  const todayStart=parseTime(today.open);
  const preOpen=!scheduled.open && today.enabled && todayStart!==null && clock.minute<todayStart;
  return {
    preOpen,orderable:scheduled.open||preOpen,
    todayOpensAt:today.open, todayClosesAt:today.close,
    open:scheduled.open,reason:scheduled.open?'':'utenfor_apningstid',
    label:scheduled.open?'Åpent nå':'Stengt nå',
    opensAt:scheduled.opensAt,closesAt:scheduled.closesAt,
    manualClosedUntil:0,
    minutesToClose:scheduled.active?.minutesToClose||0,
    opensOnDay:scheduled.opensOnDay,minutesUntilOpen:scheduled.minutesUntilOpen,
  };
}
/* The customer only reads public, aggregate 15-minute counts.
 * This is advisory and never reads another customer's order or phone. */
let pickupLoadSnapshot = null;
let pickupLoadLastFetchAt = 0;
let pickupLoadRequest = null;
export function pickupLoadIsFresh() {
  return pickupLoadFresh(pickupLoadSnapshot);
}
export async function refreshPublicPickupLoad(force = false) {
  if (store.settings?.pickupCapacityEnabled !== true || !DB_URL) return false;
  if (pickupLoadRequest) return pickupLoadRequest;
  if (!force && Date.now() - pickupLoadLastFetchAt < 20000) return false;
  pickupLoadLastFetchAt = Date.now();
  pickupLoadRequest = (async () => {
    try {
      const response = await fetch(DB_URL + '/publicPickupLoad.json', {
        cache: 'no-store', signal: AbortSignal.timeout(6000),
      });
      if (!response.ok) throw new Error('Kapasitet kunne ikke hentes');
      const value = await response.json();
      pickupLoadSnapshot = value && typeof value === 'object' ? value : null;
      return true;
    } catch {
      pickupLoadSnapshot = null; // stale counts must never block valid orders
      return false;
    } finally {
      pickupLoadRequest = null;
    }
  })();
  return pickupLoadRequest;
}

/** Pickup options calculated from the active window, including after midnight.
 * Clock conversion stays local to data.js; slot arithmetic is independently tested. */
export function getPickupSlots() {
  const settings = store.settings || DEFAULT_SETTINGS;
  const state = getOpenState();
  if (!state.open && !state.preOpen) return [];
  const now = new Date();
  let nowMinute;
  try { nowMinute = localClock(now, settings.timezone || 'Europe/Oslo').minute; }
  catch { nowMinute = now.getHours() * 60 + now.getMinutes(); }
  const openMinute = parseTime(state.todayOpensAt);
  const slots = calculatePickupSlots({
    open: state.open,
    preOpen: state.preOpen,
    minutesToClose: state.minutesToClose,
    nowMinute,
    openMinute,
    closeMinute: parseTime(state.todayClosesAt),
    pickupLeadMinutes: effectivePickupLead(settings),
  });
  return capacityFilteredSlots(slots, settings, pickupLoadSnapshot, {
    at: now.getTime(), preOpen: state.preOpen, openMinute,
    timezone: settings.timezone || 'Europe/Oslo',
  });
}

/* ------------------------------------------------------------------ *
 * 5. Ordrestatus
 * ------------------------------------------------------------------ */

export const ORDER_STATUSES = [
  { id: 'mottatt', label: 'Mottatt' },
  { id: 'bekreftet', label: 'Bekreftet' },
  { id: 'tilberedning', label: 'Tilberedes' },
  { id: 'klar', label: 'Klar for henting' },
  { id: 'avvist', label: 'Avvist' },
];

/** Etikett for en ordrestatus. */
export function orderStatusLabel(status) {
  // Old order records retain this status for history/bonus compatibility only.
  if (status === 'fullfort') return 'Avsluttet (eldre ordre)';
  const found = ORDER_STATUSES.find((entry) => entry.id === status);
  return found ? found.label : 'Ny';
}

/* ------------------------------------------------------------------ *
 * 6. Tom starttilstand — ingen eksempelmeny
 * ------------------------------------------------------------------ */

function emptyState() {
  return { schemaVersion: SCHEMA_VERSION, settings: { ...DEFAULT_SETTINGS }, allergenCatalog: clone(DEFAULT_ALLERGENS), optionGroups: [], sections: [], popularItemIds: [], orders: [], updatedAt: 0 };
}

/* ------------------------------------------------------------------ *
 * 7. Normalisering — sikrer at data alltid har riktig form
 * ------------------------------------------------------------------ */

function asArray(value) {
  if (Array.isArray(value)) return value.filter((entry) => entry !== null);
  if (value && typeof value === 'object') return Object.values(value);
  return [];
}

/* Firebase I/O stays in data.js; data shape conversions are a pure module. */
const { normalizeOrders, normalizeState } = createDataNormalizers({
  DEFAULT_SETTINGS,
  DEFAULT_ALLERGENS,
  RESTAURANT_WEEKDAYS,
  ORDER_STATUSES,
  SCHEMA_VERSION,
  asArray,
  clone,
  uid,
  validClock,
  confirmationDeadline,
  buildIngredientRules,
  detectIngredientRules
});

/* ------------------------------------------------------------------ *
 * 8. Tilstand, abonnenter og lagringsstatus
 * ------------------------------------------------------------------ */

/** Delt, mutérbar tilstand. Les fritt, skriv kun via mutate(). */
export const store = normalizeState(emptyState());

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
let customerOfflineMenuAvailable = false;
// Admin must never save an empty menu if its initial Firebase fetch failed.
let adminMenuVerified = CUSTOMER_MODE;

/** Om appen har kontakt med Firebase. */
export const backendInfo = {
  get mode() {
    return remoteOnline ? 'firebase' : 'local';
  },
  get hasOfflineMenu() {
    return CUSTOMER_MODE && customerOfflineMenuAvailable;
  },
  get menuLoaded() {
    return CUSTOMER_MODE || adminMenuVerified;
  },
  get label() {
    if (!remoteEnabled) return 'Firebase ikke konfigurert';
    if (!CUSTOMER_MODE && !adminMenuVerified)
      return 'Menyen er ikke lastet. Kontroller Firebase og prøv igjen.';
    if (remoteOnline) return 'Firebase Realtime Database (REST)';
    return this.hasOfflineMenu
      ? 'Frakoblet — lagret meny (bestilling krever Firebase)'
      : 'Frakoblet — ingen lokalt lagret meny';
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

let remoteMenuPath = '';
let fallbackTimer = null;
let ordersStream = null;
let ordersStreamHealthy = false;
let ordersStreamStartedAt = 0;
let ordersRaw = {};
let adminOrdersSnapshotLoaded = false;
let orderStreamRevision = 0;
let ordersFallbackBusy = false;
let compactFeedActive = false;
let compactFeedDisabledForSession = false;
let compactFeedRaw = {};
let compactFeedGeneratedAt = 0;
export function isTrustedCompactOrderFeedActive() {
  return !CUSTOMER_MODE && compactFeedActive;
}
// Data from the public page (or a forged publisher label) is not proof of
// authorization. This contract is usable only after backend + Rules review.
function validatedCompactOrderFeed(snapshot, now = Date.now()) {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return null;
  const meta=snapshot.meta, orders=snapshot.orders;
  if (!meta || meta.schemaVersion !== 1 ||
      meta.publisher !== 'trusted-firebase-order-worker-v1' ||
      meta.ready !== true || meta.completeOpenOrders !== true ||
      meta.backendMaintainsLoyalty !== true ||
      meta.backendMaintainsRetention !== true ||
      meta.backendMaintainsLegacyMigration !== true ||
      !orders || typeof orders !== 'object' || Array.isArray(orders)) return null;
  const stamp=Number(meta.generatedAt);
  if (!Number.isSafeInteger(stamp) || stamp <= 0 ||
      stamp > now + 15000 || now - stamp >= COMPACT_ORDER_MAX_AGE_MS) return null;
  const keys=Object.keys(orders);
  if (keys.length > 250 || Number(meta.includedOrderCount) !== keys.length) return null;
  let active=0;
  const open=new Set(['mottatt','bekreftet','tilberedning','klar']);
  for (const id of keys) {
    const o=orders[id];
    if (!/^ord_[a-z0-9]{7,40}$/i.test(id) || !o || typeof o !== 'object' ||
        o.id !== id || typeof o.status !== 'string' ||
        !Number.isSafeInteger(Number(o.createdAt)) ||
        !Number.isFinite(Number(o.total)) || !Array.isArray(o.lines) ||
        !String(o.phone || '').trim()) return null;
    if (open.has(o.status)) active++;
  }
  if (Number(meta.openOrderCount) !== active) return null;
  return {orders,generatedAt:stamp};
}

let menuFallbackBusy = false;
let lastMenuFallbackAt = 0;
let menuRefreshPromise = null;
let saveTimer = null;
let readyResolve;
const readyPromise = new Promise((resolve) => {
  readyResolve = resolve;
});

/** Løses når første datalasting er ferdig. */
export function ready() {
  return readyPromise;
}

// Old versions stored a complete menu JSON snapshot on every visit.
 // Firebase is now the only persisted menu source. Remove the old copy once.
function removeRetiredMenuCache() {
  try { localStorage.removeItem(RETIRED_MENU_KEY); }
  catch (_) { /* storage can be disabled by browser privacy settings */ }
}

/** Leser fra databasen: GET <DB_URL>/<path>.json */
// Bound REST reads to avoid hanging when a connection is blocked.
// Keep the timeout independent of any admin retry UI.
const pendingRestReads = new Map();
async function restGet(path, timeoutMs = 9000) {
  // Coalesce only overlapping identical reads; mutable records are never cached.
  const key = String(path || '') + '|' + timeoutMs;
  if (pendingRestReads.has(key)) return pendingRestReads.get(key);
  const request = (async () => {
    const timing = metricClock();
    try {
      const suffix = path ? `/${path}.json` : '/.json';
      const response = await fetch(`${DB_URL}${suffix}`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        cache: 'no-store',
        ...(timeoutMs ? { signal: AbortSignal.timeout(timeoutMs) } : {}),
      });
      if (!response.ok) throw new Error(`Kunne ikke hente data (${response.status})`);
      return await response.json();
    } finally { recordDuration('firebase_read', timing); }
  })();
  pendingRestReads.set(key, request);
  try { return await request; }
  finally { if (pendingRestReads.get(key) === request) pendingRestReads.delete(key); }
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
/* Admin-only incremental public menu writes. No change to order/customer writes.
 * Firebase REST accepts atomic multi-location PATCH keys with slash paths.
 * A compact live delta is published with the very same atomic write.
 */
let lastSavedPublicSnapshot=null;
const LIVE_DELTA_MAX_BYTES=12000;
function publicMenuForDiff(payload){
 const {settings,...fields}=payload;
 return {menu:fields,settings};
}
function publicMenuChanges(before,after){
 const changes=[];
 const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
 function walk(oldValue,newValue,path){
  if(equal(oldValue,newValue))return;
  if(Array.isArray(newValue)&&Array.isArray(oldValue)){
   // Stable arrays allow precise item-field updates. Structural changes
   // replace only the affected array to avoid Firebase array index drift.
   const stable=newValue.length===oldValue.length&&newValue.every((v,i)=>{
    const old=oldValue[i];
    if(v&&old&&typeof v==='object'&&typeof old==='object'&&!Array.isArray(v)&&!Array.isArray(old))
      return (v.id===undefined&&old.id===undefined)||String(v.id)===String(old.id);
    return true;
   });
   if(!stable){changes.push({path,value:newValue});return}
   for(let i=0;i<newValue.length;i++)walk(oldValue[i],newValue[i],path+'/'+i);
   return;
  }
  if(newValue&&oldValue&&typeof newValue==='object'&&typeof oldValue==='object'&&!Array.isArray(newValue)&&!Array.isArray(oldValue)){
   for(const key of new Set([...Object.keys(oldValue),...Object.keys(newValue)])){
    if(key.includes('/')||key==='__proto__'||key==='constructor'||key==='prototype')throw Error('Invalid menu key');
    walk(oldValue[key],newValue[key],path+'/'+key);
   }
   return;
  }
  changes.push({path,value:newValue===undefined?null:newValue});
 }
 for(const field of ['settings','menu']){
  const old=before?.[field],now=after[field];
  if(old===undefined)continue;
  walk(old,now,field);
 }
 return changes;
}
function menuPayload() {
  return {
    schemaVersion: SCHEMA_VERSION,
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
  const source = value?.menu || value || {};
  if (!CUSTOMER_MODE && (!Array.isArray(source.sections) ||
      !Array.isArray(source.optionGroups))) {
    throw new Error('Firebase returnerte ingen gyldig restaurantmeny. Ikke lagre tomme data.');
  }
  remoteMenuPath = value?.menu ? 'menu' : '';
  const normalized = normalizeState(source);
  const before = JSON.stringify(menuPayload());
  replaceMenuState(normalized);
  if (!CUSTOMER_MODE) {
    adminMenuVerified = true;
    lastSavedPublicSnapshot = publicMenuForDiff(menuPayload());
  }
  return before !== JSON.stringify(menuPayload());
}

/* A GET begun before a status write can return after the local update.
   Keep local status until Firebase confirms it, without hiding newer updates. */
const orderWriteGuards = new Map();
let nextOrdersPullId = 0;
let lastAppliedOrdersPullId = 0;
function beginOrderStatusWrite(order) {
  const guard = { status: order.status,
    statusUpdatedAt: Number(order.statusUpdatedAt) || 0,
    expiresAt: Date.now() + 30000, committed: false };
  orderWriteGuards.set(order.id, guard);
  return guard;
}
function finishOrderStatusWrite(orderId, guard, succeeded) {
  if (orderWriteGuards.get(orderId) !== guard) return;
  if (succeeded) guard.committed = true;
  else orderWriteGuards.delete(orderId);
}
function mergePendingOrderStatuses(next) {
  if (!orderWriteGuards.size) return next;
  const localById = new Map(store.orders.map(order => [order.id, order]));
  return next.map(remote => {
    const guard = orderWriteGuards.get(remote.id);
    if (!guard) return remote;
    const version = Number(remote.statusUpdatedAt) || 0;
    if (guard.committed && remote.status === guard.status
        && version >= guard.statusUpdatedAt) {
      orderWriteGuards.delete(remote.id);
      return remote;
    }
    if (Date.now() > guard.expiresAt || version > guard.statusUpdatedAt) {
      orderWriteGuards.delete(remote.id);
      return remote;
    }
    const local = localById.get(remote.id);
    return local?.status === guard.status ? local : remote;
  });
}

/** Fingerprint the fields used by the order list and notifications. */
function orderDisplaySignature(o) {
  return JSON.stringify([
    o.id, o.status, Number(o.statusUpdatedAt) || 0,
    o.emailReceipts || {}, o.smsReceipts || {},
    Number(o.estimatedMinutes) || 0, Number(o.estimatedAt) || 0,
    Number(o.estimatedReadyAt) || 0,
    o.rejectionReason || '', o.rejectionMessage || '',
    o.pickup || '', Number(o.total) || 0,
    Array.isArray(o.lines) ? o.lines.map(line => [
      line.itemId || '', Number(line.quantity) || 1,
      line.comment || '',
      Array.isArray(line.removedIngredients) ? line.removedIngredients.join('|') : '',
    ]) : [],
  ]);
}
let lastOrderDisplaySignatures = new Map();
function applyRemoteOrders(value, changedOrderId = '') {
  const next = mergePendingOrderStatuses(normalizeOrders(value));
  if (changedOrderId && lastOrderDisplaySignatures.size && !orderWriteGuards.size) {
    const changed = next.find(order => order.id === changedOrderId);
    const oldSignature = lastOrderDisplaySignatures.get(changedOrderId);
    const newSignature = changed ? orderDisplaySignature(changed) : undefined;
    if (newSignature === undefined) lastOrderDisplaySignatures.delete(changedOrderId);
    else lastOrderDisplaySignatures.set(changedOrderId, newSignature);
    store.orders = next;
    return oldSignature !== newSignature;
  }
  // Root snapshots, reconnects and pending local writes require a full check.
  const signatures = new Map(next.map(order => [order.id, orderDisplaySignature(order)]));
  const changed = signatures.size !== lastOrderDisplaySignatures.size ||
    [...signatures].some(([id, signature]) => lastOrderDisplaySignatures.get(id) !== signature);
  lastOrderDisplaySignatures = signatures;
  store.orders = next;
  return changed;
}

/** Apply Firebase Realtime Database SSE put/patch deltas to the local orders
 * snapshot. Firebase paths are relative to /orders.json. No root re-download
 * is needed when a single order changes.
 */
function applyStreamChange(value, path, data, isPatch) {
  const segments = String(path || '/').split('/').filter(Boolean);
  const root = value && typeof value === 'object' ? value : {};

  if (isPatch) {
    // Firebase multipath updates can contain keys such as "id/status".
    // Apply each changed leaf instead of treating that as a literal key.
    for (const [key, entry] of Object.entries(data && typeof data === 'object' ? data : {})) {
      const destination = '/' + [...segments, key].join('/');
      applyStreamChange(root, destination, entry, false);
    }
    return root;
  }

  if (!segments.length) return data && typeof data === 'object' ? data : {};

  let target = root;
  for (const segment of segments.slice(0, -1)) {
    if (!target[segment] || typeof target[segment] !== 'object') target[segment] = {};
    target = target[segment];
  }
  const key = segments[segments.length - 1];
  if (data === null) delete target[key];
  else target[key] = data;
  return root;
}

function parseFirebaseEvent(event) {
  const value = JSON.parse(event.data);
  if (!value || typeof value.path !== 'string' || !Object.hasOwn(value, 'data')) {
    throw new Error('Ugyldig Firebase-endringsmelding.');
  }
  return value;
}

function streamUrl(path) {
  return DB_URL + '/' + path + '.json';
}

// Customer pages never open /orders.json. Keep at most ONE live Firebase
// SSE listener for the newest tracked order, to avoid blocking order writes.
// This is the REST-stream equivalent of onValue; failed streams use REST fallback.
let customerOrderStream = null;
let customerOrderStreamId = '';
let customerOrderStreamHealthy = false;
let customerPollBusy = false;
let lastCustomerPollAt = 0;
// A closed/rejected EventSource must not be reopened every 5-second poll.
// REST fallback remains active during the bounded retry delay.
let customerStreamFailures = 0;
let customerStreamRetryAfter = 0;
function backoffCustomerOrderStream() {
  customerStreamFailures = Math.min(customerStreamFailures + 1, 5);
  customerStreamRetryAfter = Date.now() + Math.min(30000, 2000 * (2 ** (customerStreamFailures - 1)));
  closeCustomerOrderStream();
}
function markCustomerStreamHealthy() {
  customerStreamFailures = 0;
  customerStreamRetryAfter = 0;
  customerOrderStreamHealthy = true;
}

export function customerOrderHasLiveListener(orderId) {
  return CUSTOMER_MODE && customerOrderStreamHealthy && customerOrderStreamId === orderId;
}
function closeCustomerOrderStream() {
  if (customerOrderStream) customerOrderStream.close();
  customerOrderStream = null;
  customerOrderStreamId = '';
  customerOrderStreamHealthy = false;
}
function startCustomerOrderStream() {
  if (!CUSTOMER_MODE || !remoteEnabled || !('EventSource' in window) ||
      document.hidden || navigator.onLine === false) return;
  const id = [...customerTrackedIds()].at(-1);
  if (!id) { closeCustomerOrderStream(); return; }
  if (customerOrderStream && customerOrderStreamId === id) return;
  if (Date.now() < customerStreamRetryAfter) return;
  closeCustomerOrderStream();
  const source = new EventSource(streamUrl(ORDERS_PATH + '/' + encodeURIComponent(id)));
  customerOrderStream = source;
  customerOrderStreamId = id;
  const update = (event, patch) => {
    if (source !== customerOrderStream) return;
    try {
      const change = parseFirebaseEvent(event);
      const previous = { [id]: ordersRaw[id] || null };
      const changed = applyStreamChange(previous, '/' + id + change.path, change.data, patch);
      const updated = changed?.[id];
      if (updated) ordersRaw[id] = updated;
      else { delete ordersRaw[id]; forgetCustomerOrderId(id); }
      markCustomerStreamHealthy();
      remoteOnline = true;
      if (applyRemoteOrders(ordersRaw)) emitData('remote');
      if (!updated) closeCustomerOrderStream();
    } catch (error) {
      console.warn('Kundeordre-strøm feilet:', error);
      closeCustomerOrderStream();
    }
  };
  source.addEventListener('put', event => update(event, false));
  source.addEventListener('patch', event => update(event, true));
  source.onerror = () => {
    if (source !== customerOrderStream) return;
    customerOrderStreamHealthy = false;
    if (source.readyState === 2) backoffCustomerOrderStream();
  };
  for (const kind of ['cancel','auth_revoked']) {
    source.addEventListener(kind, () => {
      if (source === customerOrderStream) backoffCustomerOrderStream();
    });
  }
}

// No customer order snapshots are saved to localStorage. A short-lived
// session-only list keeps live order tracking after an ordinary page reload.
// It contains IDs only (never names, phones, items, prices or old statuses).
let sessionOrderIds = [];
function saveSessionOrderIds() {
  if (!CUSTOMER_MODE) return;
  try { sessionStorage.setItem(SESSION_ORDER_IDS_KEY, JSON.stringify(sessionOrderIds)); }
  catch (_) { /* private browsing may disable session storage */ }
}
function readSessionOrderIds() {
  if (!CUSTOMER_MODE) return;
  try {
    const ids=JSON.parse(sessionStorage.getItem(SESSION_ORDER_IDS_KEY)||'[]');
    sessionOrderIds=Array.isArray(ids)
      ? [...new Set(ids.filter(id=>typeof id==='string' && /^ord_[a-z0-9]{7,40}$/i.test(id)))].slice(-CUSTOMER_ORDER_LIMIT)
      : [];
  } catch (_) { sessionOrderIds=[]; }
}
export function trackCustomerOrderId(orderId) {
  if (!CUSTOMER_MODE || !/^ord_[a-z0-9]{7,40}$/i.test(String(orderId||''))) return;
  sessionOrderIds=[...sessionOrderIds.filter(id=>id!==orderId),orderId].slice(-CUSTOMER_ORDER_LIMIT);
  saveSessionOrderIds();
  syncCustomerStreams();
}
export function forgetCustomerOrderId(orderId) {
  if (!CUSTOMER_MODE) return;
  const size=sessionOrderIds.length;
  sessionOrderIds=sessionOrderIds.filter(id=>id!==orderId);
  if(size!==sessionOrderIds.length)saveSessionOrderIds();
}
function customerTrackedIds() {
  const now=Date.now();
  return sessionOrderIds.filter(id=>{
    const current=ordersRaw[id];
    if (!current) return true; // Fetch from Firebase; never guess from cache.
    const createdAt=Number(current.createdAt)||0;
    return (!createdAt || now-createdAt<=CUSTOMER_ORDER_MAX_AGE_MS) &&
      !['avvist','fullfort','klar'].includes(current.status);
  });
}

// One live listener follows the newest customer order. Other tracked orders
// and disconnected browsers use bounded REST fallback.
function syncCustomerStreams() {
  if (!CUSTOMER_MODE) return;
  startCustomerOrderStream();
  void pollCustomerOrders(true);
}

async function pollCustomerOrders(force = false) {
  if (!CUSTOMER_MODE || customerPollBusy || document.hidden || navigator.onLine === false) return;
  const now = Date.now();
  // Focus, visibility and reconnect may all fire within one second.
  // Coalesce forced refreshes while keeping explicit order-detail checks separate.
  if (force && now - lastCustomerPollAt < 2500) return;
  // Fast updates for pending/preparing orders; reduce idle Firebase reads
  // when all locally tracked orders have reached a terminal state.
  const tracked = customerTrackedIds();
  const needsLiveUpdates = tracked.some(id => {
    const status = String(ordersRaw[id]?.status || '');
    return !status || ['mottatt', 'bekreftet', 'tilberedning'].includes(status);
  });
  const interval = needsLiveUpdates ? CUSTOMER_ORDER_POLL_MS : 30000;
  if (!force && now - lastCustomerPollAt < interval) return;
  const ids = [...tracked].reverse().filter(id =>
    !(customerOrderStreamHealthy && customerOrderStreamId === id));
  if (!ids.length) return;
  lastCustomerPollAt = now;
  customerPollBusy = true;
  try {
    // Never occupy all of the browser's HTTP connections by reading four
    // old orders at once. Fetch the newest first; at most two in parallel.
    const responses = [];
    for (let i = 0; i < ids.length; i += 2) {
      const batch = await Promise.all(ids.slice(i, i + 2).map(async id => {
        try { return [id, await restGet(ORDERS_PATH + '/' + encodeURIComponent(id), 7500)]; }
        catch { return [id, undefined]; }
      }));
      responses.push(...batch);
    }
    let changed = false;
    for (const [id, order] of responses) {
      if (order === undefined) continue;
      if (order) ordersRaw[id] = order;
      else { delete ordersRaw[id]; forgetCustomerOrderId(id); }
      changed = true;
    }
    if (changed && applyRemoteOrders(ordersRaw)) emitData('remote');
  } finally {
    customerPollBusy = false;
  }
}

function recoverFullOrdersStream(reason) {
  compactFeedDisabledForSession = true;
  compactFeedActive = false;
  compactFeedRaw = {};
  compactFeedGeneratedAt = 0;
  if (ordersStream) ordersStream.close();
  ordersStream = null;
  ordersStreamHealthy = false;
  console.warn('Kompakt ordreakse ikke verifisert. Standard /orders benyttes:', reason);
  beginOrdersStream();
}
function beginTrustedCompactOrdersStream() {
  if (!COMPACT_ORDER_FEED_REQUESTED || compactFeedDisabledForSession ||
      !('EventSource' in window)) return false;
  try {
    const source = new EventSource(streamUrl(COMPACT_ORDERS_PATH));
    ordersStream = source;
    ordersStreamStartedAt = Date.now();
    let initialized = false;
    const handle = (event, patch) => {
      if (ordersStream !== source) return;
      try {
        const eventData = parseFirebaseEvent(event);
        if (!initialized && (patch || eventData.path !== '/'))
          throw new Error('Krever komplett første snapshot');
        const next = applyStreamChange(compactFeedRaw,
          eventData.path,eventData.data,patch);
        const state = validatedCompactOrderFeed(next);
        if (!state) throw new Error('Ugyldig / utløpt backendindeks');
        compactFeedRaw = next;
        compactFeedGeneratedAt = state.generatedAt;
        compactFeedActive = true;
        initialized = true;
        ordersRaw = {...state.orders};
        orderStreamRevision++;
        ordersStreamHealthy = true;
        remoteOnline = true;
        if (applyRemoteOrders(ordersRaw)) emitData('remote');
      } catch (error) {
        recoverFullOrdersStream(error?.message || 'ugyldig melding');
      }
    };
    source.addEventListener('put',event => handle(event,false));
    source.addEventListener('patch',event => handle(event,true));
    source.onerror = () => {
      if (ordersStream === source) recoverFullOrdersStream('SSE-feil');
    };
    for (const kind of ['cancel','auth_revoked']) {
      source.addEventListener(kind,() => {
        if (ordersStream === source) recoverFullOrdersStream(kind);
      });
    }
    return true;
  } catch(error) {
    compactFeedDisabledForSession = true;
    console.warn('Kompakt ordreakse kunne ikke startes:',error);
    return false;
  }
}

function beginOrdersStream() {
  if (beginTrustedCompactOrdersStream()) return;
  if (!('EventSource' in window)) return;
  try {
    const source = new EventSource(streamUrl(ORDERS_PATH));
    ordersStream = source;
    ordersStreamStartedAt = Date.now();
    const update = (event, patch) => {
      try {
        const change = parseFirebaseEvent(event);
        ordersRaw = applyStreamChange(ordersRaw, change.path, change.data, patch);
        if (change.path === '/' && !patch) adminOrdersSnapshotLoaded = true;
        orderStreamRevision += 1;
        ordersStreamHealthy = true;
        remoteOnline = true;
        const changedId = change.path.split('/').filter(Boolean)[0] || '';
        if (applyRemoteOrders(ordersRaw, changedId)) emitData('remote');
      } catch (error) {
        ordersStreamHealthy = false;
        console.warn('Kunne ikke bruke Firebase ordreoppdatering:', error);
        // A malformed stream event cannot be trusted. Reconnect from a new
        // complete snapshot instead of accepting more partial updates.
        source.close();
        if (ordersStream === source) ordersStream = null;
        scheduleStreamReconnect();
      }
    };
    source.addEventListener('put', event => update(event, false));
    source.addEventListener('patch', event => update(event, true));
    source.onerror = () => {
      ordersStreamHealthy = false;
      if (source.readyState === 2) {
        source.close();
        if (ordersStream === source) ordersStream = null;
        scheduleStreamReconnect();
      }
    };
    for (const kind of ['cancel', 'auth_revoked']) {
      source.addEventListener(kind, () => {
        ordersStreamHealthy = false;
        source.close();
        if (ordersStream === source) ordersStream = null;
        scheduleStreamReconnect();
      });
    }
  } catch (error) {
    ordersStreamHealthy = false;
    console.warn('Firebase ordre-stream kan ikke åpnes:', error);
  }
}

// Admin checks the small updatedAt value every 30 seconds; customers check
// at most every ten minutes during an uninterrupted visit, with a throttled
// foreground check and a mandatory fresh validation before order submission.
// No extra permanent menu EventSource competes with order confirmations.

let reconnectTimer = null;
function scheduleStreamReconnect() {
  if (reconnectTimer || !remoteEnabled) return;
  reconnectTimer = window.setTimeout(() => {
    reconnectTimer = null;
    if (document.hidden || navigator.onLine === false) return;
    if (CUSTOMER_MODE) syncCustomerStreams();
    else if (!ordersStream) beginOrdersStream();
    // Menu versions are checked by fallbackSync's role-specific interval.
    void fallbackSync();
  }, CUSTOMER_MODE ? 30000 : 3000);
}

// Persistent, public-only menu cache. An IndexedDB failure is harmless and
// falls back to the existing Firebase fetch. The database is per origin and
// the key includes both restaurant database and deployed directory.
function customerMenuCacheKey() {
  return DB_URL + '|' + new URL('./', window.location.href).pathname;
}

function openCustomerMenuCache() {
  if (!CUSTOMER_MODE || !('indexedDB' in window)) return Promise.resolve(null);
  return new Promise(resolve => {
    let request;
    try { request = indexedDB.open(CUSTOMER_MENU_CACHE_DB, 1); }
    catch { resolve(null); return; }
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains('menu')) {
        request.result.createObjectStore('menu');
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });
}

async function loadCustomerMenuCache() {
  const db = await openCustomerMenuCache();
  if (!db) return null;
  try {
    const record = await new Promise((resolve, reject) => {
      const request = db.transaction('menu', 'readonly')
        .objectStore('menu').get(customerMenuCacheKey());
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    if (!record || record.format !== 1 ||
        Number(record.menu?.schemaVersion) !== SCHEMA_VERSION ||
        !['', 'menu'].includes(record.path) ||
        !record.menu || !Array.isArray(record.menu.sections) ||
        !Array.isArray(record.menu.optionGroups) ||
        !Number.isFinite(Number(record.menu.updatedAt)) ||
        Number(record.menu.updatedAt) <= 0 ||
        !record.menu.settings || typeof record.menu.settings !== 'object') return null;
    return record;
  } catch { return null; }
  finally { db.close(); }
}

function publicCustomerMenuSnapshot() {
  const menu = menuPayload();
  menu.settings = Object.fromEntries(CUSTOMER_MENU_CACHE_KEYS
    .filter(key => Object.prototype.hasOwnProperty.call(menu.settings, key))
    .map(key => [key, menu.settings[key]]));
  // Deliberately no orders, customers, phone-specific loyalty or admin data.
  return menu;
}

async function saveCustomerMenuCache() {
  if (!CUSTOMER_MODE || !Number(store.updatedAt)) return;
  const db = await openCustomerMenuCache();
  if (!db) return;
  const record = {
    format: 1, path: remoteMenuPath, savedAt: Date.now(),
    menu: publicCustomerMenuSnapshot()
  };
  try {
    await new Promise((resolve, reject) => {
      const request = db.transaction('menu', 'readwrite')
        .objectStore('menu').put(record, customerMenuCacheKey());
      request.onsuccess = resolve;
      request.onerror = () => reject(request.error);
    });
    customerOfflineMenuAvailable = true;
  } catch { /* storage quota/private mode: online ordering still works */ }
  finally { db.close(); }
}

// Menu-only reads avoid downloading /orderArchive or /pizzaBonus.
const LEGACY_MENU_FIELDS = [
  'schemaVersion', 'settings', 'allergenCatalog',
  'sections', 'optionGroups', 'popularItemIds', 'updatedAt',
];
async function readRemoteMenuSnapshot() {
  const nested = await restGet('menu');
  if (nested && typeof nested === 'object') {
    // Keep restaurant settings at /settings; menu contains menu-only fields.
    const settings = await restGet('settings');
    return { menu: { ...nested, settings: settings || nested.settings || store.settings } };
  }
  const values = await Promise.all(LEGACY_MENU_FIELDS.map(field => restGet(field)));
  return Object.fromEntries(LEGACY_MENU_FIELDS.map((field, i) => [field, values[i]]));
}

// A returning customer downloads only the tiny updatedAt value. The full
// menu is downloaded only on the first visit or when its version has changed.
// Admin never uses the customer cache. Offline fallback is display-only.
async function readStartupMenu() {
  if (!CUSTOMER_MODE) {
    const snapshot = await readRemoteMenuSnapshot();
    const menu = snapshot?.menu || snapshot || {};
    if (!Array.isArray(menu.sections) || !Array.isArray(menu.optionGroups)) {
      throw new Error('Firebase svarte uten gyldige kategorier og valggrupper.');
    }
    remoteMenuPath = snapshot?.menu ? 'menu' : '';
    return { menu, verified: true };
  }
  const cached = await loadCustomerMenuCache();
  if (cached) {
    remoteMenuPath = cached.path;
    customerOfflineMenuAvailable = true;
  }
  try {
    if (cached) {
      const version = Number(await restGet(
        cached.path ? 'menu/updatedAt' : 'updatedAt', 6500
      ));
      if (version > 0 && version === Number(cached.menu.updatedAt)) {
        lastMenuFallbackAt = Date.now();
        return { menu: cached.menu, verified: true };
      }
    }
    const snapshot = await readRemoteMenuSnapshot();
    const menu = snapshot?.menu || snapshot || {};
    if (!Array.isArray(menu.sections) || !Array.isArray(menu.optionGroups)) {
      throw new Error('Restaurantmenyen har ugyldig format.');
    }
    remoteMenuPath = snapshot?.menu ? 'menu' : '';
    replaceMenuState(menu);
    await saveCustomerMenuCache();
    lastMenuFallbackAt = Date.now();
    return { menu, verified: true };
  } catch (error) {
    if (cached) {
      // A previous menu may be viewed, but orders require a successful fresh
      // Firebase version check and cannot be submitted on this stale snapshot.
      return { menu: cached.menu, verified: false };
    }
    throw error;
  }
}

/** Menu refresh keeps the public cache synchronized after successful reads. */
async function reloadRemoteMenu({ strict = false } = {}) {
  if (saveState === 'dirty' || saveState === 'saving') {
    if (strict) throw new Error('Menyoppdateringen er ikke ferdig.');
    return;
  }
  if (!menuRefreshPromise) {
    // Share one underlying promise, but never hide a failed fetch from an
    // in-flight checkout just because a background refresh started first.
    menuRefreshPromise = (async () => {
      const snapshot = await readRemoteMenuSnapshot();
      const source = snapshot?.menu || snapshot || {};
      if (!Array.isArray(source.sections) || !Array.isArray(source.optionGroups)) {
        throw new Error('Restaurantmenyen har ugyldig format.');
      }
      const updated = applyRemoteMenu(snapshot);
      await saveCustomerMenuCache();
      remoteOnline = true;
      if (updated) emitData('remote');
    })().finally(() => { menuRefreshPromise = null; });
  }
  if (strict) return menuRefreshPromise;
  return menuRefreshPromise.catch(error => {
    console.warn('Kunne ikke oppdatere restaurantmenyen:', error);
  });
}

// Checkout must verify live menu revision; cache is never an authority for
// prices, availability, pickup times or restaurant opening/closing status.
export async function ensureCustomerMenuCurrent() {
  if (!CUSTOMER_MODE) return;
  if (!remoteEnabled || navigator.onLine === false) {
    throw new Error('Ingen internettforbindelse. Bestillingen ble ikke sendt.');
  }
  try {
    const version = Number(await restGet(
      remoteMenuPath ? 'menu/updatedAt' : 'updatedAt', 6500
    ));
    if (!version || version !== Number(store.updatedAt)) {
      await reloadRemoteMenu({ strict: true });
    }
    const wasOffline = !remoteOnline;
    remoteOnline = true;
    if (wasOffline) emitData('remote');
  } catch {
    remoteOnline = false;
    throw new Error('Kunne ikke kontrollere oppdatert meny hos restauranten. Prøv igjen.');
  }
}

/** Manual full refresh. Only called by a user action, never by a timer. */
async function pullRemote({ ordersOnly = false } = {}) {
  if (!remoteEnabled) return;
  // Staff refresh is an explicit authoritative audit of canonical orders.
  if (!CUSTOMER_MODE && compactFeedActive)
    recoverFullOrdersStream('Manuell kontroll av alle ordre');
  if (CUSTOMER_MODE) {
    await reloadRemoteMenu();
    await pollCustomerOrders(true);
    return;
  }
  const revision = orderStreamRevision;
  try {
    const [menu, orders] = await Promise.all([
      ordersOnly ? Promise.resolve(null) : readRemoteMenuSnapshot(),
      restGet(ORDERS_PATH),
    ]);
    remoteOnline = true;
    const menuChanged = !ordersOnly && saveState !== 'dirty' && saveState !== 'saving'
      ? applyRemoteMenu(menu) : false;
    // A live SSE delta may have arrived while these GETs were in flight.
    const ordersChanged = revision === orderStreamRevision
      ? (adminOrdersSnapshotLoaded = true, applyRemoteOrders(ordersRaw = orders || {}))
      : false;
    if (menuChanged || ordersChanged) emitData('remote');
  } catch (err) {
    remoteOnline = false;
  }
}

export async function refreshFromDatabase(options = {}) {
  await pullRemote(options);
  return remoteOnline;
}

/** REST fallback while a stream is unavailable; never download the whole DB. */
async function fallbackSync() {
  if (!remoteEnabled || document.hidden || navigator.onLine === false) return;
  // Guard against an SSE that remains open while the trusted server stalls.
  if (!CUSTOMER_MODE && compactFeedActive &&
      Date.now() - compactFeedGeneratedAt >= COMPACT_ORDER_MAX_AGE_MS)
    recoverFullOrdersStream('Utdatert backendindeks');
  if (CUSTOMER_MODE) {
    startCustomerOrderStream();
    await pollCustomerOrders();
  } else if (!ordersStreamHealthy && !ordersFallbackBusy &&
             // A newly connected SSE sends its full initial snapshot. Do
             // not simultaneously fetch /orders.json on every reconnect.
             (!ordersStream || Date.now() - ordersStreamStartedAt >= 9000)) {
    ordersFallbackBusy = true;
    const revision = orderStreamRevision;
    try {
      const orders = await restGet(ORDERS_PATH);
      remoteOnline = true;
      if (revision === orderStreamRevision) {
        ordersRaw = orders || {};
        adminOrdersSnapshotLoaded = true;
        if (applyRemoteOrders(ordersRaw)) emitData('remote');
      }
    } catch (error) {
      remoteOnline = false;
    } finally {
      ordersFallbackBusy = false;
    }
  }

  const now = Date.now();
  if (!menuFallbackBusy &&
      (now - lastMenuFallbackAt >= FALLBACK_MENU_INTERVAL)) {
    lastMenuFallbackAt = now;
    menuFallbackBusy = true;
    try {
      const version = Number(await restGet(remoteMenuPath ? remoteMenuPath + '/updatedAt' : 'updatedAt'));
      if (version > 0 && version !== Number(store.updatedAt)) {
        await reloadRemoteMenu({ strict: CUSTOMER_MODE });
      }
      const wasOffline = !remoteOnline;
      remoteOnline = true;
      if (CUSTOMER_MODE && wasOffline) emitData('remote');
    } catch (error) {
      if (CUSTOMER_MODE || !ordersStreamHealthy) remoteOnline = false;
    } finally {
      menuFallbackBusy = false;
    }
  }
}

function refreshAfterReturn() {
  if (CUSTOMER_MODE && Date.now() - lastMenuFallbackAt >= CUSTOMER_MENU_RETURN_MIN_MS) {
    lastMenuFallbackAt = 0; // force a small updatedAt read, not a full menu
  }
  void fallbackSync();
}

function startPolling() {
  // Admin uses one live order SSE; customers use short REST reads only.
  // Menu updates are already fetched by the updatedAt REST fallback.
  if (CUSTOMER_MODE) syncCustomerStreams();
  else beginOrdersStream();
  if (fallbackTimer) clearInterval(fallbackTimer);
  fallbackTimer = window.setInterval(() => { void fallbackSync(); }, FALLBACK_ORDERS_INTERVAL);
  window.addEventListener('focus', () => {
    if (CUSTOMER_MODE) syncCustomerStreams();
    refreshAfterReturn();
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      if (CUSTOMER_MODE) syncCustomerStreams();
      if (!CUSTOMER_MODE && !ordersStream) scheduleStreamReconnect();
      refreshAfterReturn();
    }
  });
  window.addEventListener('online', () => {
    // The network changed: allow an immediate SSE attempt and REST refresh.
    customerStreamRetryAfter = 0;
    customerStreamFailures = 0;
    if (CUSTOMER_MODE) syncCustomerStreams();
    if (!CUSTOMER_MODE && !ordersStream) scheduleStreamReconnect();
    refreshAfterReturn();
  });
}


async function persist() {
  if (!CUSTOMER_MODE && !adminMenuVerified) {
    setSaveState('error', 'Menyen er ikke lastet fra Firebase. Lagring er blokkert for å beskytte restaurantdata.');
    return false;
  }
  setSaveState('saving');
  try {
    const previous=lastSavedPublicSnapshot;
    store.updatedAt=Math.max(Date.now(),Number(store.updatedAt||0)+1);
    const payload=menuPayload();
    const next=publicMenuForDiff(payload);
    if(remoteEnabled){
      if(remoteMenuPath==='menu'&&previous){
        // Each key updates an individual field, e.g. menu/sections/0/items/2/sizes/0/price.
        // The latest delta is committed atomically, so the BETA SSE client sees
        // the exact same revision as the canonical menu and opening hours.
        const changes=publicMenuChanges(previous,next).filter(change=>change.path!=='menu/updatedAt');
        const patch={};
        for(const change of changes)patch[change.path]=change.value;
        const revision=payload.updatedAt,prior=Number(previous.menu.updatedAt)||0;
        patch['menu/updatedAt']=revision;
        const delta= {version:revision,previousVersion:prior,changes};
        const bytes=JSON.stringify(delta).length;
        patch['menu/changeFeed/latest']= bytes<=LIVE_DELTA_MAX_BYTES
          ?delta:{version:revision,previousVersion:prior,requiresRefresh:true};
        try {
          await restPatch('',patch);
        } catch (incrementalError) {
          // Preserve existing admin save behavior until Firebase Rules allow
          // writes to the compact live feed. This is a safe compatibility fallback.
          console.warn('Kompakt menylagring ikke tillatt; bruker trygg full lagring.',incrementalError);
          await restPatch('',{menu:next.menu,settings:next.settings});
        }
      }else if(remoteMenuPath==='menu'){
        // First save after an unverified snapshot uses the legacy safe write.
        await restPatch('',{menu:next.menu,settings:next.settings,
          'menu/changeFeed/latest':{version:payload.updatedAt,requiresRefresh:true}});
      }else{
        // Legacy layout: retain its existing write path to avoid corrupting root fields.
        await restPatch(remoteMenuPath,payload);
      }
      remoteOnline=true;
    }
    lastSavedPublicSnapshot=next;
    if(channel)channel.postMessage({type:'state',updatedAt:store.updatedAt});
    setSaveState('saved');
    return true;
  }catch(err){
    remoteOnline=false;
    console.error('Lagring feilet:',err);
    void reportSystemError('firebase', /403|401|HTTP/.test(String(err?.message))?'http':'network','warning');
    setSaveState('error',err?.message||'Ukjent feil');
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
  if (!CUSTOMER_MODE && !adminMenuVerified) {
    setSaveState('error', 'Menyen er ikke lastet fra Firebase. Oppdater før du endrer produkter.');
    return undefined;
  }
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
export function exportMenuJSON() { return clone(menuPayload()); }

export async function importMenuJSON(raw) {
  const source = raw?.menu || raw;
  if (!source || !Array.isArray(source.sections)) throw new Error('Bruk en Bestill meny-JSON med sections. Andre menyformater må konverteres først.');
  const itemIds = new Set();
  for (const section of source.sections) {
    if (!section || !Array.isArray(section.items)) throw new Error('Hver kategori må ha en items-liste.');
    for (const item of section.items) {
      if (!item || !item.name || !Array.isArray(item.sizes) || !item.sizes.length) throw new Error('Hvert produkt må ha navn og minst én størrelse/pris.');
      if (item.id && itemIds.has(item.id)) throw new Error('Duplisert produkt-ID.');
      if (item.id) itemIds.add(item.id);
      if (item.sizes.some(size=>!Number.isFinite(Number(size.price)) || Number(size.price)<0)) throw new Error('Ugyldig produktpris.');
    }
  }
  const before = exportMenuJSON();
  replaceMenuState({ ...source, settings: source.settings || store.settings });
  emitData('local');
  if (!await saveNow()) { replaceMenuState(before);emitData('local');throw new Error('Importen kunne ikke lagres. Prøv igjen.'); }
  return true;
}

export function hasUnsavedChanges() {
  return saveState === 'dirty' || saveState === 'saving' || saveState === 'error';
}

/* ------------------------------------------------------------------ *
 * 10. Ordre
 * ------------------------------------------------------------------ */

/**
 * Save profile contact to /customers/{phone} even before the first order.
 * A conditional whole-record update protects the lifetime order totals,
 * pizza rewards, preferences and reservations from concurrent writes.
 * Do not mark a new account schema v4 here: the legacy loyalty migrator may
 * still need to import the customer's earlier totals on the first order.
 */
export async function saveCustomerContact({ name, phone, email = '' } = {}) {
  const id = loyaltyPhone(phone);
  const displayName = String(name || '').trim().slice(0, 120);
  const address = String(email || '').trim().toLowerCase();
  if (!id || !displayName || address.length > 254 ||
      (address && !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(address))) {
    throw new Error('Skriv inn gyldig navn, mobilnummer og eventuelt e-post.');
  }
  if (!remoteEnabled) throw new Error('Firebase er ikke konfigurert.');
  // A narrow PATCH leaves loyalty counters, consent and reservations
  // untouched even if the staff rollup updates those fields concurrently.
  // Unlike the previous ETag/whole-record PUT it never downloads the entire
  // private customer record just to save two contact fields.
  const response = await fetch(`${DB_URL}/customers/${encodeURIComponent(id)}.json`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: displayName, email: address }),
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) {
    throw new Error('Kundeopplysningene ble ikke lagret i Firebase (HTTP ' +
      response.status + '). Kontroller Database Rules.');
  }
  return { created: false, unchanged: false };
}

export async function setPizzaOffersConsent(phoneValue, enabled) {
  const phone = loyaltyPhone(phoneValue);
  if (!phone) throw new Error('Skriv inn et gyldig mobilnummer.');
  // Consent is a direct child of /customers/{phone}, not a nested loyalty node.
  // A first-time customer can opt in before their first accepted order.
  await restPatch(`customers/${phone}`, { bonusConsent: enabled === true });
  bonusStateCache.delete(phone);
}

// Bonus figures are display hints, not spendable entitlements. Cache a
// sanitized compact state in JS memory only (never localStorage/IndexedDB).
// Explicit fresh:true bypasses the cache before checkout and reward redemption.
const BONUS_STATE_TTL_MS = 45 * 1000;
const bonusStateCache = new Map();
const bonusStateInFlight = new Map();
export async function getPizzaBonus(phoneValue, { fresh = false } = {}) {
  const phone = loyaltyPhone(phoneValue);
  if (!phone) return { count: 0, ready: false, cycle: 'start', phone: '', pending: false };
  const old = bonusStateCache.get(phone);
  if (!fresh && old && Date.now() - old.fetchedAt < BONUS_STATE_TTL_MS) {
    return { ...old.state };
  }
  if (!fresh && bonusStateInFlight.has(phone)) {
    return { ...(await bonusStateInFlight.get(phone)) };
  }
  const request = readPizzaBonusFromFirebase(phone).then(state => {
    bonusStateCache.set(phone, { state, fetchedAt: Date.now() });
    return state;
  }).finally(() => {
    if (bonusStateInFlight.get(phone) === request) bonusStateInFlight.delete(phone);
  });
  bonusStateInFlight.set(phone, request);
  return { ...(await request) };
}

async function readPizzaBonusFromFirebase(phone) {
  const customer = await restGet(`customers/${phone}`);
  const migrated = [3, 4].includes(customer?.schemaVersion);
  let state;
  let old = null;
  if (migrated) {
    const count = Math.max(0, Math.min(10, Number(customer.bonusCount) || 0));
    state = { count, cycle: String(customer.bonusCycle || 'start'), ready: count === 10 };
  } else {
    // Read-only compatibility for accounts not yet copied by the admin
    // migration worker. Do not create new data under /pizzaBonus.
    old = await restGet(`pizzaBonus/${phone}`) || {};
    if (old.loyalty?.version === 2) {
      const count = Math.max(0, Math.min(10, Number(old.loyalty.count) || 0));
      state = { count, cycle: String(old.loyalty.cycle || 'start'), ready: count === 10 };
    } else {
      const synced = old.pizzaCountSynced === true &&
        old.events && typeof old.events === 'object';
      // Reuse the authoritative admin snapshot instead of fetching /orders.
      const historyOrders = synced ? [] : CUSTOMER_MODE
        ? store.orders.filter(order => loyaltyPhone(order.phone) === phone)
        : adminOrdersSnapshotLoaded && !compactFeedActive
          ? Object.values(ordersRaw).filter(order => loyaltyPhone(order?.phone) === phone)
          : Object.values(await restGet(ORDERS_PATH) || {}).filter(order => loyaltyPhone(order?.phone) === phone);
      const history = synced ? {} : historicalPizzaEvents(historyOrders, phone, store.sections);
      state = pizzaBonus({ ...history, ...(old.events || {}) });
    }
  }
  const reservations = customer?.bonusReservations || old?.loyalty?.reservations || old?.reservations;
  const reservation = reservations?.[state.cycle];
  const pendingOrder = reservation?.orderId
    ? await restGet(`${ORDERS_PATH}/${encodeURIComponent(reservation.orderId)}`)
    : null;
  return {
    ...state,
    phone,
    consent: customer && Object.prototype.hasOwnProperty.call(customer, 'bonusConsent')
      ? customer.bonusConsent === true
      : (!migrated && (old?.loyalty?.offersConsent === true || old?.offersConsent === true)),
    pending: Boolean(reservation && (pendingOrder
      ? !['avvist','kansellert'].includes(pendingOrder.status)
      : Date.now() - Number(reservation.at) < 600000)),
  };
}

async function reservePizzaReward(record) {
  const state = await getPizzaBonus(record.phone, { fresh: true });
  if (record.loyaltyReward.automatic && !state.consent) throw new Error('Aktiver valget for automatisk pizzabonus.');
  const paidCount = (record.lines || []).reduce((sum,line) => sum + (line.loyaltyEligible ? Math.max(0, Number(line.quantity) - (line.loyaltyFree ? 1 : 0)) : 0), 0);
  const earnedInCart = record.loyaltyReward.automatic && state.consent && state.count + paidCount >= 10;
  if ((!state.ready && !earnedInCart) || state.cycle !== record.loyaltyReward.cycle) throw new Error('Pizzabonus er ikke tilgjengelig.');
  const url = `${DB_URL}/customers/${state.phone}/bonusReservations/${encodeURIComponent(state.cycle)}.json`;
  for (let attempt = 0; attempt < 4; attempt++) {
    const response = await fetch(url, { headers: { 'X-Firebase-ETag': 'true' }, cache: 'no-store' });
    if (!response.ok) throw new Error('Kunne ikke kontrollere pizzabonus.');
    const existing = await response.json();
    if (existing?.orderId === record.id) return;
    if (existing) {
      const order = await restGet(`${ORDERS_PATH}/${existing.orderId}`);
      if (order ? !['avvist','kansellert'].includes(order.status) : Date.now() - Number(existing.at) < 600000) throw new Error('Gratispizza er allerede reservert.');
    }
    const etag = response.headers.get('ETag');
    if (!etag) throw new Error('Kunne ikke reservere pizzabonus sikkert.');
    const result = await fetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'if-match': etag }, body: JSON.stringify({ orderId: record.id, at: Date.now() }) });
    if (result.ok) {
      bonusStateCache.delete(state.phone);
      return;
    }
    if (result.status !== 412) throw new Error('Kunne ikke reservere pizzabonus.');
  }
  throw new Error('Pizzabonus er opptatt. Prøv igjen.');
}

// Report the Firebase rejection reason for the exact order-accept action.
// This is a read of an already failed HTTP response; it adds no DB requests.
async function orderAcceptHttpError(response, action) {
  let detail = '';
  try {
    const body = await response.text();
    const parsed = JSON.parse(body);
    detail = String(parsed?.error || parsed?.message || '').replace(/\s+/g, ' ').slice(0, 130);
  } catch { /* HTTP code still provides a usable diagnosis. */ }
  const info = detail ? ' · ' + detail : '';
  const rule = [401, 403].includes(response.status)
    ? ' Sjekk Firebase Database Rules for skrivetilgang.'
    : '';
  return new Error(action + ' (HTTP ' + response.status + info + ').' + rule);
}

// One staff click = one Firebase order update. Do not replace the entire
// order: receipt data is written independently by SMS/e-post Apps Script and
// must never be overwritten or blocked by full-record security rules.
//
// A GET checks that this order is still pending and within its response
// deadline; a single PATCH changes status and pickup time together. Firebase
// HTTP success is required before the admin/customer sees "Godtatt".
// Free the admin's two long-lived Firebase HTTP connections while a staff
// member sends a critical order confirmation. SSE reconnects with the latest
// database snapshot afterwards, so no order updates are lost.
function pauseAdminLiveStreamsForWrite() {
  if (CUSTOMER_MODE) return () => {};
  const hadOrders = Boolean(ordersStream);
  if (ordersStream) { ordersStream.close(); ordersStream = null; }
  ordersStreamHealthy = false;
  let resumed = false;
  return () => {
    if (resumed) return;
    resumed = true;
    if (hadOrders && !ordersStream) beginOrdersStream();
  };
}

async function patchConfirmedPizzaOrder(order, changes) {
  if (!remoteEnabled) throw new Error('Firebase er ikke konfigurert.');
  if (!order?.id || order.status !== 'mottatt')
    throw new Error('Bestillingen er ikke lenger ny. Oppdater bestillingslisten.');

  const path = `${DB_URL}/${ORDERS_PATH}/${encodeURIComponent(order.id)}.json`;
  const resumeStreams = pauseAdminLiveStreamsForWrite();
  try {
    // Read the authoritative version. Two staff tablets must never overwrite
    // one another or a simultaneous timeout/SMS/email update.
    await new Promise(resolve => setTimeout(resolve, 80));
    const read = await fetch(path, {
      headers: { 'X-Firebase-ETag': 'true' },
      cache: 'no-store',
      signal: AbortSignal.timeout(12000),
    });
    if (!read.ok) throw await orderAcceptHttpError(read, 'Kunne ikke kontrollere bestillingen');
    const etag = read.headers.get('ETag');
    if (!etag) throw new Error('Firebase returnerte ikke versjonskontroll for bestillingen.');
    const current = await read.json();
    if (!current || current.status !== 'mottatt')
      throw new Error('Bestillingen er allerede behandlet. Oppdater bestillingslisten.');
    if (confirmationExpired(current))
      throw new Error('Svarfristen er ute. Kunden må legge inn en ny bestilling.');
    const updated = { ...current, ...changes };
    const response = await monitorCriticalOperation(fetch(path, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'if-match': etag },
      body: JSON.stringify(updated),
      signal: AbortSignal.timeout(12000),
    }), 'order_accept', 12500);
    if (response.status === 412)
      throw new Error('Bestillingen ble endret på en annen enhet. Oppdater listen før du prøver igjen.');
    if (!response.ok)
      throw await orderAcceptHttpError(response, 'Godta ble avvist av Firebase');
    const confirmed = await response.json();
    if (!confirmed || confirmed.status !== 'bekreftet')
      throw new Error('Firebase returnerte ikke bekreftet ordrestatus.');
    window.dispatchEvent(new Event('kol-order-confirmed'));
    return { ...order, ...confirmed };
  } catch (error) {
    if (error?.name === 'TimeoutError' || error?.name === 'AbortError')
      throw new Error('Firebase svarte ikke innen 12 sekunder. Kontroller forbindelsen og oppdater ordren før nytt forsøk.');
    throw error;
  } finally {
    resumeStreams();
  }
}

const expiringOrders = new Set();
export async function expireUnconfirmedOrders() {
  if (!remoteEnabled || navigator.onLine === false) return;
  const due = store.orders.filter(order => confirmationExpired(order) && !expiringOrders.has(order.id));
  for (const order of due) {
    expiringOrders.add(order.id);
    try {
      for (let attempt = 0; attempt < 3; attempt++) {
        const url = `${DB_URL}/${ORDERS_PATH}/${encodeURIComponent(order.id)}.json`;
        const response = await fetch(url, { headers: { 'X-Firebase-ETag': 'true' }, cache: 'no-store' });
        if (!response.ok) throw new Error('Kunne ikke kontrollere svarfristen.');
        const current = await response.json();
        if (!current) break;
        if (!confirmationExpired(current)) {
          const index = store.orders.findIndex(entry => entry.id === order.id);
          if (index >= 0) store.orders[index] = normalizeOrders([current])[0];
          emitData('remote'); break;
        }
        const etag = response.headers.get('ETag');
        if (!etag) throw new Error('Kunne ikke avbryte sikkert.');
        const cancelled = { ...current, status: 'avvist', statusUpdatedAt: Date.now(), rejectionCode: 'confirmation_timeout', rejectionReason: 'Svarfristen er ute', rejectionMessage: 'Bestillingen ble automatisk avbrutt fordi restauranten ikke bekreftet den innen 3 minutter.' };
        const result = await fetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'if-match': etag }, body: JSON.stringify(cancelled) });
        if (result.status === 412) continue;
        if (!result.ok) throw new Error('Kunne ikke avbryte bestillingen.');
        const index = store.orders.findIndex(entry => entry.id === order.id);
        if (index >= 0) store.orders[index] = normalizeOrders([cancelled])[0];
        emitData('remote'); break;
      }
    } catch { 
      void reportSystemError('timeout','network','warning');
      /* Retry on the next tick; never claim cancellation before it is saved. */
    }
    finally { expiringOrders.delete(order.id); }
  }
}

/**
 * Write a lean Firebase order without changing the working order model.
 * Only omit values that are reproducible from other saved values or empty.
 * Order IDs, status timestamps, message receipts, product snapshot/prices,
 * pickup deadlines and loyalty checkpoints are intentionally retained.
 * Older stored orders are never rewritten by this helper.
 */
function compactOrderForStorage(order) {
  const compact = { ...order };
  if (compact.type === 'henting') delete compact.type;
  if (Number(compact.subtotal) === Number(compact.total)) delete compact.subtotal;
  // This deadline is always createdAt + ORDER_CONFIRM_WAIT_MS (3 minutes).
  // order-confirmation.js reconstructs it for both customer and staff views.
  if (Number(compact.confirmationDeadline) === Number(compact.createdAt) + ORDER_CONFIRM_WAIT_MS)
    delete compact.confirmationDeadline;
  if ((compact.pickupMode === 'asap' && compact.pickup === 'Snarest') ||
      (compact.pickupMode === 'scheduled' && /^\d{1,2}:\d{2}$/.test(String(compact.pickup || '')))) {
    delete compact.pickupMode;
  }
  if (!compact.email) delete compact.email;
  if (!compact.comment) delete compact.comment;
  if (!compact.loyaltyReward) delete compact.loyaltyReward;
  if (!compact.scheduledPickupAt) delete compact.scheduledPickupAt;
  compact.lines = (Array.isArray(order.lines) ? order.lines : []).map(line => {
    const item = { ...line };
    // optionDetails includes label/group/price, while selections preserves
    // choice IDs for "Bestill samme igjen". Other forms are duplicates.
    if (Array.isArray(item.optionDetails) && item.optionDetails.length) {
      delete item.options;
    } else if (!Array.isArray(item.options) || !item.options.length) {
      delete item.options;
    }
    if (item.selections && typeof item.selections === 'object' &&
        Object.values(item.selections).some(v => Array.isArray(v) && v.length)) {
      delete item.optionIds;
    } else if (!Array.isArray(item.optionIds) || !item.optionIds.length) {
      delete item.optionIds;
    }
    if (item.selections && typeof item.selections === 'object') {
      const picked = Object.fromEntries(Object.entries(item.selections)
        .filter(([, values]) => Array.isArray(values) && values.length)
        .map(([group, values]) => [group, values.filter(Boolean)]));
      if (Object.keys(picked).length) item.selections = picked;
      else delete item.selections;
    } else delete item.selections;
    // Base unit price is derivable from saved line price, quantity and priced
    // optionDetails; preserve it only for ambiguous/legacy representations.
    const detailsPriced = Array.isArray(item.optionDetails) &&
      item.optionDetails.length > 0 &&
      item.optionDetails.every(d => d?.price != null && Number.isFinite(Number(d.price)));
    const hasNoExtras = !item.optionDetails?.length &&
      !item.options?.length && !item.optionIds?.length &&
      !Object.values(item.selections || {}).some(v => Array.isArray(v) && v.length);
    if ((detailsPriced || hasNoExtras) && !item.loyaltyFree) delete item.unitPrice;
    if (!Array.isArray(item.optionDetails) || !item.optionDetails.length)
      delete item.optionDetails;
    if (!Array.isArray(item.removedIngredients) || !item.removedIngredients.length)
      delete item.removedIngredients;
    if (!item.comment) delete item.comment;
    if (!item.loyaltyFree) delete item.loyaltyFree;
    if (!item.loyaltyEligible) delete item.loyaltyEligible;
    return item;
  });
  return compact;
}

/** Lagrer en ordre. Returnerer ordren med ID. */
export async function submitOrder(order) {
  const now = Date.now();
  const record = compactOrderForStorage({
    ...order,
    // The order remembers the page that accepted it. Apps Script has no
    // browser location and must not guess the domain or the /demo/ directory.
    orderPageUrl: customerPageBaseUrl(window.location.href),
    id: order && order.id ? String(order.id) : uid('ord'),
    createdAt: Number(order && order.createdAt) || now,
    status: 'mottatt',
    confirmationNoTimeout: Boolean(order?.confirmationNoTimeout),
    confirmationDeadline: order?.confirmationNoTimeout ? 0 : (Number(order && order.createdAt) || now) + ORDER_CONFIRM_WAIT_MS,
    statusUpdatedAt: now,
  });

  // Vis aldri ordren som mottatt før Firebase faktisk har bekreftet den.
  // Ved retry brukes samme ordre-ID, så et nytt trykk kan ikke lage en duplikat.
  if (!remoteEnabled) throw new Error('Bestillingstjenesten er ikke tilgjengelig.');
  // No speculative write or bonus reservation while the device has no network.
  // A retry after reconnect uses the same order ID and the existing create-only ETag.
  if (navigator.onLine === false)
    throw new Error('Ingen internettforbindelse. Bestillingen er ikke sendt.');
  try {
    if (record.loyaltyReward) {
      const rewards = (record.lines || []).filter(line => line.loyaltyFree);
      if (rewards.length !== 1 || (record.loyaltyReward.automatic ? rewards[0].quantity < 1 : rewards[0].quantity !== 1) || !rewards[0].loyaltyEligible) throw new Error('Ugyldig gratispizza.');
      await reservePizzaReward(record);
    }
    // Create-only: retrying a request must never overwrite an existing order,
    // including one that another tablet has already accepted.
    const url = `${DB_URL}/${ORDERS_PATH}/${encodeURIComponent(record.id)}.json`;
    const response = await monitorCriticalOperation(fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'if-match': 'null_etag' },
      body: JSON.stringify(record),
      signal: AbortSignal.timeout(15000),
    }), 'order_create', 15000);
    if (response.status === 412) {
      const read = await fetch(url, { cache: 'no-store' });
      if (!read.ok) throw new Error('Bestillingen finnes allerede, men kunne ikke kontrolleres.');
      const existing = await read.json();
      if (!existing || String(existing.phone) !== String(record.phone) ||
          Number(existing.total) !== Number(record.total) ||
          String(existing.pickup) !== String(record.pickup) ||
          JSON.stringify(existing.lines) !== JSON.stringify(record.lines))
        throw new Error('Ordrenummeret er allerede brukt til en annen bestilling.');
      // A previous attempt succeeded: retain its current status and receipts.
      Object.assign(record, existing);
    } else if (!response.ok) {
      throw await orderAcceptHttpError(response, 'Bestillingen ble ikke lagret');
    }
    remoteOnline = true;
  } catch (err) {
    remoteOnline = false;
    void reportSystemError('order_create', /HTTP|403|401/.test(String(err?.message)) ? 'http' : 'network','critical');
    throw new Error(err?.message || 'Bestillingen kunne ikke sendes. Prøv igjen.');
  }


  // Firebase is the ONLY persisted order record. Save the opaque ID for
  // this tab session so the customer's live status survives a reload.
  trackCustomerOrderId(record.id);
  store.orders = normalizeOrders([record, ...store.orders.filter((entry) => entry.id !== record.id)]);
  if (CUSTOMER_MODE) {
    ordersRaw[record.id] = record;
    syncCustomerStreams();
  }
  emitData('local');
  return record;
}

/** Oppdaterer status på en ordre (admin). */
/**
 * Dedicated staff confirmation: a timer can never produce this marker.
 * status/statusUpdatedAt/staffReadyAt are saved in one Firebase PATCH.
 */
export async function markOrderReadyManually(orderId) {
  const order = store.orders.find((entry) => entry.id === orderId);
  if (!order || !['bekreftet', 'tilberedning'].includes(order.status)) return false;
  const previous = {
    status: order.status,
    statusUpdatedAt: order.statusUpdatedAt,
    staffReadyAt: order.staffReadyAt,
  };
  const now = Date.now();
  order.status = 'klar';
  order.statusUpdatedAt = now;
  order.staffReadyAt = now;
  const writeGuard = beginOrderStatusWrite(order);
  emitData('local');
  setSaveState('saving');
  try {
    if (remoteEnabled) {
      await restPatch(`${ORDERS_PATH}/${orderId}`, {
        status: 'klar',
        statusUpdatedAt: now,
        staffReadyAt: now,
      });
      remoteOnline = true;
    }
    finishOrderStatusWrite(orderId, writeGuard, true);
    setSaveState('saved');
    notifyOrderSenders(orderId,'ready');
    return true;
  } catch (err) {
    finishOrderStatusWrite(orderId, writeGuard, false);
    Object.assign(order, previous);
    emitData('local');
    setSaveState('error', err && err.message ? err.message : 'Ukjent feil');
    return false;
  }
}

/** Oppdaterer forventet ventetid på en ordre (admin). */
export async function updateOrderEstimate(orderId, minutes) {
  const order = store.orders.find((entry) => entry.id === orderId);
  if (!order) return false;
  const value = Math.max(0, Math.min(180, Math.round(Number(minutes) || 0)));
  const previous = {
    estimatedMinutes: order.estimatedMinutes,
    estimatedAt: order.estimatedAt,
    estimatedReadyAt: order.estimatedReadyAt,
    estimateUpdatedAt: order.estimateUpdatedAt,
  };
  const now = Date.now();
  order.estimatedMinutes = value || null;
  order.estimatedAt = value ? now : null;
  order.estimatedReadyAt = value ? now + value * 60 * 1000 : null;
  // Only a staff Endre tid save triggers the SMS update, never a countdown.
  order.estimateUpdatedAt = value ? now : null;
  emitData('local');
  setSaveState('saving');
  try {
    if (remoteEnabled) {
      await restPatch(`${ORDERS_PATH}/${orderId}`, {
        estimatedMinutes: order.estimatedMinutes,
        estimatedAt: order.estimatedAt,
        estimatedReadyAt: order.estimatedReadyAt,
        estimateUpdatedAt: order.estimateUpdatedAt,
      });
      remoteOnline = true;
    }
    setSaveState('saved');
    return true;
  } catch (err) {
    Object.assign(order, previous);
    emitData('local');
    setSaveState('error', err && err.message ? err.message : 'Ukjent feil');
    return false;
  }
}


// Trigger Apps Script only after a verified staff status write.
// POST carries order ID only. Apps Script reads the authoritative order.
// Browser no-cors responses are opaque: Firebase order receipts prove sending.
function postAppsScriptWebhook(endpoint, payload) {
  if (!endpoint) return false;
  try {
    const url=new URL(String(endpoint));
    if (url.protocol!=='https:' || url.hostname!=='script.google.com' ||
        !/^\/macros\/s\/[^/]+\/exec$/.test(url.pathname)) return false;
    void fetch(url.href,{
      method:'POST',mode:'no-cors',keepalive:true,
      headers:{'Content-Type':'text/plain;charset=UTF-8'},
      body:JSON.stringify(payload),
    }).catch(error=>console.warn('Apps Script webhook could not be reached:',error));
    return true;
  } catch(error) {
    console.warn('Invalid Apps Script webhook URL:',error);
    return false;
  }
}
function notifyOrderSenders(orderId, kind) {
  if (!/^ord_[a-z0-9]{7,40}$/i.test(String(orderId))) return;
  const config=window.BESTILL_CONFIG || {};
  if (kind==='accepted')
    postAppsScriptWebhook(config.smsWebhookUrl,{orderId,kind});
  postAppsScriptWebhook(config.emailWebhookUrl,{orderId,kind});
}
/** Send only when staff deliberately requests a test in Varslinger. */
export function dispatchNotificationTest(kind) {
  if (!['smsAccepted','emailAccepted','emailReady'].includes(kind)) return false;
  const config=window.BESTILL_CONFIG || {};
  const endpoint=kind==='smsAccepted' ? config.smsWebhookUrl : config.emailWebhookUrl;
  return postAppsScriptWebhook(endpoint,{kind:'test',testKind:kind});
}

// Acceptance must be confirmed by Firebase before the restaurant UI reports
// "Godtatt". A browser-only optimistic state can disappear on page reload.
let latestAcceptError = '';
export function lastAcceptErrorMessage() {
  return latestAcceptError;
}

function applyVerifiedAcceptance(orderId, verified) {
  // The SSE stream can update the same order while the confirmation request
  // is pending. Never replace a newer customer/staff status with stale data.
  const current = store.orders.find(entry => entry.id === orderId);
  const normalized = normalizeOrders([verified])[0];
  if (current && normalized &&
      Number(current.statusUpdatedAt || 0) <= Number(normalized.statusUpdatedAt || 0)) {
    Object.assign(current, normalized);
  }
  if (verified) ordersRaw[orderId] = verified;
  emitData('remote');
}

async function confirmRestaurantOrder(order, changes) {
  latestAcceptError = '';
  setSaveState('saving');
  try {
    const verified = await patchConfirmedPizzaOrder(order, changes);
    remoteOnline = true;
    applyVerifiedAcceptance(order.id, verified);
    setSaveState('saved');
    notifyOrderSenders(order.id,'accepted');
    return true;
  } catch (error) {
    latestAcceptError = String(error?.message || 'Ukjent Firebase-feil').slice(0, 220);
    void reportSystemError('order_accept', error?.name === 'TimeoutError' ? 'timeout' : /HTTP|rules/i.test(latestAcceptError) ? 'http' : 'network','critical');
    console.warn('Firebase kunne ikke bekrefte ordren:', latestAcceptError);
    // No local status was changed; the order stays pending until we actually
    // have a successful Firebase write. Staff may safely inspect/retry.
    setSaveState('error', latestAcceptError);
    return false;
  }
}

/** Confirm an ASAP order with a kitchen estimate; Firebase is authoritative. */
export async function acceptOrderWithEstimate(orderId, minutes) {
  const order = store.orders.find(entry => entry.id === orderId);
  if (!order || order.status !== 'mottatt') return false;
  const value = Math.max(1, Math.min(180, Math.round(Number(minutes) || 0)));
  const now = Date.now();
  return confirmRestaurantOrder(order, {
    status: 'bekreftet',
    statusUpdatedAt: now,
    estimatedMinutes: value,
    estimatedAt: now,
    estimatedReadyAt: now + value * 60 * 1000,
  });
}

/** Confirm a scheduled pickup; Firebase is authoritative. */
export async function acceptScheduledOrder(orderId) {
  const order = store.orders.find(entry => entry.id === orderId);
  if (!order || order.status !== 'mottatt') return false;
  const now = Date.now();
  let readyAt = Number(order.scheduledPickupAt) || 0;
  if (!readyAt) {
    const match = /^(\d{1,2}):(\d{2})$/.exec(String(order.pickup || '').trim());
    if (!match) return false;
    const target = new Date(now);
    target.setHours(Number(match[1]), Number(match[2]), 0, 0);
    if (target.getTime() <= now) target.setDate(target.getDate() + 1);
    readyAt = target.getTime();
  }
  return confirmRestaurantOrder(order, {
    status: 'bekreftet',
    statusUpdatedAt: now,
    pickupMode: 'scheduled',
    scheduledPickupAt: readyAt,
    estimatedMinutes: Math.max(1, Math.ceil((readyAt - now) / 60000)),
    estimatedAt: now,
    estimatedReadyAt: readyAt,
  });
}

/** Avviser en ordre og lagrer årsaken. */
export async function rejectOrder(orderId, reason = '', message = '') {
  const order = store.orders.find((entry) => entry.id === orderId);
  if (!order) return false;
  const previous = {
    status: order.status,
    statusUpdatedAt: order.statusUpdatedAt,
    rejectionReason: order.rejectionReason,
    rejectionMessage: order.rejectionMessage,
  };
  order.status = 'avvist';
  order.statusUpdatedAt = Date.now();
  order.rejectionReason = String(reason || 'Ingen spesifikk grunn');
  order.rejectionMessage = String(message || '').trim();
  const writeGuard = beginOrderStatusWrite(order);
  emitData('local');
  setSaveState('saving');
  try {
    if (remoteEnabled) {
      // Compare against the authoritative Firebase version. A stale tablet
      // must not reject an order already accepted or changed elsewhere.
      const path = `${DB_URL}/${ORDERS_PATH}/${encodeURIComponent(orderId)}.json`;
      const resumeStreams = pauseAdminLiveStreamsForWrite();
      try {
        const read = await fetch(path, {
          headers: { 'X-Firebase-ETag': 'true' },
          cache: 'no-store',
          signal: AbortSignal.timeout(12000),
        });
        if (!read.ok) throw await orderAcceptHttpError(read, 'Kunne ikke kontrollere bestillingen');
        const etag = read.headers.get('ETag');
        if (!etag) throw new Error('Firebase returnerte ikke versjonskontroll for bestillingen.');
        const current = await read.json();
        if (!current || current.status !== previous.status ||
            Number(current.statusUpdatedAt || 0) !== Number(previous.statusUpdatedAt || 0)) {
          throw new Error('Bestillingen er endret på en annen enhet. Oppdater listen før du prøver igjen.');
        }
        const response = await fetch(path, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'if-match': etag },
          // Keep all remote fields including independent SMS/email receipts.
          body: JSON.stringify({
            ...current,
            status: order.status,
            statusUpdatedAt: order.statusUpdatedAt,
            rejectionReason: order.rejectionReason,
            rejectionMessage: order.rejectionMessage,
          }),
          signal: AbortSignal.timeout(12000),
        });
        if (response.status === 412)
          throw new Error('Bestillingen ble endret på en annen enhet. Oppdater listen før du prøver igjen.');
        if (!response.ok) throw await orderAcceptHttpError(response, 'Avvisning ble avvist av Firebase');
        remoteOnline = true;
      } finally {
        resumeStreams();
      }
    }
    finishOrderStatusWrite(orderId, writeGuard, true);
    setSaveState('saved');
    return true;
  } catch (err) {
    finishOrderStatusWrite(orderId, writeGuard, false);
    Object.assign(order, previous);
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
  const activeStatuses = new Set(['mottatt', 'bekreftet', 'tilberedning', 'klar']);
  const active = (store.orders || []).filter((order) => activeStatuses.has(order.status));
  return {
    categoryCount: sections.length,
    itemCount: items.length,
    hiddenCount: items.filter((item) => item.hidden).length,
    soldOutCount: items.filter((item) => item.soldOut).length,
    groupCount: (store.optionGroups || []).length,
    newOrders: (store.orders || []).filter((order) => order.status === 'mottatt' && !confirmationExpired(order)).length,
    activeOrders: active.length,
    todayOrders: todays.length,
    todayRevenue: todays
      .filter((order) => order.status !== 'avvist')
      .reduce((sum, order) => sum + (Number(order.total) || 0), 0),
  };
}

/** Legacy compatibility: orders are never read from localStorage. */
export function getLocalOrders() {
  return [];
}

/* ------------------------------------------------------------------ *
 * 11. Oppstart
 * ------------------------------------------------------------------ */

async function bootstrap() {
  removeRetiredMenuCache();
  let startupError = null;

  if (CUSTOMER_MODE) {
    readSessionOrderIds();
    // One-time migration: extract only the IDs of very recent orders so that
    // someone mid-order doesn't lose tracking when we retire the full cache.
    // Never trust/display the old order fields. Firebase must confirm each ID.
    try {
      const retired=JSON.parse(localStorage.getItem(RETIRED_ORDERS_KEY)||'[]');
      if (Array.isArray(retired)) {
        const now=Date.now();
        const recentIds=retired.filter(order=>
          order && /^ord_[a-z0-9]{7,40}$/i.test(String(order.id||'')) &&
          Number(order.createdAt)>0 && now-Number(order.createdAt)<=CUSTOMER_ORDER_MAX_AGE_MS &&
          now-Number(order.createdAt)>=-60000
        ).map(order=>String(order.id));
        if(recentIds.length){
          sessionOrderIds=[...new Set([...recentIds,...sessionOrderIds])].slice(-CUSTOMER_ORDER_LIMIT);
          saveSessionOrderIds();
        }
      }
    } catch (_) { /* legacy data may be corrupt */ }
    finally {
      try { localStorage.removeItem(RETIRED_ORDERS_KEY); } catch (_) {}
    }
    ordersRaw={}; // Only Firebase may populate customer orders.
    applyRemoteOrders(ordersRaw);
  }

  if (remoteEnabled) {
    try {
      const startup = await readStartupMenu();
      remoteOnline = startup.verified;
      if (startup.menu) replaceMenuState(startup.menu);
      if (!CUSTOMER_MODE) {
        adminMenuVerified = true;
        lastSavedPublicSnapshot = publicMenuForDiff(menuPayload());
      }
      // /orders is not fetched on customer startup; Firebase SSE handles updates.
    } catch (err) {
      remoteOnline = false;
      startupError = String(err?.message || 'Ukjent tilkoblingsfeil').slice(0,180);
      console.warn('Restaurantmenyen kunne ikke hentes fra Firebase:', err);
    }
    startPolling();
  } else if (!CUSTOMER_MODE) {
    startupError = 'Firebase er ikke konfigurert.';
  }

  setSaveState(startupError ? 'error' : 'saved', startupError || '');

  // Cross-tab menu changes are re-fetched from Firebase, never localStorage.
  if (channel) {
    channel.addEventListener('message', (event) => {
      if (event.data?.type !== 'state') return;
      if (Number(event.data.updatedAt) === Number(store.updatedAt)) return;
      void reloadRemoteMenu();
    });
  }

  emitData('init');
  readyResolve(store);
  void expireUnconfirmedOrders();
  // Do not hammer Firebase every second for a pending order whose automatic
  // cancellation is refused by Database Rules. Countdown UI remains 1s.
  window.setInterval(expireUnconfirmedOrders, 30000);
}
bootstrap();
