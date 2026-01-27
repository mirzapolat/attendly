-- Add per-event fingerprint collision policy (strict block vs allow + mark suspicious)
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS fingerprint_collision_strict BOOLEAN DEFAULT true;

UPDATE public.events
SET fingerprint_collision_strict = true
WHERE fingerprint_collision_strict IS NULL;
