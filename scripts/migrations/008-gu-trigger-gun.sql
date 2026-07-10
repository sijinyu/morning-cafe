-- 008-gu-trigger-gun.sql
-- gu 트리거 업데이트: 경기도 군(양평군, 가평군, 연천군) 지원 추가
-- Supabase SQL Editor에서 실행

-- 1. 트리거 함수 교체 (서울 + 경기도 시/구/군)
CREATE OR REPLACE FUNCTION set_gu_from_address()
RETURNS TRIGGER AS $$
DECLARE
  extracted TEXT;
  city TEXT;
  district TEXT;
  gun TEXT;
BEGIN
  IF NEW.address IS NOT NULL AND (
    TG_OP = 'INSERT' OR
    OLD.address IS DISTINCT FROM NEW.address OR
    NEW.gu IS NULL
  ) THEN
    -- 서울: "서울 강남구" → "강남구"
    extracted := (regexp_match(NEW.address, '서울\S*\s+(\S+구)'))[1];
    IF extracted IS NOT NULL THEN
      NEW.gu := extracted;
      RETURN NEW;
    END IF;

    -- 경기도 (시+구): "경기 성남시 분당구" → "성남시 분당구"
    city := (regexp_match(NEW.address, '경기\S*\s+(\S+시)'))[1];
    district := (regexp_match(NEW.address, '경기\S*\s+\S+시\s+(\S+구)'))[1];
    IF city IS NOT NULL AND district IS NOT NULL THEN
      NEW.gu := city || ' ' || district;
      RETURN NEW;
    END IF;

    -- 경기도 (구 없는 시): "경기 하남시" → "하남시"
    IF city IS NOT NULL THEN
      NEW.gu := city;
      RETURN NEW;
    END IF;

    -- 경기도 (군): "경기 양평군" → "양평군"
    gun := (regexp_match(NEW.address, '경기\S*\s+(\S+군)'))[1];
    IF gun IS NOT NULL THEN
      NEW.gu := gun;
      RETURN NEW;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. 기존 경기도 군 카페의 gu 백필
UPDATE cafes
SET gu = (regexp_match(address, '경기\S*\s+(\S+군)'))[1]
WHERE gu IS NULL
  AND address LIKE '%경기%'
  AND (regexp_match(address, '경기\S*\s+(\S+군)'))[1] IS NOT NULL;

-- 3. 확인
SELECT gu, COUNT(*) AS cnt
FROM cafes
WHERE gu IS NOT NULL
GROUP BY gu
ORDER BY cnt DESC;
