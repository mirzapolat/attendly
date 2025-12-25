-- Fix missing profiles for existing users
-- Run this in your Supabase SQL Editor to generate profiles for users who signed up before the triggers were active

INSERT INTO public.profiles (id, email, full_name)
SELECT 
  id, 
  email, 
  COALESCE(raw_user_meta_data->>'full_name', email) as full_name
FROM auth.users
ON CONFLICT (id) DO NOTHING;
