-- Fix for infinite recursion in RLS policies

-- 1. Create a secure function to check event ownership
-- This function runs with SECURITY DEFINER to bypass the recursive RLS check on the events table
CREATE OR REPLACE FUNCTION public.is_event_admin(_event_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.events
    WHERE id = _event_id
    AND admin_id = auth.uid()
  );
END;
$$;

-- 2. Drop the problematic recursive policy
DROP POLICY IF EXISTS "Admins can manage moderation links for their events" ON public.moderation_links;

-- 3. Re-create the policy using the secure function
CREATE POLICY "Admins can manage moderation links for their events" ON public.moderation_links FOR ALL USING (
  public.is_event_admin(event_id)
);
