export function money(cents: number, currency: string) {
  return new Intl.NumberFormat('en', { style: 'currency', currency, maximumFractionDigits: 2 }).format(cents / 100);
}
export function count(n: number) { return n.toLocaleString('en'); }
