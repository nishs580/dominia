// Events tab (legacy_tabs off). Figma draws it as a placeholder; this is the
// "coming soon" panel until events ship (plan U9, R38).

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import TabScreenHeader from '../components/TabScreenHeader';
import { colors, fonts } from '../lib/theme';

export default function EventsScreen() {
  const { t } = useTranslation();
  return (
    <View style={styles.screen}>
      <TabScreenHeader kicker={t('events.kicker')} title={t('events.title')} />
      <View style={styles.body}>
        <View style={styles.panel} accessible accessibilityLabel={`${t('events.comingSoon')}. ${t('events.comingSoonBody')}`}>
          <Text style={styles.panelLabel} maxFontSizeMultiplier={1.3}>{t('events.comingSoon')}</Text>
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
    padding: 16,
  },
  panel: {
    backgroundColor: colors.ink2,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    borderRadius: 0,
    padding: 16,
  },
  panelLabel: {
    fontFamily: fonts.mono,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1.6,
    color: colors.slate2,
  },
  panelBody: {
    marginTop: 8,
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 19,
    color: colors.bone,
  },
});
