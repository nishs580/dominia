// Component: DevGlyph — territory development (D0–D4) as four ascending wall
// segments instead of a bare digit. Filled up to the current level, hairline
// outlines for the rest. Flat fills, 0px radius, no decoration (brand).

import React from 'react';
import Svg, { Rect } from 'react-native-svg';

const BONE = '#F2EEE6';
const HAIRLINE_STRONG = 'rgba(242,238,230,0.35)';

export default function DevGlyph({ level = 0, height = 14, color = BONE }) {
  const lv = Math.min(4, Math.max(0, Math.round(Number(level) || 0)));
  const barW = 4;
  const gap = 2;
  const width = barW * 4 + gap * 3;
  const heights = [0.4, 0.6, 0.8, 1.0];

  return (
    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {heights.map((h, i) => {
        const barH = Math.round(h * height);
        const filled = i < lv;
        return (
          <Rect
            key={i}
            x={i * (barW + gap) + (filled ? 0 : 0.5)}
            y={height - barH + (filled ? 0 : 0.5)}
            width={filled ? barW : barW - 1}
            height={filled ? barH : barH - 1}
            fill={filled ? color : 'none'}
            stroke={filled ? 'none' : HAIRLINE_STRONG}
            strokeWidth={filled ? 0 : 1}
          />
        );
      })}
    </Svg>
  );
}
