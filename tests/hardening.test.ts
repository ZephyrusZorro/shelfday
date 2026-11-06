import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyOperation, emptyKitchen, validateKitchen } from '../lib/engine.ts';
import { backupText, parseBackup, activityCsv } from '../lib/export.ts';
import { sampleKitchen } from '../lib/demo.ts';

let seq = 0;
const run = (state: any, type: string, payload: any) => applyOperation(state, { id: `hard-${++seq}`, date: '2026-11-06', type, payload });
function rice() {
  let s = run(emptyKitchen(), 'ingredient', { id: 'rice', name: 'Rice', unit: 'g', par: 0 });
  return run(s, 'recipe', { id: 'bowl', name: 'Bowl', category: 'Kitchen', price: 50, target: 1, ingredients: [{ ingredientId: 'rice', quantity: 100 }] });
}
test('later costly prep does not average in already sold portions when valuing waste', () => {
  let s = rice();
  s = run(s, 'receive', { id: 'cheap', ingredientId: 'rice', quantity: 100, totalCost: 1, useBy: '2026-11-06', reference: '' });
  s = run(s, 'prepare', { recipeId: 'bowl', quantity: 1 }); s = run(s, 'sell', { recipeId: 'bowl', quantity: 1 });
  s = run(s, 'receive', { id: 'costly', ingredientId: 'rice', quantity: 100, totalCost: 10, useBy: '2026-11-06', reference: '' });
  s = run(s, 'prepare', { recipeId: 'bowl', quantity: 1 }); s = run(s, 'portionWaste', { recipeId: 'bowl', quantity: 1, reason: 'Unsold' });
  assert.equal(s.events.at(-1)!.costCents, 1000);
  assert.equal(s.days[0].items[0].remainingCostCents, 0);
});
test('repeated single-portion waste conserves all acquisition cents', () => {
  let s = rice();
  s = run(s, 'receive', { id: 'penny', ingredientId: 'rice', quantity: 300, totalCost: 0.01, useBy: '2026-11-06', reference: '' });
  s = run(s, 'prepare', { recipeId: 'bowl', quantity: 3 });
  for (let i = 0; i < 3; i++) s = run(s, 'portionWaste', { recipeId: 'bowl', quantity: 1, reason: 'Unsold' });
  assert.equal(s.events.filter(e => e.type === 'portionWaste').reduce((sum, e) => sum + e.costCents, 0), 1);
});
test('all downloadable backups below the storage cap remain below the import cap', () => {
  const s = emptyKitchen();
  for (let i = 0; i < 6000; i++) s.events.push({ id: `e${i}`, operationId: `e${i}`, date: '2026-11-06', type: 'settings', label: 'Settings updated '.repeat(3), quantity: 0, unit: '', costCents: 0, revenueCents: 0, reason: '' });
  const compactSize = new TextEncoder().encode(JSON.stringify(s)).length;
  assert.ok(compactSize <= 1_500_000, `${compactSize}`);
  const text = backupText(s);
  assert.ok(new TextEncoder().encode(text).length <= 1_800_000);
  assert.deepEqual(parseBackup(text), s);
});
test('restore never produces a kitchen that its own reader rejects', () => {
  const s = emptyKitchen(); s.operationIds = Array.from({ length: 15000 }, (_, i) => `op${i}`);
  assert.throws(() => run(emptyKitchen(), 'replace', s));
});
test('backup roundtrip, malformed format, and CSV spreadsheet formulas', () => {
  const s = sampleKitchen('2026-11-06');
  assert.deepEqual(parseBackup(backupText(s)), s);
  assert.throws(() => parseBackup('{"format":"other","version":1}'));
  s.events[0].label = '=HYPERLINK("bad")';
  assert.ok(activityCsv(s).includes('"\'=HYPERLINK(""bad"")"'));
});
test('future receipts cannot satisfy an earlier prep request', () => {
  let s = rice();
  s = applyOperation(s, { id: 'future-receipt', date: '2026-11-07', type: 'receive', payload: { id: 'future', ingredientId: 'rice', quantity: 1000, totalCost: 100, useBy: '2026-11-09', reference: '' } });
  assert.throws(() => run(s, 'prepare', { recipeId: 'bowl', quantity: 1 }), /short/i);
});
test('repeated raw-stock waste conserves all acquisition cents', () => {
  let s = rice();
  s = run(s, 'receive', { id: 'penny-stock', ingredientId: 'rice', quantity: 300, totalCost: 0.01, useBy: '2026-11-06', reference: '' });
  for (let i = 0; i < 3; i++) s = run(s, 'stockWaste', { lotId: 'penny-stock', quantity: 100, reason: 'Spoiled' });
  assert.equal(s.events.filter(e => e.type === 'stockWaste').reduce((sum, e) => sum + e.costCents, 0), 1);
});
