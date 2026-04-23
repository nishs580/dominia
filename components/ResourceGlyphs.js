import React from 'react';
import Svg, { Circle, Line, Path, Polygon, Polyline, Rect } from 'react-native-svg';

const DEFAULT_SIZE = 18;
const DEFAULT_COLOR = '#F2EEE6';
const STROKE = 1.5;

export function StoneGlyph({ size = DEFAULT_SIZE, color = DEFAULT_COLOR, strokeWidth = 4 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 18 18">
      <Polygon
        points="9,2 16,6.5 16,11.5 9,16 2,11.5 2,6.5"
        stroke={color}
        strokeWidth={strokeWidth}
        fill="none"
      />
    </Svg>
  );
}

export function IronGlyph({ size = DEFAULT_SIZE, color = DEFAULT_COLOR }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 18 18">
      <Rect
        x="3"
        y="3"
        width="12"
        height="12"
        transform="rotate(45 9 9)"
        stroke={color}
        strokeWidth={1.5}
        fill="none"
      />
      <Rect
        x="5.5"
        y="5.5"
        width="7"
        height="7"
        transform="rotate(45 9 9)"
        stroke={color}
        strokeWidth={1.5}
        fill={color}
      />
    </Svg>
  );
}

export function GoldGlyph({ size = DEFAULT_SIZE, color = DEFAULT_COLOR, strokeWidth = 4 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 18 18">
      <Circle
        cx="9"
        cy="9"
        r="7"
        stroke={color}
        strokeWidth={strokeWidth}
        fill="none"
      />
      <Circle
        cx="9"
        cy="9"
        r="3"
        fill={color}
      />
    </Svg>
  );
}

export function ShieldGlyph({ size = DEFAULT_SIZE, color = DEFAULT_COLOR, strokeWidth = 4 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 18 18">
      <Path
        d="M9,2 L16,5 L16,10 C16,13.5 9,16.5 9,16.5 C9,16.5 2,13.5 2,10 L2,5 Z"
        stroke={color}
        strokeWidth={strokeWidth}
        fill="none"
      />
    </Svg>
  );
}

export function MoraleGlyph({ size = DEFAULT_SIZE, color = DEFAULT_COLOR, strokeWidth = 2.5 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 18 18">
      <Polyline
        points="2,13 6,8 10,10 14,5"
        stroke={color}
        strokeWidth={strokeWidth}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle
        cx="14"
        cy="5"
        r="1.8"
        fill={color}
      />
    </Svg>
  );
}

export function InfluenceGlyph({ size = DEFAULT_SIZE, color = DEFAULT_COLOR }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 18 18">
      <Circle cx="9" cy="9" r="2" fill={color} />
      <Circle
        cx="9"
        cy="9"
        r="5"
        stroke={color}
        strokeWidth={STROKE}
        strokeDasharray="2,2"
        fill="none"
      />
      <Circle
        cx="9"
        cy="9"
        r="7.5"
        stroke={color}
        strokeWidth={STROKE}
        strokeDasharray="2,2"
        fill="none"
      />
    </Svg>
  );
}
