# PRD: 서울 얼리버드 카페 파인더

## Problem Statement

SMCC(서울 모닝커피클럽)는 아침 7:30~8:00에 카페에서 모임을 하는데, 이 시간대에 오픈하는 카페를 찾으려면 카카오맵/네이버에서 하나하나 수작업으로 검색해야 한다. 서울 전역에서 아침 6~8시에 여는 카페를 한눈에 볼 수 있는 서비스가 없다.

## Solution

서울 지역 카페의 영업시간을 수집하여 **아침 일찍 여는 카페만 지도 위에 표시**하는 PWA 웹앱. 카카오 로컬 API로 카페 목록을 수집하고, 카카오맵 상세페이지(place-api.map.kakao.com)에서 영업시간을 파싱하여 DB에 저장. 하루 1회 자동 갱신.

## User Stories

### 비로그인 사용자
- [ ] 지도에서 아침 일찍 여는 카페를 한눈에 볼 수 있다
- [ ] 시간대 필터(6시 이전 / 6~7시 / 7~8시)로 원하는 오픈 시간대를 선택할 수 있다
- [ ] 카페 마커를 클릭하면 간략 정보(이름, 영업시간, 주소, 전화번호, 인스타그램)를 볼 수 있다
- [ ] 상세 정보 버튼을 누르면 카카오맵 상세 페이지로 이동한다
- [ ] "내 주변" 버튼으로 현재 위치 기반 반경 검색을 할 수 있다
- [ ] 구/동 단위로 지역을 선택해서 해당 지역의 카페만 볼 수 있다
- [ ] 검색창에 카페명이나 지역명을 입력해서 검색할 수 있다

### 로그인 사용자 (카카오 소셜 로그인)
- [ ] 자주 가는 카페를 즐겨찾기에 저장할 수 있다
- [ ] 즐겨찾기 목록을 한 페이지에서 관리할 수 있다
- [ ] 카페의 영업시간이 틀린 경우 제보/수정을 요청할 수 있다
- [ ] 새로운 얼리버드 카페를 제보할 수 있다
- [ ] 카페에 한줄평을 남길 수 있다 (예: "아침에 조용함", "콘센트 많음", "주차 가능")
- [ ] 다른 사용자의 한줄평을 볼 수 있다

### 시스템
- [ ] 하루 1회(새벽 3시) 서울 전체 카페 영업시간을 자동 갱신한다
- [ ] 신규 카페가 감지되면 자동으로 영업시간을 수집한다
- [ ] 사용자 제보가 들어오면 관리자가 검토 후 반영할 수 있다
- [ ] 새 얼리버드 카페가 등록되면 PWA 푸시 알림을 보낼 수 있다

## Implementation Decisions

### 데이터 수집 전략 (하이브리드)

```
[1단계: 카페 목록 수집]
카카오 로컬 API (공식)
  - 카테고리 검색: CE7 (카페)
  - 서울 25개 구를 격자 분할하여 전체 커버
  - 수집: place_id, 이름, 주소, 좌표, 전화번호, place_url
  - 일 100,000건 무료

        ↓

[2단계: 영업시간 수집]
카카오맵 내부 API 파싱 (비공식)
  - GET https://place-api.map.kakao.com/places/panel3/{place_id}
  - Headers: User-Agent, Referer, pf
  - 수집: open_hours (요일별 영업시간), 인스타그램 링크
  - 인증 불필요, rate limiting 주의

        ↓

[3단계: 필터링 & 저장]
  - 오픈 시간이 08:00 이전인 카페만 DB에 저장
  - PostGIS로 좌표 저장 (반경 검색 지원)
```

### 인스타그램 연동
- 카카오맵 상세 API 응답의 `summary.homepage` 필드에 인스타그램 URL이 포함된 경우 → 정확 매칭
- 없는 경우 → `instagram.com/explore/tags/{카페명+동네명}` 검색 링크 제공
- 사용자 제보로 정확 계정 보완

### 기술 스택

| 레이어 | 기술 | 선정 이유 |
|--------|------|----------|
| 프레임워크 | **Next.js 14+ (App Router)** | SSR + 클라이언트 하이브리드, 기존 경험 |
| UI | **shadcn/ui + Tailwind CSS** | 토스 스타일 미니멀 UX 구현 용이 |
| 지도 | **react-kakao-maps-sdk** | 카카오맵 JS SDK React 래퍼, 클러스터링 내장 |
| DB | **Supabase (PostgreSQL + PostGIS)** | 무료 tier, 위치 기반 쿼리, Auth, Edge Functions |
| 인증 | **Supabase Auth (카카오 소셜)** | 카카오 로그인 공식 지원 |
| 크롤링 | **Supabase Edge Functions + pg_cron** | 큐 기반 배치 처리, 서버리스 |
| 상태관리 | **Zustand** | 경량, 보일러플레이트 최소 |
| PWA | **Serwist** | Next.js PWA 지원, 오프라인 캐싱 |
| 배포 | **Vercel** | Next.js 최적화 배포 |

### 크롤링 아키텍처 (큐 기반)

Edge Function의 CPU 2초 / Wall Clock 150초 제한 때문에 큐 기반 배치 처리:

```
[pg_cron: 매일 03:00]
  → Edge Function "seed-crawl-queue"
    → 카카오 API로 서울 카페 목록 수집
    → crawl_queue 테이블에 place_id 삽입

[pg_cron: 매 30초]
  → Edge Function "process-crawl-queue"
    → crawl_queue에서 5건 dequeue
    → place-api.map.kakao.com/places/panel3/{id} 호출
    → 영업시간 파싱 → cafes 테이블 upsert
    → 처리 완료 표시

예상 소요: ~10,000 카페 × (1/5건) = 2,000 invocations
30초 간격 → ~16.7시간 (넉넉히 완료)
```

### DB 스키마 (핵심)

```sql
-- 카페 테이블
cafes (
  id              UUID PRIMARY KEY,
  kakao_place_id  TEXT UNIQUE NOT NULL,
  name            TEXT NOT NULL,
  address         TEXT NOT NULL,
  road_address    TEXT,
  phone           TEXT,
  location        GEOGRAPHY(POINT) NOT NULL,  -- PostGIS
  place_url       TEXT,
  instagram_url   TEXT,
  category        TEXT,
  opening_time    TIME,          -- 오픈 시간 (예: 06:30)
  closing_time    TIME,          -- 마감 시간
  hours_by_day    JSONB,         -- 요일별 영업시간
  is_earlybird    BOOLEAN,       -- 08:00 이전 오픈 여부
  last_crawled_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
)

-- 즐겨찾기
favorites (
  id        UUID PRIMARY KEY,
  user_id   UUID REFERENCES auth.users,
  cafe_id   UUID REFERENCES cafes,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, cafe_id)
)

-- 한줄평
reviews (
  id         UUID PRIMARY KEY,
  user_id    UUID REFERENCES auth.users,
  cafe_id    UUID REFERENCES cafes,
  content    TEXT NOT NULL,       -- 최대 100자
  tags       TEXT[],              -- ["조용함", "콘센트많음", "주차가능"]
  created_at TIMESTAMPTZ DEFAULT NOW()
)

-- 제보
reports (
  id            UUID PRIMARY KEY,
  user_id       UUID REFERENCES auth.users,
  cafe_id       UUID REFERENCES cafes NULL,  -- 신규 카페 제보 시 null
  report_type   TEXT NOT NULL,     -- 'hours_correction', 'new_cafe', 'closed'
  content       TEXT NOT NULL,
  status        TEXT DEFAULT 'pending',  -- pending, approved, rejected
  created_at    TIMESTAMPTZ DEFAULT NOW()
)

-- 크롤링 큐
crawl_queue (
  id              BIGSERIAL PRIMARY KEY,
  kakao_place_id  TEXT NOT NULL,
  status          TEXT DEFAULT 'pending',  -- pending, processing, done, failed
  attempts        INT DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  processed_at    TIMESTAMPTZ
)
```

### UX 디자인 방향 (토스 스타일)

- **한 화면에 하나의 행동**: 지도가 메인, 필터/검색은 바텀시트
- **큰 타이포 + 넉넉한 여백**: 카페 정보 카드에 충분한 공간
- **바텀시트 패턴**: 카페 클릭 → 하단에서 올라오는 카드
- **부드러운 애니메이션**: framer-motion 또는 CSS transition
- **모바일 퍼스트**: 375px 기준 설계, 데스크탑은 확장

### 페이지 구조

```
/                  → 지도 (메인) + 필터 + 검색
/cafe/:id          → 카페 상세 (바텀시트 or 페이지)
/favorites         → 즐겨찾기 목록 (로그인 필요)
/report            → 카페 제보 (로그인 필요)
/login             → 카카오 로그인
```

## Testing Decisions

- **엔진 테스트**: 크롤링 파서, 시간 필터링 로직 — Vitest 단위 테스트
- **API 테스트**: Supabase Edge Functions — 통합 테스트
- **E2E 테스트**: 지도 로드, 필터 적용, 카페 클릭 흐름 — Playwright
- **크롤링 안정성**: 카카오맵 API 응답 구조 변경 감지 테스트

## Out of Scope (현재 버전)

- 네이버 지도 연동 (카카오맵으로 통일)
- 카페 예약 기능
- 채팅/커뮤니티 기능
- 결제/멤버십
- 서울 외 지역
- 네이티브 앱 (App Store / Play Store)

## Risks & Mitigations

| 리스크 | 영향 | 완화 방안 |
|--------|------|----------|
| 카카오맵 내부 API 구조 변경 | 크롤링 중단 | 응답 스키마 검증 테스트 + 알림, 빠른 파서 업데이트 |
| 카카오맵 IP 차단 | 크롤링 불가 | rate limiting (요청 간 1초 딜레이), 요청량 최소화 |
| Supabase 무료 tier 한계 | 서비스 중단 | 초기에는 무료 tier, 사용자 증가 시 Pro 전환 ($25/월) |
| 영업시간 데이터 부정확 | 사용자 신뢰 저하 | 사용자 제보 시스템으로 보완, "마지막 확인일" 표시 |
| 서울 전체 카페 수가 예상보다 많음 | 크롤링 시간 초과 | 얼리버드(08:00 이전) 카페만 상세 크롤링, 나머지는 목록만 |

## Success Metrics

- 서울 얼리버드 카페 커버리지 90% 이상
- 영업시간 정확도 95% 이상 (사용자 제보 반영 후)
- 지도 로딩 시간 2초 이내
- Lighthouse PWA 점수 90+
- 모바일 사용 비율 80% 이상
