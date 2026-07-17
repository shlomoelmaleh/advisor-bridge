// E2E-only Supabase client. In `--mode test` (npm run dev:e2e / build:e2e) a
// conditional Vite alias resolves every import of "@/integrations/supabase/client"
// to this file instead of the generated production client (see vite.config.ts).
// Config comes from .env.test, which Vite loads automatically in test mode.
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// Exact allowlist: the dedicated test project and nothing else. "Not prod" is
// not sufficient — any unknown ref must also refuse to start.
const TEST_PROJECT_URL = 'https://mijlphxzvyyvknulqozw.supabase.co';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (SUPABASE_URL !== TEST_PROJECT_URL) {
  throw new Error(
    `client.e2e: refusing to start — VITE_SUPABASE_URL is not the dedicated test project (expected ${TEST_PROJECT_URL}). Check .env.test.`,
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
