import { config } from 'dotenv';
config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function main() {
  // earlybird 카페들
  const res = await fetch(`${SUPABASE_URL}/rest/v1/cafes?is_earlybird=eq.true&select=name,opening_time,address&limit=30&order=opening_time.asc`, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
  });
  const data = await res.json();
  console.log(`Earlybird cafes in DB: ${data.length}+ (showing first 30)`);
  for (const c of data) {
    console.log(`  ${c.opening_time} | ${c.name} | ${c.address?.split(' ').slice(0, 3).join(' ')}`);
  }

  // 전체 카운트
  const countRes = await fetch(`${SUPABASE_URL}/rest/v1/cafes?select=id&limit=1`, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, Prefer: 'count=exact' },
  });
  console.log(`\nTotal cafes in DB: ${countRes.headers.get('content-range')}`);

  // earlybird 카운트
  const ebRes = await fetch(`${SUPABASE_URL}/rest/v1/cafes?is_earlybird=eq.true&select=id&limit=1`, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, Prefer: 'count=exact' },
  });
  console.log(`Earlybird cafes: ${ebRes.headers.get('content-range')}`);

  // opening_time이 null인 카페 카운트
  const nullRes = await fetch(`${SUPABASE_URL}/rest/v1/cafes?opening_time=is.null&select=id&limit=1`, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, Prefer: 'count=exact' },
  });
  console.log(`Cafes with NULL opening_time: ${nullRes.headers.get('content-range')}`);

  // 00:00 오픈 카페들 (24시간 의심)
  const midnightRes = await fetch(`${SUPABASE_URL}/rest/v1/cafes?opening_time=eq.00:00:00&select=name,opening_time,closing_time,hours_by_day&limit=10`, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
  });
  const midnightData = await midnightRes.json();
  console.log(`\n00:00 opening cafes: ${midnightData.length}`);
  for (const c of midnightData) {
    console.log(`  ${c.name} | open:${c.opening_time} close:${c.closing_time} | ${JSON.stringify(c.hours_by_day)?.slice(0, 80)}`);
  }
}

main().catch(console.error);
