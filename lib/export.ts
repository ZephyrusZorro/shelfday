import { validateKitchen } from './engine.ts';
import type { Kitchen } from './model.ts';

export function backupText(state: Kitchen) {
  return JSON.stringify({ format: 'shelfday-backup', version: 1, exportedAt: new Date().toISOString(), state }, null, 2);
}
export function parseBackup(text: string): Kitchen {
  const value = JSON.parse(text);
  if (value.format !== 'shelfday-backup' || value.version !== 1) throw new Error('Choose a Shelfday version 1 backup.');
  return validateKitchen(value.state);
}
function csvCell(value: string | number) {
  let text = String(value);
  if (/^[=+@\-\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}
export function activityCsv(state: Kitchen) {
  const rows = [['Date', 'Action', 'Item', 'Quantity', 'Unit', 'Ingredient cost', 'Sales', 'Currency', 'Reason'],
    ...state.events.map(e => [e.date, e.type, e.label, e.quantity, e.unit, (e.costCents / 100).toFixed(2), (e.revenueCents / 100).toFixed(2), state.currency, e.reason])];
  return '\uFEFF' + rows.map(row => row.map(csvCell).join(',')).join('\r\n');
}
