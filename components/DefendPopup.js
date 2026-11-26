// Component: DefendPopup — Figma's in-map defend prompt (parity plan U12;
// Updated UX frames D1, D6, D7, D8, plan U10), mounted by MapScreen only with
// `legacy_tabs` off. Renders the model from lib/defendPopup.js
// defendPopupModel(); it owns no selection, suppression or Gold logic.
//
//   D1 own      shield · UNDER ATTACK BY MR. ABC / DEFEND INDIRANAGAR /
//               TIME TO RESPOND 04:52 / 5 GOLD · DEFEND TERRITORY / LET IT GO
//   D6 ally     JALAHALLI CULT · KORAMANGALA / ALLY UNDER ATTACK /
//               5 GOLD · DEFEND FOR ALLY / NOT NOW
//   D7 underway DEFENDED BY RAVI K. / DEFENCE UNDERWAY / disabled
//               DEFENCE IN PROGRESS
//   D8 ally on  ALLY DEFENDING · INDIRANAGAR / RAVI K. IS ON IT /
//               DEFENCE ENDS IN 07:40 / GOT IT
//
// Surface: an ink scrim over the map (tap it to dismiss) and an Ink 2 card
// bordered in the defence colour (vermillion for your own ground, electric
// blue for an ally's), 0 radius. The defend CTA is the screen's single
// Electric Blue button; below the Gold fee or past the window it is disabled.
// The countdown ticks every second. Announced to screen readers on appear.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { ShieldIcon } from './MapIcons';
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

// Accent per state (Figma): vermillion for your own ground (D1), electric
// blue for an ally's (D6) and for an ally defending yours (D8), neutral once
// someone else is defending (D7).
function accentFor(model) {
  if (model.state === 'already_started' || model.state === 'closed') return colors.slate2;
  if (model.state === 'allyDefending' || model.scope === 'alliance') return colors.alliance;
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
  const disabled = !!action && (action.disabled || (isDefend && expired) || busy);
  const label = action ? tc(t, action.label) : '';
  const ctaText = isDefend && action.price != null
    ? t('defendPopup.ctaPriced', {
      defaultValue: '{{price}} GOLD · {{label}}',
      price: action.price,
      label,
    })
    : label;

  const onCta = async () => {
    if (!action || disabled) return;
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

  const borderStyle = model.state === 'allyDefending'
    ? { borderColor: colors.hairlineStrong, borderTopColor: accent, borderTopWidth: 3 }
    : model.state === 'open'
      ? { borderColor: accent }
      : { borderColor: colors.hairlineStrong };

  return (
    <Pressable
      style={styles.scrim}
      onPress={dismiss}
      accessibilityViewIsModal
      accessible={false}
    >
      <Pressable style={[styles.card, borderStyle]} accessibilityLiveRegion="assertive" onPress={() => {}}>
        <View style={styles.eyebrowRow}>
          <ShieldIcon size={14} color={accent} />
          <Text style={[styles.eyebrow, { color: accent }]} numberOfLines={1} maxFontSizeMultiplier={1.3}>
            {tc(t, model.eyebrow, params)}
          </Text>
        </View>

        <Text style={styles.title} numberOfLines={2} maxFontSizeMultiplier={1.3} accessibilityRole="header">
          {tc(t, model.title, params)}
        </Text>

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
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={ctaText}
            accessibilityState={{ disabled, busy }}
            disabled={disabled}
            onPress={onCta}
            style={({ pressed }) => [
              isDefend ? styles.cta : styles.ctaOutline,
              isDefend && disabled && styles.ctaDisabled,
              pressed && !disabled && styles.ctaPressed,
            ]}
          >
            {busy ? <ActivityIndicator size="small" color={colors.bone} /> : null}
            <Text
              style={[
                styles.ctaText,
                (action.kind === 'inProgress' || (isDefend && disabled)) && styles.ctaTextDisabled,
              ]}
            >
              {busy ? t('map.card.processing', { defaultValue: 'PROCESSING…' }) : ctaText}
            </Text>
          </Pressable>
        ) : null}

        {isDefend && action.shortfall > 0 ? (
          <Text style={styles.note} accessibilityLiveRegion="polite">
            {t('defendPopup.shortfall', { defaultValue: '{{n}} Gold short', n: action.shortfall })}
          </Text>
        ) : null}

        {model.secondary ? (
          <Pressable
            accessibilityRole="button"
            onPress={dismiss}
            style={({ pressed }) => [styles.secondary, pressed && styles.ctaPressed]}
          >
            <Text style={styles.secondaryText}>{tc(t, model.secondary)}</Text>
          </Pressable>
        ) : null}

        {model.moreCount > 0 ? (
          <Text style={styles.more}>
            {t('defendPopup.more', { defaultValue: '+{{n}} more', n: model.moreCount })}
          </Text>
        ) : null}
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(16,16,16,0.6)',
    justifyContent: 'center',
    paddingHorizontal: 24,
    zIndex: 60,
    elevation: 60,
  },
  card: {
    backgroundColor: colors.ink2,
    borderWidth: 1,
    borderRadius: 0,
    paddingHorizontal: 24,
    paddingVertical: 24,
    gap: 14,
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  eyebrow: {
    flex: 1,
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1.76,
    textTransform: 'uppercase',
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 32,
    lineHeight: 34,
    color: colors.bone,
    textTransform: 'uppercase',
  },
  body: {
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 21,
    color: colors.slate2,
  },
  note: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.bone2,
  },
  countdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
    paddingTop: 14,
  },
  countdownLabel: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1.76,
    textTransform: 'uppercase',
    color: colors.slate2,
  },
  countdownValue: {
    fontFamily: fonts.mono,
    fontSize: 22,
    color: colors.bone,
  },
  cta: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
    backgroundColor: colors.claimButton,
    borderRadius: 0,
  },
  ctaOutline: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    borderRadius: 0,
  },
  ctaPressed: {
    opacity: 0.92,
  },
  ctaDisabled: {
    backgroundColor: colors.ink2,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
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
  secondary: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: {
    fontFamily: fonts.monoMedium,
    fontSize: 13,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.bone2,
  },
  more: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.slate2,
  },
});
