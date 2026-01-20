-- Allow invitees to join a workspace when they have a pending invite
DROP POLICY IF EXISTS "Invitees can join workspace" ON public.workspace_members;
CREATE POLICY "Invitees can join workspace" ON public.workspace_members
  FOR INSERT WITH CHECK (
    profile_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.workspace_invites
      WHERE workspace_invites.workspace_id = workspace_members.workspace_id
        AND lower(workspace_invites.invited_email) = lower(auth.jwt() ->> 'email')
        AND workspace_invites.status = 'pending'
    )
  );
