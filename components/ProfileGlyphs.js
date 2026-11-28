// Profile glyphs (Dominia-Temp boards 33, 36–38): the Edit Profile pencil,
// the accordion section tiles (folded map, list, rising chart, gear, bar
// chart) and the territory flag. Moved out of screens/ProfileAccordionScreen
// so the screen stays small; Edit Profile shares ListGlyph. None of these
// match the 24-grid glyphs in MapIcons.js / SocialGlyphs.js, so they stay.

import React from 'react';
import Svg, { Circle, Line, Path, Polyline, Rect } from 'react-native-svg';
import { colors } from '../lib/theme';

export function PencilGlyph({ size = 14, color = colors.white }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20">
      <Path d="M3 17 L3.6 13.6 L13.4 3.8 L16.2 6.6 L6.4 16.4 Z" stroke={color} strokeWidth={1.8} fill="none" />
      <Path d="M11.6 5.6 L14.4 8.4" stroke={color} strokeWidth={1.8} />
    </Svg>
  );
}

// Section glyphs for the accordion tiles (board 33): folded map, list,
// rising chart, gear, bar chart.
const G = { stroke: colors.white, strokeWidth: 1.5, fill: 'none' };
export function MapGlyph() {
  return (
    <Svg width={16} height={16} viewBox="0 0 16 16">
      <Path d="M1.5 3.5 L5.5 2 L10.5 3.5 L14.5 2 V12.5 L10.5 14 L5.5 12.5 L1.5 14 Z" {...G} />
      <Line x1="5.5" y1="2" x2="5.5" y2="12.5" {...G} />
      <Line x1="10.5" y1="3.5" x2="10.5" y2="14" {...G} />
    </Svg>
  );
}
export function ListGlyph({ size = 16 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16">
      <Rect x="2" y="2" width="12" height="12" {...G} />
      <Line x1="5" y1="5.5" x2="11" y2="5.5" {...G} />
      <Line x1="5" y1="8" x2="11" y2="8" {...G} />
      <Line x1="5" y1="10.5" x2="11" y2="10.5" {...G} />
    </Svg>
  );
}
export function ChartGlyph() {
  return (
    <Svg width={16} height={16} viewBox="0 0 16 16">
      <Polyline points="2,10 6,6 9,8.5 14,3.5" {...G} />
      <Polyline points="10.5,3.5 14,3.5 14,7" {...G} />
      <Line x1="3" y1="14" x2="3" y2="12.5" {...G} />
      <Line x1="6.5" y1="14" x2="6.5" y2="10.5" {...G} />
      <Line x1="10" y1="14" x2="10" y2="11.5" {...G} />
      <Line x1="13.5" y1="14" x2="13.5" y2="9.5" {...G} />
    </Svg>
  );
}
const GEAR_SPOKES = [0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
  const r = (deg * Math.PI) / 180;
  return { deg, x1: 8 + Math.cos(r) * 4.6, y1: 8 + Math.sin(r) * 4.6, x2: 8 + Math.cos(r) * 6.6, y2: 8 + Math.sin(r) * 6.6 };
});
export function GearGlyph() {
  return (
    <Svg width={16} height={16} viewBox="0 0 16 16">
      <Circle cx="8" cy="8" r="2.6" {...G} />
      {GEAR_SPOKES.map(({ deg, ...p }) => <Line key={deg} {...p} {...G} />)}
    </Svg>
  );
}
export function BarsGlyph() {
  return (
    <Svg width={16} height={16} viewBox="0 0 16 16">
      <Line x1="3.5" y1="14" x2="3.5" y2="8" {...G} />
      <Line x1="8" y1="14" x2="8" y2="2.5" {...G} />
      <Line x1="12.5" y1="14" x2="12.5" y2="6" {...G} />
    </Svg>
  );
}

export function FlagGlyph({ size = 18, color = colors.self }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 18 18">
      <Path d="M4 2 V16" stroke={color} strokeWidth={1.8} />
      <Path d="M4 3 H13 L11 6 L13 9 H4" stroke={color} strokeWidth={1.8} fill="none" />
    </Svg>
  );
}
