-- 카페 메인 썸네일 URL 저장 (kakaocdn cthumb 280x280)
-- place-detail API 호출 없이 마커/리스트에서 사진 즉시 표시

-- 1. cafes 테이블에 thumbnail_url 컬럼 추가
ALTER TABLE cafes ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;

COMMENT ON COLUMN cafes.thumbnail_url IS '카카오 place-detail에서 가져온 첫 번째 사진 URL (C280x280.q70)';

-- 2. cafes_with_coords 뷰 재생성 (thumbnail_url 포함)
CREATE OR REPLACE VIEW cafes_with_coords AS
SELECT
    id,
    kakao_place_id,
    name,
    address,
    road_address,
    phone,
    latitude,
    longitude,
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
    gu,
    thumbnail_url
FROM cafes;
