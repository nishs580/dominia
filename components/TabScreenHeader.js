// Header for the Figma-layout tabs that have no header of their own yet
// (Missions stub, Events): mono kicker, Archivo title, and the Profile avatar
// on the right (plan U9).

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ProfileAvatarButton from './ProfileAvatarButton';
import { colors, fonts } from '../lib/theme';

// `right` replaces the avatar with a screen's own control (Missions: the (i)).
export default function TabScreenHeader({ kicker, title, right }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
      <View style={styles.titleBlock}>
        {kicker ? (
          <Text style={styles.kicker} maxFontSizeMultiplier={1.3}>{kicker}</Text>
        ) : null}
        <Text
          style={styles.title}
          accessibilityRole="header"
          maxFontSizeMultiplier={1.2}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
        >
          {title}
        </Text>
      </View>
      {right ?? <ProfileAvatarButton />}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  titleBlock: {
    flex: 1,
    paddingRight: 12,
  },
  kicker: {
    fontFamily: fonts.mono,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1.6,
    color: colors.slate2,
  },
  title: {
    marginTop: 4,
    fontFamily: fonts.display,
    fontSize: 24,
    color: colors.bone,
    textTransform: 'uppercase',
    letterSpacing: -0.02,
  },
});
