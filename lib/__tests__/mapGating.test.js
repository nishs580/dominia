/**
 * lib/__tests__/mapGating.test.js
 *
 * Covers the map-surface gating from the Figma parity plan (U3): which
 * Mapbox layers mount for a set of flags (lib/mapLayers.js), and the
 * first-claim spine gate (lib/firstClaimSpine.js) that keeps the objective
 * beats from ever rendering with first_claim_objective off.
 */

const flags = require('../flags');
const { MAP_LAYERS, visibleMapLayers } = require('../mapLayers');
const {
  SPINE_EVENTS,
  SPINE_DISABLED,
  initialSpineState,
  gateSpineState,
  spineReduce,
  isSpineComplete,
  resumeBeat,
} = require('../firstClaimSpine');

// Every layer MapScreen declared before gating, in declaration order.
const TODAYS_LAYERS = [
  'territories-open-fill', 'territories-fill', 'territories-hatch',
  'territories-d4-walls', 'territories-casing', 'territories-glow', 'territories-line',
  'territories-open', 'territories-streak-inner', 'territories-rampart',
  'territories-contested-casing', 'territories-contested',
  'territories-selected-fill', 'territories-selected-glow',
  'territories-selected-line', 'territories-selected-open-line', 'territories-labels', 'territories-emblems',
  'territories-battle-chips', 'territory-nodes-circles',
  'bases-icons', 'bases-pennants', 'objective-fill', 'objective-line',
  'celebration-fill', 'celebration-line',
];

const LAYER_FLAGS = ['legacy_tabs', 'battle_chips', 'home_bases', 'streaks', 'territory_development', 'first_claim_objective'];

const allOn = () => Object.fromEntries(LAYER_FLAGS.map((f) => [f, true]));
const allOff = () => Object.fromEntries(LAYER_FLAGS.map((f) => [f, false]));

const GATED = [
  'territories-battle-chips', 'bases-icons', 'bases-pennants',
  'territories-streak-inner', 'objective-fill', 'objective-line',
  'territories-d4-walls', 'territories-rampart', 'territories-hatch',
];

// =============================================================================
// visibleMapLayers
// =============================================================================

describe('visibleMapLayers', () => {
  test('all flags on: matches today\'s full layer list, in order', () => {
    expect(visibleMapLayers(allOn())).toEqual(TODAYS_LAYERS);
  });

  test('registry defaults (build-out, all true) mount today\'s full layer list', () => {
    flags._resetForTests();
    const resolved = Object.fromEntries(LAYER_FLAGS.map((f) => [f, flags.getFlag(f)]));
    expect(visibleMapLayers(resolved)).toEqual(TODAYS_LAYERS);
  });

  test('all flags off: excludes battle chips, bases, streak inner and objective layers', () => {
    const visible = visibleMapLayers(allOff());
    for (const id of GATED) expect(visible).not.toContain(id);
  });

  test('all flags off: territories, labels and alliance emblems remain', () => {
    const visible = visibleMapLayers(allOff());
    for (const id of ['territories-fill', 'territories-line', 'territories-labels', 'territories-emblems']) {
      expect(visible).toContain(id);
    }
    expect(visible).toEqual(TODAYS_LAYERS.filter((id) => !GATED.includes(id)));
  });

  test('battle_chips on: battle-chip layer included, others unchanged', () => {
    const off = visibleMapLayers(allOff());
    const on = visibleMapLayers({ ...allOff(), battle_chips: true });
    expect(on).toContain('territories-battle-chips');
    expect(on.filter((id) => id !== 'territories-battle-chips')).toEqual(off);
  });

  test.each([
    ['home_bases', ['bases-icons', 'bases-pennants']],
    ['streaks', ['territories-streak-inner']],
    ['first_claim_objective', ['objective-fill', 'objective-line']],
    ['territory_development', ['territories-d4-walls', 'territories-rampart']],
  ])('%s on adds only its own layers', (flag, ids) => {
    const off = visibleMapLayers(allOff());
    const on = visibleMapLayers({ ...allOff(), [flag]: true });
    expect(on.filter((id) => !off.includes(id))).toEqual(ids);
  });

  test('missing or non-boolean flag values count as off', () => {
    expect(visibleMapLayers(undefined)).toEqual(visibleMapLayers(allOff()));
    expect(visibleMapLayers({ battle_chips: 'true' })).not.toContain('territories-battle-chips');
  });

  test('every gating flag is in the flag registry', () => {
    for (const { flag } of MAP_LAYERS) {
      if (flag != null) expect(Object.keys(flags.FLAG_DEFAULTS)).toContain(flag);
    }
  });
});

// =============================================================================
// FIRST-CLAIM SPINE GATE
// =============================================================================

describe('first_claim_objective gate on the spine', () => {
  const OFF = { objectiveEnabled: false };
  const progressed = () => spineReduce(initialSpineState(), SPINE_EVENTS.FLIGHT_SETTLED);

  test('flag off: the reducer never enters an objective state', () => {
    for (const start of [null, initialSpineState(), progressed()]) {
      for (const event of Object.values(SPINE_EVENTS)) {
        const s = spineReduce(start, event, OFF);
        expect(isSpineComplete(s)).toBe(true);
        expect(resumeBeat(s)).toBeNull();
      }
    }
  });

  test('flag off: a full beat sequence never reaches objective or sheet', () => {
    let s = initialSpineState();
    for (const event of [SPINE_EVENTS.FLIGHT_SETTLED, SPINE_EVENTS.SHEET_OPENED]) {
      s = spineReduce(s, event, OFF);
      expect(s.beat).not.toBe('objective');
      expect(s.beat).not.toBe('sheet');
      expect(resumeBeat(s)).toBeNull();
    }
  });

  test('flag off: an incomplete persisted state reads as complete, flagged disabled', () => {
    const gated = gateSpineState(progressed(), OFF);
    expect(isSpineComplete(gated)).toBe(true);
    expect(gated.completedVia).toBe(SPINE_DISABLED);
    expect(resumeBeat(gated)).toBeNull();
  });

  test('flag off: a gated state absorbs events, so the map never re-saves it', () => {
    const gated = gateSpineState(initialSpineState(), OFF);
    for (const event of Object.values(SPINE_EVENTS)) {
      expect(spineReduce(gated, event, OFF)).toBe(gated);
    }
  });

  test('flag off: already-complete and not-yet-loaded states pass through', () => {
    const done = spineReduce(progressed(), SPINE_EVENTS.CLAIM_STARTED);
    expect(gateSpineState(done, OFF)).toBe(done);
    expect(gateSpineState(null, OFF)).toBeNull();
  });

  test('flag on (default): reducer behaves as before', () => {
    expect(gateSpineState(initialSpineState())).toEqual(initialSpineState());
    const s = spineReduce(initialSpineState(), SPINE_EVENTS.FLIGHT_SETTLED);
    expect(s.beat).toBe('objective');
    expect(spineReduce(s, SPINE_EVENTS.SHEET_OPENED, { objectiveEnabled: true }).beat).toBe('sheet');
  });
});
