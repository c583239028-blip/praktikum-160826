const APP_ENV = process.env.APP_ENV || 'development';

const envConfig = {
  development: {
    name: 'HyPulse (dev)',
    bundleIdentifier: 'com.hypulse.app',
    androidPackage: 'com.hypulse.app',
  },
  staging: {
    name: 'HyPulse (staging)',
    bundleIdentifier: 'com.hypulse.app',
    androidPackage: 'com.hypulse.app',
  },
  production: {
    name: 'HyPulse',
    bundleIdentifier: 'com.hypulse.app',
    androidPackage: 'com.hypulse.app',
  },
};

const env = envConfig[APP_ENV] || envConfig.development;

export default ({ config }) => ({
  ...config,
  name: env.name,
  plugins: [...(config.plugins ?? []), 'expo-localization', 'expo-video'],
  ios: {
    ...config.ios,
    bundleIdentifier: env.bundleIdentifier,
  },
  android: {
    ...config.android,
    package: env.androidPackage,
    // Cleartext (HTTP) is allowed only in development, for local server usage.
    // No automated test — to verify manually:
    // dev:  APP_ENV=development  npx expo config --type introspect  → usesCleartextTraffic: true
    // prod: APP_ENV=production   npx expo config --type introspect  →  the key is omitted entirely (not set to false — simply absent).
    ...(process.env.APP_ENV === 'development' && {
      usesCleartextTraffic: true,
    }),
  },
});
