// Component: TerritoryCard — Figma's compact territory card (parity plan
// U11), mounted instead of TerritorySheet when `full_territory_sheet` is off.
// Silhouette, name, status, walk distance, time limit and one priced CTA:
// "10 [gold] START CLAIMING" for open ground, "8 [gold] CONTEST TERRITORY"
// for another player's territory, nothing for yours or your alliance's.
//
// The card owns no claim logic: the CTA calls onStartClaim / onStartContest,
// which MapScreen routes through the same start flow TerritorySheet uses.
// Those resolve to { ok } or { ok: false, message }.
//
// Surface: Ink 2, 1px top edge in the territory's identity colour (as the
// sheet), 0 radius. The CTA is the screen's single Claim Red Button element.
// Insufficient Gold disables the CTA and states the shortfall.

import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import TerritorySilhouette from './TerritorySilhouette';
import { GoldGlyph, IronGlyph } from './ResourceGlyphs';
import { BUSY_LABEL, territoryCardModel } from '../lib/territoryCard';
import { formatWalkDistance } from '../lib/firstClaimApi';
import { colors, fonts } from '../lib/theme';

const SILHOUETTE = 56;

const OWNERSHIP_COLOR = {
  unclaimed: colors.slate,
  yours: colors.claim,
  alliance: colors.alliance,
  enemy: colors.enemy,
};

export default function TerritoryCard({
  territory,
  myPlayer,
  multiResource = false,
  streaksOn = false,
  atCap = false,
  onClose,
  onStartClaim,
  onStartContest,
  firstClaim = false,
}) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    setBusy(false);
    setError(null);
  }, [territory?.id]);

  const properties = territory?.properties;
  const gold = myPlayer ? (myPlayer.gold ?? 0) : null;
  const iron = myPlayer ? (myPlayer.iron ?? 0) : null;
  const attackerStreakDays = streaksOn ? (myPlayer?.current_streak ?? 0) : 0;
  const model = useMemo(
    () => (properties
      ? territoryCardModel({ properties, gold, iron, multiResource, atCap, attackerStreakDays, free: firstClaim })
      : null),
    [properties, gold, iron, multiResource, atCap, attackerStreakDays, firstClaim],
  );

  if (!territory || !model) return null;

  const name = model.name ?? t('common.territoryFallback');
  const ownColor = OWNERSHIP_COLOR[model.ownership];

  let status;
  switch (model.ownership) {
    case 'yours':
      status = t('map.stateYours');
      break;
    case 'alliance':
      status = t('map.stateAlliance');
      break;
    case 'enemy':
      status = model.ownerName
        ? t('map.card.ownerTerritory', { defaultValue: "{{owner}}'s territory", owner: model.ownerName })
        : t('map.stateEnemy');
      break;
    default:
      status = t('map.card.unclaimed', { defaultValue: 'Unclaimed' });
  }

  const action = model.action;
  const Glyph = action?.currency === 'iron' ? IronGlyph : GoldGlyph;
  const currencyName = action?.currency === 'iron'
    ? t('map.card.iron', { defaultValue: 'Iron' })
    : t('map.card.gold', { defaultValue: 'Gold' });
  const ctaLabel = action ? t(action.label.key, { defaultValue: action.label.defaultValue }) : null;
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
    <View style={[styles.card, { borderTopColor: ownColor }]}>
      <View style={styles.topRow}>
        <View style={styles.thumb}>
          {territory.geometry ? (
            <TerritorySilhouette
              geojson={territory.geometry}
              size={SILHOUETTE}
              color={ownColor}
              variant={model.ownership === 'unclaimed' ? 'outline' : 'fill'}
              animate={false}
            />
          ) : null}
        </View>
        <View style={styles.titleBlock}>
          <Text style={styles.name} numberOfLines={1} maxFontSizeMultiplier={1.3} accessibilityRole="header">
            {name}
          </Text>
          <Text style={styles.status} numberOfLines={1} maxFontSizeMultiplier={1.3}>{status}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('map.card.closeA11y', { defaultValue: 'Close territory card' })}
          onPress={onClose}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={styles.close}
        >
          <Text style={styles.closeText}>×</Text>
        </Pressable>
      </View>

      {showFirstClaim ? (
        <View style={styles.firstClaim}>
          <View style={styles.firstClaimTag}>
            <Text style={styles.firstClaimTagText} maxFontSizeMultiplier={1.3}>
              {t('firstClaim.kicker', { defaultValue: 'FIRST CLAIM · FREE' })}
            </Text>
          </View>
          <Text style={styles.firstClaimLine} maxFontSizeMultiplier={1.3}>
            {t('firstClaim.sheetLine', { distance: formatWalkDistance(model.distanceM) })}
          </Text>
        </View>
      ) : null}

      <View style={styles.metaBlock}>
        <Text style={styles.meta} maxFontSizeMultiplier={1.3}>
          {t('map.card.distance', { defaultValue: 'Distance: {{metres}}m', metres: model.distanceM.toLocaleString() })}
        </Text>
        <Text style={styles.meta} maxFontSizeMultiplier={1.3}>
          {t('map.card.timeLimit', { defaultValue: 'Time limit: {{minutes}} min', minutes: model.timeLimitMin })}
        </Text>
      </View>

      {action ? (
        <>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={action.free ? ctaLabel : t('map.card.ctaA11y', {
              defaultValue: '{{label}}, costs {{price}} {{currency}}',
              label: ctaLabel,
              price: action.price,
              currency: currencyName,
            })}
            accessibilityState={{ disabled: action.disabled || busy, busy }}
            disabled={action.disabled || busy}
            onPress={onCta}
            style={({ pressed }) => [
              styles.cta,
              action.disabled && styles.ctaDisabled,
              pressed && !action.disabled && styles.ctaPressed,
              busy && styles.ctaBusy,
            ]}
          >
            {busy ? (
              <>
                <ActivityIndicator size="small" color={colors.bone} />
                <Text style={styles.ctaText}>{t(BUSY_LABEL.key, { defaultValue: BUSY_LABEL.defaultValue })}</Text>
              </>
            ) : (
              <>
                {action.free ? null : (
                  <>
                    <Text style={[styles.ctaText, action.disabled && styles.ctaTextDisabled]}>{action.price}</Text>
                    <Glyph size={14} color={action.disabled ? colors.slate2 : colors.bone} />
                  </>
                )}
                <Text style={[styles.ctaText, action.disabled && styles.ctaTextDisabled]}>{ctaLabel}</Text>
              </>
            )}
          </Pressable>
          {action.reason === 'insufficient' ? (
            <Text style={styles.note} accessibilityLiveRegion="polite">
              {t('map.card.shortfall', {
                defaultValue: 'Short by {{n}} {{currency}}',
                n: action.shortfall,
                currency: currencyName,
              })}
            </Text>
          ) : null}
          {action.reason === 'cap' ? (
            <Text style={styles.note}>{t('map.capReached')} · {t('map.capReachedSub')}</Text>
          ) : null}
          {error ? (
            <Text style={styles.note} accessibilityLiveRegion="polite">{error}</Text>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.ink2,
    borderTopWidth: 1,
    borderRadius: 0,
    padding: 16,
    gap: 12,
    zIndex: 30,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  thumb: {
    width: SILHOUETTE,
    height: SILHOUETTE,
    backgroundColor: colors.ink3,
    borderWidth: 0.5,
    borderColor: colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleBlock: {
    flex: 1,
    gap: 4,
  },
  name: {
    fontFamily: fonts.display,
    fontSize: 26,
    color: colors.bone,
    lineHeight: 28,
    textTransform: 'uppercase',
  },
  status: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.slate2,
  },
  close: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    fontFamily: fonts.mono,
    fontSize: 20,
    color: colors.bone,
  },
  metaBlock: {
    gap: 4,
  },
  meta: {
    fontFamily: fonts.mono,
    fontSize: 13,
    color: colors.bone2,
  },
  cta: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 24,
    backgroundColor: colors.claimButton,
    borderRadius: 0,
  },
  ctaPressed: {
    opacity: 0.92,
  },
  ctaBusy: {
    opacity: 0.6,
  },
  // First-claim objective: a Signal Lime moment (tag + emphasised line).
  firstClaim: {
    gap: 8,
  },
  firstClaimTag: {
    alignSelf: 'flex-start',
    backgroundColor: colors.limeSoft,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  firstClaimTagText: {
    fontFamily: fonts.monoMedium,
    fontSize: 11,
    letterSpacing: 1.6,
    color: colors.lime,
    textTransform: 'uppercase',
  },
  firstClaimLine: {
    fontFamily: fonts.bodyMedium,
    fontSize: 15,
    lineHeight: 21,
    color: colors.lime,
  },
  ctaDisabled: {
    backgroundColor: colors.ink2,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  ctaText: {
    fontFamily: fonts.monoMedium,
    fontSize: 13,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.bone,
  },
  ctaTextDisabled: {
    color: colors.slate2,
  },
  note: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.bone2,
  },
});
