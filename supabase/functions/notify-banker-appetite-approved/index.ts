import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireWebhookSecret } from "../_shared/webhookAuth.ts";
import { eventKey, alreadySent, sendEmail, recordSent } from '../_shared/idempotency.ts'

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const denied = requireWebhookSecret(req);
  if (denied) return denied;

  const rawBody = await req.text();
  const key = await eventKey('notify-banker-appetite-approved', rawBody);
  if (await alreadySent(key)) {
    return new Response(JSON.stringify({ skipped: 'duplicate' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    const payload = JSON.parse(rawBody);
    const newRecord = payload.record;
    const oldRecord = payload.old_record;

    // שלח אימייל אישור רק כשעבר מ-is_approved=false ל-is_approved=true
    // וגם is_active=true (אישור אמיתי, לא דחייה)
    const justApproved =
      newRecord?.is_approved === true &&
      newRecord?.is_active === true &&
      (!oldRecord || oldRecord.is_approved !== true);

    if (!justApproved) {
      console.log("Skipped: not an approval event", {
        newIsApproved: newRecord?.is_approved,
        newIsActive: newRecord?.is_active,
        oldIsApproved: oldRecord?.is_approved,
      });
      return new Response(JSON.stringify({ skipped: "not an approval event" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!newRecord.banker_id) {
      return new Response(JSON.stringify({ error: "Missing banker_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: bankerAuth } = await supabaseAdmin.auth.admin.getUserById(newRecord.banker_id);

    if (!bankerAuth?.user?.email) {
      console.error("Banker email not found");
      return new Response(JSON.stringify({ error: "Banker email not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const bankName = newRecord.bank_name ?? "בנק";
    const branchName = newRecord.branch_name ?? "";
    const displayName = branchName ? `${bankName} - ${branchName}` : bankName;

    const send = await sendEmail(key, {
        from: "BranchMatch <noreply@eshel-f.com>",
        to: [bankerAuth.user.email],
        subject: `✅ אות התיאבון שלך אושר — ${displayName}`,
        html: `
          <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #1a1a2e;">✅ אות תיאבון אושר!</h2>
            <p style="font-size: 16px; color: #333;">
              אות התיאבון של <strong>${displayName}</strong> אושר על ידי מנהל המערכת.
            </p>
            <p style="color: #555;">
              מעכשיו, תיקים חדשים שתואמים את הקריטריונים שלך ייכנסו אוטומטית לרשימת ההתאמות שלך.
            </p>
            <div style="margin: 24px 0;">
              <a href="https://advisor-bridge.lovable.app/bank/appetite"
                 style="background-color: #1a1a2e; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">
                צפה בהגדרות התיאבון
              </a>
            </div>
            <p style="font-size: 12px; color: #999;">הודעה זו נשלחה אוטומטית מ-BranchMatch</p>
          </div>
        `,
    });

    if (!send.ok) {
      return new Response(JSON.stringify({ error: "email send failed", status: send.status }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    await recordSent(key, send.id);

    return new Response(JSON.stringify({ success: true, id: send.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
