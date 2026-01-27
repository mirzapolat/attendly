-- Store dismissed email typo suggestions per season/user
CREATE TABLE public.season_sanitize_dismissals (
  season_id UUID NOT NULL REFERENCES public.seasons(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  suggestion_id TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (season_id, user_id, suggestion_id)
);

CREATE INDEX season_sanitize_dismissals_season_id_idx
  ON public.season_sanitize_dismissals (season_id);

ALTER TABLE public.season_sanitize_dismissals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can manage own sanitize dismissals" ON public.season_sanitize_dismissals
  FOR ALL USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.seasons
      JOIN public.workspace_members
        ON workspace_members.workspace_id = seasons.workspace_id
      WHERE seasons.id = season_sanitize_dismissals.season_id
        AND workspace_members.profile_id = auth.uid()
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.seasons
      JOIN public.workspace_members
        ON workspace_members.workspace_id = seasons.workspace_id
      WHERE seasons.id = season_sanitize_dismissals.season_id
        AND workspace_members.profile_id = auth.uid()
    )
  );
