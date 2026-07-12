-- Normalize the legacy 'banker' role spelling to 'bank' and lock the role set.
-- As of 2026-07-12 the deployed data already contains only advisor/bank/admin;
-- the UPDATE below is a no-op there but keeps this migration self-contained
-- when rebuilding an environment from scratch.

UPDATE profiles SET role = 'bank' WHERE role = 'banker';

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('advisor', 'bank', 'admin'));

-- Source-of-truth capture: the deployed handle_new_user drifted from the repo's
-- latest migration (20260227122352 always inserted 'advisor'; the deployed
-- version honors an advisor/bank choice from signup metadata and is idempotent
-- on conflict). This is the deployed definition, verbatim.
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
$function$;
