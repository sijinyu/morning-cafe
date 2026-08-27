# 모닝카페 — 앱인토스 미니앱

토스 앱 안에서 도는 경량 클라이언트. 앱인토스는 **원격 URL 로드 불가 + SSR 불가 + 로컬 번들(.ait) 업로드** 방식이라,
본 서비스(Next.js)를 그대로 올릴 수 없어 Vite 기반 CSR 앱으로 분리했다.
데이터는 프로덕션 API(`https://morning-cafe-phi.vercel.app/api/cafes`, CORS 허용됨)를 사용한다.

- 시간 필터(6/7/8시 전) + 검색 + 내 주변 거리순(`Device.getLocation`)
- 카페 탭 → `openURL`로 카카오맵 이동
- 광고 없음 (앱인토스 정책 — 자체 인앱 광고만 허용)

## 개발

```bash
npm install
npm run dev            # 로컬 개발 서버
# 실기기 테스트: npm run dev -- --host → 샌드박스 앱에서 intoss://morning-cafe
```

## 배포 (사람이 하는 일)

1. [앱인토스 콘솔](https://developers-apps-in-toss.toss.im/)에서 앱 등록 — **appName은 `morning-cafe`로 정확히** (apps-in-toss.config.ts와 일치 필수), 아이콘·표시명 설정
2. 콘솔에서 API 키 발급
3. ```bash
   npm run build                      # dist + morning-cafe.ait 생성
   npx ait deploy --api-key {API키}
   ```
4. 콘솔에서 검수 제출 (등록 검수 1~2일, 출시 검수 3~5일)

## 주의

- `PAGE_SIZE`(1000)는 본 서비스 `/api/cafes` 라우트와 동일해야 한다
- 번들 100MB 제한, iframe·eval·히스토리 조작 금지 (앱인토스 정책)
- "기존 서비스 단순 홍보 금지" 정책 — 심사 피드백에 따라 토스 로그인 등 SDK 통합이 더 필요할 수 있음
