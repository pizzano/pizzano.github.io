/** Hide an automatic removal comment when the view already shows removed ingredients. */
export function getDisplayComment(line) {
  const removed = Array.isArray(line?.removedIngredients) ? line.removedIngredients : [];
  const comment = String(line?.comment || '');
  if (!removed.length) return comment;
  const normalize = value => String(value).trim().replace(/\s+/g, ' ').replace(/\s*,\s*/g, ',').toLocaleLowerCase('no');
  const generated = normalize(`Uten ${removed.join(', ')}`);
  return comment.split('\n').filter(text => normalize(text.replace(/^\s*uten\s*:\s*/i, 'Uten ')) !== generated).join('\n').trim();
}
