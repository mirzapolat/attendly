-- Make sanitize dismissals shared across workspace members
ALTER TABLE public.season_sanitize_dismissals
  ADD COLUMN IF NOT EXISTS dismissed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'season_sanitize_dismissals'
      AND column_name = 'user_id'
  ) THEN
    UPDATE public.season_sanitize_dismissals
    SET dismissed_by = user_id
    WHERE dismissed_by IS NULL;
  END IF;
END $$;

DROP POLICY IF EXISTS "Members can manage own sanitize dismissals" ON public.season_sanitize_dismissals;
DROP POLICY IF EXISTS "Members can manage sanitize dismissals" ON public.season_sanitize_dismissals;

ALTER TABLE public.season_sanitize_dismissals
  DROP CONSTRAINT IF EXISTS season_sanitize_dismissals_pkey;

ALTER TABLE public.season_sanitize_dismissals
  DROP COLUMN IF EXISTS user_id;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'season_sanitize_dismissals_pkey'
      AND conrelid = 'public.season_sanitize_dismissals'::regclass
  ) THEN
    ALTER TABLE public.season_sanitize_dismissals
      ADD PRIMARY KEY (season_id, suggestion_id);
  END IF;
END $$;

CREATE POLICY "Members can manage sanitize dismissals" ON public.season_sanitize_dismissals
  FOR ALL USING (
    EXISTS (
      SELECT 1
      FROM public.seasons
      JOIN public.workspace_members
        ON workspace_members.workspace_id = seasons.workspace_id
      WHERE seasons.id = season_sanitize_dismissals.season_id
        AND workspace_members.profile_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.seasons
      JOIN public.workspace_members
        ON workspace_members.workspace_id = seasons.workspace_id
      WHERE seasons.id = season_sanitize_dismissals.season_id
        AND workspace_members.profile_id = auth.uid()
    )
  );
