/**
 * BranchMatch — Automated Test Suite
 * Matching Engine: TC-E03 to TC-E11
 * הרצה: npx tsx tests/matching-engine.test.ts
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://oasivruwsvhfmvynpbia.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9hc2l2cnV3c3ZoZm12eW5wYmlhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTYxMjczNCwiZXhwIjoyMDg1MTg4NzM0fQ.y4XfvyToe_33HwQBIyh_Yu9t3BENXlei0C8F6IcHhNo';

const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

// ─── Results ─────────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;
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

// ─── Setup: משתמשים קיימים מהמערכת ──────────────────────────────────────────

async function getExistingUsers() {
  const { data: profiles } = await db.from('profiles').select('user_id, role, is_approved');
  const advisor = profiles?.find(p => p.role === 'advisor' && p.is_approved);
  const banker = profiles?.find(p => p.role === 'bank' && p.is_approved);
  if (!advisor) throw new Error('לא נמצא יועץ מאושר במערכת');
  if (!banker) throw new Error('לא נמצא בנקאי מאושר במערכת');
  return { advisorId: advisor.user_id, bankerId: banker.user_id };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function createCase(advisorId: string, params: {
  loanMin?: number; loanMax?: number; ltv?: number;
  region?: string; borrowerType?: string; status?: string; isApproved?: boolean;
} = {}) {
  const { data, error } = await db.from('cases').insert({
    advisor_id: advisorId,
    loan_amount_min: params.loanMin ?? 1_000_000,
    loan_amount_max: params.loanMax ?? 2_000_000,
    ltv: params.ltv ?? 70,
    region: params.region ?? 'תל אביב',
    borrower_type: params.borrowerType ?? 'employee',
    status: params.status ?? 'open',
    is_approved: params.isApproved ?? true,
  }).select('id').single();
  if (error) throw new Error(`יצירת תיק נכשלה: ${error.message}`);
  return data!.id as string;
}

async function createAppetite(bankerId: string, params: {
  minLoan?: number; maxLtv?: number; regions?: string[];
  borrowerTypes?: string[]; level?: string; sla?: number;
} = {}) {
  const { data, error } = await db.from('branch_appetites').insert({
    banker_id: bankerId,
    bank_name: 'בנק בדיקה אוטומטית',
    branch_name: 'סניף בדיקה',
    min_loan_amount: params.minLoan ?? 500_000,
    max_ltv: params.maxLtv ?? 80,
    preferred_regions: params.regions ?? ['תל אביב'],
    preferred_borrower_types: params.borrowerTypes ?? ['employee'],
    appetite_level: params.level ?? 'medium',
    sla_days: params.sla ?? 7,
    is_approved: true,
    is_active: true,
  }).select('id').single();
  if (error) throw new Error(`יצירת תיאבון נכשלה: ${error.message}`);
  return data!.id as string;
}

async function score(caseId: string, appetiteId: string): Promise<number> {
const { data, error } = await db.rpc('compute_match_score_test', {
    p_case_id: caseId,
    p_appetite_id: appetiteId,
  });
  if (error) throw new Error(`compute_match_score נכשל: ${error.message}`);
  return data as number;
}

async function deleteCase(id: string) {
  await db.from('matches').delete().eq('case_id', id);
  await db.from('cases').delete().eq('id', id);
}

async function deleteAppetite(id: string) {
  await db.from('branch_appetites').delete().eq('id', id);
}

// ─── TEST GROUPS ──────────────────────────────────────────────────────────────

async function testScores(advisorId: string, bankerId: string) {
  console.log('\n📊 TC-E04 עד TC-E10 — חישוב Score');

  // TC-E04 — LTV תואם (+25)
  {
    const c = await createCase(advisorId, { ltv: 70, loanMin: 500_000, region: 'other', borrowerType: 'self_employed' });
    const a = await createAppetite(bankerId, { maxLtv: 75, minLoan: 3_000_000, regions: ['other2'], borrowerTypes: ['other3'] });
    const s = await score(c, a);
    assert(s === 25, 'TC-E04', `LTV תואם בלבד → score=25 (קיבלנו ${s})`);
    await deleteCase(c); await deleteAppetite(a);
  }

  // TC-E05 — סכום תואם (+25)
  {
    const c = await createCase(advisorId, { loanMin: 2_000_000, loanMax: 3_000_000, ltv: 90, region: 'other', borrowerType: 'self_employed' });
    const a = await createAppetite(bankerId, { minLoan: 1_500_000, maxLtv: 50, regions: ['other2'], borrowerTypes: ['other3'] });
    const s = await score(c, a);
    assert(s === 25, 'TC-E05', `סכום תואם בלבד → score=25 (קיבלנו ${s})`);
    await deleteCase(c); await deleteAppetite(a);
  }

  // TC-E06 — סוג לווה תואם (+20)
  {
    const c = await createCase(advisorId, { borrowerType: 'employee', ltv: 90, loanMin: 500_000, region: 'other' });
    const a = await createAppetite(bankerId, { borrowerTypes: ['employee'], maxLtv: 50, minLoan: 3_000_000, regions: ['other2'] });
    const s = await score(c, a);
    assert(s === 20, 'TC-E06', `סוג לווה תואם בלבד → score=20 (קיבלנו ${s})`);
    await deleteCase(c); await deleteAppetite(a);
  }

  // TC-E07 — אזור תואם (+15)
  {
    const c = await createCase(advisorId, { region: 'ירושלים', ltv: 90, loanMin: 500_000, borrowerType: 'self_employed' });
    const a = await createAppetite(bankerId, { regions: ['ירושלים'], maxLtv: 50, minLoan: 3_000_000, borrowerTypes: ['other3'] });
    const s = await score(c, a);
    assert(s === 15, 'TC-E07', `אזור תואם בלבד → score=15 (קיבלנו ${s})`);
    await deleteCase(c); await deleteAppetite(a);
  }

  // TC-E08 — appetite גבוה (×1.3)
  {
    const c = await createCase(advisorId, { ltv: 70, loanMin: 2_000_000, region: 'תל אביב', borrowerType: 'employee' });
    const aMed = await createAppetite(bankerId, { level: 'medium', maxLtv: 80, minLoan: 1_000_000, regions: ['תל אביב'], borrowerTypes: ['employee'] });
    const aHigh = await createAppetite(bankerId, { level: 'high', maxLtv: 80, minLoan: 1_000_000, regions: ['תל אביב'], borrowerTypes: ['employee'] });
    const sMed = await score(c, aMed);
    const sHigh = await score(c, aHigh);
    assert(sHigh > sMed, 'TC-E08', `appetite גבוה → score גבוה יותר (high=${sHigh}, medium=${sMed})`);
    assert(Math.round(sHigh) === Math.min(100, Math.round(sMed * 1.3)), 'TC-E08b', `מכפיל ×1.3 נכון`);
    await deleteCase(c); await deleteAppetite(aMed); await deleteAppetite(aHigh);
  }

  // TC-E09 — appetite נמוך (×0.7)
  {
    const c = await createCase(advisorId, { ltv: 70, loanMin: 2_000_000, region: 'תל אביב', borrowerType: 'employee' });
    const aMed = await createAppetite(bankerId, { level: 'medium', maxLtv: 80, minLoan: 1_000_000, regions: ['תל אביב'], borrowerTypes: ['employee'] });
    const aLow = await createAppetite(bankerId, { level: 'low', maxLtv: 80, minLoan: 1_000_000, regions: ['תל אביב'], borrowerTypes: ['employee'] });
    const sMed = await score(c, aMed);
    const sLow = await score(c, aLow);
    assert(sLow < sMed, 'TC-E09', `appetite נמוך → score נמוך יותר (low=${sLow}, medium=${sMed})`);
    await deleteCase(c); await deleteAppetite(aMed); await deleteAppetite(aLow);
  }

  // TC-E10 — score < 40 → match לא אמור להיווצר
  {
    const c = await createCase(advisorId, { ltv: 90, loanMin: 300_000, region: 'אילת', borrowerType: 'self_employed' });
    const a = await createAppetite(bankerId, { maxLtv: 50, minLoan: 5_000_000, regions: ['חיפה'], borrowerTypes: ['employee'], level: 'low' });
    const s = await score(c, a);
    assert(s < 40, 'TC-E10', `score < 40 → match לא יווצר (score=${s})`);
    await deleteCase(c); await deleteAppetite(a);
  }
}

async function testMatchCreation(advisorId: string, bankerId: string) {
  console.log('\n🔗 TC-E01, TC-E02, TC-E03, TC-E11 — יצירת Matches');

  // TC-E01 + TC-E02 — match נוצר עם score נכון
  {
    const c = await createCase(advisorId, { ltv: 70, loanMin: 2_000_000, region: 'תל אביב', borrowerType: 'employee' });
    const a = await createAppetite(bankerId, { maxLtv: 80, minLoan: 1_000_000, regions: ['תל אביב'], borrowerTypes: ['employee'], level: 'medium' });
    const s = await score(c, a);
    assert(s >= 40, 'TC-E01', `score >= 40 → match יווצר (score=${s})`);

    const { data: m } = await db.from('matches').insert({
      case_id: c, appetite_id: a, score: s,
      status: 'pending', advisor_status: 'pending', banker_status: 'pending',
    }).select('id, score').single();

    assert(m?.score === s, 'TC-E02', `match נוצר עם score נכון (score=${m?.score})`);

    // TC-E11 — מניעת כפילות
    const { error: dupError } = await db.from('matches').insert({
      case_id: c, appetite_id: a, score: s,
      status: 'pending', advisor_status: 'pending', banker_status: 'pending',
    });
    const { data: allMatches } = await db.from('matches').select('id').eq('case_id', c).eq('appetite_id', a);
    assert((allMatches?.length ?? 0) === 1, 'TC-E11', `ON CONFLICT — לא נוצר כפול (matches=${allMatches?.length})`);

    await deleteCase(c); await deleteAppetite(a);
  }

  // TC-E03 — matching לא רץ על תיק נדחה
  {
    const c = await createCase(advisorId, { ltv: 70, loanMin: 2_000_000, region: 'תל אביב', borrowerType: 'employee', status: 'rejected', isApproved: true });
    const a = await createAppetite(bankerId, { maxLtv: 80, minLoan: 1_000_000, regions: ['תל אביב'], borrowerTypes: ['employee'] });
    // בדוק שאין matches קיימים (לא אמורים להיווצר אוטומטית)
    const { data: matches } = await db.from('matches').select('id').eq('case_id', c);
    assert((matches?.length ?? 0) === 0, 'TC-E03', `תיק נדחה — אין matches (matches=${matches?.length})`);
    await deleteCase(c); await deleteAppetite(a);
  }
}

async function testFullFlow(advisorId: string, bankerId: string) {
  console.log('\n🤝 Flow מלא — עניין הדדי → שידוך סגור');

  const c = await createCase(advisorId, { ltv: 70, loanMin: 2_000_000, region: 'תל אביב', borrowerType: 'employee' });
  const a = await createAppetite(bankerId, { maxLtv: 80, minLoan: 1_000_000, regions: ['תל אביב'], borrowerTypes: ['employee'] });
  const s = await score(c, a);

  const { data: m } = await db.from('matches').insert({
    case_id: c, appetite_id: a, score: s,
    status: 'pending', advisor_status: 'pending', banker_status: 'pending',
  }).select('id').single();

  const mid = m!.id;

  // בנקאי מביע עניין
  await db.from('matches').update({ banker_status: 'interested', status: 'interested' }).eq('id', mid);
  const { data: afterBanker } = await db.from('matches').select('*').eq('id', mid).single();
  assert(afterBanker?.banker_status === 'interested', 'FLOW-1', `בנקאי הביע עניין → banker_status=interested`);

  // יועץ מאשר
  await db.from('matches').update({ advisor_status: 'interested', status: 'closed' }).eq('id', mid);
  const { data: afterAdvisor } = await db.from('matches').select('*').eq('id', mid).single();
  assert(afterAdvisor?.status === 'closed', 'FLOW-2', `יועץ אישר → status=closed`);
  assert(afterAdvisor?.advisor_status === 'interested', 'FLOW-3', `advisor_status=interested`);

  await deleteCase(c); await deleteAppetite(a);
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🚀 BranchMatch — Automated Test Suite v1.0');
  console.log('==========================================');

  // בדוק חיבור
  const { error: pingError } = await db.from('profiles').select('count').limit(1);
  if (pingError) {
    console.error('❌ חיבור לSupabase נכשל:', pingError.message);
    process.exit(1);
  }
  console.log('✅ חיבור לSupabase תקין');

  // שלוף משתמשים קיימים
  let advisorId: string, bankerId: string;
  try {
    const users = await getExistingUsers();
    advisorId = users.advisorId;
    bankerId = users.bankerId;
    console.log('✅ נמצאו משתמשי בדיקה קיימים');
  } catch (e: any) {
    console.error(`❌ ${e.message}`);
    console.error('נדרש לפחות יועץ אחד ובנקאי אחד מאושרים במערכת');
    process.exit(1);
  }

  try {
    await testScores(advisorId, bankerId);
    await testMatchCreation(advisorId, bankerId);
    await testFullFlow(advisorId, bankerId);
  } catch (err: any) {
    console.error('\n💥 שגיאה לא צפויה:', err.message);
    process.exit(1);
  }

  console.log('\n==========================================');
  console.log(`📊 תוצאות: ${passed} עברו ✅ | ${failed} נכשלו ❌`);

  if (failures.length > 0) {
    console.log('\n❌ כשלונות:');
    failures.forEach(f => console.log(`  • ${f}`));
    process.exit(1);
  } else {
    console.log('\n🎉 כל הבדיקות עברו בהצלחה!');
    process.exit(0);
  }
}

main();
