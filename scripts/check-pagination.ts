import { config } from 'dotenv';
config({ path: '.env.local' });

const KAKAO_KEY = process.env.KAKAO_REST_API_KEY!;

async function main() {
  // 강남역 반경 500m — 작은 반경으로 페이지네이션 확인
  const params = new URLSearchParams({
    category_group_code: 'CE7',
    x: '127.0276', y: '37.4980',
    radius: '500', page: '1', size: '15', sort: 'distance',
  });

  const res = await fetch(`https://dapi.kakao.com/v2/local/search/category.json?${params}`, {
    headers: { Authorization: `KakaoAK ${KAKAO_KEY}` },
  });
  const data = await res.json();
  console.log('Page 1 meta:', JSON.stringify(data.meta));
  console.log('Page 1 docs:', data.documents.length);

  // page 2
  params.set('page', '2');
  const res2 = await fetch(`https://dapi.kakao.com/v2/local/search/category.json?${params}`, {
    headers: { Authorization: `KakaoAK ${KAKAO_KEY}` },
  });
  const data2 = await res2.json();
  console.log('Page 2 meta:', JSON.stringify(data2.meta));
  console.log('Page 2 docs:', data2.documents.length);

  // page 3
  params.set('page', '3');
  const res3 = await fetch(`https://dapi.kakao.com/v2/local/search/category.json?${params}`, {
    headers: { Authorization: `KakaoAK ${KAKAO_KEY}` },
  });
  const data3 = await res3.json();
  console.log('Page 3 meta:', JSON.stringify(data3.meta));
  console.log('Page 3 docs:', data3.documents.length);

  // 반경 200m — 더 작게
  console.log('\n--- 반경 200m ---');
  params.set('radius', '200');
  params.set('page', '1');
  const res4 = await fetch(`https://dapi.kakao.com/v2/local/search/category.json?${params}`, {
    headers: { Authorization: `KakaoAK ${KAKAO_KEY}` },
  });
  const data4 = await res4.json();
  console.log('200m Page 1:', JSON.stringify(data4.meta));
  console.log('200m docs:', data4.documents.length);
}

main().catch(console.error);
