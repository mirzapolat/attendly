-- Avoid recursive RLS checks for workspace membership
CREATE OR REPLACE FUNCTION public.is_workspace_member(workspace_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.workspace_members
    WHERE workspace_members.workspace_id = $1
      AND workspace_members.profile_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.is_workspace_member(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.is_workspace_member(uuid) TO authenticated;

-- Ensure owners are members of their workspaces
INSERT INTO public.workspace_members (workspace_id, profile_id)
SELECT id, owner_id
FROM public.workspaces
ON CONFLICT DO NOTHING;

-- Recreate policies to use membership helper
DROP POLICY IF EXISTS "Members can view workspace members" ON public.workspace_members;
CREATE POLICY "Members can view workspace members" ON public.workspace_members
  FOR SELECT USING (public.is_workspace_member(workspace_members.workspace_id));

DROP POLICY IF EXISTS "Members can view workspaces" ON public.workspaces;
CREATE POLICY "Members can view workspaces" ON public.workspaces
  FOR SELECT USING (
    public.is_workspace_member(workspaces.id)
    OR workspaces.owner_id = auth.uid()
  );

DROP POLICY IF EXISTS "Workspace members can view member profiles" ON public.profiles;
CREATE POLICY "Workspace members can view member profiles" ON public.profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.workspace_members wm
      WHERE wm.profile_id = profiles.id
      AND public.is_workspace_member(wm.workspace_id)
    )
  );
