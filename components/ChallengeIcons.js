// components/ChallengeIcons.js
// Line icons for the Figma challenge screens (plan U9): the header glyph per
// kind (flag / sword / shield), the Start walk rows (steps / clock / gold)
// and the lime target on the Securing and Cancelling states.

import React from 'react';
import Svg, { Circle, Line, Path, Polyline } from 'react-native-svg';

const STROKE = 1.6;

export function FlagIcon({ size = 16, color }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16">
      <Line x1="3" y1="1.5" x2="3" y2="14.5" stroke={color} strokeWidth={STROKE} />
      <Path d="M3 2.5 H12 L10 5.5 L12 8.5 H3" stroke={color} strokeWidth={STROKE} fill="none" strokeLinejoin="miter" />
    </Svg>
  );
}

export function SwordIcon({ size = 16, color }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16">
      <Polyline points="14,2 14,5 6.5,12.5 3.5,9.5 11,2 14,2" stroke={color} strokeWidth={STROKE} fill="none" />
      <Line x1="2" y1="8" x2="8" y2="14" stroke={color} strokeWidth={STROKE} />
      <Line x1="4.5" y1="11.5" x2="1.5" y2="14.5" stroke={color} strokeWidth={STROKE} />
    </Svg>
  );
}

export function ShieldIcon({ size = 16, color }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16">
      <Path d="M8 1.5 L13.5 3.5 V8 C13.5 11 11 13.3 8 14.5 C5 13.3 2.5 11 2.5 8 V3.5 Z" stroke={color} strokeWidth={STROKE} fill="none" />
    </Svg>
  );
}

export function ClockIcon({ size = 16, color }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16">
      <Circle cx="8" cy="8" r="6.5" stroke={color} strokeWidth={STROKE} fill="none" />
      <Polyline points="8,4.5 8,8 10.5,9.5" stroke={color} strokeWidth={STROKE} fill="none" />
    </Svg>
  );
}

export function StepsIcon({ size = 16, color }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16">
      <Path d="M4 3 C5.6 3 6 5 6 6.5 C6 8 5.2 9 4 9 C2.8 9 2 8 2 6.5 C2 5 2.4 3 4 3 Z" stroke={color} strokeWidth={STROKE} fill="none" />
      <Path d="M3 11 H5.2 V12.5 C5.2 13.2 4.7 13.7 4.1 13.7 C3.5 13.7 3 13.2 3 12.5 Z" stroke={color} strokeWidth={STROKE} fill="none" />
      <Path d="M12 1.5 C13.6 1.5 14 3.5 14 5 C14 6.5 13.2 7.5 12 7.5 C10.8 7.5 10 6.5 10 5 C10 3.5 10.4 1.5 12 1.5 Z" stroke={color} strokeWidth={STROKE} fill="none" />
      <Path d="M10.8 9.5 H13 V11 C13 11.7 12.5 12.2 11.9 12.2 C11.3 12.2 10.8 11.7 10.8 11 Z" stroke={color} strokeWidth={STROKE} fill="none" />
    </Svg>
  );
}

/** Concentric target: the Gold row's glyph and, larger, the status scrims'. */
export function TargetIcon({ size = 16, color, strokeWidth = STROKE }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 36 36">
      <Circle cx="18" cy="18" r="16" stroke={color} strokeWidth={strokeWidth * 2} fill="none" />
      <Circle cx="18" cy="18" r="9" stroke={color} strokeWidth={strokeWidth * 2} fill="none" />
      <Circle cx="18" cy="18" r="2.5" fill={color} />
    </Svg>
  );
}

/** Header glyph by challengeHeaderModel().icon. */
export function ChallengeKindIcon({ icon, size = 16, color }) {
  if (icon === 'sword') return <SwordIcon size={size} color={color} />;
  if (icon === 'shield') return <ShieldIcon size={size} color={color} />;
  return <FlagIcon size={size} color={color} />;
}
