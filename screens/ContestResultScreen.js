import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { mobileStateFromOutcome } from '../lib/contestResultHelpers';
import { contestHaptic } from '../lib/haptics';
import { levelUpMilestone, firstContestWinMilestone } from '../lib/milestones';
import { territorySvgPath } from '../lib/territoryShape';
import { fetchTerritoryShape } from '../lib/territoryShapeApi';
import CountUpText from '../components/CountUpText';
import MilestoneTakeover from '../components/MilestoneTakeover';
import TerritorySilhouette from '../components/TerritorySilhouette';

// Display strings live in locales/<lng>.json under contestResult.<i18nKey>.*;
// only the role/outcome logic and the i18n key live here.
const STATE_CONFIG = {
  attack_won: { role: 'attacker', outcome: 'won', i18nKey: 'attackWon' },
  attack_lost: { role: 'attacker', outcome: 'lost', i18nKey: 'attackLost' },
  defend_won: { role: 'defender', outcome: 'won', i18nKey: 'defendWon' },
  defend_lost: { role: 'defender', outcome: 'lost', i18nKey: 'defendLost' },
};

const INK = '#0E1014';
const INK_2 = '#1A1D24';
const BONE = '#F2EEE6';
const SLATE = '#5C6068';
const SLATE_2 = '#8B8F98';
const CLAIM = '#D64525';
const CLAIM_SOFT = 'rgba(214,69,37,0.14)';
const ALLIANCE = '#3F8F4E';
const ALLIANCE_SOFT = 'rgba(63,143,78,0.14)';
const HAIRLINE = 'rgba(242,238,230,0.08)';
const HAIRLINE_STRONG = 'rgba(242,238,230,0.16)';

function clampNumber(n, fallback = 0) {
  const v = Number(n);
  return Number.isFinite(v) ? v : fallback;
}

function formatMetres(m) {
  return Math.max(0, Math.round(clampNumber(m, 0))).toLocaleString();
}

function consequenceLine(t, cfg, myM, oppM, opponentName) {
  const diff = Math.abs(myM - oppM);
  return t(`contestResult.${cfg.i18nKey}.consequence`, {
    opponent: opponentName.toUpperCase(),
    diff,
  });
}

export default function ContestResultScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  const {
    outcome = 'attacker_won',
    role = 'attacker',
    territoryName: territoryNameParam,
    territoryPerimeter,
    territoryId,
    territoryGeojson = null,
    myDistance = 0,
    opponentDistance = 0,
    opponentName = 'opponent',
    resourcesAwarded = { iron: 0, stone: 0, gold: 0, morale: 0 },
    xpGained = 0,
    balances = {},
    leveledUp = false,
    firstContestWin = false,
  } = route?.params ?? {};

  const stateKey = mobileStateFromOutcome(outcome, role);
  const cfg = STATE_CONFIG[stateKey] ?? STATE_CONFIG.attack_won;
  const markColor = cfg.role === 'attacker' ? CLAIM : ALLIANCE;
  const markSoftColor = cfg.role === 'attacker' ? CLAIM_SOFT : ALLIANCE_SOFT;

  const myM = clampNumber(myDistance, 0);
  const oppM = clampNumber(opponentDistance, 0);

  const winner = useMemo(() => {
    if (myM === oppM) return cfg.outcome === 'won' ? 'me' : 'opponent';
    return myM > oppM ? 'me' : 'opponent';
  }, [myM, oppM, cfg.outcome]);

  const myIsWinner = winner === 'me';
  const oppIsWinner = winner === 'opponent';

  const fillOpacity = useRef(new Animated.Value(0)).current;
  const borderAnim = useRef(new Animated.Value(0)).current;
  const [milestones, setMilestones] = useState([]);

  // The walk-resolved path carries geometry by param; defender-accept and
  // notification-opened results carry only territoryId — fetch the shape
  // (and the name, absent on the notification path) so they get the same mark.
  const [fetchedShape, setFetchedShape] = useState(null);
  useEffect(() => {
    if (territoryGeojson || !territoryId) return;
    let cancelled = false;
    fetchTerritoryShape(territoryId).then((shape) => {
      if (!cancelled && shape) setFetchedShape(shape);
    });
    return () => { cancelled = true; };
  }, [territoryGeojson, territoryId]);

  const effectiveGeojson = territoryGeojson ?? fetchedShape?.geojson ?? null;
  const territoryName = territoryNameParam ?? fetchedShape?.name ?? t('common.territoryFallback');
  const hasSilhouette = useMemo(() => territorySvgPath(effectiveGeojson) != null, [effectiveGeojson]);

  // Contest completion (win or loss): double haptic (brand: three moments only).
  useEffect(() => {
    contestHaptic();
  }, []);

  // Back to the board: the map celebrates ground taken (claim red), held
  // (alliance green), or lost (enemy blue). A failed attack changes nothing
  // on the board, so it gets no ceremony.
  const goToMap = () => {
    const mode =
      stateKey === 'attack_won' ? 'captured'
      : stateKey === 'defend_won' ? 'held'
      : stateKey === 'defend_lost' ? 'lost'
      : null;
    if (mode && effectiveGeojson) {
      navigation.navigate('MainTabs', {
        screen: 'Map',
        params: { celebration: { geojson: effectiveGeojson, mode } },
      });
    } else {
      navigation.navigate('MainTabs');
    }
  };

  // Milestone takeovers — level-up first, first contest win after dismiss.
  useEffect(() => {
    const queue = [];
    if (leveledUp === true && Number(balances?.level_after) >= 1) {
      queue.push(levelUpMilestone(t, Number(balances.level_after)));
    }
    if (firstContestWin === true && cfg.outcome === 'won') {
      queue.push(firstContestWinMilestone(t));
    }
    if (queue.length > 0) setMilestones(queue);
    // Mount-only: the result payload never changes under this screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (cfg.outcome === 'won') {
      Animated.timing(fillOpacity, {
        toValue: 1,
        duration: 280,
        easing: Easing.bezier(0.2, 0, 0, 1),
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(borderAnim, {
        toValue: 3,
        duration: 280,
        easing: Easing.bezier(0.2, 0, 0, 1),
        useNativeDriver: false,
      }).start();
    }
  }, [cfg.outcome]);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: INK }}
      contentContainerStyle={[styles.screen, { paddingBottom: insets.bottom + 16 }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.statusSpacer, { height: insets.top + 20 }]} />

      <Text style={[styles.eyebrow, { color: markColor }]}>{t(`contestResult.${cfg.i18nKey}.eyebrow`)}</Text>

      <View style={styles.markWrap}>
        {hasSilhouette ? (
          <TerritorySilhouette
            geojson={effectiveGeojson}
            size={96}
            color={markColor}
            variant={cfg.outcome === 'won' ? 'fill' : 'outline'}
          />
        ) : cfg.outcome === 'won' ? (
          <Animated.View
            style={{
              width: 72,
              height: 72,
              backgroundColor: markColor,
              opacity: fillOpacity,
            }}
          />
        ) : (
          <Animated.View
            style={{
              width: 72,
              height: 72,
              borderColor: markColor,
              borderWidth: borderAnim,
              backgroundColor: 'transparent',
            }}
          />
        )}
      </View>

      <Text style={styles.territoryName} maxFontSizeMultiplier={1.2} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.65}>{territoryName.toUpperCase()}</Text>
      <Text style={styles.headline}>{t(`contestResult.${cfg.i18nKey}.headline`)}</Text>

      {territoryPerimeter ? <Text style={styles.perimeter}>{t('contestResult.perimeter', { km: territoryPerimeter })}</Text> : null}

      <View style={styles.statsRow}>
        <View style={styles.statCell}>
          <Text style={styles.statLabel}>{t('contestResult.youLabel')}</Text>
          <Text style={styles.statName}>{t('contestResult.youName')}</Text>
          <Text style={[styles.statValue, myIsWinner ? { color: markColor } : { color: SLATE }]}>
            {formatMetres(myM)}
          </Text>
          <Text style={styles.statUnit}>{t('contestResult.metresWalked')}</Text>
        </View>
        <View style={styles.statCell}>
          <Text style={styles.statLabel}>{t(`contestResult.${cfg.i18nKey}.opponentRole`)}</Text>
          <Text style={styles.statName}>{opponentName}</Text>
          <Text style={[styles.statValue, oppIsWinner ? { color: markColor } : { color: SLATE }]}>
            {formatMetres(oppM)}
          </Text>
          <Text style={styles.statUnit}>{t('contestResult.metresWalked')}</Text>
        </View>
      </View>

      <View style={[styles.consequence, { backgroundColor: markSoftColor, borderLeftColor: markColor }]}>
        <Text style={styles.consequenceText}>{consequenceLine(t, cfg, myM, oppM, opponentName)}</Text>
      </View>
      {(stateKey === 'attack_won' || stateKey === 'defend_won') && clampNumber(xpGained, 0) > 0 ? (
        <View style={styles.earnedBlock}>
          <CountUpText
            value={xpGained}
            prefix="+"
            countOnMount
            style={styles.earnedXpValue}
            maxFontSizeMultiplier={1.2}
          />
          <Text style={styles.earnedXpLabel}>{t('contestResult.siegeXpLabel')}</Text>
          <Text style={styles.earnedBeat}>
            {stateKey === 'defend_won'
              ? t('contestResult.resourcesDefend', { stone: resourcesAwarded.stone, gold: resourcesAwarded.gold, morale: resourcesAwarded.morale })
              : t('contestResult.resourcesAttack', { iron: resourcesAwarded.iron, gold: resourcesAwarded.gold, morale: resourcesAwarded.morale })}
          </Text>
        </View>
      ) : null}

      <View style={styles.ctaStack}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t(`contestResult.${cfg.i18nKey}.cta`)}
          onPress={goToMap}
          style={({ pressed }) => [styles.ctaPrimary, pressed && { opacity: 0.85 }]}
        >
          <Text style={styles.ctaPrimaryText}>{t(`contestResult.${cfg.i18nKey}.cta`)}</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('contestResult.backToMap')}
          onPress={goToMap}
          style={({ pressed }) => [styles.ctaSecondary, pressed && { opacity: 0.7 }]}
        >
          <Text style={styles.ctaSecondaryText}>{t('contestResult.backToMap')}</Text>
        </Pressable>
      </View>

      <MilestoneTakeover
        item={milestones[0] ?? null}
        onDismiss={() => setMilestones((q) => q.slice(1))}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flexGrow: 1,
    backgroundColor: INK,
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  statusSpacer: {
    height: 60,
  },
  eyebrow: {
    fontFamily: 'GeistMono_500Medium',
    fontSize: 11,
    letterSpacing: 1.8,
    textAlign: 'center',
    marginBottom: 20,
  },
  markWrap: {
    height: 96,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  territoryName: {
    fontFamily: 'Archivo_900Black',
    fontSize: 36,
    color: BONE,
    letterSpacing: -1,
    textAlign: 'center',
    lineHeight: 38,
    marginBottom: 6,
  },
  headline: {
    fontFamily: 'Archivo_800ExtraBold',
    fontSize: 22,
    color: BONE,
    letterSpacing: -0.5,
    textAlign: 'center',
    marginBottom: 8,
  },
  perimeter: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 11,
    color: SLATE_2,
    letterSpacing: 1,
    textAlign: 'center',
    marginBottom: 28,
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: HAIRLINE_STRONG,
    borderWidth: 1,
    borderColor: HAIRLINE_STRONG,
    marginBottom: 16,
  },
  statCell: {
    flex: 1,
    backgroundColor: INK,
    padding: 16,
    margin: 0.5,
  },
  statLabel: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 9,
    color: SLATE_2,
    letterSpacing: 1.4,
    marginBottom: 8,
  },
  statName: {
    fontFamily: 'GeistMono_500Medium',
    fontSize: 12,
    color: BONE,
    marginBottom: 12,
  },
  statValue: {
    fontFamily: 'Archivo_700Bold',
    fontSize: 26,
    letterSpacing: -1,
    lineHeight: 26,
  },
  statUnit: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 9,
    color: SLATE_2,
    letterSpacing: 0.6,
    marginTop: 6,
  },
  consequence: {
    borderLeftWidth: 2,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  consequenceText: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 11,
    color: BONE,
    lineHeight: 17,
    letterSpacing: 0.4,
  },
  earnedBlock: {
    alignItems: 'center',
    marginTop: -4,
    marginBottom: 12,
  },
  earnedXpValue: {
    fontFamily: 'Archivo_700Bold',
    fontSize: 32,
    lineHeight: 34,
    color: BONE,
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  earnedXpLabel: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 9,
    color: SLATE_2,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 10,
  },
  earnedBeat: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 9,
    color: BONE,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  ctaStack: {
    marginTop: 'auto',
    gap: 8,
  },
  ctaPrimary: {
    backgroundColor: CLAIM,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaPrimaryText: {
    fontFamily: 'GeistMono_500Medium',
    fontSize: 12,
    color: BONE,
    letterSpacing: 1.8,
  },
  ctaSecondary: {
    borderWidth: 1,
    borderColor: HAIRLINE_STRONG,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaSecondaryText: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 11,
    color: BONE,
    letterSpacing: 1.6,
  },
});
