-- Add theme_color to profiles
ALTER TABLE public.profiles 
ADD COLUMN theme_color text DEFAULT 'default';

-- Add security feature columns to events
ALTER TABLE public.events 
ADD COLUMN rotating_qr_enabled boolean DEFAULT true,
ADD COLUMN device_fingerprint_enabled boolean DEFAULT true,
ADD COLUMN location_check_enabled boolean DEFAULT true;