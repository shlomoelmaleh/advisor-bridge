/**
 * Seeds the canonical test users the integration suites log in as.
 * Run once after setting up a fresh test project (and its schema via
 * supabase/schema/baseline.sql):
 *
 *   npm run seed:test
 *
 * Idempotent: re-running resets passwords and re-asserts approved profiles.
 * Uses tests/helpers/testEnv.ts, so it refuses to run against production.
 */
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SERVICE_KEY } from './helpers/testEnv';

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const USERS = [
  { email: 'office@eshel-f.com', password: 'Q1234567', role: 'advisor', full_name: 'יועץ בדיקה', company: 'משרד בדיקה' },
  { email: 'shlomoelmaleh5@gmail.com', password: 'Q1234567', role: 'bank', full_name: 'בנקאי בדיקה', company: 'בנק בדיקה' },
  // Admin profile — auth-admin TC-A06 checks that a role='admin' profile exists.
  { email: 'admin@branchmatch.test', password: 'Q1234567', role: 'admin', full_name: 'מנהל בדיקה', company: 'ניהול' },
  // Pending/temporary user — auth-admin TC-B01–B03 toggle this user's approval.
  { email: '1002526737@edu-haifa.org.il', password: 'Q1234567', role: 'advisor', full_name: 'משתמש ממתין', company: 'בדיקה' },
];

async function findUserByEmail(email: string) {
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const u = data.users.find((x) => x.email?.toLowerCase() === email.toLowerCase());
    if (u) return u;
    if (data.users.length < 200) return null;
  }
}

async function seedUser(u: typeof USERS[number]) {
  let userId: string;
  const { data, error } = await admin.auth.admin.createUser({
    email: u.email,
    password: u.password,
    email_confirm: true,
    user_metadata: { full_name: u.full_name, role: u.role },
  });

  if (error) {
    // Most likely already registered — look it up and reset the known password.
    const existing = await findUserByEmail(u.email);
    if (!existing) throw new Error(`createUser failed and user not found: ${error.message}`);
    userId = existing.id;
    await admin.auth.admin.updateUserById(userId, { password: u.password, email_confirm: true });
    console.log(`↺ ${u.email} already existed (${userId}) — password reset`);
  } else {
    userId = data.user.id;
    console.log(`＋ created ${u.email} (${userId})`);
  }

  // handle_new_user creates the profile from metadata; force role + approval here.
  const { error: upErr } = await admin.from('profiles').upsert(
    { user_id: userId, full_name: u.full_name, company: u.company, role: u.role, is_approved: true },
    { onConflict: 'user_id' },
  );
  if (upErr) throw new Error(`profile upsert for ${u.email}: ${upErr.message}`);
  console.log(`  ✓ profile: role=${u.role}, approved=true`);
}

(async () => {
  console.log(`Seeding test users into ${SUPABASE_URL} ...`);
  for (const u of USERS) await seedUser(u);
  console.log('✅ Seed complete');
})().catch((e) => {
  console.error('❌', e.message);
  process.exit(1);
});
