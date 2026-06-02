import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.morningcafe.app',
  appName: '모닝커피',
  webDir: 'public',
  server: {
    url: 'https://morning-cafe-phi.vercel.app',
    cleartext: false,
  },
  ios: {
    scheme: 'Morning Cafe',
    contentInset: 'always',
    allowsLinkPreview: false,
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: false,
      backgroundColor: '#FFF8F0',
      showSpinner: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#FFF8F0',
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_icon',
      iconColor: '#F59E0B',
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
