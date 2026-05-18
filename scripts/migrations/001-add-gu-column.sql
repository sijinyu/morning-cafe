-- 001-add-gu-column.sql
-- cafes 테이블에 gu 컬럼 추가 + 뷰 재생성 + 인덱싱
-- Supabase SQL Editor에서 실행

-- 1. cafes 테이블에 gu 컬럼 추가
ALTER TABLE cafes ADD COLUMN IF NOT EXISTS gu VARCHAR(20);

-- 2. 기존 address에서 gu 추출하여 채우기
UPDATE cafes
SET gu = (regexp_match(address, '서울\S*\s+(\S+구)'))[1]
WHERE gu IS NULL;

-- 3. cafes_with_coords 뷰 재생성 (gu 컬럼 포함)
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
    gu
FROM cafes;

-- 4. earlybird 카페 대상 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_cafes_gu_earlybird
ON cafes (gu)
WHERE is_earlybird = true;

-- 5. 확인
SELECT gu, COUNT(*) as cnt
FROM cafes_with_coords
WHERE is_earlybird = true AND gu IS NOT NULL
GROUP BY gu
ORDER BY gu;
