/**
 * Shared environment loader + safety guard for the integration test scripts.
 *
 * These suites mutate real data (create/delete users, insert cases/appetites,
 * run the matching engine). They must therefore target a DEDICATED test Supabase
 * project — never production. This module enforces that:
 *
 *   1. Config is read from `.env.test` ONLY (not `.env`, which points at prod).
 *   2. If the resolved URL is the production project ref, we refuse to run.
 *   3. Missing vars fail fast with a clear, Hebrew instruction.
 *
 * Setup: see tests/README.md.
 */
import { config } from 'dotenv';
import { existsSync } from 'fs';
import { resolve } from 'path';

// The production project ref — integration tests must never point here.
const PROD_PROJECT_REF = 'oasivruwsvhfmvynpbia';

const ENV_TEST_PATH = resolve(process.cwd(), '.env.test');

if (!existsSync(ENV_TEST_PATH)) {
  console.error(
    '❌ חסר קובץ .env.test — בדיקות ה-integration חייבות פרויקט Supabase נפרד לבדיקות.\n' +
    '   צור פרויקט בדיקות והעתק את .env.test.example ל-.env.test עם המפתחות שלו. ראה tests/README.md',
  );
  process.exit(1);
}

config({ path: ENV_TEST_PATH });

export const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
export const ANON_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';
export const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Test-user credentials — read from .env.test, never hardcoded in the suites.
// The seeded users (tests/seed-test-users.ts) all share TEST_PASSWORD.
export const TEST_PASSWORD = process.env.TEST_PASSWORD || '';
export const TEST_ADVISOR_EMAIL = process.env.TEST_ADVISOR_EMAIL || '';
export const TEST_BANKER_EMAIL = process.env.TEST_BANKER_EMAIL || '';
export const TEST_ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL || '';
export const TEST_PENDING_EMAIL = process.env.TEST_PENDING_EMAIL || '';

if (SUPABASE_URL.includes(PROD_PROJECT_REF)) {
  console.error(
    '❌ סירוב: .env.test מצביע על פרויקט הפרודקשן! בדיקות ה-integration משנות נתונים אמיתיים\n' +
    '   ואסור להריץ אותן מול פרודקשן. הגדר ב-.env.test פרויקט Supabase נפרד לבדיקות.',
  );
  process.exit(1);
}

if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY) {
  console.error(
    '❌ חסרים משתני סביבה ב-.env.test:\n' +
    '   VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY, SUPABASE_SERVICE_ROLE_KEY',
  );
  process.exit(1);
}

if (!TEST_PASSWORD || !TEST_ADVISOR_EMAIL || !TEST_BANKER_EMAIL || !TEST_ADMIN_EMAIL || !TEST_PENDING_EMAIL) {
  console.error(
    '❌ חסרים פרטי משתמשי בדיקה ב-.env.test:\n' +
    '   TEST_PASSWORD, TEST_ADVISOR_EMAIL, TEST_BANKER_EMAIL, TEST_ADMIN_EMAIL, TEST_PENDING_EMAIL\n' +
    '   ראה .env.test.example.',
  );
  process.exit(1);
}
