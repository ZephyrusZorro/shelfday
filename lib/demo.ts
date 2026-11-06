import { applyOperation, emptyKitchen } from './engine.ts';
import { shiftDate } from './planning.ts';
import type { Kitchen } from './model.ts';

export function sampleKitchen(today: string): Kitchen {
  let state = { ...emptyKitchen(), name: 'The Little Table', sample: true };
  let seq = 0;
  const run = (type: string, payload: unknown, date = today) => { state = applyOperation(state, { id: `sample-${++seq}`, date, type, payload }); };
  for (const ingredient of [
    { id: 'bread', name: 'Sourdough slices', unit: 'each', par: 30 }, { id: 'tomato', name: 'Cherry tomatoes', unit: 'g', par: 1500 },
    { id: 'cheese', name: 'Cream cheese', unit: 'g', par: 800 }, { id: 'coffee', name: 'Coffee beans', unit: 'g', par: 1000 },
    { id: 'oat', name: 'Oat milk', unit: 'ml', par: 4000 }, { id: 'spinach', name: 'Baby spinach', unit: 'g', par: 600 },
  ]) run('ingredient', ingredient);
  const recipes = [
    { id: 'toast', name: 'Roasted tomato toast', category: 'Kitchen', price: 180, target: 24, ingredients: [{ ingredientId: 'bread', quantity: 2 }, { ingredientId: 'tomato', quantity: 80 }, { ingredientId: 'cheese', quantity: 30 }] },
    { id: 'latte', name: 'Oat milk latte', category: 'Coffee bar', price: 160, target: 30, ingredients: [{ ingredientId: 'coffee', quantity: 18 }, { ingredientId: 'oat', quantity: 200 }] },
    { id: 'sandwich', name: 'Spinach & cheese melt', category: 'Kitchen', price: 210, target: 18, ingredients: [{ ingredientId: 'bread', quantity: 2 }, { ingredientId: 'spinach', quantity: 40 }, { ingredientId: 'cheese', quantity: 40 }] },
  ];
  recipes.forEach(r => run('recipe', r));
  for (const [index, ago] of [14, 7].entries()) {
    const date = shiftDate(today, -ago);
    for (const [i, recipe] of recipes.entries()) {
      const portions = [20, 26, 14][i] + index * 2;
      for (const part of recipe.ingredients) run('receive', { id: `history-${ago}-${i}-${part.ingredientId}`, ingredientId: part.ingredientId, quantity: part.quantity * portions, totalCost: Math.round(part.quantity * portions * 0.2), useBy: shiftDate(date, 1), reference: 'Sample receipt' }, date);
      run('prepare', { recipeId: recipe.id, quantity: portions }, date);
      run('sell', { recipeId: recipe.id, quantity: portions - 2 }, date);
      run('portionWaste', { recipeId: recipe.id, quantity: 2, reason: 'Unsold' }, date);
    }
    run('close', {}, date);
  }
  const receipts = [
    ['bread-fresh', 'bread', 80, 1200, 2], ['tomato-use', 'tomato', 1800, 360, 0], ['tomato-fresh', 'tomato', 2000, 400, 3],
    ['cheese-fresh', 'cheese', 2000, 1200, 3], ['coffee-fresh', 'coffee', 2000, 2400, 20], ['oat-fresh', 'oat', 6000, 1200, 2],
    ['spinach-use', 'spinach', 1000, 200, 0], ['oat-expired', 'oat', 400, 80, -1],
  ];
  for (const [id, ingredientId, quantity, totalCost, offset] of receipts) run('receive', { id, ingredientId, quantity, totalCost, useBy: shiftDate(today, Number(offset)), reference: 'Sample supplier' }, shiftDate(today, -2));
  run('prepare', { recipeId: 'toast', quantity: 8 }); run('sell', { recipeId: 'toast', quantity: 5 });
  run('prepare', { recipeId: 'latte', quantity: 10 }); run('sell', { recipeId: 'latte', quantity: 8 });
  run('prepare', { recipeId: 'sandwich', quantity: 4 }); run('sell', { recipeId: 'sandwich', quantity: 2 });
  return state;
}
