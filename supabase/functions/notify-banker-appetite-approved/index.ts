import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

  try {
    const payload = await req.json();
    const record = payload.record ?? payload;

    if (!record.banker_id) {
      return new Response(JSON.stringify({ error: "Missing banker_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Get banker email from auth
    const { data: bankerAuth } = await supabaseAdmin.auth.admin.getUserById(record.banker_id);

    if (!bankerAuth?.user?.email) {
      console.error("Banker email not found");
      return new Response(JSON.stringify({ error: "Banker email not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use bank_name and branch_name directly from the record
    const bankName = record.bank_name ?? "בנק";
    const branchName = record.branch_name ?? "";
    const displayName = branchName ? `${bankName} - ${branchName}` : bankName;

    const subject = `✅ אות התיאבון שלך אושר — ${displayName}`;

    const html = `
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
        to: [bankerAuth.user.email],
        subject,
        html,
      }),
    });

    const emailResult = await emailRes.json();
    console.log("Email sent:", emailResult);

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
