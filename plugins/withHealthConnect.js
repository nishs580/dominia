const { withMainActivity, withAndroidManifest } = require('@expo/config-plugins');
const { mergeContents } = require('@expo/config-plugins/build/utils/generateCode');

const HEALTH_CONNECT_IMPORT = 'import dev.matinzd.healthconnect.permissions.HealthConnectPermissionDelegate';
const HEALTH_CONNECT_DELEGATE_CALL = '    HealthConnectPermissionDelegate.setPermissionDelegate(this)';

/**
 * Inject HealthConnectPermissionDelegate.setPermissionDelegate(this) into MainActivity.kt onCreate.
 * Required for react-native-health-connect v3.x to work on New Architecture (Expo SDK 54+).
 * See: https://github.com/matinzd/react-native-health-connect/issues/214
 */
const withMainActivityFix = (config) => {
  return withMainActivity(config, (config) => {
    let contents = config.modResults.contents;

    // Add the import after the package declaration if not already present
    if (!contents.includes(HEALTH_CONNECT_IMPORT)) {
      contents = contents.replace(
        /(package .+)/,
        `$1\n\n${HEALTH_CONNECT_IMPORT}`
      );
    }

    // Inject setPermissionDelegate call after super.onCreate(savedInstanceState)
    const merged = mergeContents({
      src: contents,
      newSrc: HEALTH_CONNECT_DELEGATE_CALL,
      tag: 'health-connect-delegate-init',
      anchor: /super\.onCreate\(.+?\)/,
      offset: 1,
      comment: '//',
    });

    if (merged.didMerge || merged.didClear) {
      config.modResults.contents = merged.contents;
    }

    return config;
  });
};

/**
 * Add Health Connect manifest entries:
 * 1. PermissionsRationaleActivity
 * 2. ViewPermissionUsageActivity activity-alias (Android 14+ requirement)
 * 3. com.google.android.apps.healthdata package query
 */
const withManifestFix = (config) => {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    const application = manifest.application?.[0];
    if (!application) return config;

    // Add <queries> for Health Connect package
    manifest.queries = manifest.queries || [];
    const hasHealthDataQuery = manifest.queries.some((q) =>
      q.package?.some((p) => p.$['android:name'] === 'com.google.android.apps.healthdata')
    );
    if (!hasHealthDataQuery) {
      manifest.queries.push({
        package: [{ $: { 'android:name': 'com.google.android.apps.healthdata' } }],
      });
    }

    // Add PermissionsRationaleActivity if not present
    application.activity = application.activity || [];
    const hasRationaleActivity = application.activity.some(
      (a) => a.$['android:name'] === '.PermissionsRationaleActivity'
    );
    if (!hasRationaleActivity) {
      application.activity.push({
        $: {
          'android:name': '.PermissionsRationaleActivity',
          'android:exported': 'true',
        },
        'intent-filter': [
          {
            action: [{ $: { 'android:name': 'androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE' } }],
          },
        ],
      });
    }

    // Add ViewPermissionUsageActivity activity-alias (Android 14+)
    application['activity-alias'] = application['activity-alias'] || [];
    const hasViewUsageAlias = application['activity-alias'].some(
      (a) => a.$['android:name'] === 'ViewPermissionUsageActivity'
    );
    if (!hasViewUsageAlias) {
      application['activity-alias'].push({
        $: {
          'android:name': 'ViewPermissionUsageActivity',
          'android:exported': 'true',
          'android:targetActivity': '.MainActivity',
          'android:permission': 'android.permission.START_VIEW_PERMISSION_USAGE',
        },
        'intent-filter': [
          {
            action: [{ $: { 'android:name': 'android.intent.action.VIEW_PERMISSION_USAGE' } }],
            category: [{ $: { 'android:name': 'android.intent.category.HEALTH_PERMISSIONS' } }],
          },
        ],
      });
    }

    // Add MainActivity intent-filter for permissions rationale
    const mainActivity = application.activity.find(
      (a) => a.$['android:name'] === '.MainActivity'
    );
    if (mainActivity) {
      mainActivity['intent-filter'] = mainActivity['intent-filter'] || [];
      const hasRationaleFilter = mainActivity['intent-filter'].some((f) =>
        f.action?.some((a) => a.$['android:name'] === 'androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE')
      );
      if (!hasRationaleFilter) {
        mainActivity['intent-filter'].push({
          action: [{ $: { 'android:name': 'androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE' } }],
        });
      }
    }

    return config;
  });
};

module.exports = (config) => withManifestFix(withMainActivityFix(config));
