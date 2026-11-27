// Outline icons for the Figma map chrome (Updated UX prototype, plan U8/U10):
// side rail (layers, crosshair, trophy, list, bubble), search magnifier,
// territory card meta (pin, clock), Relocate (pin, flag) and the defend
// pop-up shield. 24-unit viewBox, 1.75 stroke, square-ish line caps so they
// sit with the Geist Mono chrome.

import React from 'react';
import Svg, { Circle, Line, Path, Polyline } from 'react-native-svg';

const DEFAULT_SIZE = 18;
const DEFAULT_COLOR = '#FDFDFD';
const STROKE = 1.75;

function Icon({ size, children }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {children}
    </Svg>
  );
}

const line = (color, strokeWidth) => ({
  stroke: color,
  strokeWidth,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  fill: 'none',
});

export function LayersIcon({ size = DEFAULT_SIZE, color = DEFAULT_COLOR, strokeWidth = STROKE }) {
  const p = line(color, strokeWidth);
  return (
    <Icon size={size}>
      <Path {...p} d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z" />
      <Path {...p} d="M22 17.65l-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65" />
      <Path {...p} d="M22 12.65l-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65" />
    </Icon>
  );
}

export function CrosshairIcon({ size = DEFAULT_SIZE, color = DEFAULT_COLOR, strokeWidth = STROKE }) {
  const p = line(color, strokeWidth);
  return (
    <Icon size={size}>
      <Line {...p} x1="2" y1="12" x2="5" y2="12" />
      <Line {...p} x1="19" y1="12" x2="22" y2="12" />
      <Line {...p} x1="12" y1="2" x2="12" y2="5" />
      <Line {...p} x1="12" y1="19" x2="12" y2="22" />
      <Circle {...p} cx="12" cy="12" r="7" />
      <Circle {...p} cx="12" cy="12" r="3" />
    </Icon>
  );
}

export function TrophyIcon({ size = DEFAULT_SIZE, color = DEFAULT_COLOR, strokeWidth = STROKE }) {
  const p = line(color, strokeWidth);
  return (
    <Icon size={size}>
      <Path {...p} d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <Path {...p} d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <Path {...p} d="M4 22h16" />
      <Path {...p} d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
      <Path {...p} d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
      <Path {...p} d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
    </Icon>
  );
}

export function ListIcon({ size = DEFAULT_SIZE, color = DEFAULT_COLOR, strokeWidth = STROKE }) {
  const p = line(color, strokeWidth);
  return (
    <Icon size={size}>
      <Line {...p} x1="8" y1="6" x2="21" y2="6" />
      <Line {...p} x1="8" y1="12" x2="21" y2="12" />
      <Line {...p} x1="8" y1="18" x2="21" y2="18" />
      <Line {...p} x1="3" y1="6" x2="3.01" y2="6" />
      <Line {...p} x1="3" y1="12" x2="3.01" y2="12" />
      <Line {...p} x1="3" y1="18" x2="3.01" y2="18" />
    </Icon>
  );
}

export function BubbleIcon({ size = DEFAULT_SIZE, color = DEFAULT_COLOR, strokeWidth = STROKE }) {
  return (
    <Icon size={size}>
      <Path {...line(color, strokeWidth)} d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
    </Icon>
  );
}

export function SearchIcon({ size = DEFAULT_SIZE, color = DEFAULT_COLOR, strokeWidth = STROKE }) {
  const p = line(color, strokeWidth);
  return (
    <Icon size={size}>
      <Circle {...p} cx="11" cy="11" r="8" />
      <Path {...p} d="M21 21l-4.3-4.3" />
    </Icon>
  );
}

export function PinIcon({ size = DEFAULT_SIZE, color = DEFAULT_COLOR, strokeWidth = STROKE }) {
  const p = line(color, strokeWidth);
  return (
    <Icon size={size}>
      <Path {...p} d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <Circle {...p} cx="12" cy="10" r="3" />
    </Icon>
  );
}

export function ClockIcon({ size = DEFAULT_SIZE, color = DEFAULT_COLOR, strokeWidth = STROKE }) {
  const p = line(color, strokeWidth);
  return (
    <Icon size={size}>
      <Circle {...p} cx="12" cy="12" r="10" />
      <Polyline {...p} points="12 6 12 12 16 14" />
    </Icon>
  );
}

export function FlagIcon({ size = DEFAULT_SIZE, color = DEFAULT_COLOR, strokeWidth = STROKE }) {
  const p = line(color, strokeWidth);
  return (
    <Icon size={size}>
      <Path {...p} d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
      <Line {...p} x1="4" y1="22" x2="4" y2="15" />
    </Icon>
  );
}

export function ShieldIcon({ size = DEFAULT_SIZE, color = DEFAULT_COLOR, strokeWidth = STROKE }) {
  return (
    <Icon size={size}>
      <Path
        {...line(color, strokeWidth)}
        d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"
      />
    </Icon>
  );
}

// Dominia-Temp map header and rail (plan U5): coin and bolt for the gold
// and level pills, locate arrow, history (log) and square chat bubble.
export function CoinIcon({ size = DEFAULT_SIZE, color = DEFAULT_COLOR, strokeWidth = STROKE }) {
  const p = line(color, strokeWidth);
  return (
    <Icon size={size}>
      <Circle {...p} cx="12" cy="12" r="9" />
      <Line {...p} x1="12" y1="8" x2="12" y2="12" />
      <Line {...p} x1="12" y1="16" x2="12.01" y2="16" />
    </Icon>
  );
}

export function BoltIcon({ size = DEFAULT_SIZE, color = DEFAULT_COLOR, strokeWidth = STROKE }) {
  return (
    <Icon size={size}>
      <Path {...line(color, strokeWidth)} d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" />
    </Icon>
  );
}

export function NavigateIcon({ size = DEFAULT_SIZE, color = DEFAULT_COLOR, strokeWidth = STROKE }) {
  return (
    <Icon size={size}>
      <Path {...line(color, strokeWidth)} d="M3 11 22 2l-9 19-2-8-8-2Z" />
    </Icon>
  );
}

export function HistoryIcon({ size = DEFAULT_SIZE, color = DEFAULT_COLOR, strokeWidth = STROKE }) {
  const p = line(color, strokeWidth);
  return (
    <Icon size={size}>
      <Path {...p} d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <Path {...p} d="M3 3v5h5" />
      <Polyline {...p} points="12 7 12 12 16 14" />
    </Icon>
  );
}

export function MessageSquareIcon({ size = DEFAULT_SIZE, color = DEFAULT_COLOR, strokeWidth = STROKE }) {
  return (
    <Icon size={size}>
      <Path {...line(color, strokeWidth)} d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </Icon>
  );
}
