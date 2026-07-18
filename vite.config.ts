import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

const TEST_PROJECT_REF = "mijlphxzvyyvknulqozw";
const TEST_PROJECT_URL = `https://${TEST_PROJECT_REF}.supabase.co`;
const PROD_PROJECT_REF = "oasivruwsvhfmvynpbia";

// Closed allowlist of VITE_ names permitted in test mode. Every VITE_ variable
// is exposed to the browser, so any name NOT listed here fails the gate — even
// if its value looks harmless. Adding a new public variable requires an
// explicit decision to extend this list (and an override in .env.test).
const TEST_MODE_ALLOWED_VITE_KEYS = new Set([
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_PUBLISHABLE_KEY",
  "VITE_SUPABASE_PROJECT_ID",
  "VITE_ADMIN_EMAILS",
]);

/**
 * Isolation gate for `--mode test` (dev:e2e / build:e2e), enforced BEFORE any
 * code is served or bundled. Vite always layers the base .env under .env.test,
 * so a VITE_ key that .env.test does not override silently leaks its
 * production value into the browser env (found live by the browser-phase
 * safety check). A failure here stops both the dev server and the build.
 * Error messages name the offending VARIABLE only — values are never printed.
 */
function assertTestEnvIsolated(mode: string): void {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const problems: string[] = [];
  if (env.VITE_SUPABASE_URL !== TEST_PROJECT_URL) {
    problems.push("VITE_SUPABASE_URL is not exactly the dedicated test project URL");
  }
  if (env.VITE_SUPABASE_PROJECT_ID !== TEST_PROJECT_REF) {
    problems.push("VITE_SUPABASE_PROJECT_ID is not exactly the dedicated test project ref (override it in .env.test)");
  }
  if (env.VITE_ADMIN_EMAILS !== "") {
    problems.push("VITE_ADMIN_EMAILS must be overridden to empty in .env.test");
  }
  for (const [name, value] of Object.entries(env)) {
    if (!TEST_MODE_ALLOWED_VITE_KEYS.has(name)) {
      problems.push(
        `${name} is not in the test-mode VITE_ allowlist — add it to TEST_MODE_ALLOWED_VITE_KEYS (vite.config.ts) and override it in .env.test, or remove it`,
      );
    }
    if (typeof value === "string" && value.includes(PROD_PROJECT_REF)) {
      problems.push(`${name} contains the production project ref`);
    }
    if (/SUPABASE_SERVICE_ROLE|SUPABASE_SECRET/.test(name)) {
      problems.push(`${name} must never be exposed as a VITE_ variable`);
    }
  }
  if (problems.length > 0) {
    throw new Error(
      `e2e env isolation failed — refusing to serve or build (values are never printed):\n- ${problems.join("\n- ")}`,
    );
  }
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  if (mode === "test") assertTestEnvIsolated(mode);
  return {
    server: {
      host: "::",
      port: 8080,
    },
    plugins: [
      react(),
      mode === 'development' &&
      componentTagger(),
    ].filter(Boolean),
    resolve: {
      alias: [
        // In `--mode test` (dev:e2e / build:e2e) every import of the generated
        // Supabase client resolves to the e2e client instead, which refuses to
        // start unless it points at the dedicated test project. The generated
        // client.ts stays untouched and is still what production builds bundle.
        ...(mode === "test"
          ? [
              {
                find: "@/integrations/supabase/client",
                replacement: path.resolve(
                  __dirname,
                  "./src/integrations/supabase/client.e2e.ts",
                ),
              },
            ]
          : []),
        { find: "@", replacement: path.resolve(__dirname, "./src") },
      ],
    },
  };
});
