/**
 * Shared, safe SVG icon set for the BETA storefront.
 * Categories may declare `iconKey` or `icon` in Firebase, e.g.:
 * sections/{sectionId}/iconKey = "vegetarian"
 * Future BETA admin edits the Firebase field; no page code changes needed.
 *
 * Only these pre-defined SVG shapes are rendered. Never render raw SVG/HTML
 * supplied from a public Firebase field.
 */
const paths = Object.freeze({
  search:'<circle cx="11" cy="11" r="6"/><path d="M16 16l4 4"/>',
  popular:'<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3l-5.6 2.9 1.1-6.2L3 9.6l6.2-.9Z"/>',
  pizza:'<path d="M5 3c5-1 10 1 14 5L5 21Z M5 7c4-1 7 1 11 4"/><circle cx="8" cy="10" r="1"/><circle cx="11" cy="13" r="1"/><circle cx="7" cy="16" r="1"/>',
  kebab:'<path d="m6 8 7 13 8-7L8 5Z M6 8l-2-3 4-3 3 3 M12 8l4-4m-1 7 5-3M9 12l3-3m0 8 3-3"/>',
  burger:'<path d="M4 10a8 8 0 0 1 16 0Z M3 13h18M4 16h16v2a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3Z M8 7h.01M12 5h.01M16 7h.01"/>',
  drink:'<path d="M6 7h12l-2 14H8Z M5 7h14M12 7l2-5h4"/>',
  children:'<circle cx="12" cy="12" r="9"/><path d="M8 14a4 4 0 0 0 8 0M8 9h.01M16 9h.01"/>',
  vegetarian:'<path d="M20 3C9 2 4 6 5 13c1 5 7 6 11 2 3-3 4-7 4-12Z M4 21 16 8M9 16v-5m0 5h5"/>',
  meal:'<circle cx="14" cy="12" r="7"/><path d="M2 3v5a2 2 0 0 0 4 0V3M4 3v18M22 3v18"/>',
  trash:'<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 10v7M14 10v7"/>',
  edit:'<path d="M13 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7"/><path d="m12 16-4 1 1-4L17.9 4.1a2.1 2.1 0 0 1 3 3L12 16Z"/><path d="m16 6 3 3"/>',
  user:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  phone:'<path d="M7 3H4.5A2 2 0 0 0 2.5 5.2 18 18 0 0 0 18.8 21.5 2 2 0 0 0 21 19.5V17l-5-2.2-2.4 2.2a16 16 0 0 1-6.6-6.6L9.2 8z"/>',
  mail:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 7 9-7"/>',
  store:'<path d="M3 9V5h18v4l-1 3a3 3 0 0 1-4 1 3 3 0 0 1-4 0 3 3 0 0 1-4 0 3 3 0 0 1-4-1L3 9Z"/><path d="M5 13v8h14v-8M10 21v-6h4v6"/>',
  orders:'<path d="M6 3h12v18H6zM9 8h6m-6 4h6m-6 4h4"/>',
  chevron:'<path d="m9 5 7 7-7 7"/>',
});
const aliases=Object.freeze({
  utensils:'meal',restaurant:'meal',food:'meal',other:'meal',cutlery:'meal',
  salad:'vegetarian',leaf:'vegetarian',vegan:'vegetarian',
  baby:'children',kids:'children',child:'children',
  beverage:'drink',drikke:'drink',drinks:'drink',
  star:'popular',best:'popular',delete:'trash',bin:'trash'
});
const resolveKey=value=>{
 const key=String(value??'').trim().toLowerCase().replace(/[^a-z0-9_-]/g,'');
 const candidate=aliases[key]||key;
 return Object.hasOwn(paths,candidate)?candidate:null;
};
export function resolveCategoryIcon(value,title=''){
 const explicit=resolveKey(value);
 if(explicit)return explicit;
 const normalized=String(title).toLocaleLowerCase('nb-NO');
 if(normalized.includes('pizza'))return 'pizza';
 if(normalized.includes('kebab'))return 'kebab';
 if(normalized.includes('burger'))return 'burger';
 if(normalized.includes('drikk')||normalized.includes('beverage'))return 'drink';
 if(normalized.includes('barn')||normalized.includes('kids'))return 'children';
 if(normalized.includes('veget')||normalized.includes('vegan'))return 'vegetarian';
 return 'meal';
}
export function iconSvg(key,cssClass=''){
 const safe=resolveKey(key)||'meal';
 const cls=String(cssClass??'').replace(/[^a-z0-9_-]/gi,'');
 return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"'+(cls?' class="'+cls+'"':'')+'>'+paths[safe]+'</svg>';
}
export const availableCategoryIcons=Object.freeze(['pizza','kebab','burger','meal','drink','children','vegetarian','popular']);
