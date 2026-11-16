// Welcome overlay + five tutorial cards over the map (plan U10).
//
// Mounted once in App.js (like NotificationCard) so MapScreen needs no change.
// Shows only when all of these hold:
//   - Figma onboarding is on (legacy_tabs off),
//   - this player finished Figma onboarding on this device
//     (TUTORIAL_PENDING_FLAG, set by FigmaOnboardingScreen),
//   - the tutorial has not been finished or skipped (last card's name unset),
//   - the root route is MainTabs (so never over Daily Rewards or a challenge).
// Progress is driven by lib/onboardingFlow; Skip or Next on the last card
// marks all five cards seen.

import React, { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { Modal } from 'react-native';
import { useAuth } from '@clerk/clerk-expo';
import WelcomeOverlay from './WelcomeOverlay';
import TutorialCards from './TutorialCards';
import { useFlag } from '../lib/flags';
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
  const { isSignedIn, userId } = useAuth();
  const legacyTabs = useFlag('legacy_tabs');
  const [eligible, setEligible] = useState(false);
  const [atMap, setAtMap] = useState(onMainTabs());
  const [state, dispatch] = useReducer(onboardingReducer, undefined, () => initialState({ entry: STEPS.WELCOME }));
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

  const visible = eligible && atMap && (state.step === STEPS.WELCOME || state.step === STEPS.TUTORIAL);
  if (!visible) return null;

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => dispatch({ type: 'TUTORIAL_SKIP' })}
    >
      {state.step === STEPS.WELCOME ? (
        <WelcomeOverlay onContinue={() => dispatch({ type: 'WELCOME_TAP' })} />
      ) : (
        <TutorialCards
          index={state.tutorialIndex}
          onNext={() => dispatch({ type: 'TUTORIAL_NEXT' })}
          onSkip={() => dispatch({ type: 'TUTORIAL_SKIP' })}
        />
      )}
    </Modal>
  );
}
