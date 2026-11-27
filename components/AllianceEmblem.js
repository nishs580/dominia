import React from 'react';
import { SvgXml } from 'react-native-svg';
import { emblemGlyphXml, emblemXml } from '../lib/allianceEmblems';

/**
 * Renders an alliance emblem at a given size.
 *
 * variant 'shield' (default): shield + glyph. Unknown/null keys render the
 * plain shield fallback via emblemXml.
 * variant 'glyph': the bare glyph (Figma list rows and logo picker), in
 * `glyph` colour (default white). Unknown keys draw a shield outline.
 */
export default function AllianceEmblem({ emblem, size = 24, glyph, shield, field, variant = 'shield' }) {
  if (variant === 'glyph') {
    return <SvgXml xml={emblemGlyphXml(emblem, glyph ? { color: glyph } : undefined)} width={size} height={size} />;
  }
  const xml = emblemXml(emblem, {
    ...(glyph ? { glyph } : {}),
    ...(shield ? { shield } : {}),
    ...(field ? { field } : {}),
  });
  return <SvgXml xml={xml} width={size} height={size} />;
}
