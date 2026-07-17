/**
 * lib/__tests__/health.ios.test.js
 *
 * Phase 1 iOS facade stubs (iOS_Plan.md): the app must boot on iOS with
 * Activity features gracefully dark. These tests pin the inert contract the
 * callers rely on — producer stays dark, screens read "unavailable"/empty —
 * and the SdkAvailabilityStatus values, which must match the Android lib's
 * constants (react-native-health-connect/lib/module/constants.js).
 *
 * Imported by explicit path: the Jest config is plain node (no jest-expo
 * platform resolution), and index.android.js can't load here anyway — it
 * imports the native module.
 */

const ios = require('../health/index.ios');

describe('lib/health iOS stubs', () => {
  test('SdkAvailabilityStatus values match react-native-health-connect', () => {
    expect(ios.SdkAvailabilityStatus).toEqual({
      SDK_UNAVAILABLE: 1,
      SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED: 2,
      SDK_AVAILABLE: 3,
    });
  });

  test('initialize resolves false (screens keep hcReady=false)', async () => {
    await expect(ios.initialize()).resolves.toBe(false);
  });

  test('getSdkStatus resolves SDK_UNAVAILABLE (producer stays dark)', async () => {
    await expect(ios.getSdkStatus()).resolves.toBe(
      ios.SdkAvailabilityStatus.SDK_UNAVAILABLE,
    );
  });

  test('permission calls resolve to empty grants', async () => {
    await expect(ios.getGrantedPermissions()).resolves.toEqual([]);
    await expect(ios.requestPermission([{ accessType: 'read', recordType: 'Steps' }])).resolves.toEqual([]);
  });

  test('readRecords resolves { records: [] }', async () => {
    await expect(ios.readRecords('Steps', {})).resolves.toEqual({ records: [] });
  });

  test('aggregateRecord resolves an empty object (null-safe field access)', async () => {
    const result = await ios.aggregateRecord({ recordType: 'Steps' });
    expect(result).toEqual({});
    expect(Number(result?.COUNT_TOTAL) || 0).toBe(0);
    expect(Number(result?.DISTANCE?.inMeters) || 0).toBe(0);
  });

  test('aggregate group queries resolve to empty arrays', async () => {
    await expect(ios.aggregateGroupByDuration({})).resolves.toEqual([]);
    await expect(ios.aggregateGroupByPeriod({})).resolves.toEqual([]);
  });

  test('openHealthConnectSettings is a safe no-op', () => {
    expect(() => ios.openHealthConnectSettings()).not.toThrow();
  });
});
