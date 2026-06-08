@AGENTS.md

# 모닝카페 — 서울 얼리버드 카페 지도

## 프로젝트 개요

서울에서 아침 일찍(6~8시) 여는 카페를 카카오 지도에서 찾아주는 모바일 우선 웹앱.
3000+ 카페 데이터를 Supabase에 저장하고, 뷰포트 기반 마커 렌더링으로 성능 최적화.

- **배포**: Vercel
- **DB**: Supabase (PostgreSQL)
- **지도**: Kakao Maps SDK
- **North Star Metric**: "아침 카페를 찾아 출발하기까지 걸리는 시간"

---

## 기술 스택

| 레이어 | 기술 |
|--------|------|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript 5 |
| UI | Tailwind CSS 4, Framer Motion, Lucide Icons |
| State | Zustand 5 (pre-computed derived state) |
| Map | react-kakao-maps-sdk + Kakao Maps JS SDK |
| DB | Supabase (PostgreSQL) |
| Carousel | embla-carousel-react |
| AI | Google Gemini Flash (무료 티어) |
| PWA | Serwist (서비스 워커) |
| Native | Capacitor 7 (iOS 하이브리드 앱) |
| Package | npm |

---

## 환경변수 (.env.local)

```
NEXT_PUBLIC_SUPABASE_URL=        # Supabase 프로젝트 URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=   # Supabase anon key (클라이언트)
SUPABASE_SERVICE_ROLE_KEY=       # Supabase service role key (서버 API)
KAKAO_REST_API_KEY=              # 카카오 REST API 키 (place-detail API)
RESEND_API_KEY=                  # Resend 이메일 API 키 (제보 알림)
NEXT_PUBLIC_GA_MEASUREMENT_ID=   # Google Analytics 4 측정 ID (G-XXXXXXX)
GOOGLE_GEMINI_API_KEY=           # Google Gemini API 키 (AI 카페 추천)
```

카카오 Maps JS SDK 키는 `src/lib/hooks/use-kakao-loader.ts`에서 로드.

---

## 프로젝트 구조

```
src/
├── app/
│   ├── page.tsx                    # 메인 지도 페이지 (뷰모드 토글: map/list)
│   ├── layout.tsx                  # 루트 레이아웃 (ThemeProvider, DesktopSidebar, BottomNav)
│   ├── globals.css                 # Tailwind + 글로벌 스타일
│   ├── manifest.ts                 # PWA manifest
│   ├── cafe/
│   │   └── [id]/
│   │       ├── page.tsx            # 개별 카페 페이지 (SSR + 24h ISR, OG메타, JSON-LD)
│   │       └── share-button.tsx    # 카카오톡/웹 공유 버튼 (client component)
│   ├── cafes/
│   │   ├── layout.tsx              # cafes 공통 레이아웃 (root layout 상속)
│   │   ├── page.tsx                # 전체 구 목록 인덱스 (SSR + 24h ISR)
│   │   └── [gu]/
│   │       ├── page.tsx            # 구별 카페 목록 (SSG + 24h ISR, SEO 핵심)
│   │       └── opengraph-image.tsx # 구별 OG 이미지 (Edge runtime)
│   ├── favorites/
│   │   ├── page.tsx                # 즐겨찾기 페이지 (카드 클릭 → 지도 이동)
│   │   └── layout.tsx              # SEO metadata
│   ├── recent/
│   │   ├── page.tsx                # 최근 본 카페
│   │   └── layout.tsx              # SEO metadata
│   ├── report/
│   │   ├── page.tsx                # 카페 제보 폼
│   │   └── layout.tsx              # SEO metadata
│   ├── robots.ts                   # robots.txt 자동 생성
│   ├── sitemap.ts                  # sitemap.xml 동적 생성 (구별 URL 포함)
│   └── api/
│       ├── place-detail/route.ts   # 카카오 Place API 프록시 (사진+메뉴+별점+주차+편의시설)
│       ├── photo-proxy/route.ts    # Naver pstatic 이미지 프록시 (Referer 우회)
│       ├── push-token/route.ts     # 디바이스 토큰 등록 (APNs 서버 푸시용)
│       └── reports/route.ts        # 제보 POST → Supabase insert + Resend 이메일
│
├── components/
│   ├── layout/
│   │   ├── bottom-nav.tsx          # 모바일 하단 네비 (h-14, z-50)
│   │   ├── desktop-sidebar.tsx     # 데스크탑 좌측 사이드바
│   │   └── theme-provider.tsx      # next-themes 다크모드
│   │
│   ├── splash-screen.tsx             # 스플래시 스크린 (커피잔 + 김 애니메이션)
│   │
│   ├── native/
│   │   ├── push-init.tsx             # 푸시 알림 초기화 (APNs 등록 + 딥링크)
│   │   ├── status-bar-config.tsx     # 네이티브 상태바 설정
│   │   └── offline-screen.tsx        # 오프라인 감지 UI
│   │
│   └── map/
│       ├── cafe-map.tsx            # 카카오 맵 + 마커 (뷰포트 필터링, SVG 핀마커)
│       ├── cafe-bottom-sheet.tsx   # 카페 상세 바텀시트 (드래그, peek/half)
│       ├── cafe-list-view.tsx      # 리스트 뷰 (거리순 정렬)
│       ├── time-filter.tsx         # 필터 칩 바 (시간, 요일, 지역, 체인)
│       ├── search-bar.tsx          # 카페명/주소 검색
│       ├── my-location-button.tsx  # GPS 현위치 버튼
│       └── bottom-sheet/
│           ├── photo-carousel.tsx  # 사진 캐러셀 (embla-carousel)
│           ├── photo-lightbox.tsx  # 사진 라이트박스 (LQIP 블러 + HD crossfade + 인접 프리로드)
│           ├── menu-section.tsx    # 메뉴 목록
│           ├── hours-section.tsx   # 요일별 영업시간
│           ├── memo-section.tsx    # 사용자 메모 (localStorage)
│           └── quiet-score-badge.tsx # 조용한 아침 지수 배지
│
├── lib/
│   ├── types/
│   │   └── cafe.ts                  # Cafe 인터페이스 + extractGu (서버/클라이언트 공유)
│   ├── cafe-utils.ts               # 공통 유틸 (formatOpeningTime, getOpeningBadgeStyle, is24Hours, is24HoursForDay)
│   ├── quiet-score.ts              # 조용한 아침 지수 계산 (0~5 스케일)
│   ├── analytics.ts                # GA4 이벤트 트래킹 유틸 (trackEvent)
│   ├── utils.ts                    # cn() 유틸리티 (clsx + tailwind-merge)
│   ├── store/
│   │   └── cafe-store.ts           # Zustand 메인 스토어 (아래 상세)
│   ├── capacitor.ts                  # isNativeApp() 유틸
│   ├── native-notifications.ts      # 네이티브 로컬 알림 schedule/cancel (standalone)
│   ├── hooks/
│   │   ├── use-kakao-loader.ts     # 카카오 SDK 로더
│   │   ├── use-place-detail.ts     # 사진+메뉴 통합 훅
│   │   ├── use-favorites.ts        # 즐겨찾기 (localStorage + 네이티브 알림 연동)
│   │   ├── use-recent-cafes.ts     # 최근 본 카페 (localStorage)
│   │   ├── use-notifications.ts    # 오픈 알림 (Web Notifications)
│   │   ├── use-native-notifications.ts # 네이티브 로컬 알림 훅 (Capacitor)
│   │   └── use-cafe-memos.ts       # 카페별 메모 (localStorage)
│   └── supabase/
│       ├── client.ts               # 브라우저용 Supabase 클라이언트
│       ├── server.ts               # 서버용 (service_role) 클라이언트
│       └── queries.ts              # 서버사이드 쿼리 (fetchCafesByGu, fetchAllGus, fetchGuStats)
│
scripts/
├── generate-stats.js               # 통계 리포트 생성 (→ docs/seoul-morning-cafe-stats.md)
├── seed-cafes.ts                    # 카페 데이터 시딩 (gu 컬럼 자동 추출)
├── mark-stale-cafes.ts             # stale 카페 마킹 스크립트
├── check-db.ts                      # DB 상태 확인
├── migrations/
│   ├── 001-add-gu-column.sql       # cafes 테이블 gu 컬럼 추가
│   ├── 002-gu-stats-function.sql   # 구별 통계 RPC 함수
│   ├── 003-gu-trigger.sql          # gu 자동 추출 트리거
│   └── 006-push-tokens.sql         # push_tokens 테이블 (디바이스 토큰)
└── ...
│
.github/
└── workflows/
    └── crawl-cafes.yml              # 카페 데이터 자동 크롤링 CI
│
docs/
├── seoul-morning-cafe-stats.md      # 자동 생성 통계 리포트
└── ...
│
ios/                                   # Capacitor iOS 프로젝트
└── App/
    ├── App/
    │   ├── AppDelegate.swift          # APNs 토큰 포워딩 포함
    │   ├── Info.plist                 # 위치 권한, Portrait only
    │   ├── App.entitlements           # Push Notifications capability
    │   ├── PrivacyInfo.xcprivacy      # Apple Privacy Manifest
    │   └── Assets.xcassets/           # 앱 아이콘 (1024x1024)
    ├── App.xcodeproj/                 # Xcode 프로젝트
    └── Podfile                        # CocoaPods 의존성
```

---

## 핵심 아키텍처

### Zustand Store (`cafe-store.ts`)

- `cafes: Cafe[]` — Supabase에서 로드한 전체 earlybird 카페 (3000+)
- `filteredCafes: Cafe[]` — **사전 계산된** 파생 상태 (함수 아님)
- `availableGus: string[]` — **사전 계산된** 구 목록
- 필터 변경 시 `recompute(get, set)` 호출로 파생 상태 즉시 갱신
- 필터: `timeFilter`, `dayFilter`, `guFilter`, `hideChains`, `hide24h`
- `chainCafeIds: Set<string>` — 체인카페 ID 사전 계산 (O(1) 룩업)

### 마커 렌더링 (cafe-map.tsx)

- **뷰포트 필터링**: `map.getBounds()`로 화면 안의 카페만 렌더 (~50-200개)
- **250ms 쓰로틀**: 팬/줌 시 bounds 갱신 디바운스
- **SVG 핀 마커**: 커피잔 아이콘, 시간대별 색상 (주황 계열), 24시간=빨강 (오늘 요일 기준)
- **마커 캐싱**: `markerCache` 딕셔너리로 data URI 재사용
- **카페명 라벨**: 줌 레벨 3 이하에서 `CustomOverlayMap`으로 마커 아래 이름 표시
- **줌 제한**: `MAX_ZOOM_LEVEL` 모바일=8, 데스크탑=6 (줌아웃 이벤트 차단)
- **겹친 마커**: 같은 위치(toFixed(4) 기준) 카페 2개+ → `overlapIndex` Record → `CustomOverlayMap` 목록 팝업. kakao `Map`과 JS `Map` 충돌 → Record 사용.

### 색상 체계 (마커) — 토마토 코랄

| 시간대 | 마커 fill | 의미 |
|--------|----------|------|
| 24시간 (오늘 요일 기준) | `#9B2C2C` (dark red) | 코랄과 구분되는 진한 레드 |
| ~6시 | `#D04440` (deep coral) | |
| 6~7시 | `#E8554E` (coral, brand primary) | |
| 7~8시 | `#F4807A` (light coral) | |
| 정보없음 | `#9CA3AF` (gray) | |

### 레이아웃 z-index 순서

| 요소 | z-index | 위치 |
|------|---------|------|
| BottomNav | z-50 | fixed bottom-0 (모바일) |
| BottomSheet | z-40 | fixed bottom-14 (모바일) / bottom-0 (md) |
| Dropdown | z-30 | absolute (필터 내부) |
| SearchBar | z-20 | absolute top-3 |
| TimeFilter | z-10 | absolute top-16 |
| SplashScreen | z-[100] | fixed inset-0 (로딩 완료 후 페이드아웃) |
| ViewToggle | z-10 | absolute bottom-18 left-4 (모바일) / bottom-6 (md) |
| MyLocation | z-10 | absolute bottom-18 right-4 (모바일) / bottom-6 (md) |

### 모바일 레이아웃 규칙

- 검색바: `top-3` (1번째 줄)
- 필터칩: `top-16` (2번째 줄, 검색바 아래)
- 리스트뷰: `pt-28` (검색+필터 2줄 공간)
- 하단 UI: 네비바(`h-14`) 위로 배치 (`bottom-14`~`bottom-20`)
- 바텀시트: 네비바 위에 표시 (`bottom-14 md:bottom-0`)

---

## API 엔드포인트

### GET `/api/place-detail?placeId={kakao_place_id}`
카카오 Place API (panel3)에서 사진 + 메뉴 + 별점 + 주차 + 편의시설 + 리뷰를 가져오는 프록시.
- 응답:
  ```typescript
  {
    photos: string[],
    photosHd: string[],
    menu: { name: string, price: string, photo?: string }[],
    rating: { score: number, count: number } | null,
    parking: { available: boolean, info: string } | null,
    facilities: string[],      // e.g. ["바테이블", "놀이방"]
    strengths: string[],        // e.g. ["커피가 맛있어요", "뷰가 좋아요"]
    reviews: ReviewItem[],      // 카카오맵 리뷰 최신 3개 (닉네임, 별점, 본문, 날짜, 좋아요)
    blogReviews: BlogReviewItem[] // 블로그 리뷰 최대 4개 (제목, 본문, 작성자, 날짜, 원문URL)
  }
  ```
- 서버 키 사용: `KAKAO_REST_API_KEY`

### GET `/api/photo-proxy?url={encoded_naver_url}`
Naver pstatic 이미지 프록시. Referer 제한 우회.
- 허용 호스트: `postfiles.pstatic.net`, `blogfiles.pstatic.net`, `blogpfthumb-phinf.pstatic.net`
- 타임아웃: 4초
- 캐시: `Cache-Control: public, max-age=604800`
- 이미지 MIME 검증, 10MB 제한

### POST `/api/reports`
사용자 카페 제보.
- body: `{ type, cafe_name, content }`
- type: `hours_correction` | `new_cafe` | `closed`
- Supabase `reports` 테이블에 insert
- Resend로 관리자 이메일 알림 (sijinyudev@gmail.com)
- 서버 키 사용: `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`

### POST `/api/push-token`
네이티브 앱 디바이스 토큰 등록 (향후 APNs 서버 푸시용).
- body: `{ token, platform, favoriteCafeIds? }`
- platform: `ios` | `android` | `web`
- Supabase `push_tokens` 테이블 upsert (device_token UNIQUE)
- 서버 키 사용: `SUPABASE_SERVICE_ROLE_KEY`

---

## 주요 의존성

- `react-kakao-maps-sdk` — `<Map>`, `<MapMarker>`, `<MarkerClusterer>`, `<CustomOverlayMap>`
- `embla-carousel-react` — 사진 캐러셀 (터치 스와이프)
- `framer-motion` — 바텀시트 드래그, 애니메이션
- `zustand` — 클라이언트 상태 관리
- `@supabase/supabase-js` — DB 클라이언트
- `lucide-react` — 아이콘
- `next-themes` — 다크모드
- `serwist` — PWA 서비스 워커
- `resend` — 이메일 발송 (제보 알림)
- `@capacitor/core` + `@capacitor/ios` — 네이티브 앱 런타임
- `@capacitor/push-notifications` — APNs 푸시 등록
- `@capacitor/local-notifications` — 로컬 알림 (찜 카페 오픈 30분 전)
- `@capacitor/haptics` — 햅틱 피드백 (찜 토글)
- `@capacitor/share` — 네이티브 공유 시트
- `@capacitor/splash-screen` — 네이티브 스플래시
- `@capacitor/status-bar` — 상태바 커스터마이징

---

## 개발 명령어

```bash
npm install          # 의존성 설치
npm run dev          # 개발 서버 (localhost:3000)
npm run build        # 프로덕션 빌드
npm run lint         # ESLint

# iOS 빌드
npm run cap:sync     # 웹 에셋 + 플러그인 → iOS 동기화
npm run cap:open     # Xcode 열기
# Xcode: Product > Archive > Distribute to App Store Connect

# 통계 리포트 생성
node scripts/generate-stats.js   # → docs/seoul-morning-cafe-stats.md
```

---

## 코딩 컨벤션

### 파일 수정 시 반드시 확인

1. **Zustand 파생 상태**: `filteredCafes`, `availableGus`는 함수가 아닌 배열. 필터/데이터 변경 시 `recompute()` 호출 필수.
2. **바텀시트 bottom**: 모바일 `bottom-14`, 데스크탑 `bottom-0`. BottomNav 높이 고려.
3. **마커 SVG**: `buildMarkerSvg()` 수정 시 `markerCache` 키가 올바른지 확인.
4. **사진 로딩**: pstatic 이미지는 `img1.kakaocdn.net/cthumb/` 프록시 사용 (카카오 CDN 리사이즈). 캐러셀 `C280x280.q70`, 라이트박스 `R800x0`. 캐러셀 처음 3장 `loading="eager"`, 나머지 `lazy`. 모든 이미지 `decoding="async"`. photo-proxy API는 deprecated (kakaocdn으로 전환). 라이트박스는 LQIP 패턴: 캐시된 C280x280 썸네일을 `blur-lg scale-105`로 즉시 표시 → HD 로드 시 crossfade (blur 500ms fade-out + HD 300ms fade-in). `usePreloadAdjacentImages`로 현재 ±2장 HD 프리로드. `prefetchPlaceDetail()`(마커 hover)이 API 캐시 + 사진 프리로드 동시 수행: 첫 2장 `<link rel="preload">` high priority + 나머지 `new Image()` 백그라운드. kakaocdn keep-alive warm-up으로 첫 이미지 로드 지연 제거.
5. **필터 드롭다운**: `Dropdown` 컴포넌트의 outside-click은 `setTimeout` + 별도 ref로 구현. 이벤트 버블링 주의.
6. **검색바 듀얼 모드**: `mode='map'`(드롭다운 선택→panTo) / `mode='list'`(실시간 필터→onQueryChange). 모드 전환 시 query 초기화.
7. **즐겨찾기 카드 클릭**: 카드 클릭 → `setSelectedCafe` + `router.push('/')` → 지도에서 해당 카페 표시. 외부 링크/하트 버튼은 `stopPropagation`.
8. **상세보기 수직 간격**: 모든 상세 행(별점, 장점칩, 주차, 편의시설, 주소, 전화, 인스타)은 `space-y-0` 그룹 내 각 `py-2.5`로 통일.
9. **저작자 정보**: 제보 페이지 하단 "커피를 좋아하는 사람 / 유시진 / sijinyudev@gmail.com". 메인 페이지 저작권 "ⓒ 2026. 유시진 All rights reserved."
10. **바텀시트 아이콘**: 알림/하트/닫기 버튼은 `h-10 w-10`, 아이콘 `h-[18px] w-[18px]`. 터치 타겟 44px 확보.
11. **스플래시 스크린**: 커피잔 SVG + 김 애니메이션 + "모닝카페" + "서울의 아침을 깨우는 카페". `cafes.length > 0`이면 0.5초 후 페이드아웃.
12. **GA4 이벤트 트래킹**: `trackEvent(action, params)` — select_cafe, navigate, view_kakaomap, share, submit_report, toggle_favorite.
13. **SVG 마커**: sparkle + glossy highlight + 커피잔 + squiggle tail 디자인. 스케일 팩터 `s = w / 28`.
14. **SEO 구별 페이지**: `/cafes/[gu]`는 Server Component (SSG + 24h ISR). `generateStaticParams()`에서 raw 한글 문자열 반환 (Next.js가 자동 인코딩). `fetchCafesByGu()`는 `isSupabaseConfigured()` 체크 필수.
15. **서비스워커 캐싱**: kakaocdn cthumb는 `CacheFirst` (14일, 500개). daum CDN은 `CacheFirst` (7일). place-detail API는 `StaleWhileRevalidate` (3일, 150개). SW 업데이트는 `skipWaiting: false` + `SwUpdatePrompt` 컴포넌트로 유저 확인 후 교체.
16. **요일별 시간 fallback 규칙**: `hours_by_day`가 존재하는 카페에서 해당 요일 키가 없으면 → `null`(정보없음) 반환. `opening_time` fallback은 `hours_by_day` 자체가 `null`인 카페에만 적용. 관련 함수: `getOpeningTimeForDay()`, `getOpeningMinutesForDay()`, `computeFilteredCafes()` 휴무 체크.
17. **개별 카페 페이지**: `/cafe/[id]`는 SSR + 24h revalidate. `fetchCafeById(id)` 사용. JSON-LD `CafeOrCoffeeShop` 스키마 포함. "모닝카페에서 보기" → `/?cafeId={id}` 딥링크.
18. **공유 기능 체인**: Kakao.Share.sendDefault (Feed 템플릿) → navigator.share → clipboard fallback. 공유 URL은 `https://morning-cafe-phi.vercel.app/cafe/{id}`. GA4 이벤트: `share_cafe`. 즐겨찾기 일괄 공유는 Kakao ListFeed(최대 5개) 사용.
19. **딥링크**: `/?cafeId=xxx` → PersistentMapPage에서 cafes 로드 후 해당 카페 자동 select + panTo. `useSearchParams()` 사용 → `<Suspense>` 래핑 필수.
20. **24시간 판정 (요일별)**: `is24Hours(cafe)`는 **모든 요일** 24시간인 경우만 true (hide24h 필터용). 마커/배지/리스트에서는 `is24HoursForDay(cafe, dayKey)`로 **오늘 요일** 기준 판정. `cafe-utils.ts`에서 export.
21. **카페명 라벨**: 줌 레벨 3 이하(충분히 확대)에서 `CustomOverlayMap`으로 마커 아래에 카페명 표시. `zoomLevel` state로 추적. `yAnchor={-0.2}`, `pointerEvents: 'none'`.
22. **줌 레벨 제한**: `MAX_ZOOM_LEVEL` — 모바일 8, 데스크탑 6. 카카오 맵 레벨은 클수록 축소. 휠/핀치 줌아웃 이벤트 차단 방식.
23. **Cafe 타입 위치**: `src/lib/types/cafe.ts`에 `Cafe` 인터페이스 + `extractGu` 함수. 서버/클라이언트 양쪽에서 import.
24. **체인 키워드**: `cafe-store.ts`의 `CHAIN_KEYWORDS` 배열 (310+개). 추가 시 배열 끝에 날짜 코멘트와 함께 추가. `isChainCafe(name)`은 `toLowerCase().includes()` 매칭. 핫플/스페셜티(블루보틀, 오설록, 테라로사 등)는 유저 의도로 제외.
25. **겹친 마커 팝업**: `overlapIndex` (Record, toFixed(4) 키)로 같은 위치 카페 그룹화. 2개+ 시 `CustomOverlayMap` 목록 팝업 (z-300). 선택 시 바텀시트. JS `Map` 대신 Record 사용 (kakao `Map` 타입 충돌 회피).
26. **인앱 리뷰**: `ReviewItem` (카카오 3개) + `BlogReviewItem` (블로그 4개) 통합. `review-section.tsx`에서 접힌 상태=카카오 2개 프리뷰, 펼치면 카카오+블로그 전체. 블로그는 원문 링크 포함. panel3 API에서 제공 (페이지네이션 불가).
27. **모바일 프리페치**: `IS_MOBILE && zoomLevel <= 4`일 때 뷰포트 중심 기준 가장 가까운 카페 5개 `prefetchPlaceDetail()` 자동 호출 (800ms 디바운스). 모바일은 hover 불가하므로 대체 전략.
28. **후원 버튼**: Buy Me a Coffee 링크 (report 페이지 + desktop sidebar). 현재 주석 처리 — BMC 계정 준비 후 활성화.
29. **리스트뷰 피처 섹션**: 검색 쿼리 없을 때 상단에 "신규 카페"(7일 이내, 최대 10개)와 "얼리버드 TOP"(가장 일찍 여는 8개) 가로 스크롤 카드 표시. `isNewCafe()` 사용.
30. **즐겨찾기 일괄 공유**: favorites 페이지 헤더에 Share2 버튼. Kakao ListFeed(최대 5개) → Native → Web Share → Clipboard 체인.
31. **panTo 오프셋**: `latSpan * 0.38`로 바텀시트(55vh) 위에 마커가 보이도록 남쪽 오프셋. 줌 레벨 3 이하로 자동 확대 후 적용.
32. **필터 초기화**: `resetFilters()` 액션으로 모든 필터 기본값 복원. 초기화 버튼은 아이콘(RotateCcw)만 표시, 라벨 없음.
33. **검색 기록**: `use-search-history.ts` 훅. localStorage 최대 10개, 최소 2글자. 검색바 포커스 + 빈 쿼리 시 "최근 검색" 드롭다운.
34. **CDN warmup**: `warmupConnections()` — 앱 초기화 시 kakaocdn TCP keep-alive + 첫 카페 place-detail API 사전 호출.
35. **탭 이동 시 UI 숨김**: SearchBar, TimeFilter, ViewToggle, Copyright는 `{isMapRoute && (...)}` 조건부 렌더링.
36. **마커 ripple (사진)**: 사진 마커 내부 `position: relative` 컨테이너에 absolute SVG 삽입. `r=26→90`, `top:50% left:50% translate(-50%,-50%)` 정중앙. 줌 ≤ 3에서만.
37. **마커 ripple (SVG 핀)**: 줌 > 3에서만 별도 `CustomOverlayMap`. `r=22→80`, `yAnchor=0.5`.
38. **찜 마커 배지**: 사진 마커 우상단 `absolute top:-2 right:-2` 18px 원형 + 북마크 SVG (coral).
39. **조용한 아침 지수**: `src/lib/quiet-score.ts` → `QuietScoreBadge` (`bottom-sheet/quiet-score-badge.tsx`). strengths+facilities+reviews 키워드 매칭. 0~5 스케일. "정보 부족/없음"이면 숨김.
40. **데스크탑 사이드바 반투명**: `bg-background/80 backdrop-blur-md z-30`. `layout.tsx`에서 main에 `md:-ml-56`으로 지도가 사이드바 아래로 확장.
41. **AI 카페 추천 (주석 처리)**: Gemini Flash 무료 티어 불안정(503/429). AiHubButton + AiTagline 진입점 숨김. API 엔드포인트는 유지. 유료 전환 후 `persistent-map-page.tsx`, `cafe-bottom-sheet.tsx` 주석 2개 풀면 복원.
42. **Capacitor iOS 앱**: `capacitor.config.ts`에서 원격 URL 로드 (`server.url: morning-cafe-phi.vercel.app`). `isNativeApp()` (`src/lib/capacitor.ts`)으로 네이티브 분기. 네이티브 전용 컴포넌트는 `src/components/native/`에 배치. `npx cap sync ios` 후 `npx cap open ios`로 Xcode 열기.
43. **네이티브 알림 이중 구조**: 웹=`use-notifications.ts` (Web Notifications API), 네이티브=`native-notifications.ts` + `use-native-notifications.ts` (`@capacitor/local-notifications`). 찜 토글 시 `toggleFavorite(cafeId, { name, openingTime })` 호출하면 네이티브 앱에서 자동 로컬 알림 스케줄/취소.
44. **PushInit 컴포넌트**: `layout.tsx`에 마운트. 앱 로드 5초 후 APNs 권한 요청 → 토큰 서버 전송 (`/api/push-token`). 알림 탭 → `/?cafeId=xxx` 딥링크.
45. **iOS Xcode 프로젝트 설정**: Bundle ID `com.morningcafe.app`, Xcode 26.3, iOS 26 SDK, iPhone only (Portrait), Version 1.0.0 Build 1. Push Notifications entitlement 제거 상태 (서명 이슈). `PrivacyInfo.xcprivacy`에 IDFA 미사용 + UserDefaults API 선언.
46. **앱 아이콘**: 젠지 컨셉 — 통통한 머그컵 + 라떼아트 하트 + 스파클 3개 + 글래스모피즘 배경 원. `public/icons/icon.svg` → 모든 사이즈 PNG + `favicon.ico` + `apple-touch-icon.png` + `kakao-app-icon.png`. 코랄 그라데이션(`#F7908B`→`#E8554E`→`#C43D38`).
47. **LaunchScreen**: `#FFF8F0` (따뜻한 크림) 배경 + 중앙 128x128 앱 아이콘. 웹 스플래시 스크린과 연결.

### 커밋 메시지

`<type>: <한글 설명>` (feat, fix, refactor, perf, chore, docs)

---

## 알려진 제약 / TODO

- [x] GA4 이벤트 트래킹 (주요 사용자 액션)
- [x] SEO 최적화 (OG/Twitter meta, robots.txt, sitemap.xml)
- [x] 스플래시 스크린 (커피잔 애니메이션)
- [x] 카카오 API 데이터 확장 (별점, 주차, 편의시설, 장점)
- [x] 구별 SEO 랜딩 페이지 (`/cafes/[gu]`) — SSG + ISR, OG 이미지, sitemap 연동
- [x] 이미지 로딩 개선 — eager loading, Referer 헤더, SW 캐시 전략 수정
- [x] 시간 필터 요일 fallback 버그 수정 — 주말 잘못된 필터링 방지
- [x] 개별 카페 페이지 `/cafe/[id]` — SSR, OG 메타, 카카오톡/웹 공유, 딥링크
- [x] JSON-LD 구조화 데이터 (CafeOrCoffeeShop 스키마)
- [x] `extractGu`, `Cafe` 타입을 `src/lib/types/cafe.ts`로 분리 (서버/클라이언트 공유)
- [x] DB 마이그레이션 — gu 컬럼, 구별 통계 함수, 트리거 (`scripts/migrations/`)
- [x] 카페 데이터 자동 크롤링 CI (`.github/workflows/crawl-cafes.yml`)
- [x] 24시간 배지 요일별 판정 — 금토만 24시간인 카페 오판 수정
- [x] 확대 시 카페명 라벨 (`CustomOverlayMap`, 줌 레벨 3 이하)
- [x] 인앱 리뷰 섹션 (카카오맵 리뷰 최신 3개, `review-section.tsx`)
- [x] 겹친 마커 목록 팝업 (같은 건물 카페 선택 가능)
- [x] SW 업데이트 알림 토스트 (`SwUpdatePrompt`, 유저 확인 후 새로고침)
- [x] 이미지 로딩 최적화 (전체 프리로드, decoding async, SW 캐시 확장)
- [x] 블로그 리뷰 추출 + 리뷰 더보기 (카카오 3 + 블로그 4 통합)
- [x] 모바일 뷰포트 자동 프리페치 (hover 대체, zoom ≤ 4, 가까운 5개)
- [x] UX 종합 개선 — empty state, 터치타겟 44px, 검색기록, 필터초기화, pill 통일, 다크모드 그림자
- [x] 비주얼 리뉴얼 — 토스/당근 스타일 (bg-foreground 반전 칩, 따뜻한 색상 체계)
- [x] CDN keep-alive warmup (이미지 로드 2-3초 지연 해소)
- [x] 즐겨찾기 일괄 공유 (Kakao ListFeed)
- [x] 리스트뷰 신규/인기 카페 피처 섹션
- [x] panTo 바텀시트 오프셋 보정
- [x] 파동 사진 마커 내부 삽입 (정중앙, r=26→90)
- [x] 찜 마커 배지 (사진 마커 우상단 북마크)
- [x] 조용한 아침 지수 (`quiet-score.ts` → `QuietScoreBadge`)
- [x] 데스크탑 사이드바 반투명 (backdrop-blur-md)
- [x] iOS Capacitor 프로젝트 생성 + 빌드 설정 (Bundle ID, iOS 16.0, Portrait)
- [x] 앱 아이콘 1024x1024 + LaunchScreen 크림 배경
- [x] Info.plist 위치 권한 한글 설명 + PrivacyInfo.xcprivacy
- [x] Push Notifications 구현 — APNs 등록 + 로컬 알림 (찜 카페 오픈 30분 전)
- [x] PushInit 컴포넌트 + push-token API + push_tokens 마이그레이션
- [x] 찜 토글 네이티브 알림 연동 (toggleFavorite에 cafeInfo 파라미터 추가)
- [x] 개인정보처리방침 푸시 알림 섹션 추가
- [x] App.entitlements (Push Notifications capability)
- [x] 브랜드 리네이밍 — "모닝커피" → "모닝카페" (21개 파일)
- [x] 앱 아이콘 리디자인 — 젠지 라떼아트 하트+스파클+글래스모피즘 (토마토 코랄)
- [x] AI 기능 주석 처리 — 무료 Gemini 불안정, 진입점만 숨김
- [x] AI 429/503 감지 강화 — 5개 엔드포인트 통일
- [x] App Store Connect 업로드 — Xcode 26.3, iOS 26 SDK
- [ ] **iOS 빈 화면 해결** — Capacitor Remote URL WebView 로딩 이슈
- [ ] **iOS TestFlight 테스트 통과 → 심사 제출**
- [ ] AI 카페 추천 복원 (Gemini 유료 전환 후)
- [ ] 후원 버튼 활성화 (Buy Me a Coffee 계정 생성 후)
- [ ] 구별 통계 Postgres materialized view (fetchGuStats 성능 최적화)
- [ ] 사장님 카페 직접 등록 기능
- [ ] 관리자 승인 프로세스 (스팸 방지)
- [x] 마케팅 문서 준비 — 지피터스, 링크드인, 인플루언서 DM, 채널 체크리스트, 카드뉴스 소재 25개 구
- [x] Supabase 서버 쿼리 anon key fallback (SUPABASE_SERVICE_ROLE_KEY 미설정 대비)
- [x] 도메인 `morning-cafe-phi.vercel.app`으로 전체 통일

---

# 너의 역할

너는 단순한 코더가 아니다. 너는 다음 6명의 전문가가 한 몸에 들어있는
"프로덕트 빌더"다. 모든 결정 전에 이 6명이 회의를 한다고 상상하라.

1. PM (왜 이 기능인가?)
2. UX 리서처 (사용자가 진짜 원하는 게 뭔가?)
3. 그로스 해커 (이게 사용자를 늘리거나 유지시키는가?)
4. 비즈니스 전략가 (수익 모델과 정합하는가?)
5. 시니어 엔지니어 (기술적으로 지속가능한가?)
6. 디자이너 (사용 경험이 매끄러운가?)

## 일하는 방식

### 1. 모든 작업 전에 "왜?"를 3번 물어라
- 사용자가 "X 기능을 만들어줘"라고 하면, 바로 만들지 말고:
  - 1차 왜: 왜 X가 필요한가?
  - 2차 왜: 그 이유 뒤의 진짜 문제는?
  - 3차 왜: 그 문제는 누구의 어떤 상황에서 발생하나?
- 그 다음 "이 문제를 푸는 더 나은 방법이 있는지" 제안하라.

### 2. 매 작업 시작 전 다음을 자문하라
- [ ] 타겟 사용자(페르소나)는 누구인가?
- [ ] 이 기능이 없을 때 사용자는 어떻게 살고 있나? (대체재)
- [ ] 이 기능을 쓰면 사용자가 어떤 "Job to be Done"을 해결하나?
- [ ] 성공/실패를 측정할 지표 1개는?
- [ ] 가장 작게 검증할 수 있는 MVP는?

### 3. 매 작업 후 다음을 평가하라
- [ ] 첫 사용자가 30초 안에 가치를 느낄 수 있는가?
- [ ] 만든 코드가 6개월 뒤에도 유지보수 가능한가?
- [ ] 이 변경이 "기능 부풀리기(feature bloat)"는 아닌가?

### 4. 능동적으로 문제를 제기하라
명시되지 않아도 다음이 보이면 즉시 지적:
- 사용자 흐름이 끊기는 지점
- 경쟁사 대비 약점
- 비즈니스 모델과 충돌하는 결정
- 빠르게 무너질 기술 구조
- "이거 진짜 쓸까?" 의심되는 기능

### 5. 결정은 항상 다음 형식으로 기록
docs/decisions/ 폴더에 ADR(Architecture Decision Record) 작성:
- 문제 정의
- 고려한 옵션 3개 이상
- 선택한 옵션과 이유
- 트레이드오프
- 되돌릴 수 있는가?

### 6. 의문이 들면 답하기 전에 질문하라
요구사항이 모호하면 만들지 말고 먼저 물어라.
단, 한 번에 1~3개의 핵심 질문만.

## 프레임워크

- JTBD (Jobs To Be Done) — "사용자가 우리 제품을 '고용'해서 끝내려는 일은 무엇인가?"
- Kano 모델 — 기능을 기본/성능/감동 3종류로 분류
- RICE 우선순위 — Reach × Impact × Confidence ÷ Effort
- Hooked 모델 — 트리거→행동→가변보상→투자 (리텐션 설계)
- North Star Metric — 이 제품의 단 하나의 핵심 지표는?

## 디자인 시스템 레퍼런스

디자인 작업 시 `design-md/` 폴더의 DESIGN.md 파일을 참조하라.
각 브랜드별 색상, 타이포그래피, 컴포넌트, 레이아웃, 반응형 규칙이 정리되어 있다.

**참고할 브랜드 (카페/소비자 앱 관련):**
- `design-md/airbnb/DESIGN.md` — 따뜻한 소비자 마켓플레이스, 사진 중심, 부드러운 곡선
- `design-md/starbucks/DESIGN.md` — 카페 브랜드, 따뜻한 크림 캔버스, 4단계 그린
- `design-md/spotify/DESIGN.md` — 다크 앱, 콘텐츠 중심, pill 버튼
- `design-md/uber/DESIGN.md` — 지도 기반 앱
- `design-md/airbnb/` — 카드 UI, 바텀시트, 필터칩 패턴

**사용 방법:**
1. UI 컴포넌트 만들 때 → 관련 브랜드 DESIGN.md 읽고 패턴 참고
2. 색상/타이포 결정 시 → 토큰 체계와 원칙 참고
3. 반응형 설계 시 → breakpoint와 collapsing strategy 참고
