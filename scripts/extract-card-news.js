#!/usr/bin/env node

/**
 * 인스타그램 카드뉴스 소재 자동 추출 스크립트
 *
 * 사용법:
 *   node scripts/extract-card-news.js                  # 전체 구 TOP 5
 *   node scripts/extract-card-news.js 강남구            # 특정 구만
 *   node scripts/extract-card-news.js --24h             # 24시간 카페 구별 분포
 *   node scripts/extract-card-news.js --weekend         # 주말 아침 카페
 *
 * 출력: docs/marketing/card-news-data/ 폴더에 마크다운 파일 생성
 */

import { config } from 'dotenv';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

config({ path: '.env.local' });

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, '..', 'docs', 'marketing', 'card-news-data');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const CHAIN_KEYWORDS = [
  '스타벅스', '투썸플레이스', '투썸', '이디야', '할리스', '탐앤탐스',
  '카페베네', '엔제리너스', '폴바셋', '메가커피', '메가MGC', '컴포즈',
  '빽다방', '더벤티', '바나프레소', '매머드', '커피에반하다', '커피베이',
  '공차', '쥬씨', '커피빈', '파스쿠찌', '드롭탑', '감성커피',
  '더리터', '빈스빈스', '라떼킹', '백억커피', '하삼동',
];

function isChain(name) {
  const upper = name.toUpperCase();
  return CHAIN_KEYWORDS.some((kw) => upper.includes(kw.toUpperCase()));
}

// ─── Supabase fetch helper ──────────────────────────────────────────────────

async function fetchAllEarlybird() {
  const PAGE_SIZE = 1000;
  const rows = [];
  let from = 0;

  while (true) {
    const url = `${SUPABASE_URL}/rest/v1/cafes_with_coords?is_earlybird=eq.true&select=id,name,address,road_address,phone,opening_time,closing_time,hours_by_day,latitude,longitude,place_url&order=opening_time.asc.nullslast&offset=${from}&limit=${PAGE_SIZE}`;
    const res = await fetch(url, {
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
    });
    const data = await res.json();
    rows.push(...data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return rows;
}

function extractGu(address) {
  const match = address?.match(/서울\S*\s+(\S+구)/);
  return match?.[1] ?? null;
}

function formatTime(t) {
  if (!t) return '정보 없음';
  return t.split(':').slice(0, 2).join(':');
}

function is24h(cafe) {
  if (cafe.opening_time === '00:00:00' && cafe.closing_time === '24:00:00') return true;
  if (cafe.opening_time === '00:00:00' && cafe.closing_time === '00:00:00') return true;
  // hours_by_day에 "00:00~24:00" 패턴
  const sample = Object.values(cafe.hours_by_day ?? {})[0];
  if (sample && /^00:00~24:00$/.test(sample)) return true;
  return false;
}

// ─── 시리즈 1: 구별 TOP 5 ──────────────────────────────────────────────────

function generateGuTop5(cafes, targetGu = null) {
  const guMap = new Map();

  for (const cafe of cafes) {
    const gu = extractGu(cafe.address);
    if (!gu) continue;
    if (targetGu && gu !== targetGu) continue;
    if (!guMap.has(gu)) guMap.set(gu, []);
    guMap.get(gu).push(cafe);
  }

  const results = [];

  for (const [gu, guCafes] of [...guMap.entries()].sort((a, b) => a[0].localeCompare(b[0], 'ko'))) {
    // 개인 카페 우선, 가장 이른 오픈 순 (24시간/자정 오픈 제외, 5시~8시만)
    const ranked = guCafes
      .filter((c) => {
        if (!c.opening_time || is24h(c)) return false;
        const [h] = c.opening_time.split(':').map(Number);
        return h >= 5 && h < 8; // 5시~8시 사이 오픈만
      })
      .sort((a, b) => {
        const chainA = isChain(a.name) ? 1 : 0;
        const chainB = isChain(b.name) ? 1 : 0;
        if (chainA !== chainB) return chainA - chainB;
        return (a.opening_time ?? '').localeCompare(b.opening_time ?? '');
      })
      .slice(0, 5);

    if (ranked.length === 0) continue;

    let md = `# ${gu} 아침 카페 TOP 5\n\n`;
    md += `> 총 ${guCafes.length}개 아침 카페 중 가장 일찍 여는 곳 (개인 카페 우선)\n\n`;

    ranked.forEach((cafe, i) => {
      const addr = cafe.road_address ?? cafe.address;
      const chain = isChain(cafe.name) ? ' (체인)' : '';
      md += `## ${i + 1}. ${cafe.name}${chain}\n`;
      md += `- **오픈**: ${formatTime(cafe.opening_time)}\n`;
      md += `- **주소**: ${addr}\n`;
      if (cafe.phone) md += `- **전화**: ${cafe.phone}\n`;
      md += `- **링크**: https://morning-cafe-phi.vercel.app/cafe/${cafe.id}\n`;
      md += '\n';
    });

    results.push({ gu, md, count: guCafes.length });
  }

  return results;
}

// ─── 시리즈 3: 주말 아침 카페 ───────────────────────────────────────────────

function generateWeekendCafes(cafes) {
  const weekendCafes = [];

  for (const cafe of cafes) {
    if (!cafe.hours_by_day || is24h(cafe)) continue;
    const sat = cafe.hours_by_day['토'];
    const sun = cafe.hours_by_day['일'];
    if (!sat && !sun) continue;
    // "00:00~24:00" 패턴 제외
    if (sat === '00:00~24:00' && sun === '00:00~24:00') continue;

    // 주말에 8시 이전 오픈하는 카페
    const satTime = sat?.match(/(\d{2}):(\d{2})/);
    const sunTime = sun?.match(/(\d{2}):(\d{2})/);
    const satMinutes = satTime ? parseInt(satTime[1]) * 60 + parseInt(satTime[2]) : 999;
    const sunMinutes = sunTime ? parseInt(sunTime[1]) * 60 + parseInt(sunTime[2]) : 999;
    const earliestWeekend = Math.min(satMinutes, sunMinutes);

    if (earliestWeekend >= 300 && earliestWeekend < 480) { // 5시~8시 이전
      weekendCafes.push({
        ...cafe,
        satHours: sat ?? '휴무',
        sunHours: sun ?? '휴무',
        earliestWeekend,
      });
    }
  }

  weekendCafes.sort((a, b) => a.earliestWeekend - b.earliestWeekend);

  let md = `# 주말 아침 카페 TOP 20\n\n`;
  md += `> 토/일요일 8시 이전에 여는 카페 (총 ${weekendCafes.length}곳 중 상위 20)\n\n`;

  weekendCafes.slice(0, 20).forEach((cafe, i) => {
    const gu = extractGu(cafe.address) ?? '';
    md += `## ${i + 1}. ${cafe.name} (${gu})\n`;
    md += `- **토요일**: ${cafe.satHours}\n`;
    md += `- **일요일**: ${cafe.sunHours}\n`;
    md += `- **주소**: ${cafe.road_address ?? cafe.address}\n`;
    md += `- **링크**: https://morning-cafe-phi.vercel.app/cafe/${cafe.id}\n\n`;
  });

  return md;
}

// ─── 시리즈 4: 24시간 카페 구별 분포 ────────────────────────────────────────

function generate24hDistribution(cafes) {
  const guCount = new Map();

  for (const cafe of cafes) {
    if (!is24h(cafe)) continue;
    const gu = extractGu(cafe.address);
    if (!gu) continue;
    guCount.set(gu, (guCount.get(gu) ?? 0) + 1);
  }

  const sorted = [...guCount.entries()].sort((a, b) => b[1] - a[1]);
  const total = sorted.reduce((sum, [, c]) => sum + c, 0);

  let md = `# 24시간 카페 구별 분포\n\n`;
  md += `> 서울 24시간 카페 총 ${total}곳\n\n`;
  md += `| 순위 | 구 | 24시간 카페 수 | 비율 |\n`;
  md += `|------|-----|-------------|------|\n`;

  sorted.forEach(([gu, count], i) => {
    const pct = ((count / total) * 100).toFixed(1);
    md += `| ${i + 1} | ${gu} | ${count}곳 | ${pct}% |\n`;
  });

  return md;
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const mode24h = args.includes('--24h');
  const modeWeekend = args.includes('--weekend');
  const targetGu = args.find((a) => !a.startsWith('--') && a.endsWith('구')) ?? null;

  console.log('Fetching earlybird cafes...');
  const cafes = await fetchAllEarlybird();
  console.log(`Found ${cafes.length} earlybird cafes`);

  mkdirSync(OUTPUT_DIR, { recursive: true });

  if (mode24h) {
    const md = generate24hDistribution(cafes);
    const path = join(OUTPUT_DIR, '24h-distribution.md');
    writeFileSync(path, md);
    console.log(`Written: ${path}`);
    return;
  }

  if (modeWeekend) {
    const md = generateWeekendCafes(cafes);
    const path = join(OUTPUT_DIR, 'weekend-morning.md');
    writeFileSync(path, md);
    console.log(`Written: ${path}`);
    return;
  }

  // Default: 구별 TOP 5
  const results = generateGuTop5(cafes, targetGu);

  if (targetGu) {
    const result = results[0];
    if (!result) {
      console.log(`No earlybird cafes found in ${targetGu}`);
      return;
    }
    const path = join(OUTPUT_DIR, `top5-${targetGu}.md`);
    writeFileSync(path, result.md);
    console.log(`Written: ${path} (${result.count} cafes in ${targetGu})`);
  } else {
    // 전체 구 요약 + 개별 파일
    let summary = `# 구별 아침 카페 TOP 5 요약\n\n`;
    summary += `| 구 | 아침 카페 수 | 1위 | 오픈 |\n`;
    summary += `|-----|-----------|-----|------|\n`;

    for (const { gu, md, count } of results) {
      const path = join(OUTPUT_DIR, `top5-${gu}.md`);
      writeFileSync(path, md);

      // 요약 테이블용: 첫 번째 카페
      const firstLine = md.match(/## 1\. (.+)/)?.[1] ?? '';
      const openTime = md.match(/\*\*오픈\*\*: (.+)/)?.[1] ?? '';
      summary += `| ${gu} | ${count} | ${firstLine} | ${openTime} |\n`;
    }

    const summaryPath = join(OUTPUT_DIR, 'summary.md');
    writeFileSync(summaryPath, summary);
    console.log(`Written ${results.length} gu files + summary to ${OUTPUT_DIR}/`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
