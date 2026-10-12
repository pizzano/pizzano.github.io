import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source=readFileSync(new URL('../js/ingredient-detection.js',import.meta.url));
const {detectIngredientRules}=await import('data:text/javascript;base64,'+source.toString('base64'));
test('Extracts Norwegian ingredients in order, preserves compounds and removes duplicates',()=>assert.deepEqual(detectIngredientRules('Biff, rødløk, hvitløkssaus, BBQ-saus og rødløk.').map(r=>r.name),['Biff','Rødløk','Hvitløkssaus','BBQ-saus']));
test('Does not turn alternatives or promotional copy into ingredients',()=>assert.deepEqual(detectIngredientRules('Skinke eller pepperoni. Du velger drikke ved henting. Bildene er illustrasjonsbilder.'),[]));
test('Recognizes ingredients inside serving descriptions',()=>assert.deepEqual(detectIngredientRules('Marinert kyllingkjøtt, paprika og løk. Serveres med brød og smør.').map(r=>r.name),['Kyllingkjøtt','Paprika','Løk','Brød','Smør']));
