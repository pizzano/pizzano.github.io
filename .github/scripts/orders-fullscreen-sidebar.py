from pathlib import Path

HTML = Path('demo/admin.html')
CSS = Path('demo/css/admin.css')
JS = Path('demo/js/admin.js')

html = HTML.read_text(encoding='utf-8')
css = CSS.read_text(encoding='utf-8')
js = JS.read_text(encoding='utf-8')

# Add a small menu button that is only visible while the orders sidebar is collapsed.
html_anchor = '''        </aside>\n\n        <!-- ================= HOVEDINNHOLD ================= -->'''
html_insert = '''        </aside>\n\n        <button class="orders-sidebar-toggle" id="btnOrdersSidebarToggle" type="button" aria-label="Vis adminmeny" title="Vis adminmeny">\n            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg>\n        </button>\n\n        <!-- ================= HOVEDINNHOLD ================= -->'''
if html_anchor not in html:
    raise SystemExit('admin sidebar insertion anchor not found')
html = html.replace(html_anchor, html_insert, 1)

# Cache-bust both CSS and JS so the new layout appears immediately.
html = html.replace('/demo/css/admin.css?v=20260915-scheduled-pickup1', '/demo/css/admin.css?v=20260915-ordersfullscreen1')
html = html.replace('/demo/js/admin.js?v=20260915-adminstatus1', '/demo/js/admin.js?v=20260915-ordersfullscreen1')

# Register the toggle button in the admin element map.
old_el = "  btnRefreshOrders: $('btnRefreshOrders'),\n  orderDetailPane: $('orderDetailPane'),"
new_el = "  btnRefreshOrders: $('btnRefreshOrders'),\n  btnOrdersSidebarToggle: $('btnOrdersSidebarToggle'),\n  orderDetailPane: $('orderDetailPane'),"
if old_el not in js:
    raise SystemExit('admin element map anchor not found')
js = js.replace(old_el, new_el, 1)

# Collapse the dark admin sidebar automatically when Bestillinger is opened.
old_nav = '''function setPage(page) {\n  ui.page = page;\n  for (const [name, node] of Object.entries(el.pages)) {\n    node.hidden = name !== page;\n    node.classList.toggle('is-active', name === page);\n  }\n  el.sideLinks.forEach((link) => {\n    link.classList.toggle('is-active', link.dataset.nav === page);\n  });\n  document.body.classList.toggle('hide-settings-col', page !== 'products');\n  renderAll();\n}\n\nel.sideLinks.forEach((link) => {\n  link.addEventListener('click', () => setPage(link.dataset.nav));\n});'''
new_nav = '''function setOrdersSidebarCollapsed(collapsed) {\n  const shouldCollapse = ui.page === 'orders' && Boolean(collapsed);\n  document.body.classList.toggle('orders-sidebar-collapsed', shouldCollapse);\n  if (el.btnOrdersSidebarToggle) {\n    el.btnOrdersSidebarToggle.setAttribute('aria-expanded', String(!shouldCollapse));\n  }\n}\n\nfunction setPage(page) {\n  ui.page = page;\n  for (const [name, node] of Object.entries(el.pages)) {\n    node.hidden = name !== page;\n    node.classList.toggle('is-active', name === page);\n  }\n  el.sideLinks.forEach((link) => {\n    link.classList.toggle('is-active', link.dataset.nav === page);\n  });\n  document.body.classList.toggle('hide-settings-col', page !== 'products');\n  setOrdersSidebarCollapsed(page === 'orders');\n  renderAll();\n}\n\nel.sideLinks.forEach((link) => {\n  link.addEventListener('click', () => setPage(link.dataset.nav));\n});\n\nif (el.btnOrdersSidebarToggle) {\n  el.btnOrdersSidebarToggle.addEventListener('click', () => {\n    setOrdersSidebarCollapsed(false);\n  });\n}'''
if old_nav not in js:
    raise SystemExit('sidebar navigation block not found')
js = js.replace(old_nav, new_nav, 1)

css_patch = r'''

/* Orders fullscreen workspace 2026-09-15 */
.orders-sidebar-toggle {
    display: none;
    position: fixed;
    top: 13px;
    left: 14px;
    z-index: 120;
    width: 44px;
    height: 44px;
    padding: 0;
    align-items: center;
    justify-content: center;
    border: 1px solid #dfe4e8;
    border-radius: 12px;
    background: #1f2429;
    color: #fff;
    box-shadow: 0 5px 18px rgba(20, 24, 30, .16);
}
.orders-sidebar-toggle:hover { background: #2a3036; }
.orders-sidebar-toggle svg { width: 21px; height: 21px; }

body.orders-sidebar-collapsed .admin-shell {
    grid-template-columns: minmax(0, 1fr) !important;
}
body.orders-sidebar-collapsed .sidebar {
    display: none !important;
}
body.orders-sidebar-collapsed .orders-sidebar-toggle {
    display: inline-flex;
}
body.orders-sidebar-collapsed .main-col {
    grid-column: 1;
    width: 100%;
    border-right: 0;
}
body.orders-sidebar-collapsed .orders-topbar {
    padding-left: 76px;
}
body.orders-sidebar-collapsed .orders-page,
body.orders-sidebar-collapsed .orders-app {
    width: 100%;
    max-width: none;
}

@media (max-width: 720px) {
    .orders-sidebar-toggle {
        top: 9px;
        left: 9px;
        width: 40px;
        height: 40px;
        border-radius: 10px;
    }
    body.orders-sidebar-collapsed .orders-topbar {
        padding-left: 60px;
    }
}
'''
if '/* Orders fullscreen workspace 2026-09-15 */' not in css:
    css += css_patch

HTML.write_text(html, encoding='utf-8')
CSS.write_text(css, encoding='utf-8')
JS.write_text(js, encoding='utf-8')
