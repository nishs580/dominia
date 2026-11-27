// Component: DefendPopup — the in-map defend pop-up (Dominia-Temp plan U6,
// cases 7 and 8; earlier parity plan U12 / Updated UX U10), mounted by
// MapScreen only with `legacy_tabs` off. Renders the model from
// lib/defendPopup.js defendPopupModel(); it owns no selection, suppression or
// Gold logic.
//
//   case 7 own   [red shield] — UNDER ATTACK BY MR. ABC  [×] / CUBBON PARK /
//                "Mr. ABC started the attack 3 min ago. Start defending and
//                protect your territory" / TIME TO RESPOND 04:52 /
//                10 [gold] | DEFEND TERRITORY »
//   case 8 ally  same, body "Your Alliance member's [Moksh] territory is
//                under attack, defend their territory for them"
//   underway     DEFENDED BY RAVI K. / DEFENCE UNDERWAY / disabled
//                DEFENCE IN PROGRESS
//   ally on      ALLY DEFENDING · INDIRANAGAR / RAVI K. IS ON IT /
//                DEFENCE ENDS IN 07:40 / GOT IT
//
// Surface: a light scrim over the map (tap it, or the ×, to dismiss) and the
// same cut-corner card as the territory pop-up, at the bottom of the map.
// Below the Gold fee the cost segment turns red, the CTA is disabled and
// "Not enough gold" shows; past the window the CTA is disabled. The
// countdown ticks every second. Announced to screen readers on appear.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { SlantButton } from './ui';
import { CostSegment, PopupClose, PopupEyebrow, PopupSurface, TerritorySwatch } from './TerritoryCard';
import { colors, fonts } from '../lib/theme';
import { getActiveAttacks } from '../lib/activeAttacksApi';
import { onForegroundMessage } from '../lib/fcm';
import {
  POLL_INTERVAL_MS,
  dismissContest,
  formatCountdown,
  isRouteMounted,
  msUntilFetchAllowed,
  nextAttacks,
} from '../lib/defendPopup';

// Feed for the pop-up: polls GET /me/active-attacks on map focus and every
// 30 s while focused, and refetches on a defender_notify foreground push (a
// second onMessage listener; FcmLifecycle's banner routing is untouched).
// Fetches are spaced to respect the backend's 1-per-10 s limit. Disabled
// (legacy_tabs on) it never fetches and returns no attacks.
//
// challengeActive is true while ActiveClaim is mounted in the root stack, so
// an attack arriving mid-challenge waits until the challenge ends.
export function useDefendPopupFeed({ enabled, getTokenRef }) {
  const navigation = useNavigation();
  const [attacks, setAttacks] = useState([]);
  const [challengeActive, setChallengeActive] = useState(false);
  const [dismissTick, setDismissTick] = useState(0);
  const lastFetchAtRef = useRef(null);
  const inFlightRef = useRef(false);
  const focusedRef = useRef(false);
  const timerRef = useRef(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const checkChallenge = useCallback(() => {
    let root = navigation;
    try {
      while (root?.getParent?.()) root = root.getParent();
      const active = isRouteMounted(root?.getState?.(), 'ActiveClaim');
      if (mountedRef.current) setChallengeActive(active);
      return active;
    } catch (_) {
      return false;
    }
  }, [navigation]);

  const fetchNow = useCallback(async () => {
    if (!enabled || inFlightRef.current) return;
    if (checkChallenge()) return;
    inFlightRef.current = true;
    lastFetchAtRef.current = Date.now();
    try {
      const result = await getActiveAttacks({ clerkGetToken: () => getTokenRef.current() });
      if (mountedRef.current) setAttacks((prev) => nextAttacks(prev, result));
    } catch (_) {
      // A thrown fetch is transient: keep the pop-up, as for a 429.
    } finally {
      inFlightRef.current = false;
    }
  }, [enabled, getTokenRef, checkChallenge]);

  const requestFetch = useCallback(() => {
    if (timerRef.current) return;
    const wait = msUntilFetchAllowed(lastFetchAtRef.current, Date.now());
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      if (focusedRef.current) fetchNow();
    }, wait);
  }, [fetchNow]);

  useFocusEffect(
    useCallback(() => {
      if (!enabled) {
        setAttacks([]);
        return undefined;
      }
      focusedRef.current = true;
      checkChallenge();
      requestFetch();
      const interval = setInterval(requestFetch, POLL_INTERVAL_MS);
      return () => {
        focusedRef.current = false;
        clearInterval(interval);
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = null;
      };
    }, [enabled, requestFetch, checkChallenge]),
  );

  useEffect(() => {
    if (!enabled) return undefined;
    let unsubscribe;
    try {
      unsubscribe = onForegroundMessage((remoteMessage) => {
        if (remoteMessage?.data?.kind === 'defender_notify' && focusedRef.current) requestFetch();
      });
    } catch (err) {
      console.warn('[DefendPopup] foreground listener failed:', err?.message);
    }
    return () => {
      try {
        unsubscribe?.();
      } catch (_) {
        /* ignore */
      }
    };
  }, [enabled, requestFetch]);

  const dismiss = useCallback((contestId) => {
    dismissContest(contestId);
    setDismissTick((n) => n + 1);
  }, []);

  return { attacks, challengeActive, dismiss, dismissTick };
}

function tc(t, copy, params) {
  return t(copy.key, { defaultValue: copy.defaultValue, ...params });
}

// Ticks the countdown once a second while the pop-up shows. Returns the
// "mm:ss" text (or "—") and whether the window has passed.
function useCountdown(countdown) {
  const endsAt = countdown?.endsAt ?? null;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (endsAt == null) return undefined;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [endsAt]);
  if (!countdown) return { text: null, expired: false };
  if (endsAt == null) return { text: countdown.text, expired: false };
  return { text: formatCountdown(endsAt - now), expired: endsAt <= now };
}

// Eyebrow colour per state: red while under attack (cases 7 and 8), alliance
// blue once an ally defends yours, muted once someone else is defending or
// the window has closed.
function accentFor(model) {
  if (model.state === 'already_started' || model.state === 'closed') return colors.muted2;
  if (model.state === 'allyDefending') return colors.alliance;
  return colors.enemy;
}

export default function DefendPopup({ model, onDefend, onDismiss }) {
  const { t } = useTranslation();
  const contestId = model?.contestId;
  const territoryName = model?.territoryName ?? '';
  const [busy, setBusy] = useState(false);
  const { text: countdownText, expired } = useCountdown(model?.countdown);

  useEffect(() => {
    setBusy(false);
    if (!contestId) return;
    AccessibilityInfo.announceForAccessibility?.(
      t('defendPopup.announce', {
        defaultValue: '{{territory}} is under attack',
        territory: territoryName,
      }),
    );
    // Announce once per contest shown, not on every poll.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contestId]);

  if (!model) return null;

  const { action } = model;
  const params = {
    attacker: model.attacker,
    owner: model.owner,
    alliance: model.alliance,
    territory: territoryName,
    defender: model.defender ?? '',
    minutes: model.minutesAgo,
  };
  const accent = accentFor(model);
  const dismiss = () => onDismiss?.(model.contestId);

  const isDefend = action?.kind === 'defend';
  const isGotIt = action?.kind === 'gotIt';
  const disabled = !!action && (action.disabled || (isDefend && expired));
  const label = action ? tc(t, action.label) : '';
  const priced = isDefend && action.price != null;
  const short = isDefend && action.shortfall > 0;
  const title = model.title ? tc(t, model.title, params) : territoryName;
  const closeLabel = model.secondary
    ? tc(t, model.secondary)
    : t('defendPopup.closeA11y', { defaultValue: 'Dismiss defend alert' });

  const onCta = async () => {
    if (!action || disabled || busy) return;
    if (isGotIt) {
      dismiss();
      return;
    }
    if (!isDefend) return;
    setBusy(true);
    try {
      await onDefend?.(model);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Pressable
      style={styles.scrim}
      onPress={dismiss}
      accessibilityViewIsModal
      accessible={false}
    >
      <Pressable style={styles.cardWrap} accessibilityLiveRegion="assertive" onPress={() => {}}>
        <PopupSurface>
          <View style={styles.header}>
            <TerritorySwatch tone="red" mark="shield" />
            <View style={styles.headerText}>
              <PopupEyebrow text={tc(t, model.eyebrow, params)} color={accent} />
              <Text style={styles.title} numberOfLines={2} maxFontSizeMultiplier={1.3} accessibilityRole="header">
                {title}
              </Text>
            </View>
            <PopupClose onPress={dismiss} accessibilityLabel={closeLabel} />
          </View>

          <Text style={styles.body} maxFontSizeMultiplier={1.3}>{tc(t, model.body, params)}</Text>

          {model.note ? (
            <Text style={styles.note} maxFontSizeMultiplier={1.3}>{tc(t, model.note, params)}</Text>
          ) : null}

          {model.countdown ? (
            <View style={styles.countdownRow}>
              <Text style={styles.countdownLabel} maxFontSizeMultiplier={1.3}>
                {tc(t, model.countdown.label)}
              </Text>
              <Text style={styles.countdownValue} maxFontSizeMultiplier={1.2}>{countdownText}</Text>
            </View>
          ) : null}

          {action ? (
            <SlantButton
              label={busy ? t('map.card.processing', { defaultValue: 'PROCESSING…' }) : label}
              onPress={onCta}
              variant={isDefend ? 'primary' : 'outline'}
              disabled={disabled}
              loading={busy}
              size="md"
              trailingChevron={isDefend}
              leading={priced ? <CostSegment price={action.price} short={short} /> : null}
              accessibilityLabel={priced
                ? t('defendPopup.ctaA11y', {
                  defaultValue: '{{label}}, costs {{price}} Gold',
                  label,
                  price: action.price,
                })
                : label}
            />
          ) : null}

          {isDefend && action.hint ? (
            <Text style={styles.danger} accessibilityLiveRegion="polite" maxFontSizeMultiplier={1.3}>
              {tc(t, action.hint)}
            </Text>
          ) : null}

          {model.moreCount > 0 ? (
            <Text style={styles.more}>
              {t('defendPopup.more', { defaultValue: '+{{n}} more', n: model.moreCount })}
            </Text>
          ) : null}
        </PopupSurface>
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingBottom: 12,
    zIndex: 60,
    elevation: 60,
  },
  cardWrap: {
    alignSelf: 'stretch',
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
  title: {
    fontFamily: fonts.display,
    fontSize: 24,
    lineHeight: 28,
    color: colors.white,
    textTransform: 'uppercase',
  },
  body: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 21,
    color: colors.muted2,
  },
  note: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 19,
    color: colors.white2,
  },
  danger: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    lineHeight: 19,
    color: colors.danger,
  },
  countdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
    paddingTop: 12,
  },
  countdownLabel: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: colors.muted2,
  },
  countdownValue: {
    fontFamily: fonts.bodyMedium,
    fontSize: 22,
    color: colors.white,
  },
  more: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.muted2,
  },
});
