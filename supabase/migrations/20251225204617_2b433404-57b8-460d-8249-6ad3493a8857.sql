-- Drop the problematic policy
DROP POLICY IF EXISTS "Moderators can view events with valid moderation link" ON public.events;

-- Recreate as PERMISSIVE (using AS PERMISSIVE explicitly)
CREATE POLICY "Moderators can view events with valid moderation link"
ON public.events
AS PERMISSIVE
FOR SELECT
TO anon, authenticated
USING (
  moderation_enabled = true
  AND EXISTS (
    SELECT 1 FROM public.moderation_links
    WHERE moderation_links.event_id = events.id
    AND moderation_links.is_active = true
  )
);