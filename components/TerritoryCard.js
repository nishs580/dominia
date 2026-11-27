// Component: TerritoryCard — Figma's compact territory card (parity plan
// U11; Updated UX C4/C5/B3, plan U8), mounted instead of TerritorySheet when
// `full_territory_sheet` is off.
//
//   tag chips (ENEMY + SOLO/[TAG], ALLIANCE + [TAG], YOURS, UNCLAIMED or
//   FIRST CLAIM · FREE) and close ×
//   title: the name, or "{OWNER}'S TERRITORY" on someone else's ground
//   enemy subline: "Domlur · held for 3 days" (holding time when known)
//   one mono meta row: pin 1,094 M · clock 30 MIN LIMIT
//   explainer (enemy, alliance) or the first-claim line
//   CTA: "10 GOLD · START CLAIMING" / "8 GOLD · CONTEST TERRITORY" (the free
//   first claim drops the price), or an outlined VIEW ALLIANCE on an ally's
//   ground, nothing on your own.
//
// The card owns no claim logic: the CTA calls onStartClaim / onStartContest,
// which MapScreen routes through the same start flow TerritorySheet uses.
// Those resolve to { ok } or { ok: false, message }. VIEW ALLIANCE calls
// onViewAlliance.
//
// Surface: Ink 2, 1px top edge in the territory's identity colour, 0 radius.
// The CTA is the screen's single Electric Blue button. Insufficient Gold
// disables it and states the shortfall.

import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import TagChip from './TagChip';
import { CoachBubble } from './CoachMark';
import { ClockIcon, PinIcon } from './MapIcons';
import { BUSY_LABEL, CARD_COPY, territoryCardModel, territoryOwnership } from '../lib/territoryCard';
import { formatWalkDistance } from '../lib/firstClaimApi';
import { getTerritoryHistoryStats } from '../lib/territory';
import { colors, fonts } from '../lib/theme';

const OWNERSHIP_COLOR = {
  unclaimed: colors.slate,
  yours: colors.claim,
  alliance: colors.alliance,
  enemy: colors.enemy,
};

function tc(t, copy, params) {
  return t(copy.key, { defaultValue: copy.defaultValue, ...params });
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
  onViewAlliance,
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

  // "held for N days" on enemy ground, from the open territory_history row.
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
  const ownColor = OWNERSHIP_COLOR[model.ownership];
  const title = model.title.copy ? tc(t, model.title.copy, model.title.params) : name;

  let subline = null;
  if (model.subline) {
    subline = model.subline.copy
      ? tc(t, model.subline.copy, model.subline.params)
      : model.subline.params.name || null;
  }

  const action = model.action;
  const currencyName = action?.currency === 'iron'
    ? t('map.card.iron', { defaultValue: 'Iron' })
    : t('map.card.gold', { defaultValue: 'Gold' });
  const ctaLabel = action ? t(action.label.key, { defaultValue: action.label.defaultValue }) : null;
  const ctaText = action
    ? (action.free
      ? ctaLabel
      : tc(t, CARD_COPY.ctaPriced, {
        price: action.price,
        currency: tc(t, action.currency === 'iron' ? CARD_COPY.iron : CARD_COPY.gold),
        label: ctaLabel,
      }))
    : null;
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
      {onCoachBubblePress ? <CoachBubble onPress={onCoachBubblePress} /> : null}
      <View style={styles.topRow}>
        <View style={styles.tags}>
          {model.tags.map((tag) => (
            <TagChip key={tag.kind + (tag.text ?? '')} kind={tag.kind}>
              {tag.label ? tc(t, tag.label) : tag.text}
            </TagChip>
          ))}
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

      <View style={styles.titleBlock}>
        <Text style={styles.name} numberOfLines={2} maxFontSizeMultiplier={1.3} accessibilityRole="header">
          {title}
        </Text>
        {subline ? (
          <Text style={styles.subline} numberOfLines={1} maxFontSizeMultiplier={1.3}>{subline}</Text>
        ) : null}
      </View>

      {model.ownership !== 'alliance' ? (
        <View
          style={styles.metaRow}
          accessible
          accessibilityLabel={tc(t, model.metaLine.copy, model.metaLine.params)}
        >
          <PinIcon size={14} color={colors.slate2} />
          <Text style={styles.meta} maxFontSizeMultiplier={1.3}>
            {t('map.card.metaDistance', { defaultValue: '{{distance}} M', distance: model.metaLine.params.distance })}
          </Text>
          <ClockIcon size={14} color={colors.slate2} />
          <Text style={styles.meta} maxFontSizeMultiplier={1.3}>
            {t('map.card.metaLimit', { defaultValue: '{{minutes}} MIN LIMIT', minutes: model.metaLine.params.minutes })}
          </Text>
        </View>
      ) : null}

      {showFirstClaim ? (
        <Text style={styles.firstClaimLine} maxFontSizeMultiplier={1.3}>
          {t('firstClaim.sheetLine', { distance: formatWalkDistance(model.distanceM) })}
        </Text>
      ) : null}

      {model.explainer ? (
        <Text style={styles.explainer} maxFontSizeMultiplier={1.3}>
          {tc(t, model.explainer.copy, model.explainer.params)}
        </Text>
      ) : null}

      {model.viewAlliance ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => onViewAlliance?.(model)}
          style={({ pressed }) => [styles.ctaOutline, pressed && styles.ctaPressed]}
        >
          <Text style={styles.ctaText}>{tc(t, model.viewAlliance.label)}</Text>
        </Pressable>
      ) : null}

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
              <Text style={[styles.ctaText, action.disabled && styles.ctaTextDisabled]}>{ctaText}</Text>
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
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 20,
    gap: 12,
    zIndex: 30,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  tags: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  titleBlock: {
    gap: 6,
  },
  name: {
    fontFamily: fonts.display,
    fontSize: 26,
    color: colors.bone,
    lineHeight: 28,
    textTransform: 'uppercase',
  },
  subline: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.slate2,
  },
  close: {
    width: 44,
    height: 44,
    marginVertical: -10,
    marginRight: -10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    fontFamily: fonts.mono,
    fontSize: 20,
    color: colors.bone,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  meta: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: colors.slate2,
    marginRight: 8,
  },
  explainer: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 19,
    color: colors.slate2,
  },
  firstClaimLine: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    lineHeight: 19,
    color: colors.lime,
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
  ctaOutline: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    borderRadius: 0,
  },
  ctaPressed: {
    opacity: 0.92,
  },
  ctaBusy: {
    opacity: 0.6,
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
