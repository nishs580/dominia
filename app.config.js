module.exports = {
  expo: {
    name: 'dominia',
    slug: 'dominia',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    newArchEnabled: true,
    splash: {
      image: './assets/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#ffffff',
    },
    ios: {
      supportsTablet: true,
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#ffffff',
      },
      edgeToEdgeEnabled: true,
      package: 'com.nish_s.dominia',
      googleServicesFile: process.env.GOOGLE_SERVICES_JSON ?? './google-services.json',
      permissions: [
        'ACCESS_FINE_LOCATION',
        'ACCESS_COARSE_LOCATION',
        'ACCESS_BACKGROUND_LOCATION',
        'POST_NOTIFICATIONS',
        'android.permission.health.READ_STEPS',
        'android.permission.ACTIVITY_RECOGNITION',
        'android.permission.FOREGROUND_SERVICE',
        'android.permission.FOREGROUND_SERVICE_LOCATION',
      ],
    },
    web: {
      favicon: './assets/favicon.png',
    },
    plugins: [
      './plugins/withHealthConnect',
      '@react-native-firebase/app',
      '@rnmapbox/maps',
      'expo-web-browser',
      [
        'expo-location',
        {
          locationAlwaysAndWhenInUsePermission: 'Dominia needs your location to track walks for territory claims.',
          locationWhenInUsePermission: 'Dominia needs your location to track walks for territory claims.',
          isAndroidBackgroundLocationEnabled: true,
          isIosBackgroundLocationEnabled: false,
        },
      ],
      'expo-sensors',
      'expo-localization',
      [
        'expo-image-picker',
        {
          photosPermission: 'Dominia needs photo access so you can set a profile picture.',
        },
      ],
      [
        'expo-build-properties',
        {
          android: {
            minSdkVersion: 26,
          },
        },
      ],
    ],
    extra: {
      eas: {
        projectId: 'a102d35e-f0f0-4753-8a80-a7d6b438bcaf',
      },
    },
  },
};
