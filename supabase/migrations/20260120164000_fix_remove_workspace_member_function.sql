DROP FUNCTION IF EXISTS public.remove_workspace_member(uuid, uuid);

CREATE FUNCTION public.remove_workspace_member(p_workspace_id uuid, p_member_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ws RECORD;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT id, owner_id, name
  INTO ws
  FROM public.workspaces
  WHERE id = p_workspace_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Workspace not found';
  END IF;

  IF ws.owner_id <> auth.uid() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF p_member_id = ws.owner_id THEN
    RAISE EXCEPTION 'Cannot remove workspace owner';
  END IF;

  DELETE FROM public.workspace_members
  WHERE workspace_members.workspace_id = p_workspace_id
    AND workspace_members.profile_id = p_member_id;

  INSERT INTO public.workspace_notifications (
    workspace_id,
    recipient_id,
    actor_id,
    type,
    message
  ) VALUES (
    p_workspace_id,
    p_member_id,
    auth.uid(),
    'member_removed',
    'You were removed from workspace: ' || ws.name
  );
END;
$$;

REVOKE ALL ON FUNCTION public.remove_workspace_member(uuid, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.remove_workspace_member(uuid, uuid) TO authenticated;
