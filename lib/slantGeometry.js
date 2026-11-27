/**
 * lib/slantGeometry.js
 *
 * Pure polygon maths for the Dominia-Temp shape primitives in components/ui/
 * (plan U2). Shapes are drawn as react-native-svg polygons sized from the
 * measured width and height, so the slant angle stays constant as a control
 * grows. No React, no native imports: safe under jest's node environment.
 */

'use strict';

/** Figma slant for buttons, tiles and tabs (the left edge leans right). */
const SLANT_DEG = 14;
/** Figma diagonal cut on the bottom-right corner of fields, cards and rows. */
const CUT = 8;

const r2 = (n) => Math.round(n * 100) / 100;

function validSize(w, h) {
  return Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0;
}

function toPoints(pts) {
  return pts.map(([x, y]) => `${r2(x)},${r2(y)}`).join(' ');
}

/** Horizontal inset produced by a slant of `slantDeg` over `h`: h·tan(θ). */
function slantInset(h, slantDeg = SLANT_DEG) {
  if (!Number.isFinite(h) || h <= 0 || !Number.isFinite(slantDeg)) return 0;
  return h * Math.tan((slantDeg * Math.PI) / 180);
}

/**
 * Parallelogram filling a w×h box: top edge starts `inset` in from the left,
 * bottom edge ends `inset` short of the right. Points run clockwise from the
 * top-left. `pad` shrinks the box on every side (half a stroke width keeps a
 * border inside the measured box). Returns '' before layout (0 or NaN sizes).
 *
 * @returns {string} SVG points, e.g. "13.96,0 400,0 386.04,56 0,56"
 */
function parallelogramPoints(w, h, slantDeg = SLANT_DEG, pad = 0) {
  if (!validSize(w, h)) return '';
  const p = Number.isFinite(pad) && pad > 0 ? pad : 0;
  const iw = w - 2 * p;
  const ih = h - 2 * p;
  if (iw <= 0 || ih <= 0) return '';
  const inset = Math.min(slantInset(ih, slantDeg), iw / 2);
  return toPoints([
    [p + inset, p],
    [p + iw, p],
    [p + iw - inset, p + ih],
    [p, p + ih],
  ]);
}

/**
 * Rectangle with one corner cut on a 45° diagonal (5 points, clockwise from
 * the top-left; SVG Polygon closes the last edge). `corner` is one of
 * 'br' (default), 'bl', 'tr', 'tl'. Returns '' before layout.
 */
function cutCornerPoints(w, h, cut = CUT, corner = 'br', pad = 0) {
  if (!validSize(w, h)) return '';
  const p = Number.isFinite(pad) && pad > 0 ? pad : 0;
  const x0 = p;
  const y0 = p;
  const x1 = w - p;
  const y1 = h - p;
  if (x1 <= x0 || y1 <= y0) return '';
  const c = Math.max(0, Math.min(Number.isFinite(cut) ? cut : CUT, (x1 - x0) / 2, (y1 - y0) / 2));
  let pts;
  switch (corner) {
    case 'tl':
      pts = [[x0 + c, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0 + c]];
      break;
    case 'tr':
      pts = [[x0, y0], [x1 - c, y0], [x1, y0 + c], [x1, y1], [x0, y1]];
      break;
    case 'bl':
      pts = [[x0, y0], [x1, y0], [x1, y1], [x0 + c, y1], [x0, y1 - c]];
      break;
    case 'br':
    default:
      pts = [[x0, y0], [x1, y0], [x1, y1 - c], [x1 - c, y1], [x0, y1]];
      break;
  }
  return toPoints(pts);
}

/**
 * Press/busy state for SlantButton. Loading and disabled both block presses;
 * only loading is reported as busy to assistive tech.
 *
 * @returns {{ pressable: boolean, busy: boolean }}
 */
function buttonState({ disabled = false, loading = false } = {}) {
  return { pressable: !disabled && !loading, busy: !!loading };
}

/** Parse a points string back into [[x, y], ...] (tests and hit maths). */
function parsePoints(points) {
  if (!points) return [];
  return String(points)
    .trim()
    .split(/\s+/)
    .map((pair) => pair.split(',').map(Number));
}

module.exports = {
  SLANT_DEG,
  CUT,
  slantInset,
  parallelogramPoints,
  cutCornerPoints,
  buttonState,
  parsePoints,
};
