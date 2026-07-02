const { BASE_TIERS, baseTierForLevel, baseXml } = require('../homeBases');

describe('baseTierForLevel', () => {
  test.each([
    [1, 'camp'],
    [3, 'camp'],
    [4, 'outpost'],
    [5, 'outpost'],
    [6, 'keep'],
    [8, 'keep'],
    [9, 'citadel'],
    [10, 'citadel'],
  ])('level %i → %s', (level, tier) => {
    expect(baseTierForLevel(level)).toBe(tier);
  });

  test('garbage input falls back to camp', () => {
    expect(baseTierForLevel(undefined)).toBe('camp');
    expect(baseTierForLevel(null)).toBe('camp');
    expect(baseTierForLevel(0)).toBe('camp');
    expect(baseTierForLevel('nope')).toBe('camp');
  });

  test('over-cap levels stay citadel', () => {
    expect(baseTierForLevel(12)).toBe('citadel');
  });
});

describe('baseXml', () => {
  test('every tier renders svg containing the tint', () => {
    for (const tier of BASE_TIERS) {
      const xml = baseXml(tier, { tint: '#D64525' });
      expect(xml).toContain('<svg');
      expect(xml).toContain('#D64525');
      expect(xml).not.toContain('{{T}}');
    }
  });

  test('unknown tier falls back to camp markup, never throws', () => {
    expect(baseXml('palace')).toBe(baseXml('camp'));
  });
});
