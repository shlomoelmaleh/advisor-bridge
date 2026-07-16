import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://advisor-bridge.lovable.app",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Client-invoked (admin rejects an appetite in the dashboard) — require a
    // valid user JWT and verify admin against the DB (is_admin SECURITY DEFINER),
    // same pattern as delete-user. verify_jwt stays false only for CORS preflight.
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: isAdmin, error: adminError } = await supabaseAdmin
      .rpc("is_admin", { _user_id: user.id });
    if (adminError || !isAdmin) {
      console.error("Not admin:", user.id, adminError?.message);
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { appetiteId } = await req.json();

    if (!appetiteId) {
      return new Response(JSON.stringify({ error: "Missing appetiteId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // שלוף פרטי התיאבון + הבנקאי
    const { data: appetite, error: appetiteError } = await supabaseAdmin
      .from("branch_appetites")
      .select("bank_name, branch_name, banker_id")
      .eq("id", appetiteId)
      .single();

    if (appetiteError || !appetite) {
      console.error("Appetite not found:", appetiteError);
      return new Response(JSON.stringify({ error: "Appetite not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // שלוף אימייל הבנקאי
    const { data: bankerAuth } = await supabaseAdmin.auth.admin.getUserById(
      appetite.banker_id
    );

    if (!bankerAuth?.user?.email) {
      console.error("Banker email not found");
      return new Response(JSON.stringify({ error: "Banker email not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const branchDisplay = appetite.branch_name
      ? `${appetite.bank_name} — ${appetite.branch_name}`
      : appetite.bank_name;

    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "BranchMatch <noreply@eshel-f.com>",
        to: [bankerAuth.user.email],
        subject: `אות התיאבון שלך נדחה — ${branchDisplay}`,
        html: `
          <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
            <h2 style="color: #dc2626;">אות התיאבון שלך נדחה</h2>
            <p style="font-size: 16px; color: #333;">
              אות התיאבון שהגדרת עבור <strong>${branchDisplay}</strong> נדחה על ידי צוות BranchMatch.
            </p>
            <p style="color: #555;">
              ניתן להגדיר אות תיאבון חדש עם פרמטרים מעודכנים.
            </p>
            <div style="margin: 24px 0;">
              <a href="https://advisor-bridge.lovable.app"
                 style="background-color: #1a1a2e; color: white; padding: 12px 24px; 
                        text-decoration: none; border-radius: 8px; font-weight: bold;">
                כניסה למערכת
              </a>
            </div>
            <p style="font-size: 12px; color: #999;">הודעה זו נשלחה אוטומטית מ-BranchMatch</p>
          </div>
        `,
      }),
    });

    const emailResult = await emailRes.json();
    console.log("Email sent:", emailResult);

    return new Response(JSON.stringify({ success: true }), {
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