import { dateSchema } from './model.ts';
import type { Kitchen } from './model.ts';
import { usableLots } from './engine.ts';

export function planKitchen(s: Kitchen, date: string) {
  dateSchema.parse(date);
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
  const day = s.days.find(d => d.date === date);
  const recipes = s.recipes.map(recipe => {
    const history = s.days.filter(d => d.status === 'closed' && d.date < date && new Date(`${d.date}T12:00:00Z`).getUTCDay() === weekday && d.items.some(x => x.recipeId === recipe.id))
      .sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4);
    const values = history.map(d => d.items.find(x => x.recipeId === recipe.id)!.sold).sort((a, b) => a - b);
    const mid = Math.floor(values.length / 2);
    const suggested = values.length ? Math.ceil(values.length % 2 ? values[mid] : (values[mid - 1] + values[mid]) / 2) : recipe.target;
    const item = day?.items.find(x => x.recipeId === recipe.id);
    const toPrep = Math.max(0, suggested - (item?.prepared ?? 0));
    const capacity = Math.min(...recipe.ingredients.map(p => Math.floor(usableLots(s, p.ingredientId, date).reduce((a, l) => a + l.remaining, 0) / p.quantity)));
    return { ...recipe, suggested, toPrep, capacity, historyDates: history.map(d => d.date), item };
  });
  const shopping = s.ingredients.map(ingredient => {
    const required = recipes.reduce((sum, r) => sum + (r.ingredients.find(x => x.ingredientId === ingredient.id)?.quantity ?? 0) * r.toPrep, 0);
    const usable = usableLots(s, ingredient.id, date).reduce((a, l) => a + l.remaining, 0);
    return { ingredientId: ingredient.id, name: ingredient.name, unit: ingredient.unit, usable, required, shortfall: Math.max(0, required - usable), belowPar: Math.max(0, ingredient.par - usable) };
  });
  return { recipes, shopping, day };
}
export function localDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function shiftDate(date: string, days: number) {
  const d = new Date(`${date}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10);
}
