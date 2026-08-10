/**
 * AdMob 배너 제어 (네이티브 앱 전용).
 *
 * 배너는 네이티브 뷰라서 웹뷰 위에 뜨지만, show/hide는 JS에서 라우트별로
 * 제어한다 — 지면 정책(가이드/목록/상세만, 지도 금지)을 웹과 동일하게 유지.
 * 플러그인은 dynamic import로 네이티브에서 실제 호출될 때만 로드한다.
 *
 * 현재 광고 ID는 **구글 공식 테스트 ID** — AdMob 계정에서 앱 등록 후
 * 아래 상수와 ios/App/App/Info.plist의 GADApplicationIdentifier를 교체할 것.
 */
import { isNativeApp } from '@/lib/capacitor';

// 구글 공식 iOS 배너 테스트 광고단위. 실계정 발급 후 교체.
const BANNER_AD_ID = 'ca-app-pub-3940256099942544/2934735716';

/** BottomNav(h-14=56pt) 바로 위에 배너를 띄우기 위한 마진 */
const BANNER_MARGIN_PT = 56;

let created = false;
let initialized = false;

async function getAdMob() {
  return import('@capacitor-community/admob');
}

export async function showAdmobBanner(): Promise<void> {
  if (!isNativeApp()) return;
  try {
    const { AdMob, BannerAdSize, BannerAdPosition } = await getAdMob();
    if (!initialized) {
      await AdMob.initialize();
      initialized = true;
    }
    if (created) {
      await AdMob.resumeBanner();
      return;
    }
    await AdMob.showBanner({
      adId: BANNER_AD_ID,
      adSize: BannerAdSize.ADAPTIVE_BANNER,
      position: BannerAdPosition.BOTTOM_CENTER,
      margin: BANNER_MARGIN_PT,
      // 비개인화 광고 — ATT 프롬프트/IDFA 선언 없이 운영 (수익률 낮지만 심사 리스크 0)
      npa: true,
    });
    created = true;
  } catch {
    // 광고 로드 실패는 앱 기능에 영향을 주면 안 됨 — 조용히 무시
  }
}

export async function hideAdmobBanner(): Promise<void> {
  if (!isNativeApp() || !created) return;
  try {
    const { AdMob } = await getAdMob();
    await AdMob.hideBanner();
  } catch {
    // ignore
  }
}
