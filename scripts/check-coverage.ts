import { config } from 'dotenv';
config({ path: '.env.local' });

const KAKAO_KEY = process.env.KAKAO_REST_API_KEY!;

// 카페 밀집 지역 테스트 — 반경 2km에 카페가 675개 넘는지 확인
const TEST_AREAS = [
  { name: '강남역', lat: 37.4980, lng: 127.0276 },
  { name: '홍대입구', lat: 37.5563, lng: 126.9236 },
  { name: '신촌', lat: 37.5551, lng: 126.9368 },
  { name: '이태원', lat: 37.5345, lng: 126.9946 },
  { name: '성수', lat: 37.5447, lng: 127.0557 },
];

async function countCafes(lat: number, lng: number, radius: number): Promise<{ total: number; isEnd: boolean }> {
  let total = 0;
  let lastIsEnd = false;
  for (let page = 1; page <= 45; page++) {
    const params = new URLSearchParams({
      category_group_code: 'CE7', x: String(lng), y: String(lat),
      radius: String(radius), page: String(page), size: '15', sort: 'distance',
    });
    const res = await fetch(`https://dapi.kakao.com/v2/local/search/category.json?${params}`, {
      headers: { Authorization: `KakaoAK ${KAKAO_KEY}` },
    });
    const data = await res.json();
    total += data.documents.length;
    lastIsEnd = data.meta.is_end;
    if (data.meta.is_end) break;
    await new Promise(r => setTimeout(r, 50));
  }
  return { total, isEnd: lastIsEnd };
}

async function main() {
  console.log('=== 카페 밀집도 & API 커버리지 확인 ===\n');

  for (const area of TEST_AREAS) {
    const r2k = await countCafes(area.lat, area.lng, 2000);
    const r1k = await countCafes(area.lat, area.lng, 1000);
    const truncated = !r2k.isEnd;
    console.log(`${area.name}: 2km=${r2k.total}개${truncated ? ' ⚠️ TRUNCATED (675건 상한 도달!)' : ''}, 1km=${r1k.total}개${!r1k.isEnd ? ' ⚠️ TRUNCATED' : ''}`);
  }

  // 전체 서울 카페 수 추정 — 카카오맵 키워드 검색으로 확인
  const kwRes = await fetch(`https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent('카페')}&rect=126.764,37.428,127.183,37.701&size=1&page=1`, {
    headers: { Authorization: `KakaoAK ${KAKAO_KEY}` },
  });
  const kwData = await kwRes.json();
  console.log(`\n카카오맵 서울 영역 "카페" 키워드 검색 총 결과: ${kwData.meta.total_count}개`);
  console.log(`(pageable_count: ${kwData.meta.pageable_count} — API가 실제 반환 가능한 수)`);
}

main().catch(console.error);
