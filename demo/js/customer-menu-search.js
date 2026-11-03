/* Pure menu search: product fields, group options and allergen terms
   are searched with the same Norwegian case folding as the legacy UI. */
export function visibleMenuItems(section, query, getItemOptionGroups, allergenLabels) {
  const needle = String(query || '').trim().toLocaleLowerCase('no');
  return (section.items || []).filter((item) => {
    if (item.hidden) return false;
    if (!needle) return true;
    const sizeLabels = (item.sizes || []).map(size => size.label).join(' ');
    const optionLabels = getItemOptionGroups(item, '*')
      .flatMap(group => [group.title, ...(group.options || []).map(option => option.label)])
      .join(' ');
    const searchText = [
      item.name, item.description, item.ingredients, section.title, section.note,
      sizeLabels, optionLabels, allergenLabels(item).join(' '),
    ].filter(Boolean).join(' ').toLocaleLowerCase('no');
    return searchText.includes(needle);
  });
}
