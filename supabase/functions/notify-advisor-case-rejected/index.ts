import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    const newRecord = payload.record;
    const oldRecord = payload.old_record;

    // Only fire when status changes TO 'rejected'
    if (!newRecord || !oldRecord) {
      return new Response(JSON.stringify({ skipped: "no records" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (oldRecord.status === "rejected" || newRecord.status !== "rejected") {
      return new Response(JSON.stringify({ skipped: "not a rejection event" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Get advisor email
    const { data: advisorAuth } = await supabaseAdmin.auth.admin.getUserById(newRecord.advisor_id);

    if (!advisorAuth?.user?.email) {
      console.error("Advisor email not found");
      return new Response(JSON.stringify({ error: "Advisor email not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const subject = "עדכון על תיק שהגשת — BranchMatch";

    const html = `
      <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #c0392b;">📋 עדכון על תיק שהגשת</h2>
        <p style="font-size: 16px; color: #333;">
          לצערנו, התיק שהגשת נדחה על ידי צוות BranchMatch.
        </p>
        <p style="color: #555;">
          ניתן להגיש תיק מחודש בכל עת דרך הפלטפורמה.
        </p>
        <div style="margin: 24px 0;">
          <a href="https://advisor-bridge.lovable.app/advisor/submit-case"
             style="background-color: #1a1a2e; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">
            הגש תיק חדש
          </a>
        </div>
        <p style="font-size: 12px; color: #999;">הודעה זו נשלחה אוטומטית מ-MortgageBridge</p>
      </div>
    `;

    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "BranchMatch <noreply@eshel-f.com>",
        to: [advisorAuth.user.email],
        subject,
        html,
      }),
    });

    const emailResult = await emailRes.json();
    console.log("Rejection email sent:", emailResult);

    return new Response(JSON.stringify({ success: true, email: emailResult }), {
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
