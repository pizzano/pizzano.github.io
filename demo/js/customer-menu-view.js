/* Customer menu view: pure menu grouping, icons and product card HTML.
 * Firebase state, category events and cart mutation remain in customer.js.
 * These render helpers accept explicit dependencies to avoid hidden listeners.
 */
import { escapeHtml } from './customer-format.js';
import { productImageSources } from './product-images.js';

/** Alle blokker som vises i menylisten, i rekkefølge. */
export function buildMenuBlocks({ favorites, popularItemIds, sections, findItem, visibleItems }) {
  const blocks = [];

  const favItems = favorites
    .map((id) => findItem(id))
    .filter(({ item }) => item && visibleItems({ items: [item] }).length);
  if (favItems.length) {
    blocks.push({
      key: 'favorites',
      title: 'Mine favoritter',
      note: 'Produktene du har markert',
      items: favItems,
    });
  }

  const popularItems = (popularItemIds || [])
    .map((id) => findItem(id))
    .filter(({ item }) => item && visibleItems({ items: [item] }).length);
  if (popularItems.length) {
    blocks.push({
      key: 'popular',
      title: 'Mest bestilt',
      note: 'Gjestenes favoritter',
      items: popularItems,
    });
  }

  for (const section of sections || []) {
    const items = visibleItems(section);
    if (!items.length) continue;
    blocks.push({
      key: section.id,
      title: section.title,
      note: section.note,
      items: items.map((item) => ({ item, section })),
    });
  }
  return blocks;
}

export function categoryIcon(block) {
  const title = String(block?.title || '').toLocaleLowerCase('no');
  const icons = {
    favorites: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>',
    popular: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3l-5.6 2.9 1.1-6.2L3 9.6l6.2-.9Z"/>',
    pizza: '<path d="M5 3c5-1 10 1 14 5L5 21Z M5 7c4-1 7 1 11 4"/><circle cx="8" cy="10" r="1"/><circle cx="11" cy="13" r="1"/><circle cx="7" cy="16" r="1"/>',
    kebab: '<path d="m6 8 7 13 8-7L8 5Z M6 8l-2-3 4-3 3 3 M12 8l4-4m-1 7 5-3M9 12l3-3m0 8 3-3"/>',
    burger: '<path d="M4 10a8 8 0 0 1 16 0Z M3 13h18M4 16h16v2a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3Z M8 7h.01M12 5h.01M16 7h.01"/>',
    drink: '<path d="M6 7h12l-2 14H8Z M5 7h14M12 7l2-5h4"/>',
    children: '<circle cx="12" cy="12" r="9"/><path d="M8 14a4 4 0 0 0 8 0M8 9h.01M16 9h.01"/>',
    vegetarian: '<path d="M20 3C9 2 4 6 5 13c1 5 7 6 11 2 3-3 4-7 4-12Z M4 21 16 8M9 16v-5m0 5h5"/>',
    meal: '<circle cx="14" cy="12" r="7"/><path d="M2 3v5a2 2 0 0 0 4 0V3M4 3v18M22 3v18"/>',
  };
  const key = block?.key === 'favorites' ? 'favorites' : block?.key === 'popular' ? 'popular'
    : title.includes('pizza') ? 'pizza' : title.includes('kebab') ? 'kebab'
    : title.includes('burger') ? 'burger' : title.includes('drikk') ? 'drink'
    : title.includes('barn') ? 'children' : title.includes('veget') ? 'vegetarian' : 'meal';
  return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${icons[key]}</svg>`;
}


export function renderProductCard(item, section, { getItemBasePrice, getItemOptionGroups, getItemIngredientRules, allergenLabels, formatPrice, productCartBadgeHtml, ingredientCustomizationEnabled, showAllergens }) {
  const soldOut = item.soldOut;
  const price = getItemBasePrice(item);
  const multi = (item.sizes || []).length > 1;
  const needsChoice =
    multi ||
    getItemOptionGroups(item).length > 0 ||
    (ingredientCustomizationEnabled &&
      getItemIngredientRules(item).some((rule) => rule.removable));
  const desc = item.description || item.ingredients || section.note || '';
  const cardAllergens = showAllergens ? allergenLabels(item) : [];
  const thumbnail = productImageSources(item.imageUrl, 'menu');
  const responsiveAttrs = thumbnail.srcset
    ? ` srcset="${escapeHtml(thumbnail.srcset)}" sizes="${escapeHtml(thumbnail.sizes)}"`
    : '';
  return `
    <div class="prod-card${soldOut ? ' is-soldout' : ''}" data-item="${escapeHtml(item.id)}">
      <div class="prod-media">
        ${
          item.imageUrl
            ? `<img class="prod-thumb" src="${escapeHtml(thumbnail.src)}" alt="${escapeHtml(item.name)}" loading="lazy" decoding="async" width="76" height="76" fetchpriority="low"${responsiveAttrs}>`
            : '<span class="prod-thumb prod-thumb-empty" aria-hidden="true"></span>'
        }
        ${productCartBadgeHtml(item.id)}
      </div>
      <div class="prod-info">
        <p class="prod-name">
          ${escapeHtml(item.name)}
          ${soldOut ? '<span class="tag tag-soldout">Utsolgt</span>' : ''}
        </p>
        <p class="prod-desc">${escapeHtml(desc)}</p>
        ${cardAllergens.length ? `<p class="prod-list-allergens">Inneholder ${escapeHtml(cardAllergens.join(', '))}</p>` : ''}
      </div>
      <div class="prod-side">
        ${soldOut
          ? '<span class="prod-soldout-badge">Utsolgt</span>'
          : needsChoice
            ? `<button class="add-btn is-select" data-open="${escapeHtml(item.id)}" type="button" aria-label="Velg og legg til ${escapeHtml(item.name)}">+</button>`
            : `<button class="add-btn" data-quick-add="${escapeHtml(item.id)}" type="button" aria-label="Legg ${escapeHtml(item.name)} i kurven">+</button>`}
        <p class="prod-price">${multi ? '<small>fra </small>' : ''}${formatPrice(price)}</p>
      </div>
    </div>`;
}
