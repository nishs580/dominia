// Shared plumbing for the Dominia-Temp shape primitives (plan U2): measured
// size for the SVG backgrounds, unique gradient ids, and the dev-only
// accessibility label check.

import { useCallback, useId, useState } from 'react';

/** Tracks the measured { w, h } of a view. Starts at 0×0 (empty polygon). */
export function useLayoutSize() {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const onLayout = useCallback((e) => {
    const { width, height } = e.nativeEvent.layout;
    setSize((prev) => (prev.w === width && prev.h === height ? prev : { w: width, h: height }));
  }, []);
  return [size, onLayout];
}

/** SVG-safe unique id for a gradient (React's useId contains colons). */
export function useSvgId(prefix) {
  const raw = useId();
  return `${prefix}${raw.replace(/[^a-zA-Z0-9_-]/g, '')}`;
}

/** Pads a control's hit area up to 44pt tall. */
export function hitSlopFor(height, min = 44) {
  const v = Math.max(0, Math.ceil((min - height) / 2));
  return v > 0 ? { top: v, bottom: v, left: 4, right: 4 } : undefined;
}

/** Dev warning when an interactive primitive has no text and no label. */
export function warnMissingLabel(component, hasText, accessibilityLabel) {
  if (typeof __DEV__ !== 'undefined' && __DEV__ && !hasText && !accessibilityLabel) {
    // eslint-disable-next-line no-console
    console.warn(`${component}: accessibilityLabel is required when there is no text label.`);
  }
}

/**
 * Style for an SVG shape background. Size it with the measured box in plain
 * numbers (width={box.w} height={box.h}): on Android a 100% / absoluteFill SVG
 * resolves against the parent's content box, so padding shrinks the shape.
 */
export const SHAPE_LAYER = { position: 'absolute', top: 0, left: 0 };
