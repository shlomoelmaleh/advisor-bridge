/**
 * Shared auth for DB-webhook-invoked edge functions.
 *
 * These functions run with verify_jwt=false (DB webhooks can't mint user JWTs,
 * and CORS preflights carry no Authorization header), so the x-webhook-secret
 * header is the real gate. The secret is set as a function secret:
 *   supabase secrets set WEBHOOK_SECRET=<value>
 * and the same value is configured as an HTTP header on every DB webhook
 * (Dashboard → Database → Webhooks).
 *
 * Returns null when the request is authorized, otherwise a ready-to-return
 * Response. A missing WEBHOOK_SECRET env is a deployment error and fails
 * closed with 500 (loud), never open.
 */
export function requireWebhookSecret(req: Request): Response | null {
  const expected = Deno.env.get('WEBHOOK_SECRET');
  if (!expected) {
    console.error('WEBHOOK_SECRET is not configured — rejecting all requests');
    return new Response(JSON.stringify({ error: 'server misconfigured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const provided = req.headers.get('x-webhook-secret');
  if (!provided || provided !== expected) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return null;
}
