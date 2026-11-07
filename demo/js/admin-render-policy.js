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


/** Apply RTDB Server-Sent Events for diagnostics without re-reading the whole
 * /systemErrors subtree on every timer. Keeps the old snapshot immutable.
 */
export function applyAlertStreamDelta(previous, change, isPatch = false) {
  const base=previous && typeof previous === 'object' && !Array.isArray(previous)
    ? previous : {};
  const path=String(change?.path || '/');
  if (!path.startsWith('/')) return base;
  const isObject=value=>value && typeof value === 'object' && !Array.isArray(value);
  const put=(snapshot, at, value)=>{
    const segments=at.split('/').filter(Boolean);
    if (!segments.length) return isObject(value) ? value : {};
    const result={...snapshot};
    let node=result;
    for (const name of segments.slice(0,-1)) {
      node[name]=isObject(node[name]) ? {...node[name]} : {};
      node=node[name];
    }
    const last=segments.at(-1);
    if (value === null) delete node[last];
    else node[last]=value;
    return result;
  };
  if (!isPatch || !isObject(change?.data)) return put(base,path,change?.data);
  // RTDB patch objects update children, including nested /read and /resolved
  // fields, without replacing other information about the alert.
  const patchField=(snapshot, at, value)=>{
    if (!isObject(value)) return put(snapshot,at,value);
    let updated=snapshot;
    for (const [key,child] of Object.entries(value)) {
      updated=patchField(updated,at.replace(/\/$/,'') + '/' + key,child);
    }
    return updated;
  };
  return patchField(base,path,change.data);
}
