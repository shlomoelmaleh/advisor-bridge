import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { requireWebhookSecret } from '../_shared/webhookAuth.ts'
import { eventKey, alreadySent, sendEmail, recordSent } from '../_shared/idempotency.ts'

serve(async (req) => {
  const denied = requireWebhookSecret(req)
  if (denied) return denied

  const rawBody = await req.text();
  const key = await eventKey('notify-admin-new-user', rawBody);
  if (await alreadySent(key)) {
    return new Response(JSON.stringify({ skipped: 'duplicate' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }

  const { record } = JSON.parse(rawBody)

  const adminEmail = Deno.env.get('ADMIN_NOTIFY_EMAIL')
  if (!adminEmail) {
    console.error('ADMIN_NOTIFY_EMAIL is not configured')
    return new Response(JSON.stringify({ error: 'server misconfigured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  const userName = record.full_name || 'משתמש חדש'
  const userRole = record.role === 'advisor' ? 'יועץ משכנתא' : 'בנקאי'

  const send = await sendEmail(key, {
      from: "BranchMatch <noreply@eshel-f.com>",
      to: adminEmail,
      subject: `משתמש חדש ממתין לאישור — ${userName}`,
      html: `
        <div dir="rtl" style="font-family: Arial; padding: 20px;">
          <h2>משתמש חדש נרשם למערכת</h2>
          <p><strong>שם:</strong> ${userName}</p>
          <p><strong>תפקיד:</strong> ${userRole}</p>
          <p><strong>חברה:</strong> ${record.company || 'לא צוין'}</p>
          <hr/>
          <a href="https://advisor-bridge.lovable.app/admin/dashboard" 
             style="background:#3b82f6;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;">
            כנס לאשר את המשתמש
          </a>
        </div>
      `,
  })

  if (!send.ok) {
    return new Response(JSON.stringify({ error: 'email send failed', status: send.status }), { status: 502, headers: { 'Content-Type': 'application/json' } })
  }
  await recordSent(key, send.id)

  return new Response(JSON.stringify({ ok: true, id: send.id }), {
    headers: { 'Content-Type': 'application/json' },
  })
})