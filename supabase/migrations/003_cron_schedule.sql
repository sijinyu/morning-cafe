-- ==========================================================================
-- pg_cron 스케줄링: 매일 새벽 크롤링 + 큐 프로세싱
-- ==========================================================================

-- pg_cron + pg_net 확장 활성화
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Vault에 프로젝트 URL과 서비스 키 저장 (수동 실행 필요)
-- SELECT vault.create_secret('https://YOUR_PROJECT.supabase.co', 'project_url');
-- SELECT vault.create_secret('YOUR_SERVICE_ROLE_KEY', 'service_role_key');

-- ==========================================================================
-- 1) 매일 새벽 3시(KST = UTC 18:00 전일) seed-crawl-queue 실행
-- ==========================================================================
SELECT cron.schedule(
  'seed-crawl-queue-daily',
  '0 18 * * *',  -- UTC 18:00 = KST 03:00
  $$
  SELECT net.http_post(
    url   := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
             || '/functions/v1/seed-crawl-queue',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key'),
      'Content-Type', 'application/json'
    ),
    body  := '{}'::jsonb
  );
  $$
);

-- ==========================================================================
-- 2) 매 30초마다 process-crawl-queue 실행
-- ==========================================================================
SELECT cron.schedule(
  'process-crawl-queue-worker',
  '30 seconds',
  $$
  SELECT net.http_post(
    url   := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
             || '/functions/v1/process-crawl-queue',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key'),
      'Content-Type', 'application/json'
    ),
    body  := '{}'::jsonb
  );
  $$
);

-- ==========================================================================
-- 3) RPC: PostGIS upsert (Edge Function에서 호출)
-- ==========================================================================
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
    location, place_url, instagram_url, category,
    opening_time, closing_time, hours_by_day, is_earlybird,
    last_crawled_at
  ) VALUES (
    p_kakao_place_id, p_name, p_address, p_road_address, p_phone,
    CASE
      WHEN p_lng IS NOT NULL AND p_lat IS NOT NULL
      THEN ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
      ELSE NULL
    END,
    p_place_url, p_instagram_url, p_category,
    p_opening_time, p_closing_time, p_hours_by_day, p_is_earlybird,
    NOW()
  )
  ON CONFLICT (kakao_place_id) DO UPDATE SET
    name           = EXCLUDED.name,
    address        = EXCLUDED.address,
    road_address   = EXCLUDED.road_address,
    phone          = EXCLUDED.phone,
    location       = COALESCE(EXCLUDED.location, cafes.location),
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

-- ==========================================================================
-- 4) RPC: 큐 원자적 claim (FOR UPDATE SKIP LOCKED)
-- ==========================================================================
CREATE OR REPLACE FUNCTION claim_crawl_queue_batch(batch_size INT DEFAULT 5)
RETURNS SETOF crawl_queue
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE crawl_queue
  SET status = 'processing',
      processed_at = NOW()
  WHERE id IN (
    SELECT id FROM crawl_queue
    WHERE status = 'pending'
    ORDER BY id
    LIMIT batch_size
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
END;
$$;

-- Grant RPC 실행 권한 (service_role만)
REVOKE ALL ON FUNCTION upsert_cafe_with_location FROM PUBLIC;
REVOKE ALL ON FUNCTION claim_crawl_queue_batch FROM PUBLIC;
