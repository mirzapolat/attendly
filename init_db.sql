-- Combined Migration Script for Attendly
-- Run this in your Supabase SQL Editor to initialize the database

-- 1. Create enum and base tables
CREATE TYPE public.attendance_status AS ENUM ('verified', 'suspicious', 'cleared');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  theme_color TEXT DEFAULT 'default',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE public.seasons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create events table (consolidated with later alterations)
CREATE TABLE public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  season_id UUID REFERENCES public.seasons(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  event_date TIMESTAMP WITH TIME ZONE NOT NULL,
  location_name TEXT NOT NULL,
  location_lat DOUBLE PRECISION NOT NULL,
  location_lng DOUBLE PRECISION NOT NULL,
  location_radius_meters INTEGER DEFAULT 500,
  is_active BOOLEAN DEFAULT false,
  current_qr_token TEXT,
  qr_token_expires_at TIMESTAMP WITH TIME ZONE,
  rotating_qr_enabled BOOLEAN DEFAULT true,
  device_fingerprint_enabled BOOLEAN DEFAULT true,
  location_check_enabled BOOLEAN DEFAULT true,
  moderation_enabled BOOLEAN NOT NULL DEFAULT false,
  moderator_show_full_name BOOLEAN NOT NULL DEFAULT true,
  moderator_show_email BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create attendance records table (consolidated)
CREATE TABLE public.attendance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  attendee_name TEXT NOT NULL,
  attendee_email TEXT NOT NULL,
  device_fingerprint TEXT NOT NULL,
  location_lat DOUBLE PRECISION,
  location_lng DOUBLE PRECISION,
  location_provided BOOLEAN DEFAULT false,
  status attendance_status DEFAULT 'verified',
  suspicious_reason TEXT,
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(event_id, device_fingerprint),
  CONSTRAINT valid_email CHECK (attendee_email ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
  CONSTRAINT valid_name_length CHECK (LENGTH(attendee_name) >= 2 AND LENGTH(attendee_name) <= 100),
  CONSTRAINT valid_latitude CHECK (location_lat IS NULL OR (location_lat >= -90 AND location_lat <= 90)),
  CONSTRAINT valid_longitude CHECK (location_lng IS NULL OR (location_lng >= -180 AND location_lng <= 180))
);

-- 4. Create moderation links table
CREATE TABLE public.moderation_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  label TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 5. Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moderation_links ENABLE ROW LEVEL SECURITY;

-- 6. Policies

-- Profiles
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can delete own profile" ON public.profiles FOR DELETE USING (auth.uid() = id);

-- Seasons
CREATE POLICY "Admins can manage own seasons" ON public.seasons FOR ALL USING (auth.uid() = admin_id);

-- Events
CREATE POLICY "Admins can manage own events" ON public.events FOR ALL USING (auth.uid() = admin_id);
CREATE POLICY "Public can view active events" ON public.events FOR SELECT USING (is_active = true);
-- Permissive policy for moderation view
CREATE POLICY "Moderators can view events with valid moderation link" ON public.events AS PERMISSIVE FOR SELECT TO anon, authenticated USING (
  moderation_enabled = true AND EXISTS (
    SELECT 1 FROM public.moderation_links WHERE moderation_links.event_id = events.id AND moderation_links.is_active = true
  )
);

-- Attendance Records
CREATE POLICY "Admins can view attendance for their events" ON public.attendance_records FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.events WHERE events.id = attendance_records.event_id AND events.admin_id = auth.uid())
);
CREATE POLICY "Admins can update attendance for their events" ON public.attendance_records FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.events WHERE events.id = attendance_records.event_id AND events.admin_id = auth.uid())
);
CREATE POLICY "Admins can delete attendance for their events" ON public.attendance_records FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.events WHERE events.id = attendance_records.event_id AND events.admin_id = auth.uid())
);
CREATE POLICY "Anyone can insert attendance" ON public.attendance_records FOR INSERT WITH CHECK (true);

-- Moderation Links
CREATE POLICY "Admins can manage moderation links for their events" ON public.moderation_links FOR ALL USING (
  EXISTS (SELECT 1 FROM public.events WHERE events.id = moderation_links.event_id AND events.admin_id = auth.uid())
);
CREATE POLICY "Anyone can view active moderation links" ON public.moderation_links FOR SELECT USING (is_active = true);

-- 7. Functions and Triggers

-- Update Timestamp Function
CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_seasons_updated_at BEFORE UPDATE ON public.seasons FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON public.events FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- User Signup Handler
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id, 
    NEW.email, 
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 8. Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance_records;
ALTER PUBLICATION supabase_realtime ADD TABLE public.events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.moderation_links;
ALTER TABLE public.attendance_records REPLICA IDENTITY FULL;
