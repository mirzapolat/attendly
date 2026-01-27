-- Allow invitees to view workspace name/logo for pending invites (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'workspaces'
      AND policyname = 'Invitees can view invited workspaces'
  ) THEN
    CREATE POLICY "Invitees can view invited workspaces" ON public.workspaces
      FOR SELECT USING (
        public.has_pending_workspace_invite(workspaces.id)
      );
  END IF;
END;
$$;
