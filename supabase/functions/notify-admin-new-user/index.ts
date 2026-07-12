import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

serve(async (req) => {
  const { record } = await req.json()
  
  const adminEmail = 'shlomo.elmaleh@gmail.com'
  const userName = record.full_name || 'משתמש חדש'
  const userRole = record.role === 'advisor' ? 'יועץ משכנתא' : 'בנקאי'

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
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
    }),
  })

  return new Response(JSON.stringify({ ok: res.ok }), {
    headers: { 'Content-Type': 'application/json' },
  })
})