from pathlib import Path
import re

index_path = Path('test/index.html')
css_path = Path('test/kol-core.css')
index = index_path.read_text(encoding='utf-8')
css = css_path.read_text(encoding='utf-8')

index = index.replace('kol-core.css?v=mobile-v32', 'kol-core.css?v=mobile-v33', 1)

# Remove versioned status class names now that the design is part of the normal UI.
index = index.replace('status-v31-', 'live-status-').replace('status-v31', 'live-status')
css = css.replace('status-v31-', 'live-status-').replace('status-v31', 'live-status')

# Keep only one allergen rule: replace the original compact rule with the complete flat style.
old_allergen = 'body.kol-customer .allergen-note{margin:0!important;padding:10px 12px!important;color:var(--muted)!important;font-size:12.5px!important;font-weight:400!important;line-height:1.4!important}'
new_allergen = '''body.kol-customer .allergen-note{width:100%!important;margin:0!important;padding:10px 12px!important;border:0!important;border-top:1px solid var(--line)!important;border-bottom:1px solid var(--line)!important;border-radius:0!important;background:#faf8f5!important;box-shadow:none!important;color:var(--muted)!important;font-size:12.5px!important;font-weight:400!important;line-height:1.4!important}'''
if old_allergen in css:
    css = css.replace(old_allergen, new_allergen, 1)

# Remove the later duplicate multiline allergen rule that was only needed during the transition.
css = re.sub(
    r'\nbody\.kol-customer \.allergen-note\{\n\s*width:100%!important;.*?\n\}\n(?=body\.kol-customer \.profile-order-card\.is-expanded)',
    '\n',
    css,
    count=1,
    flags=re.S,
)

index_path.write_text(index, encoding='utf-8')
css_path.write_text(css, encoding='utf-8')
print('finalized UI cleanup v33')
