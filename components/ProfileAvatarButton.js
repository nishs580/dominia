// The player's avatar in a tab header. Opens Profile, which is a root stack
// screen when `legacy_tabs` is off (plan U9). Renders nothing with the flag
// on, where Profile is still its own tab, so legacy screens are unchanged.
//
// Square per DESIGN.md (0 radius): Clerk picture, or two-letter Geist Mono
// initials on Ink 2. 36pt visual, 44pt touch target via hitSlop.
//
// variant="slant" (Dominia-Temp map header, plan U5): a slanted tile with
// the player's two-letter initials in Archivo Black Italic, no picture.
// `name` overrides the Clerk username (MapScreen passes the game username).

import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useUser } from '@clerk/clerk-expo';
import { useTranslation } from 'react-i18next';
import { useFlag } from '../lib/flags';
import { navigateTo } from '../lib/navigation';
import { avatarInitials, avatarThumb } from '../lib/avatar';
import { mapInitials } from '../lib/mapTopBar';
import { colors, fonts } from '../lib/theme';
import { SlantTile } from './ui';

const SIZE = 36;
const HIT = (44 - SIZE) / 2;

export default function ProfileAvatarButton({ style, variant = 'square', name: nameOverride }) {
  const legacyTabs = useFlag('legacy_tabs');
  const { t } = useTranslation();
  const { user } = useUser();
  if (legacyTabs) return null;

  const url = avatarThumb(user?.imageUrl, SIZE);
  const name = user?.username || user?.firstName || '';

  if (variant === 'slant') {
    return (
      <SlantTile
        size={SIZE}
        width={52}
        tone="raised"
        onPress={() => navigateTo('Profile')}
        accessibilityLabel={t('nav.openProfileA11y')}
        style={style}
      >
        <Text style={styles.slantInitials} maxFontSizeMultiplier={1.2}>
          {mapInitials(nameOverride || name)}
        </Text>
      </SlantTile>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('nav.openProfileA11y')}
      hitSlop={{ top: HIT, bottom: HIT, left: HIT, right: HIT }}
      onPress={() => navigateTo('Profile')}
      style={({ pressed }) => [styles.frame, pressed && styles.pressed, style]}
    >
      {url ? (
        <Image source={{ uri: url }} style={styles.image} accessibilityIgnoresInvertColors />
      ) : (
        <View style={styles.placeholder}>
          <Text style={styles.initials} maxFontSizeMultiplier={1.2}>
            {avatarInitials(name)}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: SIZE,
    height: SIZE,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    backgroundColor: colors.ink2,
    borderRadius: 0,
  },
  pressed: {
    backgroundColor: colors.ink3,
  },
  image: {
    width: SIZE - 2,
    height: SIZE - 2,
  },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slantInitials: {
    fontFamily: fonts.display,
    fontSize: 15,
    color: colors.white,
  },
  initials: {
    fontFamily: fonts.monoMedium,
    fontSize: 12,
    letterSpacing: 1.2,
    color: colors.bone,
  },
});
