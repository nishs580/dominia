// Alliance emblems — Living Map Phase 1.
//
// Self-authored placeholder art in the Honor-badge language (flat geometric,
// straight segments, miter joins, integer vertices on an 80×80 grid): one
// shared angular heater-shield silhouette in a Bone hairline, one filled
// glyph per emblem. Designer art can replace GLYPHS 1:1 later — keys and the
// emblemXml() contract are the stable surface, matching the backend enum and
// the alliances_emblem_check DB constraint.
//
// Rendering: in-app UI via components/AllianceEmblem.js (SvgXml); on the map
// via MapboxGL.Images children in MapScreen (one image per key × tint).

export const ALLIANCE_EMBLEMS = [
  'vanguard',
  'bastion',
  'summit',
  'wayfinder',
  'ember',
  'forge',
  'banner',
];

export const DEFAULT_ALLIANCE_EMBLEM = 'vanguard';

export function isAllianceEmblem(key) {
  return ALLIANCE_EMBLEMS.includes(key);
}

// Filled glyphs, sized for the shield interior (roughly x 24–56, y 20–56).
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

/**
 * Returns the full SVG markup for an emblem.
 * Unknown keys return the plain shield with no glyph (never throws) — this is
 * the forward-compat fallback for a client older than a newly added key.
 *
 * @param {string} key emblem key
 * @param {object} [opts]
 * @param {string} [opts.glyph]  glyph fill (relationship tint on the map,
 *                               alliance green in UI)
 * @param {string} [opts.shield] shield outline colour
 * @param {string} [opts.field]  shield interior fill
 */
export function emblemXml(key, { glyph = '#3F8F4E', shield = '#F2EEE6', field = '#0E1014' } = {}) {
  const glyphMarkup = GLYPHS[key] ?? '';
  return (
    '<svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg">' +
    `<path d="M20 14 H60 V42 L40 68 L20 42 Z" fill="${field}" fill-opacity="0.9" ` +
    `stroke="${shield}" stroke-width="3" stroke-linejoin="miter"/>` +
    glyphMarkup.replaceAll('{{G}}', glyph) +
    '</svg>'
  );
}
