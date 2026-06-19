# 지피터스 iOS 팔로업 포스팅

## 게시 전략

1. **즉시**: 기존 글에 댓글 — "iOS 앱 출시했습니다. App Store에서 '모닝카페' 검색!"
2. **2주 뒤**: 별도 글 게시 (아래 내용)

---

## 기존 글 댓글 (복붙용)

업데이트 공유드립니다!

모닝카페 iOS 앱을 출시했습니다.
App Store에서 "모닝카페" 검색하시면 받으실 수 있어요.

기존 웹앱을 Capacitor로 iOS 네이티브 앱으로 전환했는데, Claude Code로 Capacitor 설정 + 네이티브 알림 + App Store 심사 대응까지 전부 처리했습니다.

이 과정에 대해서 별도 글로 상세히 공유할 예정입니다!

---

## 별도 글 제목
Claude Code로 웹앱을 iOS 앱으로 — Capacitor + App Store 심사 4일 출시기

## 별도 글 본문 (복사해서 바로 게시)

---

===========================
소개
===========================

2주 전에 "모닝카페" 서울 아침 카페 지도를 공유했는데요.
반응이 좋아서 iOS 앱까지 만들었습니다.

이번 글은 **Next.js 웹앱 → iOS 앱 전환 과정**을 공유합니다.
코드 작성부터 App Store 출시까지 전부 Claude Code로 했습니다.

기존 글: [모닝카페 웹앱 글 링크]


===========================
왜 네이티브 앱을?
===========================

웹앱(PWA)으로도 홈 화면 추가하면 앱처럼 쓸 수 있는데, 3가지 이유로 네이티브 앱을 만들었습니다:

1. **푸시 알림**: 찜한 카페 오픈 30분 전 로컬 알림. PWA에서 iOS 푸시는 제한적입니다.
2. **앱 스토어 노출**: "아침 카페" 검색으로 신규 유저 유입 기대
3. **사용자 요청**: "앱은 없나요?" 댓글이 가장 많았습니다

기술 선택지:
- React Native → 코드 전면 재작성 필요
- Flutter → 마찬가지
- **Capacitor** → 기존 Next.js 코드 그대로 + 네이티브 기능 추가

Capacitor를 선택했습니다. 코드베이스 하나로 웹 + iOS 동시 서비스.


===========================
진행 방법 (Claude Code)
===========================

**1단계: Capacitor 초기 설정**

「이 Next.js 웹앱에 Capacitor 7을 추가해서 iOS 앱으로 빌드할 수 있게 해줘. Remote URL 방식으로 기존 Vercel 배포 URL을 WebView에 로드.」

→ capacitor.config.ts 생성, iOS 프로젝트 초기화, Podfile 설정까지 한번에.

[스크린샷: Xcode 프로젝트]


**2단계: 네이티브 기능 추가**

「찜한 카페 오픈 30분 전에 로컬 알림을 보내줘. @capacitor/local-notifications 사용. 찜 토글할 때 알림 스케줄/취소 자동 연동.」

→ `native-notifications.ts` + `use-native-notifications.ts` 훅 생성. 웹에서는 Web Notifications API, 네이티브에서는 Capacitor 로컬 알림으로 분기.

[스크린샷: 알림 설정 화면]


**3단계: 네이티브/웹 분기**

「`isNativeApp()` 유틸 함수 만들어줘. Capacitor.isNativePlatform()으로 판별. 네이티브 전용 컴포넌트는 src/components/native/에 모아줘.」

→ 웹/네이티브 UI 분기 처리. 상태바 색상, 스플래시 스크린, Safe Area 등.


**4단계: App Store 심사 대응**

리젝 2번 받았습니다.

1차 리젝: Privacy Manifest 누락
「Apple PrivacyInfo.xcprivacy 파일 만들어줘. IDFA 미사용, UserDefaults API만 선언.」
→ 바로 해결

2차 리젝: 위치 권한 설명 미흡
「Info.plist 위치 권한 한글 설명을 구체적으로 수정해줘. '근처 아침 카페를 찾기 위해 현재 위치를 사용합니다' 느낌으로.」
→ 바로 해결

**총 소요: 4일** (Capacitor 설정 1일 + 네이티브 기능 1일 + 심사/수정 2일)

[스크린샷: App Store Connect 승인 화면]


===========================
겪은 이슈들
===========================

**1. WebView 빈 화면**

Capacitor Remote URL 모드에서 WebView가 빈 화면만 표시. 원인: CSP 헤더 + WebView 캐시 이슈.
Claude Code에 증상 전달 → 서버 설정 수정 + Capacitor 서버 설정 조정으로 해결.

**2. Safe Area 겹침**

다이나믹 아일랜드 + 노치 영역에 UI가 가려지는 문제.
「서브페이지 7곳 헤더에 safe-area-top 패딩 추가해줘.」
→ env(safe-area-inset-top) CSS 변수로 일괄 적용.

**3. 스플래시 → 앱 전환**

네이티브 스플래시(LaunchScreen) → 웹 스플래시(React) → 메인 UI.
순서 꼬이면 빈 화면이 깜빡임. 타이밍 조율에 시간 소요.


===========================
배운 점
===========================

1. **Capacitor Remote URL = 가장 빠른 MVP**
기존 웹앱 코드 변경 없이 iOS 앱 생성. 단, 오프라인 지원 불가.

2. **Claude Code + Xcode는 궁합이 좋다**
Xcode 빌드 에러, 심사 리젝 사유를 그대로 붙여넣으면 해결 방안 제시. Swift 코드도 알아서 수정.

3. **App Store 심사는 구체적으로**
"위치를 사용합니다"가 아니라 "근처 아침 카페를 찾기 위해 현재 위치를 사용합니다"처럼 구체적으로 써야 통과.

4. **CLAUDE.md에 네이티브 맥락 추가**
Capacitor 설정, 번들 ID, 심사 이력을 CLAUDE.md에 기록해두니 이후 작업에서 맥락 유지.


===========================
현재 상태
===========================

| 항목 | 숫자 |
|------|------|
| 서울 전체 카페 | 9,514개 |
| 얼리버드 카페 | 3,000+ |
| 24시간 카페 | 830+ |
| iOS 앱 버전 | 1.0.1 |
| 웹앱 | PWA 지원 |

웹: https://morning-cafe-phi.vercel.app/?utm_source=geekist&utm_medium=post&utm_campaign=ios_launch
iOS: App Store에서 "모닝카페" 검색

피드백 환영합니다!


===========================
도움 받은 글
===========================

• Capacitor 공식 문서: https://capacitorjs.com/docs
• Claude Code 공식 문서: https://docs.anthropic.com/en/docs/claude-code

---

## 게시 가이드

- **게시판**: 사례게시판 > 바이브코딩
- **타이밍**: 화~목 오전 10~11시
- **스크린샷 삽입 위치**: 본문 중 [스크린샷] 표시된 곳
- **기존 글과 간격**: 최소 2주
- **게시 후**: 첫 댓글에 "웹앱 → iOS 전환 과정에서 궁금한 거 편하게 물어보세요!" 달기
