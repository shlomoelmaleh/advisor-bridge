import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { requireWebhookSecret } from '../_shared/webhookAuth.ts'
import { eventKey, alreadySent, sendEmail, recordSent } from '../_shared/idempotency.ts'

serve(async (req) => {
  const denied = requireWebhookSecret(req)
  if (denied) return denied

  const rawBody = await req.text();
  const key = await eventKey('notify-banker-advisor-interest', rawBody);
  if (await alreadySent(key)) {
    return new Response(JSON.stringify({ skipped: 'duplicate' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }

  const body = JSON.parse(rawBody)
  const record = body.record
  const oldRecord = body.old_record ?? null

  // שלח email רק כש-advisor_status השתנה ל-'interested' לראשונה
  const advisorJustBecameInterested =
    record.advisor_status === 'interested' &&
    (!oldRecord || oldRecord.advisor_status !== 'interested')

  if (!advisorJustBecameInterested) {
    return new Response(JSON.stringify({ skipped: true }), { status: 200 })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // שלוף פרטי ה-match כולל appetite לצורך זיהוי בנקאי
  const { data: match } = await supabase
    .from('matches')
    .select(`
      banker_id,
      case:cases(loan_amount_min, loan_amount_max, ltv, region, borrower_type),
      appetite:branch_appetites(bank_name, branch_name, banker_id),
      banker:profiles!matches_banker_id_fkey(full_name, user_id)
    `)
    .eq('id', record.id)
    .single()

  // זיהוי הבנקאי — דרך banker_id ישיר או דרך appetite
  const bankerUserId = match?.banker?.user_id ?? match?.appetite?.banker_id

  if (!bankerUserId) {
    console.error('banker not found', JSON.stringify(match))
    return new Response(JSON.stringify({ error: 'banker not found' }), { status: 200 })
  }

  // שלוף אימייל הבנקאי
  const { data: { user } } = await supabase.auth.admin.getUserById(bankerUserId)

  if (!user?.email) {
    return new Response(JSON.stringify({ error: 'email not found' }), { status: 200 })
  }

  // שלוף שם הבנקאי אם חסר (במקרה של auto-match)
  let bankerName = match?.banker?.full_name
  if (!bankerName) {
    const { data: bankerProfile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('user_id', bankerUserId)
      .single()
    bankerName = bankerProfile?.full_name || 'בנקאי'
  }

  const bankName = match?.appetite?.bank_name || 'הבנק'
  const branchName = match?.appetite?.branch_name ? ` — סניף ${match.appetite.branch_name}` : ''
  const loanMin = (match.case.loan_amount_min / 1_000_000).toFixed(1)
  const loanMax = (match.case.loan_amount_max / 1_000_000).toFixed(1)

  const send = await sendEmail(key, {
      from: 'BranchMatch <noreply@eshel-f.com>',
      to: user.email,
      subject: `✅ יועץ אישר את ההתאמה — ניתן להתחיל שיחה!`,
      html: `
        <div dir="rtl" style="font-family: Arial; padding: 24px; max-width: 600px;">
          <h2 style="color: #1E3A5F;">שלום ${bankerName},</h2>
          <p style="font-size: 16px;">
            יועץ משכנתא אישר את ההתאמה מול <strong>${bankName}${branchName}</strong>.
            ערוץ תקשורת ישיר נפתח — ניתן להתחיל שיחה!
          </p>

          <div style="background: #D5E8F0; border-radius: 8px; padding: 16px; margin: 16px 0;">
            <h3 style="margin: 0 0 8px 0; color: #1E3A5F;">פרטי התיק</h3>
            <p style="margin: 4px 0;">💰 סכום: ₪${loanMin}M – ₪${loanMax}M</p>
            <p style="margin: 4px 0;">📊 LTV: ${match.case.ltv}%</p>
            <p style="margin: 4px 0;">📍 אזור: ${match.case.region}</p>
            <p style="margin: 4px 0;">👤 סוג לווה: ${match.case.borrower_type === 'employee' ? 'שכיר' : 'עצמאי'}</p>
          </div>

          <p style="font-size: 15px; color: #444;">
            כנס למערכת כדי להתחיל בשיחה עם היועץ ולקדם את העסקה.
          </p>

          <a href="https://advisor-bridge.lovable.app/chat/${record.id}" 
             style="display:inline-block; background:#1E3A5F; color:white; 
                    padding:12px 24px; border-radius:8px; text-decoration:none;
                    font-size:15px; margin-top: 8px;">
            כנס לצ'אט עם היועץ →
          </a>

          <p style="margin-top: 24px; font-size: 12px; color: #888;">
            BranchMatch — פלטפורמת החיבור למשכנתאות
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