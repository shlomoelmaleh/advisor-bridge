/**
 * Generates supabase/schema/baseline.sql — a full, from-scratch DDL of the public
 * schema (plus the auth.users signup trigger) pulled from the LINKED production
 * project via the Management API (`supabase db query`). This exists because the
 * base tables were created in Studio/Lovable and never captured as migrations, so
 * a fresh project cannot be built from supabase/migrations alone.
 *
 * Notify/webhook triggers (supabase_functions.http_request) are intentionally
 * EXCLUDED: they hardcode the prod URL + service key and would make a test project
 * call production edge functions.
 *
 * Run: node scripts/generate-baseline.cjs
 */
const { execSync } = require('child_process');
const fs = require('fs');

function q(sql) {
  const oneLine = sql.replace(/\s+/g, ' ').trim();
  const out = execSync(`npx supabase db query --linked ${JSON.stringify(oneLine)}`, {
    encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024,
  });
  return JSON.parse(out).rows;
}

const parts = [];
const P = (s) => parts.push(s);

P(`-- ============================================================================
-- BranchMatch — baseline schema (auto-generated from production by
-- scripts/generate-baseline.cjs). Run ONCE against a fresh test project's SQL
-- editor to reproduce the production schema. Notify/webhook triggers are omitted
-- on purpose. Do NOT run this against production.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_net;
`);

// ── Sequences (must exist before tables whose defaults call nextval) ─────────
const seqs = q(`SELECT sequencename FROM pg_sequences WHERE schemaname='public' ORDER BY sequencename`)
  .map((r) => r.sequencename);
if (seqs.length) {
  P(`\n-- ── Sequences ───────────────────────────────────────────────────────────────`);
  for (const s of seqs) P(`CREATE SEQUENCE IF NOT EXISTS public.${s};`);
}

// ── Tables (columns only) ─────────────────────────────────────────────────────
const tables = q(`SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename`)
  .map((r) => r.tablename);

P(`\n-- ── Tables ──────────────────────────────────────────────────────────────────`);
for (const t of tables) {
  const cols = q(`SELECT a.attname, format_type(a.atttypid, a.atttypmod) AS coltype, a.attnotnull,
      pg_get_expr(d.adbin, d.adrelid) AS def
    FROM pg_attribute a
    LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
    WHERE a.attrelid = 'public.${t}'::regclass AND a.attnum>0 AND NOT a.attisdropped
    ORDER BY a.attnum`);
  const lines = cols.map((c) => {
    let s = `  ${c.attname} ${c.coltype}`;
    if (c.def) s += ` DEFAULT ${c.def}`;
    if (c.attnotnull) s += ` NOT NULL`;
    return s;
  });
  P(`\nCREATE TABLE IF NOT EXISTS public.${t} (\n${lines.join(',\n')}\n);`);
}

// ── Functions ─────────────────────────────────────────────────────────────────
P(`\n-- ── Functions ───────────────────────────────────────────────────────────────`);
const fns = q(`SELECT pg_get_functiondef(oid) AS def FROM pg_proc
  WHERE pronamespace='public'::regnamespace ORDER BY proname`);
for (const f of fns) P(`\n${f.def};`);

// ── Constraints: non-FK first, then FK ───────────────────────────────────────
P(`\n-- ── Constraints ─────────────────────────────────────────────────────────────`);
const cons = q(`SELECT conrelid::regclass::text AS tbl, conname, pg_get_constraintdef(oid) AS def,
    contype FROM pg_constraint WHERE connamespace='public'::regnamespace
    AND conrelid <> 0 ORDER BY (contype='f'), conrelid::regclass::text, conname`);
for (const c of cons) {
  // idempotent: only add if a constraint of that name isn't already present
  P(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='${c.conname}' AND conrelid='${c.tbl}'::regclass) THEN ALTER TABLE ${c.tbl} ADD CONSTRAINT ${c.conname} ${c.def}; END IF; END $$;`);
}

// ── Indexes (skip constraint-backed ones) ────────────────────────────────────
P(`\n-- ── Indexes ─────────────────────────────────────────────────────────────────`);
const idx = q(`SELECT indexdef FROM pg_indexes WHERE schemaname='public'
    AND indexname NOT IN (SELECT conname FROM pg_constraint WHERE contype IN ('p','u'))
    ORDER BY indexname`);
for (const i of idx) P(`${i.indexdef.replace(/^CREATE (UNIQUE )?INDEX /, 'CREATE $1INDEX IF NOT EXISTS ')};`);

// ── View: anonymous_cases ────────────────────────────────────────────────────
const views = q(`SELECT viewname, pg_get_viewdef(('public.'||viewname)::regclass, true) AS def
    FROM pg_views WHERE schemaname='public' ORDER BY viewname`);
if (views.length) {
  P(`\n-- ── Views ───────────────────────────────────────────────────────────────────`);
  for (const v of views) {
    P(`\nCREATE OR REPLACE VIEW public.${v.viewname} WITH (security_invoker=true) AS\n${v.def}`);
  }
}

// ── RLS enable + policies ─────────────────────────────────────────────────────
P(`\n-- ── Row Level Security ──────────────────────────────────────────────────────`);
const rlsTables = q(`SELECT relname FROM pg_class WHERE relnamespace='public'::regnamespace
    AND relrowsecurity=true ORDER BY relname`).map((r) => r.relname);
for (const t of rlsTables) P(`ALTER TABLE public.${t} ENABLE ROW LEVEL SECURITY;`);

P('');
const pols = q(`SELECT tablename, policyname, permissive, roles, cmd, qual, with_check
    FROM pg_policies WHERE schemaname='public' ORDER BY tablename, policyname`);
for (const p of pols) {
  const roles = (p.roles || '{}').replace(/^{/, '').replace(/}$/, '') || 'public';
  let s = `CREATE POLICY ${JSON.stringify(p.policyname)} ON public.${p.tablename}`;
  s += ` AS ${p.permissive === 'PERMISSIVE' ? 'PERMISSIVE' : 'RESTRICTIVE'}`;
  s += ` FOR ${p.cmd} TO ${roles}`;
  if (p.qual) s += ` USING (${p.qual})`;
  if (p.with_check) s += ` WITH CHECK (${p.with_check})`;
  P(`DROP POLICY IF EXISTS ${JSON.stringify(p.policyname)} ON public.${p.tablename};`);
  P(`${s};`);
}

// ── Triggers (exclude webhook/http_request ones) ──────────────────────────────
P(`\n-- ── Triggers (notify/webhook triggers intentionally omitted) ────────────────`);
const trigs = q(`SELECT t.tgname, (n.nspname||'.'||c.relname) AS tbl, pg_get_triggerdef(t.oid) AS def
    FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE NOT t.tgisinternal
      AND (c.relnamespace='public'::regnamespace OR t.tgrelid='auth.users'::regclass)
    ORDER BY def`);
for (const t of trigs) {
  if (t.def.includes('http_request')) continue; // skip prod-pointing webhooks
  P(`DROP TRIGGER IF EXISTS ${t.tgname} ON ${t.tbl};`);
  P(`${t.def};`);
}

// ── Grants (Supabase defaults) + anonymous_cases hardening ───────────────────
P(`\n-- ── Grants ──────────────────────────────────────────────────────────────────
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;`);

// Function EXECUTE grants are NOT blanket — they are derived per-function from the
// live prod ACLs (migrations 20260716121000/122000 hardened these). Internal /
// trigger / maintenance functions are service_role-only; client RPCs are granted
// to authenticated; RLS-helper functions keep anon+authenticated (needed during
// policy evaluation). The default-privileges revoke keeps NEW functions off PUBLIC.
P(`
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon, authenticated;`);

const fnGrants = q(`SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args,
    has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_x,
    has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth_x
  FROM pg_proc p WHERE p.pronamespace='public'::regnamespace ORDER BY p.proname, args`);
for (const f of fnGrants) {
  const roles = [];
  if (f.anon_x) roles.push('anon');
  if (f.auth_x) roles.push('authenticated');
  if (roles.length) P(`GRANT EXECUTE ON FUNCTION public.${f.proname}(${f.args}) TO ${roles.join(', ')};`);
}

P(`
-- Keep NEW functions (created later, e.g. by migrations) off PUBLIC. Must be the
-- GLOBAL form (no IN SCHEMA): the built-in PUBLIC EXECUTE on functions is a global
-- default that a schema-scoped revoke does not remove.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

-- anonymous_cases must not be readable by anon (matches prod hardening)
REVOKE ALL ON public.anonymous_cases FROM anon;
GRANT SELECT ON public.anonymous_cases TO authenticated;
`);

fs.mkdirSync('supabase/schema', { recursive: true });
fs.writeFileSync('supabase/schema/baseline.sql', parts.join('\n') + '\n');
console.log(`baseline.sql written: ${tables.length} tables, ${fns.length} functions, ${cons.length} constraints, ${pols.length} policies, ${trigs.length} triggers scanned`);
