/* OFFLINE TEST LAB ONLY.
 * Pure, in-memory mock state transitions. No Firebase URL, fetch, SMS, email,
 * printer, localStorage or service-worker API is imported or called.
 * IDs always start SIM- and can never become production customer order IDs.
 */
import { confirmationExpired } from './order-confirmation.js';

export const SIM_STAGES = Object.freeze(['mottatt','bekreftet','klar','avvist']);

export function createSimulation({ id = 'SIM-001', name = 'Testkunde', pickup = 'asap',
  pickupMode = 'asap', items = [{ name: 'Testpizza', quantity: 1, price: 210 }],
  at = Date.now(), preOrder = false } = {}) {
  if (!/^SIM-[\w-]{1,30}$/.test(id)) throw new Error('Only SIM- IDs are allowed in the test lab.');
  const lines = items.map(item => ({
    name: String(item.name || 'Testprodukt'), quantity: Math.max(1, Number(item.quantity) || 1),
    price: Math.max(0, Number(item.price) || 0),
  }));
  const createdAt = Number(at);
  return {
    id, customerName: String(name || 'Testkunde'), pickup,
    pickupMode, lines, total: lines.reduce((sum, line) => sum + line.quantity * line.price, 0),
    status: 'mottatt', createdAt, confirmationNoTimeout: Boolean(preOrder),
    confirmationDeadline: preOrder ? 0 : createdAt + 180000,
    events: [{ at: createdAt, message: 'Simulert kundeordre opprettet (kun i minnet)' }],
    sms: 'not-run', email: 'not-run', print: 'not-run',
  };
}

function change(order, patch, message, now) {
  return { ...order, ...patch, events: [...order.events, { at: now, message }] };
}

export function simulateAction(order, action, { at = Date.now(), minutes = 15 } = {}) {
  if (!order?.id?.startsWith('SIM-')) throw new Error('Not a simulated order.');
  const now = Number(at);
  if (action === 'expire') {
    if (order.confirmationNoTimeout || order.status !== 'mottatt')
      throw new Error('Ingen tidsfrist på denne bestillingen.');
    if (!confirmationExpired(order, now)) throw new Error('Svarfristen er ikke ute ennå.');
    return change(order, { status:'avvist' }, 'Simulert 3-minutters frist utløpt', now);
  }
  if (action === 'accept') {
    if (order.status !== 'mottatt') throw new Error('Ordren er allerede behandlet.');
    if (confirmationExpired(order, now)) throw new Error('Godta: svarfristen er ute.');
    const duration = Math.round(Number(minutes));
    if (!Number.isInteger(duration) || duration < 1 || duration > 180)
      throw new Error('Velg 1–180 minutter.');
    return change(order, { status:'bekreftet', estimatedMinutes:duration },
      'Simulert admin Godta · ' + duration + ' min', now);
  }
  if (action === 'ready') {
    if (order.status !== 'bekreftet') throw new Error('Ordren må godtas først.');
    return change(order, { status:'klar' }, 'Simulert Klar for henting', now);
  }
  if (action === 'reject') {
    if (order.status !== 'mottatt') throw new Error('Bare nye bestillinger kan avvises.');
    return change(order, { status:'avvist' }, 'Simulert Avvis', now);
  }
  if (action === 'notifications') {
    if (!['bekreftet','klar'].includes(order.status))
      throw new Error('Godta bestillingen før varsel kan simuleres.');
    return change(order, { sms:'mock-ok',email:'mock-ok' },
      'SMS og e-post SIMULERT (ingen faktisk sending)', now);
  }
  if (action === 'print') {
    if (!['bekreftet','klar'].includes(order.status))
      throw new Error('Godta bestillingen før utskrift kan simuleres.');
    return change(order, { print:'mock-ok' },
      'Epson-kvittering SIMULERT (ingen skriverkontakt)', now);
  }
  throw new Error('Ukjent simulert handling.');
}

export function simulateCompleteFlow(options = {}) {
  const start = Number(options.at) || Date.now();
  let order = createSimulation({ ...options, at:start });
  order = simulateAction(order,'accept',{at:start+1000,minutes:15});
  order = simulateAction(order,'notifications',{at:start+1500});
  order = simulateAction(order,'print',{at:start+2000});
  order = simulateAction(order,'ready',{at:start+3000});
  return order;
}
