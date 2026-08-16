from pathlib import Path

p = Path('.github/scripts/order-system-hardening-20260817.py')
s = p.read_text(encoding='utf-8')

# 0) Function signatures can contain default object literals, e.g.
# function foo(options = {}). The original helper searched for the first "{"
# after the function name and could mistake that default literal for the body.
old_parser = '    brace = text.find("{", match.start())\n'
new_parser = '    brace = match.end() - 1\n'
if old_parser not in s:
    raise SystemExit('function parser line not found')
s = s.replace(old_parser, new_parser, 1)

# 1) normalizeConfig must no longer depend on the removed embedded catalog.
needle = '''admin, removed_catalogs = re.subn(r'<script id="kol-embedded-menu-catalog">.*?</script>\\s*', '', admin, count=1, flags=re.S)\nif removed_catalogs != 1:\n    raise SystemExit(f"embedded menu catalog removal: expected 1, got {removed_catalogs}")\n'''
replacement = needle + '''\nadmin = admin.replace(\n    '  const catalogResult = window.KOLMenuCatalog?.upgrade(value || {});\\n  const source = catalogResult?.config || value || {};',\n    '  const source = value || {};',\n    1\n)\n'''
if needle not in s:
    raise SystemExit('embedded catalog removal block not found')
s = s.replace(needle, replacement, 1)

# 2) Defensive cleanup for any historical direct /current write that survives a
# future source-layout change. With the parser fix above this should normally be
# a no-op, but it keeps the migration invariant explicit.
needle2 = '''admin = replace_function(admin, "enqueueIceSmsJob", '''
pos = s.find(needle2)
if pos < 0:
    raise SystemExit('enqueue replacement block not found')
marker = '''# Promote the next queued job whenever the old consumer clears/completes current.'''
end = s.find(marker, pos)
if end < 0:
    raise SystemExit('enqueue end marker not found')
insert = '''\nadmin = admin.replace(\n    '    await iceSmsCurrentRef.set(job);\\n',\n    '    // Direct current-slot overwrite removed; the job is already queued above.\\n',\n)\n\n'''
s = s[:end] + insert + s[end:]

# 3) The consolidated CSS marker should not itself contain an @layer token.
s = s.replace(
    '/* Customer/mobile overrides (formerly @layer mobile). */',
    '/* Customer/mobile overrides from the former layered stylesheet. */'
)

p.write_text(s, encoding='utf-8')
print('remaining hardening migration leftovers patched')
