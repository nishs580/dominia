// Line glyphs for the Figma Missions tab and its explainer (E1–E5): clock
// (refresh line), lock (locked tab and banner), footsteps (MARCH), map pin
// (RANGE) and the circled (i). Same 18-unit grid as ResourceGlyphs.

import React from 'react';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';

const DEFAULT_SIZE = 18;
const DEFAULT_COLOR = '#FDFDFD';
const STROKE = 1.5;

export function ClockGlyph({ size = DEFAULT_SIZE, color = DEFAULT_COLOR, strokeWidth = STROKE }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 18 18">
      <Circle cx="9" cy="9" r="7" stroke={color} strokeWidth={strokeWidth} fill="none" />
      <Path d="M9 5 V9 L11.5 10.5" stroke={color} strokeWidth={strokeWidth} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function LockGlyph({ size = DEFAULT_SIZE, color = DEFAULT_COLOR, strokeWidth = STROKE }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 18 18">
      <Rect x="3.5" y="8" width="11" height="8" stroke={color} strokeWidth={strokeWidth} fill="none" />
      <Path d="M6 8 V5.5 C6 3.8 7.3 2.5 9 2.5 C10.7 2.5 12 3.8 12 5.5 V8" stroke={color} strokeWidth={strokeWidth} fill="none" />
    </Svg>
  );
}

export function StepsGlyph({ size = DEFAULT_SIZE, color = DEFAULT_COLOR, strokeWidth = STROKE }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 18 18">
      <Rect x="2.5" y="4" width="4" height="7" rx="2" stroke={color} strokeWidth={strokeWidth} fill="none" />
      <Line x1="3" y1="13.5" x2="6" y2="13.5" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Rect x="11.5" y="6.5" width="4" height="7" rx="2" stroke={color} strokeWidth={strokeWidth} fill="none" />
      <Line x1="12" y1="16" x2="15" y2="16" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  );
}

export function PinGlyph({ size = DEFAULT_SIZE, color = DEFAULT_COLOR, strokeWidth = STROKE }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 18 18">
      <Path
        d="M9 16.5 C9 16.5 3.5 11.3 3.5 7.5 C3.5 4.5 6 2 9 2 C12 2 14.5 4.5 14.5 7.5 C14.5 11.3 9 16.5 9 16.5 Z"
        stroke={color}
        strokeWidth={strokeWidth}
        fill="none"
        strokeLinejoin="round"
      />
      <Circle cx="9" cy="7.5" r="2" stroke={color} strokeWidth={strokeWidth} fill="none" />
    </Svg>
  );
}

export function InfoGlyph({ size = DEFAULT_SIZE, color = DEFAULT_COLOR, strokeWidth = STROKE }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 18 18">
      <Circle cx="9" cy="9" r="7.25" stroke={color} strokeWidth={strokeWidth} fill="none" />
      <Line x1="9" y1="8" x2="9" y2="12.5" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Circle cx="9" cy="5.5" r="0.9" fill={color} />
    </Svg>
  );
}
