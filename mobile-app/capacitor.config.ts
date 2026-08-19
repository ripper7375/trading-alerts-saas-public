import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.davintrade.app',
  appName: 'DavinTrade',
  webDir: 'dist',
  server: {
    // Points to production backend/app URL for API sync & updates when live
    url: 'https://app.davintrade.com',
    cleartext: false,
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#090d16',
      showSpinner: false,
    },
    StatusBar: {
      backgroundColor: '#090d16',
      style: 'DARK',
    },
  },
};

export default config;
