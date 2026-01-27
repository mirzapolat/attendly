-- Add attendance weighting for events
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS attendance_weight integer NOT NULL DEFAULT 1;

ALTER TABLE public.events
  ADD CONSTRAINT events_attendance_weight_check CHECK (attendance_weight >= 1);
