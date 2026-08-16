from pathlib import Path

p = Path('.github/scripts/order-system-hardening-20260817.py')
s = p.read_text(encoding='utf-8')

# 1) normalizeConfig must no longer depend on the removed embedded catalog.
needle = '''admin, removed_catalogs = re.subn(r'<script id="kol-embedded-menu-catalog">.*?</script>\\s*', '', admin, count=1, flags=re.S)\nif removed_catalogs != 1:\n    raise SystemExit(f"embedded menu catalog removal: expected 1, got {removed_catalogs}")\n'''
replacement = needle + '''\nadmin = admin.replace(\n    '  const catalogResult = window.KOLMenuCatalog?.upgrade(value || {});\\n  const source = catalogResult?.config || value || {};',\n    '  const source = value || {};',\n    1\n)\n'''
if needle not in s:
    raise SystemExit('embedded catalog removal block not found')
s = s.replace(needle, replacement, 1)

# 2) replace_function() in the legacy source leaves one direct-current write in
# a trailing compatibility branch. Disable that branch; enqueueIceSmsJob has
# already written the same job to /pending and promoted safely.
needle2 = '''admin = replace_function(admin, "enqueueIceSmsJob", '''
pos = s.find(needle2)
if pos < 0:
    raise SystemExit('enqueue replacement block not found')
marker = '''# Promote the next queued job whenever the old consumer clears/completes current.'''
end = s.find(marker, pos)
if end < 0:
    raise SystemExit('enqueue end marker not found')
insert = '''\n# Defensive cleanup: the historical admin file contains one legacy direct\n# /current write outside the canonical queue block. Never allow it to survive.\nadmin = admin.replace(\n    '    await iceSmsCurrentRef.set(job);\\n',\n    '    // Direct current-slot overwrite removed; the job is already queued above.\\n',\n)\n\n'''
s = s[:end] + insert + s[end:]

# 3) The consolidated CSS marker should not itself contain an @layer token.
s = s.replace(
    '/* Customer/mobile overrides (formerly @layer mobile). */',
    '/* Customer/mobile overrides from the former layered stylesheet. */'
)

p.write_text(s, encoding='utf-8')
print('remaining hardening migration leftovers patched')
