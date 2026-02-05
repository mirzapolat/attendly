-- Bind attendance sessions to token/fingerprint for replay protection.

ALTER TABLE public.attendance_sessions
  ADD COLUMN IF NOT EXISTS token_hash TEXT,
  ADD COLUMN IF NOT EXISTS fingerprint_hash TEXT;
