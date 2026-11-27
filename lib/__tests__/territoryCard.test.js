/**
 * lib/__tests__/territoryCard.test.js
 *
 * Compact territory card model (Figma parity plan U11): CTA kind, label,
 * price, currency, disabled state and shortfall.
 */

const flags = require('../flags');
const {
  territoryCardModel,
  territoryOwnership,
  territoryOwnershipFor,
  CTA_LABELS,
  BUSY_LABEL,
  WALK_WINDOW_MIN,
} = require('../territoryCard');

// Current palette (lib/theme.js colors.self / alliance / enemy).
const YOURS = '#84FF44';
const ALLIANCE = '#5B7BF5';
const ENEMY = '#E34234';
// Pre-Dominia-Temp palette, still on features cached before the change.
const OLD_YOURS = '#22D65E';
const OLD_ALLIANCE = '#3155FF';
const OLD_ENEMY = '#E8432B';

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

describe('Updated UX card (plan U8, Figma C4/C5)', () => {
  const { CARD_COPY, groupThousands } = require('../territoryCard');

  test('enemy territory: tags ENEMY + SOLO, explainer, owner title, priced CTA', () => {
    const m = territoryCardModel({ properties: enemySmall, gold: 100 });
    expect(m.tags.map((tg) => tg.kind)).toEqual(['enemy', 'solo']);
    expect(m.tags[0].label.defaultValue).toBe('ENEMY');
    expect(m.tags[1].label.defaultValue).toBe('SOLO');
    expect(m.title.copy).toBe(CARD_COPY.ownerTitle);
    expect(m.title.params.owner).toBe('Mr. ABC');
    expect(m.explainer.copy).toBe(CARD_COPY.enemyExplainer);
    expect(m.explainer.params.owner).toBe('Mr. ABC');
    expect(m.action.ctaText).toBe('8 GOLD · CONTEST TERRITORY');
    expect(m.viewAlliance).toBeNull();
  });

  test('enemy in an alliance shows the alliance tag instead of SOLO', () => {
    const m = territoryCardModel({ properties: { ...enemySmall, alliance: 'VLK' }, gold: 100 });
    expect(m.tags.map((tg) => tg.kind)).toEqual(['enemy', 'allianceTag']);
    expect(m.tags[1].text).toBe('[VLK]');
  });

  test('held-for subline only when the holding time is known', () => {
    const known = territoryCardModel({ properties: enemySmall, gold: 100, heldDays: 3 });
    expect(known.heldFor).toEqual({ days: 3 });
    expect(known.subline.copy).toBe(CARD_COPY.heldFor);
    expect(known.subline.params).toEqual({ name: 'Lalbagh', count: 3 });
    const unknown = territoryCardModel({ properties: enemySmall, gold: 100 });
    expect(unknown.heldFor).toBeNull();
    expect(unknown.subline.copy).toBeNull();
    expect(unknown.subline.params.name).toBe('Lalbagh');
  });

  test('alliance territory: VIEW ALLIANCE, ALLIANCE + [TAG] tags, explainer, no CTA', () => {
    const m = territoryCardModel({
      properties: { ...enemySmall, owner: 'Ravi K.', color: ALLIANCE, alliance: 'JIC', allianceName: 'Jalahalli Cult' },
      gold: 100,
    });
    expect(m.action).toBeNull();
    expect(m.viewAlliance.label.defaultValue).toBe('VIEW ALLIANCE');
    expect(m.tags.map((tg) => tg.kind)).toEqual(['alliance', 'allianceTag']);
    expect(m.tags[1].text).toBe('[JIC]');
    expect(m.title.params.owner).toBe('Ravi K.');
    expect(m.explainer.copy).toBe(CARD_COPY.allianceExplainer);
    expect(m.explainer.params.alliance).toBe('Jalahalli Cult');
    expect(m.heldFor).toBeNull();
  });

  test('alliance territory without the alliance name uses the nameless explainer', () => {
    const m = territoryCardModel({ properties: { ...enemySmall, color: ALLIANCE }, gold: 100 });
    expect(m.explainer.copy).toBe(CARD_COPY.allianceExplainerNoName);
  });

  test('meta line formats 1094 m at the medium tier as "1,094 M · 30 MIN LIMIT"', () => {
    const m = territoryCardModel({ properties: { ...unclaimedSmall, tier: 'Medium' }, gold: 100 });
    expect(m.metaLine.text).toBe('1,094 M · 30 MIN LIMIT');
    expect(m.metaLine.params).toEqual({ distance: '1,094', minutes: 30 });
    expect(groupThousands(1234567)).toBe('1,234,567');
    expect(groupThousands(999)).toBe('999');
  });

  test('unclaimed: UNCLAIMED tag and "10 GOLD · START CLAIMING"', () => {
    const m = territoryCardModel({ properties: unclaimedSmall, gold: 100 });
    expect(m.tags.map((tg) => tg.kind)).toEqual(['unclaimed']);
    expect(m.title.copy).toBeNull();
    expect(m.title.params.name).toBe('Cubbon Park');
    expect(m.explainer).toBeNull();
    expect(m.action.ctaText).toBe('10 GOLD · START CLAIMING');
  });

  test('free first claim: FIRST CLAIM tag and the CTA without a price', () => {
    const m = territoryCardModel({ properties: unclaimedSmall, gold: 0, free: true });
    expect(m.tags.map((tg) => tg.kind)).toEqual(['firstClaim']);
    expect(m.action.ctaText).toBe('START CLAIMING');
  });

  test('yours: YOURS tag, no CTA, no explainer', () => {
    const m = territoryCardModel({ properties: { ...enemySmall, owner: 'me', color: YOURS }, gold: 100 });
    expect(m.tags.map((tg) => tg.kind)).toEqual(['yours']);
    expect(m.explainer).toBeNull();
    expect(m.action).toBeNull();
  });

  test('every card copy key exists in both locales', () => {
    const en = require('../../locales/en.json');
    const ru = require('../../locales/ru.json');
    const lookup = (bundle, key) => key.split('.').reduce((o, k) => (o ? o[k] : undefined), bundle);
    // Counted copy (held for N days) lives under plural suffixes.
    const has = (bundle, key) => typeof (lookup(bundle, key) ?? lookup(bundle, `${key}_one`)) === 'string';
    for (const copy of Object.values(CARD_COPY)) {
      expect(has(en, copy.key)).toBe(true);
      expect(has(ru, copy.key)).toBe(true);
    }
    expect(lookup(ru, 'map.card.heldFor_few')).toContain('{{count}}');
  });
});

describe('Dominia-Temp pop-up states (plan U6, R21)', () => {
  const { POPUP_COPY } = require('../territoryCard');
  const statKeys = (m) => m.stats.map((s) => s.key);

  test('unclaimed: eyebrow UNCLAIMED (muted), START CLAIMING, cost 10, DISTANCE / TIME LIMIT / ENTRY', () => {
    const m = territoryCardModel({ properties: unclaimedSmall, gold: 100 });
    expect(m.eyebrow.kind).toBe('unclaimed');
    expect(m.eyebrow.tone).toBe('muted');
    expect(m.eyebrow.copy.defaultValue).toBe('UNCLAIMED');
    expect(m.name).toBe('Cubbon Park');
    expect(m.action.label.defaultValue).toBe('START CLAIMING');
    expect(m.action.price).toBe(10);
    expect(m.action.hint).toBeNull();
    expect(m.confirm).toBeNull();
    expect(statKeys(m)).toEqual(['distance', 'timeLimit', 'entry']);
    expect(m.stats[0].label.defaultValue).toBe('DISTANCE');
    expect(m.stats[0].params).toEqual({ distance: '1,094' });
    expect(m.stats[1].label.defaultValue).toBe('TIME LIMIT');
    expect(m.stats[1].params).toEqual({ minutes: 15 });
    expect(m.stats[2].value).toBe(POPUP_COPY.statEntryGold);
    expect(m.stats[2].params).toEqual({ price: 10 });
  });

  test('free first claim: no ENTRY column and no cost', () => {
    const m = territoryCardModel({ properties: unclaimedSmall, gold: 0, free: true });
    expect(statKeys(m)).toEqual(['distance', 'timeLimit']);
    expect(m.action.hint).toBeNull();
  });

  test('yours: CLAIMED! (lime) with OK and no spend action', () => {
    const m = territoryCardModel({ properties: { ...enemySmall, ownership: 'yours' }, gold: 100 });
    expect(m.eyebrow.kind).toBe('claimed');
    expect(m.eyebrow.tone).toBe('self');
    expect(m.eyebrow.copy.defaultValue).toBe('CLAIMED!');
    expect(m.action).toBeNull();
    expect(m.confirm.label.defaultValue).toBe('OK');
    expect(statKeys(m)).toEqual(['distance', 'timeLimit']);
  });

  test('enemy with an owner name: "<OWNER> TERRITORY", CONTEST TERRITORY at its gold cost', () => {
    const m = territoryCardModel({ properties: enemySmall, gold: 100 });
    expect(m.eyebrow.kind).toBe('owner');
    expect(m.eyebrow.tone).toBe('enemy');
    expect(m.eyebrow.copy).toBe(POPUP_COPY.eyebrowOwner);
    expect(m.eyebrow.params).toEqual({ owner: 'Mr. ABC' });
    expect(m.action.label.defaultValue).toBe('CONTEST TERRITORY');
    expect(m.action.price).toBe(8);
    expect(m.action.currency).toBe('gold');
    expect(m.confirm).toBeNull();
  });

  test('enemy without an owner name: ENEMY TERRITORY! and ATTACK', () => {
    const m = territoryCardModel({ properties: { ...enemySmall, owner: '', ownership: 'enemy' }, gold: 100 });
    expect(m.eyebrow.kind).toBe('enemy');
    expect(m.eyebrow.copy.defaultValue).toBe('ENEMY TERRITORY!');
    expect(m.action.kind).toBe('contest');
    expect(m.action.label).toBe(CTA_LABELS.attack);
    expect(m.action.label.defaultValue).toBe('ATTACK');
  });

  test("enemy stamped owner 'Unclaimed' (no username) or blank: ENEMY TERRITORY! and ATTACK", () => {
    for (const owner of ['Unclaimed', null, '   ']) {
      const m = territoryCardModel({ properties: { ...enemySmall, owner, ownership: 'enemy' }, gold: 100 });
      expect(m.ownerName).toBeNull();
      expect(m.eyebrow.kind).toBe('enemy');
      expect(m.eyebrow.copy).toBe(POPUP_COPY.eyebrowEnemy);
      expect(m.action.kind).toBe('contest');
      expect(m.action.label).toBe(CTA_LABELS.attack);
    }
  });

  test('alliance: "ALLIANCE TERRITORY - <TAG>" (alliance blue) with OK', () => {
    const m = territoryCardModel({ properties: { ...enemySmall, ownership: 'alliance', alliance: 'ABC' }, gold: 100 });
    expect(m.eyebrow.kind).toBe('alliance');
    expect(m.eyebrow.tone).toBe('alliance');
    expect(m.eyebrow.copy).toBe(POPUP_COPY.eyebrowAlliance);
    expect(m.eyebrow.copy.defaultValue).toBe('ALLIANCE TERRITORY - {{tag}}');
    expect(m.eyebrow.params).toEqual({ tag: 'ABC' });
    expect(m.action).toBeNull();
    expect(m.confirm.label.defaultValue).toBe('OK');
    const noTag = territoryCardModel({ properties: { ...enemySmall, ownership: 'alliance' }, gold: 100 });
    expect(noTag.eyebrow.copy.defaultValue).toBe('ALLIANCE TERRITORY');
  });

  test('gold 5 with a cost of 10: CTA disabled with the insufficient-gold hint', () => {
    const m = territoryCardModel({ properties: unclaimedSmall, gold: 5 });
    expect(m.action.price).toBe(10);
    expect(m.action.disabled).toBe(true);
    expect(m.action.reason).toBe('insufficient');
    expect(m.action.hint).toBe(POPUP_COPY.notEnoughGold);
    expect(m.action.hint.defaultValue).toBe('Not enough gold');
  });

  test('short on Iron (multi-resource contest) says Not enough iron', () => {
    const m = territoryCardModel({ properties: enemySmall, gold: 100, iron: 2, multiResource: true });
    expect(m.action.hint).toBe(POPUP_COPY.notEnoughIron);
    expect(m.stats[2].value).toBe(POPUP_COPY.statEntryIron);
  });

  test('territory cap disables without the gold hint', () => {
    const m = territoryCardModel({ properties: unclaimedSmall, gold: 100, atCap: true });
    expect(m.action.disabled).toBe(true);
    expect(m.action.hint).toBeNull();
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

describe('territoryOwnership (ownership is data, not colour)', () => {
  const base = { name: 'Lalbagh', owner: 'Mr. ABC', tier: 'Small', perimeterDistance: 900 };

  test.each(['yours', 'alliance', 'enemy', 'unclaimed'])('reads ownership %s from the property', (o) => {
    expect(territoryOwnership({ ...base, ownership: o })).toBe(o);
    expect(territoryCardModel({ properties: { ...base, ownership: o }, gold: 100 }).ownership).toBe(o);
  });

  test('ownership wins over a colour that says otherwise', () => {
    for (const color of [YOURS, ALLIANCE, ENEMY, OLD_YOURS, OLD_ALLIANCE, '#123456', 'transparent']) {
      expect(territoryOwnership({ ...base, ownership: 'enemy', color })).toBe('enemy');
      expect(territoryOwnership({ ...base, ownership: 'yours', color })).toBe('yours');
      expect(territoryOwnership({ ...base, ownership: 'alliance', color })).toBe('alliance');
    }
  });

  test('model state follows ownership: yours and alliance have no CTA, enemy contests, unclaimed claims', () => {
    const m = (o) => territoryCardModel({ properties: { ...base, ownership: o, color: '#000000' }, gold: 100 });
    expect(m('yours').action).toBeNull();
    expect(m('alliance').action).toBeNull();
    expect(m('enemy').action.kind).toBe('contest');
    expect(m('unclaimed').action.kind).toBe('claim');
  });

  test('without ownership, falls back to the colour comparison (current and old hexes)', () => {
    expect(territoryOwnership({ ...base, color: YOURS })).toBe('yours');
    expect(territoryOwnership({ ...base, color: OLD_YOURS })).toBe('yours');
    expect(territoryOwnership({ ...base, color: ALLIANCE })).toBe('alliance');
    expect(territoryOwnership({ ...base, color: OLD_ALLIANCE })).toBe('alliance');
    expect(territoryOwnership({ ...base, color: OLD_ALLIANCE.toLowerCase() })).toBe('alliance');
    expect(territoryOwnership({ ...base, color: ENEMY })).toBe('enemy');
    expect(territoryOwnership({ ...base, color: OLD_ENEMY })).toBe('enemy');
    expect(territoryOwnership({ ...base, owner: 'Unclaimed', color: 'transparent' })).toBe('unclaimed');
    expect(territoryOwnership({ ...base, owner: null })).toBe('unclaimed');
    expect(territoryOwnership(null)).toBe('unclaimed');
  });

  test('an unknown ownership value is ignored in favour of the fallback', () => {
    expect(territoryOwnership({ ...base, ownership: 'mine', color: YOURS })).toBe('yours');
  });
});

describe('territoryOwnershipFor (row / realtime payload -> ownership)', () => {
  const viewer = { userId: 'user_me', myAllianceId: 'al_1' };

  test('yours wins over alliance and enemy', () => {
    expect(territoryOwnershipFor({ ownerClerkId: 'user_me', ownerId: 'p1', allianceId: 'al_1' }, viewer)).toBe('yours');
  });

  test('alliance when both alliance ids are present and equal', () => {
    expect(territoryOwnershipFor({ ownerClerkId: 'user_x', ownerId: 'p2', allianceId: 'al_1' }, viewer)).toBe('alliance');
  });

  test('enemy when owned by someone outside the alliance', () => {
    expect(territoryOwnershipFor({ ownerClerkId: 'user_x', ownerId: 'p2', allianceId: 'al_2' }, viewer)).toBe('enemy');
    expect(territoryOwnershipFor({ ownerClerkId: 'user_x', ownerId: 'p2', allianceId: null }, viewer)).toBe('enemy');
  });

  test('unclaimed without an owner; claimed: true forces enemy', () => {
    expect(territoryOwnershipFor({ ownerClerkId: null, ownerId: null, allianceId: null }, viewer)).toBe('unclaimed');
    expect(territoryOwnershipFor({ ownerClerkId: 'user_x', allianceId: null, claimed: true }, viewer)).toBe('enemy');
  });

  test('null alliance ids on both sides never count as alliance', () => {
    const solo = { userId: 'user_me', myAllianceId: null };
    expect(territoryOwnershipFor({ ownerClerkId: 'user_x', ownerId: 'p2', allianceId: null }, solo)).toBe('enemy');
    expect(territoryOwnershipFor({ ownerClerkId: null, ownerId: null, allianceId: null }, solo)).toBe('unclaimed');
    expect(territoryOwnershipFor({ ownerClerkId: 'user_x', ownerId: 'p2', allianceId: undefined }, { userId: 'user_me' })).toBe('enemy');
  });

  test('a missing userId never matches a missing owner Clerk id', () => {
    expect(territoryOwnershipFor({ ownerId: 'p2' }, { userId: null })).toBe('enemy');
    expect(territoryOwnershipFor({}, {})).toBe('unclaimed');
  });
});
