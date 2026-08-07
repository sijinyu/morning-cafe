/**
 * 가이드 필터 스모크 체크 — 실제 DB 데이터로 각 가이드의 카페 수를 확인한다.
 * 실행: npx tsx scripts/verify-guides.ts
 *
 * 잡는 회귀: 요일 키 불일치(주말 가이드 0곳 버그), 24시간 카페 혼입,
 * 강남구 최상단 고정 깨짐.
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';
import { GUIDE_SLUGS, buildGuideData } from '../src/lib/guides';
import { is24Hours } from '../src/lib/cafe-utils';
import type { Cafe } from '../src/lib/types/cafe';

function assert(cond: boolean, msg: string): void {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exitCode = 1;
  }
}

async function main(): Promise<void> {
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  const all: Cafe[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await client
      .from('cafes')
      .select('*')
      .eq('is_earlybird', true)
      .range(from, from + 999);
    if (error) throw error;
    all.push(...(data as Cafe[]));
    if (!data || data.length < 1000) break;
  }
  console.log(`earlybird 전체: ${all.length}곳`);

  for (const slug of GUIDE_SLUGS) {
    const d = buildGuideData(slug, all);
    console.log(
      `${slug.padEnd(16)} ${String(d.stats.totalCount).padStart(5)}곳 / ${d.stats.districtCount}지역 / 최상단: ${d.grouped[0]?.gu ?? '-'}`,
    );
    if (slug !== 'new-cafes') {
      assert(d.stats.totalCount > 0, `${slug} 가이드가 0곳 (요일 키/필터 회귀 의심)`);
    }
    // 시간 기반 가이드만 24시간 카페를 제외한다 (new-cafes는 신규면 24h여도 정상)
    const timeBased = ['before-6am', 'open-by-7am', 'weekend-morning', 'sunday-morning'];
    if (timeBased.includes(slug)) {
      assert(!d.cafes.some((c) => is24Hours(c)), `${slug}에 24시간 카페 혼입`);
    }
    if (d.grouped.some((g) => g.gu === '강남구')) {
      assert(d.grouped[0]?.gu === '강남구', `${slug} 최상단이 강남구가 아님 (${d.grouped[0]?.gu})`);
    }
  }

  console.log(process.exitCode ? 'CHECK FAILED' : 'CHECK OK');
}

main();
