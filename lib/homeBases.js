// Home base structures — Living Map Phase 2.
//
// Self-authored placeholder art in the same language as lib/allianceEmblems.js
// (flat geometric, straight segments, integer vertices, 80×80 grid). Four
// structures encode the player's level band; appearance is purely
// level-derived (cosmetic system is deferred — no customisation).
//
// BASE_GLYPHS is the designer replacement point; baseXml(tier, { tint }) is
// the stable contract. Rendered onto the map via MapboxGL.Images in MapScreen.

// CommonJS (like lib/formulas.js) so the plain-node jest suite can load it;
// Metro interops it into screen imports transparently.
const BASE_TIERS = ['camp', 'outpost', 'keep', 'citadel'];

// Level bands align with the game's structural breakpoints: solo-protected
// phase (1–3), contestable solo (4–5), alliance play (6–8), endgame (9–10).
function baseTierForLevel(level) {
  const lv = Number(level) || 1;
  if (lv >= 9) return 'citadel';
  if (lv >= 6) return 'keep';
  if (lv >= 4) return 'outpost';
  return 'camp';
}

// Filled structure silhouettes with a door notch; ground line under each.
// {{T}} is replaced with the tint colour.
const BASE_GLYPHS = {
  // Tent.
  camp:
    '<g fill="{{T}}">' +
    '<path fill-rule="evenodd" d="M22 54 L40 28 L58 54 Z M36 54 L40 44 L44 54 Z"/>' +
    '<rect x="18" y="54" width="44" height="3"/>' +
    '</g>',
  // Palisade hut.
  outpost:
    '<g fill="{{T}}">' +
    '<path d="M24 38 L40 24 L56 38 Z"/>' +
    '<path d="M28 40 H52 V54 H43 V45 H37 V54 H28 Z"/>' +
    '<rect x="20" y="42" width="3" height="12"/>' +
    '<rect x="57" y="42" width="3" height="12"/>' +
    '<rect x="18" y="54" width="44" height="3"/>' +
    '</g>',
  // Crenellated stone tower.
  keep:
    '<g fill="{{T}}">' +
    '<path d="M28 22 H33 V27 H37 V22 H43 V27 H47 V22 H52 V32 H50 V54 H43 V45 H37 V54 H30 V32 H28 Z"/>' +
    '<rect x="18" y="54" width="44" height="3"/>' +
    '</g>',
  // Central tower flanked by side towers.
  citadel:
    '<g fill="{{T}}">' +
    '<path d="M18 34 H22 V38 H26 V34 H30 V54 H18 Z"/>' +
    '<path d="M50 34 H54 V38 H58 V34 H62 V54 H50 Z"/>' +
    '<path d="M32 20 H36 V25 H39 V20 H41 V25 H44 V20 H48 V32 H46 V54 H43 V45 H37 V54 H34 V32 H32 Z"/>' +
    '<rect x="16" y="54" width="48" height="3"/>' +
    '</g>',
};

/**
 * Returns full SVG markup for a base structure.
 * Unknown tiers fall back to the camp (never throws).
 *
 * @param {string} tier one of BASE_TIERS
 * @param {object} [opts]
 * @param {string} [opts.tint] structure fill — Claim red for the player's own
 *                             base, Bone for everyone else's
 */
function baseXml(tier, { tint = '#F2EEE6' } = {}) {
  const glyph = BASE_GLYPHS[tier] ?? BASE_GLYPHS.camp;
  return (
    '<svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg">' +
    glyph.replaceAll('{{T}}', tint) +
    '</svg>'
  );
}

module.exports = { BASE_TIERS, baseTierForLevel, baseXml };
