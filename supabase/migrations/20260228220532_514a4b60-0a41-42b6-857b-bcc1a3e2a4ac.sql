
-- Validation trigger for cases
CREATE OR REPLACE FUNCTION public.validate_case_insert_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
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
$$;

CREATE TRIGGER validate_case_data
  BEFORE INSERT OR UPDATE ON cases
  FOR EACH ROW
  EXECUTE FUNCTION validate_case_insert_update();

-- Validation trigger for branch_appetites
CREATE OR REPLACE FUNCTION public.validate_appetite_insert_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
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
$$;

CREATE TRIGGER validate_appetite_data
  BEFORE INSERT OR UPDATE ON branch_appetites
  FOR EACH ROW
  EXECUTE FUNCTION validate_appetite_insert_update();

-- Validation trigger for messages
CREATE OR REPLACE FUNCTION public.validate_message_insert_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF length(trim(NEW.content)) = 0 THEN
    RAISE EXCEPTION 'Message content cannot be empty';
  END IF;
  IF length(NEW.content) > 10000 THEN
    RAISE EXCEPTION 'Message content too long (max 10000 characters)';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_message_data
  BEFORE INSERT OR UPDATE ON messages
  FOR EACH ROW
  EXECUTE FUNCTION validate_message_insert_update();

-- Validation trigger for profiles
CREATE OR REPLACE FUNCTION public.validate_profile_insert_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
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
$$;

CREATE TRIGGER validate_profile_data
  BEFORE INSERT OR UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION validate_profile_insert_update();
