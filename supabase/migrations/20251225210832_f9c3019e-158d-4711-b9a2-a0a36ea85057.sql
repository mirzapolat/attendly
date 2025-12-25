-- Enable realtime for events table
ALTER PUBLICATION supabase_realtime ADD TABLE public.events;

-- Enable realtime for moderation_links table
ALTER PUBLICATION supabase_realtime ADD TABLE public.moderation_links;