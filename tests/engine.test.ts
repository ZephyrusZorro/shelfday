import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyKitchen, applyOperation, validateKitchen } from '../lib/engine.ts';
import { planKitchen } from '../lib/planning.ts';

let sequence = 0;
const op = (state: any, type: string, payload: any, date = '2026-11-06') =>
  applyOperation(state, { id: `test-${++sequence}`, type, date, payload });
function fixture() {
  let s = emptyKitchen();
  s = op(s, 'ingredient', { id: 'flour', name: 'Flour', unit: 'g', par: 1000 });
  s = op(s, 'ingredient', { id: 'milk', name: 'Milk', unit: 'ml', par: 1000 });
  s = op(s, 'receive', { id: 'later', ingredientId: 'flour', quantity: 1000, totalCost: 100, useBy: '2026-11-10', reference: '' }, '2026-10-01');
  s = op(s, 'receive', { id: 'first', ingredientId: 'flour', quantity: 500, totalCost: 50, useBy: '2026-11-06', reference: '' }, '2026-10-01');
  s = op(s, 'receive', { id: 'milk-lot', ingredientId: 'milk', quantity: 1000, totalCost: 200, useBy: '2026-11-07', reference: '' }, '2026-10-01');
  return op(s, 'recipe', { id: 'bun', name: 'Milk bun', category: 'Bakery', price: 30, target: 10, ingredients: [{ ingredientId: 'flour', quantity: 100 }, { ingredientId: 'milk', quantity: 50 }] });
}
test('FEFO consumes earliest date, snapshots cost, and leaves source state unchanged', () => {
  const s = fixture();
  const n = op(s, 'prepare', { recipeId: 'bun', quantity: 6 });
  assert.equal(n.lots.find((l: any) => l.id === 'first')!.remaining, 0);
  assert.equal(n.lots.find((l: any) => l.id === 'later')!.remaining, 900);
  assert.equal(n.days.find((d: any) => d.date === '2026-11-06')!.items[0].costCents, 12000);
  assert.equal(s.lots.find((l: any) => l.id === 'first')!.remaining, 500);
});
test('shortage rejects the whole preparation without partial deductions', () => {
  const s = fixture(); const before = JSON.stringify(s);
  assert.throws(() => op(s, 'prepare', { recipeId: 'bun', quantity: 16 }), /short/i);
  assert.equal(JSON.stringify(s), before);
});
test('expired stock is excluded and cannot be prepared', () => {
  const s = fixture();
  assert.throws(() => op(s, 'prepare', { recipeId: 'bun', quantity: 1 }, '2026-11-08'), /short/i);
});
test('repeated operation id deducts once', () => {
  const s = fixture(); const operation = { id: 'repeat', type: 'prepare', date: '2026-11-06', payload: { recipeId: 'bun', quantity: 3 } };
  const n = applyOperation(s, operation);
  assert.deepEqual(applyOperation(n, operation), n);
});
test('sales and waste reconcile portions and closed days reject further writes', () => {
  let s = op(fixture(), 'prepare', { recipeId: 'bun', quantity: 6 });
  assert.throws(() => op(s, 'sell', { recipeId: 'bun', quantity: 7 }), /remaining/i);
  assert.throws(() => op(s, 'close', {}), /unaccounted/i);
  s = op(s, 'sell', { recipeId: 'bun', quantity: 4 });
  s = op(s, 'portionWaste', { recipeId: 'bun', quantity: 2, reason: 'Unsold' });
  s = op(s, 'close', {});
  assert.equal(s.days.find((d: any) => d.date === '2026-11-06')!.status, 'closed');
  assert.throws(() => op(s, 'prepare', { recipeId: 'bun', quantity: 1 }), /closed/i);
});
test('raw waste checks lot balance and records value', () => {
  const s = fixture();
  const n = op(s, 'stockWaste', { lotId: 'first', quantity: 100, reason: 'Spoiled' });
  assert.equal(n.lots.find((l: any) => l.id === 'first')!.remaining, 400);
  assert.equal(n.events.at(-1)!.costCents, 1000);
  assert.throws(() => op(s, 'stockWaste', { lotId: 'first', quantity: 501, reason: 'Spoiled' }), /remaining/i);
});
test('combined shopping demand does not reuse shared ingredients', () => {
  let s = fixture();
  s = op(s, 'recipe', { id: 'roll', name: 'Roll', category: 'Bakery', price: 20, target: 10, ingredients: [{ ingredientId: 'flour', quantity: 100 }] });
  const p = planKitchen(s, '2026-11-06');
  assert.equal(p.shopping.find((x: any) => x.ingredientId === 'flour')!.shortfall, 500);
});
test('matching weekday history produces explained median suggestions', () => {
  let s = fixture();
  s = op(s, 'prepare', { recipeId: 'bun', quantity: 4 }, '2026-10-30');
  s = op(s, 'sell', { recipeId: 'bun', quantity: 4 }, '2026-10-30');
  s = op(s, 'close', {}, '2026-10-30');
  const p = planKitchen(s, '2026-11-06');
  assert.equal(p.recipes[0].suggested, 4);
  assert.deepEqual(p.recipes[0].historyDates, ['2026-10-30']);
});
test('invalid dates, fractions, duplicate ids, and missing references are rejected', () => {
  const s = fixture();
  assert.throws(() => op(s, 'prepare', { recipeId: 'bun', quantity: 0.5 }));
  assert.throws(() => op(s, 'close', {}, '2026-02-30'));
  assert.throws(() => op(s, 'ingredient', { id: 'flour', name: 'Other', unit: 'g', par: 0 }), /exists/i);
  const corrupt = structuredClone(s); corrupt.lots[0].ingredientId = 'missing';
  assert.throws(() => validateKitchen(corrupt), /reference/i);
});
test('backup restore rejects impossible balances and duplicate entities', () => {
  const s = fixture();
  const corrupt = structuredClone(s); corrupt.lots[0].remaining = -1;
  assert.throws(() => validateKitchen(corrupt));
  const dup = structuredClone(s); dup.ingredients.push(dup.ingredients[0]);
  assert.throws(() => validateKitchen(dup), /duplicate/i);
});
