CREATE OR REPLACE FUNCTION audit_assignment_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_logs (action, entity_type, entity_id, details)
    VALUES ('assignment_created', 'assignment', NEW.id, jsonb_build_object('requestId', NEW.request_id, 'vehicleId', NEW.vehicle_id, 'status', NEW.status));
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO audit_logs (action, entity_type, entity_id, details)
    VALUES ('assignment_status_changed', 'assignment', NEW.id, jsonb_build_object('previousStatus', OLD.status, 'newStatus', NEW.status));
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER assignments_audit_change
AFTER INSERT OR UPDATE ON assignments
FOR EACH ROW EXECUTE FUNCTION audit_assignment_change();

CREATE OR REPLACE FUNCTION audit_request_status_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO request_events (request_id, previous_status, new_status, event_type)
    VALUES (NEW.id, OLD.status, NEW.status, 'status_changed');
    INSERT INTO audit_logs (action, entity_type, entity_id, details)
    VALUES ('request_status_changed', 'request', NEW.id, jsonb_build_object('previousStatus', OLD.status, 'newStatus', NEW.status));
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER requests_audit_status_change
AFTER UPDATE OF status ON emergency_requests
FOR EACH ROW EXECUTE FUNCTION audit_request_status_change();
