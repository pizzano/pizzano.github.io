from pathlib import Path
import re

hp=Path('test/test.html')
cp=Path('test/test.css')
h=hp.read_text(encoding='utf-8')
c=cp.read_text(encoding='utf-8')

# Remove redundant logged-in shortcut row.
h,n=re.subn(r'\n\s*<div class="member-shortcuts" id="memberShortcuts" hidden>.*?</div>\s*\n','\n',h,count=1,flags=re.S)
assert n==1, 'member shortcut row not found'

# Replace store info full screen with bottom sheet + tabs.
info_re=r'<section class="screen" id="infoScreen" hidden>.*?</section>\s*\n\s*<div class="local-allergen-modal"'
info_html='''<section class="screen info-sheet" id="infoScreen" hidden>
  <div class="info-sheet-head"><div class="info-sheet-grip"></div><h2>Butikksinformasjon</h2><button class="info-sheet-close" data-close="infoScreen" type="button" aria-label="Lukk">×</button></div>
  <div class="info-tabs" role="tablist">
    <button class="info-tab active" data-info-tab="about" type="button">Om KØL</button>
    <button class="info-tab" data-info-tab="terms" type="button">Vilkår</button>
    <button class="info-tab" data-info-tab="privacy" type="button">Personvern</button>
  </div>
  <div class="screen-scroll info-sheet-scroll">
    <div class="info-tab-panel active" data-info-panel="about">
      <section class="store-info-card"><div><strong>KØL Grill &amp; Pizza</strong><span>ØGARDSVEGEN 44<br>2100 SKARNES</span></div><button class="store-map-button" id="storeMapBtn" type="button">⌖ Kart</button></section>
      <section class="store-section"><h3>Matallergier</h3><div class="store-allergen-card"><div class="store-allergen-icons">🥛 🌾 🥚 🫘 🌿 🟡 ◌ 🐟 🦐 🥜 🌰 ◇</div><p>Har du matallergi? Se allergenene i menyen eller spør oss før du bestiller.</p><button id="infoAllergenBtn" type="button">Se allergener</button></div></section>
      <section class="store-section"><h3>Kontakt oss</h3><div class="store-contact-card"><a href="tel:+4741145353"><span>☎</span><span><small>Telefon</small><strong>+47 41 14 53 53</strong></span></a></div></section>
      <section class="store-section"><h3>Sosiale medier</h3><div class="store-social-row"><button type="button">◎ Instagram</button><button type="button">f Facebook</button></div></section>
      <section class="store-section"><h3>Åpningstider</h3><div class="store-hours-card"><span>Mandag–Søndag</span><strong>14:00–22:00</strong></div></section>
    </div>
    <div class="info-tab-panel" data-info-panel="terms"><section class="store-text-card"><h3>Vilkår</h3><p>Bestillingen er bindende når den er sendt. Hentetid er veiledende og kan variere ved stor pågang.</p><p>Denne siden er foreløpig en LocalStorage-test.</p></section></div>
    <div class="info-tab-panel" data-info-panel="privacy"><section class="store-text-card"><h3>Personvern</h3><p>Testversjonen lagrer konto, favoritter og bestillinger bare på denne enheten. Ingen testdata sendes til en server.</p></section></div>
  </div>
</section>

<div class="local-allergen-modal"'''
h,n=re.subn(info_re,info_html,h,count=1,flags=re.S)
assert n==1, 'info screen not found'

# Header: keep only existing profile icon / initial.
old="function renderHeader(){const a=account(),pb=$('#profileBtn'),shortcuts=$('#memberShortcuts');if(a){const letter=(a.name||a.phone||'K').trim().charAt(0).toUpperCase();pb.innerHTML=`<span class=\"profile-letter\">${letter}</span>`;shortcuts.hidden=false;$('#memberAvatar').textContent=letter}else{pb.innerHTML='<svg class=\"plain-icon\" viewBox=\"0 0 24 24\"><circle cx=\"12\" cy=\"8\" r=\"3.2\"/><path d=\"M5.8 19c.8-3.1 3-4.7 6.2-4.7s5.4 1.6 6.2 4.7\"/></svg>';shortcuts.hidden=true}}"
new="function renderHeader(){const a=account(),pb=$('#profileBtn');if(a){const letter=(a.name||a.phone||'K').trim().charAt(0).toUpperCase();pb.innerHTML=`<span class=\"profile-letter\">${letter}</span>`}else{pb.innerHTML='<svg class=\"plain-icon\" viewBox=\"0 0 24 24\"><circle cx=\"12\" cy=\"8\" r=\"3.2\"/><path d=\"M5.8 19c.8-3.1 3-4.7 6.2-4.7s5.4 1.6 6.2 4.7\"/></svg>'}}"
assert old in h, 'renderHeader not found'
h=h.replace(old,new,1)

h=h.replace("document.body.classList.toggle('kol-top-back-active',id!=='accountScreen')","document.body.classList.toggle('kol-top-back-active',!['accountScreen','infoScreen'].includes(id))",1)

# Pizza coupon cells.
old="function stampsHtml(a){return Array.from({length:10},(_,i)=>`<span class=\"stamp ${i<a.stamps?'on':''}\">${i<a.stamps?'✓':i+1}</span>`).join('')}"
new="function stampsHtml(a){return Array.from({length:10},(_,i)=>`<span class=\"stamp ${i<a.stamps?'on':''}\"><b>${i+1}</b><i>🍕</i></span>`).join('')}"
assert old in h, 'stampsHtml not found'
h=h.replace(old,new,1)

# Profile home: only Bestillinger + Kontaktinfo.
s=h.index('function renderProfileMenu(){')
e=h.index('function renderProfileForm(){',s)
h=h[:s]+'''function renderProfileMenu(){
 const a=account();if(!a){renderLogin();return}
 $('#accountTitle').textContent='Profil';
 const recent=orders.filter(o=>o.phone===a.phone).length;
 $('#accountContent').innerHTML=`<div class="profile-home"><div class="profile-greeting"><div class="member-avatar-large">${escapeHtml((a.name||'K').charAt(0).toUpperCase())}</div><div><small>KØL MEDLEM</small><h2>${escapeHtml(a.name||'KØL-medlem')}</h2><p>+47 ${formatPhone(a.phone)}</p></div></div>${pizzaProgress(a)}<div class="profile-simple-actions"><button data-account="orders"><span class="profile-action-icon">≡</span><span><strong>Bestillinger</strong><small>${recent} lagret</small></span><b>›</b></button><button data-account="profile"><span class="profile-action-icon">✎</span><span><strong>Kontaktinfo</strong><small>Navn og e-post</small></span><b>›</b></button></div></div>${accountFooter()}`;
 $$('[data-account]').forEach(b=>b.onclick=()=>({profile:renderProfileForm,orders:renderOrders}[b.dataset.account]()));bindAccountFooter()
}
'''+h[e:]

# Remove obsolete member card / QR views.
if 'function renderMemberCard(){' in h:
    s=h.index('function renderMemberCard(){'); e=h.index('function renderOrders(){',s); h=h[:s]+h[e:]
if 'function drawDemoQr(' in h:
    s=h.index('function drawDemoQr('); e=h.index('function renderAll(){',s); h=h[:s]+h[e:]

# Remove shortcut handlers.
h,n=re.subn(r";\$\('#memberAvatar'\)\.onclick=.*?;\$\('#memberCardShortcut'\)\.onclick=.*?;\$\('#qrShortcut'\)\.onclick=.*?;renderAll\(\);",";renderAll();",h,count=1)
assert n==1, 'shortcut handlers not found'

# Info behavior.
marker="$('#brandBtn').onclick=closeScreens;$('#infoBtn').onclick=()=>openScreen('infoScreen');"
assert marker in h, 'info handler marker not found'
replacement="""$('#brandBtn').onclick=closeScreens;$('#infoBtn').onclick=()=>{openScreen('infoScreen');setInfoTab('about')};
function setInfoTab(tab){$$('[data-info-tab]').forEach(b=>b.classList.toggle('active',b.dataset.infoTab===tab));$$('[data-info-panel]').forEach(p=>p.classList.toggle('active',p.dataset.infoPanel===tab))}
$$('[data-info-tab]').forEach(b=>b.onclick=()=>setInfoTab(b.dataset.infoTab));
$('#storeMapBtn').onclick=()=>window.open('https://www.google.com/maps/search/?api=1&query=%C3%98GARDSVEGEN%2044%2C%202100%20SKARNES','_blank','noopener');
$('#infoAllergenBtn').onclick=()=>{closeScreens();renderAllergens();$('#allergenModal').hidden=false};"""
h=h.replace(marker,replacement,1)
h=re.sub(r'test\.css\?v=[^"\']+','test.css?v=profile-info-20260817-2354',h,count=1)

# CSS cleanup.
c=re.sub(r'\.member-shortcuts\{[^}]*\}\.member-shortcuts button\{[^}]*\}\.member-shortcuts \.member-avatar\{[^}]*\}','',c,count=1)
c=re.sub(r'\.member-card\{[^}]*\}\.member-card-logo\{[^}]*\}\.member-card \.member-name\{[^}]*\}\.member-card \.member-phone\{[^}]*\}','',c,count=1)
c=re.sub(r'\.qr-wrap\{[^}]*\}\.qr-wrap p\{[^}]*\}#memberQr\{[^}]*\}','',c,count=1)

# Coupon grid style.
c,n=re.subn(r'\.stamps\{[^}]*\}\.stamp\{[^}]*\}\.stamp\.on\{[^}]*\}', '.stamps{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin:14px 0 10px}.stamp{min-height:74px;border:0;border-radius:10px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;background:#d9d2d2;color:#161313}.stamp b{font-size:13px;font-weight:700}.stamp i{font-style:normal;font-size:26px;filter:grayscale(1);opacity:.75}.stamp.on{background:#20c936;color:#071b08}.stamp.on i{filter:none;opacity:1}',c,count=1)
assert n==1, 'stamp css not found'

c+='''
.profile-simple-actions{display:grid;gap:9px;margin-top:12px}.profile-simple-actions button{width:100%;min-height:66px;display:grid;grid-template-columns:42px 1fr 18px;align-items:center;gap:10px;padding:10px 12px;border:1px solid var(--line);border-radius:14px;background:#fff;text-align:left}.profile-simple-actions button>span:nth-child(2){display:block}.profile-simple-actions strong{display:block;font-size:14px}.profile-simple-actions small{display:block;margin-top:3px;color:var(--mut);font-size:11px}.profile-simple-actions button>b{font-size:22px;font-weight:400}.profile-action-icon{width:38px;height:38px;border-radius:10px;background:#f3f2f1;display:grid;place-items:center;font-size:20px}
.info-sheet{top:auto;bottom:0;height:min(78dvh,760px);border-radius:24px 24px 0 0;overflow:hidden;background:#f7f7f7;box-shadow:0 -100vh 0 100vh rgba(0,0,0,.25),0 -16px 50px rgba(0,0,0,.16)}.info-sheet-head{position:relative;min-height:64px;display:flex;align-items:center;justify-content:center;padding:16px 58px 10px;background:#fff}.info-sheet-head h2{margin:0;font-size:22px}.info-sheet-grip{position:absolute;top:8px;left:50%;width:42px;height:4px;transform:translateX(-50%);border-radius:999px;background:#d9d5d2}.info-sheet-close{position:absolute;right:14px;top:14px;width:38px;height:38px;border:0;border-radius:50%;background:#111;color:#fff;font-size:22px}.info-tabs{display:grid;grid-template-columns:repeat(3,1fr);padding:0 14px;border-bottom:1px solid var(--line);background:#fff}.info-tab{height:48px;border:0;border-bottom:2px solid transparent;background:#fff;color:#777;font-weight:700}.info-tab.active{color:#111;border-bottom-color:#111}.info-sheet-scroll{padding:14px;background:#f7f7f7}.info-tab-panel{display:none}.info-tab-panel.active{display:block}.store-info-card,.store-allergen-card,.store-contact-card,.store-hours-card,.store-text-card{border-radius:14px;background:#fff;box-shadow:0 2px 12px rgba(0,0,0,.05)}.store-info-card{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;padding:18px}.store-info-card strong{display:block;font-size:19px}.store-info-card span{display:block;margin-top:7px;color:#777;line-height:1.35}.store-map-button{height:40px;padding:0 14px;border:1px solid #ddd;border-radius:10px;background:#fff;color:#111}.store-section{margin-top:22px}.store-section h3{margin:0 0 10px;font-size:18px}.store-allergen-card{padding:16px}.store-allergen-icons{font-size:20px;letter-spacing:2px;line-height:1.6}.store-allergen-card p{margin:10px 0 14px;color:#555;line-height:1.4}.store-allergen-card button{height:42px;padding:0 16px;border:1px solid #ddd;border-radius:10px;background:#fff;font-weight:700}.store-contact-card{overflow:hidden}.store-contact-card a{display:flex;align-items:center;gap:14px;padding:16px;color:inherit;text-decoration:none}.store-contact-card a>span:first-child{width:38px;height:38px;border-radius:10px;background:#f2f1f0;display:grid;place-items:center;font-size:20px}.store-contact-card small{display:block;color:#777}.store-contact-card strong{display:block;margin-top:3px}.store-social-row{display:grid;grid-template-columns:1fr 1fr;gap:10px}.store-social-row button{height:48px;border:0;border-radius:12px;background:#fff;font-weight:700;box-shadow:0 2px 12px rgba(0,0,0,.05)}.store-hours-card{display:flex;align-items:center;justify-content:space-between;padding:16px}.store-hours-card strong{font-size:15px}.store-text-card{padding:18px}.store-text-card h3{margin-top:0}.store-text-card p{color:#555;line-height:1.5}
'''

hp.write_text(h,encoding='utf-8')
cp.write_text(c,encoding='utf-8')

# Validate expected final shape before workflow commit.
assert 'member-shortcuts' not in h
assert 'renderMemberCard' not in h
assert 'renderQrView' not in h
assert 'data-info-tab="about"' in h
assert 'profile-simple-actions' in h
assert '<i>🍕</i>' in h
