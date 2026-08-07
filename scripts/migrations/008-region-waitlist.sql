-- 008: 지역 확장 웨이팅리스트
--
-- 목적: 커버리지 밖(부산·대전 등)에서 유입된 방문자의 수요를 기록한다.
-- GA 기준 부산 125명 / 대전 48명이 데이터 없이 100% 이탈하고 있어,
-- (1) 버려지던 트래픽을 리스트로 전환하고
-- (2) 다음 확장 지역을 감이 아닌 데이터로 결정하기 위함.
--
-- 개인정보를 최소로 수집한다: 지역 키 + 선택적 연락처(카톡 채널 전환 여부)만.

create table if not exists public.region_waitlist (
  id uuid primary key default gen_random_uuid(),
  -- 정규화된 로마자 지역 키 (예: 'busan') — src/lib/coverage.ts 와 일치
  region text not null,
  -- 헤더에서 받은 원본 도시 값 (디버깅용)
  raw_city text,
  -- 카카오톡 채널 구독으로 이어졌는지
  subscribed_channel boolean not null default false,
  -- 유입 경로 파악용 (referrer 도메인만, 쿼리스트링 제외)
  referrer_host text,
  created_at timestamptz not null default now()
);

-- 지역별 수요 집계 쿼리가 주 용도
create index if not exists region_waitlist_region_idx
  on public.region_waitlist (region);

create index if not exists region_waitlist_created_at_idx
  on public.region_waitlist (created_at desc);

-- RLS: 클라이언트 직접 접근을 막고 서버(service_role)만 쓰게 한다.
alter table public.region_waitlist enable row level security;

-- 지역별 수요 집계 뷰 — 다음 확장 지역 결정에 사용
create or replace view public.region_demand as
select
  region,
  count(*) as requests,
  count(*) filter (where subscribed_channel) as channel_subscribers,
  max(created_at) as last_request_at
from public.region_waitlist
group by region
order by requests desc;
