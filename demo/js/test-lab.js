/* UI belongs only to test-lab.html; never import production data.js. */
import { createSimulation, simulateAction, simulateCompleteFlow } from './test-simulator.js';

const $ = id => document.getElementById(id);
let simulation = null;
let sequence = 0;

const actionLabels = {
  accept: 'Godta', notifications: 'Simuler SMS/e-post',
  print: 'Simuler utskrift', ready: 'Marker klar',
  reject: 'Avvis', expire: 'Test 3-min frist',
};
function render() {
  const state = simulation?.status;
  $('simStatus').textContent = simulation
    ? simulation.id + ' · ' + state + ' · ' + simulation.total + ' kr'
    : 'Ingen test startet';
  $('simSms').textContent = 'SMS: ' + (simulation?.sms === 'mock-ok' ? 'Kun simulert' : 'Ikke testet');
  $('simEmail').textContent = 'E-post: ' + (simulation?.email === 'mock-ok' ? 'Kun simulert' : 'Ikke testet');
  $('simPrinter').textContent = 'Epson: ' + (simulation?.print === 'mock-ok' ? 'Kun simulert' : 'Ikke testet');
  for (const button of document.querySelectorAll('[data-action]')) {
    const action = button.dataset.action;
    button.disabled = !simulation || (
      ['accept', 'reject'].includes(action) ? state !== 'mottatt' :
      action === 'expire' ? state !== 'mottatt' || simulation.confirmationNoTimeout :
      ['notifications','print'].includes(action) ? !['bekreftet','klar'].includes(state) :
      state !== 'bekreftet'
    );
  }
  $('simEvents').replaceChildren(...(simulation?.events || []).map(event => {
    const item = document.createElement('li');
    const time = new Date(event.at).toLocaleTimeString('nb-NO',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
    item.textContent = time + ' · ' + event.message;
    return item;
  }));
}
function start(preOrder = false) {
  sequence += 1;
  simulation = createSimulation({
    id:'SIM-' + String(sequence).padStart(3,'0'),
    name:$('simName').value,
    pickup:preOrder ? '18:00' : 'asap',
    pickupMode:preOrder ? 'scheduled' : 'asap',
    preOrder,
  });
  $('feedback').textContent = 'Kun lokal testordre. Ingen melding eller utskrift blir sendt.';
  render();
}
$('startSim').addEventListener('click', () => start(false));
$('startPreorder').addEventListener('click', () => start(true));
$('runAll').addEventListener('click', () => {
  sequence += 1;
  simulation = simulateCompleteFlow({
    id:'SIM-' + String(sequence).padStart(3,'0'), name:$('simName').value
  });
  $('feedback').textContent = 'Hele kjeden ble simulert i minnet. Eksterne tjenester er IKKE testet.';
  render();
});
document.querySelectorAll('[data-action]').forEach(button => {
  button.addEventListener('click', () => {
    const action = button.dataset.action;
    try {
      simulation = simulateAction(simulation, action, {
        at:action === 'expire' ? simulation.createdAt + 180000 : Date.now(),
        minutes:Number($('simMinutes').value) || 15,
      });
      $('feedback').textContent = actionLabels[action] + ' fullført KUN i testminnet.';
    } catch (error) {
      $('feedback').textContent = String(error?.message || 'Ukjent simulert feil.');
    }
    render();
  });
});
render();
