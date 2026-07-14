-- ============================================================================
-- BranchMatch — baseline schema (auto-generated from production by
-- scripts/generate-baseline.cjs). Run ONCE against a fresh test project's SQL
-- editor to reproduce the production schema. Notify/webhook triggers are omitted
-- on purpose. Do NOT run this against production.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_net;


-- ── Tables ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.branch_appetites (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  banker_id uuid,
  bank_name text NOT NULL,
  branch_name text,
  appetite_level text DEFAULT 'medium'::text,
  min_loan_amount integer DEFAULT 0,
  max_ltv integer DEFAULT 100,
  preferred_borrower_types text[] DEFAULT '{}'::text[],
  preferred_regions text[] DEFAULT '{}'::text[],
  sla_days integer DEFAULT 14,
  valid_until date,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  is_approved boolean DEFAULT false,
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cases (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  advisor_id uuid,
  loan_amount_min integer,
  loan_amount_max integer,
  ltv integer,
  borrower_type text,
  property_type text,
  region text,
  priorities jsonb DEFAULT '{}'::jsonb,
  is_anonymous boolean DEFAULT true,
  status text DEFAULT 'open'::text,
  created_at timestamp with time zone DEFAULT now(),
  last_matched_at timestamp with time zone,
  is_approved boolean DEFAULT false,
  resubmitted boolean DEFAULT false,
  admin_note text,
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.matches (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  case_id uuid,
  appetite_id uuid,
  score integer,
  status text DEFAULT 'pending'::text,
  created_at timestamp with time zone DEFAULT now(),
  advisor_status text DEFAULT 'pending'::text,
  banker_status text DEFAULT 'pending'::text,
  banker_id uuid,
  advisor_id uuid,
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.messages (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  match_id uuid,
  sender_id uuid,
  content text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  read_at timestamp with time zone
);

CREATE TABLE IF NOT EXISTS public.profiles (
  user_id uuid NOT NULL,
  full_name text,
  company text,
  role text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  is_approved boolean DEFAULT false,
  phone text,
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.rate_limit_hits (
  id bigint DEFAULT nextval('rate_limit_hits_id_seq'::regclass) NOT NULL,
  user_id uuid NOT NULL,
  action text NOT NULL,
  match_id uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- ── Functions ───────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.auto_match_on_appetite_approval()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_case RECORD;
BEGIN
  IF NEW.is_approved = true AND OLD.is_approved = false THEN
    FOR v_case IN 
      SELECT id FROM cases 
      WHERE status = 'open' AND is_approved = true
    LOOP
      PERFORM internal_run_matching_for_case(v_case.id);
    END LOOP;
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.auto_match_on_case_approval()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.is_approved = true AND OLD.is_approved = false THEN
    PERFORM internal_run_matching_for_case(NEW.id);
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.close_expired_matches()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_deleted integer;
BEGIN
  -- Authenticated callers must be admin; no-JWT contexts (service role, cron,
  -- migrations) are allowed to run maintenance.
  IF auth.uid() IS NOT NULL AND NOT is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'close_expired_matches: admin only';
  END IF;

  WITH doomed AS (
    SELECT m.id
    FROM matches m
    JOIN branch_appetites a ON a.id = m.appetite_id
    WHERE (a.valid_until < current_date OR a.is_active = false)
      AND m.advisor_status = 'pending'
      AND m.banker_status = 'pending'
      AND NOT EXISTS (SELECT 1 FROM messages msg WHERE msg.match_id = m.id)
  )
  DELETE FROM matches WHERE id IN (SELECT id FROM doomed);

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.compute_match_score(p_case_id uuid, p_appetite_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_case cases%ROWTYPE;
  v_appetite branch_appetites%ROWTYPE;
  v_score INT := 0;
  v_has_access boolean;
BEGIN
  -- Authorization: caller must own the case or the appetite
  SELECT EXISTS (
    SELECT 1 FROM cases WHERE id = p_case_id AND advisor_id = auth.uid()
    UNION ALL
    SELECT 1 FROM branch_appetites WHERE id = p_appetite_id AND banker_id = auth.uid()
  ) INTO v_has_access;

  IF NOT v_has_access THEN
    RAISE EXCEPTION 'Unauthorized: you must own either the case or appetite';
  END IF;

  SELECT * INTO v_case FROM cases WHERE id = p_case_id;
  SELECT * INTO v_appetite FROM branch_appetites WHERE id = p_appetite_id;

  IF v_case.loan_amount_min >= v_appetite.min_loan_amount THEN v_score := v_score + 25; END IF;
  IF v_case.ltv <= v_appetite.max_ltv THEN v_score := v_score + 25; END IF;

  IF COALESCE(cardinality(v_appetite.preferred_borrower_types), 0) = 0
     OR v_case.borrower_type = ANY(v_appetite.preferred_borrower_types) THEN
    v_score := v_score + 20;
  END IF;

  IF COALESCE(cardinality(v_appetite.preferred_regions), 0) = 0
     OR v_case.region = ANY(v_appetite.preferred_regions) THEN
    v_score := v_score + 15;
  END IF;

  IF v_appetite.sla_days <= 5 THEN v_score := v_score + 15; END IF;

  IF v_appetite.appetite_level = 'high' THEN
    v_score := LEAST(ROUND(v_score * 1.3), 100);
  ELSIF v_appetite.appetite_level = 'low' THEN
    v_score := ROUND(v_score * 0.7);
  END IF;

  RETURN v_score;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.compute_match_score_test(p_case_id uuid, p_appetite_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_case cases%ROWTYPE;
  v_appetite branch_appetites%ROWTYPE;
  v_score INT := 0;
BEGIN
  SELECT * INTO v_case FROM cases WHERE id = p_case_id;
  SELECT * INTO v_appetite FROM branch_appetites WHERE id = p_appetite_id;

  IF v_case.loan_amount_min >= v_appetite.min_loan_amount THEN v_score := v_score + 25; END IF;
  IF v_case.ltv <= v_appetite.max_ltv THEN v_score := v_score + 25; END IF;
  IF v_case.borrower_type = ANY(v_appetite.preferred_borrower_types) THEN v_score := v_score + 20; END IF;
  IF v_case.region = ANY(v_appetite.preferred_regions) THEN v_score := v_score + 15; END IF;
  IF v_appetite.sla_days <= 5 THEN v_score := v_score + 15; END IF;

  IF v_appetite.appetite_level = 'high' THEN
    v_score := LEAST(ROUND(v_score * 1.3), 100);
  ELSIF v_appetite.appetite_level = 'low' THEN
    v_score := ROUND(v_score * 0.7);
  END IF;

  RETURN v_score;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.compute_match_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.advisor_status = 'interested' AND NEW.banker_status = 'interested' THEN
    NEW.status := 'closed';
  ELSIF NEW.advisor_status = 'rejected' OR NEW.banker_status = 'rejected' THEN
    NEW.status := 'rejected';
  ELSIF NEW.advisor_status = 'interested' OR NEW.banker_status = 'interested' THEN
    NEW.status := 'interested';
  ELSE
    NEW.status := 'pending';
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.enforce_match_rate_limit()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid        uuid := auth.uid();
  v_same_match int;
  v_recent     int;
BEGIN
  -- Only guard genuine interest-status changes. The internal matching path
  -- (ON CONFLICT DO UPDATE SET score) leaves both status columns untouched and
  -- is therefore never rate limited.
  IF NEW.advisor_status IS NOT DISTINCT FROM OLD.advisor_status
     AND NEW.banker_status IS NOT DISTINCT FROM OLD.banker_status THEN
    RETURN NEW;
  END IF;

  -- Service-role / migration / cron contexts have no JWT and are not limited.
  IF v_uid IS NULL THEN
    RETURN NEW;
  END IF;

  -- Per-match cooldown: 2 seconds between status changes on the same match.
  SELECT count(*) INTO v_same_match
  FROM rate_limit_hits
  WHERE user_id = v_uid
    AND match_id = NEW.id
    AND created_at > now() - interval '2 seconds';
  IF v_same_match > 0 THEN
    RAISE EXCEPTION 'Please wait a moment before updating this match again';
  END IF;

  -- Per-user window: at most 10 status changes per rolling minute.
  SELECT count(*) INTO v_recent
  FROM rate_limit_hits
  WHERE user_id = v_uid
    AND action = 'match_status'
    AND created_at > now() - interval '1 minute';
  IF v_recent >= 10 THEN
    RAISE EXCEPTION 'Too many updates in a short time, please try again in a minute';
  END IF;

  -- Record this hit and prune the user's stale rows to keep the table small.
  INSERT INTO rate_limit_hits (user_id, action, match_id)
  VALUES (v_uid, 'match_status', NEW.id);
  DELETE FROM rate_limit_hits
  WHERE user_id = v_uid AND created_at < now() - interval '1 minute';

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.express_interest_in_appetite(p_appetite_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_is_approved_advisor boolean;
  v_appetite_exists boolean;
  v_already_matched boolean;
  v_banker_id uuid;
  v_new_match_id uuid;
BEGIN
  -- Verify caller is an approved advisor
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE user_id = v_user_id AND role = 'advisor' AND is_approved = true
  ) INTO v_is_approved_advisor;

  IF NOT v_is_approved_advisor THEN
    RAISE EXCEPTION 'Unauthorized: only approved advisors can contact bankers';
  END IF;

  -- Verify appetite exists and is active + approved
  SELECT EXISTS (
    SELECT 1 FROM branch_appetites
    WHERE id = p_appetite_id AND is_active = true AND is_approved = true
  ) INTO v_appetite_exists;

  IF NOT v_appetite_exists THEN
    RAISE EXCEPTION 'Appetite signal not found or not available';
  END IF;

  -- Get the banker_id from the appetite
  SELECT banker_id INTO v_banker_id
  FROM branch_appetites
  WHERE id = p_appetite_id;

  -- Check if advisor already contacted this appetite
  SELECT EXISTS (
    SELECT 1 FROM matches
    WHERE appetite_id = p_appetite_id
      AND case_id IS NULL
      AND banker_id = v_banker_id
      AND advisor_status = 'interested'
      AND advisor_id = v_user_id
  ) INTO v_already_matched;

  IF v_already_matched THEN
    -- Return the existing match id instead of erroring
    SELECT id INTO v_new_match_id
    FROM matches
    WHERE appetite_id = p_appetite_id
      AND case_id IS NULL
      AND banker_id = v_banker_id
      AND advisor_status = 'interested'
      AND advisor_id = v_user_id
    LIMIT 1;
    RETURN v_new_match_id;
  END IF;

  -- Insert the match with advisor_id
  INSERT INTO matches (case_id, appetite_id, banker_id, advisor_id, score, status, advisor_status, banker_status)
  VALUES (NULL, p_appetite_id, v_banker_id, v_user_id, 0, 'pending', 'interested', 'pending')
  RETURNING id INTO v_new_match_id;

  RETURN v_new_match_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.express_interest_in_case(p_case_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_is_approved_banker boolean;
  v_case_exists boolean;
  v_existing_match_id uuid;
BEGIN
  -- Verify caller is an approved banker
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE user_id = v_user_id AND role = 'bank' AND is_approved = true
  ) INTO v_is_approved_banker;

  IF NOT v_is_approved_banker THEN
    RAISE EXCEPTION 'Unauthorized: only approved bankers can express interest';
  END IF;

  -- Verify case exists and is open+approved
  SELECT EXISTS (
    SELECT 1 FROM cases
    WHERE id = p_case_id AND status = 'open' AND is_approved = true
  ) INTO v_case_exists;

  IF NOT v_case_exists THEN
    RAISE EXCEPTION 'Case not found or not available';
  END IF;

  -- חפש match קיים: גם לפי banker_id ישיר וגם דרך appetite
  SELECT m.id INTO v_existing_match_id
  FROM matches m
  LEFT JOIN branch_appetites a ON a.id = m.appetite_id
  WHERE m.case_id = p_case_id
    AND (m.banker_id = v_user_id OR a.banker_id = v_user_id)
  LIMIT 1;

  IF v_existing_match_id IS NOT NULL THEN
    -- עדכן את ה-match הקיים במקום ליצור חדש
    UPDATE matches
    SET 
      banker_id = v_user_id,
      banker_status = 'interested',
      status = CASE 
        WHEN advisor_status = 'interested' THEN 'closed'
        ELSE 'interested'
      END
    WHERE id = v_existing_match_id;
  ELSE
    -- אין match קיים — צור חדש (שוק פתוח)
    INSERT INTO matches (case_id, appetite_id, score, status, advisor_status, banker_status, banker_id)
    VALUES (p_case_id, NULL, 0, 'interested', 'pending', 'interested', v_user_id);
  END IF;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.guard_message_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT is_admin(auth.uid()) THEN
    IF NEW.id IS DISTINCT FROM OLD.id
       OR NEW.match_id IS DISTINCT FROM OLD.match_id
       OR NEW.sender_id IS DISTINCT FROM OLD.sender_id
       OR NEW.content IS DISTINCT FROM OLD.content
       OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'Only read_at can be updated on messages';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.guard_profile_sensitive_fields()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF (auth.jwt() -> 'app_metadata' ->> 'role') != 'admin' THEN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'Cannot change own role';
    END IF;
    IF NEW.is_approved IS DISTINCT FROM OLD.is_approved THEN
      RAISE EXCEPTION 'Cannot change own approval status';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_case_rejection()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'rejected' AND OLD.status != 'rejected' THEN
    NEW.is_approved := true;
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_role text;
BEGIN
  v_role := NEW.raw_user_meta_data->>'role';
  IF v_role NOT IN ('advisor', 'bank') THEN
    v_role := 'advisor';
  END IF;

  INSERT INTO profiles (user_id, full_name, role, is_approved)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    v_role,
    false
  )
  ON CONFLICT (user_id) DO UPDATE
    SET full_name = EXCLUDED.full_name;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.internal_compute_match_score(p_case_id uuid, p_appetite_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_case cases%ROWTYPE;
  v_appetite branch_appetites%ROWTYPE;
  v_score INT := 0;
BEGIN
  SELECT * INTO v_case FROM cases WHERE id = p_case_id;
  SELECT * INTO v_appetite FROM branch_appetites WHERE id = p_appetite_id;

  IF v_case.loan_amount_min >= v_appetite.min_loan_amount THEN v_score := v_score + 25; END IF;
  IF v_case.ltv <= v_appetite.max_ltv THEN v_score := v_score + 25; END IF;

  -- Empty/null preferred_borrower_types = no preference → award points.
  IF COALESCE(cardinality(v_appetite.preferred_borrower_types), 0) = 0
     OR v_case.borrower_type = ANY(v_appetite.preferred_borrower_types) THEN
    v_score := v_score + 20;
  END IF;

  -- Empty/null preferred_regions = no preference → award points.
  IF COALESCE(cardinality(v_appetite.preferred_regions), 0) = 0
     OR v_case.region = ANY(v_appetite.preferred_regions) THEN
    v_score := v_score + 15;
  END IF;

  IF v_appetite.sla_days <= 5 THEN v_score := v_score + 15; END IF;

  IF v_appetite.appetite_level = 'high' THEN
    v_score := LEAST(ROUND(v_score * 1.3), 100);
  ELSIF v_appetite.appetite_level = 'low' THEN
    v_score := ROUND(v_score * 0.7);
  END IF;

  RETURN v_score;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.internal_run_matching_for_case(p_case_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_appetite branch_appetites%ROWTYPE;
  v_score INT;
  v_case cases%ROWTYPE;
BEGIN
  SELECT * INTO v_case FROM cases WHERE id = p_case_id;
  IF v_case.id IS NULL THEN RETURN; END IF;
  UPDATE cases SET last_matched_at = NOW() WHERE id = p_case_id;
  FOR v_appetite IN
    SELECT * FROM branch_appetites
    WHERE is_active = true
    AND is_approved = true
    AND (valid_until IS NULL OR valid_until >= CURRENT_DATE)
  LOOP
    v_score := internal_compute_match_score(p_case_id, v_appetite.id);
    IF v_score >= 40 THEN
      INSERT INTO matches (case_id, appetite_id, score, status, advisor_status, banker_status)
      VALUES (p_case_id, v_appetite.id, v_score, 'pending', 'pending', 'pending')
      ON CONFLICT (case_id, appetite_id) DO UPDATE SET score = v_score;
    END IF;
  END LOOP;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid DEFAULT NULL::uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  RETURN COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin',
    false
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.is_banker_in_case(p_case_id uuid, p_banker_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM matches m
    LEFT JOIN branch_appetites ba ON ba.id = m.appetite_id
    WHERE m.case_id = p_case_id
    AND (
      m.banker_id = p_banker_id
      OR ba.banker_id = p_banker_id
    )
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.is_match_participant(p_viewer uuid, p_profile_owner uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM matches m
    JOIN cases c ON c.id = m.case_id
    LEFT JOIN branch_appetites ba ON ba.id = m.appetite_id
    WHERE (
      (c.advisor_id = p_viewer AND (ba.banker_id = p_profile_owner OR m.banker_id = p_profile_owner))
      OR (c.advisor_id = p_profile_owner AND (ba.banker_id = p_viewer OR m.banker_id = p_viewer))
    )
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.run_matching_for_case(p_case_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_appetite branch_appetites%ROWTYPE;
  v_score INT;
  v_case cases%ROWTYPE;
  v_user_role text;
BEGIN
  SELECT role INTO v_user_role FROM profiles WHERE user_id = auth.uid();
  IF v_user_role IS NULL OR v_user_role != 'advisor' THEN
    RAISE EXCEPTION 'Unauthorized: only advisors can run matching';
  END IF;

  SELECT * INTO v_case FROM cases WHERE id = p_case_id;
  
  IF v_case.id IS NULL THEN
    RAISE EXCEPTION 'Case not found';
  END IF;
  
  IF v_case.advisor_id != auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized: you can only run matching on your own cases';
  END IF;

  -- חסום matching על תיק נדחה
  IF v_case.status = 'rejected' THEN
    RAISE EXCEPTION 'Cannot run matching on a rejected case';
  END IF;

  -- חסום matching על תיק לא מאושר
  IF v_case.is_approved = false THEN
    RAISE EXCEPTION 'Cannot run matching on an unapproved case';
  END IF;

  IF v_case.last_matched_at IS NOT NULL 
     AND v_case.last_matched_at > NOW() - INTERVAL '5 minutes' THEN
    RAISE EXCEPTION 'Please wait before running matching again';
  END IF;

  UPDATE cases SET last_matched_at = NOW() WHERE id = p_case_id;

  FOR v_appetite IN
    SELECT * FROM branch_appetites
    WHERE is_active = true
    AND is_approved = true
    AND (valid_until IS NULL OR valid_until >= CURRENT_DATE)
  LOOP
    v_score := compute_match_score(p_case_id, v_appetite.id);

    IF v_score >= 40 THEN
      INSERT INTO matches (case_id, appetite_id, score, status, advisor_status, banker_status)
      VALUES (p_case_id, v_appetite.id, v_score, 'pending', 'pending', 'pending')
      ON CONFLICT (case_id, appetite_id) DO UPDATE SET score = v_score;
    END IF;
  END LOOP;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.validate_appetite_insert_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.bank_name IS NOT NULL AND length(NEW.bank_name) > 200 THEN
    RAISE EXCEPTION 'bank_name too long';
  END IF;
  IF NEW.branch_name IS NOT NULL AND length(NEW.branch_name) > 200 THEN
    RAISE EXCEPTION 'branch_name too long';
  END IF;
  IF NEW.min_loan_amount IS NOT NULL AND NEW.min_loan_amount < 0 THEN
    RAISE EXCEPTION 'min_loan_amount must be non-negative';
  END IF;
  IF NEW.max_ltv IS NOT NULL AND (NEW.max_ltv < 1 OR NEW.max_ltv > 100) THEN
    RAISE EXCEPTION 'max_ltv must be between 1 and 100';
  END IF;
  IF NEW.sla_days IS NOT NULL AND NEW.sla_days < 1 THEN
    RAISE EXCEPTION 'sla_days must be at least 1';
  END IF;
  IF NEW.appetite_level IS NOT NULL AND NEW.appetite_level NOT IN ('high', 'medium', 'low') THEN
    RAISE EXCEPTION 'Invalid appetite_level';
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.validate_case_insert_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.loan_amount_min IS NOT NULL AND NEW.loan_amount_min < 50000 THEN
    RAISE EXCEPTION 'loan_amount_min must be at least 50,000';
  END IF;
  IF NEW.loan_amount_max IS NOT NULL AND NEW.loan_amount_max > 10000000 THEN
    RAISE EXCEPTION 'loan_amount_max must not exceed 10,000,000';
  END IF;
  IF NEW.loan_amount_min IS NOT NULL AND NEW.loan_amount_max IS NOT NULL AND NEW.loan_amount_min > NEW.loan_amount_max THEN
    RAISE EXCEPTION 'loan_amount_min must be <= loan_amount_max';
  END IF;
  IF NEW.ltv IS NOT NULL AND (NEW.ltv < 20 OR NEW.ltv > 95) THEN
    RAISE EXCEPTION 'ltv must be between 20 and 95';
  END IF;
  IF NEW.borrower_type IS NOT NULL AND NEW.borrower_type NOT IN ('employee', 'self_employed') THEN
    RAISE EXCEPTION 'Invalid borrower_type';
  END IF;
  IF NEW.region IS NOT NULL AND length(NEW.region) > 100 THEN
    RAISE EXCEPTION 'region too long';
  END IF;
  IF NEW.property_type IS NOT NULL AND length(NEW.property_type) > 100 THEN
    RAISE EXCEPTION 'property_type too long';
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.validate_match_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_is_advisor boolean;
  v_is_banker boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM cases WHERE id = NEW.case_id AND advisor_id = auth.uid()
  ) INTO v_is_advisor;

  SELECT EXISTS (
    SELECT 1 FROM branch_appetites WHERE id = NEW.appetite_id AND banker_id = auth.uid()
  ) INTO v_is_banker;

  IF v_is_advisor AND NOT v_is_banker THEN
    IF NEW.banker_status IS DISTINCT FROM OLD.banker_status THEN
      RAISE EXCEPTION 'Advisors cannot modify banker status';
    END IF;
  END IF;

  IF v_is_banker AND NOT v_is_advisor THEN
    IF NEW.advisor_status IS DISTINCT FROM OLD.advisor_status THEN
      RAISE EXCEPTION 'Bankers cannot modify advisor status';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.validate_message_insert_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF length(trim(NEW.content)) = 0 THEN
    RAISE EXCEPTION 'Message content cannot be empty';
  END IF;
  IF length(NEW.content) > 10000 THEN
    RAISE EXCEPTION 'Message content too long (max 10000 characters)';
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.validate_profile_insert_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.full_name IS NOT NULL AND length(NEW.full_name) > 100 THEN
    RAISE EXCEPTION 'full_name too long (max 100 characters)';
  END IF;
  IF NEW.company IS NOT NULL AND length(NEW.company) > 200 THEN
    RAISE EXCEPTION 'company too long (max 200 characters)';
  END IF;
  IF NEW.role NOT IN ('advisor', 'bank', 'admin') THEN
    RAISE EXCEPTION 'Invalid role';
  END IF;
  RETURN NEW;
END;
$function$
;

-- ── Constraints ─────────────────────────────────────────────────────────────
ALTER TABLE branch_appetites ADD CONSTRAINT branch_appetites_appetite_level_check CHECK ((appetite_level = ANY (ARRAY['high'::text, 'medium'::text, 'low'::text])));
ALTER TABLE branch_appetites ADD CONSTRAINT branch_appetites_pkey PRIMARY KEY (id);
ALTER TABLE cases ADD CONSTRAINT cases_borrower_type_check CHECK ((borrower_type = ANY (ARRAY['employee'::text, 'self_employed'::text])));
ALTER TABLE cases ADD CONSTRAINT cases_pkey PRIMARY KEY (id);
ALTER TABLE cases ADD CONSTRAINT cases_status_check CHECK ((status = ANY (ARRAY['open'::text, 'in_progress'::text, 'matched'::text, 'closed'::text, 'rejected'::text])));
ALTER TABLE matches ADD CONSTRAINT matches_advisor_status_check CHECK ((advisor_status = ANY (ARRAY['pending'::text, 'interested'::text, 'rejected'::text])));
ALTER TABLE matches ADD CONSTRAINT matches_banker_status_check CHECK ((banker_status = ANY (ARRAY['pending'::text, 'interested'::text, 'rejected'::text])));
ALTER TABLE matches ADD CONSTRAINT matches_case_id_appetite_id_key UNIQUE (case_id, appetite_id);
ALTER TABLE matches ADD CONSTRAINT matches_pkey PRIMARY KEY (id);
ALTER TABLE matches ADD CONSTRAINT matches_score_check CHECK (((score >= 0) AND (score <= 100)));
ALTER TABLE matches ADD CONSTRAINT matches_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'interested'::text, 'rejected'::text, 'closed'::text])));
ALTER TABLE messages ADD CONSTRAINT messages_pkey PRIMARY KEY (id);
ALTER TABLE profiles ADD CONSTRAINT profiles_pkey PRIMARY KEY (user_id);
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check CHECK ((role = ANY (ARRAY['advisor'::text, 'bank'::text, 'admin'::text])));
ALTER TABLE rate_limit_hits ADD CONSTRAINT rate_limit_hits_pkey PRIMARY KEY (id);
ALTER TABLE branch_appetites ADD CONSTRAINT branch_appetites_banker_id_fkey FOREIGN KEY (banker_id) REFERENCES profiles(user_id) ON DELETE CASCADE;
ALTER TABLE cases ADD CONSTRAINT cases_advisor_id_fkey FOREIGN KEY (advisor_id) REFERENCES profiles(user_id) ON DELETE CASCADE;
ALTER TABLE matches ADD CONSTRAINT matches_advisor_id_fkey FOREIGN KEY (advisor_id) REFERENCES auth.users(id);
ALTER TABLE matches ADD CONSTRAINT matches_appetite_id_fkey FOREIGN KEY (appetite_id) REFERENCES branch_appetites(id) ON DELETE CASCADE;
ALTER TABLE matches ADD CONSTRAINT matches_banker_id_fkey FOREIGN KEY (banker_id) REFERENCES profiles(user_id);
ALTER TABLE matches ADD CONSTRAINT matches_case_id_fkey FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE;
ALTER TABLE messages ADD CONSTRAINT messages_match_id_fkey FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE;
ALTER TABLE messages ADD CONSTRAINT messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES profiles(user_id);
ALTER TABLE profiles ADD CONSTRAINT profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- ── Indexes ─────────────────────────────────────────────────────────────────
CREATE INDEX idx_branch_appetites_active_approved ON public.branch_appetites USING btree (valid_until) WHERE ((is_active = true) AND (is_approved = true));
CREATE INDEX idx_branch_appetites_banker_id ON public.branch_appetites USING btree (banker_id);
CREATE INDEX idx_cases_advisor_id ON public.cases USING btree (advisor_id);
CREATE INDEX idx_cases_open_approved ON public.cases USING btree (created_at) WHERE ((status = 'open'::text) AND (is_approved = true));
CREATE INDEX idx_matches_advisor_id ON public.matches USING btree (advisor_id);
CREATE INDEX idx_matches_appetite_id ON public.matches USING btree (appetite_id);
CREATE INDEX idx_matches_banker_id ON public.matches USING btree (banker_id);
CREATE INDEX idx_matches_case_id ON public.matches USING btree (case_id);
CREATE INDEX idx_messages_match_id ON public.messages USING btree (match_id);
CREATE INDEX idx_messages_read_at ON public.messages USING btree (match_id, read_at) WHERE (read_at IS NULL);
CREATE INDEX idx_messages_unread ON public.messages USING btree (match_id, sender_id) WHERE (read_at IS NULL);
CREATE INDEX idx_rate_limit_hits_user_time ON public.rate_limit_hits USING btree (user_id, created_at);

-- ── Views ───────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW public.anonymous_cases WITH (security_invoker=true) AS
 SELECT id,
    loan_amount_min,
    loan_amount_max,
    ltv,
    region,
    borrower_type,
    status,
    is_approved,
    created_at
   FROM cases
  WHERE status = 'open'::text AND is_approved = true;

-- ── Row Level Security ──────────────────────────────────────────────────────
ALTER TABLE public.branch_appetites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limit_hits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manages all appetites" ON public.branch_appetites AS PERMISSIVE FOR ALL TO public USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Advisors see approved active appetites" ON public.branch_appetites AS PERMISSIVE FOR ALL TO public USING (((is_active = true) AND (is_approved = true) AND (((auth.jwt() -> 'user_metadata'::text) ->> 'role'::text) = 'advisor'::text)));
CREATE POLICY "Bankers manage own appetites" ON public.branch_appetites AS PERMISSIVE FOR ALL TO authenticated USING ((auth.uid() = banker_id));
CREATE POLICY "Only approved bankers can create appetites" ON public.branch_appetites AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = auth.uid()) AND (profiles.is_approved = true) AND (profiles.role = 'bank'::text)))));
CREATE POLICY "Admin manages all cases" ON public.cases AS PERMISSIVE FOR ALL TO public USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Advisors manage own cases" ON public.cases AS PERMISSIVE FOR ALL TO public USING ((auth.uid() = advisor_id)) WITH CHECK (((auth.uid() = advisor_id) AND (is_approved = false)));
CREATE POLICY "Bankers see approved open cases" ON public.cases AS PERMISSIVE FOR ALL TO public USING (((status = 'open'::text) AND (is_approved = true) AND (((auth.jwt() -> 'user_metadata'::text) ->> 'role'::text) = 'bank'::text)));
CREATE POLICY "Bankers see cases in their matches" ON public.cases AS PERMISSIVE FOR SELECT TO public USING (is_banker_in_case(id, auth.uid()));
CREATE POLICY "Only approved advisors can create cases" ON public.cases AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = auth.uid()) AND (profiles.is_approved = true) AND (profiles.role = 'advisor'::text)))));
CREATE POLICY "Admin manages all matches" ON public.matches AS PERMISSIVE FOR ALL TO public USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Deny direct match inserts" ON public.matches AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY "Match participants see matches" ON public.matches AS PERMISSIVE FOR SELECT TO authenticated USING (((EXISTS ( SELECT 1
   FROM cases
  WHERE ((cases.id = matches.case_id) AND (cases.advisor_id = auth.uid())))) OR (EXISTS ( SELECT 1
   FROM branch_appetites
  WHERE ((branch_appetites.id = matches.appetite_id) AND (branch_appetites.banker_id = auth.uid())))) OR (banker_id = auth.uid()) OR (advisor_id = auth.uid())));
CREATE POLICY "Match participants update matches" ON public.matches AS PERMISSIVE FOR UPDATE TO authenticated USING (((EXISTS ( SELECT 1
   FROM cases
  WHERE ((cases.id = matches.case_id) AND (cases.advisor_id = auth.uid())))) OR (EXISTS ( SELECT 1
   FROM branch_appetites
  WHERE ((branch_appetites.id = matches.appetite_id) AND (branch_appetites.banker_id = auth.uid())))) OR (banker_id = auth.uid()) OR (advisor_id = auth.uid())));
CREATE POLICY "Match participants see messages" ON public.messages AS PERMISSIVE FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM ((matches m
     LEFT JOIN cases c ON ((c.id = m.case_id)))
     LEFT JOIN branch_appetites ba ON ((ba.id = m.appetite_id)))
  WHERE ((m.id = messages.match_id) AND ((c.advisor_id = auth.uid()) OR (ba.banker_id = auth.uid()) OR (m.banker_id = auth.uid()) OR (m.advisor_id = auth.uid()))))));
CREATE POLICY "Users can mark messages as read" ON public.messages AS PERMISSIVE FOR UPDATE TO authenticated USING (((auth.uid() <> sender_id) AND (EXISTS ( SELECT 1
   FROM ((matches m
     LEFT JOIN cases c ON ((c.id = m.case_id)))
     LEFT JOIN branch_appetites ba ON ((ba.id = m.appetite_id)))
  WHERE ((m.id = messages.match_id) AND ((c.advisor_id = auth.uid()) OR (ba.banker_id = auth.uid()) OR (m.banker_id = auth.uid()) OR (m.advisor_id = auth.uid())))))));
CREATE POLICY "Users delete own messages" ON public.messages AS PERMISSIVE FOR DELETE TO authenticated USING ((auth.uid() = sender_id));
CREATE POLICY "Users insert own messages" ON public.messages AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((auth.uid() = sender_id) AND (EXISTS ( SELECT 1
   FROM ((matches m
     LEFT JOIN cases c ON ((c.id = m.case_id)))
     LEFT JOIN branch_appetites ba ON ((ba.id = m.appetite_id)))
  WHERE ((m.id = messages.match_id) AND ((c.advisor_id = auth.uid()) OR (ba.banker_id = auth.uid()) OR (m.banker_id = auth.uid()) OR (m.advisor_id = auth.uid())))))));
CREATE POLICY "Users update own messages" ON public.messages AS PERMISSIVE FOR UPDATE TO authenticated USING ((auth.uid() = sender_id));
CREATE POLICY "Admin full access" ON public.profiles AS PERMISSIVE FOR ALL TO public USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Match participants see counterpart profiles" ON public.profiles AS PERMISSIVE FOR SELECT TO authenticated USING (((auth.uid() = user_id) OR (EXISTS ( SELECT 1
   FROM ((matches m
     LEFT JOIN cases c ON ((c.id = m.case_id)))
     LEFT JOIN branch_appetites ba ON ((ba.id = m.appetite_id)))
  WHERE (((COALESCE(c.advisor_id, m.advisor_id) = auth.uid()) AND ((ba.banker_id = profiles.user_id) OR (m.banker_id = profiles.user_id))) OR ((COALESCE(c.advisor_id, m.advisor_id) = profiles.user_id) AND ((ba.banker_id = auth.uid()) OR (m.banker_id = auth.uid())))))) OR is_admin(auth.uid())));
CREATE POLICY "Users can update their own profile" ON public.profiles AS PERMISSIVE FOR UPDATE TO public USING ((auth.uid() = user_id));
CREATE POLICY "Users insert own profile" ON public.profiles AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users see own profile" ON public.profiles AS PERMISSIVE FOR SELECT TO authenticated USING ((auth.uid() = user_id));
CREATE POLICY "Users update own profile" ON public.profiles AS PERMISSIVE FOR UPDATE TO authenticated USING ((auth.uid() = user_id));

-- ── Triggers (notify/webhook triggers intentionally omitted) ────────────────
CREATE TRIGGER enforce_match_rate_limit BEFORE UPDATE ON public.matches FOR EACH ROW EXECUTE FUNCTION enforce_match_rate_limit();
CREATE TRIGGER guard_message_update BEFORE UPDATE ON public.messages FOR EACH ROW EXECUTE FUNCTION guard_message_update();
CREATE TRIGGER guard_profile_sensitive_fields BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION guard_profile_sensitive_fields();
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user();
CREATE TRIGGER set_match_status BEFORE INSERT OR UPDATE ON public.matches FOR EACH ROW EXECUTE FUNCTION compute_match_status();
CREATE TRIGGER set_updated_at_branch_appetites BEFORE UPDATE ON public.branch_appetites FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_updated_at_cases BEFORE UPDATE ON public.cases FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_updated_at_matches BEFORE UPDATE ON public.matches FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_updated_at_profiles BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trigger_auto_match_appetite AFTER UPDATE ON public.branch_appetites FOR EACH ROW EXECUTE FUNCTION auto_match_on_appetite_approval();
CREATE TRIGGER trigger_auto_match_case AFTER UPDATE ON public.cases FOR EACH ROW EXECUTE FUNCTION auto_match_on_case_approval();
CREATE TRIGGER trigger_handle_case_rejection BEFORE UPDATE ON public.cases FOR EACH ROW EXECUTE FUNCTION handle_case_rejection();
CREATE TRIGGER validate_appetite_data BEFORE INSERT OR UPDATE ON public.branch_appetites FOR EACH ROW EXECUTE FUNCTION validate_appetite_insert_update();
CREATE TRIGGER validate_case_data BEFORE INSERT OR UPDATE ON public.cases FOR EACH ROW EXECUTE FUNCTION validate_case_insert_update();
CREATE TRIGGER validate_match_update BEFORE UPDATE ON public.matches FOR EACH ROW EXECUTE FUNCTION validate_match_update();
CREATE TRIGGER validate_message_data BEFORE INSERT OR UPDATE ON public.messages FOR EACH ROW EXECUTE FUNCTION validate_message_insert_update();
CREATE TRIGGER validate_profile_data BEFORE INSERT OR UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION validate_profile_insert_update();

-- ── Grants ──────────────────────────────────────────────────────────────────
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;

-- anonymous_cases must not be readable by anon (matches prod hardening)
REVOKE ALL ON public.anonymous_cases FROM anon;
GRANT SELECT ON public.anonymous_cases TO authenticated;

