from pathlib import Path
import re

index_path = Path('test/index.html')
css_path = Path('test/kol-core.css')
index = index_path.read_text(encoding='utf-8')
css = css_path.read_text(encoding='utf-8')

# Cache busting.
index = index.replace('kol-core.css?v=mobile-v31', 'kol-core.css?v=mobile-v32', 1)

# Make the selected-order label explicit.
index = index.replace('<span class="profile-selected-marker">Valgt</span>', '<span class="profile-selected-marker">Valgt bestilling</span>')

# Remove the old versioned patch heading while keeping the working cart logic.
index = re.sub(
    r'/\* ===== V64: deterministic cart actions =====.*?\*/\s*',
    '// Prevent duplicate remove events from one touch/click action.\n',
    index,
    count=1,
    flags=re.S,
)

# Remove redundant broad profile selector.
css = css.replace(
    'body.kol-customer .profile-order-card,body.kol-customer [class*="profile-order-card"],body.kol-customer .recent-order-card',
    'body.kol-customer .profile-order-card,body.kol-customer .recent-order-card'
)

# Merge the separate V31 status layer into the main mobile layer instead of keeping a patch layer.
start_marker = '/* ===== PREMIUM ORDER STATUS V31 ===== */'
end_marker = '/* ===== END PREMIUM ORDER STATUS V31 ===== */'
if start_marker in css:
    marker_start = css.index(start_marker)
    marker_end = css.index(end_marker, marker_start) + len(end_marker)
    wrapped = css[marker_start:marker_end]
    layer_start = wrapped.index('@layer mobile {') + len('@layer mobile {')
    inner_end = wrapped.rfind('\n}')
    if inner_end < layer_start:
        raise SystemExit('Could not parse V31 mobile layer')
    status_rules = wrapped[layer_start:inner_end].strip()
    before = css[:marker_start].rstrip()
    after = css[marker_end:].lstrip()
    if not before.endswith('}'):
        raise SystemExit('Main mobile layer closing brace not found before V31')
    # The last brace immediately before V31 closes the main @layer mobile block.
    before = before[:-1].rstrip()
    css = before + '\n\n' + status_rules + '\n\n' + after

# Main-layer refinements. These are regular rules, not another versioned patch block.
refinements = r'''
body.kol-customer .allergen-note{
  width:100%!important;
  margin:0!important;
  padding:10px 12px!important;
  border:0!important;
  border-top:1px solid var(--line)!important;
  border-bottom:1px solid var(--line)!important;
  border-radius:0!important;
  background:#faf8f5!important;
  box-shadow:none!important;
  color:var(--muted)!important;
}
body.kol-customer .profile-order-card.is-expanded{
  padding:0!important;
  border:0!important;
  border-left:4px solid var(--o)!important;
  border-top:1px solid #efc9b3!important;
  border-bottom:1px solid #efc9b3!important;
  border-radius:0!important;
  background:#fff8f3!important;
  box-shadow:none!important;
}
body.kol-customer .profile-order-card.is-expanded .profile-order-summary{
  width:100%!important;
  margin:0!important;
  padding:14px 12px!important;
  border:0!important;
  border-radius:0!important;
  background:#fff8f3!important;
  box-shadow:none!important;
}
body.kol-customer .profile-order-card.is-expanded .profile-order-details{
  margin:0!important;
  padding:14px 16px 16px!important;
  border:0!important;
  border-top:1px solid #efd9cb!important;
  border-radius:0!important;
  background:#fff!important;
  box-shadow:none!important;
}
body.kol-customer .profile-selected-marker{
  display:inline-flex!important;
  align-items:center!important;
  min-height:22px!important;
  margin:0 0 8px!important;
  padding:0 7px!important;
  border:1px solid #efb894!important;
  border-radius:0!important;
  background:#fff!important;
  color:#d95c1d!important;
  font-size:10.5px!important;
  font-weight:700!important;
  letter-spacing:.08em!important;
  line-height:1!important;
  text-transform:uppercase!important;
}
body.kol-customer .profile-body:has(.profile-order-card.is-expanded) .profile-order-card:not(.is-expanded) .profile-order-summary{
  opacity:.68!important;
}
body.kol-customer .profile-body:has(.profile-order-card.is-expanded) .profile-order-card:not(.is-expanded){
  background:#fbfaf8!important;
}
body.kol-customer .profile-order-card.is-expanded .profile-expand-icon{
  border-color:var(--o)!important;
  background:var(--o)!important;
  color:#fff!important;
}
'''.strip()

# Ensure the primary mobile layer is closed once at EOF after the merged status rules and refinements.
css = css.rstrip()
if css.endswith('}'):
    # After the merge above, the existing final brace belongs to the main mobile layer only if no suffix existed.
    # Insert refinements directly before it.
    css = css[:-1].rstrip() + '\n\n' + refinements + '\n}\n'
else:
    css += '\n\n' + refinements + '\n}\n'

index_path.write_text(index, encoding='utf-8')
css_path.write_text(css, encoding='utf-8')
print('cleaned UI v32')
