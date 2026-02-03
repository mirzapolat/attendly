-- Update default rotating QR interval for new events
ALTER TABLE public.events
  ALTER COLUMN rotating_qr_interval_seconds SET DEFAULT 6;
