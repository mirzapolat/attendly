-- Create workspaces table
CREATE TABLE public.workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  brand_logo_url TEXT,
  brand_color TEXT DEFAULT 'default',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create workspace members table
CREATE TABLE public.workspace_members (
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (workspace_id, profile_id)
);

-- Create workspace invites table
CREATE TABLE public.workspace_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  invited_email TEXT NOT NULL,
  invited_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  responded_at TIMESTAMP WITH TIME ZONE,
  CONSTRAINT workspace_invites_status_check CHECK (status IN ('pending', 'accepted', 'declined', 'revoked'))
);

CREATE INDEX workspace_members_profile_id_idx ON public.workspace_members (profile_id);
CREATE INDEX workspace_invites_invited_email_idx ON public.workspace_invites (invited_email);
CREATE UNIQUE INDEX workspace_invites_pending_unique
  ON public.workspace_invites (workspace_id, invited_email)
  WHERE status = 'pending';

-- Add workspace references
ALTER TABLE public.seasons ADD COLUMN workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.events ADD COLUMN workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;

-- Backfill workspaces for existing profiles
INSERT INTO public.workspaces (id, owner_id, name, brand_color)
SELECT gen_random_uuid(), profiles.id, COALESCE(NULLIF(profiles.full_name, ''), profiles.email) || ' Workspace', 'default'
FROM public.profiles;

INSERT INTO public.workspace_members (workspace_id, profile_id)
SELECT workspaces.id, workspaces.owner_id
FROM public.workspaces
ON CONFLICT DO NOTHING;

UPDATE public.seasons
SET workspace_id = workspaces.id
FROM public.workspaces
WHERE seasons.admin_id = workspaces.owner_id;

UPDATE public.events
SET workspace_id = workspaces.id
FROM public.workspaces
WHERE events.admin_id = workspaces.owner_id;

-- Drop admin_id-dependent policies before removing admin_id columns
DROP POLICY IF EXISTS "Admins can manage own seasons" ON public.seasons;
DROP POLICY IF EXISTS "Admins can manage own events" ON public.events;
DROP POLICY IF EXISTS "Admins can view attendance for their events" ON public.attendance_records;
DROP POLICY IF EXISTS "Admins can update attendance for their events" ON public.attendance_records;
DROP POLICY IF EXISTS "Admins can insert attendance for their events" ON public.attendance_records;
DROP POLICY IF EXISTS "Admins can delete attendance for their events" ON public.attendance_records;
DROP POLICY IF EXISTS "Admins can manage moderation links for their events" ON public.moderation_links;
DROP POLICY IF EXISTS "Admins can manage excuse links for their events" ON public.excuse_links;

ALTER TABLE public.seasons ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.events ALTER COLUMN workspace_id SET NOT NULL;

ALTER TABLE public.seasons DROP COLUMN admin_id;
ALTER TABLE public.events DROP COLUMN admin_id;

-- Enable RLS
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_invites ENABLE ROW LEVEL SECURITY;

-- Workspace policies
CREATE POLICY "Members can view workspaces" ON public.workspaces
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members
      WHERE workspace_members.workspace_id = workspaces.id
      AND workspace_members.profile_id = auth.uid()
    )
  );

CREATE POLICY "Owners can insert workspaces" ON public.workspaces
  FOR INSERT WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Owners can update workspaces" ON public.workspaces
  FOR UPDATE USING (owner_id = auth.uid());

CREATE POLICY "Owners can delete workspaces" ON public.workspaces
  FOR DELETE USING (owner_id = auth.uid());

-- Profile policies for workspace visibility
CREATE POLICY "Workspace members can view member profiles" ON public.profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.workspace_members self_members
      JOIN public.workspace_members other_members
        ON other_members.workspace_id = self_members.workspace_id
      WHERE self_members.profile_id = auth.uid()
      AND other_members.profile_id = profiles.id
    )
  );

-- Workspace members policies
CREATE POLICY "Members can view workspace members" ON public.workspace_members
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members members
      WHERE members.workspace_id = workspace_members.workspace_id
      AND members.profile_id = auth.uid()
    )
  );

CREATE POLICY "Owners can insert workspace members" ON public.workspace_members
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workspaces
      WHERE workspaces.id = workspace_members.workspace_id
      AND workspaces.owner_id = auth.uid()
    )
  );

CREATE POLICY "Owners can delete workspace members" ON public.workspace_members
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.workspaces
      WHERE workspaces.id = workspace_members.workspace_id
      AND workspaces.owner_id = auth.uid()
    )
  );

CREATE POLICY "Members can leave workspace" ON public.workspace_members
  FOR DELETE USING (profile_id = auth.uid());

-- Workspace invite policies
CREATE POLICY "Owners can manage invites" ON public.workspace_invites
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.workspaces
      WHERE workspaces.id = workspace_invites.workspace_id
      AND workspaces.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workspaces
      WHERE workspaces.id = workspace_invites.workspace_id
      AND workspaces.owner_id = auth.uid()
    )
  );

CREATE POLICY "Invitees can view invites" ON public.workspace_invites
  FOR SELECT USING (lower(invited_email) = lower(auth.jwt() ->> 'email'));

CREATE POLICY "Invitees can respond to invites" ON public.workspace_invites
  FOR UPDATE USING (lower(invited_email) = lower(auth.jwt() ->> 'email'))
  WITH CHECK (lower(invited_email) = lower(auth.jwt() ->> 'email'));

-- Update season/event policies
CREATE POLICY "Members can manage seasons" ON public.seasons
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members
      WHERE workspace_members.workspace_id = seasons.workspace_id
      AND workspace_members.profile_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workspace_members
      WHERE workspace_members.workspace_id = seasons.workspace_id
      AND workspace_members.profile_id = auth.uid()
    )
  );

CREATE POLICY "Members can manage events" ON public.events
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members
      WHERE workspace_members.workspace_id = events.workspace_id
      AND workspace_members.profile_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workspace_members
      WHERE workspace_members.workspace_id = events.workspace_id
      AND workspace_members.profile_id = auth.uid()
    )
  );

-- Update attendance record policies
CREATE POLICY "Members can view attendance for their events" ON public.attendance_records
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.events
      JOIN public.workspace_members
        ON workspace_members.workspace_id = events.workspace_id
      WHERE events.id = attendance_records.event_id
      AND workspace_members.profile_id = auth.uid()
    )
  );

CREATE POLICY "Members can update attendance for their events" ON public.attendance_records
  FOR UPDATE USING (
    EXISTS (
      SELECT 1
      FROM public.events
      JOIN public.workspace_members
        ON workspace_members.workspace_id = events.workspace_id
      WHERE events.id = attendance_records.event_id
      AND workspace_members.profile_id = auth.uid()
    )
  );

CREATE POLICY "Members can insert attendance for their events" ON public.attendance_records
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.events
      JOIN public.workspace_members
        ON workspace_members.workspace_id = events.workspace_id
      WHERE events.id = attendance_records.event_id
      AND workspace_members.profile_id = auth.uid()
    )
  );

CREATE POLICY "Members can delete attendance for their events" ON public.attendance_records
  FOR DELETE USING (
    EXISTS (
      SELECT 1
      FROM public.events
      JOIN public.workspace_members
        ON workspace_members.workspace_id = events.workspace_id
      WHERE events.id = attendance_records.event_id
      AND workspace_members.profile_id = auth.uid()
    )
  );

CREATE POLICY "Members can manage moderation links for their events" ON public.moderation_links
  FOR ALL USING (
    EXISTS (
      SELECT 1
      FROM public.events
      JOIN public.workspace_members
        ON workspace_members.workspace_id = events.workspace_id
      WHERE events.id = moderation_links.event_id
      AND workspace_members.profile_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.events
      JOIN public.workspace_members
        ON workspace_members.workspace_id = events.workspace_id
      WHERE events.id = moderation_links.event_id
      AND workspace_members.profile_id = auth.uid()
    )
  );

CREATE POLICY "Members can manage excuse links for their events" ON public.excuse_links
  FOR ALL USING (
    EXISTS (
      SELECT 1
      FROM public.events
      JOIN public.workspace_members
        ON workspace_members.workspace_id = events.workspace_id
      WHERE events.id = excuse_links.event_id
      AND workspace_members.profile_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.events
      JOIN public.workspace_members
        ON workspace_members.workspace_id = events.workspace_id
      WHERE events.id = excuse_links.event_id
      AND workspace_members.profile_id = auth.uid()
    )
  );

-- Trigger for workspaces updated_at
CREATE TRIGGER update_workspaces_updated_at
  BEFORE UPDATE ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
