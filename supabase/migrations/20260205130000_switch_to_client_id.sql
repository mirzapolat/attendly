-- Switch attendance tracking from fingerprinting to server-issued client IDs.

-- Events: replace fingerprint collision policy with client ID policy.
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS client_id_collision_strict BOOLEAN DEFAULT true;

UPDATE public.events
SET client_id_collision_strict = COALESCE(client_id_collision_strict, fingerprint_collision_strict, true);

ALTER TABLE public.events
  DROP COLUMN IF EXISTS device_fingerprint_enabled,
  DROP COLUMN IF EXISTS fingerprint_collision_strict;

-- Attendance records: add client ID fields, backfill from fingerprints, and enforce uniqueness.
ALTER TABLE public.attendance_records
  ADD COLUMN IF NOT EXISTS client_id TEXT,
  ADD COLUMN IF NOT EXISTS client_id_raw TEXT;

UPDATE public.attendance_records
SET client_id = COALESCE(client_id, device_fingerprint),
    client_id_raw = COALESCE(client_id_raw, device_fingerprint_raw);

ALTER TABLE public.attendance_records
  ALTER COLUMN client_id SET NOT NULL;

ALTER TABLE public.attendance_records
  DROP CONSTRAINT IF EXISTS attendance_records_event_id_device_fingerprint_key;

ALTER TABLE public.attendance_records
  ADD CONSTRAINT attendance_records_event_id_client_id_key UNIQUE (event_id, client_id);

ALTER TABLE public.attendance_records
  DROP COLUMN IF EXISTS device_fingerprint_raw,
  DROP COLUMN IF EXISTS device_fingerprint;

-- Attendance sessions: bind to client ID hash instead of fingerprint hash.
ALTER TABLE public.attendance_sessions
  ADD COLUMN IF NOT EXISTS client_id_hash TEXT;

ALTER TABLE public.attendance_sessions
  DROP COLUMN IF EXISTS fingerprint_hash;
