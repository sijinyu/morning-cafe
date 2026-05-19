-- 003-gu-trigger.sql
-- cafes 테이블 BEFORE INSERT/UPDATE 트리거: address에서 gu 자동 추출
-- 001-add-gu-column.sql 실행 후 적용
-- Supabase SQL Editor에서 실행

-- 1. 트리거 함수 생성
-- INSERT 시 항상, UPDATE 시 address가 변경되었거나 gu가 NULL인 경우에만 실행
CREATE OR REPLACE FUNCTION set_gu_from_address()
RETURNS TRIGGER AS $$
DECLARE
  extracted TEXT;
BEGIN
  IF NEW.address IS NOT NULL AND (
    TG_OP = 'INSERT' OR
    OLD.address IS DISTINCT FROM NEW.address OR
    NEW.gu IS NULL
  ) THEN
    extracted := (regexp_match(NEW.address, '서울\S*\s+(\S+구)'))[1];
    IF extracted IS NOT NULL THEN
      NEW.gu := extracted;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. 기존 트리거가 있으면 삭제 후 재생성
-- INSERT와 모든 UPDATE에서 작동 (함수 내부에서 조건 분기)
DROP TRIGGER IF EXISTS trg_set_gu_from_address ON cafes;

CREATE TRIGGER trg_set_gu_from_address
  BEFORE INSERT OR UPDATE ON cafes
  FOR EACH ROW
  EXECUTE FUNCTION set_gu_from_address();

-- 3. 기존 NULL 행 백필 (트리거는 새 INSERT/UPDATE에만 작동하므로)
UPDATE cafes
SET gu = (regexp_match(address, '서울\S*\s+(\S+구)'))[1]
WHERE gu IS NULL AND address IS NOT NULL;

-- 4. 확인: NULL gu가 없어야 함 (서울 주소가 있는 경우)
SELECT COUNT(*) AS remaining_null_gu
FROM cafes
WHERE gu IS NULL AND address LIKE '%서울%';
