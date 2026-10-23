/**
 * One read-only product list shared by Mine bestillinger and Bestilte varer.
 * The editable cart uses the same card/row class names but retains controls.
 * Prices in saved orders are read from snapshots, never recomputed for payment.
 */
const escape = value => String(value ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;')
  .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');
const money = value => `${Math.round((Number(value) || 0) * 100) / 100} kr`;
const finite = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));

function detailGroups(line, quantity) {
  const details = Array.isArray(line.optionDetails) && line.optionDetails.length
    ? line.optionDetails
    : (Array.isArray(line.options) ? line.options.map(label => ({label, price:null, groupTitle:'Tilvalg'})) : []);
  const groups = new Map();
  let knownExtras = 0;
  let allPriced = true;
  for (const detail of details) {
    if (!detail || !detail.label) continue;
    const title = String(detail.groupTitle || 'Tilvalg').replace(/^velg\s+/i,'').replace(/\?/g,'').trim() || 'Tilvalg';
    if (!groups.has(title)) groups.set(title,{labels:[],price:0,known:true});
    const group = groups.get(title);
    group.labels.push(String(detail.label));
    if (finite(detail.price)) {
      const p=Number(detail.price);
      group.price += p;
      knownExtras += p;
    } else {
      group.known=false;
      allPriced=false;
    }
  }
  const rows=[];
  for (const [title,group] of groups) {
    const labels=group.labels.filter(x=>!/^ja,?\s*takk!?$/i.test(x.trim()));
    const matched=labels.length===1 ? /^(\d+)\s*[x×]\s*/i.exec(labels[0]) : null;
    const repetitions=matched ? Math.max(1,Number(matched[1])) : 1;
    if (matched) labels[0]=labels[0].slice(matched[0].length).trim();
    const count=quantity*repetitions;
    const nameOnly=labels.length && (!group.known || group.price<=0 ||
      /^(tilvalg|ekstra|extras|annet|tilbehør)$/i.test(title) ||
      (labels.length===1 && title.toLocaleLowerCase('no')===labels[0].toLocaleLowerCase('no')));
    const description=nameOnly
      ? `<b>${escape(labels.join(', '))}</b>`
      : `<b>${escape(title)}${labels.length?':':''}</b>${labels.length?' '+escape(labels.join(', ')):''}`;
    const badge=group.known && group.price>0 && count>1
      ? `<span class="cart-extra-count">${count}x</span>` : '';
    const value=group.known
      ? group.price>0 ? `<b class="cart-detail-price">${money(group.price*quantity)}</b>`
        : '<span class="cart-detail-included"><span aria-hidden="true">•</span> inkludert</span>'
      : '';
    rows.push(`<span class="cart-detail-row cart-extra-row"><span class="cart-detail-left">${badge}${description}</span>${value}</span>`);
  }
  return {rows, knownExtras, allPriced};
}

export function renderSavedOrderProduct(line, {fallbackBasePrice = null, comment = ''} = {}) {
  const quantity=Math.max(1,Math.min(999,Math.floor(Number(line.quantity)||1)));
  const free=Boolean(line.loyaltyFree);
  const freeCount=free?1:0;
  const storedTotal=Number(line.price);
  const total=Number.isFinite(storedTotal)?storedTotal:0;
  const extras=detailGroups(line,quantity);
  const paidQuantity=quantity-freeCount;
  // Legacy snapshots don't save the original base price. Derive it from
  // saved TOTAL and the saved extra prices (avoids discounted unitPrice error).
  // One fully-free pizza has no recoverable base; use current menu as fallback.
  const derived=paidQuantity>0 && extras.allPriced
    ? (total-extras.knownExtras*quantity)/paidQuantity : NaN;
  const base=finite(line.baseUnitPrice)&&Number(line.baseUnitPrice)>0
    ? Number(line.baseUnitPrice)
    : Number.isFinite(derived)&&derived>=0 ? derived
    : finite(fallbackBasePrice) ? Number(fallbackBasePrice)
    : Math.max(0,Number(line.unitPrice)||0);
  const name=String(line.name||'Produkt').replace(/\s*·\s*1 gratis pizza\s*$/i,'');
  const size=String(line.size||'').trim();
  const sizeText=size?`<b>Størrelse:</b> ${escape(size)}`:'';
  const rows=[];
  const maxRows=Math.min(30,quantity);
  for (let i=0;i<maxRows;i++) {
    const gift=free&&i===0;
    rows.push(`<span class="cart-detail-row cart-product-size${gift?' is-free-unit':''}">
      <span class="cart-detail-left">${sizeText}${gift?' <span class="cart-gift-size-caption">(gratis pizza)</span>':''}</span>
      <b class="cart-detail-price">${gift
        ? `<del class="cart-free-original-price">${money(base)}</del>`
        : money(base)}</b></span>`);
  }
  if(quantity>maxRows)rows.push(`<span class="cart-detail-row cart-product-size"><span class="cart-detail-left">+ ${quantity-maxRows} stk ${escape(size)}</span><b class="cart-detail-price">${money(base)} / stk</b></span>`);
  if(extras.rows.length)rows.push('<span class="cart-detail-section-divider" aria-hidden="true"></span>',...extras.rows);
  if(Array.isArray(line.removedIngredients)&&line.removedIngredients.length){
    rows.push(`<span class="cart-detail-row is-note"><span class="cart-detail-left"><b>Uten:</b> ${escape(line.removedIngredients.join(', '))}</span></span>`);
  }
  const note=String(comment||line.comment||'').trim();
  if(note)rows.push(`<span class="cart-detail-row is-note"><span class="cart-detail-left"><b>Kommentar:</b> ${escape(note)}</span></span>`);
  const giftBanner=free?`<div class="cart-product-gift-banner">
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="9" width="18" height="12" rx="1.5"/><path d="M2 9h20M12 9v12M12 9H7.7C4.3 9 4 4 7.4 4c2.6 0 4.6 5 4.6 5ZM12 9h4.3C19.7 9 20 4 16.6 4 14 4 12 9 12 9Z"/></svg>
    <strong>Gratis pizza aktivert</strong><span class="cart-gift-divider" aria-hidden="true"></span>
    <strong class="cart-gift-saving">Du sparer ${money(base)}</strong>
  </div>`:'';
  return `<article class="cart-product-card order-product-card${free?' has-free-pizza':''}">
    ${giftBanner}
    <div class="cart-product-heading">
      <div class="cart-product-copy"><span class="cart-product-titleline"><strong class="cart-product-name">${escape(name)}</strong></span></div>
      <span class="cart-product-quantity" aria-label="Antall: ${quantity}">${quantity}×</span>
    </div>
    <div class="cart-product-copy cart-product-detailcopy"><span class="cart-product-details">${rows.join('')}</span></div>
    <div class="cart-product-totalrow"><span>Sum</span><strong class="cart-product-total">${money(total)}</strong></div>
  </article>`;
}
