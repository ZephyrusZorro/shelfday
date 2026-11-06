import { z } from 'zod';
import { DomainError } from './engine.ts';
import { CapacityError, ConflictError } from './repository.ts';
import type { KitchenRepository } from './repository.ts';

const bodySchema = z.object({ revision: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER), operation: z.unknown() }).strict();
export function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Vary': 'Cookie' } });
}
async function limitedJson(request: Request) {
  const reader = request.body?.getReader(); if (!reader) throw new SyntaxError('Missing body.');
  const chunks: Uint8Array[] = []; let size = 0;
  while (true) {
    const { value, done } = await reader.read(); if (done) break;
    size += value.byteLength;
    if (size > 1_800_000) { await reader.cancel(); throw new CapacityError('Request is too large. Backup limit is 1.8 MB.'); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const c of chunks) { bytes.set(c, offset); offset += c.length; }
  return JSON.parse(new TextDecoder().decode(bytes));
}
export async function handleKitchen(request: Request, userId: string | null, repo: KitchenRepository): Promise<Response> {
  if (!userId) return json({ error: 'Sign in to open your kitchen.' }, 401);
  try {
    if (request.method === 'GET') return json(await repo.read(userId));
    if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
    if (request.headers.get('origin') !== new URL(request.url).origin) return json({ error: 'This request must come from this site.' }, 403);
    if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json') return json({ error: 'Send application/json.' }, 415);
    const body = bodySchema.parse(await limitedJson(request));
    return json(await repo.write(userId, body.revision, body.operation));
  } catch (error) {
    if (error instanceof ConflictError) return json({ error: error.message }, 409);
    if (error instanceof CapacityError) return json({ error: error.message }, 413);
    if (error instanceof DomainError) return json({ error: error.message }, 422);
    if (error instanceof z.ZodError) return json({ error: error.issues.slice(0, 3).map(i => `${i.path.join('.')}: ${i.message}`).join('; ') }, 422);
    if (error instanceof SyntaxError) return json({ error: 'Could not read this data. Use a valid Shelfday JSON backup.' }, 400);
    return json({ error: 'The kitchen could not be saved. Your current data is unchanged. Refresh and try again.' }, 500);
  }
}
