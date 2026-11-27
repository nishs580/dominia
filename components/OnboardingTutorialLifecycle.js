// FTUE welcome + core-loop explainer deck over the map (plan U4).
//
// Mounted once in App.js (like NotificationCard) so MapScreen needs no change.
// Shows only when all of these hold:
//   - Figma onboarding is on (legacy_tabs off),
//   - this player finished Figma onboarding on this device
//     (TUTORIAL_PENDING_FLAG, set by FigmaOnboardingScreen),
//   - the deck has not been finished or skipped (last card's name unset),
//   - the root route is MainTabs (so never over Daily Rewards or a challenge).
//
// Order (lib/onboardingFlow): FTUE welcome "WALK IT TO OWN IT." → "WELCOME TO
// DOMINIA" (tap to continue) → five core-loop cards. SKIP anywhere, or NEXT on
// the last card, marks all five cards seen.

import React, { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { Modal } from 'react-native';
import { useAuth } from '@clerk/clerk-expo';
import WelcomeOverlay, { FtueWelcome } from './WelcomeOverlay';
import TutorialCards from './TutorialCards';
import { useFlag } from '../lib/flags';
import { getMe } from '../lib/meApi';
import { navigationRef } from '../lib/navigation';
import { hasFired, markFired, onWalkthroughFired } from '../lib/walkthroughFlags';
import {
  STEPS,
  TUTORIAL_NAMES,
  TUTORIAL_PENDING_FLAG,
  initialState,
  onboardingReducer,
} from '../lib/onboardingFlow';

function onMainTabs() {
  if (!navigationRef.isReady()) return false;
  const state = navigationRef.getRootState();
  return state?.routes?.[state.index]?.name === 'MainTabs';
}

export default function OnboardingTutorialLifecycle() {
  const { isSignedIn, userId, getToken } = useAuth();
  // Clerk's getToken is not referentially stable: keep it behind a ref.
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;
  const stableGetToken = useCallback((...args) => getTokenRef.current(...args), []);

  const legacyTabs = useFlag('legacy_tabs');
  const [eligible, setEligible] = useState(false);
  const [atMap, setAtMap] = useState(onMainTabs());
  const [me, setMe] = useState({ name: null, city: null });
  const [state, dispatch] = useReducer(onboardingReducer, undefined, () => initialState({ entry: STEPS.FTUE }));
  const ranSeq = useRef(state.seq);

  const checkEligible = useCallback(async () => {
    if (legacyTabs || !isSignedIn || !userId) {
      setEligible(false);
      return;
    }
    const [pending, done] = await Promise.all([
      hasFired(userId, TUTORIAL_PENDING_FLAG),
      hasFired(userId, TUTORIAL_NAMES[TUTORIAL_NAMES.length - 1]),
    ]);
    setEligible(pending && !done);
  }, [legacyTabs, isSignedIn, userId]);

  useEffect(() => {
    checkEligible();
    return onWalkthroughFired(({ userId: who, name }) => {
      if (who === userId && name === TUTORIAL_PENDING_FLAG) checkEligible();
    });
  }, [checkEligible, userId]);

  // The FTUE welcome names the player and their home city.
  useEffect(() => {
    if (!eligible) return undefined;
    let cancelled = false;
    getMe({ clerkGetToken: stableGetToken }).then((res) => {
      if (cancelled || !res.ok) return;
      const player = res.data?.player;
      setMe({ name: player?.username ?? null, city: player?.home_city ?? null });
    });
    return () => {
      cancelled = true;
    };
  }, [eligible, stableGetToken]);

  useEffect(() => {
    const listener = () => setAtMap(onMainTabs());
    const unsubscribe = navigationRef.addListener('state', listener);
    listener();
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
      else navigationRef.removeListener('state', listener);
    };
  }, []);

  useEffect(() => {
    if (state.seq === ranSeq.current) return;
    ranSeq.current = state.seq;
    for (const fx of state.effects) {
      if (fx.type === 'markSeen') {
        fx.names.forEach((name) => markFired(userId, name));
        setEligible(false);
      }
    }
  }, [state.seq, state.effects, userId]);

  const showing = state.step === STEPS.FTUE || state.step === STEPS.WELCOME || state.step === STEPS.TUTORIAL;
  if (!(eligible && atMap && showing)) return null;

  const skip = () => dispatch({ type: 'TUTORIAL_SKIP' });

  let content;
  if (state.step === STEPS.FTUE) {
    content = <FtueWelcome name={me.name} city={me.city} onGo={() => dispatch({ type: 'FTUE_GO' })} onSkip={skip} />;
  } else if (state.step === STEPS.WELCOME) {
    content = <WelcomeOverlay onContinue={() => dispatch({ type: 'WELCOME_TAP' })} />;
  } else {
    content = (
      <TutorialCards index={state.tutorialIndex} onNext={() => dispatch({ type: 'TUTORIAL_NEXT' })} onSkip={skip} />
    );
  }

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={skip}>
      {content}
    </Modal>
  );
}
