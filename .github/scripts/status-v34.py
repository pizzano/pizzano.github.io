from pathlib import Path
import re

index_path = Path('test/index.html')
css_path = Path('test/kol-core.css')
index = index_path.read_text(encoding='utf-8')
css = css_path.read_text(encoding='utf-8')

index = index.replace('kol-core.css?v=mobile-v33', 'kol-core.css?v=mobile-v34', 1)
index = index.replace('clock: "Kom og hent når det passer."', 'clock: "Vent på «Klar»-status"')

accepted_pattern = re.compile(r'''\} else if \(stage === "accepted"\) \{\n\s*const value = readyParts\?\.value \|\| "";\n\s*const unit = readyParts\?\.unit \|\| "";\n\s*const clock = readyParts\?\.clock \|\| "";\n\s*main = `.*?`;
\s*\} else if \(stage === "ready"\) \{''', re.S)
accepted_replacement = r'''} else if (stage === "accepted") {
    const value = readyParts?.value || "";
    const unit = readyParts?.unit || "";
    const clock = readyParts?.clock || "";
    const kitchenMinutes = Math.max(1, Number(order.readyMinutes || 10) || 10);
    main = `
      <div class="live-status-main accepted">
        <span class="live-status-kicker">BESTILLINGEN TILBEREDES</span>
        <h3>Kjøkkenet lager maten din</h3>
        <div class="live-status-prep-note">
          <span>Tilberedningstid satt av kjøkkenet</span>
          <strong>${kitchenMinutes} min</strong>
        </div>
        <div class="live-status-time accepted">
          <small>TID IGJEN</small>
          <div><strong data-customer-ready="${escapeAttribute(order.id || "")}">${escapeAttribute(value)}</strong><em data-customer-ready-unit="${escapeAttribute(order.id || "")}" ${unit ? "" : "hidden"}>${escapeAttribute(unit)}</em></div>
          <span>Gjenstående tid til forventet klar-tid.</span>
        </div>
        <div class="live-status-pickup">
          <small>FORVENTET KLAR</small>
          <strong data-customer-ready-clock="${escapeAttribute(order.id || "")}">${escapeAttribute(clock)}</strong>
        </div>
        <p class="live-status-wait-note">Vent på status <b>«Klar»</b> før du henter bestillingen.</p>
        <span data-customer-ready-label="${escapeAttribute(order.id || "")}" hidden>${escapeAttribute(readyParts?.label || "")}</span>
      </div>`;
  } else if (stage === "ready") {'''
index, count = accepted_pattern.subn(accepted_replacement, index, count=1)
if count != 1:
    raise SystemExit(f'Accepted block replacement failed: {count}')

ready_pattern = re.compile(r'''\} else if \(stage === "ready"\) \{\n\s*main = `.*?`;
\s*\} else \{''', re.S)
ready_replacement = r'''} else if (stage === "ready") {
    main = `
      <div class="live-status-main ready">
        <span class="live-status-kicker">KLAR FOR HENTING</span>
        <h3>Maten din er klar</h3>
        <div class="live-status-ready">
          <strong>Kom og hent nå</strong>
          <small>Maten er ferdig og bør hentes så snart som mulig mens den er varm.</small>
        </div>
        <p class="live-status-ready-help">Si navnet ditt og hva du bestilte når du henter.</p>
        <span data-customer-ready-label="${escapeAttribute(order.id || "")}" hidden>Maten er klar</span>
        <strong data-customer-ready="${escapeAttribute(order.id || "")}" hidden></strong>
        <em data-customer-ready-unit="${escapeAttribute(order.id || "")}" hidden></em>
        <small data-customer-ready-clock="${escapeAttribute(order.id || "")}" hidden></small>
      </div>`;
  } else {'''
index, count = ready_pattern.subn(ready_replacement, index, count=1)
if count != 1:
    raise SystemExit(f'Ready block replacement failed: {count}')

# Integrate new visual rules into the existing mobile layer, immediately before the existing countdown styles.
anchor = 'body.kol-customer .live-status-time{margin-top:18px!important;'
if anchor not in css:
    raise SystemExit('CSS live-status-time anchor not found')
prep_css = '''body.kol-customer .live-status-prep-note{margin-top:18px!important;padding:12px 14px!important;display:flex!important;align-items:center!important;justify-content:space-between!important;gap:14px!important;border-top:1px solid #d8e4dc!important;border-bottom:1px solid #d8e4dc!important;background:#f7faf8!important;}
body.kol-customer .live-status-prep-note span{color:#68736c!important;font-size:12px!important;font-weight:500!important;line-height:1.35!important;}
body.kol-customer .live-status-prep-note strong{flex:0 0 auto!important;color:#165f43!important;font-size:17px!important;font-weight:700!important;white-space:nowrap!important;}
'''
css = css.replace(anchor, prep_css + anchor, 1)

css = css.replace(
    'body.kol-customer .live-status-pickup strong{color:#1c342a!important;font-size:19px!important;font-weight:700!important;text-align:right!important;}',
    'body.kol-customer .live-status-pickup strong{color:#1c342a!important;font-size:19px!important;font-weight:700!important;text-align:right!important;}\nbody.kol-customer .live-status-wait-note{margin:0!important;padding:11px 16px!important;border:1px solid #d9d2cb!important;border-top:0!important;background:#faf8f5!important;color:#675f58!important;font-size:12.5px!important;font-weight:400!important;line-height:1.45!important;}\nbody.kol-customer .live-status-wait-note b{color:#176746!important;font-weight:700!important;}'
)
css = css.replace(
    'body.kol-customer .live-status-ready small{display:block!important;margin-top:7px!important;color:#e1f0e8!important;font-size:13px!important;font-weight:400!important;line-height:1.35!important;}',
    'body.kol-customer .live-status-ready small{display:block!important;margin-top:7px!important;color:#e1f0e8!important;font-size:13px!important;font-weight:400!important;line-height:1.4!important;}\nbody.kol-customer .live-status-ready-help{margin:0!important;padding:11px 16px!important;border:1px solid #cbd9d1!important;border-top:0!important;background:#f5f9f6!important;color:#52645a!important;font-size:12.5px!important;font-weight:400!important;line-height:1.45!important;}'
)

index_path.write_text(index, encoding='utf-8')
css_path.write_text(css, encoding='utf-8')
print('status v34 applied')
