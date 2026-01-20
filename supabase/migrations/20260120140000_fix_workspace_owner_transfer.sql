-- Allow workspace owners to transfer ownership while keeping RLS safe
CREATE OR REPLACE FUNCTION public.is_workspace_member_for(workspace_id uuid, profile_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.workspace_members
    WHERE workspace_members.workspace_id = $1
      AND workspace_members.profile_id = $2
  );
$$;

REVOKE ALL ON FUNCTION public.is_workspace_member_for(uuid, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.is_workspace_member_for(uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS "Owners can update workspaces" ON public.workspaces;
CREATE POLICY "Owners can update workspaces" ON public.workspaces
  FOR UPDATE USING (owner_id = auth.uid())
  WITH CHECK (public.is_workspace_member_for(workspaces.id, workspaces.owner_id));
