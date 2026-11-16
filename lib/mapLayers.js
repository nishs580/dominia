// Map layer gating — which Mapbox layers MapScreen mounts for a set of flags.
//
// MAP_LAYERS lists every layer MapScreen declares, in declaration order, with
// the Remote Config flag (if any) that owns it. Layers without a flag are the
// Figma map (territories, labels, alliance emblems) and always mount.
//
// Pure: callers pass resolved flag values in ({ battle_chips: true, ... }), so
// tests can set them without touching lib/flags.js. A missing flag counts as
// off, matching getFlag for unknown names. CommonJS so the plain-node jest
// suite can load it; Metro interops it into screen imports.

const MAP_LAYERS = Object.freeze([
  // territories source
  { id: 'territories-open-fill', flag: null },
  { id: 'territories-fill', flag: null },
  { id: 'territories-hatch', flag: null },
  { id: 'territories-d4-walls', flag: 'territory_development' },
  { id: 'territories-casing', flag: null },
  { id: 'territories-line', flag: null },
  { id: 'territories-open', flag: null },
  { id: 'territories-streak-inner', flag: 'streaks' },
  { id: 'territories-rampart', flag: 'territory_development' },
  { id: 'territories-contested-casing', flag: null },
  { id: 'territories-contested', flag: null },
  { id: 'territories-selected-fill', flag: null },
  { id: 'territories-selected-glow', flag: null },
  { id: 'territories-selected-line', flag: null },
  { id: 'territories-labels', flag: null },
  { id: 'territories-emblems', flag: null },
  { id: 'territories-battle-chips', flag: 'battle_chips' },
  // territory-nodes source
  { id: 'territory-nodes-circles', flag: null },
  // bases source
  { id: 'bases-icons', flag: 'home_bases' },
  { id: 'bases-pennants', flag: 'home_bases' },
  // first-claim-objective source (also needs a live objective to mount)
  { id: 'objective-fill', flag: 'first_claim_objective' },
  { id: 'objective-line', flag: 'first_claim_objective' },
  // celebration source (mounts only while a claim celebration plays)
  { id: 'celebration-fill', flag: null },
  { id: 'celebration-line', flag: null },
]);

/** Layer ids to mount, in declaration order. */
function visibleMapLayers(flags) {
  const f = flags || {};
  return MAP_LAYERS.filter((l) => l.flag == null || f[l.flag] === true).map((l) => l.id);
}

module.exports = { MAP_LAYERS, visibleMapLayers };
