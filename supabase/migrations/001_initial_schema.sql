-- ============================================================================
-- Seoul Earlybird Cafe Finder - Initial Schema Migration
-- ============================================================================
-- Supabase PostgreSQL migration for discovering cafes that open early in Seoul.
-- Uses PostGIS for spatial queries, RLS for multi-tenant security, and
-- optimized indexes for the primary access patterns (nearby + early open).
-- ============================================================================

-- --------------------------------------------------------------------------
-- Extensions
-- --------------------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA extensions;

-- --------------------------------------------------------------------------
-- Helper: updated_at trigger function
-- --------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- --------------------------------------------------------------------------
-- Table: cafes
-- --------------------------------------------------------------------------

CREATE TABLE public.cafes (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  kakao_place_id text        UNIQUE NOT NULL,
  name           text        NOT NULL,
  address        text        NOT NULL,                        -- jibeon address
  road_address   text,                                        -- road-name address
  phone          text,
  location       geography(POINT, 4326) NOT NULL,             -- PostGIS point
  place_url      text,                                        -- Kakao Map detail URL
  instagram_url  text,
  category       text,                                        -- cafe sub-category
  opening_time   time,                                        -- e.g. 06:30
  closing_time   time,
  hours_by_day   jsonb,                                       -- {"mon":"06:30~22:00", ...}
  is_earlybird   boolean     NOT NULL DEFAULT false,          -- opens before 08:00
  last_crawled_at timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.cafes                IS 'Cafes in Seoul with opening-hour metadata.';
COMMENT ON COLUMN public.cafes.is_earlybird   IS 'True when opening_time < 08:00.';
COMMENT ON COLUMN public.cafes.hours_by_day   IS 'Per-day hours, e.g. {"mon":"06:30~22:00","tue":"07:00~21:00"}.';
COMMENT ON COLUMN public.cafes.location       IS 'WGS-84 point (lon, lat) stored as geography for metre-accurate distance queries.';

-- Trigger: auto-update updated_at on row change
CREATE TRIGGER cafes_updated_at
  BEFORE UPDATE ON public.cafes
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- --------------------------------------------------------------------------
-- Table: favorites
-- --------------------------------------------------------------------------

CREATE TABLE public.favorites (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  cafe_id    uuid        NOT NULL REFERENCES public.cafes (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT favorites_user_cafe_unique UNIQUE (user_id, cafe_id)
);

COMMENT ON TABLE public.favorites IS 'User-bookmarked cafes.';

-- --------------------------------------------------------------------------
-- Table: reviews
-- --------------------------------------------------------------------------

CREATE TABLE public.reviews (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  cafe_id    uuid        NOT NULL REFERENCES public.cafes (id) ON DELETE CASCADE,
  content    text        NOT NULL CONSTRAINT reviews_content_length CHECK (char_length(content) <= 100),
  tags       text[],                                          -- e.g. {"quiet","outlets"}
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.reviews      IS 'Short user reviews (max 100 chars) with optional tags.';
COMMENT ON COLUMN public.reviews.tags IS 'Free-form tags, e.g. {"quiet","many_outlets"}.';

-- --------------------------------------------------------------------------
-- Table: reports
-- --------------------------------------------------------------------------

CREATE TABLE public.reports (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  cafe_id     uuid        REFERENCES public.cafes (id) ON DELETE SET NULL,
  report_type text        NOT NULL CONSTRAINT reports_type_check
                            CHECK (report_type IN ('hours_correction', 'new_cafe', 'closed')),
  content     text        NOT NULL,
  status      text        NOT NULL DEFAULT 'pending'
                            CONSTRAINT reports_status_check
                            CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.reports IS 'User-submitted corrections and new-cafe suggestions.';

-- --------------------------------------------------------------------------
-- Table: crawl_queue
-- --------------------------------------------------------------------------

CREATE TABLE public.crawl_queue (
  id              bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kakao_place_id  text        NOT NULL,
  status          text        NOT NULL DEFAULT 'pending'
                                CONSTRAINT crawl_queue_status_check
                                CHECK (status IN ('pending', 'processing', 'done', 'failed')),
  attempts        int         NOT NULL DEFAULT 0,
  error_message   text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  processed_at    timestamptz
);

COMMENT ON TABLE public.crawl_queue IS 'Background crawl jobs processed by the scraper worker.';

-- --------------------------------------------------------------------------
-- Indexes
-- --------------------------------------------------------------------------

-- Spatial: "cafes near me" queries
CREATE INDEX cafes_location_gist_idx    ON public.cafes USING gist (location);

-- Earlybird filter: WHERE is_earlybird = true
CREATE INDEX cafes_is_earlybird_idx     ON public.cafes (is_earlybird) WHERE is_earlybird = true;

-- Opening time range queries
CREATE INDEX cafes_opening_time_idx     ON public.cafes (opening_time);

-- Kakao place ID lookups (already UNIQUE, but explicit for clarity -- handled by unique constraint)
-- The UNIQUE constraint on kakao_place_id automatically creates an index.

-- Crawl queue: workers pick pending jobs
CREATE INDEX crawl_queue_status_idx     ON public.crawl_queue (status) WHERE status = 'pending';

-- Favorites: user's bookmarks
CREATE INDEX favorites_user_id_idx      ON public.favorites (user_id);

-- Reviews: reviews for a given cafe
CREATE INDEX reviews_cafe_id_idx        ON public.reviews (cafe_id);

-- Foreign key indexes (prevent seq scans on JOIN / ON DELETE CASCADE)
CREATE INDEX favorites_cafe_id_idx      ON public.favorites (cafe_id);
CREATE INDEX reviews_user_id_idx        ON public.reviews (user_id);
CREATE INDEX reports_user_id_idx        ON public.reports (user_id);
CREATE INDEX reports_cafe_id_idx        ON public.reports (cafe_id);

-- Composite index for the most common query: nearby earlybird cafes
CREATE INDEX cafes_earlybird_opening_idx ON public.cafes (is_earlybird, opening_time)
  WHERE is_earlybird = true;

-- --------------------------------------------------------------------------
-- Row Level Security
-- --------------------------------------------------------------------------

-- Enable RLS on every public table.
ALTER TABLE public.cafes       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorites   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crawl_queue ENABLE ROW LEVEL SECURITY;

-- Force RLS even for table owners (Supabase service_role bypasses via supabase_admin).
ALTER TABLE public.cafes       FORCE ROW LEVEL SECURITY;
ALTER TABLE public.favorites   FORCE ROW LEVEL SECURITY;
ALTER TABLE public.reviews     FORCE ROW LEVEL SECURITY;
ALTER TABLE public.reports     FORCE ROW LEVEL SECURITY;
ALTER TABLE public.crawl_queue FORCE ROW LEVEL SECURITY;

-- ---- cafes: public read, service_role write --------------------------------

CREATE POLICY "cafes: anyone can read"
  ON public.cafes
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- service_role bypasses RLS by default in Supabase, so no explicit
-- INSERT/UPDATE/DELETE policies are needed. All other roles are denied.

-- ---- favorites: own records only -------------------------------------------

CREATE POLICY "favorites: users can read own"
  ON public.favorites
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "favorites: users can insert own"
  ON public.favorites
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "favorites: users can delete own"
  ON public.favorites
  FOR DELETE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- ---- reviews: public read, own write/delete --------------------------------

CREATE POLICY "reviews: anyone can read"
  ON public.reviews
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "reviews: users can insert own"
  ON public.reviews
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "reviews: users can delete own"
  ON public.reviews
  FOR DELETE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- ---- reports: own read, authenticated insert --------------------------------

CREATE POLICY "reports: users can read own"
  ON public.reports
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "reports: authenticated users can insert"
  ON public.reports
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- ---- crawl_queue: no public access -----------------------------------------
-- No policies defined. Only service_role (which bypasses RLS) can access.

-- --------------------------------------------------------------------------
-- Grants
-- --------------------------------------------------------------------------
-- Supabase manages role grants via its default setup. The grants below make
-- the intent explicit and ensure least-privilege access.

-- Public tables readable by anon and authenticated
GRANT SELECT ON public.cafes TO anon, authenticated;

-- Authenticated users can manage their own favorites, reviews, reports
GRANT SELECT, INSERT, DELETE ON public.favorites TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.reviews   TO authenticated;
GRANT SELECT, INSERT         ON public.reports   TO authenticated;

-- crawl_queue: no grants to anon or authenticated (service_role only)
-- service_role already has full access via Supabase's default configuration.
