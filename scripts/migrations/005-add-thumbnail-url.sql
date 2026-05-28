-- 카페 메인 썸네일 URL 저장 (kakaocdn cthumb 280x280)
-- place-detail API 호출 없이 마커/리스트에서 사진 즉시 표시

ALTER TABLE cafes ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;

COMMENT ON COLUMN cafes.thumbnail_url IS '카카오 place-detail에서 가져온 첫 번째 사진 URL (C280x280.q70)';
