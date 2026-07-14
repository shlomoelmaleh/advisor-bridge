-- Add an auto-maintained updated_at audit column to the core mutable entities.
-- The schema was created outside migrations and only ever had created_at, so
-- there was no way to tell when a row last changed. A single shared trigger
-- function stamps now() on every UPDATE.
--
-- messages are intentionally excluded: they are immutable except for read_at
-- (guarded by guard_message_update), so an updated_at there would only track
-- read receipts and adds no audit value.

-- Shared trigger function
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- cases
ALTER TABLE public.cases           ADD COLUMN IF NOT EXISTS updated_at timestamptz;
ALTER TABLE public.branch_appetites ADD COLUMN IF NOT EXISTS updated_at timestamptz;
ALTER TABLE public.matches         ADD COLUMN IF NOT EXISTS updated_at timestamptz;
ALTER TABLE public.profiles        ADD COLUMN IF NOT EXISTS updated_at timestamptz;

-- Backfill existing rows so updated_at is never null (seed from created_at)
UPDATE public.cases            SET updated_at = created_at WHERE updated_at IS NULL;
UPDATE public.branch_appetites SET updated_at = created_at WHERE updated_at IS NULL;
UPDATE public.matches          SET updated_at = created_at WHERE updated_at IS NULL;
UPDATE public.profiles         SET updated_at = created_at WHERE updated_at IS NULL;

-- Default for future inserts
ALTER TABLE public.cases            ALTER COLUMN updated_at SET DEFAULT now();
ALTER TABLE public.branch_appetites ALTER COLUMN updated_at SET DEFAULT now();
ALTER TABLE public.matches          ALTER COLUMN updated_at SET DEFAULT now();
ALTER TABLE public.profiles         ALTER COLUMN updated_at SET DEFAULT now();

-- Triggers (drop-then-create keeps this idempotent). These are independent of
-- the existing BEFORE UPDATE triggers (validate_*, compute_match_status) — they
-- only stamp updated_at, so execution order does not matter.
DROP TRIGGER IF EXISTS set_updated_at_cases ON public.cases;
CREATE TRIGGER set_updated_at_cases
  BEFORE UPDATE ON public.cases
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_branch_appetites ON public.branch_appetites;
CREATE TRIGGER set_updated_at_branch_appetites
  BEFORE UPDATE ON public.branch_appetites
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_matches ON public.matches;
CREATE TRIGGER set_updated_at_matches
  BEFORE UPDATE ON public.matches
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_profiles ON public.profiles;
CREATE TRIGGER set_updated_at_profiles
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
