import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@clerk/clerk-expo';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { getAllianceById } from '../lib/allianceApi';
import THEME from '../lib/theme';

const INK = '#0E1014';
const BONE = THEME.colors.bone;
const SLATE = '#5C6068';
const SLATE_2 = '#8B8F98';
const CLAIM = THEME.colors.claim;
const ALLIANCE = '#3F8F4E';
const ALLIANCE_RULE = 'rgba(63,143,78,0.4)';
const HAIRLINE = 'rgba(242,238,230,0.08)';
const HAIRLINE_STRONG = 'rgba(242,238,230,0.16)';

export default function AllianceJoinedScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { allianceId, context } = route.params ?? {};
  const isJoined = context === 'joined';
  const { getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const [{ loading, alliance, members, error }, setState] = useState({
    loading: true,
    alliance: null,
    members: [],
    error: null,
  });
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function fetchAlliance() {
      if (!allianceId) {
        if (!cancelled) {
          setState({ loading: false, alliance: null, members: [], error: true });
        }
        return;
      }

      if (!cancelled) {
        setState((prev) => ({ ...prev, loading: true, error: null }));
      }

      try {
        const result = await getAllianceById({
          clerkGetToken: () => getTokenRef.current(),
          allianceId,
        });

        if (cancelled) return;

        if (result.ok) {
          const { alliance: fetchedAlliance, members: fetchedMembers } = result.data;
          setState({
            loading: false,
            alliance: fetchedAlliance,
            members: fetchedMembers ?? [],
            error: null,
          });
        } else {
          setState({ loading: false, alliance: null, members: [], error: true });
        }
      } catch (err) {
        console.error('AllianceJoinedScreen fetch:', err);
        if (!cancelled) {
          setState({ loading: false, alliance: null, members: [], error: true });
        }
      }
    }

    fetchAlliance();

    return () => {
      cancelled = true;
    };
  }, [allianceId, retryCount]);

  if (loading) {
    return (
      <View style={styles.fullScreenCentered}>
        <ActivityIndicator size="large" color={CLAIM} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.fullScreenCentered}>
        <Text style={styles.errorMessage}>{t('allianceJoined.couldNotLoad')}</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => setRetryCount((c) => c + 1)}
          style={({ pressed }) => [styles.retryBtn, pressed && { opacity: 0.7 }]}
        >
          <Text style={styles.retryBtnText}>{t('common.retry')}</Text>
        </Pressable>
      </View>
    );
  }

  const memberCount = members.length;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={[styles.content, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
      <View style={styles.accent} />

      <View style={styles.body}>

        {/* Kicker */}
        <View style={styles.kickerRow}>
          <Text style={styles.kickerText}>{isJoined ? t('allianceJoined.kickerJoined') : t('allianceJoined.kickerFounded')}</Text>
          <View style={styles.kickerRule} />
        </View>

        {/* Hero alliance name */}
        <Text style={styles.allianceName} maxFontSizeMultiplier={1.2} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.65}>{alliance?.name ?? t('allianceJoined.defaultName')}</Text>
        <Text style={styles.tag}>[{alliance?.short_name ?? 'XXX'}]</Text>

        {/* Milestone subtitle */}
        <Text style={styles.subtitle}>{isJoined ? t('allianceJoined.subtitleJoined') : t('allianceJoined.subtitleFounded')}</Text>

        {/* Meta grid: city + commanders */}
        <View style={styles.metaGrid}>
          <View style={styles.metaCell}>
            <Text style={styles.metaLabel}>{t('allianceJoined.city')}</Text>
            <Text style={styles.metaValue}>{alliance?.city ?? '—'}</Text>
          </View>
          <View style={[styles.metaCell, styles.metaCellLast]}>
            <Text style={styles.metaLabel}>{t('allianceJoined.commanders')}</Text>
            <Text style={styles.metaValue}>{memberCount} / 20</Text>
          </View>
        </View>

        {/* Section header */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionLabel}>{t('allianceJoined.unlocked')}</Text>
          <View style={styles.sectionRule} />
        </View>

        {/* Benefit rows */}
        <View style={styles.bList}>
          {(isJoined
            ? t('allianceJoined.benefitsJoined', { returnObjects: true })
            : t('allianceJoined.benefitsFounded', { returnObjects: true })
          ).map((b, i) => (
            <View key={i} style={[styles.bRow, i === 0 && styles.bRowFirst]}>
              <Text style={styles.bNum}>{String(i + 1).padStart(2, '0')}</Text>
              <View style={styles.bText}>
                <Text style={styles.bTitle}>{b.title}</Text>
                <Text style={styles.bSub}>{b.sub}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* CTA */}
        <Pressable
          accessibilityRole="button"
          onPress={() => navigation.navigate('MainTabs', { screen: 'Alliance' })}
          style={({ pressed }) => [styles.cta, pressed && { opacity: 0.9 }]}
        >
          <Text style={styles.ctaStep}>{t('allianceJoined.takeCommand')}</Text>
          <Text style={styles.ctaAction}>{t('allianceJoined.enterAlliance')}</Text>
        </Pressable>

      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  fullScreenCentered: {
    flex: 1,
    backgroundColor: BONE,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingHorizontal: 24,
  },
  errorMessage: {
    fontFamily: THEME.fonts.mono,
    fontSize: 11,
    letterSpacing: 1.4,
    color: THEME.colors.slate,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  retryBtn: {
    borderWidth: 1,
    borderColor: CLAIM,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  retryBtnText: {
    fontFamily: THEME.fonts.monoMedium,
    fontSize: 11,
    letterSpacing: 1.6,
    color: CLAIM,
    textTransform: 'uppercase',
  },
  screen: {
    flex: 1,
    backgroundColor: INK,
  },
  content: {
    flexGrow: 1,
    backgroundColor: INK,
  },
  accent: {
    height: 4,
    backgroundColor: ALLIANCE,
    width: '100%',
  },
  body: {
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 32,
  },

  kickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },
  kickerText: {
    fontFamily: 'GeistMono_500Medium',
    fontSize: 10,
    letterSpacing: 1.8,
    color: ALLIANCE,
    textTransform: 'uppercase',
  },
  kickerRule: {
    flex: 1,
    height: 1,
    backgroundColor: ALLIANCE_RULE,
  },

  allianceName: {
    fontFamily: 'Archivo_900Black',
    fontSize: 36,
    color: BONE,
    textTransform: 'uppercase',
    letterSpacing: -0.5,
    lineHeight: 38,
    marginBottom: 8,
  },
  tag: {
    fontFamily: 'GeistMono_500Medium',
    fontSize: 16,
    letterSpacing: 3,
    color: ALLIANCE,
    textTransform: 'uppercase',
    marginBottom: 28,
  },

  subtitle: {
    fontFamily: 'Archivo_700Bold_Italic',
    fontSize: 16,
    fontStyle: 'italic',
    color: BONE,
    lineHeight: 21,
    marginBottom: 28,
  },

  metaGrid: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: HAIRLINE,
    borderBottomWidth: 1,
    borderBottomColor: HAIRLINE,
    marginBottom: 32,
  },
  metaCell: {
    flex: 1,
    paddingVertical: 14,
    borderRightWidth: 1,
    borderRightColor: HAIRLINE,
  },
  metaCellLast: {
    borderRightWidth: 0,
    paddingLeft: 16,
  },
  metaLabel: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 9,
    letterSpacing: 1.6,
    color: SLATE_2,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  metaValue: {
    fontFamily: 'GeistMono_500Medium',
    fontSize: 16,
    color: BONE,
  },

  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 4,
  },
  sectionLabel: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 10,
    letterSpacing: 1.8,
    color: SLATE_2,
    textTransform: 'uppercase',
  },
  sectionRule: {
    flex: 1,
    height: 1,
    backgroundColor: HAIRLINE_STRONG,
  },

  bList: {
    marginBottom: 32,
  },
  bRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: HAIRLINE,
    gap: 12,
  },
  bRowFirst: {
    borderTopWidth: 1,
    borderTopColor: HAIRLINE,
  },
  bNum: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 10,
    letterSpacing: 1.4,
    color: SLATE,
    textTransform: 'uppercase',
    width: 24,
    paddingTop: 2,
  },
  bText: {
    flex: 1,
  },
  bTitle: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    color: BONE,
    lineHeight: 18,
    marginBottom: 4,
  },
  bSub: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: SLATE_2,
    lineHeight: 18,
  },

  cta: {
    backgroundColor: CLAIM,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'flex-start',
  },
  ctaStep: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 9,
    letterSpacing: 1.6,
    color: BONE,
    opacity: 0.75,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  ctaAction: {
    fontFamily: 'GeistMono_500Medium',
    fontSize: 16,
    letterSpacing: 1.6,
    color: BONE,
    textTransform: 'uppercase',
  },
});
