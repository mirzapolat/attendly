-- Security hardening: tighten public access and prevent token leaks

-- Remove public read access to moderation links (tokens should not be enumerable)
DROP POLICY IF EXISTS "Anyone can view active moderation links" ON public.moderation_links;

-- Prevent anon access to rotating QR token fields
REVOKE SELECT (current_qr_token, qr_token_expires_at) ON public.events FROM anon;
GRANT SELECT (current_qr_token, qr_token_expires_at) ON public.events TO authenticated;

-- Tighten attendance insert policies
DROP POLICY IF EXISTS "Anyone can insert attendance" ON public.attendance_records;

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
