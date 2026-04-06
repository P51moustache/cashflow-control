import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Cashflow Control',
  slug: 'cashflow-control',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'cashflowcontrol',
  userInterfaceStyle: 'automatic',
  newArchEnabled: true,
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.cashflowcontrol.app',
    buildNumber: '1',
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    adaptiveIcon: {
      backgroundColor: '#0d9488',
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
  },
  web: {
    output: 'static',
    favicon: './assets/images/favicon.png',
  },
  plugins: [
    'expo-router',
    [
      'expo-splash-screen',
      {
        image: './assets/images/splash-icon.png',
        imageWidth: 200,
        resizeMode: 'contain',
        backgroundColor: '#0d9488',
        dark: {
          backgroundColor: '#134e4a',
        },
      },
    ],
    'expo-sqlite',
    '@react-native-community/datetimepicker',
    'expo-secure-store',
    ...(process.env.EXPO_PUBLIC_SENTRY_DSN
      ? [
          [
            '@sentry/react-native',
            {
              organization: process.env.SENTRY_ORG ?? '',
              project: process.env.SENTRY_PROJECT ?? '',
            },
          ] as const,
        ]
      : []),
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  extra: {
    ...config.extra,
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    router: {},
    eas: {
      projectId: '1a0b25d2-e7c8-4190-babf-a988620f4de5',
    },
  },
  owner: 'zlce',
});
