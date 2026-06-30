import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import MedalIcon from './MedalIcon';
import TierBars from './TierBars';
import { MEDAL_NAME, TIER_LABEL } from '../../lib/legacyMedals';

const BONE = '#F2EEE6';
const BONE_DIM = 'rgba(242,238,230,0.6)';

// Reconstruct a minimal medal object from an FCM medal push so MedalIcon /
// TierBars can render it (the full state lives behind GET /legacy/medals).
export function medalFromPush(data) {
  const key = data?.medalKey ?? '';
  const category = key.split('.')[0] || 'combat';
  const kind = data?.kind;
  const type =
    kind === 'legacy_medal_count'
      ? 'singular_count'
      : kind === 'legacy_medal_one_off'
        ? 'singular_oneoff'
        : 'tiered';
  return {
    key,
    category,
    type,
    currentTier: data?.tier || null,
    count: data?.count != null ? Number(data.count) : 0,
    earned: type === 'singular_oneoff',
    earnedYear: data?.year != null ? Number(data.year) : null,
  };
}

function subline(t, medal, data) {
  if (medal.type === 'tiered') {
    return medal.currentTier ? t(`tierLabel.${medal.currentTier}`) : '';
  }
  if (medal.type === 'singular_count') return t('medal.countX', { count: medal.count });
  return medal.earnedYear ? t('medal.earnedYear', { year: medal.earnedYear }) : '';
}

/**
 * In-app earn celebration card (the LM-M3 celebration surface). Rendered inside
 * NotificationCard's modal when a medal push lands while the app is foregrounded.
 * Tapping deep-links to the profile's Honor Medals; DISMISS closes it.
 */
export default function MedalEarnCard({ data, onPress, onDismiss }) {
  const { t, i18n } = useTranslation();
  const medal = medalFromPush(data);
  const nameKey = `medalName.${medal.key}`;
  const name = (i18n.exists(nameKey) ? t(nameKey) : '') || data?.title || t('medal.medalEarnedFallback');
  const body = data?.body || '';

  return (
    <Pressable style={styles.card} onPress={onPress}>
      <Text style={styles.eyebrow}>{t('medal.medalEarned')}</Text>
      <View style={styles.iconWrap}>
        <MedalIcon medal={medal} size={108} earned />
      </View>
      <Text style={styles.name}>{name}</Text>
      <Text style={styles.sub}>{subline(t, medal, data)}</Text>
      <View style={{ marginTop: 12 }}>
        <TierBars medal={medal} height={8} />
      </View>
      {body ? <Text style={styles.body}>{body}</Text> : null}
      <Pressable style={styles.dismiss} onPress={onDismiss} hitSlop={8}>
        <Text style={styles.dismissText}>{t('notif.dismiss')}</Text>
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#0E1014',
    borderWidth: 1,
    borderColor: 'rgba(242,238,230,0.16)',
    borderRadius: 0,
    padding: 24,
    alignItems: 'center',
  },
  eyebrow: {
    fontFamily: 'GeistMono_500Medium',
    fontSize: 11,
    letterSpacing: 2,
    color: BONE_DIM,
  },
  iconWrap: { marginVertical: 14 },
  name: {
    fontFamily: 'Archivo_900Black',
    fontSize: 24,
    color: BONE,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  sub: {
    fontFamily: 'GeistMono_500Medium',
    fontSize: 12,
    letterSpacing: 1,
    color: BONE_DIM,
    marginTop: 4,
  },
  body: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: BONE_DIM,
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 18,
  },
  dismiss: { alignSelf: 'flex-end', marginTop: 18, paddingVertical: 8, paddingHorizontal: 4 },
  dismissText: {
    fontFamily: 'GeistMono_500Medium',
    fontSize: 12,
    letterSpacing: 1.6,
    color: '#FF6B35',
  },
});
