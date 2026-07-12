import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const body = await req.json()
  const record = body.record
  const oldRecord = body.old_record ?? null

  // שלח email רק כשתיק עבר מלא-מאושר למאושר — ולא דחייה!
  const caseJustApproved =
    record.is_approved === true &&
    record.status !== 'rejected' &&
    (!oldRecord || oldRecord.is_approved !== true)

  if (!caseJustApproved) {
    return new Response(JSON.stringify({ skipped: true }), { status: 200 })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const { data: caseData } = await supabase
    .from('cases')
    .select(`
      loan_amount_min, loan_amount_max, ltv, region, borrower_type,
      advisor:profiles!cases_advisor_id_fkey(full_name, user_id)
    `)
    .eq('id', record.id)
    .single()

  if (!caseData?.advisor?.user_id) {
    return new Response(JSON.stringify({ error: 'advisor not found' }), { status: 200 })
  }

  const { data: { user } } = await supabase.auth.admin.getUserById(
    caseData.advisor.user_id
  )

  if (!user?.email) {
    return new Response(JSON.stringify({ error: 'email not found' }), { status: 200 })
  }

  const advisorName = caseData.advisor.full_name || 'יועץ'
  const loanMin = (caseData.loan_amount_min / 1_000_000).toFixed(1)
  const loanMax = (caseData.loan_amount_max / 1_000_000).toFixed(1)

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'BranchMatch <noreply@eshel-f.com>',
      to: user.email,
      subject: `✅ התיק שלך אושר — הבנקאים יכולים לראות אותו!`,
      html: `
        <div dir="rtl" style="font-family: Arial; padding: 24px; max-width: 600px;">
          <h2 style="color: #1E3A5F;">שלום ${advisorName},</h2>
          <p style="font-size: 16px;">
            התיק שלך <strong>אושר</strong> והוא עכשיו חשוף לבנקאים במערכת.
            בנקאים יכולים כעת להביע עניין ואתה תקבל התראה בכל פנייה.
          </p>
          
          <div style="background: #D5E8F0; border-radius: 8px; padding: 16px; margin: 16px 0;">
            <h3 style="margin: 0 0 8px 0; color: #1E3A5F;">פרטי התיק שאושר</h3>
            <p style="margin: 4px 0;">💰 סכום: ₪${loanMin}M – ₪${loanMax}M</p>
            <p style="margin: 4px 0;">📊 LTV: ${caseData.ltv}%</p>
            <p style="margin: 4px 0;">📍 אזור: ${caseData.region}</p>
            <p style="margin: 4px 0;">👤 סוג לווה: ${caseData.borrower_type === 'employee' ? 'שכיר' : 'עצמאי'}</p>
          </div>

          <p style="font-size: 15px; color: #444;">
            כנס למערכת לעקוב אחר ההתאמות שיתקבלו.
          </p>

          <a href="https://advisor-bridge.lovable.app/matches" 
             style="display:inline-block; background:#1E3A5F; color:white; 
                    padding:12px 24px; border-radius:8px; text-decoration:none;
                    font-size:15px; margin-top: 8px;">
            כנס לראות התאמות →
          </a>

          <p style="margin-top: 24px; font-size: 12px; color: #888;">
            BranchMatch — פלטפורמת החיבור למשכנתאות
          </p>
        </div>
      `,
    }),
  })

  return new Response(JSON.stringify({ ok: true }), { status: 200 })
})