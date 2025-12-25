-- Add privacy settings for moderators
ALTER TABLE public.events 
ADD COLUMN IF NOT EXISTS moderator_show_full_name boolean NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS moderator_show_email boolean NOT NULL DEFAULT true;