import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.morningcafe.app',
  appName: '모닝카페',
  webDir: 'public',
  server: {
    url: 'https://morning-cafe-phi.vercel.app',
    cleartext: false,
  },
  ios: {
    allowsLinkPreview: false,
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 2000,
      backgroundColor: '#FFF8F0',
      showSpinner: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#FFF8F0',
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_icon',
      iconColor: '#E8554E',
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
