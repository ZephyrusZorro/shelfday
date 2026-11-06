import { emptyKitchen, applyOperation, validateKitchen } from './engine.ts';
import { operationSchema } from './model.ts';
import type { Snapshot } from './model.ts';

export interface SqlDatabase {
  prepare(query: string): { bind(...values: (string | number)[]): {
    first<T>(): Promise<T | null>;
    run(): Promise<{ meta: { changes?: number } }>;
  } };
}
export class ConflictError extends Error {
  constructor() { super('This kitchen changed in another tab. Your entry was not applied. Review refreshed data, then submit again.'); this.name = 'ConflictError'; }
}
export class CapacityError extends Error {}
export class KitchenRepository {
  private sql: SqlDatabase;
  constructor(sql: SqlDatabase) { this.sql = sql; }
  async read(userId: string): Promise<Snapshot> {
    const row = await this.sql.prepare('SELECT revision, document FROM kitchen_docs WHERE user_id = ?').bind(userId).first<{ revision: number; document: string }>();
    return row ? { revision: row.revision, state: validateKitchen(JSON.parse(row.document)) } : { revision: 0, state: emptyKitchen() };
  }
  async write(userId: string, expectedRevision: number, raw: unknown): Promise<Snapshot> {
    const operation = operationSchema.parse(raw);
    const current = await this.read(userId);
    if (current.state.operationIds.includes(operation.id)) return current;
    if (current.revision !== expectedRevision) throw new ConflictError();
    const state = applyOperation(current.state, operation), document = JSON.stringify(state);
    if (new TextEncoder().encode(document).byteLength > 1_500_000) throw new CapacityError('Kitchen history is near its storage limit. Export a backup and start a new kitchen before adding more records.');
    const nextRevision = current.revision + 1;
    const result = current.revision === 0
      ? await this.sql.prepare('INSERT OR IGNORE INTO kitchen_docs (user_id, revision, document) VALUES (?, ?, ?)').bind(userId, nextRevision, document).run()
      : await this.sql.prepare('UPDATE kitchen_docs SET revision = ?, document = ? WHERE user_id = ? AND revision = ?').bind(nextRevision, document, userId, current.revision).run();
    if (result.meta.changes !== 1) {
      const latest = await this.read(userId);
      if (latest.state.operationIds.includes(operation.id)) return latest;
      throw new ConflictError();
    }
    return { revision: nextRevision, state };
  }
}
