/**
 * lib/__tests__/theme.test.js
 *
 * Dominia-Temp tokens and fonts (redesign plan U1). lib/theme.js is an ES
 * module and the font packages are native assets, so jest (plain node) reads
 * both files from disk as text instead of importing them.
 */

const fs = require('fs');
const path = require('path');
const { territoryOwnership } = require('../territoryCard');

const ROOT = path.join(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

function objectBody(src, opener) {
  const start = src.indexOf(opener);
  if (start < 0) throw new Error(`${opener} not found`);
  const open = src.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') {
      depth--;
      if (depth === 0) return src.slice(open + 1, i);
    }
  }
  throw new Error(`${opener} not closed`);
}

// key: 'value' pairs of a flat token object.
function tokenValues(body) {
  const out = {};
  for (const m of body.matchAll(/^\s*([A-Za-z0-9_]+)\s*:\s*'([^']+)'/gm)) out[m[1]] = m[2];
  return out;
}

const themeSrc = read('lib/theme.js');
const fonts = tokenValues(objectBody(themeSrc, 'export const fonts'));
const colors = tokenValues(objectBody(themeSrc, 'export const colors'));

describe('fonts', () => {
  const useFontsKeys = objectBody(read('App.js'), 'useFonts(')
    .split(',')
    .map((k) => k.replace(/\/\/.*$/gm, '').trim())
    .filter(Boolean);

  test('the font roles parse', () => {
    for (const role of ['display', 'displayBold', 'displayMedium', 'mono', 'monoMedium', 'monoLight', 'body', 'bodyMedium', 'action']) {
      expect(fonts[role]).toEqual(expect.any(String));
    }
  });

  test.each(Object.entries(fonts))('fonts.%s (%s) is loaded by App.js useFonts', (_role, family) => {
    expect(useFontsKeys).toContain(family);
  });
});

describe('no retired font names', () => {
  const RETIRED = ['SofiaSansExtraCondensed_', 'GeistMono_', 'InstrumentSans_'];

  function walk(dir, out = []) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p, out);
      else if (/\.(js|jsx|ts|tsx)$/.test(e.name)) out.push(p);
    }
    return out;
  }

  const files = ['screens', 'components'].flatMap((d) => walk(path.join(ROOT, d)));

  test('there are files to scan', () => {
    expect(files.length).toBeGreaterThan(10);
  });

  test('no screen or component names Sofia, Geist or Instrument fonts', () => {
    const hits = [];
    for (const f of files) {
      const src = fs.readFileSync(f, 'utf8');
      for (const name of RETIRED) {
        if (src.includes(name)) hits.push(`${path.relative(ROOT, f)}: ${name}`);
      }
    }
    expect(hits).toEqual([]);
  });
});

describe('palette', () => {
  test('Dominia-Temp values', () => {
    expect(colors.obsidian).toBe('#000000');
    expect(colors.white).toBe('#FDFDFD');
    expect(colors.action).toBe('#0731D1');
    expect(colors.lime).toBe('#84FF44');
    expect(colors.surfaceLine).toBe('#2A2A2A');
  });

  test('legacy aliases follow the new palette', () => {
    expect(colors.ink).toBe(colors.obsidian);
    expect(colors.ink2).toBe(colors.surface);
    expect(colors.ink3).toBe(colors.raised);
    expect(colors.bone).toBe(colors.white);
    expect(colors.bone2).toBe(colors.white2);
    expect(colors.slate).toBe(colors.muted);
    expect(colors.slate2).toBe(colors.muted2);
    expect(colors.claim).toBe(colors.self);
    expect(colors.claimButton).toBe(colors.action);
    expect(colors.claimSoft).toBe(colors.selfSoft);
  });

  test("territoryCard's colour fallback matches the theme triad", () => {
    const owned = { owner: 'someone' };
    expect(territoryOwnership({ ...owned, color: colors.self })).toBe('yours');
    expect(territoryOwnership({ ...owned, color: colors.alliance })).toBe('alliance');
    expect(territoryOwnership({ ...owned, color: colors.enemy })).toBe('enemy');
  });
});
