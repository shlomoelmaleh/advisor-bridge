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

    if (!record.case_id) {
      return new Response(JSON.stringify({ error: "Missing case_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get the case to find the advisor
    const { data: caseData, error: caseError } = await supabaseAdmin
      .from("cases")
      .select("advisor_id")
      .eq("id", record.case_id)
      .single();

    if (caseError || !caseData) {
      console.error("Case not found:", caseError);
      return new Response(JSON.stringify({ error: "Case not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get advisor profile (email from auth.users)
    const { data: advisorAuth } = await supabaseAdmin.auth.admin.getUserById(
      caseData.advisor_id
    );

    if (!advisorAuth?.user?.email) {
      console.error("Advisor email not found");
      return new Response(JSON.stringify({ error: "Advisor email not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get bank name and branch from appetite
    let bankName = "בנק";
    let branchName = "";

    if (record.appetite_id) {
      const { data: appetite } = await supabaseAdmin
        .from("branch_appetites")
        .select("bank_name, branch_name")
        .eq("id", record.appetite_id)
        .single();

      bankName = appetite?.bank_name ?? "בנק";
      branchName = appetite?.branch_name ?? "";
    } else if (record.banker_id) {
      // Direct interest (no appetite) — get banker profile
      const { data: bankerProfile } = await supabaseAdmin
        .from("profiles")
        .select("company, full_name")
        .eq("user_id", record.banker_id)
        .single();

      bankName = bankerProfile?.company ?? "בנק";
      branchName = bankerProfile?.full_name ?? "";
    }

    const displayName = branchName ? `${bankName} - ${branchName}` : bankName;

    const subject = `${displayName} מתעניין בתיק שלך`;

    const html = `
      <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #1a1a2e;">🎯 התעניינות חדשה בתיק שלך</h2>
        <p style="font-size: 16px; color: #333;">
          <strong>${displayName}</strong> הביע התעניינות באחד מהתיקים שלך.
        </p>
        <p style="color: #555;">
          היכנס לפלטפורמה כדי לצפות בפרטים ולהחליט אם לאשר את ההתאמה.
        </p>
        <div style="margin: 24px 0;">
          <a href="https://advisor-bridge.lovable.app/matches"
             style="background-color: #1a1a2e; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">
            צפה בהתאמות שלך
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
        from: "MortgageBridge <onboarding@resend.dev>",
        to: [advisorAuth.user.email],
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
