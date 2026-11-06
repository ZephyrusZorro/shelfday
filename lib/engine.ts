import { kitchenSchema, operationSchema } from './model.ts';
import type { Kitchen, Lot } from './model.ts';

export class DomainError extends Error {
  constructor(message: string) { super(message); this.name = 'DomainError'; }
}
export function emptyKitchen(): Kitchen {
  return { schemaVersion: 1, sample: false, name: 'My kitchen', currency: 'INR', ingredients: [], recipes: [], lots: [], days: [], events: [], operationIds: [] };
}
function unique(values: string[], label: string) {
  if (new Set(values).size !== values.length) throw new DomainError(`Duplicate ${label}.`);
}
export function validateKitchen(input: unknown): Kitchen {
  const s = kitchenSchema.parse(input);
  unique(s.ingredients.map(x => x.id), 'ingredient ID'); unique(s.recipes.map(x => x.id), 'recipe ID');
  unique(s.lots.map(x => x.id), 'lot ID'); unique(s.days.map(x => x.date), 'day');
  unique(s.events.map(x => x.id), 'event ID'); unique(s.operationIds, 'operation ID');
  const ingredientIds = new Set(s.ingredients.map(x => x.id)); const recipeIds = new Set(s.recipes.map(x => x.id));
  for (const lot of s.lots) {
    if (!ingredientIds.has(lot.ingredientId)) throw new DomainError('Missing ingredient reference in stock.');
    if (lot.remaining > lot.quantity || lot.useBy < lot.receivedOn) throw new DomainError('Invalid lot balance or dates.');
  }
  for (const recipe of s.recipes) {
    unique(recipe.ingredients.map(x => x.ingredientId), 'recipe ingredient');
    if (recipe.ingredients.some(x => !ingredientIds.has(x.ingredientId))) throw new DomainError('Missing ingredient reference in recipe.');
  }
  for (const day of s.days) {
    unique(day.items.map(x => x.recipeId), 'day recipe');
    for (const item of day.items) {
      if (!recipeIds.has(item.recipeId)) throw new DomainError('Missing recipe reference in day.');
      if (item.sold + item.wasted > item.prepared || (day.status === 'closed' && item.sold + item.wasted !== item.prepared)) throw new DomainError('Invalid portion balance.');
    }
  }
  return s;
}
export function usableLots(s: Kitchen, ingredientId: string, date: string): Lot[] {
  return s.lots.filter(l => l.ingredientId === ingredientId && l.remaining > 0 && l.useBy >= date && l.receivedOn <= date)
    .sort((a, b) => a.useBy.localeCompare(b.useBy) || a.receivedOn.localeCompare(b.receivedOn) || a.id.localeCompare(b.id));
}
export function applyOperation(input: Kitchen, rawOperation: unknown): Kitchen {
  const op = operationSchema.parse(rawOperation);
  if (input.operationIds.includes(op.id)) return input;
  if (op.type === 'replace') {
    const restored = validateKitchen(op.payload);
    return { ...restored, operationIds: [...restored.operationIds.filter(x => x !== op.id), op.id] };
  }
  const s = structuredClone(input);
  const event: Kitchen['events'][number] = { id: op.id, operationId: op.id, date: op.date, type: op.type, label: '', quantity: 0, unit: '', costCents: 0, revenueCents: 0, reason: '' };
  const day = () => {
    let d = s.days.find(x => x.date === op.date);
    if (d?.status === 'closed') throw new DomainError('This day is closed. Its records cannot be changed.');
    if (!d) { d = { date: op.date, status: 'open', items: [] }; s.days.push(d); }
    return d;
  };
  switch (op.type) {
    case 'ingredient': {
      if (s.ingredients.some(x => x.id === op.payload.id || x.name.toLowerCase() === op.payload.name.toLowerCase())) throw new DomainError('This ingredient already exists.');
      s.ingredients.push(op.payload); event.label = op.payload.name; break;
    }
    case 'recipe': {
      if (s.recipes.some(x => x.id === op.payload.id || x.name.toLowerCase() === op.payload.name.toLowerCase())) throw new DomainError('This recipe already exists.');
      unique(op.payload.ingredients.map(x => x.ingredientId), 'recipe ingredient');
      if (op.payload.ingredients.some(x => !s.ingredients.some(i => i.id === x.ingredientId))) throw new DomainError('Recipe ingredient reference not found.');
      s.recipes.push(op.payload); event.label = op.payload.name; break;
    }
    case 'receive': {
      day();
      const p = op.payload, ingredient = s.ingredients.find(x => x.id === p.ingredientId);
      if (!ingredient) throw new DomainError('Ingredient not found.');
      if (s.lots.some(x => x.id === p.id)) throw new DomainError('This batch already exists.');
      if (p.useBy < op.date) throw new DomainError('Use-by date cannot precede receipt date.');
      s.lots.push({ id: p.id, ingredientId: p.ingredientId, quantity: p.quantity, remaining: p.quantity, totalCostCents: Math.round(p.totalCost * 100), receivedOn: op.date, useBy: p.useBy, reference: p.reference });
      event.label = ingredient.name; event.quantity = p.quantity; event.unit = ingredient.unit; event.costCents = Math.round(p.totalCost * 100); break;
    }
    case 'prepare': {
      const d = day(), p = op.payload, recipe = s.recipes.find(x => x.id === p.recipeId);
      if (!recipe) throw new DomainError('Recipe not found.');
      const allocations: { lot: Lot; quantity: number }[] = [];
      for (const part of recipe.ingredients) {
        let needed = part.quantity * p.quantity;
        for (const lot of usableLots(s, part.ingredientId, op.date)) {
          const quantity = Math.min(needed, lot.remaining); if (quantity) allocations.push({ lot, quantity }); needed -= quantity; if (needed === 0) break;
        }
        if (needed) {
          const ingredient = s.ingredients.find(x => x.id === part.ingredientId)!;
          throw new DomainError(`Stock shortage: need ${needed.toLocaleString('en')} more ${ingredient.unit} of ${ingredient.name}. Expired and future receipts are excluded.`);
        }
      }
      let cost = 0;
      for (const a of allocations) { a.lot.remaining -= a.quantity; cost += a.quantity * a.lot.totalCostCents / a.lot.quantity; }
      const costCents = Math.round(cost);
      let item = d.items.find(x => x.recipeId === recipe.id);
      if (!item) { item = { recipeId: recipe.id, name: recipe.name, priceCents: Math.round(recipe.price * 100), costCents: 0, prepared: 0, sold: 0, wasted: 0 }; d.items.push(item); }
      item.prepared += p.quantity; item.costCents += costCents;
      event.label = recipe.name; event.quantity = p.quantity; event.unit = 'portions'; event.costCents = costCents; break;
    }
    case 'sell':
    case 'portionWaste': {
      const d = day(), p = op.payload, item = d.items.find(x => x.recipeId === p.recipeId);
      if (!item) throw new DomainError('Prepare this recipe first.');
      if (p.quantity > item.prepared - item.sold - item.wasted) throw new DomainError('Quantity exceeds remaining prepared portions.');
      if (op.type === 'sell') { item.sold += p.quantity; event.revenueCents = item.priceCents * p.quantity; }
      else { item.wasted += p.quantity; event.reason = op.payload.reason; event.costCents = Math.round(item.costCents / item.prepared * p.quantity); }
      event.label = item.name; event.quantity = p.quantity; event.unit = 'portions'; break;
    }
    case 'stockWaste': {
      day(); const p = op.payload, lot = s.lots.find(x => x.id === p.lotId);
      if (!lot) throw new DomainError('Batch not found.');
      if (lot.receivedOn > op.date) throw new DomainError('Batch was not received on this date.');
      if (p.quantity > lot.remaining) throw new DomainError('Quantity exceeds remaining batch stock.');
      lot.remaining -= p.quantity; const ingredient = s.ingredients.find(x => x.id === lot.ingredientId)!;
      event.label = ingredient.name; event.quantity = p.quantity; event.unit = ingredient.unit; event.reason = p.reason; event.costCents = Math.round(p.quantity * lot.totalCostCents / lot.quantity); break;
    }
    case 'close': {
      const d = day();
      if (d.items.some(x => x.prepared !== x.sold + x.wasted)) throw new DomainError('There are unaccounted portions. Record sales or waste before closing.');
      d.status = 'closed'; event.label = 'Day closed'; break;
    }
    case 'settings': {
      if (s.currency !== op.payload.currency && s.events.some(e => e.costCents || e.revenueCents) ) throw new DomainError('Currency cannot change after monetary activity. Start a new kitchen for a different currency.');
      s.name = op.payload.name; s.currency = op.payload.currency; event.label = 'Kitchen settings updated'; break;
    }
  }
  s.events.push(event); s.operationIds.push(op.id);
  return validateKitchen(s);
}
