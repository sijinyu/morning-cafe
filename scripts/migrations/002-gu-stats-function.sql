-- 002-gu-stats-function.sql
-- fetchGuStats를 PostgreSQL RPC 함수로 대체
-- 001-add-gu-column.sql 실행 후 적용
-- Supabase SQL Editor에서 실행

CREATE OR REPLACE FUNCTION get_gu_stats()
RETURNS TABLE (gu VARCHAR, count BIGINT, earliest TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.gu::VARCHAR,
    COUNT(*)::BIGINT,
    MIN(c.opening_time)::TEXT
  FROM cafes_with_coords c
  WHERE c.is_earlybird = true
    AND c.gu IS NOT NULL
  GROUP BY c.gu
  ORDER BY c.gu;
END;
$$ LANGUAGE plpgsql STABLE;
