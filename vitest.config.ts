import { defineConfig } from 'vitest/config';
import path from 'path';

// Vitest runs ONLY the pure-logic unit tests under tests/unit.
// The other files in tests/ are standalone integration scripts that hit a LIVE
// Supabase project (they create/delete real users and prompt interactively) — they
// must never be picked up by the runner. include is scoped and exclude is explicit.
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['tests/unit/**/*.test.ts'],
    exclude: ['tests/*.test.ts', 'node_modules/**', 'dist/**'],
  },
});
