/**
 * Mark Stale Cafes
 *
 * 폐업 감지: last_crawled_at이 15일 이상 오래된 earlybird 카페를
 * is_earlybird = false로 마킹. 재크롤링 시 다시 발견되면 seed-cafes.ts의
 * upsert가 is_earlybird를 재계산하여 자동 복원.
 *
 * Usage: npx tsx scripts/mark-stale-cafes.ts
 */

import { config } from 'dotenv';
import { appendFileSync } from 'fs';

if (!process.env.CI) {
  config({ path: '.env.local' });
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing env vars. Need NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const STALE_DAYS = 15;

async function main() {
  console.log('=== Mark Stale Cafes ===\n');

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - STALE_DAYS);
  const cutoffISO = cutoffDate.toISOString();

  console.log(`Cutoff: ${cutoffISO} (${STALE_DAYS} days ago)`);

  // 1. 오래된 earlybird 카페 수 조회
  const countRes = await fetch(
    `${SUPABASE_URL}/rest/v1/cafes?select=id&is_earlybird=eq.true&last_crawled_at=lt.${cutoffISO}`,
    {
      method: 'HEAD',
      headers: {
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'Prefer': 'count=exact',
      },
    },
  );

  const totalStale = parseInt(countRes.headers.get('content-range')?.split('/')[1] ?? '0', 10);
  console.log(`Stale earlybird cafes (>${STALE_DAYS} days): ${totalStale}\n`);

  if (totalStale === 0) {
    console.log('No stale cafes to mark. Done.');
    writeSummary(0);
    return;
  }

  // 2. is_earlybird = false로 업데이트
  const updateRes = await fetch(
    `${SUPABASE_URL}/rest/v1/cafes?is_earlybird=eq.true&last_crawled_at=lt.${cutoffISO}`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'Prefer': 'count=exact',
      },
      body: JSON.stringify({ is_earlybird: false }),
    },
  );

  if (!updateRes.ok) {
    const err = await updateRes.text();
    console.error(`Failed to mark stale cafes: ${err}`);
    process.exit(1);
  }

  const updatedCount = parseInt(updateRes.headers.get('content-range')?.split('/')[1] ?? '0', 10);
  console.log(`Marked ${updatedCount} cafes as non-earlybird (stale).`);
  console.log('These will be restored automatically if re-discovered in next crawl.\n');

  writeSummary(updatedCount);
}

function writeSummary(markedCount: number): void {
  if (process.env.GITHUB_STEP_SUMMARY) {
    const summary = [
      '## 🗑️ Stale Cafe Results',
      '',
      `| Metric | Value |`,
      `|--------|-------|`,
      `| Stale threshold | ${STALE_DAYS} days |`,
      `| Cafes marked non-earlybird | ${markedCount} |`,
      '',
    ].join('\n');
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
  }
}

main().catch((err) => {
  console.error('Mark stale failed:', err);
  process.exit(1);
});
