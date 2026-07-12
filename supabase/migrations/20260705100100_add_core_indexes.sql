-- Indexes for the join/filter columns used by RLS policies, the matching engine
-- and the chat/unread-count queries. The schema was created outside migrations,
-- so none of these existed as explicit indexes; IF NOT EXISTS keeps this safe to
-- re-run against the deployed project.

-- matches: RLS joins on case_id/appetite_id and the direct advisor_id/banker_id fallbacks
CREATE INDEX IF NOT EXISTS idx_matches_case_id ON public.matches (case_id);
CREATE INDEX IF NOT EXISTS idx_matches_appetite_id ON public.matches (appetite_id);
CREATE INDEX IF NOT EXISTS idx_matches_advisor_id ON public.matches (advisor_id);
CREATE INDEX IF NOT EXISTS idx_matches_banker_id ON public.matches (banker_id);

-- messages: every chat fetch and unread-count query filters by match_id (+ read_at IS NULL)
CREATE INDEX IF NOT EXISTS idx_messages_match_id ON public.messages (match_id);
CREATE INDEX IF NOT EXISTS idx_messages_unread ON public.messages (match_id, sender_id)
  WHERE read_at IS NULL;

-- cases: advisor dashboard fetches by advisor_id; bankers/matching scan open+approved cases
CREATE INDEX IF NOT EXISTS idx_cases_advisor_id ON public.cases (advisor_id);
CREATE INDEX IF NOT EXISTS idx_cases_open_approved ON public.cases (created_at)
  WHERE status = 'open' AND is_approved = true;

-- branch_appetites: banker dashboard fetches by banker_id; advisors/matching scan active+approved
CREATE INDEX IF NOT EXISTS idx_branch_appetites_banker_id ON public.branch_appetites (banker_id);
CREATE INDEX IF NOT EXISTS idx_branch_appetites_active_approved ON public.branch_appetites (valid_until)
  WHERE is_active = true AND is_approved = true;
