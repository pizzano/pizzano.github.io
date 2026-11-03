/* Admin-only DOM render decisions. Firebase streams and mutations stay in
 * data.js; the clock, alarms, printing, and direct user actions are untouched.
 */
export function adminDataSignatures(state) {
  return {
    menu: JSON.stringify([
      state.sections || [], state.optionGroups || [], state.allergenCatalog || [],
      state.popularItemIds || [], state.settings || {}, state.updatedAt || 0,
    ]),
    orders: JSON.stringify(state.orders || []),
  };
}

/* Explicit navigation and local input must always redraw their requested view.
 * For Firebase-only changes, redraw just the affected visible section. */
export function adminRenderChanges(previous, next, origin = 'manual') {
  if (!previous || origin !== 'remote') {
    return { menu: true, orders: true, stats: true };
  }
  const menu = previous.menu !== next.menu;
  const orders = previous.orders !== next.orders;
  return { menu, orders, stats: menu || orders };
}

/* Avoid replacing unchanged cards/lists: keeps scroll, DOM images and focus. */
export function createMarkupUpdater() {
  const markupByNode = new WeakMap();
  return (node, html) => {
    if (!node) return false;
    if (markupByNode.get(node) === html) return false;
    node.innerHTML = html;
    markupByNode.set(node, html);
    return true;
  };
}
