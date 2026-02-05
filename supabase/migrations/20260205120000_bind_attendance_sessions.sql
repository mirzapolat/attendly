-- Bind attendance sessions to token/client id for replay protection.

ALTER TABLE public.attendance_sessions
  ADD COLUMN IF NOT EXISTS token_hash TEXT,
  ADD COLUMN IF NOT EXISTS client_id_hash TEXT;
