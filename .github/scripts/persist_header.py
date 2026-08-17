from pathlib import Path
import re

hp = Path('test/test.html')
cp = Path('test/test.css')
h = hp.read_text(encoding='utf-8')
c = cp.read_text(encoding='utf-8')

old = "function openScreen(id){$$('.screen').forEach(x=>x.hidden=true);$('#'+id).hidden=false;document.body.classList.toggle('kol-top-back-active',!['accountScreen','infoScreen'].includes(id))}"
new = "function openScreen(id){$$('.screen').forEach(x=>x.hidden=true);$('#'+id).hidden=false;document.body.classList.remove('kol-top-back-active')}"
assert old in h, 'openScreen signature not found'
h = h.replace(old, new, 1)
h = re.sub(r'test\.css\?v=[^\"\']+', 'test.css?v=persistent-header-20260818-0002', h, count=1)

screen_old = r"\.screen\{position:fixed;z-index:100;inset:0;left:50%;transform:translateX\(-50%\);width:min\(100vw,var\(--app\)\);background:#fff;display:flex;flex-direction:column\}"
screen_new = ".screen{position:fixed;z-index:100;top:var(--head);bottom:0;left:50%;transform:translateX(-50%);width:min(100vw,var(--app));background:#fff;display:flex;flex-direction:column}"
c, n = re.subn(screen_old, screen_new, c, count=1)
assert n == 1, 'base screen rule not found'

head_old = r"\.screen-head\{[^}]*\}"
head_new = ".screen-head{min-height:58px;display:flex;align-items:center;gap:10px;padding:0 12px;border-bottom:1px solid var(--line);background:#fff;color:var(--txt);position:sticky;top:0;z-index:3}"
c, n = re.subn(head_old, head_new, c, count=1)
assert n == 1, 'screen head rule not found'

# Keep the orange app header visually above all changing content.
c += "\n.appbar{position:relative;z-index:300}.screen:not(.account-sheet):not(.info-sheet){border-top:1px solid var(--line)}\n"

hp.write_text(h, encoding='utf-8')
cp.write_text(c, encoding='utf-8')
