import { z } from 'zod';

export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => {
  const d = new Date(`${v}T12:00:00Z`);
  return !Number.isNaN(d.valueOf()) && d.toISOString().slice(0, 10) === v && v >= '2000-01-01' && v <= '2100-12-31';
}, 'Enter a real calendar date between 2000 and 2100.');
const id = z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/);
const name = z.string().trim().min(1).max(100);
const qty = z.number().int().positive().max(10_000_000);
const nonnegative = z.number().int().min(0).max(100_000_000);
const money = z.number().finite().min(0).max(1_000_000).refine(v => Math.abs(v * 100 - Math.round(v * 100)) < 1e-6, 'Use at most two decimal places.');
export const ingredientSchema = z.object({ id, name, unit: z.enum(['g', 'ml', 'each']), par: nonnegative }).strict();
export const recipeSchema = z.object({ id, name, category: name, price: money, target: z.number().int().min(0).max(10_000), ingredients: z.array(z.object({ ingredientId: id, quantity: qty }).strict()).min(1).max(50) }).strict();
const lotSchema = z.object({ id, ingredientId: id, quantity: qty, remaining: nonnegative, totalCostCents: nonnegative, remainingCostCents: nonnegative.optional(), receivedOn: dateSchema, useBy: dateSchema, reference: z.string().max(150) }).strict().transform(lot => ({ ...lot, remainingCostCents: lot.remainingCostCents ?? Math.round(lot.totalCostCents * lot.remaining / lot.quantity) }));
const dayItemSchema = z.object({ recipeId: id, name, priceCents: nonnegative, costCents: nonnegative, remainingCostCents: nonnegative.optional(), soldCostCents: nonnegative.optional(), wasteCostCents: nonnegative.optional(), prepared: nonnegative, sold: nonnegative, wasted: nonnegative }).strict().transform(item => {
  // Earlier v1 backups predate explicit cost pools. Preserve their balances using rounded proportional estimates.
  const soldCostCents = item.soldCostCents ?? (item.prepared ? Math.round(item.costCents * item.sold / item.prepared) : 0);
  const wasteCostCents = item.wasteCostCents ?? Math.min(item.costCents - soldCostCents, item.prepared ? Math.round(item.costCents * item.wasted / item.prepared) : 0);
  return { ...item, soldCostCents, wasteCostCents, remainingCostCents: item.remainingCostCents ?? item.costCents - soldCostCents - wasteCostCents };
});
const daySchema = z.object({ date: dateSchema, status: z.enum(['open', 'closed']), items: z.array(dayItemSchema).max(500) }).strict();
const eventSchema = z.object({ id, operationId: id, date: dateSchema, type: z.enum(['ingredient', 'recipe', 'receive', 'prepare', 'sell', 'portionWaste', 'stockWaste', 'close', 'settings']), label: z.string().max(250), quantity: nonnegative, unit: z.string().max(20), costCents: nonnegative, revenueCents: nonnegative, reason: z.string().max(150) }).strict();
export const kitchenSchema = z.object({
  schemaVersion: z.literal(1), sample: z.boolean(), name, currency: z.enum(['INR', 'USD', 'GBP', 'EUR', 'AUD', 'CAD']),
  ingredients: z.array(ingredientSchema).max(500), recipes: z.array(recipeSchema).max(500), lots: z.array(lotSchema).max(10_000),
  days: z.array(daySchema).max(4000), events: z.array(eventSchema).max(15_000), operationIds: z.array(id).max(15_000),
}).strict();

const base = { id, date: dateSchema };
export const operationSchema = z.discriminatedUnion('type', [
  z.object({ ...base, type: z.literal('ingredient'), payload: ingredientSchema }).strict(),
  z.object({ ...base, type: z.literal('recipe'), payload: recipeSchema }).strict(),
  z.object({ ...base, type: z.literal('receive'), payload: z.object({ id, ingredientId: id, quantity: qty, totalCost: money, useBy: dateSchema, reference: z.string().trim().max(150) }).strict() }).strict(),
  z.object({ ...base, type: z.literal('prepare'), payload: z.object({ recipeId: id, quantity: qty.max(10_000) }).strict() }).strict(),
  z.object({ ...base, type: z.literal('sell'), payload: z.object({ recipeId: id, quantity: qty.max(10_000) }).strict() }).strict(),
  z.object({ ...base, type: z.literal('portionWaste'), payload: z.object({ recipeId: id, quantity: qty.max(10_000), reason: name }).strict() }).strict(),
  z.object({ ...base, type: z.literal('stockWaste'), payload: z.object({ lotId: id, quantity: qty, reason: name }).strict() }).strict(),
  z.object({ ...base, type: z.literal('close'), payload: z.object({}).strict() }).strict(),
  z.object({ ...base, type: z.literal('settings'), payload: z.object({ name, currency: kitchenSchema.shape.currency }).strict() }).strict(),
  z.object({ ...base, type: z.literal('replace'), payload: kitchenSchema }).strict(),
]);
export type Kitchen = z.infer<typeof kitchenSchema>;
export type Ingredient = z.infer<typeof ingredientSchema>;
export type Recipe = z.infer<typeof recipeSchema>;
export type Operation = z.infer<typeof operationSchema>;
export type Lot = Kitchen['lots'][number];
export type DayItem = Kitchen['days'][number]['items'][number];
export type Snapshot = { state: Kitchen; revision: number };
export const snapshotSchema = z.object({ state: kitchenSchema, revision: z.number().int().nonnegative() });
