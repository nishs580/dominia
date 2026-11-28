/**
 * lib/__tests__/allianceEmblems.test.js
 *
 * U9: the ten Dominia-Temp logo glyphs, their order (logo-1..10), the picker
 * default, legacy ids still rendering, and the unknown-id shield fallback.
 */

const fs = require('fs');
const path = require('path');
const {
  ALLIANCE_EMBLEMS,
  LEGACY_ALLIANCE_EMBLEMS,
  ALLIANCE_LOGO_EMBLEMS,
  DEFAULT_ALLIANCE_EMBLEM,
  DEFAULT_ALLIANCE_LOGO,
  ALLIANCE_EMBLEM_LABELS,
  isAllianceEmblem,
  isAllianceLogo,
  emblemXml,
  emblemGlyphXml,
} = require('../allianceEmblems');

const NEW_IDS = [
  'glyph_maze', 'glyph_flask', 'glyph_bolt', 'glyph_target', 'glyph_quad',
  'glyph_peak', 'glyph_eye', 'glyph_pulse', 'glyph_cube', 'glyph_slash',
];
const OLD_IDS = ['vanguard', 'bastion', 'summit', 'wayfinder', 'ember', 'forge', 'banner'];

const plainShield = emblemXml('definitely_not_an_emblem');

describe('logo set', () => {
  test('the picker lists exactly the ten new ids in Figma order, default logo-1', () => {
    expect(ALLIANCE_LOGO_EMBLEMS).toEqual(NEW_IDS);
    expect(DEFAULT_ALLIANCE_LOGO).toBe('glyph_maze');
    expect(isAllianceLogo('vanguard')).toBe(false);
  });

  test('every id (old and new) is valid and has a label', () => {
    expect(ALLIANCE_EMBLEMS).toEqual(OLD_IDS.concat(NEW_IDS));
    expect(LEGACY_ALLIANCE_EMBLEMS).toEqual(OLD_IDS);
    expect(DEFAULT_ALLIANCE_EMBLEM).toBe('vanguard');
    for (const id of ALLIANCE_EMBLEMS) {
      expect(isAllianceEmblem(id)).toBe(true);
      expect(typeof ALLIANCE_EMBLEM_LABELS[id]).toBe('string');
    }
  });

  test('each new id inlines the path data of its logo-N.svg', () => {
    NEW_IDS.forEach((id, i) => {
      const svg = fs.readFileSync(
        path.join(__dirname, '..', '..', 'assets', 'figma', 'alliance-logos', `logo-${i + 1}.svg`),
        'utf8',
      );
      const ds = [...svg.matchAll(/ d="([^"]+)"/g)].map((m) => m[1]);
      expect(ds.length).toBeGreaterThan(0);
      const glyph = emblemGlyphXml(id);
      for (const d of ds) expect(glyph).toContain(`d="${d}"`);
    });
  });
});

describe('emblemXml', () => {
  test('new ids render a glyph inside the shield, tinted', () => {
    for (const id of NEW_IDS) {
      const xml = emblemXml(id, { glyph: '#ABCDEF' });
      expect(xml).not.toBe(plainShield);
      expect(xml).toContain('stroke="#ABCDEF"');
      expect(xml).not.toContain('{{G}}');
    }
  });

  test('old ids keep rendering their filled glyph', () => {
    for (const id of OLD_IDS) {
      const xml = emblemXml(id, { glyph: '#ABCDEF' });
      expect(xml).toContain('fill="#ABCDEF"');
      expect(xml).not.toBe(plainShield);
    }
  });

  test('an unknown id falls back to the plain shield', () => {
    expect(plainShield).toContain('<path d="M20 14 H60 V42 L40 68 L20 42 Z"');
    expect(plainShield.match(/<path/g)).toHaveLength(1);
    expect(emblemXml(null)).toBe(plainShield);
    expect(emblemXml(undefined)).toBe(plainShield);
  });
});

describe('emblemGlyphXml', () => {
  test('bare glyph in the given colour; unknown ids draw a shield outline', () => {
    expect(emblemGlyphXml('glyph_bolt', { color: '#123456' })).toContain('stroke="#123456"');
    expect(emblemGlyphXml('vanguard', { color: '#123456' })).toContain('fill="#123456"');
    const unknown = emblemGlyphXml('nope');
    expect(unknown).toContain('M20 14 H60 V42 L40 68 L20 42 Z');
    expect(unknown).toContain('fill="none"');
  });
});
