-- 001-add-gu-column.sql
-- cafes_with_coords에 gu 컬럼 추가 + 인덱싱
-- Supabase SQL Editor에서 실행

-- 1. gu 컬럼 추가
ALTER TABLE cafes_with_coords ADD COLUMN IF NOT EXISTS gu VARCHAR(20);

-- 2. 기존 address에서 gu 추출하여 채우기
UPDATE cafes_with_coords
SET gu = (regexp_match(address, '서울\S*\s+(\S+구)'))[1]
WHERE gu IS NULL;

-- 3. earlybird 카페 대상 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_cafes_gu_earlybird
ON cafes_with_coords (gu)
WHERE is_earlybird = true;

-- 4. 확인
SELECT gu, COUNT(*) as cnt
FROM cafes_with_coords
WHERE is_earlybird = true AND gu IS NOT NULL
GROUP BY gu
ORDER BY gu;
