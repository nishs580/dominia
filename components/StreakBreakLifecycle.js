import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useAuth } from '@clerk/clerk-expo';
import { navigationRef } from '../lib/navigation';
import { showCard, getCurrentCard } from '../lib/notifications/cardController';
import { getStreakBreakStatus, acknowledgeStreakBreak } from '../lib/streakBreakApi';

const STREAK_BROKEN_TITLE = 'Your streak reset.';

const MAIN_TABS_ROUTES = new Set(['Map', 'Activity', 'Alliance', 'Profile', 'MainTabs']);

function buildBreakBody(previousStreak) {
  return `Your streak has reset. Your best streak was ${previousStreak} days — that's recorded on your profile permanently. Every territory you've held is still in your Commander history. Today is Day 1.`;
}

function isMainTabsRoute() {
  if (!navigationRef.isReady()) return false;
  const name = navigationRef.getCurrentRoute()?.name;
  return MAIN_TABS_ROUTES.has(name);
}

export default function StreakBreakLifecycle() {
  const { isSignedIn, getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  const inflightRef = useRef(false);

  useEffect(() => {
    getTokenRef.current = getToken;
  }, [getToken]);

  const checkAndShow = useCallback(async () => {
    if (!isSignedIn) return;
    if (!isMainTabsRoute()) return;
    if (inflightRef.current) return;
    if (getCurrentCard() !== null) return;

    inflightRef.current = true;
    try {
      const result = await getStreakBreakStatus({ clerkGetToken: () => getTokenRef.current() });
      if (!result.ok) {
        console.error('[StreakBreakLifecycle] status check failed', result.status, result.error);
        return;
      }

      const status = result.data;
      if (status.has_unacknowledged_break === false) return;
      if (typeof status.previous_streak !== 'number') {
        console.warn('[StreakBreakLifecycle] malformed previous_streak', status.previous_streak);
        return;
      }

      showCard({
        kind: 'streak_broken',
        data: {
          title: STREAK_BROKEN_TITLE,
          body: buildBreakBody(status.previous_streak),
        },
        target: 'Activity',
        onDismiss: async () => {
          try {
            await acknowledgeStreakBreak({ clerkGetToken: () => getTokenRef.current() });
          } catch (err) {
            console.error('[StreakBreakLifecycle] acknowledge failed', err);
          }
        },
      });
    } catch (err) {
      console.error('[StreakBreakLifecycle] status check failed', err);
    } finally {
      inflightRef.current = false;
    }
  }, [isSignedIn]);

  useEffect(() => {
    if (!isSignedIn) return;

    const tryCheck = () => {
      if (isMainTabsRoute()) {
        checkAndShow();
      }
    };

    tryCheck();
    const unsubscribe = navigationRef.addListener('state', tryCheck);
    return unsubscribe;
  }, [isSignedIn, checkAndShow]);

  useEffect(() => {
    if (!isSignedIn) return;

    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') {
        checkAndShow();
      }
    });
    return () => sub.remove();
  }, [isSignedIn, checkAndShow]);

  return null;
}
