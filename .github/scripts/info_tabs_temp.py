from pathlib import Path
import re

html_path = Path("demo/index.html")
js_path = Path("demo/js/customer.js")
css_path = Path("demo/css/customer.css")
sw_path = Path("demo/service-worker.js")

html = html_path.read_text(encoding="utf-8")

# Reorder profile tabs: Kontakt | Bestillinger | Favoritter
nav_match = re.search(r'(<nav class="profile-tabs" role="tablist" aria-label="Profilinnhold">)(.*?)(</nav>)', html, re.S)
if not nav_match:
    raise SystemExit("Profile tabs nav not found")
nav_inner = nav_match.group(2)
buttons = {}
for key in ("contact", "orders", "favorites"):
    m = re.search(r'<button class="profile-tab(?: is-active)?" data-profile-tab="' + key + r'".*?</button>', nav_inner, re.S)
    if not m:
        raise SystemExit(f"Profile tab {key} not found")
    buttons[key] = m.group(0)
new_nav = nav_match.group(1) + "\n    " + buttons["contact"] + "\n    " + buttons["orders"] + "\n    " + buttons["favorites"] + "\n" + nav_match.group(3)
html = html[:nav_match.start()] + new_nav + html[nav_match.end():]

# Compact Info into tabs.
info_start = html.find('        <!-- ============ INFO ============ -->')
info_end = html.find('    <!-- Matallergier.', info_start)
if info_start < 0 or info_end < 0:
    raise SystemExit("Info section markers not found")

new_info = """        <!-- ============ INFO ============ -->
        <section class="view view-info" id="viewInfo" aria-label="Informasjon" hidden>
            <h1 class="view-title">Informasjon</h1>

            <nav class="profile-tabs" role="tablist" aria-label="Informasjon">
                <button class="profile-tab is-active" data-info-tab="contact" id="infoTabContact" type="button" role="tab" aria-selected="true" aria-controls="infoPanelContact">Kontakt</button>
                <button class="profile-tab" data-info-tab="hours" id="infoTabHours" type="button" role="tab" aria-selected="false" aria-controls="infoPanelHours">Åpningstider</button>
                <button class="profile-tab" data-info-tab="allergens" id="infoTabAllergens" type="button" role="tab" aria-selected="false" aria-controls="infoPanelAllergens">Allergener</button>
            </nav>

            <div class="profile-tab-panels">
                <section class="card profile-tab-panel is-active" id="infoPanelContact" data-info-panel="contact" role="tabpanel" aria-labelledby="infoTabContact">
                    <h2 class="sec-title" id="infoName">KØL Grill &amp; Pizza</h2>
                    <p class="info-line" id="infoAddress">—</p>
                    <a class="info-call" id="infoPhone">—</a>
                    <div class="info-detail"><span>Henting</span><p id="infoPickup">—</p></div>
                    <div class="info-detail"><span>Betaling</span><p id="infoPayment">—</p></div>
                </section>

                <section class="card profile-tab-panel" id="infoPanelHours" data-info-panel="hours" role="tabpanel" aria-labelledby="infoTabHours" hidden>
                    <h2 class="sec-title">Åpningstider</h2>
                    <ul class="hours">
                        <li><span id="infoDays">Mandag – søndag</span><span id="infoHours">14:00 – 22:00</span></li>
                    </ul>
                    <p class="hint" id="infoOpenNow">—</p>
                </section>

                <section class="card profile-tab-panel" id="infoPanelAllergens" data-info-panel="allergens" role="tabpanel" aria-labelledby="infoTabAllergens" hidden>
                    <h2 class="sec-title">Allergener</h2>
                    <p class="info-line">Allergener vises på hvert produkt. Kontakt oss ved spørsmål om innhold.</p>
                </section>
            </div>

            <details class="staff-access"><summary>For ansatte</summary><a class="btn btn-outline btn-block" href="/demo/admin.html">Åpne adminpanel</a></details>
        </section>
    </main>

"""
html = html[:info_start] + new_info + html[info_end:]
html = re.sub(r'\?v=20260909-\d+', '?v=20260909-2', html)
html_path.write_text(html, encoding="utf-8")

js = js_path.read_text(encoding="utf-8")
if "function setInfoTab(tabName)" not in js:
    marker = "function renderInfo() {"
    if marker not in js:
        raise SystemExit("renderInfo marker not found")
    helper = """function setInfoTab(tabName) {
  const validTabs = new Set(['contact', 'hours', 'allergens']);
  const activeTab = validTabs.has(tabName) ? tabName : 'contact';
  document.querySelectorAll('#viewInfo [data-info-tab]').forEach((button) => {
    const active = button.dataset.infoTab === activeTab;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-selected', String(active));
  });
  document.querySelectorAll('#viewInfo [data-info-panel]').forEach((panel) => {
    const active = panel.dataset.infoPanel === activeTab;
    panel.classList.toggle('is-active', active);
    panel.hidden = !active;
  });
  const activeButton = document.querySelector('#viewInfo [data-info-tab="' + activeTab + '"]');
  if (activeButton && typeof activeButton.scrollIntoView === 'function') {
    activeButton.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }
}

"""
    js = js.replace(marker, helper + marker, 1)

old_info_view = "  if (view === 'info') renderInfo();"
new_info_view = """  if (view === 'info') {
    setInfoTab('contact');
    renderInfo();
  }"""
if old_info_view in js:
    js = js.replace(old_info_view, new_info_view, 1)

if "const infoTab = event.target.closest('[data-info-tab]');" not in js:
    profile_click = """  const profileTab = event.target.closest('[data-profile-tab]');
  if (profileTab) {
    setProfileTab(profileTab.dataset.profileTab);
    return;
  }
"""
    info_click = """  const infoTab = event.target.closest('[data-info-tab]');
  if (infoTab) {
    setInfoTab(infoTab.dataset.infoTab);
    return;
  }
"""
    if profile_click not in js:
        raise SystemExit("Profile click handler marker not found")
    js = js.replace(profile_click, profile_click + info_click, 1)
js_path.write_text(js, encoding="utf-8")

css = css_path.read_text(encoding="utf-8")
marker = "/* ======================== Horizontal profile tabs ======================== */"
if marker not in css:
    raise SystemExit("Profile tab CSS marker not found")
head, tail = css.split(marker, 1)
tail = re.sub(r'#viewProfile (?=\.profile-tab)', ':is(#viewProfile, #viewInfo) ', tail)
css = head + marker + tail
css_path.write_text(css, encoding="utf-8")

sw = sw_path.read_text(encoding="utf-8")
sw = re.sub(r"const CACHE_NAME = 'kol-demo-v\d+';", "const CACHE_NAME = 'kol-demo-v27';", sw, count=1)
sw_path.write_text(sw, encoding="utf-8")
