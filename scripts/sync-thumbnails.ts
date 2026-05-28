/**
 * 카페 thumbnail_url 배치 동기화 스크립트
 *
 * kakao place-detail API에서 첫 번째 사진 URL을 가져와
 * Supabase cafes 테이블의 thumbnail_url 컬럼에 저장한다.
 *
 * 사용법:
 *   npx tsx scripts/sync-thumbnails.ts
 *
 * 환경변수 필요:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY (또는 NEXT_PUBLIC_SUPABASE_ANON_KEY)
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 환경변수 필요');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const DETAIL_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Referer: 'https://place.map.kakao.com/',
  pf: 'PC',
};

// 레이트 리밋 방지 — 요청 간 딜레이 (ms)
const DELAY_MS = 200;
// 한 번에 처리할 카페 수 (0 = 전체)
const BATCH_LIMIT = Number(process.env.BATCH_LIMIT) || 0;

async function fetchFirstPhoto(kakaoPlaceId: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://place-api.map.kakao.com/places/panel3/${kakaoPlaceId}`,
      { headers: DETAIL_HEADERS, signal: AbortSignal.timeout(5000) },
    );
    if (!res.ok) return null;

    const data = await res.json();
    const rawPhotos: { url: string }[] = data?.photos?.photos ?? [];
    if (rawPhotos.length === 0) return null;

    const firstUrl = rawPhotos[0].url?.replace('http://', 'https://');
    if (!firstUrl) return null;

    // C280x280 썸네일 URL로 변환
    return `https://img1.kakaocdn.net/cthumb/local/C280x280.q70/?fname=${encodeURIComponent(firstUrl)}`;
  } catch {
    return null;
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  console.log('🔍 thumbnail_url이 비어있는 카페 조회 중...');

  // thumbnail_url이 NULL인 earlybird 카페만 가져오기
  let query = supabase
    .from('cafes_with_coords')
    .select('id, kakao_place_id, name')
    .eq('is_earlybird', true)
    .is('thumbnail_url', null)
    .order('created_at', { ascending: false });

  if (BATCH_LIMIT > 0) {
    query = query.limit(BATCH_LIMIT);
  }

  const { data: cafes, error } = await query;

  if (error) {
    console.error('❌ Supabase 조회 실패:', error.message);
    process.exit(1);
  }

  if (!cafes || cafes.length === 0) {
    console.log('✅ 모든 카페에 thumbnail_url이 이미 있습니다.');
    return;
  }

  console.log(`📸 ${cafes.length}개 카페 thumbnail 동기화 시작...\n`);

  let success = 0;
  let noPhoto = 0;
  let failed = 0;

  for (let i = 0; i < cafes.length; i++) {
    const cafe = cafes[i];
    const progress = `[${i + 1}/${cafes.length}]`;

    const thumbnailUrl = await fetchFirstPhoto(cafe.kakao_place_id);

    if (thumbnailUrl) {
      const { error: updateError } = await supabase
        .from('cafes')
        .update({ thumbnail_url: thumbnailUrl })
        .eq('id', cafe.id);

      if (updateError) {
        console.log(`${progress} ❌ ${cafe.name} — DB 업데이트 실패: ${updateError.message}`);
        failed++;
      } else {
        console.log(`${progress} ✅ ${cafe.name}`);
        success++;
      }
    } else {
      console.log(`${progress} ⬜ ${cafe.name} — 사진 없음`);
      noPhoto++;
    }

    // 레이트 리밋 방지
    if (i < cafes.length - 1) await sleep(DELAY_MS);
  }

  console.log(`\n📊 완료: ✅ ${success}개 저장 / ⬜ ${noPhoto}개 사진없음 / ❌ ${failed}개 실패`);
}

main().catch(console.error);
