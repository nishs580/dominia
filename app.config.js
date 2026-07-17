module.exports = {
  expo: {
    name: 'dominia',
    slug: 'dominia',
    version: '1.0.0',
    // Deep-link / OAuth redirect scheme (Clerk SSO redirects on both platforms).
    scheme: 'dominia',
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
      // A GPS walking game on iPad is a review/QA surface with zero upside.
      supportsTablet: false,
      // Android package (com.nish_s.dominia) has an underscore, illegal in an
      // iOS bundle ID — the two never have to match.
      bundleIdentifier: 'com.nishs.dominia',
      googleServicesFile: process.env.GOOGLE_SERVICES_INFO_PLIST ?? './GoogleService-Info.plist',
      infoPlist: {
        // Location strings come from the expo-location plugin below.
        NSMotionUsageDescription:
          'Dominia counts your steps live during territory claims and contest walks.',
        NSHealthShareUsageDescription:
          'Dominia reads your steps, distance and active calories to power territory claims and daily challenges.',
        // Standard HTTPS only — skips the App Store export-compliance questionnaire.
        ITSAppUsesNonExemptEncryption: false,
      },
      entitlements: {
        'com.apple.developer.healthkit': true,
      },
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
        'android.permission.health.READ_ACTIVE_CALORIES_BURNED',
        'android.permission.health.READ_DISTANCE',
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
      [
        '@rnmapbox/maps',
        {
          // iOS pod install needs the secret download token to fetch the
          // Mapbox SDK (Android gets it via the gradle property of the same name).
          RNMapboxMapsDownloadToken: process.env.MAPBOX_DOWNLOADS_TOKEN,
        },
      ],
      'expo-web-browser',
      [
        'expo-location',
        {
          locationAlwaysAndWhenInUsePermission: 'Dominia needs your location to track walks for territory claims.',
          locationWhenInUsePermission: 'Dominia needs your location to track walks for territory claims.',
          isAndroidBackgroundLocationEnabled: true,
          // UIBackgroundModes: location — keeps GPS alive during screen-locked
          // claim walks (iOS has no foreground services).
          isIosBackgroundLocationEnabled: true,
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
          ios: {
            // Mandatory for @react-native-firebase on iOS.
            useFrameworks: 'static',
            deploymentTarget: '15.1',
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
