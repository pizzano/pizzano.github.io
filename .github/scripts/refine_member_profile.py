from pathlib import Path
import re

html_path = Path('test/test.html')
css_path = Path('test/test.css')
html = html_path.read_text()
css = css_path.read_text()

html = re.sub(r'test\.css\?v=[^"\']+', 'test.css?v=member-sheet-20260817-2345', html, count=1)
html = html.replace('    <button class="member-lang" id="memberLang">🇳🇴 NO</button>\n', '')

old_account = '''<section class="screen" id="accountScreen" hidden>\n  <div class="screen-head"><button class="screen-back" data-close="accountScreen">‹</button><h2 id="accountTitle">Profil</h2></div>\n  <div class="screen-scroll" id="accountContent"></div>\n</section>'''
new_account = '''<section class="screen account-sheet" id="accountScreen" hidden>\n  <div class="account-sheet-head"><div class="account-sheet-grip"></div><h2 id="accountTitle">Profil</h2><button class="account-sheet-close" data-close="accountScreen" type="button" aria-label="Lukk">×</button></div>\n  <div class="screen-scroll account-sheet-scroll" id="accountContent"></div>\n</section>'''
if old_account not in html:
    raise SystemExit('account markup not found')
html = html.replace(old_account, new_account)

html = html.replace(
    "function ensureAccount(phone){if(!accounts[phone])accounts[phone]={phone,name:'',email:'',birth:'',marketing:true,language:'no',stamps:0,rewards:0,savings:0,favorites:[],createdAt:Date.now()};saveAccount();return accounts[phone]}",
    "function ensureAccount(phone){if(!accounts[phone])accounts[phone]={phone,name:'',email:'',birth:'',marketing:true,stamps:0,rewards:0,favorites:[],createdAt:Date.now()};saveAccount();return accounts[phone]}"
)
html = html.replace(
    "function openScreen(id){$$('.screen').forEach(x=>x.hidden=true);$('#'+id).hidden=false;document.body.classList.add('kol-top-back-active')}",
    "function openScreen(id){$$('.screen').forEach(x=>x.hidden=true);$('#'+id).hidden=false;document.body.classList.toggle('kol-top-back-active',id!=='accountScreen')}"
)
old_header = "if(a){const letter=(a.name||a.phone||'K').trim().charAt(0).toUpperCase();pb.innerHTML=`<span class=\"profile-letter\">${letter}</span>`;shortcuts.hidden=false;$('#memberAvatar').textContent=letter;$('#memberLang').textContent=a.language==='en'?'🇬🇧 EN':'🇳🇴 NO'}"
new_header = "if(a){const letter=(a.name||a.phone||'K').trim().charAt(0).toUpperCase();pb.innerHTML=`<span class=\"profile-letter\">${letter}</span>`;shortcuts.hidden=false;$('#memberAvatar').textContent=letter}"
if old_header not in html:
    raise SystemExit('renderHeader target not found')
html = html.replace(old_header, new_header)

start = html.find('function renderLogin(){')
end = html.find('function drawDemoQr', start)
if start < 0 or end < 0:
    raise SystemExit('account functions block not found')

account_js = r'''function accountFooter(){return `<div class="account-logout-bar"><button class="account-logout" id="logoutBtn" type="button">Logg ut</button></div>`}
function bindAccountFooter(){const b=$('#logoutBtn');if(b)b.onclick=()=>{setSession(null);renderLogin()}}
function stampsHtml(a){return Array.from({length:10},(_,i)=>`<span class="stamp ${i<a.stamps?'on':''}">${i<a.stamps?'✓':i+1}</span>`).join('')}
function pizzaProgress(a){return `<section class="pizza-loyalty-card"><div class="pizza-loyalty-top"><div><small>STOR PIZZA-KUPONGER</small><h3>${a.stamps} av 10</h3></div><div class="pizza-reward-badge">${a.rewards||0}<span>gratis</span></div></div><div class="stamps">${stampsHtml(a)}</div><p>Kjøp 10 Stor Pizza – <strong>den 11. er gratis.</strong></p>${a.rewards?`<div class="reward-ready">🎁 ${a.rewards} gratis Stor Pizza klar til bruk</div>`:''}</section>`}
function accountBack(){return `<button class="account-inline-back" id="accountBack" type="button">← Profil</button>`}
function bindAccountBack(){const b=$('#accountBack');if(b)b.onclick=renderProfileMenu}
function renderLogin(){
 $('#accountTitle').textContent='Logg inn';
 $('#accountContent').innerHTML=`<div class="login-wrap"><h2>Logg inn</h2><p>Telefonnummer og navn er nok.</p><label class="phone-label">Telefonnummer</label><div class="phone-field"><div class="country-code">🇳🇴 +47</div><input id="loginPhone" inputmode="numeric" maxlength="8" placeholder="95 55 74 74"></div><label class="phone-label">Hele navn</label><input class="login-name-field" id="loginName" autocomplete="name" placeholder="Fatih Alemdar"><button class="primary login-continue" id="loginContinue" type="button">Fortsett</button></div>`;
 $('#loginContinue').onclick=()=>{const p=$('#loginPhone').value.replace(/\D/g,''),name=$('#loginName').value.trim();if(p.length!==8){alert('Skriv inn et 8-sifret telefonnummer.');return}if(!name){alert('Skriv inn hele navnet ditt.');return}const a=ensureAccount(p);a.name=name;saveAccount();setSession(p);renderProfileMenu()}
}
function renderProfileMenu(){
 const a=account();if(!a){renderLogin();return}
 $('#accountTitle').textContent='Profil';
 const recent=orders.filter(o=>o.phone===a.phone).length;
 $('#accountContent').innerHTML=`<div class="profile-home"><div class="profile-greeting"><div class="member-avatar-large">${escapeHtml((a.name||'K').charAt(0).toUpperCase())}</div><div><small>KØL MEDLEM</small><h2>${escapeHtml(a.name||'KØL-medlem')}</h2><p>+47 ${formatPhone(a.phone)}</p></div></div>${pizzaProgress(a)}<div class="profile-quick-grid"><button data-account="card"><strong>Medlemskort</strong><span>Se kupongkortet ›</span></button><button data-account="orders"><strong>Bestillinger</strong><span>${recent} lagret ›</span></button><button data-account="profile"><strong>Kontaktinfo</strong><span>Navn og e-post ›</span></button><button data-account="qr"><strong>QR-kode</strong><span>Vis i kassa ›</span></button></div></div>${accountFooter()}`;
 $$('[data-account]').forEach(b=>b.onclick=()=>({profile:renderProfileForm,card:renderMemberCard,orders:renderOrders,qr:renderQrView}[b.dataset.account]()));bindAccountFooter()
}
function renderProfileForm(){
 const a=account();$('#accountTitle').textContent='Kontaktinfo';
 $('#accountContent').innerHTML=`${accountBack()}<div class="profile-form"><div class="profile-form-card"><label>Hele navn<input id="pfName" value="${escapeHtml(a.name)}"></label><label>Telefonnummer<input value="+47 ${formatPhone(a.phone)}" disabled></label><label>E-post <small>(valgfritt)</small><input id="pfEmail" type="email" value="${escapeHtml(a.email||'')}"></label></div><label class="check-row"><input id="pfMarketing" type="checkbox" ${a.marketing?'checked':''}> Jeg ønsker tilbud fra KØL</label><button class="primary" id="saveProfile" style="width:100%;margin-top:14px">Lagre</button></div>${accountFooter()}`;
 $('#saveProfile').onclick=()=>{a.name=$('#pfName').value.trim()||a.name;a.email=$('#pfEmail').value.trim();a.marketing=$('#pfMarketing').checked;saveAccount();renderAll();renderProfileMenu()};bindAccountBack();bindAccountFooter()
}
function renderMemberCard(){
 const a=account();$('#accountTitle').textContent='Medlemskort';
 $('#accountContent').innerHTML=`${accountBack()}<div class="member-card compact-member-card"><div class="member-card-logo">KØL</div><div class="member-card-copy"><strong>${escapeHtml(a.name||'KØL-medlem')}</strong><span>+47 ${formatPhone(a.phone)}</span></div></div>${pizzaProgress(a)}<button class="primary member-qr-button" id="openQrFromCard">Vis QR-kode</button>${accountFooter()}`;
 $('#openQrFromCard').onclick=renderQrView;bindAccountBack();bindAccountFooter()
}
function renderQrView(){
 const a=account();$('#accountTitle').textContent='QR-kode';
 $('#accountContent').innerHTML=`${accountBack()}<div class="qr-wrap"><p>Vis QR-koden i kassa for å finne medlemskortet.</p><canvas id="memberQr" width="290" height="290"></canvas><h3>${escapeHtml(a.name||'KØL-medlem')}</h3><strong>+47 ${formatPhone(a.phone)}</strong></div>${accountFooter()}`;drawDemoQr($('#memberQr'),`KOL:${a.phone}`);bindAccountBack();bindAccountFooter()
}
function renderOrders(){
 const a=account(),list=orders.filter(o=>o.phone===a.phone);$('#accountTitle').textContent='Bestillinger';
 $('#accountContent').innerHTML=`${accountBack()}<div class="profile-body"><div class="orders-mini-head"><strong>Mine bestillinger</strong><span>${list.length}</span></div>${list.length?list.map(o=>`<div class="order-card"><div class="order-card-top"><strong>Ordre ${o.id}</strong><b>${money(o.total)}</b></div><small>${new Date(o.createdAt).toLocaleString('nb-NO')}</small><div class="order-items-mini">${o.items.map(x=>`${x.qty}x ${x.name} (${x.size})`).join('<br>')}</div></div>`).join(''):'<div class="empty-note">Ingen bestillinger ennå.</div>'}</div>${accountFooter()}`;bindAccountBack();bindAccountFooter()
}
'''
html = html[:start] + account_js + html[end:]

css = css.replace('.member-shortcuts .member-lang{margin-left:auto;background:#fff}', '')
account_css = r'''.account-sheet{top:auto;bottom:0;height:min(72dvh,690px);border-radius:24px 24px 0 0;overflow:hidden;background:#fff;box-shadow:0 -100vh 0 100vh rgba(0,0,0,.25),0 -16px 50px rgba(0,0,0,.16)}.account-sheet-head{position:relative;min-height:66px;display:flex;align-items:center;justify-content:center;padding:14px 58px 10px;border-bottom:1px solid var(--line);background:#fff;color:var(--txt)}.account-sheet-head h2{margin:0;font-size:20px}.account-sheet-grip{position:absolute;top:8px;left:50%;width:42px;height:4px;transform:translateX(-50%);border-radius:999px;background:#ddd7d2}.account-sheet-close{position:absolute;right:14px;top:15px;width:38px;height:38px;border:0;border-radius:50%;background:#111;color:#fff;font-size:22px;line-height:1}.account-sheet-scroll{background:#fff}.profile-home{padding:14px 14px 8px}.profile-greeting{display:flex;align-items:center;gap:12px;margin-bottom:12px}.member-avatar-large{width:48px;height:48px;border-radius:50%;display:grid;place-items:center;background:#f1f2f2;font-size:20px;font-weight:800}.profile-greeting small{color:var(--mut);font-size:10px;letter-spacing:.08em}.profile-greeting h2{margin:1px 0 2px;font-size:20px}.profile-greeting p{margin:0;color:var(--mut);font-size:13px}.pizza-loyalty-card{padding:16px;border:1px solid #ffd2c0;border-radius:18px;background:linear-gradient(135deg,#fff8f4,#fff)}.pizza-loyalty-top{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.pizza-loyalty-top small{color:var(--o);font-size:10px;font-weight:800;letter-spacing:.08em}.pizza-loyalty-top h3{margin:4px 0 0;font-size:24px}.pizza-reward-badge{min-width:58px;height:58px;border-radius:16px;display:grid;place-items:center;background:var(--o);color:#fff;font-size:22px;font-weight:800;line-height:1}.pizza-reward-badge span{display:block;font-size:9px;font-weight:700;text-transform:uppercase}.stamps{display:grid;grid-template-columns:repeat(10,1fr);gap:5px;margin:14px 0 10px}.stamp{aspect-ratio:1;border:1px solid #e4ddd8;border-radius:50%;display:grid;place-items:center;background:#fff;color:#999;font-size:10px}.stamp.on{border-color:var(--o);background:var(--o);color:#fff;font-weight:800}.pizza-loyalty-card p{margin:0;color:#5f5752;font-size:13px}.reward-ready{margin-top:10px;padding:10px;border-radius:10px;background:#e9f7ef;color:#17613e;font-size:13px;font-weight:700;text-align:center}.profile-quick-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:12px}.profile-quick-grid button{min-height:70px;padding:12px;border:1px solid var(--line);border-radius:13px;background:#fff;text-align:left}.profile-quick-grid strong{display:block;font-size:14px}.profile-quick-grid span{display:block;margin-top:4px;color:var(--mut);font-size:11px}.account-logout-bar{position:sticky;bottom:0;z-index:4;padding:10px 14px max(10px,env(safe-area-inset-bottom));border-top:1px solid var(--line);background:rgba(255,255,255,.96);backdrop-filter:blur(8px)}.account-logout{width:100%;height:46px;border:1px solid #f1c8c1;border-radius:11px;background:#fff;color:#d62929;font-weight:700}.account-inline-back{margin:10px 14px 0;border:0;background:none;color:#222;font-weight:650;padding:6px 0}.login-wrap{padding:18px 16px 28px}.login-wrap h2{text-align:center;font-size:25px;margin:8px 0 4px}.login-wrap>p{text-align:center;margin:0 0 24px;color:var(--mut);font-size:13px}.phone-label{display:block;margin:12px 0 7px;font-size:13px;font-weight:650}.phone-field{height:54px;border:1px solid #d8d4d1;border-radius:12px;display:flex;overflow:hidden}.country-code{min-width:108px;background:#f0f2f3;display:flex;align-items:center;justify-content:center;gap:7px}.phone-field input{flex:1;border:0;outline:0;padding:0 14px;font-size:17px}.login-name-field{width:100%;height:54px;border:1px solid #d8d4d1;border-radius:12px;outline:0;padding:0 14px;font-size:16px}.login-continue{width:100%;margin-top:18px}.profile-form{padding:10px 14px 20px}.profile-form-card{padding:14px;border-radius:15px;background:#f3f4f4}.profile-form label{display:block;margin-bottom:12px;font-size:13px;font-weight:600}.profile-form label:last-child{margin-bottom:0}.profile-form input{width:100%;height:50px;margin-top:6px;padding:0 12px;border:1px solid #d9d3cf;border-radius:11px;background:#fff;outline:0}.profile-form input:disabled{background:#eceff0;color:#777}.profile-form label small{color:var(--mut);font-weight:400}.check-row{display:flex!important;align-items:center;gap:9px;margin-top:12px}.check-row input{width:21px;height:21px;margin:0}.member-card.compact-member-card{min-height:112px;margin:12px 14px;padding:18px;border-radius:18px;background:linear-gradient(135deg,#fff,#fff4dc);display:flex;align-items:center;gap:14px}.compact-member-card .member-card-logo{width:52px;height:52px;border-radius:50%;display:grid;place-items:center;background:#fff;color:var(--o);font-weight:900;box-shadow:0 4px 14px rgba(0,0,0,.08)}.member-card-copy{display:grid;gap:4px}.member-card-copy strong{font-size:17px}.member-card-copy span{color:var(--mut);font-size:13px}.member-qr-button{width:calc(100% - 28px);margin:0 14px 12px}.qr-wrap{text-align:center;padding:10px 16px 24px}.qr-wrap p{margin:4px 0 10px;color:var(--mut);font-size:13px}#memberQr{width:min(250px,78vw);height:auto;border:1px solid var(--line);border-radius:14px;padding:12px;background:#fff;margin:8px auto 10px}.qr-wrap h3{margin:8px 0 5px}.orders-mini-head{display:flex;justify-content:space-between;align-items:center;margin:2px 0 10px}.orders-mini-head span{min-width:25px;height:25px;border-radius:999px;background:#f1f2f2;display:grid;place-items:center;font-size:11px;font-weight:800}.order-card{padding:13px;border:1px solid var(--line);border-radius:12px;margin-bottom:9px}.order-card-top{display:flex;justify-content:space-between;gap:10px}.order-card small{color:var(--mut)}.order-items-mini{margin-top:7px;font-size:12px;line-height:1.45}'''
pattern = re.compile(r'\.profile-menu-card\{.*?\}\.local-allergen-modal', re.S)
if not pattern.search(css):
    raise SystemExit('profile css block not found')
css = pattern.sub(account_css + '.local-allergen-modal', css, count=1)

html_path.write_text(html)
css_path.write_text(css)

# Sanity checks
checks = [
    'Hele navn',
    'STOR PIZZA-KUPONGER',
    'account-sheet',
    'account-logout-bar',
    "id!=='accountScreen'"
]
for c in checks:
    if c not in html and c not in css:
        raise SystemExit(f'missing {c}')
if 'memberLang' in html or 'Velg språk' in html or 'pfLang' in html:
    raise SystemExit('language UI still present')
