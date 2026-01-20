-- Notifications for workspace events (removals, etc.)
CREATE TABLE public.workspace_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  read_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX workspace_notifications_recipient_idx ON public.workspace_notifications (recipient_id, read_at);

ALTER TABLE public.workspace_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Recipients can view notifications" ON public.workspace_notifications
  FOR SELECT USING (recipient_id = auth.uid());

CREATE POLICY "Recipients can update notifications" ON public.workspace_notifications
  FOR UPDATE USING (recipient_id = auth.uid());

CREATE POLICY "Owners can insert notifications" ON public.workspace_notifications
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workspaces
      WHERE workspaces.id = workspace_notifications.workspace_id
      AND workspaces.owner_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION public.remove_workspace_member(workspace_id uuid, member_id uuid)
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
  WHERE id = workspace_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Workspace not found';
  END IF;

  IF ws.owner_id <> auth.uid() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF member_id = ws.owner_id THEN
    RAISE EXCEPTION 'Cannot remove workspace owner';
  END IF;

  DELETE FROM public.workspace_members
  WHERE workspace_members.workspace_id = workspace_id
    AND workspace_members.profile_id = member_id;

  INSERT INTO public.workspace_notifications (
    workspace_id,
    recipient_id,
    actor_id,
    type,
    message
  ) VALUES (
    workspace_id,
    member_id,
    auth.uid(),
    'member_removed',
    'You were removed from workspace: ' || ws.name
  );
END;
$$;

REVOKE ALL ON FUNCTION public.remove_workspace_member(uuid, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.remove_workspace_member(uuid, uuid) TO authenticated;
