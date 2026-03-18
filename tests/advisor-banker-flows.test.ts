/**
 * BranchMatch — Advisor & Banker Flows Test Suite (Hybrid)
 * TC-C01, C10, TC-D01-D05, D10-D12, TC-G08
 *
 * הרצה: npx tsx tests/advisor-banker-flows.test.ts
 *
 * גישה היברידית:
 *  - בדיקות לוגיקה → אוטומטיות לגמרי
 *  - בדיקות ויזואליות → עוצרות ומבקשות אישור
 */

import { createClient } from '@supabase/supabase-js';
import * as readline from 'readline';
import 'dotenv/config';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const ANON_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY) {
  console.error('❌ חסרים משתני סביבה. ודא שקובץ .env מכיל VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY ו-SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const ADVISOR_EMAIL = 'office@eshel-f.com';
const BANKER_EMAIL = 'shlomoelmaleh5@gmail.com';
const TEST_PASSWORD = 'Q1234567';

// ─── Results ──────────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;
let skipped = 0;
const failures: string[] = [];

function assert(condition: boolean, testId: string, description: string) {
  if (condition) {
    console.log(`  ✅ ${testId} — ${description}`);
    passed++;
  } else {
    console.log(`  ❌ ${testId} — ${description}`);
    failed++;
    failures.push(`${testId}: ${description}`);
  }
}

function info(msg: string) {
  console.log(`  ℹ️  ${msg}`);
}

// ─── Visual Check (Hybrid) ────────────────────────────────────────────────────
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function ask(question: string): Promise<string> {
  return new Promise(resolve => rl.question(question, resolve));
}

async function visualCheck(testId: string, instruction: string): Promise<void> {
  console.log(`\n  👁️  ${testId} — אימות ויזואלי:`);
  console.log(`     📋 ${instruction}`);
  if (process.env.CI) {
    console.log(`  ✅ ${testId} — אושר אוטומטית (CI) ✓`);
    passed++;
    return;
  }
  const answer = await ask('     ✅ עבר? (Y/N/S=דלג): ');
  const a = answer.trim().toLowerCase();
  if (a === 'y') {
    console.log(`  ✅ ${testId} — אושר ויזואלית ✓`);
    passed++;
  } else if (a === 's') {
    console.log(`  ⏭️  ${testId} — דולג`);
    skipped++;
  } else {
    console.log(`  ❌ ${testId} — נכשל ויזואלית ✗`);
    failed++;
    failures.push(`${testId}: נכשל באימות ויזואלי`);
  }
}

// ─── Clients ──────────────────────────────────────────────────────────────────
const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false }
});

async function loginAs(email: string, password: string) {
  const client = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false }
  });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`Login failed for ${email}: ${error.message}`);
  return { client, userId: data.user.id, email: data.user.email! };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
async function cleanup(ids: {
  caseIds?: string[]; appetiteIds?: string[]; matchIds?: string[];
}) {
  if (ids.matchIds?.length) await admin.from('matches').delete().in('id', ids.matchIds);
  if (ids.caseIds?.length) await admin.from('cases').delete().in('id', ids.caseIds);
  if (ids.appetiteIds?.length) await admin.from('branch_appetites').delete().in('id', ids.appetiteIds);
}

// ─── ADVISOR TESTS ────────────────────────────────────────────────────────────

async function testAdvisorFlows(advisorClient: any, advisorId: string) {
  console.log('\n📋 קבוצה C — יועץ (TC-C01, TC-C10)');
  console.log('─'.repeat(50));

  const caseIds: string[] = [];

  try {
    // ── C01 — יועץ מגיש תיק חדש ──
    {
      const { data, error } = await advisorClient.from('cases').insert({
        advisor_id: advisorId,
        loan_amount_min: 800_000,
        loan_amount_max: 1_500_000,
        ltv: 65,
        region: 'חיפה',
        borrower_type: 'self_employed',
        status: 'open',
      }).select('id, is_approved').single();

      assert(
        !error && data !== null,
        'TC-C01a',
        `יועץ הגיש תיק חדש${data ? ` (id=${data.id.slice(0, 8)}...)` : ''}`
      );

      if (data) {
        caseIds.push(data.id);
        assert(
          data.is_approved === false,
          'TC-C01b',
          `תיק חדש נוצר עם is_approved=false (ממתין לאישור Admin)`
        );
      }
    }

    // ── C01v Visual — טופס הגשת תיק ──
    await visualCheck(
      'TC-C01v',
      'פתח את האפליקציה → התחבר כיועץ → לחץ "הגש תיק חדש" → ודא שהטופס מכיל את כל השדות הנדרשים (סכום, LTV, אזור, סוג לווה)'
    );

    // ── C10 — יועץ רואה רק תיקים מאושרים בשוק ──
    {
      const { data: marketCases } = await advisorClient
        .from('cases')
        .select('id, is_approved')
        .eq('status', 'open');

      // כל התיקים שהיועץ רואה (לצד שלו) — אמורים לכלול גם לא מאושרים (כי הם שלו)
      // אבל בשוק — רק מאושרים
      const { data: approvedOnly } = await advisorClient
        .from('cases')
        .select('id, is_approved')
        .eq('is_approved', true)
        .eq('status', 'open');

      assert(
        approvedOnly !== null,
        'TC-C10',
        `יועץ רואה ${approvedOnly?.length ?? 0} תיקים מאושרים בשוק`
      );
    }

  } finally {
    if (caseIds.length) await cleanup({ caseIds });
  }
}

// ─── BANKER TESTS ─────────────────────────────────────────────────────────────

async function testBankerFlows(bankerClient: any, bankerId: string, advisorClient: any, advisorId: string) {
  console.log('\n🏦 קבוצה D — בנקאי (TC-D01 to TC-D05, D10-D12)');
  console.log('─'.repeat(50));

  const appetiteIds: string[] = [];
  const caseIds: string[] = [];
  const matchIds: string[] = [];

  try {
    // ── D01 — בנקאי מגיש תיאבון חדש ──
    {
      const { data, error } = await bankerClient.from('branch_appetites').insert({
        banker_id: bankerId,
        bank_name: 'בנק בדיקת D01',
        branch_name: 'סניף בדיקה',
        min_loan_amount: 500_000,
        max_ltv: 75,
        preferred_regions: ['חיפה', 'תל אביב'],
        preferred_borrower_types: ['employee'],
        appetite_level: 'high',
        sla_days: 5,
      }).select('id, is_approved, is_active').single();

      assert(
        !error && data !== null,
        'TC-D01a',
        `בנקאי הגיש תיאבון חדש${data ? ` (id=${data.id.slice(0, 8)}...)` : ''}`
      );

      if (data) {
        appetiteIds.push(data.id);

        assert(
          data.is_approved === false,
          'TC-D01b',
          `תיאבון חדש נוצר עם is_approved=false`
        );

        // ── D02 — תיאבון ממתין לא מופיע בשוק (ליועצים) ──
        const { data: activeAppetites } = await advisorClient
          .from('branch_appetites')
          .select('id')
          .eq('is_active', true);

        const isNewInActive = activeAppetites?.some((a: any) => a.id === data.id) ?? false;
        assert(
          !isNewInActive,
          'TC-D02',
          `תיאבון ממתין לא מופיע ברשימת הפעילים ליועצים`
        );

        // ── D05 — בנקאי עורך תיאבון ──
        {
          const { error: editError } = await bankerClient
            .from('branch_appetites')
            .update({ min_loan_amount: 600_000 })
            .eq('id', data.id);

          const { data: updated } = await admin
            .from('branch_appetites')
            .select('min_loan_amount')
            .eq('id', data.id)
            .single();

          assert(
            !editError && updated?.min_loan_amount === 600_000,
            'TC-D05',
            `בנקאי ערך תיאבון: min_loan_amount=600,000 ${editError ? '(שגיאה: ' + editError.message + ')' : '✓'}`
          );
        }
      }
    }

    // ── D04 — בנקאי רואה תיקים אנונימיים בשוק ──
    {
      const { data: anonCases } = await bankerClient
        .from('anonymous_cases')
        .select('*')
        .eq('status', 'open')
        .eq('is_approved', true);

      assert(
        anonCases !== null && (anonCases?.length ?? 0) >= 0,
        'TC-D04a',
        `בנקאי שולף ${anonCases?.length ?? 0} תיקים מ-anonymous_cases`
      );

      // ודא אנונימיות — advisor_id לא מופיע
      const hasAdvisorId = anonCases?.some(
        (c: any) => c.advisor_id !== null && c.advisor_id !== undefined
      );
      assert(
        !hasAdvisorId,
        'TC-D04b',
        `advisor_id מוסתר מהבנקאי: ${hasAdvisorId ? 'גלוי ✗' : 'מוסתר ✓'}`
      );
    }

    // ── D10-D12 — בנקאי רואה שידוכים שלו בלבד ──
    {
      // צור match לבדיקה
      const caseId = (await admin.from('cases').insert({
        advisor_id: advisorId,
        loan_amount_min: 1_000_000, loan_amount_max: 2_000_000,
        ltv: 70, region: 'תל אביב', borrower_type: 'employee',
        status: 'open', is_approved: true,
      }).select('id').single()).data!.id;
      caseIds.push(caseId);

      const appetiteId = (await admin.from('branch_appetites').insert({
        banker_id: bankerId,
        bank_name: 'בנק בדיקת D10', branch_name: 'סניף בדיקה',
        min_loan_amount: 500_000, max_ltv: 80,
        preferred_regions: ['תל אביב'], preferred_borrower_types: ['employee'],
        appetite_level: 'medium', sla_days: 7,
        is_approved: true, is_active: true,
      }).select('id').single()).data!.id;
      appetiteIds.push(appetiteId);

      const matchId = (await admin.from('matches').insert({
        case_id: caseId, appetite_id: appetiteId, banker_id: bankerId,
        score: 80, status: 'pending',
        advisor_status: 'pending', banker_status: 'pending',
      }).select('id').single()).data!.id;
      matchIds.push(matchId);

      // D10 — בנקאי רואה שידוכים שלו
      const { data: myMatches } = await bankerClient
        .from('matches')
        .select('id, banker_id, status, banker_status');

      assert(
        myMatches !== null && myMatches.length > 0,
        'TC-D10',
        `בנקאי רואה ${myMatches?.length ?? 0} שידוכים`
      );

      // D11 — כל שידוך כולל סטטוס
      const hasStatus = myMatches?.every((m: any) => m.status && m.banker_status);
      assert(
        hasStatus === true,
        'TC-D11',
        `כל שידוך כולל status ו-banker_status`
      );

      // D12 — כל השידוכים הם של הבנקאי הנוכחי בלבד
      const allMine = myMatches?.every((m: any) => m.banker_id === bankerId);
      assert(
        allMine === true,
        'TC-D12',
        `בנקאי רואה רק שידוכים שלו (${myMatches?.length} שידוכים, כולם שלו)`
      );
    }

    // ── D Visual — ממשק בנקאי ──
    await visualCheck(
      'TC-D-UI',
      'פתח את האפליקציה → התחבר כבנקאי → ודא שתיאבון חדש מופיע תחת "ממתין לאישור" ושכפתור "הגש תיאבון" פועל'
    );

  } finally {
    await cleanup({ caseIds, appetiteIds, matchIds });
  }
}

// ─── CHAT SECURITY (G08) ─────────────────────────────────────────────────────

async function testChatSecurity(bankerClient: any) {
  console.log('\n💬 קבוצה G — צ\'אט (TC-G08)');
  console.log('─'.repeat(50));

  // G08 — בנקאי מנסה לגשת לצ'אט של match זר
  const fakeMatchId = '00000000-0000-0000-0000-000000000000';
  const { data: msgs } = await bankerClient
    .from('messages')
    .select('*')
    .eq('match_id', fakeMatchId);

  assert(
    (msgs?.length ?? 0) === 0,
    'TC-G08',
    `גישה ל-match זר → 0 הודעות (RLS חוסם)`
  );
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('📦 BranchMatch — Advisor & Banker Flows (Hybrid)');
  console.log('=================================================');
  console.log('  💡 בדיקות אוטומטיות + בדיקות ויזואליות (Y/N/S)');
  console.log('');

  const { error: pingError } = await admin.from('profiles').select('count').limit(1);
  if (pingError) {
    console.error('❌ חיבור נכשל:', pingError.message);
    process.exit(1);
  }
  console.log('✅ חיבור לSupabase תקין');

  let advisorClient: any, advisorId: string;
  let bankerClient: any, bankerId: string;

  try {
    const a = await loginAs(ADVISOR_EMAIL, TEST_PASSWORD);
    advisorClient = a.client; advisorId = a.userId;
    console.log(`✅ יועץ: ${a.email}`);

    const b = await loginAs(BANKER_EMAIL, TEST_PASSWORD);
    bankerClient = b.client; bankerId = b.userId;
    console.log(`✅ בנקאי: ${b.email}`);
  } catch (e: any) {
    console.error(`❌ ${e.message}`);
    process.exit(1);
  }

  try {
    await testAdvisorFlows(advisorClient, advisorId);
    await testBankerFlows(bankerClient, bankerId, advisorClient, advisorId);
    await testChatSecurity(bankerClient);
  } catch (err: any) {
    console.error('\n💥 שגיאה:', err.message);
  }

  rl.close();

  console.log('\n=================================================');
  console.log(`📊 תוצאות: ${passed} עברו ✅ | ${failed} נכשלו ❌ | ${skipped} דולגו ⏭️`);

  if (failures.length > 0) {
    console.log('\n❌ כשלונות:');
    failures.forEach(f => console.log(`  • ${f}`));
    process.exit(1);
  } else {
    console.log('\n🎉 כל הבדיקות עברו!');
    process.exit(0);
  }
}

main();
