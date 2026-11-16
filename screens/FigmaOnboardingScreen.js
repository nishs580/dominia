// Figma onboarding host (plan U10): runs the post-auth steps of
// lib/onboardingFlow — age → daily rewards → location permission → city
// intro (silent home pin, or set-your-base with home_bases on) — then marks
// the player onboarded and opens the map, where OnboardingTutorialLifecycle
// shows the welcome overlay and the five tutorial cards.
//
// Mounted by the 'Onboarding' route when legacy_tabs is off (App.js
// OnboardingRoute); with it on, today's OnboardingScreen mounts unchanged.
// The step permission is not asked here: ActiveClaimScreen asks for it before
// the first claim.

import React, { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@clerk/clerk-expo';
import { useTranslation } from 'react-i18next';
import * as Location from 'expo-location';
import AgeScreen from './AgeScreen';
import AgeBlockedScreen from './AgeBlockedScreen';
import CityIntroScreen from './CityIntroScreen';
import { DailyRewardView } from './DailyRewardScreen';
import { getDailyReward, claimDailyReward } from '../lib/dailyRewardApi';
import { getFlag } from '../lib/flags';
import { setHomePin } from '../lib/homePinApi';
import { saveHomePin as saveHomePinToDevice } from '../lib/homePinCache';
import { patchMe, setAgeBand } from '../lib/meApi';
import { markFired } from '../lib/walkthroughFlags';
import {
  STEPS,
  TUTORIAL_PENDING_FLAG,
  fallbackCentreForLocale,
  initialState,
  onboardingReducer,
} from '../lib/onboardingFlow';
import { logDebug } from '../lib/debug';
import { colors, fonts } from '../lib/theme';

const LOCATION_FIX_TIMEOUT_MS = 10000;

function withTimeout(promise, ms) {
  return Promise.race([promise, new Promise((resolve) => setTimeout(() => resolve(null), ms))]);
}

async function currentCoords() {
  try {
    const pos = await withTimeout(
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      LOCATION_FIX_TIMEOUT_MS,
    );
    const c = pos?.coords ?? (await Location.getLastKnownPositionAsync().catch(() => null))?.coords;
    if (c && Number.isFinite(c.latitude) && Number.isFinite(c.longitude)) {
      return { lat: c.latitude, lng: c.longitude };
    }
  } catch (err) {
    console.log('[figmaOnboarding] location fix unavailable', err?.message ?? err);
  }
  return null;
}

export default function FigmaOnboardingScreen({ navigation }) {
  const { t, i18n } = useTranslation();
  const { userId, getToken, signOut } = useAuth();
  const [state, dispatch] = useReducer(
    onboardingReducer,
    undefined,
    () => initialState({ entry: STEPS.AGE, homeBases: getFlag('home_bases') }),
  );

  // Daily reward shown during onboarding: { status, reward }.
  const [reward, setReward] = useState({ status: 'loading', reward: null });
  const [rewardNonce, setRewardNonce] = useState(0);
  const [claimNote, setClaimNote] = useState(null);
  const ranSeq = useRef(0);
  const mounted = useRef(true);
  useEffect(() => () => {
    mounted.current = false;
  }, []);

  const safeDispatch = useCallback((ev) => {
    if (mounted.current) dispatch(ev);
  }, []);

  // Load today's reward when the step opens. Not deployed yet (404) or
  // nothing available skips the step; any other failure offers retry / skip.
  useEffect(() => {
    if (state.step !== STEPS.DAILY_REWARD) return undefined;
    let cancelled = false;
    setReward({ status: 'loading', reward: null });
    getDailyReward({ clerkGetToken: getToken }).then((res) => {
      if (cancelled) return;
      if (res.ok && res.data.available) {
        setReward({ status: 'ready', reward: res.data });
      } else if ((res.ok && !res.data.available) || res.status === 404) {
        safeDispatch({ type: 'REWARD_UNAVAILABLE' });
      } else {
        setReward({ status: 'error', reward: null });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [state.step, rewardNonce, getToken, safeDispatch]);

  // Run the effects of the latest transition exactly once.
  useEffect(() => {
    if (state.seq === ranSeq.current) return;
    ranSeq.current = state.seq;
    for (const fx of state.effects) {
      switch (fx.type) {
        case 'patchAge':
          // Never blocks onboarding; the band is re-askable later if lost.
          setAgeBand({ clerkGetToken: getToken, ageBand: fx.ageBand }).then((res) => {
            if (!res.ok) console.log('[figmaOnboarding] age band not saved', res.status);
          });
          break;

        case 'requestLocation':
          (async () => {
            const perm = await Location.requestForegroundPermissionsAsync().catch(() => null);
            const granted = Boolean(perm?.granted);
            const coords = granted ? await currentCoords() : null;
            safeDispatch({
              type: 'LOCATION_RESULT',
              granted,
              coords,
              fallback: fallbackCentreForLocale(i18n.language),
            });
          })();
          break;

        case 'saveHomePin':
          setHomePin({ clerkGetToken: getToken, lat: fx.lat, lng: fx.lng }).then((res) => {
            if (!res.ok) {
              console.log('[figmaOnboarding] home pin save failed', res.status, res.error);
              safeDispatch({ type: 'PIN_SAVE_FAILED' });
              return;
            }
            saveHomePinToDevice(userId, fx.lng, fx.lat);
            safeDispatch({ type: 'PIN_SAVED', homeCity: res.data?.home_city ?? null });
          });
          break;

        case 'claimReward':
          claimDailyReward({ clerkGetToken: getToken }).then((res) => {
            if (res.ok && mounted.current) {
              setClaimNote(
                t('dailyReward.collected', {
                  amount: res.data.gold_awarded,
                  defaultValue: '+{{amount}} Gold collected',
                }),
              );
            } else if (!res.ok) {
              // The returning-player check offers it again on the next launch.
              console.log('[figmaOnboarding] daily reward claim failed', res.status, res.code);
            }
          });
          break;

        case 'finishOnboarding':
          patchMe({ clerkGetToken: getToken, fields: { has_onboarded: true } }).then(async (res) => {
            if (!res.ok) {
              console.log('[figmaOnboarding] finish failed', res.status);
              safeDispatch({ type: 'FINISH_FAILED' });
              return;
            }
            logDebug(getToken, 'onboarding_completed', { flow: 'figma' });
            await markFired(userId, TUTORIAL_PENDING_FLAG);
            safeDispatch({ type: 'FINISHED' });
            navigation.replace('MainTabs');
          });
          break;

        default:
          break;
      }
    }
  }, [state.seq, state.effects, getToken, userId, i18n.language, navigation, safeDispatch, t]);

  switch (state.step) {
    case STEPS.AGE:
      return <AgeScreen onNext={(age) => dispatch({ type: 'AGE_SUBMITTED', age })} />;

    case STEPS.AGE_BLOCKED:
      return (
        <AgeBlockedScreen
          onBack={() => dispatch({ type: 'AGE_BACK' })}
          onSignOut={async () => {
            try {
              await signOut();
            } finally {
              navigation.replace('AuthGate');
            }
          }}
        />
      );

    case STEPS.DAILY_REWARD:
      return (
        <DailyRewardView
          status={reward.status}
          reward={reward.reward}
          background="map"
          onCollect={() => dispatch({ type: 'REWARD_COLLECT' })}
          onRetry={() => setRewardNonce((n) => n + 1)}
          onSkip={() => dispatch({ type: 'REWARD_SKIP' })}
        />
      );

    case STEPS.SET_BASE:
    case STEPS.CITY_INTRO:
    case STEPS.FINISHING:
      return (
        <CityIntroScreen
          mode={state.step === STEPS.SET_BASE ? 'setBase' : 'cityIntro'}
          pin={state.pin}
          pinStatus={state.pinStatus}
          homeCity={state.homeCity}
          usedFallback={state.usedFallback}
          claimNote={claimNote}
          finishing={state.step === STEPS.FINISHING}
          finishError={state.finishError}
          suggestedCentre={state.suggestedCentre}
          onConfirmBase={(coords) => dispatch({ type: 'BASE_CONFIRMED', coords })}
          onRetryPin={() => dispatch({ type: 'PIN_RETRY' })}
          onNext={() => dispatch({ type: 'CITY_NEXT' })}
        />
      );

    case STEPS.WELCOME:
    case STEPS.TUTORIAL:
    case STEPS.DONE:
      // Finished; the map is replacing this screen.
      return <View style={styles.blank} />;

    case STEPS.LOCATION:
    default:
      return (
        <View style={styles.waiting}>
          <ActivityIndicator color={colors.bone} />
          <Text style={styles.waitingText}>{t('cityIntro.locating', { defaultValue: 'Locating…' })}</Text>
        </View>
      );
  }
}

const styles = StyleSheet.create({
  blank: { flex: 1, backgroundColor: colors.ink },
  waiting: { flex: 1, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center', gap: 12 },
  waitingText: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1.8,
    color: colors.slate2,
    textTransform: 'uppercase',
  },
});
