import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.zara.assistant',
  appName: 'Zara AI',
  webDir: 'dist',
  // Force the WebView's initial URL — works around an iOS 26 simulator quirk
  // where Capacitor's default custom-scheme navigation can land on about:blank.
  server: {
    iosScheme: 'capacitor',
    hostname: 'localhost',
    androidScheme: 'https',
  },
  ios: {
    contentInset: 'never',
    limitsNavigationsToAppBoundDomains: false,
    backgroundColor: '#000000',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 800,
      launchAutoHide: true,
      backgroundColor: '#FCC9A2',
      iosSpinnerStyle: 'small',
      showSpinner: false,
    },
    StatusBar: {
      style: 'dark',
      overlaysWebView: false,
      backgroundColor: '#e8ebed',
    },
  },
};

export default config;
