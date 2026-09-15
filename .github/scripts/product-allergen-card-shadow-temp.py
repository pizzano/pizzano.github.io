from pathlib import Path
import re

# Move Allergener to the bottom of the product sheet, after kitchen comment.
js_path = Path('demo/js/customer.js')
js = js_path.read_text(encoding='utf-8')
allergen_start = js.find('    <div class="sheet-allergens" aria-label="Allergener">')
comment_marker = '    <div class="opt-group">\n      <div class="opt-head"><h3 class="opt-title">Kommentar til kjøkkenet</h3></div>'
comment_start = js.find(comment_marker, allergen_start)
if allergen_start < 0 or comment_start < 0:
    raise SystemExit('Could not locate product allergen/comment blocks')
allergen_block = js[allergen_start:comment_start]
comment_end = js.find('    </div>`;', comment_start)
if comment_end < 0:
    raise SystemExit('Could not locate end of kitchen comment block')
comment_end += len('    </div>')
comment_block = js[comment_start:comment_end]
js = js[:allergen_start] + comment_block + '\n' + allergen_block.rstrip() + js[comment_end:]
js_path.write_text(js, encoding='utf-8')

# Style allergens like a clean soft card and give menu products visible separation/shadow.
css_path = Path('demo/css/customer.css')
css = css_path.read_text(encoding='utf-8')
marker = '/* Product allergen bottom + menu card shadow 2026-09-15 */'
if marker in css:
    css = css.split(marker)[0].rstrip() + '\n'
css += r'''

/* Product allergen bottom + menu card shadow 2026-09-15 */
.sheet-allergens {
  margin: 12px 0 4px !important;
  padding: 13px 14px !important;
  border: 1px solid #eadfd3 !important;
  border-radius: 18px !important;
  background: #fffaf5 !important;
  display: grid !important;
  gap: 9px !important;
  box-shadow: none !important;
}
.sheet-allergens::before {
  content: none !important;
  display: none !important;
}
.sheet-allergens-label {
  display: block !important;
  margin: 0 !important;
  color: #211a16 !important;
  font-size: 13px !important;
  line-height: 1.2 !important;
  font-weight: 800 !important;
}
.sheet-allergen-chips {
  display: flex !important;
  flex-wrap: wrap !important;
  align-items: center !important;
  gap: 7px !important;
}
.sheet-allergen-chip,
.sheet-allergen-none {
  display: inline-flex !important;
  align-items: center !important;
  min-height: 30px !important;
  padding: 5px 10px !important;
  border: 1px solid #ead9ca !important;
  border-radius: 999px !important;
  background: #fff8f1 !important;
  color: #76523f !important;
  font-size: 11.5px !important;
  line-height: 1.15 !important;
  font-weight: 700 !important;
  white-space: nowrap !important;
}

.prod-card {
  border-color: #ebe5df !important;
  box-shadow: 0 8px 22px rgba(41, 29, 22, .10), 0 2px 6px rgba(41, 29, 22, .05) !important;
}
.prod-card:hover {
  box-shadow: 0 12px 28px rgba(41, 29, 22, .12), 0 3px 8px rgba(41, 29, 22, .06) !important;
}

@media (max-width: 560px) {
  .sheet-allergens {
    padding: 12px !important;
    border-radius: 16px !important;
  }
  .sheet-allergens-label { font-size: 12.5px !important; }
  .sheet-allergen-chip,
  .sheet-allergen-none {
    min-height: 28px !important;
    padding: 4px 9px !important;
    font-size: 11px !important;
  }
  .prod-card {
    box-shadow: 0 7px 18px rgba(41, 29, 22, .09), 0 2px 5px rgba(41, 29, 22, .05) !important;
  }
}
'''
css_path.write_text(css, encoding='utf-8')

# Bust customer stylesheet cache.
index_path = Path('demo/index.html')
index = index_path.read_text(encoding='utf-8')
index = re.sub(r'/demo/css/customer\.css\?v=[^"\']+', '/demo/css/customer.css?v=20260915-productpolish1', index)
index_path.write_text(index, encoding='utf-8')

# Refresh service worker cache.
sw_path = Path('demo/service-worker.js')
sw = sw_path.read_text(encoding='utf-8')
sw = re.sub(r"const CACHE_NAME = 'kol-demo-v\d+';", "const CACHE_NAME = 'kol-demo-v39';", sw)
sw_path.write_text(sw, encoding='utf-8')
