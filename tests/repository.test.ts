import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, mkdtempSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { KitchenRepository } from '../lib/repository.ts';
import { handleKitchen } from '../lib/http.ts';

function open(path = ':memory:') {
  const db = new DatabaseSync(path);
  if (!db.prepare("SELECT name FROM sqlite_master WHERE name = 'kitchen_docs'").get()) {
    const path = new URL('../drizzle/', import.meta.url);
    const file = readdirSync(path).find(x => x.endsWith('.sql'))!;
    db.exec(readFileSync(new URL(file, path), 'utf8'));
  }
  const sql = { prepare(query: string) { return { bind(...args: any[]) { return {
    async first() { return db.prepare(query).get(...args) ?? null; },
    async run() { const r = db.prepare(query).run(...args); return { meta: { changes: Number(r.changes) } }; },
  }; } }; } };
  return { db, repo: new KitchenRepository(sql as any) };
}
const operation = { id: 'add-1', date: '2026-11-06', type: 'ingredient', payload: { id: 'rice', name: 'Rice', unit: 'g', par: 500 } };
test('real SQLite persists records across connections and isolates users', async () => {
  const path = join(mkdtempSync(join(tmpdir(), 'shelfday-')), 'test.sqlite');
  const a = open(path); await a.repo.write('alice', 0, operation); a.db.close();
  const b = open(path); assert.equal((await b.repo.read('alice')).state.ingredients[0].name, 'Rice');
  assert.equal((await b.repo.read('bob')).state.ingredients.length, 0); b.db.close();
});
test('stale revision cannot overwrite data and retry is idempotent', async () => {
  const { repo, db } = open(); const first = await repo.write('alice', 0, operation);
  assert.equal(first.revision, 1);
  assert.deepEqual(await repo.write('alice', 0, operation), first);
  await assert.rejects(repo.write('alice', 0, { ...operation, id: 'different' }), /changed/i);
  assert.equal((await repo.read('alice')).revision, 1); db.close();
});
test('invalid operation leaves persistent snapshot unchanged', async () => {
  const { repo, db } = open(); await repo.write('alice', 0, operation);
  await assert.rejects(repo.write('alice', 1, { ...operation, id: 'bad', payload: { ...operation.payload, par: -1 } }));
  assert.equal((await repo.read('alice')).revision, 1); db.close();
});
test('simultaneous initial writes: only one revision commits', async () => {
  const { repo, db } = open();
  const r = await Promise.allSettled([repo.write('alice', 0, operation), repo.write('alice', 0, { ...operation, id: 'second', payload: { ...operation.payload, id: 'beans', name: 'Beans' } })]);
  assert.equal(r.filter(x => x.status === 'fulfilled').length, 1); assert.equal((await repo.read('alice')).state.ingredients.length, 1); db.close();
});
test('HTTP requires identity, same-origin JSON writes and valid body', async () => {
  const { repo, db } = open();
  const request = (headers: Record<string, string> = {}, body = '{}') => new Request('https://kitchen.test/api/kitchen', { method: 'POST', headers, body });
  assert.equal((await handleKitchen(new Request('https://kitchen.test/api/kitchen'), null, repo)).status, 401);
  assert.equal((await handleKitchen(request({ origin: 'https://evil.test', 'content-type': 'application/json' }), 'alice', repo)).status, 403);
  assert.equal((await handleKitchen(request({ origin: 'https://kitchen.test', 'content-type': 'text/plain' }), 'alice', repo)).status, 415);
  assert.equal((await handleKitchen(request({ origin: 'https://kitchen.test', 'content-type': 'application/json' }, '{bad'), 'alice', repo)).status, 400);
  const good = await handleKitchen(request({ origin: 'https://kitchen.test', 'content-type': 'application/json' }, JSON.stringify({ revision: 0, operation })), 'alice', repo);
  assert.equal(good.status, 200); assert.equal(good.headers.get('cache-control'), 'no-store');
  db.close();
});
test('HTTP rejects oversized bodies, unsupported methods and caller-selected identities', async () => {
  const { repo, db } = open();
  const headers = { origin: 'https://kitchen.test', 'content-type': 'application/json' };
  const large = new Request('https://kitchen.test/api/kitchen', { method: 'POST', headers, body: 'x'.repeat(1_800_001) });
  assert.equal((await handleKitchen(large, 'alice', repo)).status, 413);
  const wrongMethod = new Request('https://kitchen.test/api/kitchen', { method: 'DELETE' });
  assert.equal((await handleKitchen(wrongMethod, 'alice', repo)).status, 405);
  const injected = new Request('https://kitchen.test/api/kitchen', { method: 'POST', headers, body: JSON.stringify({ revision: 0, userId: 'bob', operation }) });
  assert.equal((await handleKitchen(injected, 'alice', repo)).status, 422);
  assert.equal((await repo.read('bob')).revision, 0); db.close();
});
