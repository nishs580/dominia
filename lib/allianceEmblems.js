// Alliance emblems.
//
// Two glyph sets share one contract (keys + emblemXml / emblemGlyphXml):
//
//   1. Legacy set (Living Map Phase 1): seven filled glyphs on an 80×80 grid
//      inside an angular heater shield. Still valid ids; alliances founded
//      with them keep rendering, and the legacy create flow lists them.
//   2. Dominia-Temp logo set (plan U9): ten stroked line glyphs from the
//      Figma "Alliance Logo" picker (assets/figma/alliance-logos/logo-1..10.svg,
//      path data inlined below so SvgXml can render them without an asset
//      pipeline). The Figma create picker lists only these.
//
// Keys match the backend enum and the alliances_emblem_check DB constraint
// (the new ids need the backend change from plan U12 before they can be
// founded). Unknown keys render the plain shield, never throw.
//
// Rendering: in-app UI via components/AllianceEmblem.js (SvgXml); on the map
// via MapboxGL.Images children in MapScreen (one image per key × tint).
//
// CommonJS (like lib/homeBases.js) so the plain-node jest suite can load it;
// Metro interops it into screen imports transparently.

'use strict';

const LEGACY_ALLIANCE_EMBLEMS = [
  'vanguard',
  'bastion',
  'summit',
  'wayfinder',
  'ember',
  'forge',
  'banner',
];

// Order = Figma picker order = logo-1 … logo-10.
const ALLIANCE_LOGO_EMBLEMS = [
  'glyph_maze',
  'glyph_flask',
  'glyph_bolt',
  'glyph_target',
  'glyph_quad',
  'glyph_peak',
  'glyph_eye',
  'glyph_pulse',
  'glyph_cube',
  'glyph_slash',
];

// Every id that renders (and that the map registers an image for).
const ALLIANCE_EMBLEMS = LEGACY_ALLIANCE_EMBLEMS.concat(ALLIANCE_LOGO_EMBLEMS);

// Legacy create default (unchanged) and the Figma picker default (logo-1).
const DEFAULT_ALLIANCE_EMBLEM = 'vanguard';
const DEFAULT_ALLIANCE_LOGO = 'glyph_maze';

// English accessibility labels, used as i18n defaultValue for emblems.<key>.
const ALLIANCE_EMBLEM_LABELS = {
  vanguard: 'Vanguard',
  bastion: 'Bastion',
  summit: 'Summit',
  wayfinder: 'Wayfinder',
  ember: 'Ember',
  forge: 'Forge',
  banner: 'Banner',
  glyph_maze: 'Maze',
  glyph_flask: 'Flask',
  glyph_bolt: 'Bolt',
  glyph_target: 'Target',
  glyph_quad: 'Quad',
  glyph_peak: 'Peak',
  glyph_eye: 'Eye',
  glyph_pulse: 'Pulse',
  glyph_cube: 'Cube',
  glyph_slash: 'Slash',
};

function isAllianceEmblem(key) {
  return ALLIANCE_EMBLEMS.includes(key);
}

function isAllianceLogo(key) {
  return ALLIANCE_LOGO_EMBLEMS.includes(key);
}

// ── Legacy filled glyphs, sized for the shield interior (x 24–56, y 20–56).
// {{G}} is replaced with the glyph tint colour.
const GLYPHS = {
  // Crossed swords — one sword path mirrored by rotation around the centre.
  vanguard:
    '<g fill="{{G}}">' +
    '<g transform="rotate(45 40 38)">' +
    '<path d="M40 16 L44 24 L44 42 H36 V24 Z"/>' +
    '<rect x="31" y="42" width="18" height="4"/>' +
    '<rect x="38" y="46" width="4" height="8"/>' +
    '</g>' +
    '<g transform="rotate(-45 40 38)">' +
    '<path d="M40 16 L44 24 L44 42 H36 V24 Z"/>' +
    '<rect x="31" y="42" width="18" height="4"/>' +
    '<rect x="38" y="46" width="4" height="8"/>' +
    '</g>' +
    '</g>',
  // Watchtower — three merlons over a stepped shaft.
  bastion:
    '<path fill="{{G}}" d="M30 22 H36 V28 H38 V22 H42 V28 H44 V22 H50 V34 H46 V52 H34 V34 H30 Z"/>',
  // Twin peaks.
  summit:
    '<g fill="{{G}}">' +
    '<path d="M26 48 L38 24 L48 48 Z"/>' +
    '<path d="M40 48 L48 34 L54 48 Z"/>' +
    '</g>',
  // Compass star.
  wayfinder:
    '<path fill="{{G}}" d="M40 20 L44 34 L56 38 L44 42 L40 56 L36 42 L24 38 L36 34 Z"/>',
  // Angular flame.
  ember:
    '<path fill="{{G}}" d="M40 20 L50 34 L46 38 L52 44 L40 56 L28 44 L34 38 L30 34 Z"/>',
  // Anvil with horn.
  forge:
    '<path fill="{{G}}" d="M24 30 H52 V38 H44 V44 H50 V50 H30 V44 H36 V38 H28 L24 36 Z"/>',
  // Pennant on a pole.
  banner:
    '<g fill="{{G}}">' +
    '<rect x="34" y="20" width="3" height="36"/>' +
    '<path d="M37 22 L54 27 L37 32 Z"/>' +
    '</g>',
};

// ── Dominia-Temp line glyphs: path data copied verbatim from
// assets/figma/alliance-logos/logo-N.svg (stroke 2.25, round caps/joins).
const LOGO_GLYPHS = {
  glyph_maze: {
    w: 22.25, h: 22.25,
    paths: ['M11.125 16.125H21.125V6.125M1.125 1.125H16.125V11.125H6.125V21.125H1.125V1.125Z'],
  },
  glyph_flask: {
    w: 19.75, h: 23.5,
    paths: [
      'M1.125 22.375H18.625L13.625 11.125H6.125L1.125 22.375Z',
      'M9.875 1.125L11.5 4.5L15.25 5L12.5 7.625L13.125 11.375L9.875 9.625L6.625 11.375L7.25 7.625L4.5 5L8.25 4.5L9.875 1.125Z',
    ],
  },
  glyph_bolt: {
    w: 22.25, h: 22.25,
    paths: ['M1.125 11.125L7.375 1.125L13.625 11.125H1.125ZM21.125 11.125L14.875 21.125L8.625 11.125H21.125Z'],
  },
  glyph_target: {
    w: 26, h: 17.25,
    paths: [
      'M20.5 8.625C20.5 12.7671 17.1421 16.125 13 16.125C8.85786 16.125 5.5 12.7671 5.5 8.625C5.5 4.48286 8.85786 1.125 13 1.125C17.1421 1.125 20.5 4.48286 20.5 8.625Z',
      'M13 8.625H20.5M1.125 8.625H2.375M23.625 8.625H24.875',
      'M14.5 8.625C14.5 9.45343 13.8284 10.125 13 10.125C12.1716 10.125 11.5 9.45343 11.5 8.625C11.5 7.79657 12.1716 7.125 13 7.125C13.8284 7.125 14.5 7.79657 14.5 8.625Z',
    ],
  },
  glyph_quad: {
    w: 24.75, h: 24.75,
    paths: [
      'M14.625 12.375C14.625 13.6176 13.6176 14.625 12.375 14.625C11.1324 14.625 10.125 13.6176 10.125 12.375C10.125 11.1324 11.1324 10.125 12.375 10.125C13.6176 10.125 14.625 11.1324 14.625 12.375Z',
      'M12.375 10.125C9.875 7.375 9.875 3 12.375 1.125C14.875 3 14.875 7.375 12.375 10.125ZM14.625 12.375C17.375 9.875 21.75 9.875 23.625 12.375C21.75 14.875 17.375 14.875 14.625 12.375ZM12.375 14.625C14.875 17.375 14.875 21.75 12.375 23.625C9.875 21.75 9.875 17.375 12.375 14.625ZM10.125 12.375C7.375 14.875 3 14.875 1.125 12.375C3 9.875 7.375 9.875 10.125 12.375Z',
    ],
  },
  glyph_peak: {
    w: 24.75, h: 23.5,
    paths: ['M12.375 1.125L1.125 22.375H23.625L12.375 1.125ZM12.375 8.625L6.75 18.625H18L12.375 8.625Z'],
  },
  glyph_eye: {
    w: 19.75, h: 19.125,
    paths: [
      'M18.625 12.375C18.625 15.4816 14.7075 18 9.875 18C5.04251 18 1.125 15.4816 1.125 12.375C1.125 9.2684 5.04251 6.75 9.875 6.75C14.7075 6.75 18.625 9.2684 18.625 12.375Z',
      'M11.5 12.375C11.5 13.2725 10.7725 14 9.875 14C8.97754 14 8.25 13.2725 8.25 12.375C8.25 11.4775 8.97754 10.75 9.875 10.75C10.7725 10.75 11.5 11.4775 11.5 12.375Z',
      'M9.875 1.125V2.375M1.75 4.875L2.625 5.75M18 4.875L17.125 5.75',
    ],
  },
  glyph_pulse: {
    w: 21.625, h: 24.75,
    paths: ['M13 7.375V17.375M16.75 9.25V15.5M20.5 11.125V13.625M8.625 1.125C8.625 8.625 6.125 11.125 1.125 12.375C6.125 13.625 8.625 16.125 8.625 23.625V1.125Z'],
  },
  glyph_cube: {
    w: 21, h: 24.75,
    paths: ['M10.5 12.375L15.5 9.5M10.5 12.375V18.125M10.5 12.375L5.5 9.5M5.5 9.5V15.25L10.5 18.125L15.5 15.25V9.5L10.5 6.75L5.5 9.5ZM10.5 1.125L19.875 6.75V18L10.5 23.625L1.125 18V6.75L10.5 1.125Z'],
  },
  glyph_slash: {
    w: 22.25, h: 22.25,
    paths: [
      'M21.125 4.875C21.125 6.94607 19.4461 8.625 17.375 8.625C15.3039 8.625 13.625 6.94607 13.625 4.875C13.625 2.80393 15.3039 1.125 17.375 1.125C19.4461 1.125 21.125 2.80393 21.125 4.875Z',
      'M4.875 6.125L16.125 17.375M8.625 3.625L18.625 13.625M1.125 21.125H13.625L1.125 8.625V21.125Z',
    ],
  },
};

const LOGO_STROKE = 2.25;

function logoPaths(logo, strokeWidth) {
  const attrs =
    `fill="none" stroke="{{G}}" stroke-width="${strokeWidth}" ` +
    'stroke-linecap="round" stroke-linejoin="round"';
  return logo.paths.map((d) => `<path d="${d}" ${attrs}/>`).join('');
}

// A line glyph placed in the shield interior: fitted into a 24-unit box
// centred at (40, 35); the stroke is compensated so it reads ~3.2 units thick.
function logoInShield(logo) {
  const box = 24;
  const s = box / Math.max(logo.w, logo.h);
  const tx = 40 - (logo.w * s) / 2;
  const ty = 35 - (logo.h * s) / 2;
  const r = (n) => Math.round(n * 1000) / 1000;
  return (
    `<g transform="translate(${r(tx)} ${r(ty)}) scale(${r(s)})">` +
    logoPaths(logo, r(3.2 / s)) +
    '</g>'
  );
}

const SHIELD_PATH = 'M20 14 H60 V42 L40 68 L20 42 Z';

/**
 * Returns the full SVG markup for an emblem (shield + glyph).
 * Unknown keys return the plain shield with no glyph (never throws) — this is
 * the forward-compat fallback for a client older than a newly added key.
 *
 * @param {string} key emblem key
 * @param {object} [opts]
 * @param {string} [opts.glyph]  glyph colour (relationship tint on the map,
 *                               alliance blue in UI)
 * @param {string} [opts.shield] shield outline colour
 * @param {string} [opts.field]  shield interior fill
 */
function emblemXml(key, { glyph = '#5B7BF5', shield = '#FDFDFD', field = '#000000' } = {}) {
  let glyphMarkup = '';
  if (LOGO_GLYPHS[key]) glyphMarkup = logoInShield(LOGO_GLYPHS[key]);
  else if (GLYPHS[key]) glyphMarkup = GLYPHS[key];
  return (
    '<svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg">' +
    `<path d="${SHIELD_PATH}" fill="${field}" fill-opacity="0.9" ` +
    `stroke="${shield}" stroke-width="3" stroke-linejoin="miter"/>` +
    glyphMarkup.split('{{G}}').join(glyph) +
    '</svg>'
  );
}

/**
 * Glyph only, no shield: the Figma list rows and the logo picker put the bare
 * glyph on a slanted tile. New logos use their native viewBox; legacy glyphs
 * are cropped from the 80-grid; an unknown key draws the shield outline so
 * the tile is never empty.
 *
 * @param {string} key emblem key
 * @param {object} [opts]
 * @param {string} [opts.color] glyph colour
 */
function emblemGlyphXml(key, { color = '#FDFDFD' } = {}) {
  const logo = LOGO_GLYPHS[key];
  if (logo) {
    return (
      `<svg viewBox="0 0 ${logo.w} ${logo.h}" xmlns="http://www.w3.org/2000/svg">` +
      logoPaths(logo, LOGO_STROKE).split('{{G}}').join(color) +
      '</svg>'
    );
  }
  if (GLYPHS[key]) {
    return (
      '<svg viewBox="16 14 48 48" xmlns="http://www.w3.org/2000/svg">' +
      GLYPHS[key].split('{{G}}').join(color) +
      '</svg>'
    );
  }
  return (
    '<svg viewBox="12 10 56 62" xmlns="http://www.w3.org/2000/svg">' +
    `<path d="${SHIELD_PATH}" fill="none" stroke="${color}" stroke-width="4" stroke-linejoin="miter"/>` +
    '</svg>'
  );
}

module.exports = {
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
};
