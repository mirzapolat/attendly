-- Create table for moderation links
CREATE TABLE public.moderation_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  label TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add moderation_enabled flag to events table
ALTER TABLE public.events ADD COLUMN moderation_enabled BOOLEAN NOT NULL DEFAULT false;

-- Enable Row Level Security
ALTER TABLE public.moderation_links ENABLE ROW LEVEL SECURITY;

-- Admins can manage moderation links for their events
CREATE POLICY "Admins can manage moderation links for their events"
ON public.moderation_links
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.events
    WHERE events.id = moderation_links.event_id
    AND events.admin_id = auth.uid()
  )
);

-- Public can view active moderation links (for token validation)
CREATE POLICY "Anyone can view active moderation links"
ON public.moderation_links
FOR SELECT
USING (is_active = true);