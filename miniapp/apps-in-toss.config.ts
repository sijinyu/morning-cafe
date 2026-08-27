import { defineConfig } from '@apps-in-toss/web-framework/config';

/**
 * 앱인토스 미니앱 설정.
 * appName은 앱인토스 콘솔에 등록한 앱 이름과 반드시 일치해야 한다.
 * 딥링크: intoss://morning-cafe
 */
export default defineConfig({
  appName: 'morning-cafe',
  brand: {
    primaryColor: '#E8554E', // 토마토 코랄 (본 서비스 브랜드 컬러)
  },
  permissions: [
    { name: 'geolocation', access: 'access' }, // 내 주변 아침 카페 거리순 정렬
  ],
  webBundleDir: 'dist',
});
