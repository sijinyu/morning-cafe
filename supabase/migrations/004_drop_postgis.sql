-- ==========================================================================
-- PostGIS 제거, 단순 lat/lng 컬럼으로 전환
-- 일론 머스크식: 불필요한 복잡성 제거
-- ==========================================================================

-- 기존 뷰 삭제
DROP VIEW IF EXISTS cafes_with_coords;

-- geography 컬럼 제거, 단순 숫자 컬럼 추가
ALTER TABLE cafes DROP COLUMN IF EXISTS location;
ALTER TABLE cafes ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE cafes ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

-- 인덱스 (단순 B-tree — PostGIS GIST 대체)
CREATE INDEX IF NOT EXISTS idx_cafes_latitude ON cafes (latitude);
CREATE INDEX IF NOT EXISTS idx_cafes_longitude ON cafes (longitude);

-- 새 뷰 (이제 그냥 패스스루)
CREATE OR REPLACE VIEW cafes_with_coords AS
SELECT *, latitude, longitude FROM cafes;

-- RPC 재생성 (PostGIS 없이)
CREATE OR REPLACE FUNCTION upsert_cafe_with_location(
  p_kakao_place_id TEXT,
  p_name TEXT,
  p_address TEXT,
  p_road_address TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_lng DOUBLE PRECISION DEFAULT NULL,
  p_lat DOUBLE PRECISION DEFAULT NULL,
  p_place_url TEXT DEFAULT NULL,
  p_instagram_url TEXT DEFAULT NULL,
  p_category TEXT DEFAULT NULL,
  p_opening_time TIME DEFAULT NULL,
  p_closing_time TIME DEFAULT NULL,
  p_hours_by_day JSONB DEFAULT NULL,
  p_is_earlybird BOOLEAN DEFAULT FALSE
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO cafes (
    kakao_place_id, name, address, road_address, phone,
    latitude, longitude,
    place_url, instagram_url, category,
    opening_time, closing_time, hours_by_day, is_earlybird,
    last_crawled_at
  ) VALUES (
    p_kakao_place_id, p_name, p_address, p_road_address, p_phone,
    p_lat, p_lng,
    p_place_url, p_instagram_url, p_category,
    p_opening_time, p_closing_time, p_hours_by_day, p_is_earlybird,
    NOW()
  )
  ON CONFLICT (kakao_place_id) DO UPDATE SET
    name           = EXCLUDED.name,
    address        = EXCLUDED.address,
    road_address   = EXCLUDED.road_address,
    phone          = EXCLUDED.phone,
    latitude       = COALESCE(EXCLUDED.latitude, cafes.latitude),
    longitude      = COALESCE(EXCLUDED.longitude, cafes.longitude),
    place_url      = EXCLUDED.place_url,
    instagram_url  = EXCLUDED.instagram_url,
    category       = EXCLUDED.category,
    opening_time   = EXCLUDED.opening_time,
    closing_time   = EXCLUDED.closing_time,
    hours_by_day   = EXCLUDED.hours_by_day,
    is_earlybird   = EXCLUDED.is_earlybird,
    last_crawled_at = NOW(),
    updated_at     = NOW()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION upsert_cafe_with_location FROM PUBLIC;
