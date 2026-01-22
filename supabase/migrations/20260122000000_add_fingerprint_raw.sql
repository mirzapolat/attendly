-- Store a non-unique fingerprint for analytics/sanitization even when enforcement is disabled
ALTER TABLE public.attendance_records
  ADD COLUMN IF NOT EXISTS device_fingerprint_raw TEXT;

-- Backfill raw fingerprints where they look like real device ids
UPDATE public.attendance_records
SET device_fingerprint_raw = device_fingerprint
WHERE device_fingerprint_raw IS NULL
  AND device_fingerprint IS NOT NULL
  AND device_fingerprint !~ '^(no-fp-|manual-|fallback-|import-)';
