import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
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
}));
