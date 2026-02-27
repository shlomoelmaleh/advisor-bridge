CREATE OR REPLACE FUNCTION public.compute_match_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
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
$$;