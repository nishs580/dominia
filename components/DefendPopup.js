// Component: DefendPopup — Figma's in-map defend prompt (parity plan U12,
// Main · Cases 7 and 8), mounted by MapScreen only with `legacy_tabs` off.
// Renders the model from lib/defendPopup.js defendPopupModel(); it owns no
// selection, suppression or Gold logic.
//
//   solo      "CUBBON PARK · Under attack by Mr ABC · Mr ABC started the
//             attack 3 min ago. Start defending and protect your territory."
//   alliance  "Your Alliance member's (Moksh) territory is under attack,
//             defend their territory for them"
//   already started / window closed: same card, a note, no action.
//
// Surface: an ink scrim over the map (so it sits above the territory card and
// search results) and an Ink 2 card with a 1px top edge in the defence colour
// (vermillion for your own ground, electric blue for an ally's), 0 radius.
// DEFEND TERRITORY is the screen's single Electric Blue button; below the Gold fee it is disabled with the shortfall.
// Announced to screen readers when it appears.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { GoldGlyph } from './ResourceGlyphs';
import { colors, fonts } from '../lib/theme';
import { getActiveAttacks } from '../lib/activeAttacksApi';
import { onForegroundMessage } from '../lib/fcm';
import {
  POLL_INTERVAL_MS,
  dismissContest,
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
      if (mountedRef.current) setAttacks([]);
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

export default function DefendPopup({ model, onDefend, onDismiss }) {
  const { t } = useTranslation();
  const contestId = model?.contestId;
  const territoryName = model?.territoryName ?? '';

  useEffect(() => {
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
    defender: model.defender ? `@${model.defender}` : '',
    minutes: model.minutesAgo,
  };
  const ctaLabel = action ? tc(t, action.label) : '';

  return (
    <View style={styles.scrim} accessibilityViewIsModal>
      <View
        style={[
          styles.card,
          // Figma Defend Pop-up: vermillion edge when your own ground is under
          // attack, electric blue for an ally's, neutral once someone defends.
          {
            borderTopColor:
              model.state !== 'open' ? colors.hairlineStrong : model.scope === 'alliance' ? colors.alliance : colors.enemy,
          },
        ]}
        accessibilityLiveRegion="assertive"
      >
        <View style={styles.topRow}>
          <View style={styles.titleBlock}>
            <Text style={styles.name} numberOfLines={2} maxFontSizeMultiplier={1.3} accessibilityRole="header">
              {territoryName.toUpperCase()}
            </Text>
            <Text style={styles.status} numberOfLines={1} maxFontSizeMultiplier={1.3}>
              {tc(t, model.status, params)}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('defendPopup.closeA11y', { defaultValue: 'Dismiss defend alert' })}
            onPress={() => onDismiss?.(model.contestId)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.close}
          >
            <Text style={styles.closeText}>×</Text>
          </Pressable>
        </View>

        <Text style={styles.body} maxFontSizeMultiplier={1.3}>{tc(t, model.body, params)}</Text>

        {model.note ? (
          <Text style={styles.note} maxFontSizeMultiplier={1.3}>{tc(t, model.note, params)}</Text>
        ) : null}

        {action ? (
          <>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={action.price != null
                ? t('defendPopup.ctaA11y', {
                  defaultValue: '{{label}}, costs {{price}} Gold',
                  label: ctaLabel,
                  price: action.price,
                })
                : ctaLabel}
              accessibilityState={{ disabled: action.disabled }}
              disabled={action.disabled}
              onPress={() => onDefend?.(model)}
              style={({ pressed }) => [
                styles.cta,
                action.disabled && styles.ctaDisabled,
                pressed && !action.disabled && styles.ctaPressed,
              ]}
            >
              {action.price != null ? (
                <>
                  <Text style={[styles.ctaText, action.disabled && styles.ctaTextDisabled]}>{action.price}</Text>
                  <GoldGlyph size={14} color={action.disabled ? colors.slate2 : colors.bone} />
                </>
              ) : null}
              <Text style={[styles.ctaText, action.disabled && styles.ctaTextDisabled]}>{ctaLabel}</Text>
            </Pressable>
            {action.disabled && action.shortfall > 0 ? (
              <Text style={styles.note} accessibilityLiveRegion="polite">
                {t('defendPopup.shortfall', { defaultValue: '{{n}} Gold short', n: action.shortfall })}
              </Text>
            ) : null}
          </>
        ) : null}

        {model.moreCount > 0 ? (
          <Text style={styles.more}>
            {t('defendPopup.more', { defaultValue: '+{{n}} more', n: model.moreCount })}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(16,16,16,0.6)',
    justifyContent: 'center',
    paddingHorizontal: 16,
    zIndex: 60,
    elevation: 60,
  },
  card: {
    backgroundColor: colors.ink2,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    borderTopWidth: 3,
    borderRadius: 0,
    padding: 16,
    gap: 12,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  titleBlock: {
    flex: 1,
    gap: 4,
  },
  name: {
    fontFamily: fonts.displayMedium,
    fontSize: 20,
    color: colors.bone,
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
  body: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.bone,
  },
  note: {
    fontFamily: fonts.body,
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
  more: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.slate2,
  },
});
