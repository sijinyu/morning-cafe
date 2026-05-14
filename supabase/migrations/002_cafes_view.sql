-- ============================================================================
-- Migration 002: cafes_with_coords view
-- ============================================================================
-- The Supabase REST API cannot execute PostGIS functions (ST_X / ST_Y) directly
-- in column selection, so we expose them through a stable view.
-- The frontend queries this view instead of the raw `cafes` table to get
-- pre-computed latitude and longitude float columns.
-- ============================================================================

CREATE OR REPLACE VIEW public.cafes_with_coords AS
SELECT
  id,
  kakao_place_id,
  name,
  address,
  road_address,
  phone,
  location,
  place_url,
  instagram_url,
  category,
  opening_time,
  closing_time,
  hours_by_day,
  is_earlybird,
  last_crawled_at,
  created_at,
  updated_at,
  ST_Y(location::geometry) AS latitude,
  ST_X(location::geometry) AS longitude
FROM public.cafes;

-- Grant read access to anon and authenticated roles (mirrors cafes table policy).
GRANT SELECT ON public.cafes_with_coords TO anon, authenticated;
