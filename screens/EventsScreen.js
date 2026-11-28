// Events tab (legacy_tabs off). Figma G11 draws it as a placeholder: a
// calendar icon, a COMING SOON chip, the "Events are coming" headline and one
// line of body copy, centred (plan 2026-11-27 U13, R-F6).

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Line, Rect } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import TabScreenHeader from '../components/TabScreenHeader';
import { colors, fonts } from '../lib/theme';

function CalendarGlyph({ size = 36, color = colors.muted2 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 36 36">
      <Rect x="3.5" y="6.5" width="29" height="26" stroke={color} strokeWidth={1.5} fill="none" />
      <Line x1="3.5" y1="13.5" x2="32.5" y2="13.5" stroke={color} strokeWidth={1.5} />
      <Line x1="11" y1="2.5" x2="11" y2="9.5" stroke={color} strokeWidth={1.5} />
      <Line x1="25" y1="2.5" x2="25" y2="9.5" stroke={color} strokeWidth={1.5} />
    </Svg>
  );
}

export default function EventsScreen() {
  const { t } = useTranslation();
  return (
    <View style={styles.screen}>
      <TabScreenHeader title={t('events.title')} />
      <View style={styles.body}>
        <View
          style={styles.panel}
          accessible
          accessibilityLabel={`${t('events.comingSoon')}. ${t('events.headline')}. ${t('events.comingSoonBody')}`}
        >
          <CalendarGlyph />
          <View style={styles.chip}>
            <Text style={styles.chipText} maxFontSizeMultiplier={1.3}>{t('events.comingSoon')}</Text>
          </View>
          <Text style={styles.headline} maxFontSizeMultiplier={1.2}>{t('events.headline')}</Text>
          <Text style={styles.panelBody}>{t('events.comingSoonBody')}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.ink,
  },
  body: {
    flex: 1,
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  panel: {
    alignItems: 'center',
  },
  chip: {
    marginTop: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: colors.limeSoft,
  },
  chipText: {
    fontFamily: fonts.mono,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    color: colors.lime,
  },
  headline: {
    marginTop: 14,
    fontFamily: fonts.display,
    fontSize: 26,
    textTransform: 'uppercase',
    color: colors.bone,
    textAlign: 'center',
  },
  panelBody: {
    marginTop: 10,
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 22,
    color: colors.muted2,
    textAlign: 'center',
  },
});
