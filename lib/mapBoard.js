// lib/mapBoard.js
// The map as a game board.
//
// Everything in here exists to answer one question at a glance: whose ground
// is this? Mapbox ships a *mapping* basemap — restaurants, schools, parks,
// street names, all of it louder than anything we draw. This module turns that
// basemap into a desk surface and gives the territory layers a board language
// of their own: owner-coloured plates, engraved edges, survey nodes.
//
// DESIGN.md sanctions this under the Map-Layer Exception: Mapbox data-layer
// styling is game-board rendering, not UI chrome. The five colours and their
// locked meanings still apply — nothing here invents a colour.

import { colors } from './theme';

// ─── BASEMAP ───────────────────────────────────────────────────────────────
//
// Config keys are all present in the Mapbox Standard v3 style schema (verified
// against the published style JSON); an unknown key would be rejected.
//
// The colour values are CALIBRATED, not guessed. Round 1 assumed the night
// preset darkened these inputs uniformly; measuring the device capture against
// the baseline showed each layer class has its own night multiplier:
//
//   input rgb(240,242,245)  ->  land     #2a3043  (L 48)   ratio 0.20
//   input rgb(240,242,245)  ->  landuse  #424653  (L 70)   ratio 0.29
//   input rgb(240,242,245)  ->  parkland #535868  (L 88)   ratio 0.36
//
// So a single lightness applied across the board came out as a light parkland
// slab brighter than the owned territory itself. The values below divide the
// wanted output by each measured ratio, which lands every ground class on
// roughly the same tone — parkland stops being a slab and becomes ground.
// The scrim below then takes the whole surface down together.

export const BOARD_BASEMAP_CONFIG = {
  // Night at all hours — locked by DESIGN.md §4.
  lightPreset: 'night',

  // Verified on device: these all took. The board carries no pictograms and
  // no Mapbox lettering; the only words on it are territory names.
  showPointOfInterestLabels: false,
  showTransitLabels: false,
  showPlaceLabels: false,
  showRoadLabels: false,
  showLandmarkIcons: false,
  showLandmarkIconLabels: false,
  showAdminBoundaries: false,

  // Flat board. The only massing that rises is a D4 stronghold, which is our
  // own extrusion layer and unaffected by this.
  show3dObjects: false,
  show3dBuildings: false,
  show3dTrees: false,
  show3dLandmarks: false,

  // Kept: this is a game played on foot, and the footway web is the closest
  // thing the board has to terrain.
  showPedestrianRoads: true,

  // One ground tone. Land is the reference; every other ground class is
  // pre-divided by its own night multiplier so it lands on the same value.
  colorLand: 'hsl(220, 6%, 95%)',
  colorCommercial: 'hsl(220, 6%, 65%)',
  colorMedical: 'hsl(220, 6%, 65%)',
  colorEducation: 'hsl(220, 6%, 65%)',
  colorIndustrial: 'hsl(220, 6%, 65%)',
  // Parkland was the brightest object on the whole board in round 1 —
  // brighter than the owned territory. It is ground now.
  colorGreenspace: 'hsl(220, 6%, 52%)',
  // Footprints just under the ground plane: city texture, no colour. Taken
  // down with the roads for the same reason — footprints were reading locally
  // stronger than the parcel fill they sit inside.
  colorBuildings: 'hsl(220, 6%, 58%)',
  // Water reads as a void and deliberately carries no blue — Enemy
  // Slate-Blue must be the only blue on the board.
  colorWater: 'hsl(212, 8%, 40%)',
  // The road web is the board's engraving — but it was engraved too deep.
  // Measured against the round-2 capture, the road web out-contrasted the
  // parcel lattice, so leftover cartography was winning the eye against the
  // game's own ground. Roads still carry the city; they no longer outrank a
  // parcel edge. The ordering between the three road classes is preserved.
  colorRoads: 'hsl(220, 6%, 74%)',
  colorTrunks: 'hsl(220, 6%, 68%)',
  colorMotorways: 'hsl(220, 6%, 70%)',
};

// ─── SCRIM ─────────────────────────────────────────────────────────────────
//
// An ink wash over the finished basemap and under every game layer. This is
// the instrument that actually controls board darkness: one number, fully
// ours, rather than a chain of guesses about Mapbox's night tone mapping.
//
// It is not an elevation effect and not chrome — it is the surface the board
// is printed on, and it sits inside the Map-Layer Exception. At 0.58 the
// measured ground (L 48) lands near L 29 while the game layers, which are
// drawn above it, keep their full value. That is where ownership contrast
// comes from: the ground goes quiet, not the territory colours loud.

export const BOARD_SCRIM_STYLE = {
  backgroundColor: colors.ink,
  backgroundOpacity: 0.58,
  backgroundEmissiveStrength: 1.0,
};

// ─── GROUND PATTERN ────────────────────────────────────────────────────────
//
// Held ground is an owner-coloured plate with a bone tick engraved into it.
//
// Round 1 drew the tick in the owner's own colour, which cost value contrast
// and bought no legibility — measured, the hatched parcel came out the same
// brightness as before the change. Bone inverts that: the tick now ADDS
// luminance, so the plate reads at three clear levels (ground ~30, plate
// ~70-85, tick ~105-115) instead of one muddy one.
//
// The lean is the point and it survives the recolour: our side leans one way,
// theirs the other, so a front line is readable without hue at all. That is
// the colour-blind channel, and it is why the hatch stayed.
//
// Tile geometry note: the ticks are inset from every tile edge, so the tile
// borders are fully transparent. Mapbox wants power-of-two pattern images for
// seamless tiling and a view-captured bitmap cannot guarantee that at every
// screen density — empty edges make any seam invisible regardless.

export const HATCH_TILE = 16;

export function hatchTileXml(color, lean = 'right', strokeWidth = 1.4) {
  const T = HATCH_TILE;
  const H = T / 2;
  const m = 1.5; // keeps the tile edges empty
  const segs = [];
  for (const qx of [0, H]) {
    for (const qy of [0, H]) {
      const lo = { x: qx + m, y: qy + m };
      const hi = { x: qx + H - m, y: qy + H - m };
      segs.push(
        lean === 'right'
          ? `M${lo.x} ${hi.y}L${hi.x} ${lo.y}` // "/"
          : `M${lo.x} ${lo.y}L${hi.x} ${hi.y}`, // "\"
      );
    }
  }
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${T}" height="${T}" viewBox="0 0 ${T} ${T}">` +
    `<path d="${segs.join('')}" stroke="${color}" stroke-width="${strokeWidth}" ` +
    `stroke-linecap="butt" fill="none"/></svg>`
  );
}

// Two tiles, not three: the lean carries the side, the plate underneath
// carries the identity. Yours and your alliance's lean together.
export const HATCH_PATTERNS = [
  { name: 'board-hatch-ours', xml: hatchTileXml(colors.bone, 'right', 1.4) },
  { name: 'board-hatch-theirs', xml: hatchTileXml(colors.bone, 'left', 1.4) },
];

export const HATCH_PATTERN_EXPRESSION = [
  'match',
  ['get', 'color'],
  colors.claim, 'board-hatch-ours',
  colors.alliance, 'board-hatch-ours',
  'board-hatch-theirs',
];

// ─── PLAYER PUCK ───────────────────────────────────────────────────────────
//
// In a game played by walking, the commander is the one mark on the board
// that is never in question. Bone, because bone is the brightest thing in the
// palette and is not a territory colour, so the avatar can never be misread
// as ground someone owns.

export const PUCK_HEADING_IMAGE = 'player-heading';
export const PUCK_HEADING_SIZE = 72;

// A wedge pointing up (north in image space); the layer rotates it to the
// player's course. It starts outside the puck's seat ring (radius 15) so it
// reads as a direction of travel rather than a collar around the dot.
export const puckHeadingXml = (() => {
  const S = PUCK_HEADING_SIZE;
  const c = S / 2;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">` +
    `<path d="M${c} ${c - 31}L${c + 8.5} ${c - 17}L${c} ${c - 21}L${c - 8.5} ${c - 17}Z" ` +
    `fill="${colors.bone}"/></svg>`
  );
})();

// ─── SURVEY NODES ──────────────────────────────────────────────────────────
//
// A point at every real corner of every held parcel. This is the single cue
// that stops the board reading as "a shape drawn on a map": held ground is
// pinned down, the way a plotted survey pins its control points. Zoom-gated in
// the layer so a city-wide view stays clean.

const RAD_TO_DEG = 180 / Math.PI;

function ringCorners(ring, latScale, minTurnRad, minSegSq, push) {
  // Rings arrive closed (last point repeats the first); drop the duplicate.
  const n = ring.length - 1;
  if (n < 3) return;
  for (let i = 0; i < n; i += 1) {
    const prev = ring[(i - 1 + n) % n];
    const cur = ring[i];
    const next = ring[(i + 1) % n];

    const ax = (cur[0] - prev[0]) * latScale;
    const ay = cur[1] - prev[1];
    const bx = (next[0] - cur[0]) * latScale;
    const by = next[1] - cur[1];

    // Ignore micro-segments: OSM-derived rings carry clusters of near
    // duplicate vertices that would otherwise smear into a blob of dots.
    if (ax * ax + ay * ay < minSegSq) continue;
    if (bx * bx + by * by < minSegSq) continue;

    const turn = Math.abs(Math.atan2(ax * by - ay * bx, ax * bx + ay * by));
    if (turn < minTurnRad) continue;

    push(cur);
  }
}

/**
 * Point features marking the corners of every claimed territory.
 * @param {object} collection GeoJSON FeatureCollection of territories
 * @returns {object} FeatureCollection of Points carrying { color }
 */
export function territoryNodeFeatures(collection, options = {}) {
  const {
    minTurnDeg = 28,
    minSegmentMetres = 6,
    // A critic spotted two survey dots drawn on top of each other on a live
    // parcel edge. Raising minSegmentMetres was tried first and is the wrong
    // instrument — it also deletes legitimate corners, and at 15m a parcel lost
    // nearly every node it had. The real defect is two KEPT corners landing
    // within a few pixels, so the fix belongs at the output: collapse a corner
    // that falls within this distance of one already emitted for the same ring.
    minNodeSpacingMetres = 14,
    maxPoints = 1800,
  } = options;

  const features = [];
  const minTurnRad = minTurnDeg / RAD_TO_DEG;
  // Degrees of latitude per metre, squared — the planar comparison below runs
  // in latitude-degree units with longitude pre-scaled to match.
  const minSeg = minSegmentMetres / 111320;
  const minSegSq = minSeg * minSeg;
  const minSpacing = minNodeSpacingMetres / 111320;
  const minNodeSpacingSq = minSpacing * minSpacing;

  const list = collection?.features ?? [];
  for (const feature of list) {
    if (features.length >= maxPoints) break;
    const color = feature?.properties?.color;
    if (!color || color === 'transparent') continue;

    const geom = feature.geometry;
    if (!geom) continue;
    const polygons =
      geom.type === 'Polygon'
        ? [geom.coordinates]
        : geom.type === 'MultiPolygon'
          ? geom.coordinates
          : [];

    for (const poly of polygons) {
      const ring = poly?.[0];
      if (!Array.isArray(ring) || ring.length < 4) continue;
      const latScale = Math.cos((ring[0][1] * Math.PI) / 180) || 1;
      const kept = [];
      ringCorners(ring, latScale, minTurnRad, minSegSq, (coord) => {
        if (features.length >= maxPoints) return;
        // Collapse near-coincident corners so a cluster of real-but-adjacent
        // vertices renders as one control point, not a smudge.
        for (const [kx, ky] of kept) {
          const dx = (coord[0] - kx) * latScale;
          const dy = coord[1] - ky;
          if (dx * dx + dy * dy < minNodeSpacingSq) return;
        }
        kept.push([coord[0], coord[1]]);
        features.push({
          type: 'Feature',
          properties: { color },
          geometry: { type: 'Point', coordinates: [coord[0], coord[1]] },
        });
      });
    }
  }

  return { type: 'FeatureCollection', features };
}
