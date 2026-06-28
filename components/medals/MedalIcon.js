import React from 'react';
import Svg, { Polygon, Polyline, Line, Path, Rect, Circle, G } from 'react-native-svg';
import { CATEGORY_SHAPE } from '../../lib/legacyMedals';

// All geometry is authored in an 80x80 grid (per the design spec), scaled to `size`.
const BONE = '#F2EEE6';

// ---- Category silhouettes (thin Bone perimeter) -------------------------------
const SILHOUETTE_POINTS = {
  triangle: '40,12 70,66 10,66',
  diamond: '40,8 72,40 40,72 8,40',
  hexagon: '24,16 56,16 72,40 56,64 24,64 8,40', // flat-top
};

function Silhouette({ shape, stroke, strokeWidth, opacity }) {
  if (shape === 'square') {
    return (
      <Rect
        x={12}
        y={12}
        width={56}
        height={56}
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinejoin="miter"
        opacity={opacity}
      />
    );
  }
  return (
    <Polygon
      points={SILHOUETTE_POINTS[shape]}
      fill="none"
      stroke={stroke}
      strokeWidth={strokeWidth}
      strokeLinejoin="miter"
      opacity={opacity}
    />
  );
}

// Scaled-down concentric silhouette — the "singular" inner rule.
function InnerFrame({ shape, stroke }) {
  const scale = 0.72;
  const c = 40;
  if (shape === 'square') {
    const w = 56 * scale;
    return (
      <Rect
        x={c - w / 2}
        y={c - w / 2}
        width={w}
        height={w}
        fill="none"
        stroke={stroke}
        strokeWidth={0.75}
        opacity={0.32}
      />
    );
  }
  const pts = SILHOUETTE_POINTS[shape]
    .split(' ')
    .map((p) => {
      const [x, y] = p.split(',').map(Number);
      return `${c + (x - c) * scale},${c + (y - c) * scale}`;
    })
    .join(' ');
  return (
    <Polygon points={pts} fill="none" stroke={stroke} strokeWidth={0.75} opacity={0.32} />
  );
}

// ---- Interior glyphs per medal key -------------------------------------------
function Glyph({ medalKey, stroke }) {
  const p = { stroke, strokeWidth: 1.5, fill: 'none', strokeLinejoin: 'miter', strokeLinecap: 'square' };
  switch (medalKey) {
    // Combat
    case 'combat.first_blood': // pennant
      return (
        <G>
          <Line x1={38} y1={32} x2={38} y2={58} {...p} />
          <Polyline points="38,33 54,38 38,43" {...p} />
        </G>
      );
    case 'combat.conqueror': // crossed swords
      return (
        <G>
          <Line x1={30} y1={38} x2={50} y2={58} {...p} />
          <Line x1={50} y1={38} x2={30} y2={58} {...p} />
        </G>
      );
    case 'combat.trophy_hunter': // mountain peaks
      return <Polyline points="28,56 37,42 44,50 52,38 60,56" {...p} />;
    case 'combat.reclaimer': // return arrow
      return (
        <G>
          <Polyline points="52,42 36,42 36,54" {...p} />
          <Polyline points="42,36 36,42 42,48" {...p} />
        </G>
      );
    // Defense
    case 'defense.the_wall': // brick courses
      return (
        <G>
          <Line x1={28} y1={40} x2={52} y2={40} {...p} />
          <Line x1={28} y1={48} x2={52} y2={48} {...p} />
          <Line x1={40} y1={40} x2={40} y2={48} {...p} />
          <Line x1={34} y1={48} x2={34} y2={56} {...p} />
          <Line x1={46} y1={48} x2={46} y2={56} {...p} />
          <Line x1={28} y1={56} x2={52} y2={56} {...p} />
        </G>
      );
    case 'defense.bulwark': // shield
      return <Polyline points="30,38 40,34 50,38 50,48 40,58 30,48 30,38" {...p} />;
    case 'defense.guardian': // tower with crenellations
      return (
        <G>
          <Polyline points="32,40 32,58 48,58 48,40" {...p} />
          <Polyline points="32,40 32,36 36,36 36,40 40,40 40,36 44,36 44,40 48,40 48,36" {...p} />
        </G>
      );
    case 'defense.immovable': // anvil / block
      return (
        <G>
          <Rect x={30} y={40} width={20} height={8} {...p} />
          <Line x1={36} y1={48} x2={44} y2={48} {...p} />
          <Line x1={40} y1={48} x2={40} y2={56} {...p} />
        </G>
      );
    // Distance
    case 'distance.pathfinder': // compass needle
      return (
        <G>
          <Polygon points="40,32 45,40 40,48 35,40" fill={stroke} opacity={0.9} />
          <Line x1={40} y1={28} x2={40} y2={52} {...p} />
          <Line x1={28} y1={40} x2={52} y2={40} {...p} />
        </G>
      );
    case 'distance.iron_legs': // dumbbell
      return (
        <G>
          <Line x1={32} y1={44} x2={48} y2={44} {...p} />
          <Line x1={32} y1={38} x2={32} y2={50} {...p} />
          <Line x1={48} y1={38} x2={48} y2={50} {...p} />
        </G>
      );
    case 'distance.daily_marcher': // tally marks
      return (
        <G>
          <Line x1={33} y1={38} x2={33} y2={50} {...p} />
          <Line x1={38} y1={38} x2={38} y2={50} {...p} />
          <Line x1={43} y1={38} x2={43} y2={50} {...p} />
          <Line x1={48} y1={38} x2={48} y2={50} {...p} />
          <Line x1={30} y1={52} x2={51} y2={36} {...p} />
        </G>
      );
    case 'distance.war_marcher': // arrow through
      return (
        <G>
          <Line x1={30} y1={44} x2={50} y2={44} {...p} />
          <Polyline points="44,38 50,44 44,50" {...p} />
        </G>
      );
    // Endurance
    case 'endurance.unbroken': // concentric diamond
      return <Polygon points="40,32 50,44 40,56 30,44" {...p} />;
    case 'endurance.phoenix': // flame
      return (
        <Path
          d="M40,56 C32,50 34,42 38,38 C39,42 41,42 42,40 C46,44 48,50 40,56 Z"
          {...p}
        />
      );
    case 'endurance.eternal': // hourglass
      return (
        <G>
          <Polyline points="32,34 48,34 40,44 48,54 32,54 40,44 32,34" {...p} />
          <Circle cx={40} cy={44} r={1.2} fill={stroke} />
        </G>
      );
    case 'endurance.time_served': // calendar grid
      return (
        <G>
          {[0, 1, 2].map((r) =>
            [0, 1, 2].map((cl) => (
              <Rect
                key={`${r}-${cl}`}
                x={32 + cl * 6}
                y={36 + r * 6}
                width={4}
                height={4}
                {...p}
                strokeWidth={1}
              />
            )),
          )}
        </G>
      );
    default:
      return <Circle cx={40} cy={44} r={6} {...p} />;
  }
}

/**
 * Renders a single medal icon: its category silhouette, interior glyph, and (for
 * singular medals) the inner concentric frame. `earned` dims locked medals.
 * Built on an 80x80 grid so the real Phase-2 SVGs can drop in with no layout change.
 */
export default function MedalIcon({ medal, size = 64, earned, color = BONE }) {
  const shape = CATEGORY_SHAPE[medal.category] ?? 'square';
  const isEarned = earned ?? medal != null;
  const opacity = isEarned ? 1 : 0.28;
  const isSingular =
    medal.type === 'singular_count' || medal.type === 'singular_oneoff';

  return (
    <Svg width={size} height={size} viewBox="0 0 80 80">
      <G opacity={opacity}>
        <Silhouette shape={shape} stroke={color} strokeWidth={1.6} opacity={1} />
        {isSingular ? <InnerFrame shape={shape} stroke={color} /> : null}
        <Glyph medalKey={medal.key} stroke={color} />
      </G>
    </Svg>
  );
}
