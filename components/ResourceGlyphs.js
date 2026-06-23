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

export function ChatGlyph({ size = DEFAULT_SIZE, color = DEFAULT_COLOR, strokeWidth = STROKE }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 18 18">
      <Path
        d="M2.5 3 H15.5 V11.5 H7.5 L4.5 14.5 V11.5 H2.5 Z"
        stroke={color}
        strokeWidth={strokeWidth}
        fill="none"
      />
      <Line x1="5" y1="6" x2="13" y2="6" stroke={color} strokeWidth={1.2} />
      <Line x1="5" y1="8.5" x2="11" y2="8.5" stroke={color} strokeWidth={1.2} />
    </Svg>
  );
}

export function BoardsGlyph({ size = DEFAULT_SIZE, color = DEFAULT_COLOR, strokeWidth = STROKE }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 18 18">
      <Rect x="2.5" y="9.5" width="3.2" height="5" stroke={color} strokeWidth={strokeWidth} fill="none" />
      <Rect x="7.4" y="3.5" width="3.2" height="11" stroke={color} strokeWidth={strokeWidth} fill="none" />
      <Rect x="12.3" y="6.5" width="3.2" height="8" stroke={color} strokeWidth={strokeWidth} fill="none" />
    </Svg>
  );
}

export function LogGlyph({ size = DEFAULT_SIZE, color = DEFAULT_COLOR, strokeWidth = STROKE }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 18 18">
      <Rect x="2.5" y="4" width="2.5" height="2.5" fill={color} />
      <Line x1="6.75" y1="5.25" x2="15.5" y2="5.25" stroke={color} strokeWidth={strokeWidth} />
      <Rect x="2.5" y="8" width="2.5" height="2.5" fill={color} />
      <Line x1="6.75" y1="9.25" x2="15.5" y2="9.25" stroke={color} strokeWidth={strokeWidth} />
      <Rect x="2.5" y="12" width="2.5" height="2.5" fill={color} />
      <Line x1="6.75" y1="13.25" x2="13" y2="13.25" stroke={color} strokeWidth={strokeWidth} />
    </Svg>
  );
}

export function MapGlyph({ size = DEFAULT_SIZE, color = DEFAULT_COLOR, strokeWidth = STROKE }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 18 18">
      <Path
        d="M2 5 L7 3.5 L12 5 L16 3.5 L16 13 L12 14.5 L7 13 L2 14.5 Z"
        stroke={color}
        strokeWidth={strokeWidth}
        fill="none"
        strokeLinejoin="round"
      />
      <Line x1="7" y1="3.5" x2="7" y2="13" stroke={color} strokeWidth={strokeWidth} />
      <Line x1="12" y1="5" x2="12" y2="14.5" stroke={color} strokeWidth={strokeWidth} />
    </Svg>
  );
}

export function ActivityGlyph({ size = DEFAULT_SIZE, color = DEFAULT_COLOR, strokeWidth = STROKE }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 18 18">
      <Polyline
        points="2,9 5.5,9 7.5,4.5 10.5,13.5 12.5,9 16,9"
        stroke={color}
        strokeWidth={strokeWidth}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function AllianceGlyph({ size = DEFAULT_SIZE, color = DEFAULT_COLOR, strokeWidth = STROKE }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 18 18">
      <Circle cx="6.5" cy="6" r="2.3" stroke={color} strokeWidth={strokeWidth} fill="none" />
      <Circle cx="11.5" cy="6" r="2.3" stroke={color} strokeWidth={strokeWidth} fill="none" />
      <Path
        d="M2.5 15 C2.5 11.2 4.3 10 6.5 10 C8.7 10 10.5 11.2 10.5 15"
        stroke={color}
        strokeWidth={strokeWidth}
        fill="none"
        strokeLinecap="round"
      />
      <Path
        d="M7.5 15 C7.5 11.2 9.3 10 11.5 10 C13.7 10 15.5 11.2 15.5 15"
        stroke={color}
        strokeWidth={strokeWidth}
        fill="none"
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function ProfileGlyph({ size = DEFAULT_SIZE, color = DEFAULT_COLOR, strokeWidth = STROKE }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 18 18">
      <Circle cx="9" cy="6" r="2.9" stroke={color} strokeWidth={strokeWidth} fill="none" />
      <Path
        d="M3.5 15.5 C3.5 10.8 6 9.5 9 9.5 C12 9.5 14.5 10.8 14.5 15.5"
        stroke={color}
        strokeWidth={strokeWidth}
        fill="none"
        strokeLinecap="round"
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
