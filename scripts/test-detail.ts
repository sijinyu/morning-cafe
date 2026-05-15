import { config } from 'dotenv';
config({ path: '.env.local' });

const KAKAO_KEY = process.env.KAKAO_REST_API_KEY!;

async function main() {
  // 1) 검색으로 place_id 확인
  const searchRes = await fetch(`https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent('스타벅스 강남역점')}&size=1`, {
    headers: { Authorization: `KakaoAK ${KAKAO_KEY}` },
  });
  const searchData = await searchRes.json();
  const place = searchData.documents?.[0];
  console.log('Found:', place?.place_name, 'id:', place?.id);

  // 2) 상세 조회
  const detailRes = await fetch(`https://place-api.map.kakao.com/places/panel3/${place.id}`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      'Referer': 'https://place.map.kakao.com/',
      'pf': 'PC',
    },
  });
  const detail = await detailRes.json();
  console.log('Status:', detailRes.status);
  console.log('Has open_hours:', !!detail?.open_hours);
  console.log('Has week_from_today:', !!detail?.open_hours?.week_from_today);

  const wp = detail?.open_hours?.week_from_today?.week_periods;
  console.log('week_periods count:', wp?.length ?? 0);

  if (wp?.[0]?.days) {
    for (const day of wp[0].days.slice(0, 3)) {
      console.log(`  ${day.day_of_the_week_desc}: ${day.on_days?.start_end_time_desc ?? 'no data'}`);
    }
  }

  // 3) 내가 아는 얼리버드 카페 테스트 — "커피리브레" 같은 유명한 곳
  const search2 = await fetch(`https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent('커피리브레 강남')}&size=1`, {
    headers: { Authorization: `KakaoAK ${KAKAO_KEY}` },
  });
  const data2 = await search2.json();
  const p2 = data2.documents?.[0];
  if (p2) {
    console.log('\n--- Test 2:', p2.place_name, 'id:', p2.id);
    const d2 = await fetch(`https://place-api.map.kakao.com/places/panel3/${p2.id}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Referer': 'https://place.map.kakao.com/',
        'pf': 'PC',
      },
    });
    const detail2 = await d2.json();
    const wp2 = detail2?.open_hours?.week_from_today?.week_periods;
    console.log('Has hours:', !!wp2?.length);
    if (wp2?.[0]?.days) {
      for (const day of wp2[0].days.slice(0, 3)) {
        console.log(`  ${day.day_of_the_week_desc}: ${day.on_days?.start_end_time_desc ?? 'no data'}`);
      }
    }
    // 인스타그램
    console.log('Homepage:', detail2?.summary?.homepage ?? 'none');
  }

  // 4) 전체 응답 키 구조 확인
  console.log('\n--- Detail top-level keys:', Object.keys(detail));
}

main().catch(console.error);
