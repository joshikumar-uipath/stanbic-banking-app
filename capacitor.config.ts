import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.uipath.aof.field',
  appName: 'Pulse',
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
    backgroundColor: '#FFFFFF',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 800,
      launchAutoHide: true,
      backgroundColor: '#FFFFFF',
      iosSpinnerStyle: 'small',
      showSpinner: false,
    },
    StatusBar: {
      style: 'dark',
      overlaysWebView: false,
      backgroundColor: '#FFFFFF',
    },
  },
};

export default config;
