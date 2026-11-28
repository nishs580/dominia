/**
 * lib/ageSlider.js
 *
 * Pure maths behind components/AgeSlider (Dominia-Temp "SELECT YOUR AGE").
 * The slider runs 1–100 with ticks at 1 / 25 / 50 / 75 / 100. A touch at x
 * on a track of width w maps to round(1 + p × 99), where p = x / w clamped to
 * 0–1. The value is null until the first touch (no thumb is drawn).
 *
 * CommonJS so the plain-node jest suite can load it.
 */

'use strict';

const { AGE_SLIDER_MIN, AGE_SLIDER_MAX } = require('./onboardingFlow');

const AGE_TICKS = Object.freeze([1, 25, 50, 75, 100]);

function clampAge(n) {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v)) return AGE_SLIDER_MIN;
  return Math.min(AGE_SLIDER_MAX, Math.max(AGE_SLIDER_MIN, v));
}

/** Age for a position p in 0–1 along the track (clamped). */
function ageFromRatio(p) {
  const r = Math.min(1, Math.max(0, Number(p) || 0));
  return clampAge(AGE_SLIDER_MIN + r * (AGE_SLIDER_MAX - AGE_SLIDER_MIN));
}

/** Age for a touch x offset on a track `width` wide. null before layout. */
function ageFromOffset(x, width) {
  const w = Number(width);
  if (!Number.isFinite(w) || w <= 0) return null;
  return ageFromRatio(Number(x) / w);
}

/** Position (0–1) of an age along the track. */
function ratioForAge(age) {
  return (clampAge(age) - AGE_SLIDER_MIN) / (AGE_SLIDER_MAX - AGE_SLIDER_MIN);
}

/**
 * Accessibility increment / decrement, clamped to 1–100. With no value yet,
 * either action sets the first value, 1.
 */
function stepAge(age, delta) {
  if (age == null) return AGE_SLIDER_MIN;
  return clampAge(Number(age) + Number(delta || 0));
}

module.exports = { AGE_TICKS, clampAge, ageFromRatio, ageFromOffset, ratioForAge, stepAge };
