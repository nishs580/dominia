import React from 'react';
import { SvgXml } from 'react-native-svg';
import { emblemXml } from '../lib/allianceEmblems';

/**
 * Renders an alliance emblem (shield + glyph) at a given size.
 * Unknown/null keys render the plain shield fallback via emblemXml.
 */
export default function AllianceEmblem({ emblem, size = 24, glyph, shield, field }) {
  const xml = emblemXml(emblem, {
    ...(glyph ? { glyph } : {}),
    ...(shield ? { shield } : {}),
    ...(field ? { field } : {}),
  });
  return <SvgXml xml={xml} width={size} height={size} />;
}
