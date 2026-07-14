-- Lock the per-side status columns to their real domain.
-- The schema already had CHECK constraints on cases.status, matches.status,
-- branch_appetites.appetite_level, profiles.role and cases.borrower_type, but
-- matches.advisor_status / banker_status were left as free text. The app's
-- MatchStatus per-side type is 'pending' | 'interested' | 'rejected', and the
-- compute_match_status trigger derives matches.status from exactly these values,
-- so an out-of-domain value here would silently break status derivation.
-- Wrapped in DO blocks for idempotency (ADD CONSTRAINT has no IF NOT EXISTS).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'matches_advisor_status_check'
      AND conrelid = 'public.matches'::regclass
  ) THEN
    ALTER TABLE public.matches
      ADD CONSTRAINT matches_advisor_status_check
      CHECK (advisor_status IN ('pending', 'interested', 'rejected'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'matches_banker_status_check'
      AND conrelid = 'public.matches'::regclass
  ) THEN
    ALTER TABLE public.matches
      ADD CONSTRAINT matches_banker_status_check
      CHECK (banker_status IN ('pending', 'interested', 'rejected'));
  END IF;
END $$;
