from pathlib import Path
from urllib.request import urlopen

p=Path('test/test.css')
s=p.read_text(encoding='utf-8')
legacy_url='https://cdn.jsdelivr.net/gh/pizzano/pizzano.github.io@002212ee5ec86ae0ade29426cdadc846750d2d13/test/kol-core.css'
legacy=urlopen(legacy_url, timeout=30).read().decode('utf-8')

marker='@layer mobile {'
start=s.find(marker)
if start < 0:
    raise SystemExit('mobile layer marker missing')
body_start=start+len(marker)
# Match the closing brace for @layer mobile.
depth=1
i=body_start
while i < len(s) and depth:
    if s[i]=='{': depth+=1
    elif s[i]=='}': depth-=1
    i+=1
if depth:
    raise SystemExit('unclosed mobile layer')
mobile=s[body_start:i-1].strip()
rest=s[i:].strip()

# Keep only self-contained CSS: legacy base first, then mobile overrides,
# then test-specific styles/overrides. No imports or cascade layers.
out='''/* KØL LocalStorage test – self-contained stylesheet.\n   All styles needed by test.html live in this file. */\n\n'''
out+=legacy.rstrip()+'\n\n/* ===== customer/mobile overrides ===== */\n'+mobile+'\n\n'+rest+'\n'
# Defensive removal if an import/layer line sneaked in.
lines=[]
for line in out.splitlines():
    st=line.strip()
    if st.startswith('@import ') or st.startswith('@layer mobile,legacy'):
        continue
    lines.append(line)
out='\n'.join(lines).rstrip()+'\n'

if '@import ' in out:
    raise SystemExit('import remains')
if '@layer mobile,legacy' in out:
    raise SystemExit('layer declaration remains')
if 'content:none!important' not in out:
    raise SystemExit('back chevron override missing')
p.write_text(out,encoding='utf-8')
