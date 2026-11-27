// Component: TerritoryCard — the map's territory pop-up (Dominia-Temp plan
// U6; boards "Territory pop-up states" 01-04, case 5, main-screen
// explanation 03), mounted instead of TerritorySheet when
// `full_territory_sheet` is off.
//
//   [swatch]  — EYEBROW (owner colour)                       [×]
//             TERRITORY NAME
//   DISTANCE | TIME LIMIT (| ENTRY when there is a fee)
//   first-claim line (existing condition)
//   CTA:  10 [gold] | START CLAIMING »   unclaimed
//         8 [gold] | CONTEST TERRITORY » / ATTACK »   enemy
//         OK                              yours / alliance
//
// The card owns no claim logic: the CTA calls onStartClaim / onStartContest,
// which MapScreen routes through the same start flow TerritorySheet uses.
// Those resolve to { ok } or { ok: false, message } (the server's
// insufficient_gold lands here as the message). OK calls onClose.
//
// Gold below the price disables the CTA, turns the cost segment the danger
// colour and adds "Not enough gold". onViewAlliance stays accepted but the
// Figma card has no VIEW ALLIANCE action, so it is not rendered.

import React, { useEffect, useMemo, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Polygon, Stop } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { CoachBubble } from './CoachMark';
import { CutCard, SlantButton, SlantTile } from './ui';
import { BUSY_LABEL, CARD_COPY, territoryCardModel, territoryOwnership } from '../lib/territoryCard';
import { formatWalkDistance } from '../lib/firstClaimApi';
import { getTerritoryHistoryStats } from '../lib/territory';
import { cutCornerPoints } from '../lib/slantGeometry';
import { colors, fonts } from '../lib/theme';
import { useLayoutSize } from './ui/shared';

const GOLD_ART = require('../assets/figma/gold-biscuits.png');

const EYEBROW_TONE = {
  muted: colors.muted2,
  self: colors.self,
  alliance: colors.alliance,
  enemy: colors.enemy,
};

function tc(t, copy, params) {
  return t(copy.key, { defaultValue: copy.defaultValue, ...params });
}

// Square territory swatch at the card's left: a slanted tile with a blue
// gradient, or a red tile with a white mark (flag on enemy ground, shield on
// a defend pop-up).
export function TerritorySwatch({ tone = 'blue', mark = null, size = 44 }) {
  const red = tone === 'red';
  const inset = Math.round(size * 0.16);
  const points = `${inset},0 ${size},${inset} ${size - inset},${size} 0,${size - inset}`;
  const gradId = red ? 'swatchRed' : 'swatchBlue';
  const glyph = Math.round(size * 0.42);
  const off = (size - glyph) / 2;
  return (
    <View style={{ width: size, height: size }} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      <Svg width={size} height={size}>
        <Defs>
          <LinearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={red ? '#E34234' : '#2F5BFF'} />
            <Stop offset="1" stopColor={red ? '#5A1410' : colors.actionDeep} />
          </LinearGradient>
        </Defs>
        <Polygon points={points} fill={`url(#${gradId})`} />
        {mark === 'flag' ? (
          <Path
            transform={`translate(${off} ${off}) scale(${glyph / 24})`}
            fill={colors.white}
            d="M5 2.5h1.8v19H5zM6.8 3.5c3-1.4 6 1.4 11.2 0v9c-5.2 1.4-8.2-1.4-11.2 0z"
          />
        ) : null}
        {mark === 'shield' ? (
          <Path
            transform={`translate(${off} ${off}) scale(${glyph / 24})`}
            fill={colors.white}
            d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"
          />
        ) : null}
      </Svg>
    </View>
  );
}

// CutCard over an opaque black underlay of the same cut shape, so the map
// does not show through the card's translucent gradient.
export function PopupSurface({ children, style }) {
  const [box, onLayout] = useLayoutSize();
  return (
    <View onLayout={onLayout} style={style}>
      <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
        <Polygon points={cutCornerPoints(box.w, box.h, 8, 'br')} fill={colors.obsidian} />
      </Svg>
      <CutCard padding={16} style={styles.card}>{children}</CutCard>
    </View>
  );
}

// Eyebrow: a short Dominia-blue bar, then caps text in the owner colour.
export function PopupEyebrow({ text, color }) {
  return (
    <View style={styles.eyebrowRow}>
      <View style={styles.eyebrowBar} />
      <Text style={[styles.eyebrow, { color }]} numberOfLines={1} maxFontSizeMultiplier={1.3}>
        {text}
      </Text>
    </View>
  );
}

// Close × on a small slanted tile, top-right of the pop-up.
export function PopupClose({ onPress, accessibilityLabel }) {
  return (
    <SlantTile size={32} square tone="raised" onPress={onPress} accessibilityLabel={accessibilityLabel}>
      <Text style={styles.closeText}>×</Text>
    </SlantTile>
  );
}

// Leading cost segment of a priced CTA: "10 [gold] |". Danger colour when
// the balance is short.
export function CostSegment({ price, currency = 'gold', short = false, ironLabel = 'IRON' }) {
  const color = short ? colors.danger : colors.white;
  return (
    <View style={styles.cost}>
      <Text style={[styles.costText, { color }]} maxFontSizeMultiplier={1.3}>{price}</Text>
      {currency === 'iron' ? (
        <Text style={[styles.costText, { color }]} maxFontSizeMultiplier={1.3}>{ironLabel}</Text>
      ) : (
        <Image source={GOLD_ART} style={[styles.costArt, short && styles.costArtShort]} resizeMode="contain" />
      )}
      <View style={[styles.costDivider, short && { backgroundColor: colors.danger }]} />
    </View>
  );
}

export default function TerritoryCard({
  territory,
  myPlayer,
  multiResource = false,
  streaksOn = false,
  atCap = false,
  onClose,
  onStartClaim,
  onStartContest,
  // onViewAlliance is still passed by MapScreen; the Dominia-Temp card has
  // no VIEW ALLIANCE action, so it is ignored here.
  firstClaim = false,
  // B3 coach mark: a bubble just above the card; tapping it calls this.
  onCoachBubblePress = null,
}) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [heldDays, setHeldDays] = useState(null);

  const territoryId = territory?.id ?? territory?.properties?.id ?? null;
  const isEnemyGround = !!territory?.properties
    && territoryOwnership(territory.properties) === 'enemy';

  useEffect(() => {
    setBusy(false);
    setError(null);
    setHeldDays(null);
  }, [territoryId]);

  // Holding time on enemy ground (kept in the model for the legacy pieces).
  useEffect(() => {
    if (!territoryId || !isEnemyGround) return undefined;
    let cancelled = false;
    getTerritoryHistoryStats(territoryId)
      .then((stats) => {
        if (!cancelled) setHeldDays(stats?.heldDays ?? null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [territoryId, isEnemyGround]);

  const properties = territory?.properties;
  const gold = myPlayer ? (myPlayer.gold ?? 0) : null;
  const iron = myPlayer ? (myPlayer.iron ?? 0) : null;
  const attackerStreakDays = streaksOn ? (myPlayer?.current_streak ?? 0) : 0;
  const model = useMemo(
    () => (properties
      ? territoryCardModel({
        properties, gold, iron, multiResource, atCap, attackerStreakDays, free: firstClaim, heldDays,
      })
      : null),
    [properties, gold, iron, multiResource, atCap, attackerStreakDays, firstClaim, heldDays],
  );

  if (!territory || !model) return null;

  const name = model.name ?? t('common.territoryFallback');
  const eyebrowText = tc(t, model.eyebrow.copy, model.eyebrow.params);
  const eyebrowColor = EYEBROW_TONE[model.eyebrow.tone] ?? colors.muted2;

  const action = model.action;
  const currencyName = action?.currency === 'iron'
    ? t('map.card.iron', { defaultValue: 'Iron' })
    : t('map.card.gold', { defaultValue: 'Gold' });
  const ctaLabel = action ? t(action.label.key, { defaultValue: action.label.defaultValue }) : null;
  const priced = !!action && !action.free && action.price > 0;
  const short = action?.reason === 'insufficient';
  // Only on open ground: the first-claim objective is always unclaimed, but a
  // stale prop must never decorate someone's territory.
  const showFirstClaim = firstClaim && model.ownership === 'unclaimed';

  const onCta = async () => {
    if (!action || action.disabled || busy) return;
    setBusy(true);
    setError(null);
    try {
      const run = action.kind === 'claim' ? onStartClaim : onStartContest;
      const res = await run?.(model);
      if (res && !res.ok && res.message) setError(res.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.wrap}>
      {onCoachBubblePress ? <CoachBubble onPress={onCoachBubblePress} /> : null}
      <PopupSurface>
        <View style={styles.header}>
          <TerritorySwatch
            tone={model.ownership === 'enemy' ? 'red' : 'blue'}
            mark={model.ownership === 'enemy' ? 'flag' : null}
          />
          <View style={styles.headerText}>
            <PopupEyebrow text={eyebrowText} color={eyebrowColor} />
            <Text style={styles.name} numberOfLines={2} maxFontSizeMultiplier={1.3} accessibilityRole="header">
              {name}
            </Text>
          </View>
          <PopupClose
            onPress={onClose}
            accessibilityLabel={t('map.card.closeA11y', { defaultValue: 'Close territory card' })}
          />
        </View>

        <View style={styles.stats}>
          {model.stats.map((stat, i) => (
            <View
              key={stat.key}
              style={[styles.stat, i > 0 && styles.statDivided]}
              accessible
              accessibilityLabel={`${tc(t, stat.label)} ${tc(t, stat.value, stat.params)}`}
            >
              <Text style={styles.statLabel} numberOfLines={1} maxFontSizeMultiplier={1.3}>
                {tc(t, stat.label)}
              </Text>
              <Text style={styles.statValue} numberOfLines={1} maxFontSizeMultiplier={1.2}>
                {tc(t, stat.value, stat.params)}
              </Text>
            </View>
          ))}
        </View>

        {showFirstClaim ? (
          <Text style={styles.note} maxFontSizeMultiplier={1.3}>
            {t('firstClaim.sheetLine', { distance: formatWalkDistance(model.distanceM) })}
          </Text>
        ) : null}

        {model.confirm ? (
          <SlantButton
            label={tc(t, model.confirm.label)}
            onPress={onClose}
            trailingChevron={false}
            size="md"
          />
        ) : null}

        {action ? (
          <>
            <SlantButton
              label={busy ? t(BUSY_LABEL.key, { defaultValue: BUSY_LABEL.defaultValue }) : ctaLabel}
              onPress={onCta}
              disabled={action.disabled}
              loading={busy}
              size="md"
              leading={priced ? (
                <CostSegment
                  price={action.price}
                  currency={action.currency}
                  short={short}
                  ironLabel={tc(t, CARD_COPY.iron)}
                />
              ) : null}
              accessibilityLabel={priced ? t('map.card.ctaA11y', {
                defaultValue: '{{label}}, costs {{price}} {{currency}}',
                label: ctaLabel,
                price: action.price,
                currency: currencyName,
              }) : ctaLabel}
            />
            {action.hint ? (
              <Text style={styles.danger} accessibilityLiveRegion="polite" maxFontSizeMultiplier={1.3}>
                {tc(t, action.hint)}
              </Text>
            ) : null}
            {action.reason === 'cap' ? (
              <Text style={styles.note} maxFontSizeMultiplier={1.3}>{t('map.capReached')} · {t('map.capReachedSub')}</Text>
            ) : null}
            {error ? (
              <Text style={styles.danger} accessibilityLiveRegion="polite" maxFontSizeMultiplier={1.3}>{error}</Text>
            ) : null}
          </>
        ) : null}
      </PopupSurface>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 12,
    zIndex: 30,
  },
  card: {
    gap: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerText: {
    flex: 1,
    gap: 4,
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  eyebrowBar: {
    width: 14,
    height: 3,
    backgroundColor: colors.action,
    transform: [{ skewX: '-14deg' }],
  },
  eyebrow: {
    flexShrink: 1,
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  name: {
    fontFamily: fonts.display,
    fontSize: 24,
    lineHeight: 28,
    color: colors.white,
    textTransform: 'uppercase',
  },
  closeText: {
    fontFamily: fonts.mono,
    fontSize: 18,
    lineHeight: 20,
    color: colors.white,
  },
  stats: {
    flexDirection: 'row',
  },
  stat: {
    flex: 1,
    gap: 4,
  },
  statDivided: {
    borderLeftWidth: 1,
    borderLeftColor: colors.hairlineStrong,
    paddingLeft: 14,
  },
  statLabel: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: colors.muted2,
  },
  statValue: {
    fontFamily: fonts.bodyMedium,
    fontSize: 22,
    lineHeight: 28,
    color: colors.white,
  },
  note: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 19,
    color: colors.muted2,
  },
  danger: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    lineHeight: 19,
    color: colors.danger,
  },
  cost: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  costText: {
    fontFamily: fonts.action,
    fontSize: 16,
    includeFontPadding: false,
  },
  costArt: {
    width: 22,
    height: 16,
  },
  costArtShort: {
    opacity: 0.5,
  },
  costDivider: {
    width: 1,
    height: 18,
    marginLeft: 4,
    backgroundColor: 'rgba(253,253,253,0.5)',
  },
});
