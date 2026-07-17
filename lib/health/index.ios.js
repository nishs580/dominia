// lib/health/index.ios.js
// iOS implementation of the health-data facade — Phase 1 inert stubs
// (iOS_Plan.md, Phase 1 task 5). The app must boot on iOS with Activity
// features gracefully dark, not crash importing the Android-only
// react-native-health-connect module. Phase 2 replaces these stubs with a
// HealthKit-backed implementation.
//
// Return shapes mirror what callers already handle on Android when Health
// Connect is unavailable or ungranted:
// - lib/activity.js:       getSdkStatus ≠ SDK_AVAILABLE → producer stays dark
// - ActivityScreen:        initialize() false → hcReady stays false
// - ActiveClaimScreen:     getSdkStatus ≠ SDK_AVAILABLE → hcPermission 'denied'
// - HealthConnectDebugScreen: initialize() false → "not available" banner
//
// CommonJS like every Jest-covered lib module (the Jest config is plain node,
// no Babel transform); Metro's import interop handles the named imports.

// Same values as react-native-health-connect's constants — callers compare
// against these members, so the numbers must match the Android lib.
const SdkAvailabilityStatus = {
  SDK_UNAVAILABLE: 1,
  SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED: 2,
  SDK_AVAILABLE: 3,
};

async function initialize() {
  return false;
}

async function getSdkStatus() {
  return SdkAvailabilityStatus.SDK_UNAVAILABLE;
}

async function getGrantedPermissions() {
  return [];
}

async function requestPermission() {
  return [];
}

async function readRecords() {
  return { records: [] };
}

async function aggregateRecord() {
  return {};
}

async function aggregateGroupByDuration() {
  return [];
}

async function aggregateGroupByPeriod() {
  return [];
}

function openHealthConnectSettings() {}

module.exports = {
  SdkAvailabilityStatus,
  initialize,
  getSdkStatus,
  getGrantedPermissions,
  requestPermission,
  readRecords,
  aggregateRecord,
  aggregateGroupByDuration,
  aggregateGroupByPeriod,
  openHealthConnectSettings,
};
