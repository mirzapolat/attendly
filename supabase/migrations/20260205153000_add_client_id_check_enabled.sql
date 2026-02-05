-- Allow disabling client ID collision checks while still tracking client IDs.

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS client_id_check_enabled BOOLEAN DEFAULT true;

UPDATE public.events
SET client_id_check_enabled = true
WHERE client_id_check_enabled IS NULL;
