-- Allow configuring rotating QR interval per event
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS rotating_qr_interval_seconds integer DEFAULT 3;

-- Clamp any existing values to a reasonable range
UPDATE public.events
SET rotating_qr_interval_seconds = 3
WHERE rotating_qr_interval_seconds IS NULL
   OR rotating_qr_interval_seconds < 2
   OR rotating_qr_interval_seconds > 60;
