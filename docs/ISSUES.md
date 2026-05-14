# Issues: 서울 얼리버드 카페 파인더

## 의존성 그래프

```
#1 프로젝트 초기화
 ├→ #2 Supabase 스키마 + PostGIS
 │   ├→ #4 크롤링 파이프라인 (카카오 API → 내부 API → DB)
 │   │   └→ #8 pg_cron 스케줄링 (하루 1회 자동 갱신)
 │   ├→ #5 카카오 소셜 로그인
 │   │   ├→ #9 즐겨찾기 CRUD
 │   │   ├→ #10 한줄평/리뷰
 │   │   └→ #11 카페 제보/수정
 │   └→ #6 지도 + 카페 마커 표시
 │       ├→ #7 시간대 필터 + 내 주변 + 검색
 │       └→ #12 카페 바텀시트 (상세 정보)
 ├→ #3 크롤링 엔진 (파서 + 타입)
 │   └→ #4 (위와 동일)
 └→ #13 PWA + 푸시 알림
     └→ #14 토스 스타일 UX 폴리싱 + 배포
```

---

## #1. 프로젝트 초기화 + 기본 레이아웃

**AFK (에이전트 가능)**

### What to build
Next.js 프로젝트 생성, 핵심 의존성 설치, 토스 스타일 모바일 퍼스트 레이아웃 셸 구축. 지도 페이지가 메인이 되는 단일 페이지 중심 구조.

### Acceptance criteria
- [ ] Next.js 14+ App Router + TypeScript 프로젝트 생성
- [ ] shadcn/ui + Tailwind CSS 설치 및 토스 스타일 테마 설정 (큰 타이포, 넉넉한 여백)
- [ ] react-kakao-maps-sdk, zustand, zod, supabase-js 설치
- [ ] 모바일 퍼스트 레이아웃: 하단 네비게이션 (지도/즐겨찾기/제보/마이)
- [ ] 데스크탑 레이아웃: 좌측 패널 + 우측 지도
- [ ] 환경변수 템플릿 (.env.local.example): NEXT_PUBLIC_KAKAO_JS_KEY, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
- [ ] 빈 페이지 라우트: /, /favorites, /report, /login

### Blocked by
None - can start immediately

---

## #2. Supabase 스키마 + PostGIS 설정

**AFK**

### What to build
Supabase 프로젝트 생성, PostGIS 활성화, 핵심 테이블(cafes, favorites, reviews, reports, crawl_queue) 마이그레이션, RLS 정책 설정.

### Acceptance criteria
- [ ] Supabase 프로젝트 생성 및 PostGIS 확장 활성화
- [ ] cafes 테이블: kakao_place_id(UNIQUE), name, address, location(GEOGRAPHY POINT), opening_time, closing_time, hours_by_day(JSONB), is_earlybird, instagram_url, last_crawled_at
- [ ] favorites 테이블: user_id + cafe_id (UNIQUE constraint)
- [ ] reviews 테이블: user_id, cafe_id, content(100자), tags(TEXT[])
- [ ] reports 테이블: user_id, cafe_id(nullable), report_type, content, status
- [ ] crawl_queue 테이블: kakao_place_id, status, attempts
- [ ] GIST 인덱스: cafes.location
- [ ] 인덱스: cafes.is_earlybird, cafes.opening_time
- [ ] RLS: cafes는 누구나 SELECT, favorites/reviews/reports는 본인만 INSERT/SELECT/DELETE
- [ ] Supabase 클라이언트 유틸 (lib/supabase/client.ts, server.ts)
- [ ] TypeScript 타입 자동 생성 (supabase gen types)

### Blocked by
- #1

---

## #3. 크롤링 엔진 — 파서 + 타입 (순수 로직)

**AFK**

### What to build
카카오 로컬 API 호출 + 카카오맵 내부 API(place-api.map.kakao.com/places/panel3) 응답 파싱 로직. React/Supabase 의존성 없는 순수 TypeScript 모듈.

### Acceptance criteria
- [ ] 타입 정의: KakaoLocalPlace, KakaoPlaceDetail, CafeOpenHours, ParsedCafe
- [ ] 카카오 로컬 API 클라이언트: 카테고리 검색(CE7), 서울 격자 분할 좌표 목록, 페이지네이션 처리 (최대 45페이지 × 15건)
- [ ] 카카오맵 내부 API 클라이언트: /places/panel3/{place_id} 호출, 필수 헤더(User-Agent, Referer, pf) 설정
- [ ] 영업시간 파서: open_hours.week_from_today → 요일별 시간 추출, opening_time(TIME) 계산
- [ ] is_earlybird 판정: opening_time < 08:00 이면 true
- [ ] 인스타그램 URL 추출: summary.homepage 필드에서 instagram.com 포함 URL 추출
- [ ] rate limiting: 요청 간 최소 500ms 딜레이
- [ ] 단위 테스트: 파서 정확성 (샘플 JSON 기반), 격자 좌표 생성, is_earlybird 판정
- [ ] 에러 핸들링: API 응답 실패, 영업시간 미등록 카페, 비정상 응답 구조

### Blocked by
- #1

---

## #4. 크롤링 파이프라인 — Edge Function + Queue

**AFK**

### What to build
Supabase Edge Function 2개: (1) seed-crawl-queue: 카카오 API로 서울 카페 목록 → crawl_queue 삽입 (2) process-crawl-queue: 큐에서 dequeue → 상세 파싱 → cafes upsert.

### Acceptance criteria
- [ ] Edge Function "seed-crawl-queue": 카카오 카테고리 API로 서울 25개 구 격자 검색 → 신규 place_id를 crawl_queue에 INSERT
- [ ] Edge Function "process-crawl-queue": crawl_queue에서 pending 5건 SELECT FOR UPDATE → 상세 API 호출 → cafes UPSERT → status='done'
- [ ] 실패 처리: 3회 초과 시 status='failed', 에러 로그 저장
- [ ] 중복 방지: 이미 crawl_queue에 있는 place_id는 skip
- [ ] cafes 테이블 upsert: kakao_place_id 기준, last_crawled_at 갱신
- [ ] 수동 트리거 가능: HTTP POST로 즉시 실행
- [ ] 로컬 테스트: supabase functions serve로 테스트

### Blocked by
- #2, #3

---

## #5. 카카오 소셜 로그인

**AFK**

### What to build
Supabase Auth + 카카오 로그인 연동. 로그인/로그아웃 UI, 인증 상태 관리.

### Acceptance criteria
- [ ] Supabase Auth에 카카오 프로바이더 설정 (REST API Key + Client Secret)
- [ ] /login 페이지: 카카오 로그인 버튼 (토스 스타일)
- [ ] 로그인 성공 → / (지도)로 리다이렉트
- [ ] 로그아웃 기능
- [ ] 인증 상태 Zustand 스토어 (또는 Supabase onAuthStateChange 훅)
- [ ] 미로그인 시 즐겨찾기/제보/리뷰 접근 → 로그인 유도 바텀시트
- [ ] 프로필 표시: 카카오 닉네임 + 프로필 이미지

### Blocked by
- #2

---

## #6. 지도 + 카페 마커 표시

**AFK**

### What to build
메인 페이지에 카카오맵 표시, Supabase에서 얼리버드 카페 조회, 마커 클러스터링으로 지도 위에 표시.

### Acceptance criteria
- [ ] react-kakao-maps-sdk로 카카오맵 전체 화면 렌더링
- [ ] 초기 중심: 서울 시청 (37.5665, 126.9780), 줌 레벨 8
- [ ] Supabase에서 is_earlybird=true 카페 조회 (뷰포트 기반 또는 전체)
- [ ] 커스텀 마커: 카페 아이콘 (커피컵 형태), 오픈 시간에 따라 색상 구분
- [ ] MarkerClusterer로 클러스터링 (줌 아웃 시 숫자 표시)
- [ ] 마커 클릭 시 이벤트 발생 (→ #12 바텀시트와 연결)
- [ ] 지도 이동/줌 시 visible 영역 카페만 로드 (성능 최적화)
- [ ] 로딩 스켈레톤: 지도 로드 전 placeholder

### Blocked by
- #2

---

## #7. 시간대 필터 + 내 주변 + 검색

**HITL (디자인 확인 필요)**

### What to build
지도 위 필터 UI: 시간대 칩 필터, GPS 기반 "내 주변" 버튼, 검색창.

### Acceptance criteria
- [ ] 시간대 필터 칩: "전체" / "~6시" / "6~7시" / "7~8시" (단일 선택, 토스 스타일 칩)
- [ ] 필터 적용 시 지도 마커 실시간 갱신 (DB 재쿼리 또는 클라이언트 필터링)
- [ ] "내 주변" FAB 버튼: 클릭 → GPS 위치 요청 → 반경 1km 카페 표시 → 지도 중심 이동
- [ ] 반경 조절: 500m / 1km / 3km 선택
- [ ] 검색창: 카페명 또는 지역명 입력 → 결과 리스트 → 선택 시 지도 이동 + 마커 하이라이트
- [ ] 검색은 Supabase text search 또는 카카오 키워드 검색 API 활용
- [ ] 필터 상태 URL 파라미터 동기화 (공유 가능)

### Blocked by
- #6

---

## #8. pg_cron 스케줄링 — 하루 1회 자동 갱신

**AFK**

### What to build
pg_cron으로 매일 새벽 3시에 seed-crawl-queue 실행, 매 30초마다 process-crawl-queue 실행. 크롤링 상태 모니터링.

### Acceptance criteria
- [ ] pg_cron job: 매일 03:00 KST → seed-crawl-queue Edge Function 호출 (pg_net HTTP POST)
- [ ] pg_cron job: 매 30초 → process-crawl-queue Edge Function 호출
- [ ] process-crawl-queue는 큐가 비어있으면 즉시 리턴 (불필요한 작업 방지)
- [ ] 크롤링 완료 감지: crawl_queue에 pending=0이면 30초 잡 비활성화
- [ ] 크롤링 상태 조회 SQL: 전체/완료/실패/대기 건수
- [ ] Vault에 프로젝트 URL + anon key 저장

### Blocked by
- #4

---

## #9. 즐겨찾기 CRUD

**AFK**

### What to build
카페 즐겨찾기 추가/삭제, 즐겨찾기 목록 페이지.

### Acceptance criteria
- [ ] 카페 바텀시트에 하트 아이콘 (즐겨찾기 토글)
- [ ] 즐겨찾기 추가/삭제: Supabase favorites 테이블 INSERT/DELETE
- [ ] /favorites 페이지: 즐겨찾기 카페 리스트 (카드 형태, 토스 스타일)
- [ ] 카드 클릭 → 지도에서 해당 카페 위치로 이동
- [ ] 즐겨찾기 카페에 영업시간 변경 시 표시 (예: "영업시간이 변경되었어요")
- [ ] 미로그인 시 하트 클릭 → 로그인 유도
- [ ] 빈 상태: "아직 즐겨찾기한 카페가 없어요"

### Blocked by
- #5, #12

---

## #10. 한줄평 / 리뷰

**HITL (태그 목록 확인)**

### What to build
카페에 한줄평 작성, 미리 정의된 태그 선택, 다른 사용자 리뷰 조회.

### Acceptance criteria
- [ ] 카페 상세에서 "한줄평 남기기" 버튼 → 바텀시트
- [ ] 텍스트 입력 (최대 100자) + 태그 칩 선택 (복수 선택 가능)
- [ ] 기본 태그: "조용함", "콘센트많음", "주차가능", "넓은좌석", "뷰맛집", "디저트맛집", "와이파이빠름"
- [ ] 카페 상세에서 다른 사용자 리뷰 목록 표시 (최신순)
- [ ] 태그 집계: 카페별 가장 많이 선택된 태그 상위 3개 표시
- [ ] 본인 리뷰 삭제 가능
- [ ] 미로그인 시 로그인 유도

### Blocked by
- #5, #12

---

## #11. 카페 제보 / 수정 요청

**AFK**

### What to build
영업시간 수정 제보, 신규 얼리버드 카페 제보, 폐업 신고.

### Acceptance criteria
- [ ] /report 페이지: 제보 유형 선택 (영업시간 수정 / 신규 카페 / 폐업 신고)
- [ ] 영업시간 수정: 카페 선택 → 올바른 영업시간 입력 → 제출
- [ ] 신규 카페: 카페명 + 주소(또는 지도 핀) + 영업시간 입력 → 제출
- [ ] 폐업 신고: 카페 선택 → 사유 입력 → 제출
- [ ] Supabase reports 테이블에 저장 (status='pending')
- [ ] 제보 완료 토스트: "제보해주셔서 감사합니다! 확인 후 반영됩니다"
- [ ] (관리자 기능은 추후) 제보 목록 조회는 Supabase 대시보드에서 직접

### Blocked by
- #5

---

## #12. 카페 바텀시트 (상세 정보)

**HITL (디자인 확인)**

### What to build
카페 마커 클릭 시 토스 스타일 바텀시트로 카페 상세 정보 표시.

### Acceptance criteria
- [ ] 바텀시트 UI: 드래그로 높이 조절 (peek → half → full)
- [ ] peek 상태: 카페명 + 오픈 시간 + 거리
- [ ] half 상태: + 주소 + 전화번호 + 인스타그램 링크 + 요일별 영업시간 + 한줄평 태그 요약
- [ ] full 상태: + 전체 한줄평 목록 + 카카오맵에서 보기 버튼
- [ ] 인스타그램: 정확 매칭 URL이 있으면 아이콘 + 링크, 없으면 검색 링크
- [ ] "카카오맵에서 보기" 버튼 → place_url로 외부 이동
- [ ] 즐겨찾기 하트 버튼
- [ ] "마지막 확인: N일 전" 표시 (last_crawled_at 기반)
- [ ] 부드러운 열기/닫기 애니메이션

### Blocked by
- #6

---

## #13. PWA + 푸시 알림

**AFK**

### What to build
Serwist PWA 설정, 오프라인 지원, 새 얼리버드 카페 등록 시 웹 푸시 알림.

### Acceptance criteria
- [ ] Serwist 서비스 워커 + manifest 설정
- [ ] 앱 아이콘 (192x192, 512x512)
- [ ] 오프라인: 즐겨찾기 카페 목록은 캐시에서 표시 (지도는 온라인 필요)
- [ ] "홈 화면에 추가" 안내 배너 (모바일)
- [ ] PWA 푸시 알림: 새 얼리버드 카페 발견 시 알림 (Web Push API)
- [ ] 알림 구독/해제 설정
- [ ] Lighthouse PWA 점수 90+

### Blocked by
- #1

---

## #14. 토스 스타일 UX 폴리싱 + Vercel 배포

**HITL (디자인 최종 확인)**

### What to build
전체 UI 폴리싱, 다크모드, 애니메이션, 성능 최적화, Vercel 배포.

### Acceptance criteria
- [ ] 다크모드 지원 (next-themes)
- [ ] 토스 스타일 일관성: 컬러 팔레트, 타이포, 여백, 라운딩
- [ ] 페이지 전환 애니메이션
- [ ] 바텀시트/모달 애니메이션 부드러움 검증
- [ ] 빈 상태 일러스트 (즐겨찾기 없음, 검색 결과 없음)
- [ ] 에러 상태 UI (네트워크 오류, API 실패)
- [ ] Lighthouse 성능 90+, 접근성 90+
- [ ] Vercel 배포 + 커스텀 도메인 (옵션)
- [ ] OG 이미지 + 메타태그 (공유 시 미리보기)

### Blocked by
- #7, #9, #10, #11, #12, #13
