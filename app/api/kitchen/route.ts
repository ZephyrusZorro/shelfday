import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '../../chatgpt-auth';
import { handleKitchen, json } from '../../../lib/http';
import { KitchenRepository } from '../../../lib/repository';

export const dynamic = 'force-dynamic';
async function handler(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return json({ error: 'Sign in to open your kitchen.' }, 401);
  if (!env.DB) return json({ error: 'Kitchen storage is unavailable. Please try again later.' }, 503);
  return handleKitchen(request, user.userId, new KitchenRepository(env.DB));
}
export const GET = handler;
export const POST = handler;
