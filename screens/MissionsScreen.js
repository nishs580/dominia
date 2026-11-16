// Missions tab stub (legacy_tabs off). U14 replaces this screen with Figma's
// Missions; until then it holds the tab so navigation and pushes land (plan U9).

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import TabScreenHeader from '../components/TabScreenHeader';
import { colors, fonts } from '../lib/theme';

export default function MissionsScreen() {
  const { t } = useTranslation();
  return (
    <View style={styles.screen}>
      <TabScreenHeader kicker={t('missions.kicker')} title={t('missions.title')} />
      <View style={styles.body}>
        <View style={styles.panel} accessible accessibilityLabel={`${t('missions.comingSoon')}. ${t('missions.comingSoonBody')}`}>
          <Text style={styles.panelLabel} maxFontSizeMultiplier={1.3}>{t('missions.comingSoon')}</Text>
          <Text style={styles.panelBody}>{t('missions.comingSoonBody')}</Text>
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
