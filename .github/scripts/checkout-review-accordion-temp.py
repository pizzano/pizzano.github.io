from pathlib import Path
import re

js_path = Path('demo/js/customer.js')
js = js_path.read_text(encoding='utf-8')
start = js.index("  const reviewLines = cart.map((line) => cartLineHtml(line, true)).join('');")
end = js.index("  if (ui.checkoutStep === 3) {", start)
new_block = """  const reviewLines = cart.map((line) => cartLineHtml(line, true)).join('');
  const reviewCount = cartCount();
  const reviewLabel = `${reviewCount} ${reviewCount === 1 ? 'vare' : 'varer'}`;
  el.reviewCard.innerHTML = `
    <div class="checkout-review-head">
      <div><span>Kontroller bestillingen</span><strong>Din bestilling</strong></div>
      <button class="link-btn" data-review-cart type="button">Endre kurv</button>
    </div>
    <details class="checkout-review-toggle">
      <summary class="checkout-review-summary">
        <div class="checkout-review-summary-main">
          <strong>${escapeHtml(reviewLabel)}</strong>
          <span>Trykk for å se detaljer</span>
        </div>
        <span class="checkout-review-summary-action" aria-hidden="true"></span>
      </summary>
      <div class="checkout-review-details">
        <div class="checkout-review-lines">${reviewLines}</div>
        <div class="checkout-review-meta">
          <div><span>Navn</span><strong>${escapeHtml(el.custName.value || '—')}</strong></div>
          <div><span>Telefon</span><strong>${el.custPhone.value ? `+47 ${escapeHtml(el.custPhone.value)}` : '—'}</strong></div>
          <div><span>Hentetid</span><strong>${ui.pickup ? (ui.pickup === 'asap' ? 'Snarest' : escapeHtml(ui.pickup)) : 'Ikke valgt'}</strong></div>
          <div class="checkout-review-total"><span>Å betale ved henting</span><strong>${formatPrice(total)}</strong></div>
        </div>
      </div>
    </details>`;
"""
js = js[:start] + new_block + js[end:]
js_path.write_text(js, encoding='utf-8')

css_path = Path('demo/css/customer.css')
css = css_path.read_text(encoding='utf-8')
marker = '/* Checkout review accordion 2026-09-15 */'
block = r'''

/* Checkout review accordion 2026-09-15 */
.checkout-review-toggle{display:block;border-top:1px solid var(--line)}
.checkout-review-summary{list-style:none;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 14px;cursor:pointer;background:#fff}
.checkout-review-summary::-webkit-details-marker{display:none}
.checkout-review-summary-main{display:grid;gap:2px;min-width:0}
.checkout-review-summary-main strong{font-size:13px;line-height:1.2;font-weight:700;color:var(--ink)}
.checkout-review-summary-main span{font-size:11px;line-height:1.35;font-weight:500;color:var(--ink-2)}
.checkout-review-summary-action::after{content:'Vis mer';color:var(--accent);font-size:11.5px;font-weight:700}
.checkout-review-toggle[open] .checkout-review-summary{border-bottom:1px solid var(--line);background:#fcfcfb}
.checkout-review-toggle[open] .checkout-review-summary-action::after{content:'Skjul'}
.checkout-review-details{background:#fff}
.checkout-review-lines{padding:4px 14px 2px!important}
.checkout-review-lines .cart-line{gap:10px!important;padding:12px 0!important}
.checkout-review-lines .line-qty{width:32px!important;min-width:32px!important;height:32px!important;font-size:11.5px!important}
.checkout-review-lines .line-name{margin:1px 0 7px!important;font-size:13px!important;line-height:1.28!important;font-weight:700!important}
.checkout-review-lines .line-details{gap:6px!important;font-size:11px!important}
.checkout-review-lines .line-size{grid-template-columns:minmax(62px,auto) minmax(0,1fr) auto!important;gap:6px!important}
.checkout-review-lines .line-size strong,.checkout-review-lines .line-addon-list li strong{font-size:12px!important;font-weight:700!important}
.checkout-review-lines .line-detail-label{font-size:10.5px!important;font-weight:700!important}
.checkout-review-lines .line-comment{margin-top:7px!important;padding:8px 10px!important;font-size:11px!important;line-height:1.38!important;font-weight:500!important}
.checkout-review-lines .line-price{font-size:13px!important;line-height:1.25!important;font-weight:700!important}
.checkout-review-meta{padding:8px 14px 12px!important}
.checkout-review-meta::before{padding:8px 0 6px;font-size:13px;font-weight:700}
.checkout-review-meta>div{min-height:38px!important;padding:8px 0!important;font-size:11.5px!important}
.checkout-review-meta>div>span{min-width:72px}
.checkout-review-meta>div>strong{font-size:12.5px!important;line-height:1.35!important;font-weight:700!important}
.checkout-review-total{margin-top:2px!important;padding-top:10px!important}
.checkout-review-total>span,.checkout-review-total>strong{font-size:14px!important;font-weight:800!important}
@media(max-width:520px){.checkout-review-summary{padding:11px 12px}.checkout-review-summary-main strong{font-size:12.5px}.checkout-review-summary-main span,.checkout-review-summary-action::after{font-size:11px}.checkout-review-lines{padding-left:12px!important;padding-right:12px!important}.checkout-review-lines .cart-line{gap:9px!important;padding:11px 0!important}.checkout-review-lines .line-name{font-size:12.5px!important}.checkout-review-lines .line-details,.checkout-review-lines .line-comment{font-size:10.5px!important}.checkout-review-lines .line-price{font-size:12.5px!important}.checkout-review-meta{padding-left:12px!important;padding-right:12px!important}.checkout-review-meta::before{font-size:12.5px}.checkout-review-meta>div{min-height:36px!important;font-size:11px!important}.checkout-review-meta>div>strong{font-size:12px!important}}
'''
if marker not in css:
    css_path.write_text(css.rstrip()+block+'\n',encoding='utf-8')

index_path = Path('demo/index.html')
index = index_path.read_text(encoding='utf-8')
index = re.sub(r'/demo/css/customer\.css\?v=[^"\']+', '/demo/css/customer.css?v=20260915-food3', index)
index_path.write_text(index, encoding='utf-8')

sw_path = Path('demo/service-worker.js')
sw = sw_path.read_text(encoding='utf-8')
sw = re.sub(r"const CACHE_NAME = 'kol-demo-v\d+';", "const CACHE_NAME = 'kol-demo-v35';", sw)
sw_path.write_text(sw, encoding='utf-8')
