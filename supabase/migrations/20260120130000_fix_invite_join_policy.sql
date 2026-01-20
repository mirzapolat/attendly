-- Allow invitees to join workspaces via a security definer check
CREATE OR REPLACE FUNCTION public.has_pending_workspace_invite(workspace_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.workspace_invites
    WHERE workspace_invites.workspace_id = $1
      AND workspace_invites.status = 'pending'
      AND lower(trim(workspace_invites.invited_email)) = lower(trim(auth.jwt() ->> 'email'))
  );
$$;

REVOKE ALL ON FUNCTION public.has_pending_workspace_invite(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.has_pending_workspace_invite(uuid) TO authenticated;

DROP POLICY IF EXISTS "Invitees can join workspace" ON public.workspace_members;
CREATE POLICY "Invitees can join workspace" ON public.workspace_members
  FOR INSERT WITH CHECK (
    profile_id = auth.uid()
    AND public.has_pending_workspace_invite(workspace_members.workspace_id)
  );
