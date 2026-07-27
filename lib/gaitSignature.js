// lib/gaitSignature.js
// Accelerometer gait-signature analysis: does this motion look like a human
// walking, or like a phone being shaken to manufacture steps?
//
// The hardware step counter can be fooled by rhythmic shaking — it is designed
// to detect a periodic impulse, and a hand can produce one. The raw
// accelerometer stream cannot be fooled the same way, because human gait has a
// specific signature that shaking does not reproduce:
//
//   * Frequency band. Step cadence spans roughly 0.5-3.2 Hz (30-190 steps/min)
//     from a slow amble to a sprint. Shaking hard enough to be worth doing
//     usually sits well above that.
//   * Vertical dominance. Walking energy concentrates along the gravity axis
//     (the body's centre of mass rising and falling on each footfall).
//   * Bounded amplitude. A body cannot accelerate its own mass arbitrarily
//     hard; a wrist can.
//   * Orientation stability. A phone carried by a walker keeps a roughly
//     constant attitude relative to gravity; a shaken one tumbles.
//   * Cross-modal agreement. The accelerometer's fundamental must match the
//     cadence the step counter is claiming. This is the hardest one to beat:
//     it requires the fake motion to be gait-like in the very dimension the
//     cheat is trying to exaggerate.
//
// DESIGN BIAS: this module answers 'unknown' whenever it is unsure. A false
// 'implausible' silently steals a real player's walk — the exact failure this
// codebase has already been burned by twice (see the vehicle filter). Only
// motion that is both energetic AND clearly non-gait is ever called out.
//
// Units are g throughout (expo-sensors reports multiples of gravity), so a
// resting device reads magnitude ~1.0.

export const GAIT_CONSTANTS = {
  SAMPLE_HZ: 25,
  WINDOW_MS: 5000,
  /** Fraction of the window that must be present before a verdict is offered. */
  MIN_WINDOW_FILL: 0.8,
  /** EMA weight for the gravity estimate. At 25 Hz this is a ~0.8 s time
   *  constant (~0.2 Hz corner) — well below the gait band, so gravity tracks
   *  posture without absorbing footfalls. */
  GRAVITY_ALPHA: 0.95,

  GAIT_FREQ_MIN_HZ: 0.5,
  GAIT_FREQ_MAX_HZ: 3.2,
  /** Autocorrelation strength below which motion is not meaningfully periodic. */
  PERIODICITY_MIN: 0.35,
  /** Below this RMS the device is essentially still; no verdict either way. */
  ACTIVE_RMS_MIN_G: 0.03,
  /** Vertical peak-to-peak beyond this exceeds what a body produces — running
   *  tops out around 3-4 g, so this leaves generous headroom. */
  SHAKE_PEAK_TO_PEAK_G: 6.0,
  /** Horizontal:vertical RMS ratio above which the motion is not body bounce.
   *  Generous — a secondary signal, not a primary one. */
  HORIZ_DOMINANCE_MAX: 3.0,
  /** Gravity-vector swing across the window, in degrees. */
  TUMBLE_DEG_MAX: 70,
  /** Relative tolerance when matching the accelerometer fundamental against
   *  the step counter's claimed cadence. Kept tight on purpose: the allowed
   *  ratios must land in DISJOINT bands, and at 0.4 they merged into one
   *  continuous range that accepted almost any frequency. */
  CADENCE_MATCH_TOLERANCE: 0.2,
};

const {
  SAMPLE_HZ,
  WINDOW_MS,
  MIN_WINDOW_FILL,
  GRAVITY_ALPHA,
  GAIT_FREQ_MIN_HZ,
  GAIT_FREQ_MAX_HZ,
  PERIODICITY_MIN,
  ACTIVE_RMS_MIN_G,
  SHAKE_PEAK_TO_PEAK_G,
  HORIZ_DOMINANCE_MAX,
  TUMBLE_DEG_MAX,
  CADENCE_MATCH_TOLERANCE,
} = GAIT_CONSTANTS;

// ─── Vector helpers ────────────────────────────────────────────────────────

function norm(v) {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
}

function dot(a, b) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

/** Angle between two vectors in degrees, or null if either has no direction. */
export function angleBetweenDeg(a, b) {
  const na = norm(a);
  const nb = norm(b);
  if (!(na > 0) || !(nb > 0)) return null;
  const cos = Math.max(-1, Math.min(1, dot(a, b) / (na * nb)));
  return (Math.acos(cos) * 180) / Math.PI;
}

// ─── Autocorrelation ───────────────────────────────────────────────────────

/**
 * Dominant period of a signal by normalised autocorrelation, searched across
 * the lag range the gait band implies.
 *
 * Normalisation divides out the shrinking overlap at longer lags, so a clean
 * oscillation scores ~1.0 whatever its frequency — otherwise slow walkers
 * would look less periodic than fast ones purely as an artefact.
 *
 * Returns { lag, strength } with a parabolically interpolated lag, or null.
 */
export function dominantPeriod(signal, minLag, maxLag) {
  const n = signal.length;
  if (n === 0 || minLag < 1 || maxLag < minLag || maxLag >= n) return null;

  let mean = 0;
  for (const v of signal) mean += v;
  mean /= n;

  let energy = 0;
  for (const v of signal) energy += (v - mean) * (v - mean);
  if (!(energy > 0)) return null;

  const scores = new Array(maxLag - minLag + 1);
  let bestScore = -Infinity;

  for (let lag = minLag; lag <= maxLag; lag += 1) {
    let sum = 0;
    for (let i = 0; i + lag < n; i += 1) {
      sum += (signal[i] - mean) * (signal[i + lag] - mean);
    }
    // Un-taper: compensate for the (n - lag) overlap shrinking with lag, so
    // periodicity is comparable across the band rather than penalising slow
    // walkers for having longer periods.
    const score = (sum / energy) * (n / (n - lag));
    scores[lag - minLag] = score;
    if (score > bestScore) bestScore = score;
  }

  if (!Number.isFinite(bestScore)) return null;

  // Take the FIRST qualifying local maximum, not the global one. Every integer
  // multiple of the true period also peaks, and the un-taper leaves the later
  // ones fractionally taller — picking the global max would report a half or a
  // third of the real frequency. The fundamental is the earliest strong peak.
  const qualifying = 0.75 * bestScore;
  let bestIdx = -1;
  for (let idx = 1; idx < scores.length - 1; idx += 1) {
    if (scores[idx] >= qualifying &&
        scores[idx] > scores[idx - 1] &&
        scores[idx] >= scores[idx + 1]) {
      bestIdx = idx;
      break;
    }
  }
  if (bestIdx < 0) return null;
  bestScore = scores[bestIdx];

  // Parabolic interpolation for sub-sample lag precision — at 25 Hz a whole
  // sample is a coarse step at the top of the gait band.
  let refined = bestIdx + minLag;
  const prev = scores[bestIdx - 1];
  const next = scores[bestIdx + 1];
  if (prev !== undefined && next !== undefined) {
    const denom = prev - 2 * bestScore + next;
    if (denom !== 0) {
      const shift = (0.5 * (prev - next)) / denom;
      if (Math.abs(shift) <= 1) refined += shift;
    }
  }

  return { lag: refined, strength: bestScore };
}

// ─── Feature extraction ────────────────────────────────────────────────────

/**
 * Features of one analysis window.
 *
 * `vertical` is linear acceleration projected onto gravity, `horizontal` the
 * magnitude perpendicular to it — both with gravity itself already removed.
 */
export function extractFeatures(vertical, horizontal, tumbleDeg, sampleHz = SAMPLE_HZ) {
  const n = vertical.length;
  if (n === 0) return null;

  let vSumSq = 0;
  let hSumSq = 0;
  let vMin = Infinity;
  let vMax = -Infinity;
  for (let i = 0; i < n; i += 1) {
    const v = vertical[i];
    vSumSq += v * v;
    hSumSq += horizontal[i] * horizontal[i];
    if (v < vMin) vMin = v;
    if (v > vMax) vMax = v;
  }

  const verticalRms = Math.sqrt(vSumSq / n);
  const horizontalRms = Math.sqrt(hSumSq / n);

  // Lag bounds straddle the gait band, with headroom above it so a too-fast
  // oscillation is measured rather than clipped to the edge and mistaken for
  // a fast walk.
  const minLag = Math.max(1, Math.floor(sampleHz / (GAIT_FREQ_MAX_HZ * 2.5)));
  const maxLag = Math.min(n - 1, Math.ceil(sampleHz / GAIT_FREQ_MIN_HZ));
  const peak = dominantPeriod(vertical, minLag, maxLag);

  return {
    verticalRms,
    horizontalRms,
    peakToPeakG: vMax - vMin,
    dominantFreqHz: peak ? sampleHz / peak.lag : null,
    periodicity: peak ? peak.strength : null,
    tumbleDeg,
    sampleCount: n,
  };
}

/**
 * True when `freqHz` plausibly corresponds to `stepFreqHz`.
 *
 * Accepts the stride (half cadence) as well as the step fundamental:
 * autocorrelation on real gait frequently locks onto the stride period,
 * because left and right footfalls are never identical and a phone in a
 * pocket also picks up the thigh swing, which cycles once per stride.
 * Rejecting that would flag ordinary walkers.
 *
 * Double cadence is deliberately NOT accepted — there is no physical source
 * for it. Body mass rises and falls once per footfall, so no real gait puts
 * its fundamental at twice the step rate.
 */
export function matchesCadence(freqHz, stepFreqHz, tolerance = CADENCE_MATCH_TOLERANCE) {
  if (!Number.isFinite(freqHz) || !Number.isFinite(stepFreqHz) || stepFreqHz <= 0) {
    return true; // nothing to contradict
  }
  return [0.5, 1].some((ratio) => {
    const expected = stepFreqHz * ratio;
    return Math.abs(freqHz - expected) / expected <= tolerance;
  });
}

// ─── Classification ────────────────────────────────────────────────────────

/**
 * Verdict for one window: 'walking' | 'implausible' | 'unknown'.
 *
 * `stepFreqHz` is the cadence the step counter is currently claiming (steps
 * per second), or null when unknown. Every 'implausible' branch requires the
 * motion to be energetic first — a still or gently-handled phone is never
 * accused of anything.
 */
export function classifyWindow(features, stepFreqHz = null) {
  if (!features || features.sampleCount === 0) {
    return { verdict: 'unknown', reason: 'no_data', features };
  }

  const {
    verticalRms,
    horizontalRms,
    peakToPeakG,
    dominantFreqHz,
    periodicity,
    tumbleDeg,
  } = features;

  // Stillness is not evidence of anything. Steps should not be arriving here
  // in the first place, and if they are the step counter — not this module —
  // is the thing at fault.
  if (verticalRms < ACTIVE_RMS_MIN_G && horizontalRms < ACTIVE_RMS_MIN_G) {
    return { verdict: 'unknown', reason: 'inactive', features };
  }

  // A body cannot throw itself this hard. This catches vigorous shaking
  // regardless of how rhythmic or well-aimed it is.
  if (peakToPeakG > SHAKE_PEAK_TO_PEAK_G) {
    return { verdict: 'implausible', reason: 'amplitude', features };
  }

  // Tumbling: a walker's phone holds a roughly fixed attitude; a shaken one
  // swings through a wide arc. Gated on real energy so setting the phone down
  // or pocketing it mid-walk reads as unknown, not cheating.
  if (Number.isFinite(tumbleDeg) && tumbleDeg > TUMBLE_DEG_MAX &&
      verticalRms >= ACTIVE_RMS_MIN_G * 3) {
    return { verdict: 'implausible', reason: 'tumbling', features };
  }

  const rhythmic = Number.isFinite(periodicity) && periodicity >= PERIODICITY_MIN;

  // Rhythmic motion faster than any human gait is the signature shake.
  if (rhythmic && Number.isFinite(dominantFreqHz) && dominantFreqHz > GAIT_FREQ_MAX_HZ) {
    return { verdict: 'implausible', reason: 'frequency', features };
  }

  // The step counter's cadence and the raw motion disagree: something is
  // driving the step detector that is not the motion of walking.
  if (rhythmic && Number.isFinite(dominantFreqHz) && Number.isFinite(stepFreqHz) &&
      stepFreqHz >= GAIT_FREQ_MIN_HZ && !matchesCadence(dominantFreqHz, stepFreqHz)) {
    return { verdict: 'implausible', reason: 'cadence_mismatch', features };
  }

  // Energy pointing the wrong way — body bounce is vertical. Secondary signal,
  // so it needs the motion to be strongly horizontal, not merely leaning that way.
  if (verticalRms > 0 && horizontalRms / verticalRms > HORIZ_DOMINANCE_MAX &&
      horizontalRms >= ACTIVE_RMS_MIN_G * 3) {
    return { verdict: 'implausible', reason: 'axis', features };
  }

  if (rhythmic && Number.isFinite(dominantFreqHz) &&
      dominantFreqHz >= GAIT_FREQ_MIN_HZ && dominantFreqHz <= GAIT_FREQ_MAX_HZ) {
    return { verdict: 'walking', reason: null, features };
  }

  return { verdict: 'unknown', reason: 'unclear', features };
}

// ─── Stateful analyzer ─────────────────────────────────────────────────────

/**
 * Rolling window over the accelerometer stream. Feed it raw samples in g;
 * ask it for a verdict whenever convenient (roughly once per second is ample).
 */
export function createGaitAnalyzer({ sampleHz = SAMPLE_HZ } = {}) {
  const capacity = Math.max(1, Math.round((WINDOW_MS / 1000) * sampleHz));
  let gravity = null;
  let vertical = [];
  let horizontal = [];
  let gravityDirs = [];

  function reset() {
    gravity = null;
    vertical = [];
    horizontal = [];
    gravityDirs = [];
  }

  function push(sample) {
    if (!sample) return;
    const { x, y, z } = sample;
    if (![x, y, z].every(Number.isFinite)) return;

    if (gravity === null) {
      gravity = { x, y, z };
      return; // first sample only seeds the gravity estimate
    }

    const a = GRAVITY_ALPHA;
    gravity = {
      x: a * gravity.x + (1 - a) * x,
      y: a * gravity.y + (1 - a) * y,
      z: a * gravity.z + (1 - a) * z,
    };

    const gMag = norm(gravity);
    if (!(gMag > 0)) return;
    const unit = { x: gravity.x / gMag, y: gravity.y / gMag, z: gravity.z / gMag };

    // Linear acceleration = raw minus gravity, then split along/across gravity.
    const lin = { x: x - gravity.x, y: y - gravity.y, z: z - gravity.z };
    const v = dot(lin, unit);
    const perp = {
      x: lin.x - v * unit.x,
      y: lin.y - v * unit.y,
      z: lin.z - v * unit.z,
    };

    vertical.push(v);
    horizontal.push(norm(perp));
    gravityDirs.push(unit);

    if (vertical.length > capacity) {
      vertical.shift();
      horizontal.shift();
      gravityDirs.shift();
    }
  }

  /** Widest gravity-direction swing inside the window, in degrees. */
  function tumbleDeg() {
    if (gravityDirs.length < 2) return 0;
    const first = gravityDirs[0];
    let widest = 0;
    for (let i = 1; i < gravityDirs.length; i += 1) {
      const angle = angleBetweenDeg(first, gravityDirs[i]);
      if (angle != null && angle > widest) widest = angle;
    }
    return widest;
  }

  function evaluate(stepFreqHz = null) {
    if (vertical.length < capacity * MIN_WINDOW_FILL) {
      return { verdict: 'unknown', reason: 'warming_up', features: null };
    }
    const features = extractFeatures(vertical, horizontal, tumbleDeg(), sampleHz);
    return classifyWindow(features, stepFreqHz);
  }

  return {
    push,
    reset,
    evaluate,
    get sampleCount() {
      return vertical.length;
    },
  };
}
