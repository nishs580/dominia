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
  source += '\nreturn { speedSampleKmh, nextVehicleState, cadenceSpmFrom, isVehicleSpeed, CLAIM_CONSTANTS };';
  // eslint-disable-next-line no-new-func
  return new Function(source)();
}

const { speedSampleKmh, nextVehicleState, cadenceSpmFrom, CLAIM_CONSTANTS } = loadClaim();
const { VEHICLE_SUSTAIN_MS, WALKING_CADENCE_MIN_SPM } = CLAIM_CONSTANTS;

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

  test('REGRESSION: ignores OS speed on a weak fix (indoor cold-start false positive)', () => {
    // The exact on-device flag: a stationary tester on a weak indoor fix
    // (accuracy 60 m) got a spurious 43 km/h Doppler reading, which used to
    // sail past the accuracy gate because the OS-speed path skipped it, and
    // paused the walk as "vehicle detected". A weak fix must read as unknown.
    const fix = fixAt({ timestamp: 10_000, accuracy: 60, speed: 12 });
    expect(speedSampleKmh(null, fix)).toBeNull();
  });

  test('still trusts OS speed on a fix at the accuracy boundary', () => {
    // 25 m is the usable-accuracy bar; a fix exactly at it is still trusted.
    const fix = fixAt({ timestamp: 10_000, accuracy: 25, speed: 1.4 });
    expect(speedSampleKmh(null, fix)).toBeCloseTo(5.04, 2);
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

  test('an implausible OS reading is noise, not a fast vehicle', () => {
    // 80 m/s = 288 km/h. No walk produces this; the fix is broken. Returning
    // it as unknown means it CLEARS the filter rather than incriminating.
    const fix = fixAt({ timestamp: 10_000, speed: 80 });
    expect(speedSampleKmh(null, fix)).toBeNull();
  });

  test('an implausible differenced reading is noise too', () => {
    const prev = fixAt({ metresNorth: 0, timestamp: 10_000 });
    const next = fixAt({ metresNorth: 400, timestamp: 14_000 }); // 360 km/h
    expect(speedSampleKmh(prev, next)).toBeNull();
  });

  test('a genuine highway speed is still reported, not discarded', () => {
    const fix = fixAt({ timestamp: 10_000, speed: 30 }); // 108 km/h
    expect(speedSampleKmh(null, fix)).toBeCloseTo(108, 2);
  });
});

describe('cadenceSpmFrom', () => {
  test('null until the observation window is long enough to mean anything', () => {
    const history = [{ at: 0, steps: 0 }];
    expect(cadenceSpmFrom(history, 20, 5_000)).toBeNull();
  });

  test('reads steps per minute across the window', () => {
    const history = [{ at: 0, steps: 100 }];
    // 55 steps in 30 s = 110 spm — an ordinary brisk walk.
    expect(cadenceSpmFrom(history, 155, 30_000)).toBe(110);
  });

  test('null on an empty or malformed history', () => {
    expect(cadenceSpmFrom([], 10, 30_000)).toBeNull();
    expect(cadenceSpmFrom(null, 10, 30_000)).toBeNull();
    expect(cadenceSpmFrom([{ at: null, steps: 0 }], 10, 30_000)).toBeNull();
  });
});

describe('nextVehicleState', () => {
  const clear = { overCapSince: null, inVehicle: false };
  const T = 100_000;

  // Hold an over-cap reading for `ms`, sampling every 3 s (the GPS cadence),
  // with a final sample landing exactly on the boundary under test.
  function sustainOverCap(ms, { from = clear, cadenceSpm, startAt = T } = {}) {
    let s = from;
    for (let elapsed = 0; elapsed < ms; elapsed += 3_000) {
      s = nextVehicleState(s, 60, { nowMs: startAt + elapsed, cadenceSpm });
    }
    return nextVehicleState(s, 60, { nowMs: startAt + ms, cadenceSpm });
  }

  test('a single over-cap spike does not raise the flag', () => {
    const s = nextVehicleState(clear, 60, { nowMs: T });
    expect(s.inVehicle).toBe(false);
    expect(s.overCapSince).toBe(T);
  });

  test('does not raise before the sustain window has elapsed', () => {
    const s = sustainOverCap(VEHICLE_SUSTAIN_MS - 3_000);
    expect(s.inVehicle).toBe(false);
  });

  test('raises once over-cap evidence has held for the sustain window', () => {
    expect(sustainOverCap(VEHICLE_SUSTAIN_MS).inVehicle).toBe(true);
  });

  test('one walking-speed sample breaks a building run', () => {
    const building = sustainOverCap(VEHICLE_SUSTAIN_MS - 6_000);
    expect(building.overCapSince).toBe(T);
    expect(nextVehicleState(building, 5, { nowMs: T + 20_000 })).toEqual(clear);
  });

  test('REGRESSION: an unknown reading clears the flag, never holds it', () => {
    // Previously a spurious spike followed by GPS going quiet left the flag
    // raised forever, excluding every real step and wedging the claim.
    const raised = sustainOverCap(VEHICLE_SUSTAIN_MS);
    expect(raised.inVehicle).toBe(true);
    expect(nextVehicleState(raised, null, { nowMs: T + 30_000 })).toEqual(clear);
  });

  test('REGRESSION: unknown readings break the run instead of being skipped', () => {
    // The urban-canyon false positive: spikes separated by weak-GPS gaps used
    // to accumulate toward a verdict because nulls never reached the filter.
    // A null between spikes must reset the clock, so the run restarts.
    let s = sustainOverCap(VEHICLE_SUSTAIN_MS - 6_000);
    s = nextVehicleState(s, null, { nowMs: T + 15_000 });
    expect(s).toEqual(clear);
    s = nextVehicleState(s, 60, { nowMs: T + 18_000 });
    expect(s.inVehicle).toBe(false);
    expect(s.overCapSince).toBe(T + 18_000);
  });

  test('walking cadence vetoes a fast GPS reading outright', () => {
    // The whole point of the fusion layer: feet on the ground beat the
    // noisiest sensor on the device, however long it has been shouting.
    const s = sustainOverCap(VEHICLE_SUSTAIN_MS * 2, { cadenceSpm: 110 });
    expect(s).toEqual(clear);
  });

  test('cadence returning drops an already-raised flag immediately', () => {
    const raised = sustainOverCap(VEHICLE_SUSTAIN_MS);
    expect(raised.inVehicle).toBe(true);
    const vetoed = nextVehicleState(raised, 60, {
      nowMs: T + 30_000,
      cadenceSpm: WALKING_CADENCE_MIN_SPM,
    });
    expect(vetoed).toEqual(clear);
  });

  test('a passenger jostle below the cadence floor does not veto', () => {
    const s = sustainOverCap(VEHICLE_SUSTAIN_MS, {
      cadenceSpm: WALKING_CADENCE_MIN_SPM - 1,
    });
    expect(s.inVehicle).toBe(true);
  });

  test('unknown cadence vetoes nothing', () => {
    expect(sustainOverCap(VEHICLE_SUSTAIN_MS, { cadenceSpm: null }).inVehicle).toBe(true);
  });

  test('tolerates a missing prev state and missing context', () => {
    expect(nextVehicleState(undefined, 5)).toEqual(clear);
    expect(nextVehicleState(null, null)).toEqual(clear);
  });
});
