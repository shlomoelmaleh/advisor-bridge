import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * At-least-once webhook handling for DB-webhook edge functions.
 *
 * pg_net retries deliver an identical body, so we need de-duplication — but it
 * MUST NOT drop emails. The rule: `public.webhook_events` is a SUCCESS ledger,
 * written only AFTER Resend accepts the email. A retry is a duplicate only if a
 * success row already exists; otherwise it re-attempts the send. To make that
 * re-attempt safe, every send carries a stable `Idempotency-Key` (the same event
 * key), which Resend honours for 24h so a real retry never sends twice.
 *
 * Failure path: if Resend errors / times out / returns non-2xx, the caller
 * responds 502 and pg_net retries later — no success row is written, so the email
 * is not lost.
 */

function admin() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
}

/** Stable per-delivery key: sha256(slug + raw webhook body). */
export async function eventKey(slug: string, rawBody: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`${slug}:${rawBody}`),
  );
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** True only if this event was already SENT successfully (success ledger). */
export async function alreadySent(key: string): Promise<boolean> {
  const { data, error } = await admin()
    .from('webhook_events').select('key').eq('key', key).maybeSingle();
  if (error) {
    // Fail toward re-sending rather than silently dropping (Resend's
    // Idempotency-Key still guards against an actual duplicate send).
    console.error('alreadySent lookup error (treating as not sent):', error.message);
    return false;
  }
  return !!data;
}

/** Record a successful send. Idempotent on the PK; duplicate races are ignored. */
export async function recordSent(key: string, resendId: string | null): Promise<void> {
  const { error } = await admin().from('webhook_events').upsert(
    { key, sent_at: new Date().toISOString(), resend_id: resendId },
    { onConflict: 'key' },
  );
  if (error) console.error('recordSent error:', error.message);
}

export interface SendResult { ok: boolean; id: string | null; status: number }

/**
 * Send an email through Resend with an Idempotency-Key so a webhook retry cannot
 * produce a duplicate send within Resend's 24h window. Returns ok=false on any
 * non-2xx response or thrown error so the caller can reply 502 and let pg_net
 * retry.
 */
export async function sendEmail(key: string, payload: Record<string, unknown>): Promise<SendResult> {
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': key,
      },
      body: JSON.stringify(payload),
    });
    let id: string | null = null;
    try { const j = await res.json(); id = j && j.id ? j.id : null; } catch { /* non-JSON body */ }
    return { ok: res.ok, id, status: res.status };
  } catch (e) {
    console.error('Resend fetch failed:', (e as Error).message);
    return { ok: false, id: null, status: 0 };
  }
}
