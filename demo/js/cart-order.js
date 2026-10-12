/** Follow menu category order; keep addition order within each category. */
export function sortCartByCategory(lines, sections) {
  const rank = new Map();
  (sections || []).forEach((section, index) => {
    for (const item of section.items || []) rank.set(item.id, index);
  });
  return [...(lines || [])].sort((a, b) =>
    (rank.get(a.itemId) ?? Infinity) - (rank.get(b.itemId) ?? Infinity));
}
