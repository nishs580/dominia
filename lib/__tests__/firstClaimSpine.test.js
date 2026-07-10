const {
  SPINE_EVENTS,
  initialSpineState,
  spineReduce,
  isSpineComplete,
  resumeBeat,
  serialiseSpineState,
  deserialiseSpineState,
} = require('../firstClaimSpine');

describe('initial state', () => {
  test('starts at the flight, incomplete', () => {
    const s = initialSpineState();
    expect(s.beat).toBe('flight');
    expect(s.flightDone).toBe(false);
    expect(isSpineComplete(s)).toBe(false);
    expect(resumeBeat(s)).toBe('flight');
  });
});

describe('forward transitions', () => {
  test('flight settles → objective beat, flight never replays', () => {
    const s = spineReduce(initialSpineState(), SPINE_EVENTS.FLIGHT_SETTLED);
    expect(s.beat).toBe('objective');
    expect(s.flightDone).toBe(true);
    expect(resumeBeat(s)).toBe('objective');
  });

  test('sheet opens → sheet beat', () => {
    let s = spineReduce(initialSpineState(), SPINE_EVENTS.FLIGHT_SETTLED);
    s = spineReduce(s, SPINE_EVENTS.SHEET_OPENED);
    expect(s.beat).toBe('sheet');
    expect(isSpineComplete(s)).toBe(false);
  });

  test('sheet cannot open before the flight settles', () => {
    const s = spineReduce(initialSpineState(), SPINE_EVENTS.SHEET_OPENED);
    expect(s.beat).toBe('flight');
  });

  test('dismissal only completes from the sheet beat', () => {
    const atObjective = spineReduce(initialSpineState(), SPINE_EVENTS.FLIGHT_SETTLED);
    expect(isSpineComplete(spineReduce(atObjective, SPINE_EVENTS.SHEET_DISMISSED))).toBe(false);
  });

  test('unknown events are ignored', () => {
    const s = initialSpineState();
    expect(spineReduce(s, 'nonsense_event')).toBe(s);
  });
});

describe('exit paths — each sets the completion flag', () => {
  const atSheet = () => {
    let s = spineReduce(initialSpineState(), SPINE_EVENTS.FLIGHT_SETTLED);
    return spineReduce(s, SPINE_EVENTS.SHEET_OPENED);
  };

  test('CLAIM IT (claim started)', () => {
    const s = spineReduce(atSheet(), SPINE_EVENTS.CLAIM_STARTED);
    expect(isSpineComplete(s)).toBe(true);
    expect(s.completedVia).toBe('claim');
  });

  test('successful claim completion (held_count > 0 observed)', () => {
    const s = spineReduce(initialSpineState(), SPINE_EVENTS.CLAIM_COMPLETED);
    expect(isSpineComplete(s)).toBe(true);
    expect(s.completedVia).toBe('claimed');
  });

  test('the LATER couch close', () => {
    const s = spineReduce(atSheet(), SPINE_EVENTS.SHEET_DISMISSED);
    expect(isSpineComplete(s)).toBe(true);
    expect(s.completedVia).toBe('later');
  });

  test('no claimable objective routes to the standard map', () => {
    const s = spineReduce(initialSpineState(), SPINE_EVENTS.NO_OBJECTIVE);
    expect(isSpineComplete(s)).toBe(true);
    expect(s.completedVia).toBe('no_objective');
  });
});

describe('once per account — never renders after completion', () => {
  test('resumeBeat is null for every completed state', () => {
    const exits = [
      SPINE_EVENTS.CLAIM_STARTED,
      SPINE_EVENTS.CLAIM_COMPLETED,
      SPINE_EVENTS.NO_OBJECTIVE,
    ];
    for (const exit of exits) {
      const s = spineReduce(initialSpineState(), exit);
      expect(resumeBeat(s)).toBeNull();
    }
  });

  test('a completed spine absorbs every further event', () => {
    const done = spineReduce(initialSpineState(), SPINE_EVENTS.CLAIM_STARTED);
    for (const event of Object.values(SPINE_EVENTS)) {
      expect(spineReduce(done, event)).toBe(done);
    }
  });

  test('resumeBeat is null for null/undefined state', () => {
    expect(resumeBeat(null)).toBeNull();
    expect(resumeBeat(undefined)).toBeNull();
  });
});

describe('resume rules (app kill mid-spine)', () => {
  test('kill during the flight → flight replays (Beat 1 never completed)', () => {
    const persisted = deserialiseSpineState(serialiseSpineState(initialSpineState()));
    expect(resumeBeat(persisted)).toBe('flight');
  });

  test('kill at the objective beat → resumes there, no second flight', () => {
    const s = spineReduce(initialSpineState(), SPINE_EVENTS.FLIGHT_SETTLED);
    const persisted = deserialiseSpineState(serialiseSpineState(s));
    expect(resumeBeat(persisted)).toBe('objective');
  });

  test('kill at the sheet beat → resumes at the sheet, no second flight', () => {
    let s = spineReduce(initialSpineState(), SPINE_EVENTS.FLIGHT_SETTLED);
    s = spineReduce(s, SPINE_EVENTS.SHEET_OPENED);
    const persisted = deserialiseSpineState(serialiseSpineState(s));
    expect(resumeBeat(persisted)).toBe('sheet');
  });

  test('completion survives the round trip', () => {
    const s = spineReduce(initialSpineState(), SPINE_EVENTS.CLAIM_STARTED);
    const persisted = deserialiseSpineState(serialiseSpineState(s));
    expect(isSpineComplete(persisted)).toBe(true);
    expect(persisted.completedVia).toBe('claim');
    expect(resumeBeat(persisted)).toBeNull();
  });
});

describe('deserialisation hardening', () => {
  test('garbage in → null, never throws', () => {
    expect(deserialiseSpineState(null)).toBeNull();
    expect(deserialiseSpineState('')).toBeNull();
    expect(deserialiseSpineState('not json')).toBeNull();
    expect(deserialiseSpineState('42')).toBeNull();
    expect(deserialiseSpineState('{"beat":"tour"}')).toBeNull();
  });

  test('field types are coerced defensively', () => {
    const s = deserialiseSpineState('{"beat":"sheet","flightDone":"yes","complete":0,"completedVia":7}');
    expect(s.flightDone).toBe(false);
    expect(s.complete).toBe(false);
    expect(s.completedVia).toBeNull();
  });
});
