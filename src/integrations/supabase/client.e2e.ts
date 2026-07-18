// E2E-only Supabase client. In `--mode test` (npm run dev:e2e / build:e2e) a
// conditional Vite alias resolves every import of "@/integrations/supabase/client"
// to this file instead of the generated production client (see vite.config.ts).
// Config comes from .env.test, which Vite loads automatically in test mode.
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// Exact allowlist: the dedicated test project and nothing else. "Not prod" is
// not sufficient — any unknown ref must also refuse to start.
// Second line of defense behind the vite.config.ts test-mode gate; exact
// per-variable checks only (no scanning of import.meta.env — scanning here
// would run after values were already served, and the object reference could
// make the bundler inline otherwise-unused variables). Errors never include
// env VALUES, only variable names.
const TEST_PROJECT_REF = 'mijlphxzvyyvknulqozw';
const TEST_PROJECT_URL = `https://${TEST_PROJECT_REF}.supabase.co`;

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const SUPABASE_PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID;
const ADMIN_EMAILS = import.meta.env.VITE_ADMIN_EMAILS;

if (SUPABASE_URL !== TEST_PROJECT_URL) {
  throw new Error(
    `client.e2e: refusing to start — VITE_SUPABASE_URL is not the dedicated test project (expected ${TEST_PROJECT_URL}). Check .env.test.`,
  );
}
if (SUPABASE_PROJECT_ID !== TEST_PROJECT_REF) {
  throw new Error(
    'client.e2e: refusing to start — VITE_SUPABASE_PROJECT_ID is not the dedicated test project ref. Override it in .env.test (the base .env leaks through otherwise).',
  );
}
if (ADMIN_EMAILS !== '') {
  throw new Error(
    'client.e2e: refusing to start — VITE_ADMIN_EMAILS must be overridden to empty in .env.test (the base .env leaks through otherwise).',
  );
}
if (!SUPABASE_PUBLISHABLE_KEY) {
  throw new Error('client.e2e: missing VITE_SUPABASE_PUBLISHABLE_KEY — check .env.test.');
}

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
});
