from pathlib import Path
import re

root_admin=Path('admin.html')
test_admin=Path('test/admin-panel.html')
index_path=Path('test/index.html')
css_path=Path('test/kol-core.css')


def match_brace(src, pos):
    d=0;i=pos;state='c';q=''
    while i<len(src):
        c=src[i];n=src[i+1] if i+1<len(src) else ''
        if state=='lc':
            if c=='\n': state='c'
            i+=1;continue
        if state=='bc':
            if c=='*' and n=='/': state='c';i+=2;continue
            i+=1;continue
        if state=='s':
            if c=='\\': i+=2;continue
            if c==q: state='c'
            i+=1;continue
        if state=='t':
            if c=='\\': i+=2;continue
            if c=='`': state='c'
            i+=1;continue
        if c=='/' and n=='/': state='lc';i+=2;continue
        if c=='/' and n=='*': state='bc';i+=2;continue
        if c in ('"',"'"): state='s';q=c;i+=1;continue
        if c=='`': state='t';i+=1;continue
        if c=='{': d+=1
        elif c=='}':
            d-=1
            if d==0:return i
        i+=1
    return -1


def remove_function(src,name):
    m=re.search(rf'(?m)^[ \t]*(?:async\s+)?function\s+{re.escape(name)}\s*\(',src)
    if not m:return src
    a=m.start();b0=src.find('{',m.end());b=match_brace(src,b0)
    if b<0:raise RuntimeError('bad function '+name)
    b+=1
    while b<len(src) and src[b] in ' \t\r\n':b+=1
    return src[:a]+src[b:]


def remove_if(src,marker):
    while marker in src:
        a=src.find(marker);b0=src.find('{',a);b=match_brace(src,b0)
        if b<0:raise RuntimeError('bad if '+marker)
        ls=src.rfind('\n',0,a)+1
        if not src[ls:a].strip():a=ls
        b+=1
        while b<len(src) and src[b] in ' \t\r\n':b+=1
        src=src[:a]+src[b:]
    return src


def remove_div(src,marker):
    a=src.find(marker)
    if a<0:return src
    pat=re.compile(r'</?div\b[^>]*>',re.I);d=0
    for m in pat.finditer(src,a):
        t=m.group(0)
        if t.startswith('</'):d-=1
        elif not t.rstrip().endswith('/>'):d+=1
        if d==0:
            b=m.end()
            while b<len(src) and src[b] in ' \t\r\n':b+=1
            return src[:a]+src[b:]
    raise RuntimeError('bad backup div')

# Remove backup system from the root admin that still contained it.
a=root_admin.read_text(encoding='utf-8')
a=re.sub(r'\s*<button\b[^>]*data-top-nav=["\']backup["\'][^>]*>.*?</button>\s*','\n',a,flags=re.I|re.S)
a=remove_div(a,'<div class="settings-page backup-settings-page"')
a=re.sub(r'(?m)^\s*const\s+(?:downloadBackupButton|saveLocalBackupButton|localBackupList|restoreBackupFile|restoreBackupPreview|restoreBackupNowButton)\s*=.*?;\s*\n?','',a)
a=re.sub(r'(?m)^\s*let\s+pendingRestoreData\s*=.*?;\s*\n?','',a)
a=re.sub(r'(?m)^\s*const\s+(?:LOCAL_BACKUP_KEY|DAILY_LOCAL_BACKUP_DATE_KEY)\s*=.*?;\s*\n?','',a)
funcs=re.findall(r'\b(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(',a)
remove={n for n in funcs if 'backup' in n.lower()}
remove.update({'downloadTextFile','countBackupData','extractBackupData','localDayStamp','previewRestoreData','restoreDataToFirebase'})
for n in sorted(remove,key=len,reverse=True):a=remove_function(a,n)
for marker in ['if (downloadBackupButton)','if (saveLocalBackupButton)','if (restoreBackupFile)','if (restoreBackupNowButton)','if (localBackupList)']:
    a=remove_if(a,marker)
a=re.sub(r'(?m)^\s*renderLocalBackups\(\);\s*\n?','',a)
a=re.sub(r'(?m)^\s*maybeDailyLocalBackupOnAdminOpen\(\);\s*\n?','',a)
a=re.sub(r'(?m)^\s*backup:\s*\[[^\n]*\],?\s*\n?','',a)
a=re.sub(r'(?m)^\s*//[^\n]*(?:yedek|backup|sikkerhetskopi|gjenopprett)[^\n]*\n?','',a,flags=re.I)
a=re.sub(r'\n{3,}','\n\n',a)
root_admin.write_text(a,encoding='utf-8')

# Remove safely unreachable declared functions from customer index.
i=index_path.read_text(encoding='utf-8')
i=re.sub(r'<!--.*?-->','',i,flags=re.S)
protected={'defaultSiteSettings','fetchFirebaseMenuConfig','renderMenu','renderCart','openProduct','closeProductModal','submitOrder','loadMenu','renderProfileOrders'}
for _ in range(4):
    names=re.findall(r'\b(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(',i);dead=[]
    for n in names:
        if n not in protected and len(re.findall(rf'\b{re.escape(n)}\b',i))==1:dead.append(n)
    if not dead:break
    for n in dead:i=remove_function(i,n)
i=re.sub(r'\n{3,}','\n\n',i)
index_path.write_text(i,encoding='utf-8')

# CSS: remove backup-only rules and force a single compact customer layout.
c=css_path.read_text(encoding='utf-8')
c=re.sub(r'/\*.*?\*/','',c,flags=re.S)
# Dedicated backup rules (including shared selectors) are removed conservatively.
c=re.sub(r'[^{}]*(?:backup-grid|backup-box|restore-preview|local-backup-list)[^{}]*\{[^{}]*\}','',c,flags=re.I)
c=c.replace('padding: 13px max(18px, calc((100vw - 1180px) / 2 + 20px)) !important;','padding:12px 14px!important;')
c=c.replace('width: min(1180px, 100%) !important;','width:min(760px,100%)!important;')
c=c.replace('grid-template-columns: repeat(2, minmax(0, 1fr)) !important;','grid-template-columns:1fr!important;')
compact='''html:has(body.kol-customer){background:#ebe8e1!important}body.kol-customer{width:min(100%,760px)!important;max-width:760px!important;min-width:320px!important;min-height:100dvh!important;margin:0 auto!important;overflow-x:hidden!important}body.kol-customer .appbar{width:100%!important;max-width:760px!important;min-height:88px!important;margin:0 auto!important;padding:12px 14px!important}body.kol-customer .menu-shell{width:100%!important;max-width:760px!important;min-height:calc(100dvh - 88px)!important;margin:0 auto!important;padding:22px 14px 118px!important;box-shadow:none!important}body.kol-customer .category-tabs-wrap{top:88px!important;margin-inline:-14px!important;padding-inline:14px!important}body.kol-customer .menu-list{display:grid!important;grid-template-columns:1fr!important}body.kol-customer .menu-row{width:100%!important;grid-template-columns:88px minmax(0,1fr) 62px!important;gap:11px!important}body.kol-customer .menu-row>.food-thumb,body.kol-customer .menu-row>[class*="thumb"]{width:88px!important;min-width:88px!important;height:92px!important}body.kol-customer .product-modal,body.kol-customer .info-modal,body.kol-customer .profile-modal,body.kol-customer .order-live-modal,body.kol-customer .cart-modal{align-items:flex-end!important;padding:0!important}body.kol-customer .product-panel,body.kol-customer .info-panel,body.kol-customer .profile-panel,body.kol-customer .order-live-panel,body.kol-customer .cart-panel{width:100%!important;max-width:760px!important;max-height:96dvh!important;border-radius:20px 20px 0 0!important}body.kol-customer .cart-panel{height:96dvh!important}body.kol-customer .checkout-grid,body.kol-customer .pickup-options{grid-template-columns:1fr!important}body.kol-customer .product-footer{grid-template-columns:1fr!important;gap:9px!important}'''
c+=compact
c=re.sub(r'\s*\{\s*\}','',c)
css_path.write_text(c,encoding='utf-8')

# Validation
for p in (root_admin,test_admin):
    low=p.read_text(encoding='utf-8').lower()
    for x in ('data-top-nav="backup"','backup-settings-page','downloadbackup','restorebackup','localbackup','local_backup','yedek','sikkerhetskopi','gjenopprett fra json'):
        if x in low:raise RuntimeError(f'{x} remains in {p}')
lowc=css_path.read_text(encoding='utf-8').lower()
for x in ('backup-grid','backup-box','restore-preview','local-backup-list'):
    if x in lowc:raise RuntimeError(x+' remains in css')
if '<style' in index_path.read_text(encoding='utf-8').lower():raise RuntimeError('embedded css')
print('cleanup complete')
