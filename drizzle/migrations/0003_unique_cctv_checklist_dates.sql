CREATE OR REPLACE FUNCTION public.prevent_duplicate_cctv_checklist_date()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  checklist_nvr_id text := NULLIF(NEW.data->>'nvr_id', '');
  checklist_date text := NULLIF(NEW.data->>'date', '');
BEGIN
  IF TG_OP = 'UPDATE'
    AND OLD.data->>'nvr_id' IS NOT DISTINCT FROM NEW.data->>'nvr_id'
    AND OLD.data->>'date' IS NOT DISTINCT FROM NEW.data->>'date' THEN
    RETURN NEW;
  END IF;

  IF checklist_nvr_id IS NULL OR checklist_date IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(checklist_nvr_id || '|' || checklist_date, 0)
  );

  IF EXISTS (
    SELECT 1
    FROM public.cctv_checklists_cloud AS checklist
    WHERE checklist.data->>'nvr_id' = checklist_nvr_id
      AND checklist.data->>'date' = checklist_date
      AND checklist.id <> NEW.id
  ) THEN
    RAISE EXCEPTION 'A CCTV checklist already exists for NVR % on %',
      checklist_nvr_id, checklist_date
      USING ERRCODE = '23505',
            CONSTRAINT = 'cctv_checklists_cloud_nvr_date_key';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_cctv_checklists_unique_date
BEFORE INSERT OR UPDATE OF data
ON public.cctv_checklists_cloud
FOR EACH ROW
EXECUTE FUNCTION public.prevent_duplicate_cctv_checklist_date();
