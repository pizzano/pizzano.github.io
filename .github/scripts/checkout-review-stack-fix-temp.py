from pathlib import Path

css_path = Path('demo/css/customer.css')
css = css_path.read_text(encoding='utf-8')
marker = '/* Checkout review stack fix 2026-09-14 */'
block = r'''

/* Checkout review stack fix 2026-09-14 */
.review-card { width: 100%; min-width: 0; }

.checkout-review-lines {
  display: block !important;
  width: 100% !important;
  min-width: 0 !important;
  padding: 6px 14px 2px !important;
}

.checkout-review-lines .cart-line {
  display: grid !important;
  grid-template-columns: 34px minmax(0, 1fr) auto !important;
  align-items: start !important;
  gap: 10px !important;
  width: 100% !important;
  min-width: 0 !important;
  margin: 0 !important;
  padding: 14px 0 !important;
  border: 0 !important;
  border-bottom: 1px solid var(--line) !important;
  border-radius: 0 !important;
  background: transparent !important;
  box-shadow: none !important;
}
.checkout-review-lines .cart-line:last-child { border-bottom: 0 !important; }

.checkout-review-lines .line-qty {
  grid-column: 1;
  grid-row: 1;
  width: 34px !important;
  min-width: 34px !important;
  height: 34px !important;
  display: grid !important;
  place-items: center !important;
  margin: 0 !important;
  border-radius: 10px !important;
  background: var(--accent-soft) !important;
  color: var(--accent-dark) !important;
  font-size: 12px !important;
  font-weight: 800 !important;
}

.checkout-review-lines .line-body {
  grid-column: 2;
  grid-row: 1;
  min-width: 0 !important;
  width: 100% !important;
}
.checkout-review-lines .line-name {
  margin: 1px 0 8px !important;
  font-size: 14px !important;
  line-height: 1.25 !important;
  font-weight: 800 !important;
  overflow-wrap: anywhere;
}
.checkout-review-lines .line-details {
  display: grid !important;
  grid-template-columns: 1fr !important;
  gap: 7px !important;
  width: 100% !important;
  min-width: 0 !important;
  margin: 0 !important;
  font-size: 12px !important;
}
.checkout-review-lines .line-size {
  display: grid !important;
  grid-template-columns: 72px minmax(0, 1fr) auto !important;
  align-items: center !important;
  gap: 8px !important;
  width: 100% !important;
  min-width: 0 !important;
  color: var(--ink-2) !important;
}
.checkout-review-lines .line-size strong {
  color: var(--ink) !important;
  font-weight: 750 !important;
  overflow-wrap: anywhere;
}
.checkout-review-lines .line-addon-group {
  display: grid !important;
  grid-template-columns: 1fr !important;
  gap: 4px !important;
  width: 100% !important;
  min-width: 0 !important;
}
.checkout-review-lines .line-detail-label {
  color: var(--ink-3) !important;
  font-size: 11px !important;
  font-weight: 750 !important;
  text-transform: uppercase;
  letter-spacing: .03em;
}
.checkout-review-lines .line-addon-list {
  display: grid !important;
  grid-template-columns: 1fr !important;
  gap: 4px !important;
  width: 100% !important;
  min-width: 0 !important;
  margin: 0 !important;
  padding: 0 !important;
  list-style: none !important;
}
.checkout-review-lines .line-addon-list li {
  display: flex !important;
  align-items: flex-start !important;
  justify-content: space-between !important;
  gap: 10px !important;
  width: 100% !important;
  min-width: 0 !important;
}
.checkout-review-lines .line-addon-list li span { min-width: 0; overflow-wrap: anywhere; }
.checkout-review-lines .line-comment {
  margin: 8px 0 0 !important;
  padding: 8px 10px !important;
  border-radius: 9px !important;
  background: #f7f7f6 !important;
  color: var(--ink-2) !important;
  font-size: 11.5px !important;
  line-height: 1.4 !important;
}
.checkout-review-lines .line-right {
  grid-column: 3;
  grid-row: 1;
  display: flex !important;
  align-items: flex-start !important;
  justify-content: flex-end !important;
  min-width: max-content !important;
  width: auto !important;
  padding: 0 !important;
}
.checkout-review-lines .line-price {
  margin: 1px 0 0 !important;
  color: var(--ink) !important;
  font-size: 14px !important;
  line-height: 1.25 !important;
  font-weight: 800 !important;
  white-space: nowrap !important;
}

.checkout-review-meta {
  display: flex !important;
  flex-direction: column !important;
  gap: 0 !important;
  width: 100% !important;
  min-width: 0 !important;
  padding: 8px 14px 12px !important;
  border-top: 1px solid var(--line) !important;
  background: #fff !important;
}
.checkout-review-meta::before {
  content: 'Din informasjon';
  display: block;
  padding: 8px 0 7px;
  color: var(--ink);
  font-size: 14px;
  line-height: 1.2;
  font-weight: 800;
}
.checkout-review-meta > div {
  display: flex !important;
  align-items: center !important;
  justify-content: space-between !important;
  gap: 14px !important;
  width: 100% !important;
  min-width: 0 !important;
  min-height: 42px !important;
  padding: 9px 0 !important;
  border-bottom: 1px solid var(--line) !important;
  color: var(--ink-2) !important;
  font-size: 12.5px !important;
}
.checkout-review-meta > div:last-child { border-bottom: 0 !important; }
.checkout-review-meta > div > span { flex: 0 0 auto; min-width: 76px; }
.checkout-review-meta > div > strong {
  flex: 1 1 auto;
  min-width: 0;
  color: var(--ink) !important;
  font-size: 13px !important;
  line-height: 1.35 !important;
  font-weight: 750 !important;
  text-align: right !important;
  overflow-wrap: anywhere;
}
.checkout-review-total {
  margin-top: 4px !important;
  padding-top: 12px !important;
  border-top: 0 !important;
}
.checkout-review-total > span,
.checkout-review-total > strong {
  color: var(--ink) !important;
  font-size: 15px !important;
  font-weight: 800 !important;
}

@media (max-width: 520px) {
  .checkout-review-lines { padding-left: 12px !important; padding-right: 12px !important; }
  .checkout-review-lines .cart-line {
    grid-template-columns: 32px minmax(0, 1fr) !important;
    gap: 9px !important;
  }
  .checkout-review-lines .line-qty { width: 32px !important; min-width: 32px !important; height: 32px !important; }
  .checkout-review-lines .line-body { grid-column: 2 !important; grid-row: 1 !important; padding-right: 0 !important; }
  .checkout-review-lines .line-right {
    grid-column: 2 !important;
    grid-row: 2 !important;
    justify-content: flex-start !important;
    margin-top: 6px !important;
  }
  .checkout-review-lines .line-size { grid-template-columns: 72px minmax(0, 1fr) auto !important; }
  .checkout-review-meta { padding-left: 12px !important; padding-right: 12px !important; }
  .checkout-review-meta > div { min-height: 44px !important; padding: 10px 0 !important; }
}
'''
if marker not in css:
    css_path.write_text(css.rstrip() + block + '\n', encoding='utf-8')

index_path = Path('demo/index.html')
index = index_path.read_text(encoding='utf-8')
index = index.replace('/demo/css/customer.css?v=20260914-food1', '/demo/css/customer.css?v=20260914-food2')
index_path.write_text(index, encoding='utf-8')

sw_path = Path('demo/service-worker.js')
sw = sw_path.read_text(encoding='utf-8')
sw = sw.replace("const CACHE_NAME = 'kol-demo-v33';", "const CACHE_NAME = 'kol-demo-v34';")
sw_path.write_text(sw, encoding='utf-8')
