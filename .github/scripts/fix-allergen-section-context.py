from pathlib import Path

path = Path("test/index.html")
text = path.read_text(encoding="utf-8")
old = '    else if (typeof isPizzaItem === "function" && isPizzaItem(item)) source = "Melk, Hvete";'
new = '    else if (String(item?._sourceSectionId || item?.sectionId || "").toLowerCase() === "pizza" || String(item?.type || "").toLowerCase() === "pizza") source = "Melk, Hvete";'

count = text.count(old)
if count != 1:
    raise SystemExit(f"Expected exactly one allergen pizza fallback line, found {count}")

path.write_text(text.replace(old, new, 1), encoding="utf-8")
print("Fixed allergen pizza detection to use the product's own section instead of selectedSection")
