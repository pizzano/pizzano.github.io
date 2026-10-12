/** Conservative suggestions from Norwegian menu descriptions; never guesses allergens. */
export function detectIngredientRules(description) {
  const vocabulary = ['hvit pizzasaus','pizzasaus','tomatsaus','hvitløkssaus','béarnaisesaus','BBQ-saus','tacosaus','dressing','parmaskinke','pepperoni','skinke','bacon','biffkjøtt','biff','kyllingkjøtt','kylling','kyllingkebab','dönerkebab','kebabkjøtt','blåmuggost','parmesanost','cheddarost','gorgonzola','ost','pestoolje','ruccola','jalapeño','paprika','rødløk','løk','sopp','mais','ananas','soltørkede tomater','tomater','tomat','agurk','salatblanding','salat','nachos','hvitløk','pommes frites','remulade','smør','brød'];
  const text = String(description || '').toLocaleLowerCase('no').replace(/[^.!?]*\beller\b[^.!?]*/g, '');
  const matches = [];
  for (const name of vocabulary) {
    const re = new RegExp(`(?<![\\p{L}])${name}(?![\\p{L}])`, 'giu');
    for (const match of text.matchAll(re)) matches.push({ name, start: match.index, end: match.index + name.length });
  }
  // Prefer full names over overlapping words (e.g. rødløk over løk).
  const seen = new Set();
  return matches.filter(a => !matches.some(b => b !== a && b.start <= a.start && b.end >= a.end && b.end-b.start > a.end-a.start))
    .sort((a,b) => a.start-b.start).filter(a => { const key=a.name.toLocaleLowerCase('no'); if(seen.has(key))return false;seen.add(key);return true; })
    .map(({name}) => ({ name: name[0].toLocaleUpperCase('no')+name.slice(1), removable: true }));
}
