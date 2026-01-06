CREATE TABLE public.excuse_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  label TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + INTERVAL '30 days')
);

ALTER TABLE public.excuse_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage excuse links for their events"
ON public.excuse_links
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.events
    WHERE events.id = excuse_links.event_id
    AND events.admin_id = auth.uid()
  )
);
