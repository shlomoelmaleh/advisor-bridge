import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { requireWebhookSecret } from '../_shared/webhookAuth.ts'
import { eventKey, alreadySent, sendEmail, recordSent } from '../_shared/idempotency.ts'

serve(async (req) => {
  const denied = requireWebhookSecret(req)
  if (denied) return denied

  const rawBody = await req.text();
  const key = await eventKey('notify-user-approved', rawBody);
  if (await alreadySent(key)) {
    return new Response(JSON.stringify({ skipped: 'duplicate' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }

  const body = JSON.parse(rawBody)
  const record = body.record
  const oldRecord = body.old_record ?? null

  const justApproved =
    record.is_approved === true &&
    (!oldRecord || oldRecord.is_approved !== true)

  if (!justApproved) {
    return new Response(JSON.stringify({ skipped: true }), { status: 200 })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const { data: { user } } = await supabase.auth.admin.getUserById(record.user_id)

  if (!user?.email) {
    return new Response(JSON.stringify({ error: 'email not found' }), { status: 200 })
  }

  const userName = record.full_name || 'משתמש'
  const role = record.role === 'advisor' ? 'יועץ משכנתא' : 'בנקאי'
  const dashboardUrl = record.role === 'advisor'
    ? 'https://advisor-bridge.lovable.app/advisor/dashboard'
    : 'https://advisor-bridge.lovable.app/bank/dashboard'

  const send = await sendEmail(key, {
      from: "BranchMatch <noreply@eshel-f.com>",
      to: user.email,
      subject: `✅ החשבון שלך אושר — ברוך הבא ל-MortgageBridge!`,
      html: `
        <div dir="rtl" style="font-family: Arial; padding: 24px; max-width: 600px;">
          <h2 style="color: #1E3A5F;">שלום ${userName},</h2>
          <p style="font-size: 16px;">
            החשבון שלך כ<strong>${role}</strong> אושר בהצלחה!
            אתה יכול עכשיו להתחבר ולהתחיל להשתמש במערכת.
          </p>

          <div style="background: #D5F0E0; border-radius: 8px; padding: 16px; margin: 16px 0;">
            <h3 style="margin: 0 0 8px 0; color: #1A5C38;">מה עכשיו?</h3>
            ${record.role === 'advisor' ? `
              <p style="margin: 4px 0;">📁 הגש את התיק הראשון שלך</p>
              <p style="margin: 4px 0;">🔍 עקוב אחר ההתאמות שיתקבלו</p>
              <p style="margin: 4px 0;">💬 תקשר ישירות עם בנקאים</p>
            ` : `
              <p style="margin: 4px 0;">🏦 הגדר את איתות התיאבון שלך</p>
              <p style="margin: 4px 0;">🔍 עיין בתיקים בשוק הפתוח</p>
              <p style="margin: 4px 0;">💬 תקשר ישירות עם יועצים</p>
            `}
          </div>

          <a href="${dashboardUrl}"
             style="display:inline-block; background:#1E3A5F; color:white;
                    padding:12px 24px; border-radius:8px; text-decoration:none;
                    font-size:15px; margin-top: 8px;">
            כנס למערכת →
          </a>

          <p style="margin-top: 24px; font-size: 12px; color: #888;">
            MortgageBridge — פלטפורמת התיווך למשכנתאות
          </p>
        </div>
      `,
  })

  if (!send.ok) {
    return new Response(JSON.stringify({ error: 'email send failed', status: send.status }), { status: 502, headers: { 'Content-Type': 'application/json' } })
  }
  await recordSent(key, send.id)

  return new Response(JSON.stringify({ ok: true, id: send.id }), { status: 200 })
})