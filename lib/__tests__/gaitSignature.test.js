/**
 * lib/__tests__/gaitSignature.test.js
 *
 * Synthetic-motion tests for the accelerometer gait classifier.
 *
 * The asymmetry here is deliberate and is the point of the whole module: a
 * missed cheat costs one territory, a false accusation costs a real player
 * their walk. So every plausible human gait — slow amble through sprint,
 * phone in hand or pocket, noisy sensors — must NEVER read 'implausible',
 * while shaking must be caught.
 */

const fs = require('fs');
const path = require('path');

function loadGait() {
  let source = fs.readFileSync(path.join(__dirname, '..', 'gaitSignature.js'), 'utf8');
  source = source
    .replace(/export const/g, 'const')
    .replace(/export function/g, 'function');
  source += `
    return { createGaitAnalyzer, classifyWindow, extractFeatures, dominantPeriod,
             matchesCadence, angleBetweenDeg, GAIT_CONSTANTS };`;
  // eslint-disable-next-line no-new-func
  return new Function(source)();
}

const {
  createGaitAnalyzer,
  dominantPeriod,
  matchesCadence,
  GAIT_CONSTANTS,
} = loadGait();

const HZ = GAIT_CONSTANTS.SAMPLE_HZ;

// Deterministic pseudo-noise so failures are reproducible.
function noise(i, scale) {
  return (Math.sin(i * 12.9898) * 43758.5453 % 1) * scale;
}

/** Run `seconds` of a generated signal through a fresh analyzer. */
function analyze(gen, { seconds = 12, stepFreqHz = null } = {}) {
  const analyzer = createGaitAnalyzer();
  const n = Math.round(seconds * HZ);
  for (let i = 0; i < n; i += 1) {
    analyzer.push(gen(i / HZ, i));
  }
  return analyzer.evaluate(stepFreqHz);
}

// ─── Motion models (units of g, gravity resting along +z) ──────────────────

/** Ordinary walking: vertical body bounce at step cadence, plus the stride
 *  harmonic, plus a little sway and sensor noise. */
function walking({ freqHz = 1.8, amp = 0.35 } = {}) {
  return (t, i) => ({
    x: 0.05 * Math.sin(2 * Math.PI * freqHz * t + 0.7) + noise(i, 0.01),
    y: 0.04 * Math.sin(Math.PI * freqHz * t) + noise(i + 7, 0.01),
    z: 1
      + amp * Math.sin(2 * Math.PI * freqHz * t)
      + 0.12 * Math.sin(4 * Math.PI * freqHz * t)
      + noise(i + 13, 0.02),
  });
}

/** Running: faster and much harder footfalls, still inside human limits. */
function running() {
  return walking({ freqHz: 2.8, amp: 1.1 });
}

/** A slow amble at the very bottom of the gait band. */
function amble() {
  return walking({ freqHz: 0.9, amp: 0.18 });
}

/** Shaking the phone to drive the step counter. Deliberately modelled along
 *  the gravity axis — the hardest case, since it cannot be caught by the
 *  axis-distribution check and must be caught on frequency. */
function shaking({ freqHz = 5, amp = 1.9 } = {}) {
  return (t, i) => ({
    x: 0.6 * Math.sin(2 * Math.PI * freqHz * t + 1.1) + noise(i, 0.05),
    y: 0.5 * Math.sin(2 * Math.PI * freqHz * t + 2.2) + noise(i + 3, 0.05),
    z: 1 + amp * Math.sin(2 * Math.PI * freqHz * t) + noise(i + 9, 0.05),
  });
}

/** Violent shaking — caught on raw amplitude regardless of rhythm. */
function violentShaking() {
  return (t, i) => ({
    x: 3.5 * Math.sin(2 * Math.PI * 4 * t) + noise(i, 0.4),
    y: 2.0 * Math.sin(2 * Math.PI * 3 * t + 1) + noise(i + 5, 0.4),
    z: 1 + 4.5 * Math.sin(2 * Math.PI * 4.5 * t) + noise(i + 11, 0.4),
  });
}

/** Phone waved through a wide arc: gravity direction swings hugely. */
function tumbling() {
  return (t, i) => {
    const angle = 2 * Math.PI * 0.8 * t;
    return {
      x: Math.sin(angle) + 0.3 * Math.sin(2 * Math.PI * 2.5 * t) + noise(i, 0.05),
      y: noise(i + 4, 0.05),
      z: Math.cos(angle) + 0.3 * Math.cos(2 * Math.PI * 2.5 * t) + noise(i + 8, 0.05),
    };
  };
}

/** Phone sitting on a table. */
function still() {
  return (t, i) => ({ x: noise(i, 0.004), y: noise(i + 2, 0.004), z: 1 + noise(i + 6, 0.004) });
}

// ─── dominantPeriod ────────────────────────────────────────────────────────

describe('dominantPeriod', () => {
  function sine(freqHz, seconds = 5, sampleHz = HZ) {
    const out = [];
    for (let i = 0; i < seconds * sampleHz; i += 1) {
      out.push(Math.sin(2 * Math.PI * freqHz * (i / sampleHz)));
    }
    return out;
  }

  test('finds the fundamental, not a multiple of its period', () => {
    // The trap: every integer multiple of the true period also peaks. Picking
    // the tallest would report 1 Hz as 0.5 Hz or 0.33 Hz.
    const peak = dominantPeriod(sine(2), 3, 50);
    expect(HZ / peak.lag).toBeCloseTo(2, 1);
  });

  test('finds the fundamental under a strong second harmonic', () => {
    const signal = [];
    for (let i = 0; i < 5 * HZ; i += 1) {
      const t = i / HZ;
      signal.push(Math.sin(2 * Math.PI * 1.8 * t) + 0.5 * Math.sin(2 * Math.PI * 3.6 * t));
    }
    const peak = dominantPeriod(signal, 3, 50);
    expect(HZ / peak.lag).toBeCloseTo(1.8, 0);
  });

  test('scores a clean oscillation as highly periodic', () => {
    expect(dominantPeriod(sine(2), 3, 50).strength).toBeGreaterThan(0.8);
  });

  test('returns null on a flat signal', () => {
    expect(dominantPeriod(new Array(100).fill(0), 3, 50)).toBeNull();
  });

  test('rejects nonsense lag ranges', () => {
    expect(dominantPeriod(sine(2), 0, 50)).toBeNull();
    expect(dominantPeriod(sine(2), 10, 5)).toBeNull();
    expect(dominantPeriod([1, 2, 3], 1, 99)).toBeNull();
  });
});

// ─── matchesCadence ────────────────────────────────────────────────────────

describe('matchesCadence', () => {
  test('accepts the fundamental', () => {
    expect(matchesCadence(1.9, 2.0)).toBe(true);
  });

  test('accepts the stride period', () => {
    // Autocorrelation on real gait often locks onto the stride (half cadence);
    // rejecting that would flag ordinary walkers.
    expect(matchesCadence(1.0, 2.0)).toBe(true);
  });

  test('rejects double cadence — no gait puts its fundamental there', () => {
    // Body mass rises and falls once per footfall, so 2x the step rate has no
    // physical source. Allowing it merged the acceptance bands into one
    // continuous range and gutted the check.
    expect(matchesCadence(4.0, 2.0)).toBe(false);
  });

  test('rejects a fundamental unrelated to the claimed cadence', () => {
    expect(matchesCadence(5.0, 2.0)).toBe(false);
  });

  test('abstains when either input is unknown', () => {
    expect(matchesCadence(5.0, null)).toBe(true);
    expect(matchesCadence(null, 2.0)).toBe(true);
    expect(matchesCadence(5.0, 0)).toBe(true);
  });
});

// ─── Real gait must never be accused ───────────────────────────────────────

describe('genuine human motion is never called implausible', () => {
  test('ordinary walking classifies as walking', () => {
    const result = analyze(walking(), { stepFreqHz: 1.8 });
    expect(result.verdict).toBe('walking');
  });

  test('a slow amble classifies as walking', () => {
    expect(analyze(amble(), { stepFreqHz: 0.9 }).verdict).toBe('walking');
  });

  test('running classifies as walking, not implausible', () => {
    expect(analyze(running(), { stepFreqHz: 2.8 }).verdict).toBe('walking');
  });

  test('walking is accepted even with no cadence to cross-check', () => {
    expect(analyze(walking(), { stepFreqHz: null }).verdict).toBe('walking');
  });

  test('walking survives a noisy sensor', () => {
    const noisy = (t, i) => {
      const base = walking()(t, i);
      return { x: base.x + noise(i + 31, 0.08), y: base.y + noise(i + 37, 0.08), z: base.z + noise(i + 41, 0.08) };
    };
    expect(analyze(noisy, { stepFreqHz: 1.8 }).verdict).not.toBe('implausible');
  });

  test('a still phone is unknown, never implausible', () => {
    const result = analyze(still());
    expect(result.verdict).toBe('unknown');
    expect(result.reason).toBe('inactive');
  });

  test('a walk reported at stride cadence is not a mismatch', () => {
    // Step counter says 1.8 steps/s while autocorrelation locked onto the
    // 0.9 Hz stride — the same gait seen two valid ways.
    expect(analyze(amble(), { stepFreqHz: 1.8 }).verdict).not.toBe('implausible');
  });
});

// ─── Shaking must be caught ────────────────────────────────────────────────

describe('shake signatures are caught', () => {
  test('rhythmic shaking above the gait band is caught on frequency', () => {
    const result = analyze(shaking(), { stepFreqHz: 2.0 });
    expect(result.verdict).toBe('implausible');
    expect(['frequency', 'cadence_mismatch']).toContain(result.reason);
  });

  test('violent shaking is caught on amplitude alone', () => {
    const result = analyze(violentShaking(), { stepFreqHz: 2.0 });
    expect(result.verdict).toBe('implausible');
    expect(result.reason).toBe('amplitude');
  });

  test('waving the phone through an arc is caught as tumbling', () => {
    expect(analyze(tumbling(), { stepFreqHz: 2.0 }).verdict).toBe('implausible');
  });

  test('shaking inside the gait band still fails the cadence cross-check', () => {
    // A slow wave that trips the step detector several times per cycle: the
    // motion is in-band at 1.0 Hz so the frequency check passes, but the
    // counter is claiming 180 steps/min off a body oscillating once a second,
    // and that disagreement is what gives it away.
    const result = analyze(shaking({ freqHz: 1.0, amp: 1.0 }), { stepFreqHz: 3.0 });
    expect(result.verdict).toBe('implausible');
    expect(result.reason).toBe('cadence_mismatch');
  });
});

// ─── Analyzer lifecycle ────────────────────────────────────────────────────

describe('analyzer lifecycle', () => {
  test('abstains until the window has filled', () => {
    const analyzer = createGaitAnalyzer();
    for (let i = 0; i < 10; i += 1) analyzer.push(walking()(i / HZ, i));
    const result = analyzer.evaluate(1.8);
    expect(result.verdict).toBe('unknown');
    expect(result.reason).toBe('warming_up');
  });

  test('reset clears the window', () => {
    const analyzer = createGaitAnalyzer();
    for (let i = 0; i < 300; i += 1) analyzer.push(walking()(i / HZ, i));
    expect(analyzer.sampleCount).toBeGreaterThan(0);
    analyzer.reset();
    expect(analyzer.sampleCount).toBe(0);
    expect(analyzer.evaluate(1.8).reason).toBe('warming_up');
  });

  test('the window is bounded regardless of how long the walk runs', () => {
    const analyzer = createGaitAnalyzer();
    for (let i = 0; i < 10_000; i += 1) analyzer.push(walking()(i / HZ, i));
    expect(analyzer.sampleCount).toBeLessThanOrEqual(GAIT_CONSTANTS.WINDOW_MS / 1000 * HZ);
  });

  test('ignores malformed samples', () => {
    const analyzer = createGaitAnalyzer();
    analyzer.push(null);
    analyzer.push({ x: NaN, y: 0, z: 1 });
    analyzer.push({ x: 0, y: undefined, z: 1 });
    expect(analyzer.sampleCount).toBe(0);
  });

  test('recovers to a walking verdict after shaking stops', () => {
    const analyzer = createGaitAnalyzer();
    for (let i = 0; i < 300; i += 1) analyzer.push(shaking()(i / HZ, i));
    expect(analyzer.evaluate(2.0).verdict).toBe('implausible');
    for (let i = 0; i < 300; i += 1) analyzer.push(walking()(i / HZ, i));
    expect(analyzer.evaluate(1.8).verdict).toBe('walking');
  });
});
