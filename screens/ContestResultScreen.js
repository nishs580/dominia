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
import { colors } from '../lib/theme';

// Display strings live in locales/<lng>.json under contestResult.<i18nKey>.*;
// only the role/outcome logic and the i18n key live here.
const STATE_CONFIG = {
  attack_won: { role: 'attacker', outcome: 'won', i18nKey: 'attackWon' },
  attack_lost: { role: 'attacker', outcome: 'lost', i18nKey: 'attackLost' },
  defend_won: { role: 'defender', outcome: 'won', i18nKey: 'defendWon' },
  defend_lost: { role: 'defender', outcome: 'lost', i18nKey: 'defendLost' },
};

const INK = colors.ink;
const INK2 = colors.ink2;
const BONE = colors.bone;
const SLATE = colors.slate;
const SLATE_2 = colors.slate2;
const CLAIM = colors.claim;
const ALLIANCE = colors.alliance;
const ENEMY = colors.enemy;
const HAIRLINE_STRONG = colors.hairlineStrong;

// The mark colour states who holds the ground AFTER the contest — never which
// seat the player sat in. Lost it → theirs (enemy blue); took it → yours
// (claim red); held it → ours (alliance green). Locked Meaning Rule.
function ownershipColour(cfg) {
  if (cfg.outcome === 'lost') return ENEMY;
  return cfg.role === 'attacker' ? CLAIM : ALLIANCE;
}

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
    opponent: opponentName,
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
    opponentName: opponentNameParam = null,
    resourcesAwarded = { iron: 0, stone: 0, gold: 0, morale: 0 },
    xpGained = 0,
    balances = {},
    leveledUp = false,
    firstContestWin = false,
  } = route?.params ?? {};

  const stateKey = mobileStateFromOutcome(outcome, role);
  const cfg = STATE_CONFIG[stateKey] ?? STATE_CONFIG.attack_won;
  const markColor = ownershipColour(cfg);

  // 'opponent' is the upstream sentinel when the server omits a username;
  // fall back to a localised noun so a Russian player never sees English.
  const opponentName =
    opponentNameParam && opponentNameParam !== 'opponent'
      ? opponentNameParam
      : t('contestResult.opponentFallback');

  const myM = clampNumber(myDistance, 0);
  const oppM = clampNumber(opponentDistance, 0);

  // The authoritative outcome is the contest result, not the raw distances:
  // a data mismatch (equal or inverted distances) must never contradict the
  // won/lost state the server resolved.
  const winner = useMemo(() => {
    if (cfg.outcome === 'won') return 'me';
    if (cfg.outcome === 'lost') return 'opponent';
    return myM >= oppM ? 'me' : 'opponent';
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
      <View style={{ height: insets.top + 20 }} />

      <Text style={styles.eyebrow}>{t(`contestResult.${cfg.i18nKey}.eyebrow`)}</Text>

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

      <View style={styles.consequence}>
        <Text style={styles.consequenceText}>{consequenceLine(t, cfg, myM, oppM, opponentName)}</Text>
      </View>
      {cfg.outcome === 'won' && clampNumber(xpGained, 0) > 0 ? (
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
      ) : cfg.outcome === 'lost' && myM > 0 ? (
        // The loss has no reward to count up, but the effort is real — honour
        // the distance the player actually walked rather than leaving it static.
        <View style={styles.earnedBlock}>
          <CountUpText
            value={myM}
            countOnMount
            style={styles.earnedXpValue}
            maxFontSizeMultiplier={1.2}
          />
          <Text style={styles.earnedXpLabel}>{t('contestResult.lossEffortLabel')}</Text>
        </View>
      ) : null}

      {/* One honest exit. The reconquer/fortify follow-up flows don't exist yet;
          when they do, add a primary CTA here that actually starts them rather
          than relabelling the return-to-map. The exit is neutral so it never
          spends the ownership colour or clashes with enemy blue on a loss. */}
      <View style={styles.ctaStack}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('contestResult.backToMap')}
          onPress={goToMap}
          style={({ pressed }) => [styles.cta, pressed && { opacity: 0.85 }]}
        >
          <Text style={styles.ctaText}>{t('contestResult.backToMap')}</Text>
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
  eyebrow: {
    fontFamily: 'GeistMono_500Medium',
    fontSize: 11,
    // Bone label — the ownership colour lives on the mark and the deciding stat,
    // not on the chrome. The mark below already states the outcome in colour.
    color: BONE,
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
    fontSize: 10,
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
    fontSize: 10,
    color: SLATE_2,
    letterSpacing: 0.6,
    marginTop: 6,
  },
  // Neutral card — full hairline, no coloured side-stripe. The words carry the
  // weight; the colour budget belongs to the ownership mark.
  consequence: {
    backgroundColor: INK2,
    borderWidth: 1,
    borderColor: HAIRLINE_STRONG,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  consequenceText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: BONE,
    lineHeight: 19,
    textAlign: 'center',
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
    fontSize: 10,
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
  },
  cta: {
    backgroundColor: INK2,
    borderWidth: 1,
    borderColor: HAIRLINE_STRONG,
    paddingVertical: 16,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: {
    fontFamily: 'GeistMono_500Medium',
    fontSize: 12,
    color: BONE,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
});
