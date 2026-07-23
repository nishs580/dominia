/**
 * lib/__tests__/claimVehicleFilter.test.js
 *
 * Guards the anti-false-positive vehicle filter on the active-claim walk.
 * Players walking between buildings were being flagged as "VEHICLE DETECTED",
 * which excluded their real steps and froze claim progress.
 */

const fs = require('fs');
const path = require('path');

// lib/claim.js is ESM and pulls in supabase; there is no Babel transform in
// this Jest setup, so load it the way the other lib tests do — strip the I/O
// imports and the export keywords, then eval the pure math.
function loadClaim() {
  let source = fs.readFileSync(path.join(__dirname, '..', 'claim.js'), 'utf8');
  source = source
    .replace(/import \{ supabase \} from '\.\/supabase';/, '')
    .replace(/import \{[^}]*\} from '\.\/meApi';/, '')
    .replace(/export async function/g, 'async function')
    .replace(/export function/g, 'function')
    .replace(/export const/g, 'const');
  source += '\nreturn { speedSampleKmh, nextVehicleState, isVehicleSpeed, CLAIM_CONSTANTS };';
  // eslint-disable-next-line no-new-func
  return new Function(source)();
}

const { speedSampleKmh, nextVehicleState, CLAIM_CONSTANTS } = loadClaim();

const METRES_PER_DEG_LAT = 111320;

// A fix `metresNorth` from the origin, `msAgo` before `t0`.
function fixAt({ metresNorth = 0, timestamp, accuracy = 10, speed }) {
  return {
    latitude: 12.9716 + metresNorth / METRES_PER_DEG_LAT,
    longitude: 77.5946,
    accuracy,
    timestamp,
    speed,
  };
}

describe('speedSampleKmh', () => {
  test('prefers the OS/Doppler speed when present', () => {
    // 1.4 m/s is a brisk walk → ~5 km/h, nowhere near the 25 km/h cap.
    const fix = fixAt({ timestamp: 10_000, speed: 1.4 });
    expect(speedSampleKmh(null, fix)).toBeCloseTo(5.04, 2);
  });

  test('uses OS speed even for genuine vehicle motion', () => {
    const fix = fixAt({ timestamp: 10_000, speed: 15 }); // 54 km/h
    expect(speedSampleKmh(null, fix)).toBeCloseTo(54, 2);
  });

  test('ignores a negative OS speed (Android sentinel for unavailable)', () => {
    // No usable prev fix either → unknown, not a bogus number.
    const fix = fixAt({ timestamp: 10_000, speed: -1 });
    expect(speedSampleKmh(null, fix)).toBeNull();
  });

  test('REGRESSION: rejects jitter across a too-short gap', () => {
    // The exact false positive players hit: 15 m of GPS wander in 1 s
    // differences out to 54 km/h and used to read as a vehicle.
    const prev = fixAt({ metresNorth: 0, timestamp: 10_000 });
    const next = fixAt({ metresNorth: 15, timestamp: 11_000 });
    expect(speedSampleKmh(prev, next)).toBeNull();
  });

  test('rejects a pair when either fix is too inaccurate', () => {
    const prev = fixAt({ metresNorth: 0, timestamp: 10_000, accuracy: 60 });
    const next = fixAt({ metresNorth: 5, timestamp: 14_000, accuracy: 10 });
    expect(speedSampleKmh(prev, next)).toBeNull();
  });

  test('accepts a well-separated, accurate pair at walking pace', () => {
    const prev = fixAt({ metresNorth: 0, timestamp: 10_000 });
    const next = fixAt({ metresNorth: 5, timestamp: 14_000 }); // 5 m / 4 s
    expect(speedSampleKmh(prev, next)).toBeCloseTo(4.5, 1);
  });

  test('still detects a real vehicle from positional differencing', () => {
    const prev = fixAt({ metresNorth: 0, timestamp: 10_000 });
    const next = fixAt({ metresNorth: 45, timestamp: 14_000 }); // ~40 km/h
    expect(speedSampleKmh(prev, next)).toBeGreaterThan(CLAIM_CONSTANTS.VEHICLE_SPEED_KMH);
  });
});

describe('nextVehicleState', () => {
  const clear = { hits: 0, inVehicle: false };

  test('a single over-cap spike does not raise the flag', () => {
    const s = nextVehicleState(clear, 60);
    expect(s.inVehicle).toBe(false);
    expect(s.hits).toBe(1);
  });

  test('raises only after sustained over-cap samples', () => {
    let s = clear;
    for (let i = 0; i < CLAIM_CONSTANTS.VEHICLE_CONSECUTIVE_HITS; i += 1) {
      s = nextVehicleState(s, 60);
    }
    expect(s.inVehicle).toBe(true);
  });

  test('one walking sample clears an accumulating run', () => {
    let s = nextVehicleState(nextVehicleState(clear, 60), 60);
    expect(s.hits).toBe(2);
    s = nextVehicleState(s, 5);
    expect(s).toEqual(clear);
  });

  test('REGRESSION: an unknown reading clears the flag, never holds it', () => {
    // Previously a spurious spike followed by GPS going quiet left the flag
    // raised forever, excluding every real step and wedging the claim.
    let s = clear;
    for (let i = 0; i < CLAIM_CONSTANTS.VEHICLE_CONSECUTIVE_HITS; i += 1) {
      s = nextVehicleState(s, 60);
    }
    expect(s.inVehicle).toBe(true);
    expect(nextVehicleState(s, null)).toEqual(clear);
  });

  test('tolerates a missing prev state', () => {
    expect(nextVehicleState(undefined, 5)).toEqual(clear);
  });
});
