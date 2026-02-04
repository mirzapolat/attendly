-- Rename seasons terminology to series

-- Rename main table
ALTER TABLE public.seasons RENAME TO series;

-- Rename events foreign key column
ALTER TABLE public.events RENAME COLUMN season_id TO series_id;

-- Rename events foreign key constraint if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'events_season_id_fkey'
      AND conrelid = 'public.events'::regclass
  ) THEN
    ALTER TABLE public.events
      RENAME CONSTRAINT events_season_id_fkey TO events_series_id_fkey;
  END IF;
END $$;

-- Rename workspace foreign key constraint on series if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'seasons_workspace_id_fkey'
      AND conrelid = 'public.series'::regclass
  ) THEN
    ALTER TABLE public.series
      RENAME CONSTRAINT seasons_workspace_id_fkey TO series_workspace_id_fkey;
  END IF;
END $$;

-- Rename updated_at trigger on series if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'update_seasons_updated_at'
      AND tgrelid = 'public.series'::regclass
  ) THEN
    ALTER TRIGGER update_seasons_updated_at ON public.series
      RENAME TO update_series_updated_at;
  END IF;
END $$;

-- Rename sanitize dismissals table and column
ALTER TABLE public.season_sanitize_dismissals RENAME TO series_sanitize_dismissals;
ALTER TABLE public.series_sanitize_dismissals RENAME COLUMN season_id TO series_id;

-- Rename sanitize dismissals primary key if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'season_sanitize_dismissals_pkey'
      AND conrelid = 'public.series_sanitize_dismissals'::regclass
  ) THEN
    ALTER TABLE public.series_sanitize_dismissals
      RENAME CONSTRAINT season_sanitize_dismissals_pkey TO series_sanitize_dismissals_pkey;
  END IF;
END $$;

-- Rename sanitize dismissals foreign key if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'season_sanitize_dismissals_season_id_fkey'
      AND conrelid = 'public.series_sanitize_dismissals'::regclass
  ) THEN
    ALTER TABLE public.series_sanitize_dismissals
      RENAME CONSTRAINT season_sanitize_dismissals_season_id_fkey TO series_sanitize_dismissals_series_id_fkey;
  END IF;
END $$;

-- Rename dismissed_by foreign key if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'season_sanitize_dismissals_dismissed_by_fkey'
      AND conrelid = 'public.series_sanitize_dismissals'::regclass
  ) THEN
    ALTER TABLE public.series_sanitize_dismissals
      RENAME CONSTRAINT season_sanitize_dismissals_dismissed_by_fkey TO series_sanitize_dismissals_dismissed_by_fkey;
  END IF;
END $$;

-- Rename sanitize dismissals index if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_class
    WHERE relname = 'season_sanitize_dismissals_season_id_idx'
      AND relkind = 'i'
  ) THEN
    ALTER INDEX public.season_sanitize_dismissals_season_id_idx
      RENAME TO series_sanitize_dismissals_series_id_idx;
  END IF;
END $$;

-- Rename policies to series naming if they exist
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'series'
      AND policyname = 'Members can manage seasons'
  ) THEN
    ALTER POLICY "Members can manage seasons" ON public.series
      RENAME TO "Members can manage series";
  END IF;
END $$;

-- Recreate sanitize dismissals policy to reference series
DROP POLICY IF EXISTS "Members can manage sanitize dismissals" ON public.series_sanitize_dismissals;

CREATE POLICY "Members can manage sanitize dismissals" ON public.series_sanitize_dismissals
  FOR ALL USING (
    EXISTS (
      SELECT 1
      FROM public.series
      JOIN public.workspace_members
        ON workspace_members.workspace_id = series.workspace_id
      WHERE series.id = series_sanitize_dismissals.series_id
        AND workspace_members.profile_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.series
      JOIN public.workspace_members
        ON workspace_members.workspace_id = series.workspace_id
      WHERE series.id = series_sanitize_dismissals.series_id
        AND workspace_members.profile_id = auth.uid()
    )
  );
