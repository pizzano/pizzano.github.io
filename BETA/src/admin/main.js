import {loadOrders,getOrder,saveOrder,clearMockData} from '../data/mock-db.js';
import {transitionTestOrder,canTransition} from '../domain/orders.js';
import {nok,timeOf,safeText} from '../shared/format.js';
import {BETA_CONFIG} from '../config.js';

const byId=id=>document.getElementById(id);
const state={selectedId:null};
const labels={mottatt:'Mottatt',bekreftet:'Bekreftet',klar:'Klar for henting',fullfort:'Fullført',avvist:'Avvist'};
function renderList(){
  const orders=loadOrders();
  byId('orderCount').textContent=String(orders.length);
  if(!state.selectedId && orders.length)state.selectedId=orders[0].id;
  if(state.selectedId&&!orders.some(row=>row.id===state.selectedId))state.selectedId=orders[0]?.id||null;
  byId('orderList').innerHTML=orders.length?orders.map(order=>`
    <button class="order-item ${state.selectedId===order.id?'is-selected':''}" type="button" data-select="${safeText(order.id)}">
      <span><h3>${safeText(order.customerName)}</h3>
        <small>${timeOf(order.createdAt)} · ${safeText(labels[order.status]||order.status)}</small></span>
      <strong>${nok(order.total)}</strong>
    </button>`).join(''):'<div class="empty-state">Ingen testbestillinger ennå. Opprett en i Kundemeny.</div>';
}
function renderDetail(){
  const order=state.selectedId?getOrder(state.selectedId):null;
  if(!order){byId('orderDetail').innerHTML='<div class="empty-state">Velg en testbestilling i listen.</div>';return;}
  const actions=[];
  if(canTransition(order,'bekreftet')){
    actions.push(`<label>Hentetid (min)<input id="estimateMinutes" type="number" value="20" min="1" max="180"></label>
      <button class="btn btn-primary" type="button" data-next="bekreftet">Bekreft</button>`);
  }
  if(canTransition(order,'klar'))actions.push('<button class="btn btn-primary" type="button" data-next="klar">Marker klar for henting</button>');
  if(canTransition(order,'fullfort'))actions.push('<button class="btn btn-primary" type="button" data-next="fullfort">Fullfør</button>');
  if(canTransition(order,'avvist'))actions.push('<button class="btn btn-secondary" type="button" data-next="avvist">Avvis</button>');
  byId('orderDetail').innerHTML=`
    <div class="detail-title"><div><div class="eyebrow">BESTILLINGSDETALJER · BETA</div>
        <h2>${safeText(order.customerName)}</h2>
        <p>${safeText(order.id)}</p></div>
        <span class="status-chip">${safeText(labels[order.status]||order.status)}</span></div>
    <div class="detail-summary">
      <div>Mottatt<strong>${timeOf(order.createdAt)}</strong></div>
      <div>Telefon<strong>${safeText(order.phone)}</strong></div>
      <div>Forventet hentetid<strong>${timeOf(order.estimatedReadyAt)}</strong></div>
    </div>
    <h3>Bestilte varer</h3>
    ${order.lines.map(line=>`<div class="line-item"><span>${line.quantity}× ${safeText(line.name)} <small>(${safeText(line.sizeLabel)})</small></span><strong>${nok(line.price*line.quantity)}</strong></div>`).join('')}
    <div class="detail-total"><span>Totalt</span><strong>${nok(order.total)}</strong></div>
    <div class="action-row">${actions.join('')}</div>
    <p class="micro-note" style="margin-top:22px">SMS: ikke tilkoblet · E-post: ikke tilkoblet · Epson: ikke tilkoblet. Dette er kun en lokal simulering.</p>`;
}
function render(){renderList();renderDetail();}
byId('orderList').addEventListener('click',event=>{
  const button=event.target.closest('[data-select]');
  if(!button)return;
  state.selectedId=button.dataset.select;render();
});
byId('orderDetail').addEventListener('click',event=>{
  const button=event.target.closest('[data-next]');
  if(!button)return;
  const order=getOrder(state.selectedId);
  if(!order)return;
  try {
    const minutes=Number(byId('estimateMinutes')?.value||20);
    saveOrder(transitionTestOrder(order,button.dataset.next,{minutes}));
    render();
  }catch(error){window.alert(error.message);}
});
byId('clearOrders').addEventListener('click',()=>{
  if(!window.confirm('Slette ALLE lokale BETA-testbestillinger i denne nettleseren? DEMO påvirkes ikke.'))return;
  clearMockData();state.selectedId=null;render();
});
window.addEventListener('storage',event=>{
  if(event.key?.startsWith(BETA_CONFIG.storagePrefix+':'))render();
});
window.addEventListener('beta:orders-updated',render);
render();
