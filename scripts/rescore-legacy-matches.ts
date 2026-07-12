/**
 * BranchMatch — Rescore legacy matches
 *
 * רקע: עד מיגרציית 20260602120000, תאבונות עם מערכי העדפות ריקים/NULL קיבלו
 * 0 נקודות על borrower_type ו-region (במקום "אין העדפה = מתאים לכולם"),
 * כלומר ציון נמוך ב-35 נקודות. תיקים שאושרו לפני התיקון עשויים להיות עם
 * ציונים שגויים, וזוגות שהיו אמורים לעבור את סף ה-40 בכלל לא קיימים כ-matches.
 *
 * הסקריפט מריץ מחדש את מנוע ההתאמות (internal_run_matching_for_case) על כל
 * התיקים הפתוחים והמאושרים. ההרצה היא UPSERT — התאמות קיימות מקבלות ציון
 * מעודכן, וזוגות חדשים מעל הסף נוצרים.
 *
 * ⚠️ אזהרה: יצירת match חדש עלולה להפעיל webhooks ששולחים מיילים אמיתיים
 * ליועצים/בנקאים. ברירת המחדל היא dry-run; להרצה אמיתית הוסף --apply.
 *
 * הרצה:
 *   npx tsx scripts/rescore-legacy-matches.ts           # dry-run — רק מציג מה יקרה
 *   npx tsx scripts/rescore-legacy-matches.ts --apply   # מריץ בפועל
 */

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌ חסרים משתני סביבה: VITE_SUPABASE_URL ו-SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const APPLY = process.argv.includes('--apply');
const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

async function main() {
  console.log('🔄 BranchMatch — Rescore legacy matches');
  console.log(`מצב: ${APPLY ? '⚡ APPLY — מריץ בפועל' : '🔍 DRY-RUN — תצוגה בלבד (הוסף --apply להרצה)'}`);
  console.log('=========================================');

  const { data: cases, error } = await admin
    .from('cases')
    .select('id, created_at, region, borrower_type, loan_amount_min, ltv')
    .eq('status', 'open')
    .eq('is_approved', true)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('❌ שליפת תיקים נכשלה:', error.message);
    process.exit(1);
  }
  if (!cases || cases.length === 0) {
    console.log('אין תיקים פתוחים ומאושרים — אין מה להריץ.');
    return;
  }

  console.log(`נמצאו ${cases.length} תיקים פתוחים ומאושרים.\n`);

  const { count: matchesBefore } = await admin
    .from('matches')
    .select('id', { count: 'exact', head: true });
  console.log(`התאמות קיימות לפני הרצה: ${matchesBefore}\n`);

  if (!APPLY) {
    for (const c of cases) {
      console.log(`  • תיק ${c.id} (נוצר ${c.created_at}) — יורץ עליו matching מחדש`);
    }
    console.log('\n🔍 DRY-RUN הסתיים. להרצה בפועל: npx tsx scripts/rescore-legacy-matches.ts --apply');
    console.log('⚠️ שים לב: הרצה בפועל עלולה לשלוח מיילי התראה אמיתיים על התאמות חדשות.');
    return;
  }

  let ok = 0, failedCount = 0;
  for (const c of cases) {
    const { error: rpcError } = await admin.rpc('internal_run_matching_for_case', {
      p_case_id: c.id,
    });
    if (rpcError) {
      console.log(`  ❌ תיק ${c.id}: ${rpcError.message}`);
      failedCount++;
    } else {
      console.log(`  ✅ תיק ${c.id}: matching הורץ מחדש`);
      ok++;
    }
  }

  const { count: matchesAfter } = await admin
    .from('matches')
    .select('id', { count: 'exact', head: true });

  console.log('\n=========================================');
  console.log(`📊 הצליחו: ${ok} | נכשלו: ${failedCount}`);
  console.log(`התאמות: ${matchesBefore} → ${matchesAfter} (${(matchesAfter ?? 0) - (matchesBefore ?? 0)} חדשות)`);
}

main();
