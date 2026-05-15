#!/usr/bin/env node

/**
 * 서울 아침 카페 통계 리포트 생성 스크립트
 *
 * 사용법: node scripts/generate-stats.js
 * 출력: docs/seoul-morning-cafe-stats.md
 */

import { config } from 'dotenv';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

// ─── Chain keywords (from cafe-store.ts) ───────────────────────────────────
const CHAIN_KEYWORDS = [
  '스타벅스', 'STARBUCKS', '투썸플레이스', '투썸', '이디야', 'EDIYA',
  '할리스', 'HOLLYS', '탐앤탐스', '탐탐', '카페베네', '엔제리너스',
  '폴바셋', 'PAUL BASSETT',
  '메가커피', '메가MGC', '메가엠지씨', 'MEGA', '컴포즈', '컴포즈커피', 'COMPOSE',
  '빽다방', '백다방', 'PAIK', '더벤티', 'THE VENTI', '바나프레소',
  '매머드', '매머드커피', '매머드익스프레스', '커피에반하다', '커피베이', '달콤커피',
  '공차', 'GONGCHA', '쥬씨', '요거프레소',
  '셀렉토커피', '커피왕', '커피스미스', '커피나무',
  '에그카페', '에그카페24', '데이롱', '데이롱카페',
  '커피빈', 'COFFEE BEAN', '파스쿠찌', 'PASCUCCI', '드롭탑', 'DROPTOP',
  '카페봄봄', '만랩커피', '더착한커피', '감성커피', '커피명가', '전광수커피',
  '텐퍼센트', '10PERCENT', '10%커피', '우지커피', 'WOOJI',
  '커피인류', '로칼커피', '백억커피', '더리터', '빈스빈스', '라떼킹',
  '커피마마', '하삼동', '청자다방', '카페인중독', '하이오커피', '토프레소',
  '아마스빈', '디저트39', '커피니', '더카페', '가배도', '빈브라더스',
  '벌크커피', '커스텀커피', '에가엠지', '에가MGC', '커피나인', '카페051',
  '벤티프레소', '마린커피', '카페아이엔지', 'ING', '카페잇', '망고식스',
  '천씨씨커피', '1000CC', '카페만월경', '카페인24', '국민우유집',
  '모리커피', '스트렝스커피', '카페신호', '함께그린카페', '카페온니',
  '고품격커피공장', '투달러커피', '포트캔커피', '해머스미스커피',
  '펠어커피초코', '펠어 커피초코', '더치앤빈', '달콤N', '알리바바',
  '오슬로우커피', '위클리베이글', '힘이나는커피생활', '카페홈즈',
  '아덴블랑제리', '블루샥', '일리커피', '파스꾸찌',
  '미니말레커피뢰스터', '미니말레 커피뢰스터', '루트비커피', '날쌘카페',
  '요커', '스몰굿커피', '잼잼키즈룸', '조선커피', '트러스트커피', '백미당',
  '잠바주스', '키즈앤룸', '카페게이트', '사과당', '와요커피', '옥타커피',
  '카페늘봄', '오금동커피', '박스커피', '영커피', '나인블럭',
  '소디스에스프레소', '오페라빈', '요거트퍼플', '커피829', '더치즈샵',
  '코삼이커피', '더정', '우롱티프로젝트', '기기커피', '카페블라썸',
  '뉴욕쟁이디저트', '옐로우캔', '이공커피', '베러먼데이', '커피사피엔스',
  '바나타이거', '카페16온스', '카페일분', '카페프리헷', '나이스카페인클럽',
  '파란만잔', '브루다커피', '카페드림', '커피랑도서관', '팔공티', '매스커피',
  '쉬즈베이글커피', '발도스커피', '카페7그램', '본솔커피', '댄싱컵',
  '와플샵', '블루포트', '와드커피', '성북당', '커피볶는아침',
  '감탄커피앤베이커리', '감탄커피', '일리카페', '플라워베이커리',
  '테라커피', '투빅커피', '크레이저커피', '진심커피', '킁킁커피',
  '꿀잼키즈룸', '더베이크', '키즈카페파이용', '커피나라', '템포커피',
  '마이쥬스', '위카페', '프롬하츠커피', '도프커피', '커피루소',
  '스템커피', '로스터리 락온', '오슬랑커피', '봄꽃피는자리', '커피DZ',
  '소림사', '트립플러스', '남대문커피', '박스프레소', '빵아커피',
  '읍천리382', '희망카페', '비니커피', '디저트 문정', '디저트문정',
  '그라츠커피랩', '커피기업',
  '무인카페', '무인 카페', '무인24',
];

// 체인 브랜드 → 대표 이름 매핑 (통계용)
const CHAIN_BRAND_MAP = {
  '스타벅스': ['스타벅스', 'STARBUCKS'],
  '투썸플레이스': ['투썸플레이스', '투썸'],
  '이디야': ['이디야', 'EDIYA'],
  '메가커피': ['메가커피', '메가MGC', '메가엠지씨', 'MEGA'],
  '컴포즈커피': ['컴포즈', '컴포즈커피', 'COMPOSE'],
  '빽다방': ['빽다방', '백다방', 'PAIK'],
  '더벤티': ['더벤티', 'THE VENTI'],
  '바나프레소': ['바나프레소'],
  '할리스': ['할리스', 'HOLLYS'],
  '탐앤탐스': ['탐앤탐스', '탐탐'],
  '커피빈': ['커피빈', 'COFFEE BEAN'],
  '폴바셋': ['폴바셋', 'PAUL BASSETT'],
  '파스쿠찌': ['파스쿠찌', 'PASCUCCI', '파스꾸찌'],
  '매머드커피': ['매머드', '매머드커피', '매머드익스프레스'],
  '커피에반하다': ['커피에반하다'],
  '커피베이': ['커피베이'],
  '감성커피': ['감성커피'],
  '만랩커피': ['만랩커피'],
  '더착한커피': ['더착한커피'],
  '에그카페': ['에그카페', '에그카페24'],
  '셀렉토커피': ['셀렉토커피'],
  '카페베네': ['카페베네'],
  '엔제리너스': ['엔제리너스'],
  '달콤커피': ['달콤커피'],
  '드롭탑': ['드롭탑', 'DROPTOP'],
  '공차': ['공차', 'GONGCHA'],
  '빈브라더스': ['빈브라더스'],
  '더리터': ['더리터'],
  '백억커피': ['백억커피'],
  '카페인24': ['카페인24'],
  '텐퍼센트': ['텐퍼센트', '10PERCENT', '10%커피'],
};

function isChainCafe(name) {
  const lower = name.toLowerCase();
  return CHAIN_KEYWORDS.some((kw) => lower.includes(kw.toLowerCase()));
}

function getChainBrand(name) {
  const lower = name.toLowerCase();
  for (const [brand, keywords] of Object.entries(CHAIN_BRAND_MAP)) {
    if (keywords.some((kw) => lower.includes(kw.toLowerCase()))) {
      return brand;
    }
  }
  return '기타 체인';
}

function is24Hours(cafe) {
  if (cafe.opening_time === '00:00:00' && cafe.closing_time === '24:00:00') return true;
  if (cafe.opening_time === '00:00:00' && cafe.closing_time === '00:00:00') return true;
  const hbd = cafe.hours_by_day;
  if (hbd && typeof hbd === 'object') {
    const sample = Object.values(hbd)[0];
    if (sample && /^00:00~24:00$/.test(sample)) return true;
  }
  return false;
}

function extractGu(address) {
  const match = address?.match(/서울\S*\s+(\S+구)/);
  return match?.[1] ?? null;
}

function parseOpeningHour(openingTime) {
  if (!openingTime) return null;
  const parts = openingTime.split(':');
  return parseInt(parts[0], 10);
}

function parseOpeningMinutes(openingTime) {
  if (!openingTime) return null;
  const parts = openingTime.split(':');
  return parseInt(parts[0], 10) * 60 + parseInt(parts[1] ?? '0', 10);
}

function getTimeSlot(openingTime) {
  const minutes = parseOpeningMinutes(openingTime);
  if (minutes === null) return null;
  if (minutes <= 300) return '~5시';
  if (minutes <= 360) return '5시대';
  if (minutes <= 420) return '6시대';
  if (minutes <= 480) return '7시대';
  return '8시';
}

// 서울 구별 면적 (km²) — 서울시 통계 기준
const GU_AREA_KM2 = {
  '종로구': 23.91, '중구': 9.96, '용산구': 21.87, '성동구': 16.86,
  '광진구': 17.06, '동대문구': 14.22, '중랑구': 18.50, '성북구': 24.58,
  '강북구': 23.60, '도봉구': 20.70, '노원구': 35.44, '은평구': 29.71,
  '서대문구': 17.61, '마포구': 23.87, '양천구': 17.41, '강서구': 41.44,
  '구로구': 20.12, '금천구': 13.01, '영등포구': 24.55, '동작구': 16.35,
  '관악구': 29.57, '서초구': 47.00, '강남구': 39.50, '송파구': 33.88,
  '강동구': 24.59,
};

// 서울 구별 인구 (만 명, 2024 기준 추정)
const GU_POPULATION_10K = {
  '종로구': 14.8, '중구': 12.6, '용산구': 22.7, '성동구': 30.3,
  '광진구': 34.6, '동대문구': 34.5, '중랑구': 38.2, '성북구': 42.2,
  '강북구': 28.9, '도봉구': 31.3, '노원구': 49.3, '은평구': 46.0,
  '서대문구': 30.9, '마포구': 36.2, '양천구': 43.0, '강서구': 56.2,
  '구로구': 39.6, '금천구': 23.1, '영등포구': 37.4, '동작구': 38.3,
  '관악구': 48.3, '서초구': 41.6, '강남구': 52.5, '송파구': 65.5,
  '강동구': 45.1,
};

// ─── Supabase fetch (pagination) ───────────────────────────────────────────
async function fetchAllCafes() {
  const pageSize = 1000;
  let allCafes = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const url = `${SUPABASE_URL}/rest/v1/cafes?is_earlybird=eq.true&select=*&limit=${pageSize}&offset=${offset}&order=id.asc`;
    const res = await fetch(url, {
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
    });
    if (!res.ok) throw new Error(`Supabase fetch failed: ${res.status} ${res.statusText}`);
    const data = await res.json();
    allCafes = allCafes.concat(data);
    hasMore = data.length === pageSize;
    offset += pageSize;
    process.stdout.write(`\r  Fetched ${allCafes.length} cafes...`);
  }
  console.log(`\r  총 ${allCafes.length}개 얼리버드 카페 로드 완료`);
  return allCafes;
}

// ─── Text bar chart ────────────────────────────────────────────────────────
function bar(count, maxCount, maxWidth = 30) {
  const width = maxCount > 0 ? Math.round((count / maxCount) * maxWidth) : 0;
  return '█'.repeat(width) + '░'.repeat(maxWidth - width);
}

function pct(count, total) {
  return total > 0 ? ((count / total) * 100).toFixed(1) : '0.0';
}

// ─── Main ──────────────────────────────────────────────────────────────────
async function main() {
  console.log('🔍 서울 아침 카페 통계 리포트 생성 시작\n');

  // 1. Fetch data
  console.log('📥 Supabase에서 데이터 로딩...');
  const cafes = await fetchAllCafes();
  const today = new Date().toISOString().split('T')[0];

  // 2. Pre-compute
  const cafeAnalysis = cafes.map((c) => ({
    ...c,
    gu: extractGu(c.address),
    isChain: isChainCafe(c.name),
    chainBrand: isChainCafe(c.name) ? getChainBrand(c.name) : null,
    is24h: is24Hours(c),
    timeSlot: is24Hours(c) ? '24시간' : getTimeSlot(c.opening_time),
    openHour: parseOpeningHour(c.opening_time),
    openMinutes: parseOpeningMinutes(c.opening_time),
  }));

  const total = cafeAnalysis.length;

  // ──────────────────────────────────────────────────────────
  // Section 2: 오픈 시간대 분석
  // ──────────────────────────────────────────────────────────
  console.log('📊 시간대 분석 중...');
  const timeSlots = ['~5시', '5시대', '6시대', '7시대', '8시', '24시간'];
  const timeSlotCounts = {};
  for (const slot of timeSlots) timeSlotCounts[slot] = 0;
  let noTimeInfo = 0;
  for (const c of cafeAnalysis) {
    if (c.timeSlot && timeSlotCounts[c.timeSlot] !== undefined) {
      timeSlotCounts[c.timeSlot]++;
    } else {
      noTimeInfo++;
    }
  }
  const maxTimeCount = Math.max(...Object.values(timeSlotCounts));

  // ──────────────────────────────────────────────────────────
  // Section 3: 구별 분포
  // ──────────────────────────────────────────────────────────
  console.log('📊 구별 분포 분석 중...');
  const guStats = {};
  for (const c of cafeAnalysis) {
    if (!c.gu) continue;
    if (!guStats[c.gu]) guStats[c.gu] = { total: 0, chain: 0, indie: 0 };
    guStats[c.gu].total++;
    if (c.isChain) guStats[c.gu].chain++;
    else guStats[c.gu].indie++;
  }
  const guRanking = Object.entries(guStats)
    .sort((a, b) => b[1].total - a[1].total);
  const maxGuCount = guRanking.length > 0 ? guRanking[0][1].total : 0;

  // 밀집도 계산
  const guDensityArea = Object.entries(guStats)
    .filter(([gu]) => GU_AREA_KM2[gu])
    .map(([gu, s]) => ({ gu, count: s.total, density: (s.total / GU_AREA_KM2[gu]).toFixed(2) }))
    .sort((a, b) => b.density - a.density);

  const guDensityPop = Object.entries(guStats)
    .filter(([gu]) => GU_POPULATION_10K[gu])
    .map(([gu, s]) => ({ gu, count: s.total, density: (s.total / GU_POPULATION_10K[gu]).toFixed(2) }))
    .sort((a, b) => b.density - a.density);

  // ──────────────────────────────────────────────────────────
  // Section 4: 구 × 시간대 교차 분석
  // ──────────────────────────────────────────────────────────
  console.log('📊 구×시간대 교차 분석 중...');
  const guTimeMatrix = {};
  for (const c of cafeAnalysis) {
    if (!c.gu || !c.timeSlot) continue;
    if (!guTimeMatrix[c.gu]) {
      guTimeMatrix[c.gu] = {};
      for (const s of timeSlots) guTimeMatrix[c.gu][s] = 0;
    }
    guTimeMatrix[c.gu][c.timeSlot]++;
  }

  // 6시 이전(~5시 + 5시대) 비율
  const guEarlyRatio = Object.entries(guTimeMatrix)
    .map(([gu, slots]) => {
      const guTotal = guStats[gu]?.total ?? 0;
      const earlyCount = (slots['~5시'] ?? 0) + (slots['5시대'] ?? 0);
      return { gu, earlyCount, guTotal, ratio: guTotal > 0 ? earlyCount / guTotal : 0 };
    })
    .sort((a, b) => a.earlyCount - b.earlyCount);

  // 얼리버드 공백 지역
  const earlyDesert = guEarlyRatio
    .filter((g) => g.guTotal >= 5)
    .slice(0, 5);

  // ──────────────────────────────────────────────────────────
  // Section 5: 체인 vs 개인카페
  // ──────────────────────────────────────────────────────────
  console.log('📊 체인 vs 개인카페 분석 중...');
  const totalChain = cafeAnalysis.filter((c) => c.isChain).length;
  const totalIndie = total - totalChain;

  // 체인 브랜드별 매장 수
  const brandCounts = {};
  for (const c of cafeAnalysis) {
    if (c.isChain && c.chainBrand) {
      brandCounts[c.chainBrand] = (brandCounts[c.chainBrand] ?? 0) + 1;
    }
  }
  const brandRanking = Object.entries(brandCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20);

  // 시간대별 체인 vs 개인
  const timeChainIndie = {};
  for (const slot of timeSlots) timeChainIndie[slot] = { chain: 0, indie: 0 };
  for (const c of cafeAnalysis) {
    if (!c.timeSlot || !timeChainIndie[c.timeSlot]) continue;
    if (c.isChain) timeChainIndie[c.timeSlot].chain++;
    else timeChainIndie[c.timeSlot].indie++;
  }

  // 구별 체인 비율 랭킹
  const guChainRatio = Object.entries(guStats)
    .map(([gu, s]) => ({ gu, ...s, ratio: s.total > 0 ? s.chain / s.total : 0 }))
    .sort((a, b) => b.ratio - a.ratio);

  // ──────────────────────────────────────────────────────────
  // Section 6: 24시간 영업
  // ──────────────────────────────────────────────────────────
  console.log('📊 24시간 영업 분석 중...');
  const total24h = cafeAnalysis.filter((c) => c.is24h).length;
  const gu24h = {};
  for (const c of cafeAnalysis) {
    if (c.is24h && c.gu) {
      gu24h[c.gu] = (gu24h[c.gu] ?? 0) + 1;
    }
  }
  const gu24hRanking = Object.entries(gu24h).sort((a, b) => b[1] - a[1]);

  // ──────────────────────────────────────────────────────────
  // Section 7: 요일별 휴무 패턴
  // ──────────────────────────────────────────────────────────
  console.log('📊 요일별 휴무 분석 중...');
  const days = ['월', '화', '수', '목', '금', '토', '일'];
  const dayClosedCounts = {};
  for (const d of days) dayClosedCounts[d] = 0;
  let cafesWithDayInfo = 0;

  for (const c of cafeAnalysis) {
    if (!c.hours_by_day || typeof c.hours_by_day !== 'object') continue;
    // 24시간 카페는 휴무 분석에서 제외 (항상 영업)
    if (c.is24h) continue;
    cafesWithDayInfo++;
    for (const d of days) {
      const h = c.hours_by_day[d];
      // 휴무 판단: 해당 요일 키가 없거나 "휴무/정기/쉼" 텍스트 포함
      if (!h || /휴무|정기|쉼/.test(h)) {
        dayClosedCounts[d]++;
      }
    }
  }
  const maxDayClosed = Math.max(...Object.values(dayClosedCounts));

  // 주말 vs 평일 분석
  const weekdayTotal = ['월', '화', '수', '목', '금'].reduce((s, d) => s + dayClosedCounts[d], 0);
  const weekendTotal = ['토', '일'].reduce((s, d) => s + dayClosedCounts[d], 0);

  // ──────────────────────────────────────────────────────────
  // Section 8: 연락처/SNS 보유율
  // ──────────────────────────────────────────────────────────
  console.log('📊 연락처/SNS 분석 중...');
  const withPhone = cafeAnalysis.filter((c) => c.phone && c.phone.trim()).length;
  const withInsta = cafeAnalysis.filter((c) => c.instagram_url && c.instagram_url.trim()).length;
  const withPlaceUrl = cafeAnalysis.filter((c) => c.place_url && c.place_url.trim()).length;

  // ──────────────────────────────────────────────────────────
  // Generate markdown
  // ──────────────────────────────────────────────────────────
  console.log('\n📝 마크다운 리포트 생성 중...');

  let md = '';

  // Header
  md += `# 서울 얼리버드 카페 통계 리포트\n\n`;
  md += `> 데이터 기준일: ${today}  \n`;
  md += `> 얼리버드 정의: **오전 8시 이전 오픈** 카페  \n`;
  md += `> 생성: \`scripts/generate-stats.js\`\n\n`;
  md += `---\n\n`;

  // Section 1: 개요
  md += `## 1. 개요\n\n`;
  md += `| 항목 | 수치 |\n`;
  md += `|------|------|\n`;
  md += `| 총 얼리버드 카페 | **${total.toLocaleString()}개** |\n`;
  md += `| 체인 카페 | ${totalChain.toLocaleString()}개 (${pct(totalChain, total)}%) |\n`;
  md += `| 개인 카페 | ${totalIndie.toLocaleString()}개 (${pct(totalIndie, total)}%) |\n`;
  md += `| 24시간 영업 | ${total24h}개 (${pct(total24h, total)}%) |\n`;
  md += `| 분석 대상 구 | ${Object.keys(guStats).length}개 |\n`;
  md += `\n---\n\n`;

  // Section 2: 오픈 시간대 분석
  md += `## 2. 오픈 시간대 분석\n\n`;
  md += `\`\`\`\n`;
  for (const slot of timeSlots) {
    const cnt = timeSlotCounts[slot];
    md += `${slot.padEnd(6)} ${bar(cnt, maxTimeCount)} ${String(cnt).padStart(5)}개 (${pct(cnt, total).padStart(5)}%)\n`;
  }
  if (noTimeInfo > 0) {
    md += `정보없음 ${bar(noTimeInfo, maxTimeCount)} ${String(noTimeInfo).padStart(5)}개 (${pct(noTimeInfo, total).padStart(5)}%)\n`;
  }
  md += `\`\`\`\n\n`;

  // 인사이트
  const sortedTimeSlots = timeSlots
    .filter((s) => s !== '24시간')
    .sort((a, b) => (timeSlotCounts[b] ?? 0) - (timeSlotCounts[a] ?? 0));
  const mostCompetitive = sortedTimeSlots[0];
  const leastCompetitive = sortedTimeSlots.filter((s) => (timeSlotCounts[s] ?? 0) > 0).at(-1);

  md += `> **💡 사장님 인사이트**  \n`;
  md += `> - ${mostCompetitive} 오픈이 **${timeSlotCounts[mostCompetitive]}개**로 가장 경쟁 치열  \n`;
  if (leastCompetitive && leastCompetitive !== mostCompetitive) {
    md += `> - ${leastCompetitive} 오픈은 **${timeSlotCounts[leastCompetitive]}개**로 상대적 블루오션  \n`;
  }
  md += `> - 24시간 카페 ${total24h}개 별도 운영 중\n`;
  md += `\n---\n\n`;

  // Section 3: 구별 분포 & 밀집도
  md += `## 3. 구별 분포 & 밀집도\n\n`;
  md += `### 구별 카페 수 (TOP → BOTTOM)\n\n`;
  md += `\`\`\`\n`;
  for (const [gu, s] of guRanking) {
    md += `${gu.padEnd(5)} ${bar(s.total, maxGuCount, 25)} ${String(s.total).padStart(4)}개 (체인 ${String(s.chain).padStart(3)} / 개인 ${String(s.indie).padStart(3)})\n`;
  }
  md += `\`\`\`\n\n`;

  md += `### 면적 대비 밀집도 (카페/km²)\n\n`;
  md += `| 순위 | 구 | 카페 수 | 면적(km²) | 밀집도 |\n`;
  md += `|------|------|---------|-----------|--------|\n`;
  guDensityArea.slice(0, 10).forEach((g, i) => {
    md += `| ${i + 1} | ${g.gu} | ${g.count} | ${GU_AREA_KM2[g.gu]} | **${g.density}** |\n`;
  });
  md += `\n`;

  md += `### 인구 대비 밀집도 (카페/만명)\n\n`;
  md += `| 순위 | 구 | 카페 수 | 인구(만명) | 밀집도 |\n`;
  md += `|------|------|---------|-----------|--------|\n`;
  guDensityPop.slice(0, 10).forEach((g, i) => {
    md += `| ${i + 1} | ${g.gu} | ${g.count} | ${GU_POPULATION_10K[g.gu]} | **${g.density}** |\n`;
  });
  md += `\n`;

  // 인사이트
  const topGu = guRanking[0];
  const bottomGu = guRanking.at(-1);
  const topDensity = guDensityArea[0];
  const bottomDensity = guDensityArea.at(-1);
  md += `> **💡 사장님 인사이트**  \n`;
  if (topGu) md += `> - ${topGu[0]}이(가) **${topGu[1].total}개**로 가장 많은 얼리버드 카페 보유  \n`;
  if (topDensity) md += `> - ${topDensity.gu}은(는) 면적 대비 밀집도 **${topDensity.density}개/km²**로 경쟁 과열  \n`;
  if (bottomDensity) md += `> - ${bottomDensity.gu}은(는) 밀집도 **${bottomDensity.density}개/km²**로 수요 대비 공급 부족 가능\n`;
  md += `\n---\n\n`;

  // Section 4: 구 × 시간대 교차 분석
  md += `## 4. 구 × 시간대 교차 분석\n\n`;
  md += `### 구별 시간대 분포\n\n`;
  md += `| 구 | ~5시 | 5시대 | 6시대 | 7시대 | 8시 | 24시간 |\n`;
  md += `|----|------|-------|-------|-------|-----|--------|\n`;
  for (const [gu] of guRanking) {
    const slots = guTimeMatrix[gu] ?? {};
    md += `| ${gu} | ${slots['~5시'] ?? 0} | ${slots['5시대'] ?? 0} | ${slots['6시대'] ?? 0} | ${slots['7시대'] ?? 0} | ${slots['8시'] ?? 0} | ${slots['24시간'] ?? 0} |\n`;
  }
  md += `\n`;

  md += `### 얼리버드 공백 지역 (6시 이전 오픈 카페가 적은 구 TOP 5)\n\n`;
  md += `| 순위 | 구 | 6시 이전 오픈 | 전체 | 비율 |\n`;
  md += `|------|------|-------------|------|------|\n`;
  earlyDesert.forEach((g, i) => {
    md += `| ${i + 1} | ${g.gu} | ${g.earlyCount}개 | ${g.guTotal}개 | ${(g.ratio * 100).toFixed(1)}% |\n`;
  });
  md += `\n`;

  // 인사이트
  const biggestDesert = earlyDesert[0];
  md += `> **💡 사장님 인사이트**  \n`;
  if (biggestDesert) {
    md += `> - ${biggestDesert.gu}에 6시 이전 오픈 카페가 **${biggestDesert.earlyCount}곳** → 새벽 창업 기회  \n`;
  }
  const gusWithZeroEarly = Object.entries(guTimeMatrix)
    .filter(([, slots]) => (slots['~5시'] ?? 0) + (slots['5시대'] ?? 0) === 0)
    .map(([gu]) => gu);
  if (gusWithZeroEarly.length > 0) {
    md += `> - 6시 이전 카페가 **0곳**인 구: ${gusWithZeroEarly.join(', ')}\n`;
  }
  md += `\n---\n\n`;

  // Section 5: 체인 vs 개인카페
  md += `## 5. 체인 vs 개인카페\n\n`;
  md += `| 구분 | 수 | 비율 |\n`;
  md += `|------|-----|------|\n`;
  md += `| 체인 카페 | ${totalChain.toLocaleString()}개 | ${pct(totalChain, total)}% |\n`;
  md += `| 개인 카페 | ${totalIndie.toLocaleString()}개 | ${pct(totalIndie, total)}% |\n`;
  md += `\n`;

  md += `### 체인 브랜드 매장 수 TOP 20\n\n`;
  md += `\`\`\`\n`;
  const maxBrandCount = brandRanking.length > 0 ? brandRanking[0][1] : 0;
  for (const [brand, cnt] of brandRanking) {
    md += `${brand.padEnd(10)} ${bar(cnt, maxBrandCount, 20)} ${String(cnt).padStart(4)}개\n`;
  }
  md += `\`\`\`\n\n`;

  md += `### 시간대별 체인 vs 개인\n\n`;
  md += `| 시간대 | 체인 | 개인 | 체인 비율 |\n`;
  md += `|--------|------|------|----------|\n`;
  for (const slot of timeSlots) {
    const ci = timeChainIndie[slot];
    const slotTotal = ci.chain + ci.indie;
    md += `| ${slot} | ${ci.chain} | ${ci.indie} | ${pct(ci.chain, slotTotal)}% |\n`;
  }
  md += `\n`;

  md += `### 구별 체인 비율 랭킹\n\n`;
  md += `| 순위 | 구 | 체인 | 개인 | 전체 | 체인비율 |\n`;
  md += `|------|------|------|------|------|----------|\n`;
  guChainRatio.forEach((g, i) => {
    md += `| ${i + 1} | ${g.gu} | ${g.chain} | ${g.indie} | ${g.total} | ${(g.ratio * 100).toFixed(1)}% |\n`;
  });
  md += `\n`;

  // 인사이트
  const earlySlots = ['~5시', '5시대'];
  const earlyChain = earlySlots.reduce((s, slot) => s + (timeChainIndie[slot]?.chain ?? 0), 0);
  const earlyIndie = earlySlots.reduce((s, slot) => s + (timeChainIndie[slot]?.indie ?? 0), 0);
  const lateSlots = ['7시대', '8시'];
  const lateChain = lateSlots.reduce((s, slot) => s + (timeChainIndie[slot]?.chain ?? 0), 0);
  const lateIndie = lateSlots.reduce((s, slot) => s + (timeChainIndie[slot]?.indie ?? 0), 0);

  md += `> **💡 사장님 인사이트**  \n`;
  md += `> - 전체 체인 비율 ${pct(totalChain, total)}%, 개인카페가 ${totalIndie > totalChain ? '다수' : '소수'}  \n`;
  if (earlyChain + earlyIndie > 0) {
    md += `> - 새벽(~6시) 시간대: 체인 ${earlyChain}개 vs 개인 ${earlyIndie}개 — 개인카페가 ${earlyIndie > earlyChain ? '강세' : '열세'}  \n`;
  }
  if (lateChain + lateIndie > 0) {
    md += `> - 7~8시 시간대: 체인 ${lateChain}개 vs 개인 ${lateIndie}개 — 체인이 ${lateChain > lateIndie ? '강세' : '열세'}\n`;
  }
  md += `\n---\n\n`;

  // Section 6: 24시간 영업
  md += `## 6. 24시간 영업 카페\n\n`;
  md += `| 항목 | 수치 |\n`;
  md += `|------|------|\n`;
  md += `| 24시간 영업 카페 | **${total24h}개** |\n`;
  md += `| 전체 대비 비율 | ${pct(total24h, total)}% |\n`;
  md += `\n`;

  if (gu24hRanking.length > 0) {
    md += `### 구별 24시간 카페 분포\n\n`;
    md += `\`\`\`\n`;
    const max24h = gu24hRanking[0][1];
    for (const [gu, cnt] of gu24hRanking) {
      md += `${gu.padEnd(5)} ${bar(cnt, max24h, 20)} ${String(cnt).padStart(3)}개\n`;
    }
    md += `\`\`\`\n\n`;

    const top24hGu = gu24hRanking.slice(0, 3).map(([gu]) => gu).join(', ');
    md += `> **💡 사장님 인사이트**  \n`;
    md += `> - 24시간 카페는 **${top24hGu}**에 집중  \n`;
    md += `> - 전체 ${total}개 중 ${total24h}개(${pct(total24h, total)}%)만 24시간 운영\n`;
  }
  md += `\n---\n\n`;

  // Section 7: 요일별 휴무 패턴
  md += `## 7. 요일별 휴무 패턴\n\n`;
  md += `> 요일별 영업시간 정보가 있는 카페 ${cafesWithDayInfo.toLocaleString()}개 기준\n\n`;
  md += `\`\`\`\n`;
  for (const d of days) {
    const cnt = dayClosedCounts[d];
    md += `${d}요일 ${bar(cnt, maxDayClosed, 25)} ${String(cnt).padStart(4)}개 (${pct(cnt, cafesWithDayInfo).padStart(5)}%)\n`;
  }
  md += `\`\`\`\n\n`;

  const mostClosedDay = days.sort((a, b) => dayClosedCounts[b] - dayClosedCounts[a])[0];
  const leastClosedDay = days.sort((a, b) => dayClosedCounts[a] - dayClosedCounts[b])[0];

  md += `| 구분 | 평균 휴무 카페 수 |\n`;
  md += `|------|------------------|\n`;
  md += `| 평일(월~금) 평균 | ${(weekdayTotal / 5).toFixed(0)}개 |\n`;
  md += `| 주말(토~일) 평균 | ${(weekendTotal / 2).toFixed(0)}개 |\n`;
  md += `\n`;

  md += `> **💡 사장님 인사이트**  \n`;
  md += `> - **${mostClosedDay}요일** 휴무가 가장 많음 (${dayClosedCounts[mostClosedDay]}개) → ${mostClosedDay}요일 영업이 차별화 포인트  \n`;
  md += `> - **${leastClosedDay}요일** 휴무가 가장 적음 (${dayClosedCounts[leastClosedDay]}개)  \n`;
  md += `> - 주말 평균 휴무 ${(weekendTotal / 2).toFixed(0)}개 vs 평일 평균 ${(weekdayTotal / 5).toFixed(0)}개\n`;
  md += `\n---\n\n`;

  // Section 8: 연락처/SNS 보유율
  md += `## 8. 연락처 & SNS 보유율\n\n`;
  md += `| 항목 | 보유 수 | 비율 |\n`;
  md += `|------|---------|------|\n`;
  md += `| 전화번호 | ${withPhone.toLocaleString()}개 | ${pct(withPhone, total)}% |\n`;
  md += `| 인스타그램 | ${withInsta.toLocaleString()}개 | ${pct(withInsta, total)}% |\n`;
  md += `| 카카오맵 URL | ${withPlaceUrl.toLocaleString()}개 | ${pct(withPlaceUrl, total)}% |\n`;
  md += `\n`;

  md += `> **💡 사장님 인사이트**  \n`;
  if (withInsta > 0) {
    md += `> - 인스타 운영 카페가 **${pct(withInsta, total)}%** — ${withInsta < total * 0.5 ? '아직 SNS 미활용 카페가 많음' : 'SNS 활용이 일반적'}  \n`;
  } else {
    md += `> - 인스타그램 데이터 미수집 — 향후 SNS 보유율 분석 필요  \n`;
  }
  md += `> - 전화번호 미등록 카페 **${(total - withPhone).toLocaleString()}개** (${pct(total - withPhone, total)}%) — 고객 접근성 개선 여지\n`;
  md += `\n---\n\n`;

  // Footer
  md += `## 부록: 데이터 검증\n\n`;
  md += `| 검증 항목 | 결과 |\n`;
  md += `|-----------|------|\n`;
  const timeSlotSum = Object.values(timeSlotCounts).reduce((s, c) => s + c, 0) + noTimeInfo;
  md += `| 시간대별 합계 = 전체 | ${timeSlotSum} ${timeSlotSum === total ? '✅' : '❌ (' + total + ')'} |\n`;
  const guSum = Object.values(guStats).reduce((s, g) => s + g.total, 0);
  const noGuCount = total - guSum;
  md += `| 구별 합계 + 구 없음 = 전체 | ${guSum} + ${noGuCount} = ${guSum + noGuCount} ${guSum + noGuCount === total ? '✅' : '❌'} |\n`;
  md += `| 체인 + 개인 = 전체 | ${totalChain} + ${totalIndie} = ${totalChain + totalIndie} ${totalChain + totalIndie === total ? '✅' : '❌'} |\n`;
  md += `\n`;
  md += `---\n\n`;
  md += `*이 리포트는 모닝커피(morning-cafe) 프로젝트의 Supabase DB 데이터를 기반으로 자동 생성되었습니다.*\n`;

  // ──────────────────────────────────────────────────────────
  // Write file
  // ──────────────────────────────────────────────────────────
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const outDir = join(__dirname, '..', 'docs');
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, 'seoul-morning-cafe-stats.md');
  writeFileSync(outPath, md, 'utf-8');

  console.log(`\n✅ 리포트 생성 완료: ${outPath}`);
  console.log(`   총 ${md.split('\n').length} 라인`);
}

main().catch((err) => {
  console.error('❌ 에러 발생:', err);
  process.exit(1);
});
