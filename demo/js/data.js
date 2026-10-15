import { confirmationDeadline, confirmationExpired, ORDER_CONFIRM_WAIT_MS } from './order-confirmation.js';
import { detectIngredientRules } from './ingredient-detection.js';
import { loyaltyPhone, pizzaBonus, historicalPizzaEvents, largePizza } from './loyalty.js';
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
export const DB_URL = String(window.BESTILL_CONFIG?.databaseUrl || '').replace(/\/$/, '');

const ORDERS_PATH = 'orders';
/** Hvor ofte kundesiden/admin ser etter endringer fra databasen (ms). */
const FALLBACK_ORDERS_INTERVAL = 15000;
const FALLBACK_MENU_INTERVAL = 60000;
const SCHEMA_VERSION = 6;

const LOCAL_KEY = 'bestill_menu_state_v3';
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
  timezone: 'Europe/Oslo',
  openingDays: '',
  openingTime: '',
  orderOpenTime: '',
  orderCloseTime: '',
  weeklyHours: null,
  manualClosedUntil: 0,
  pickupInfo: 'Henting i restauranten',
  paymentInfo: 'Betaling ved henting',
  orderAlarmUrl: '/demo/soundreality-police-operation-siren-144229.mp3',
  minPreorderMinutes: 0,
  prepMinutes: 25,
  slotIntervalMinutes: 15,
  // Epson 80 mm thermal slip (576 printable dots). Per-field typography is
  // stored alongside the restaurant settings and shared across tablets.
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
  shopInfoEnabled: true,
  ingredientCustomizationEnabled: true,
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


/* Shared weekly-hours engine: the customer and admin use precisely this state.
 * weeklyHours=null means the legacy single time applies every day, untouched.
 * When weeklyHours is configured, it becomes the sole source for opening checks.
 * All day indices use Monday=0 ... Sunday=6 in Europe/Oslo. */
export const RESTAURANT_WEEKDAYS = Object.freeze([
  { id:'mon', short:'Man', name:'Mandag' }, { id:'tue', short:'Tir', name:'Tirsdag' },
  { id:'wed', short:'Ons', name:'Onsdag' }, { id:'thu', short:'Tor', name:'Torsdag' },
  { id:'fri', short:'Fre', name:'Fredag' }, { id:'sat', short:'Lør', name:'Lørdag' },
  { id:'sun', short:'Søn', name:'Søndag' },
]);
const HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/;
function validClock(text) { return typeof text==='string' && HH_MM.test(text) ? text : null; }
export function getWeeklyHours(settings=store.settings||DEFAULT_SETTINGS) {
  const open = validClock(settings.orderOpenTime) || '14:00';
  const close = validClock(settings.orderCloseTime) || '22:00';
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
  return {
    open:scheduled.open,reason:scheduled.open?'':'utenfor_apningstid',
    label:scheduled.open?'Åpent nå':'Stengt nå',
    opensAt:scheduled.opensAt,closesAt:scheduled.closesAt,
    manualClosedUntil:0,
    minutesToClose:scheduled.active?.minutesToClose||0,
    opensOnDay:scheduled.opensOnDay,minutesUntilOpen:scheduled.minutesUntilOpen,
  };
}
/** Pickup options calculated from the active window, including after midnight. */
export function getPickupSlots() {
  const settings=store.settings||DEFAULT_SETTINGS;
  const state=getOpenState();
  if(!state.open)return [];
  const prep=Math.max(Number(settings.prepMinutes)||0,30);
  const interval=Math.min(Math.max(Number(settings.slotIntervalMinutes)||15,5),60);
  const remaining=Number(state.minutesToClose)||0;
  if(remaining<=prep+10)return [];
  let nowMinute;
  try{nowMinute=localClock(new Date(),settings.timezone||'Europe/Oslo').minute;}
  catch{const d=new Date();nowMinute=d.getHours()*60+d.getMinutes();}
  const latest=nowMinute+remaining-10;
  const slots=[];
  for(let m=Math.ceil((nowMinute+prep)/interval)*interval;m<=latest&&slots.length<25;m+=interval)
    slots.push({value:formatMinutes(m),label:formatMinutes(m)});
  return slots;
}

/* ------------------------------------------------------------------ *
 * 5. Ordrestatus
 * ------------------------------------------------------------------ */

export const ORDER_STATUSES = [
  { id: 'mottatt', label: 'Mottatt' },
  { id: 'bekreftet', label: 'Bekreftet' },
  { id: 'tilberedning', label: 'Tilberedes' },
  { id: 'klar', label: 'Klar for henting' },
  { id: 'fullfort', label: 'Ferdig' },
  { id: 'avvist', label: 'Avvist' },
];

/** Etikett for en ordrestatus. */
export function orderStatusLabel(status) {
  if (status === 'tilberedning') return 'Bekreftet';
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

function normalizeSettings(raw) {
  const base = raw && typeof raw === 'object' ? raw : {};
  const settings = { ...DEFAULT_SETTINGS };
  for (const key of Object.keys(DEFAULT_SETTINGS)) {
    if (key === 'weeklyHours') continue;
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
  // Preserve legacy one-time schedule until an employee edits weekly hours.
  const rawWeek=base.weeklyHours;
  settings.weeklyHours=Array.isArray(rawWeek)&&rawWeek.length===7
    ? RESTAURANT_WEEKDAYS.map((day,i)=>({
        id:day.id,enabled:rawWeek[i]?.enabled!==false,
        open:validClock(rawWeek[i]?.open)||validClock(settings.orderOpenTime)||'14:00',
        close:validClock(rawWeek[i]?.close)||validClock(settings.orderCloseTime)||'22:00',
      })) : null;
  settings.manualClosedUntil=Number.isFinite(Number(base.manualClosedUntil))
    ? Math.max(0,Number(base.manualClosedUntil)):0;
  if (!['reference', 'lively', 'fresh', 'gourmet'].includes(settings.customerPalette)) settings.customerPalette = 'reference';
  settings.prepMinutes = Math.min(Math.max(settings.prepMinutes, 0), 240);
  settings.slotIntervalMinutes = Math.min(
    Math.max(settings.slotIntervalMinutes || 15, 5),
    60
  );
  for (const [field, low, high] of [
    ['printerQtySize', 28, 52],
    ['printerItemNameSize', 25, 45],
    ['printerSizeTextSize', 19, 38],
    ['printerExtraTextSize', 16, 33],
    ['printerPriceSize', 19, 34],
    ['printerSidePadding', 2, 18],
  ]) {
    settings[field] = Math.min(high, Math.max(low, Number(settings[field]) || DEFAULT_SETTINGS[field]));
  }
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
        confirmationDeadline: confirmationDeadline(order),
        rejectionCode: String(order.rejectionCode || ''),
        customerName: String(order.customerName || ''),
        loyaltyReward: order.loyaltyReward || null,
        loyaltyConfirmedAt: Number(order.loyaltyConfirmedAt) || null,
        phone: String(order.phone || ''),
        pickup: String(order.pickup || ''),
        pickupMode: order.pickupMode === 'scheduled' || /^\d{1,2}:\d{2}$/.test(String(order.pickup || '')) ? 'scheduled' : 'asap',
        scheduledPickupAt: Number(order.scheduledPickupAt) || null,
        comment: String(order.comment || ''),
        type: String(order.type || 'henting'),
        status: ORDER_STATUSES.some((s) => s.id === order.status)
          ? order.status
          : 'mottatt',
        statusUpdatedAt: Number(order.statusUpdatedAt) || 0,
        staffReadyAt: Number(order.staffReadyAt) || null,
        estimatedMinutes: Number(order.estimatedMinutes) > 0 ? Number(order.estimatedMinutes) : null,
        estimatedAt: Number(order.estimatedAt) || null,
        estimatedReadyAt: Number(order.estimatedReadyAt) || null,
        estimateUpdatedAt: Number(order.estimateUpdatedAt) || null,
        rejectionReason: String(order.rejectionReason || ''),
        rejectionMessage: String(order.rejectionMessage || ''),
        subtotal: Number(order.subtotal) || 0,
        total: Number(order.total) || 0,
        lines: asArray(order.lines).map((line) => ({
          itemId: String(line.itemId || ''),
          name: String(line.name || ''),
          loyaltyEligible: Boolean(line.loyaltyEligible),
          loyaltyFree: Boolean(line.loyaltyFree),
          size: String(line.size || ''),
          comment: String(line.comment || ''),
          removedIngredients: asArray(line.removedIngredients)
            .map((name) => String(name || '').trim())
            .filter(Boolean),
          options: asArray(line.options).map((opt) =>
            typeof opt === 'string' ? opt : String(opt.label || '')
          ),
          // Preserve option prices for kitchen slips; line.price already includes extras.
          optionDetails: asArray(line.optionDetails).map((opt) => ({
            groupTitle: String(opt?.groupTitle || ''),
            label: String(opt?.label || ''),
            price: Number(opt?.price) || 0,
          })).filter((opt) => opt.label),
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
    minSelections: group.required ? Math.max(1, Number(group.minSelections) || 1) : 0,
    allowQuantity: Boolean(group.allowQuantity),
    maxSelections: Number(group.maxSelections) > 0 ? Number(group.maxSelections) : 1,
    defaultOptionIds: asArray(group.defaultOptionIds).filter(
      (id) => typeof id === 'string'
    ),
    options: asArray(group.options).map((option) => ({
      id: option.id || uid('opt'),
      label: typeof option.label === 'string' ? option.label : '',
      price: Number(option.price) || 0,
      soldOut: Boolean(option.soldOut),
    })),
  }));

  const groupIds = new Set(optionGroups.map((group) => group.id));

  const sections = asArray(base.sections).map((section) => ({
    id: section.id || uid('sec'),
    title: typeof section.title === 'string' ? section.title : '',
    note: typeof section.note === 'string' ? section.note : '',
    imageUrl: typeof section.imageUrl === 'string' ? section.imageUrl : '',
    type: typeof section.type === 'string' ? section.type : '',
    items: asArray(section.items).map((item) => {
      const sizes = asArray(item.sizes).map((size) => ({
        id: size.id || uid('sz'),
        label: typeof size.label === 'string' ? size.label : '',
        price: Number(size.price) || 0,
        optionGroupIds: asArray(size.optionGroupIds).filter(id=>groupIds.has(id)),
      }));
      const maxIndex = Math.max(sizes.length - 1, 0);
      let ingredients =
        typeof item.ingredients === 'string' ? item.ingredients.trim() : '';
      const description =
        typeof item.description === 'string' ? item.description.trim() : '';
      const explicitRules = Array.isArray(item.ingredientRules) ? item.ingredientRules : [];
      if (!ingredients && explicitRules.length) ingredients = explicitRules.map(rule => typeof rule === 'string' ? rule : rule.name).filter(Boolean).join(', ');
      let ingredientRules = buildIngredientRules(ingredients, explicitRules);
      if (!ingredients && !item.ingredientDetectionInitialized) {
        ingredientRules = detectIngredientRules(description);
        ingredients = ingredientRules.map(rule => rule.name).join(', ');
      }
      const ingredientDefaults = Array.isArray(item.ingredientDefaults)
        ? buildIngredientRules(item.ingredientDefaults.map(rule => rule.name).join(', '), item.ingredientDefaults)
        : ingredientRules.map(rule => ({...rule}));
      return {
        id: item.id || uid('it'),
        name: typeof item.name === 'string' ? item.name.trim() : '',
        description: description || ingredients,
        ingredients,
        ingredientRules,
        ingredientDefaults,
        ingredientDetectionInitialized: true,
        ingredientRulesEdited: item.ingredientRulesEdited === true,
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
        optionGroupOrder: [...new Set(asArray(item.optionGroupOrder))].filter(id => groupIds.has(id) && [...asArray(item.optionGroupIds), ...sizes.flatMap(size => size.optionGroupIds)].includes(id)),
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

let remoteMenuPath = '';
let fallbackTimer = null;
let ordersStream = null;
let menuStream = null;
let ordersStreamHealthy = false;
let menuStreamHealthy = false;
let ordersRaw = {};
let orderStreamRevision = 0;
let ordersFallbackBusy = false;
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
  remoteMenuPath = value?.menu ? 'menu' : '';
  const source = value?.menu || value || {};
  const normalized = normalizeState(source);
  const before = JSON.stringify(menuPayload());
  replaceMenuState(normalized);
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

/** Tar imot ordre fra databasen. Returnerer true hvis noe endret seg. */
function applyRemoteOrders(value) {
  const next = mergePendingOrderStatuses(normalizeOrders(value));
  const snapshot = (orders) => JSON.stringify((orders || []).map((o) => [
    o.id,
    o.status,
    Number(o.statusUpdatedAt) || 0,
    Number(o.estimatedMinutes) || 0,
    Number(o.estimatedAt) || 0,
    Number(o.estimatedReadyAt) || 0,
    o.rejectionReason || '',
    o.rejectionMessage || '',
    o.pickup || '',
    Number(o.total) || 0,
    Array.isArray(o.lines)
      ? o.lines.map((line) => [
          line.itemId || '',
          Number(line.quantity) || 1,
          line.comment || '',
          Array.isArray(line.removedIngredients) ? line.removedIngredients.join('|') : '',
        ])
      : [],
  ]));
  const before = snapshot(store.orders);
  const after = snapshot(next);
  store.orders = next;
  return before !== after;
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

function beginOrdersStream() {
  if (!('EventSource' in window)) return;
  try {
    const source = new EventSource(streamUrl(ORDERS_PATH));
    ordersStream = source;
    const update = (event, patch) => {
      try {
        const change = parseFirebaseEvent(event);
        ordersRaw = applyStreamChange(ordersRaw, change.path, change.data, patch);
        orderStreamRevision += 1;
        ordersStreamHealthy = true;
        remoteOnline = true;
        if (applyRemoteOrders(ordersRaw)) emitData('remote');
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

function applyMenuVersionEvent(event) {
  try {
    const change = parseFirebaseEvent(event);
    const version = Number(change.data);
    if (change.path !== '/' || !Number.isFinite(version) || version <= 0) return;
    menuStreamHealthy = true;
    remoteOnline = true;
    if (version !== Number(store.updatedAt)) void reloadRemoteMenu();
  } catch (error) {
    menuStreamHealthy = false;
    console.warn('Firebase meny-stream feilet:', error);
  }
}

function beginMenuStream() {
  if (!('EventSource' in window)) return;
  try {
    const path = remoteMenuPath ? remoteMenuPath + '/updatedAt' : 'updatedAt';
    const source = new EventSource(streamUrl(path));
    menuStream = source;
    source.addEventListener('put', applyMenuVersionEvent);
    source.addEventListener('patch', applyMenuVersionEvent);
    source.onerror = () => {
      menuStreamHealthy = false;
      if (source.readyState === 2) {
        source.close();
        if (menuStream === source) menuStream = null;
        scheduleStreamReconnect();
      }
    };
    for (const kind of ['cancel', 'auth_revoked']) {
      source.addEventListener(kind, () => {
        menuStreamHealthy = false;
        source.close();
        if (menuStream === source) menuStream = null;
        scheduleStreamReconnect();
      });
    }
  } catch (error) {
    menuStreamHealthy = false;
    console.warn('Firebase meny-stream kan ikke åpnes:', error);
  }
}

let reconnectTimer = null;
function scheduleStreamReconnect() {
  if (reconnectTimer || !remoteEnabled) return;
  reconnectTimer = window.setTimeout(() => {
    reconnectTimer = null;
    if (document.hidden || navigator.onLine === false) return;
    if (!ordersStream) beginOrdersStream();
    if (!menuStream) beginMenuStream();
    void fallbackSync();
  }, 3000);
}

/** Menu is refreshed only if updatedAt changes, not for every order. */
async function reloadRemoteMenu() {
  if (saveState === 'dirty' || saveState === 'saving') return;
  if (menuRefreshPromise) return menuRefreshPromise;
  menuRefreshPromise = (async () => {
    const value = await restGet(remoteMenuPath);
    const updated = applyRemoteMenu(remoteMenuPath ? { menu: value } : value);
    remoteOnline = true;
    if (updated) {
      writeLocal();
      emitData('remote');
    }
  })().catch(error => {
    console.warn('Kunne ikke oppdatere restaurantmenyen:', error);
  }).finally(() => { menuRefreshPromise = null; });
  return menuRefreshPromise;
}

/** Manual full refresh. Only called by a user action, never by a timer. */
async function pullRemote() {
  if (!remoteEnabled) return;
  const revision = orderStreamRevision;
  try {
    const root = await restGet('');
    remoteOnline = true;
    const menuChanged = saveState === 'dirty' || saveState === 'saving'
      ? false : applyRemoteMenu(root);
    // A live SSE delta may have arrived while this GET was in flight.
    const ordersChanged = revision === orderStreamRevision
      ? applyRemoteOrders(ordersRaw = root?.orders || {})
      : false;
    if (menuChanged) writeLocal();
    if (menuChanged || ordersChanged) emitData('remote');
  } catch (err) {
    remoteOnline = false;
  }
}

export async function refreshFromDatabase() {
  await pullRemote();
  return remoteOnline;
}

/** REST fallback while a stream is unavailable; never download the whole DB. */
async function fallbackSync() {
  if (!remoteEnabled || document.hidden || navigator.onLine === false) return;
  if (!ordersStreamHealthy && !ordersFallbackBusy) {
    ordersFallbackBusy = true;
    const revision = orderStreamRevision;
    try {
      const orders = await restGet(ORDERS_PATH);
      remoteOnline = true;
      if (revision === orderStreamRevision) {
        ordersRaw = orders || {};
        if (applyRemoteOrders(ordersRaw)) emitData('remote');
      }
    } catch (error) {
      if (!menuStreamHealthy) remoteOnline = false;
    } finally {
      ordersFallbackBusy = false;
    }
  }

  const now = Date.now();
  if (!menuStreamHealthy && !menuFallbackBusy &&
      (now - lastMenuFallbackAt >= FALLBACK_MENU_INTERVAL)) {
    lastMenuFallbackAt = now;
    menuFallbackBusy = true;
    try {
      const version = Number(await restGet(remoteMenuPath ? remoteMenuPath + '/updatedAt' : 'updatedAt'));
      if (version > 0 && version !== Number(store.updatedAt)) await reloadRemoteMenu();
      remoteOnline = true;
    } catch (error) {
      if (!ordersStreamHealthy) remoteOnline = false;
    } finally {
      menuFallbackBusy = false;
    }
  }
}

function startPolling() {
  // Separate streams: full orders only at first connect, subsequent changes are
  // small Firebase SSE patches. Menu is watched via a numeric version only.
  beginOrdersStream();
  beginMenuStream();
  if (fallbackTimer) clearInterval(fallbackTimer);
  fallbackTimer = window.setInterval(() => { void fallbackSync(); }, FALLBACK_ORDERS_INTERVAL);
  window.addEventListener('focus', () => { void fallbackSync(); });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      if (!ordersStream && !menuStream) scheduleStreamReconnect();
      void fallbackSync();
    }
  });
  window.addEventListener('online', () => {
    if (!ordersStream || !menuStream) scheduleStreamReconnect();
    void fallbackSync();
  });
}


async function persist() {
  setSaveState('saving');
  try {
    store.updatedAt = Date.now();
    if (remoteEnabled) {
      await restPatch(remoteMenuPath, menuPayload());
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
  replaceMenuState({ ...source, settings: source.settings || source.siteSettings || store.settings });
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

const ORDERS_KEY = 'bestill_orders_v2';

export async function setPizzaOffersConsent(phoneValue, enabled) {
  const phone = loyaltyPhone(phoneValue);
  if (!phone) throw new Error('Skriv inn et gyldig mobilnummer.');
  await restPatch(`pizzaBonus/${phone}`, { offersConsent: enabled === true, consentUpdatedAt: Date.now(), consentText: 'Varsle meg om gratis pizza og bruk pizzabonus automatisk.' });
}

export async function getPizzaBonus(phoneValue) {
  const phone = loyaltyPhone(phoneValue);
  if (!phone) return { count: 0, ready: false, cycle: 'start', phone: '', pending: false };
  const [account, orders] = await Promise.all([restGet(`pizzaBonus/${phone}`), restGet(ORDERS_PATH)]);
  const history = historicalPizzaEvents(Object.values(orders || {}), phone, store.sections);
  const events = { ...history, ...(account?.events || {}) };
  const state = pizzaBonus(events);
  const reservation = account?.reservations?.[state.cycle];
  const pendingOrder = reservation && orders?.[reservation.orderId];
  return { ...state, phone, consent: account?.offersConsent === true, pending: Boolean(reservation && (pendingOrder ? !['avvist','kansellert'].includes(pendingOrder.status) : Date.now() - Number(reservation.at) < 600000)) };
}

async function reservePizzaReward(record) {
  const state = await getPizzaBonus(record.phone);
  if (record.loyaltyReward.automatic && !state.consent) throw new Error('Aktiver valget for automatisk pizzabonus.');
  const paidCount = (record.lines || []).reduce((sum,line) => sum + (line.loyaltyEligible ? Math.max(0, Number(line.quantity) - (line.loyaltyFree ? 1 : 0)) : 0), 0);
  const earnedInCart = record.loyaltyReward.automatic && state.consent && state.count + paidCount >= 10;
  if ((!state.ready && !earnedInCart) || state.cycle !== record.loyaltyReward.cycle) throw new Error('Pizzabonus er ikke tilgjengelig.');
  const url = `${DB_URL}/pizzaBonus/${state.phone}/reservations/${state.cycle}.json`;
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
    if (result.ok) return;
    if (result.status !== 412) throw new Error('Kunne ikke reservere pizzabonus.');
  }
  throw new Error('Pizzabonus er opptatt. Prøv igjen.');
}

async function patchConfirmedPizzaOrder(order, changes) {
  const phone = loyaltyPhone(order.phone);
  const at = order.loyaltyConfirmedAt || Date.now();
  // Confirm the order and loyalty event together. ETag prevents a timeout or
  // another tablet from being overwritten after this snapshot was read.
  for (let attempt = 0; attempt < 4; attempt++) {
    const url = `${DB_URL}/.json`;
    const response = await fetch(url, { headers: { 'X-Firebase-ETag': 'true' }, cache: 'no-store' });
    if (!response.ok) throw new Error('Kunne ikke kontrollere bestillingen.');
    const root = await response.json() || {};
    const current = root.orders?.[order.id];
    if (!current || current.status !== 'mottatt' || confirmationExpired(current)) throw new Error('Bestillingen er allerede behandlet eller svarfristen er ute.');
    const etag = response.headers.get('ETag');
    if (!etag) throw new Error('Kunne ikke godta bestillingen sikkert.');
    root.orders[order.id] = { ...current, ...changes, loyaltyConfirmedAt: at };
    if (phone) {
      root.pizzaBonus ||= {};
      const account = root.pizzaBonus[phone] ||= {};
      account.events ||= {};
      const history = historicalPizzaEvents(normalizeOrders(root.orders), phone, store.sections);
      for (const [id, event] of Object.entries(history)) {
        if (id !== order.id && !account.events[id]) account.events[id] = event;
      }
      const quantity = (current.lines || []).reduce((sum, line) => {
        const section = store.sections.find(section => section.items?.some(item => item.id === line.itemId));
        return sum + ((line.loyaltyEligible || largePizza(section, line.size)) ? Math.max(0, (Number(line.quantity) || 0) - (line.loyaltyFree ? 1 : 0)) : 0);
      }, 0);
      account.events[order.id] = { id: order.id, at, quantity, redeemed: Boolean(current.loyaltyReward) };
    }
    const result = await fetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'if-match': etag }, body: JSON.stringify(root) });
    if (result.ok) { order.loyaltyConfirmedAt = at; return; }
    if (result.status !== 412) throw new Error('Kunne ikke godta bestillingen.');
  }
  throw new Error('Bestillingen ble endret. Oppdater og prøv igjen.');
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
    } catch { /* Retry on the next tick; never claim cancellation before it is saved. */ }
    finally { expiringOrders.delete(order.id); }
  }
}

/** Lagrer en ordre. Returnerer ordren med ID. */
export async function submitOrder(order) {
  const now = Date.now();
  const record = {
    ...order,
    id: order && order.id ? String(order.id) : uid('ord'),
    createdAt: Number(order && order.createdAt) || now,
    status: 'mottatt',
    confirmationDeadline: (Number(order && order.createdAt) || now) + ORDER_CONFIRM_WAIT_MS,
    statusUpdatedAt: now,
  };

  // Vis aldri ordren som mottatt før Firebase faktisk har bekreftet den.
  // Ved retry brukes samme ordre-ID, så et nytt trykk kan ikke lage en duplikat.
  if (!remoteEnabled) throw new Error('Bestillingstjenesten er ikke tilgjengelig.');
  try {
    if (record.loyaltyReward) {
      const rewards = (record.lines || []).filter(line => line.loyaltyFree);
      if (rewards.length !== 1 || (record.loyaltyReward.automatic ? rewards[0].quantity < 1 : rewards[0].quantity !== 1) || !rewards[0].loyaltyEligible) throw new Error('Ugyldig gratispizza.');
      await reservePizzaReward(record);
    }
    await restPut(`${ORDERS_PATH}/${record.id}`, record);
    remoteOnline = true;
  } catch (err) {
    remoteOnline = false;
    throw new Error(err?.message || 'Bestillingen kunne ikke sendes. Prøv igjen.');
  }

  try {
    const existing = JSON.parse(localStorage.getItem(ORDERS_KEY) || '[]');
    const deduped = Array.isArray(existing)
      ? existing.filter((entry) => entry && entry.id !== record.id)
      : [];
    deduped.unshift(record);
    localStorage.setItem(ORDERS_KEY, JSON.stringify(deduped.slice(0, 30)));
  } catch (err) {
    console.warn('Kunne ikke lagre ordre lokalt:', err);
  }
  store.orders = normalizeOrders([record, ...store.orders.filter((entry) => entry.id !== record.id)]);
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
    return true;
  } catch (err) {
    finishOrderStatusWrite(orderId, writeGuard, false);
    Object.assign(order, previous);
    emitData('local');
    setSaveState('error', err && err.message ? err.message : 'Ukjent feil');
    return false;
  }
}
export async function updateOrderStatus(orderId, status) {
  // Generic status updates must never assert manual kitchen completion.
  if (status === 'klar') return false;
  const order = store.orders.find((entry) => entry.id === orderId);
  if (!order) return false;
  const previous = order.status;
  const previousStatusUpdatedAt = order.statusUpdatedAt;
  order.status = status;
  order.statusUpdatedAt = Date.now();
  const writeGuard = beginOrderStatusWrite(order);
  emitData('local');
  setSaveState('saving');
  try {
    if (remoteEnabled) {
      if (status === 'bekreftet') await patchConfirmedPizzaOrder(order, { status, statusUpdatedAt: order.statusUpdatedAt });
      else await restPatch(`${ORDERS_PATH}/${orderId}`, { status, statusUpdatedAt: order.statusUpdatedAt });
      remoteOnline = true;
    }
    finishOrderStatusWrite(orderId, writeGuard, true);
    setSaveState('saved');
    return true;
  } catch (err) {
    finishOrderStatusWrite(orderId, writeGuard, false);
    order.status = previous;
    order.statusUpdatedAt = previousStatusUpdatedAt;
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


/** Godtar en ordre og starter ventetiden i én atomisk oppdatering. */
export async function acceptOrderWithEstimate(orderId, minutes) {
  const order = store.orders.find((entry) => entry.id === orderId);
  if (!order) return false;
  const value = Math.max(1, Math.min(180, Math.round(Number(minutes) || 0)));
  const previous = {
    status: order.status,
    statusUpdatedAt: order.statusUpdatedAt,
    estimatedMinutes: order.estimatedMinutes,
    estimatedAt: order.estimatedAt,
    estimatedReadyAt: order.estimatedReadyAt,
  };
  const now = Date.now();
  const readyAt = now + value * 60 * 1000;
  order.status = 'bekreftet';
  order.statusUpdatedAt = now;
  order.estimatedMinutes = value;
  order.estimatedAt = now;
  order.estimatedReadyAt = readyAt;
  const writeGuard = beginOrderStatusWrite(order);
  emitData('local');
  setSaveState('saving');
  try {
    if (remoteEnabled) {
      await patchConfirmedPizzaOrder(order, {
        status: 'bekreftet',
        statusUpdatedAt: now,
        estimatedMinutes: value,
        estimatedAt: now,
        estimatedReadyAt: readyAt,
      });
      remoteOnline = true;
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


/** Godtar en tidsbestilt ordre og bruker kundens valgte hentetid som klar-tid. */
export async function acceptScheduledOrder(orderId) {
  const order = store.orders.find((entry) => entry.id === orderId);
  if (!order) return false;
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
  const previous = {
    status: order.status,
    statusUpdatedAt: order.statusUpdatedAt,
    pickupMode: order.pickupMode,
    scheduledPickupAt: order.scheduledPickupAt,
    estimatedMinutes: order.estimatedMinutes,
    estimatedAt: order.estimatedAt,
    estimatedReadyAt: order.estimatedReadyAt,
  };
  const minutes = Math.max(1, Math.ceil((readyAt - now) / 60000));
  order.status = 'bekreftet';
  order.statusUpdatedAt = now;
  order.pickupMode = 'scheduled';
  order.scheduledPickupAt = readyAt;
  order.estimatedMinutes = minutes;
  order.estimatedAt = now;
  order.estimatedReadyAt = readyAt;
  const writeGuard = beginOrderStatusWrite(order);
  emitData('local');
  setSaveState('saving');
  try {
    if (remoteEnabled) {
      await patchConfirmedPizzaOrder(order, {
        status: 'bekreftet',
        statusUpdatedAt: now,
        pickupMode: 'scheduled',
        scheduledPickupAt: readyAt,
        estimatedMinutes: minutes,
        estimatedAt: now,
        estimatedReadyAt: readyAt,
      });
      remoteOnline = true;
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
      await restPatch(`${ORDERS_PATH}/${orderId}`, {
        status: order.status,
        statusUpdatedAt: order.statusUpdatedAt,
        rejectionReason: order.rejectionReason,
        rejectionMessage: order.rejectionMessage,
      });
      remoteOnline = true;
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
      remoteMenuPath = root?.menu ? 'menu' : '';
      replaceMenuState(root?.menu || root || {});
      ordersRaw = root?.orders || {};
      applyRemoteOrders(ordersRaw);

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
  void expireUnconfirmedOrders();
  window.setInterval(expireUnconfirmedOrders, 1000);
}

bootstrap();
