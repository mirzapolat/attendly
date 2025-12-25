-- Allow anyone to view events that have an active moderation link for them
CREATE POLICY "Moderators can view events with valid moderation link"
ON public.events
FOR SELECT
USING (
  moderation_enabled = true
  AND EXISTS (
    SELECT 1 FROM public.moderation_links
    WHERE moderation_links.event_id = events.id
    AND moderation_links.is_active = true
  )
);