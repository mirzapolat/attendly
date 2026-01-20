-- Allow invitees to see the inviter profile for pending invites
DROP POLICY IF EXISTS "Invitees can view inviter profiles" ON public.profiles;
CREATE POLICY "Invitees can view inviter profiles" ON public.profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.workspace_invites
      WHERE workspace_invites.invited_by = profiles.id
        AND workspace_invites.status = 'pending'
        AND lower(trim(workspace_invites.invited_email)) = lower(trim(auth.jwt() ->> 'email'))
    )
  );
