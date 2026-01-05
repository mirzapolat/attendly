-- Harden public access and add attendance sessions + moderation link expiry.

-- Remove public event access to prevent enumeration
DROP POLICY IF EXISTS "Public can view active events" ON public.events;

-- Remove public attendance inserts (handled via Edge Functions)
DROP POLICY IF EXISTS "Public can insert attendance for active events" ON public.attendance_records;

-- Recreate admin insert policy for attendance records
DROP POLICY IF EXISTS "Admins can insert attendance for their events" ON public.attendance_records;
CREATE POLICY "Admins can insert attendance for their events"
ON public.attendance_records
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.events
    WHERE events.id = attendance_records.event_id
      AND events.admin_id = auth.uid()
  )
);

-- Add expiry to moderation links
ALTER TABLE public.moderation_links
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE;

UPDATE public.moderation_links
SET expires_at = NOW() + INTERVAL '30 days'
WHERE expires_at IS NULL;

ALTER TABLE public.moderation_links
ALTER COLUMN expires_at SET DEFAULT (NOW() + INTERVAL '30 days');

-- Attendance sessions for anonymous check-in flow
CREATE TABLE IF NOT EXISTS public.attendance_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.attendance_sessions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.attendance_sessions FROM anon, authenticated;
