/**
 * lib/__tests__/territoryCard.test.js
 *
 * Compact territory card model (Figma parity plan U11): CTA kind, label,
 * price, currency, disabled state and shortfall.
 */

const flags = require('../flags');
const { territoryCardModel, CTA_LABELS, BUSY_LABEL, WALK_WINDOW_MIN } = require('../territoryCard');

const YOURS = '#22D65E';
const ALLIANCE = '#3155FF';
const ENEMY = '#E8432B';

const unclaimedSmall = { name: 'Cubbon Park', owner: 'Unclaimed', tier: 'Small', perimeterDistance: 1094 };
const enemySmall = { name: 'Lalbagh', owner: 'Mr. ABC', tier: 'Small', color: ENEMY, perimeterDistance: 900, developmentLevel: 0 };

beforeEach(() => flags._resetForTests());

describe('territoryCardModel', () => {
  test('unclaimed small territory: START CLAIMING for 10 Gold', () => {
    const m = territoryCardModel({ properties: unclaimedSmall, gold: 100 });
    expect(m.ownership).toBe('unclaimed');
    expect(m.ownerName).toBeNull();
    expect(m.action.kind).toBe('claim');
    expect(m.action.label).toBe(CTA_LABELS.claim);
    expect(m.action.label.defaultValue).toBe('START CLAIMING');
    expect(m.action.price).toBe(10);
    expect(m.action.currency).toBe('gold');
    expect(m.action.disabled).toBe(false);
    expect(m.action.shortfall).toBe(0);
    expect(m.distanceM).toBe(1094);
    expect(m.timeLimitMin).toBe(WALK_WINDOW_MIN.small);
  });

  test('solo-owned (enemy) small territory: CONTEST TERRITORY for 8 Gold', () => {
    const m = territoryCardModel({ properties: enemySmall, gold: 100 });
    expect(m.ownership).toBe('enemy');
    expect(m.ownerName).toBe('Mr. ABC');
    expect(m.action.kind).toBe('contest');
    expect(m.action.label.defaultValue).toBe('CONTEST TERRITORY');
    expect(m.action.price).toBe(8);
    expect(m.action.currency).toBe('gold');
    expect(m.action.disabled).toBe(false);
    expect(m.distanceM).toBeGreaterThan(0);
  });

  test("player's own territory: no spend action", () => {
    const m = territoryCardModel({ properties: { ...enemySmall, owner: 'me', color: YOURS }, gold: 100 });
    expect(m.ownership).toBe('yours');
    expect(m.action).toBeNull();
  });

  test("alliance's territory: no spend action", () => {
    const m = territoryCardModel({ properties: { ...enemySmall, color: ALLIANCE }, gold: 100 });
    expect(m.ownership).toBe('alliance');
    expect(m.action).toBeNull();
  });

  test('insufficient Gold disables the CTA and reports the shortfall', () => {
    const claim = territoryCardModel({ properties: unclaimedSmall, gold: 6 });
    expect(claim.action.disabled).toBe(true);
    expect(claim.action.reason).toBe('insufficient');
    expect(claim.action.shortfall).toBe(4);

    const contest = territoryCardModel({ properties: enemySmall, gold: 3 });
    expect(contest.action.disabled).toBe(true);
    expect(contest.action.shortfall).toBe(5);
  });

  test('exact balance is enough', () => {
    const m = territoryCardModel({ properties: unclaimedSmall, gold: 10 });
    expect(m.action.disabled).toBe(false);
    expect(m.action.shortfall).toBe(0);
  });

  test('unknown balance (player loading) leaves the CTA enabled with no shortfall', () => {
    const m = territoryCardModel({ properties: unclaimedSmall, gold: null });
    expect(m.action.disabled).toBe(false);
    expect(m.action.shortfall).toBe(0);
  });

  test('territory cap disables claiming', () => {
    const m = territoryCardModel({ properties: unclaimedSmall, gold: 100, atCap: true });
    expect(m.action.disabled).toBe(true);
    expect(m.action.reason).toBe('cap');
  });

  test('prices follow the tier and the economy parameter', () => {
    const medium = territoryCardModel({ properties: { ...unclaimedSmall, tier: 'Medium' }, gold: 100 });
    expect(medium.action.price).toBe(25);
    expect(medium.timeLimitMin).toBe(30);
    const economy = { ...flags.ECONOMY_DEFAULTS, claim_gold_cost: { small: 12, medium: 25, large: 60, epic: 120 } };
    const custom = territoryCardModel({ properties: unclaimedSmall, gold: 100, economy });
    expect(custom.action.price).toBe(12);
  });

  test('multi_resource_economy on prices contests in Iron', () => {
    const m = territoryCardModel({ properties: enemySmall, gold: 100, iron: 2, multiResource: true });
    expect(m.action.currency).toBe('iron');
    expect(m.action.price).toBe(8);
    expect(m.action.shortfall).toBe(6);
    // Claims stay Gold either way.
    const c = territoryCardModel({ properties: unclaimedSmall, gold: 100, iron: 0, multiResource: true });
    expect(c.action.currency).toBe('gold');
  });
});


describe('CTA busy label (Processing after Start)', () => {
  const en = require('../../locales/en.json');
  const ru = require('../../locales/ru.json');
  const lookup = (bundle, key) => key.split('.').reduce((o, k) => (o ? o[k] : undefined), bundle);

  test('points at a key both locales define', () => {
    expect(BUSY_LABEL.key).toBe('map.card.processing');
    expect(lookup(en, BUSY_LABEL.key)).toBe('PROCESSING…');
    expect(typeof lookup(ru, BUSY_LABEL.key)).toBe('string');
  });

  test('the first-claim tag and line keys exist in both locales', () => {
    for (const bundle of [en, ru]) {
      expect(typeof lookup(bundle, 'firstClaim.kicker')).toBe('string');
      expect(lookup(bundle, 'firstClaim.sheetLine')).toContain('{{distance}}');
    }
  });
});

describe('free first claim (Updated UX bug: price shown on a free claim)', () => {
  test('free claim drops the price and never reports a shortfall', () => {
    const m = territoryCardModel({ properties: unclaimedSmall, gold: 0, free: true });
    expect(m.action.kind).toBe('claim');
    expect(m.action.free).toBe(true);
    expect(m.action.price).toBe(0);
    expect(m.action.shortfall).toBe(0);
    expect(m.action.disabled).toBe(false);
  });

  test('without the flag the claim keeps its tier price', () => {
    const m = territoryCardModel({ properties: unclaimedSmall, gold: 100, free: false });
    expect(m.action.free).toBe(false);
    expect(m.action.price).toBe(10);
  });

  test('free never applies to a contest', () => {
    const m = territoryCardModel({ properties: enemySmall, gold: 100, free: true });
    expect(m.action.kind).toBe('contest');
    expect(m.action.free).toBe(false);
    expect(m.action.price).toBe(8);
  });
});

describe('map colour tip matches the palette', () => {
  const en = require('../../locales/en.json');
  test('green is yours, blue allies, red rivals', () => {
    const tip = en.walkthrough.map.colours;
    expect(tip.indexOf('Green')).toBeLessThan(tip.indexOf('Red'));
    expect(tip).toMatch(/Green marks what you hold/);
    expect(tip).toMatch(/Blue marks your allies/);
    expect(tip).toMatch(/Red marks your rivals/);
  });
});
