-- הרץ matching אוטומטי כשתיק מאושר
CREATE OR REPLACE FUNCTION auto_match_on_case_approval()
RETURNS trigger AS $$
BEGIN
  IF NEW.is_approved = true AND OLD.is_approved = false THEN
    PERFORM match_case_with_appetites(NEW.id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_auto_match_case ON cases;
CREATE TRIGGER trigger_auto_match_case
AFTER UPDATE ON cases
FOR EACH ROW
EXECUTE FUNCTION auto_match_on_case_approval();

-- הרץ matching אוטומטי כשappetite מאושר
CREATE OR REPLACE FUNCTION auto_match_on_appetite_approval()
RETURNS trigger AS $$
DECLARE
  v_case RECORD;
BEGIN
  IF NEW.is_approved = true AND OLD.is_approved = false THEN
    FOR v_case IN 
      SELECT id FROM cases 
      WHERE status = 'open' AND is_approved = true
    LOOP
      PERFORM match_case_with_appetites(v_case.id);
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_auto_match_appetite ON branch_appetites;
CREATE TRIGGER trigger_auto_match_appetite
AFTER UPDATE ON branch_appetites
FOR EACH ROW
EXECUTE FUNCTION auto_match_on_appetite_approval();
