-- Fix: remove recursive events policy (was causing infinite recursion on events SELECT)
DROP POLICY IF EXISTS "Moderators can view events with valid moderation link" ON public.events;