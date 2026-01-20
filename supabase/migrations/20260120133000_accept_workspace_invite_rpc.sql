-- Accept workspace invites via a security definer function to bypass RLS insert issues
CREATE OR REPLACE FUNCTION public.accept_workspace_invite(invite_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  invite_record RECORD;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT *
    INTO invite_record
  FROM public.workspace_invites
  WHERE id = invite_id
    AND status = 'pending'
    AND lower(trim(invited_email)) = lower(trim(auth.jwt() ->> 'email'))
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invite not found or not authorized';
  END IF;

  INSERT INTO public.workspace_members (workspace_id, profile_id)
  VALUES (invite_record.workspace_id, auth.uid())
  ON CONFLICT DO NOTHING;

  UPDATE public.workspace_invites
  SET status = 'accepted',
      responded_at = NOW()
  WHERE id = invite_id;
END;
$$;

REVOKE ALL ON FUNCTION public.accept_workspace_invite(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.accept_workspace_invite(uuid) TO authenticated;
