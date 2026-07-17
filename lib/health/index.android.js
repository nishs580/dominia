// lib/health/index.android.js
// Android implementation of the health-data facade.
//
// This file is the ONLY place in the app allowed to import
// 'react-native-health-connect': the package ships no iOS native module, so
// importing it from shared code crashes the iOS bundle at TurboModule
// resolution (iOS_Plan.md §1.5-A). Everything else imports 'lib/health' and
// Metro picks this file on Android, index.ios.js on iOS.
export {
  initialize,
  getSdkStatus,
  getGrantedPermissions,
  requestPermission,
  readRecords,
  aggregateRecord,
  aggregateGroupByDuration,
  aggregateGroupByPeriod,
  openHealthConnectSettings,
  SdkAvailabilityStatus,
} from 'react-native-health-connect';
