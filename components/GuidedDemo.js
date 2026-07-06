import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StatusBar, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@clerk/clerk-expo';
import { useNavigationState } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { colors, fonts } from '../lib/theme';
import { hasFired, markFired } from '../lib/walkthroughFlags';
import { formatWalkDistance } from '../lib/firstClaimApi';
import {
  emitDemoEvent,
  getLastDemoEvent,
  onDemoEvent,
  resolveDemoRect,
  runDemoAction,
  setDemoActive,
} from '../lib/demoRegistry';

const TAB_ORDER = ['Map', 'Activity', 'Alliance', 'Profile'];
const SCRIM = 'rgba(14,16,20,0.72)';

/**
 * First-run guided demo — a gated, hand-held tour (runs once per player).
 *
 * Mounted above the tab navigator so it can cover the tab bar. Two step
 * kinds: "read" steps dim everything, leave the explained element undimmed,
 * and advance on a tap anywhere; "directed" steps block everything except one
 * hole (a territory, a tab button) and advance only when the player performs
 * that exact tap — the app underneath handles it for real. There is no
 * system-driven motion: the only animation is a 280ms card fade, per brand
 * motion rules. SKIP TOUR is always available and ends the tour without
 * marking the per-element tips, so the reactive tips backfill anything a
 * skipper never read.
 *
 * The tour ends where the mechanic starts: the first-claim instruction. It
 * never force-taps the Claim button (that would open a real, expiring claim
 * intent) — the persistent objective banner owns the player from there.
 */
export default function GuidedDemo() {
  const { userId } = useAuth();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const [status, setStatus] = useState('idle'); // idle | blocking | running | done
  const [stepIndex, setStepIndex] = useState(0);
  const [holeRect, setHoleRect] = useState(null);
  const [cardVisible, setCardVisible] = useState(false);
  const [layout, setLayout] = useState(null);

  const stepsRef = useRef([]);
  const stepIndexRef = useRef(0);
  const statusRef = useRef('idle');
  const shownTipFlagsRef = useRef([]);
  const layoutRef = useRef(null);
  const cardOpacity = useRef(new Animated.Value(0)).current;

  const tabBarHeight = 62 + insets.bottom;

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const focusedTab = useNavigationState((state) => {
    const main = state?.routes?.find((r) => r.name === 'MainTabs');
    const tabState = main?.state;
    if (!tabState || tabState.index == null) return 'Map';
    return tabState.routes[tabState.index]?.name ?? 'Map';
  });

  const buildSteps = useCallback(
    (objective, city) => {
      const steps = [
        {
          key: 'intro',
          kind: 'read',
          tipFlag: 'tip:map:intro',
          text: city
            ? t('walkthrough.map.intro', { city })
            : t('walkthrough.map.introNoCity'),
        },
        { key: 'colours', kind: 'read', tipFlag: 'tip:map:colours', text: t('walkthrough.map.colours') },
      ];
      if (objective) {
        steps.push(
          {
            key: 'tapTerritory',
            kind: 'target-territory',
            tipFlag: 'tip:map:card',
            kicker: t('firstClaim.kicker'),
            text: t('demo.tapTerritory', { name: objective.name }),
          },
          {
            key: 'sheet',
            kind: 'sheet',
            kicker: t('firstClaim.kicker'),
            text: `${t('firstClaim.instruction', {
              distance: formatWalkDistance(objective.distance_m),
              name: objective.name,
            })} ${t('demo.fromAnywhere')}`,
            cta: t('walkthrough.gotIt'),
          },
        );
      }
      steps.push(
        { key: 'tapActivity', kind: 'target-tab', tab: 'Activity', text: t('demo.tapActivity') },
        { key: 'streak', kind: 'read', rectKey: 'activity.streak', tipFlag: 'tip:activity:streak', text: t('walkthrough.activity.streak') },
        { key: 'challenges', kind: 'read', rectKey: 'activity.challenges', tipFlag: 'tip:activity:challenges', text: t('walkthrough.activity.challenges') },
        { key: 'tapAlliance', kind: 'target-tab', tab: 'Alliance', text: t('demo.tapAlliance') },
        { key: 'solo', kind: 'read', rectKey: 'alliance.solo', tipFlag: 'tip:alliance:solo', skipIfNoRect: true, text: t('walkthrough.alliance.solo') },
        { key: 'tapProfile', kind: 'target-tab', tab: 'Profile', text: t('demo.tapProfile') },
        { key: 'power', kind: 'read', rectKey: 'profile.power', tipFlag: 'tip:profile:power', text: t('walkthrough.profile.power') },
        { key: 'resources', kind: 'read', rectKey: 'profile.resources', tipFlag: 'tip:profile:resources', text: t('walkthrough.profile.resources') },
        { key: 'tapMap', kind: 'target-tab', tab: 'Map', text: t('demo.tapMap') },
      );
      return steps;
    },
    [t],
  );

  const tabRect = useCallback(
    (tabName) => {
      const box = layoutRef.current;
      if (!box) return null;
      const idx = TAB_ORDER.indexOf(tabName);
      if (idx < 0) return null;
      const tabWidth = box.width / TAB_ORDER.length;
      return { x: idx * tabWidth, y: box.height - tabBarHeight, width: tabWidth, height: tabBarHeight };
    },
    [tabBarHeight],
  );

  const finish = useCallback(
    (completed) => {
      if (statusRef.current === 'done') return;
      markFired(userId, 'demo');
      if (completed) {
        // Completing the tour counts as having read these — the reactive
        // first-tap tips must not repeat them. Skipping leaves them unread,
        // so the tips backfill later.
        shownTipFlagsRef.current.forEach((flag) => markFired(userId, flag));
      }
      setDemoActive(false);
      emitDemoEvent('demo.ended', { completed });
      Animated.timing(cardOpacity, { toValue: 0, duration: 280, useNativeDriver: true }).start();
      setStatus('done');
    },
    [cardOpacity, userId],
  );

  const runStep = useCallback(
    async (index) => {
      const steps = stepsRef.current;
      if (index >= steps.length) {
        finish(true);
        return;
      }
      const step = steps[index];
      stepIndexRef.current = index;
      setStepIndex(index);
      setCardVisible(false);
      cardOpacity.setValue(0);
      setHoleRect(null);

      let rect = null;
      if (step.kind === 'read' && step.rectKey) {
        rect = await resolveDemoRect(step.rectKey, { tries: step.skipIfNoRect ? 4 : 10 });
        if (!rect && step.skipIfNoRect) {
          runStep(index + 1);
          return;
        }
      } else if (step.kind === 'target-territory') {
        // Provider flies the camera to the objective and projects it — slow
        // by design, so few tries.
        rect = await resolveDemoRect('map.objectiveRect', { tries: 3, delayMs: 300 });
        if (!rect) {
          // No claimable target measurable — drop the claim beats entirely.
          runStep(index + 2);
          return;
        }
      } else if (step.kind === 'sheet') {
        const box = layoutRef.current;
        if (box) rect = { x: 0, y: box.height * 0.52, width: box.width, height: box.height * 0.48 };
      } else if (step.kind === 'target-tab') {
        rect = tabRect(step.tab);
      }

      if (statusRef.current !== 'running') return;
      if (step.tipFlag) shownTipFlagsRef.current.push(step.tipFlag);
      setHoleRect(rect);
      setCardVisible(true);
      Animated.timing(cardOpacity, { toValue: 1, duration: 280, useNativeDriver: true }).start();
    },
    [cardOpacity, finish, tabRect],
  );

  const advance = useCallback(() => {
    runStep(stepIndexRef.current + 1);
  }, [runStep]);

  // Boot: wait for MapScreen to resolve the first-claim objective, then run.
  useEffect(() => {
    if (!userId || statusRef.current !== 'idle') return undefined;
    let cancelled = false;
    let unsubscribe = () => {};
    let fallbackTimer = null;

    (async () => {
      if (await hasFired(userId, 'demo')) {
        if (!cancelled) setStatus('done');
        return;
      }
      if (cancelled) return;
      // Block interaction from the first frame so there is no window of
      // free play before the tour takes over.
      setDemoActive(true);
      setStatus('blocking');
      statusRef.current = 'blocking';

      const start = (objective, city) => {
        if (cancelled || statusRef.current === 'running' || statusRef.current === 'done') return;
        stepsRef.current = buildSteps(objective, city);
        setStatus('running');
        statusRef.current = 'running';
        runStep(0);
      };

      unsubscribe = onDemoEvent((name, payload) => {
        if (name === 'map.objectiveResolved') {
          start(payload?.objective ?? null, payload?.city ?? null);
        }
      });
      // The map may have resolved the objective before this subscription
      // existed (both mount in the same commit; this effect awaits storage).
      const replay = getLastDemoEvent('map.objectiveResolved');
      if (replay !== undefined) {
        start(replay?.objective ?? null, replay?.city ?? null);
        return;
      }
      // Objective fetch failed or is slow — tour the screens without the
      // claim beats rather than holding the player hostage.
      fallbackTimer = setTimeout(() => start(null, null), 8000);
    })();

    return () => {
      cancelled = true;
      unsubscribe();
      if (fallbackTimer) clearTimeout(fallbackTimer);
    };
  }, [buildSteps, runStep, userId]);

  // Directed tab steps advance when the demanded tab actually gains focus.
  useEffect(() => {
    if (status !== 'running') return;
    const step = stepsRef.current[stepIndexRef.current];
    if (step?.kind === 'target-tab' && focusedTab === step.tab) {
      advance();
    }
  }, [advance, focusedTab, status]);

  // The territory step advances when the objective sheet actually opens.
  useEffect(() => {
    if (status !== 'running') return undefined;
    return onDemoEvent((name) => {
      if (name !== 'map.objectiveSheetOpened') return;
      const step = stepsRef.current[stepIndexRef.current];
      if (step?.kind === 'target-territory') advance();
    });
  }, [advance, status]);

  if (status === 'idle' || status === 'done') return null;

  const step = status === 'running' ? stepsRef.current[stepIndex] : null;
  const box = layout;
  const interactiveHole = step && (step.kind === 'target-territory' || step.kind === 'target-tab');

  // Card placement: near the action, never over it.
  let cardPos = { bottom: tabBarHeight + 16, left: 16, right: 16 };
  if (step && box && holeRect) {
    if (step.kind === 'target-tab') {
      cardPos = { bottom: box.height - holeRect.y + 12, left: 16, right: 16 };
    } else if (step.kind === 'sheet') {
      cardPos = { top: (StatusBar.currentHeight ?? 0) + 56, left: 16, right: 16 };
    } else {
      const centerY = holeRect.y + holeRect.height / 2;
      cardPos =
        centerY < box.height * 0.45
          ? { top: Math.min(holeRect.y + holeRect.height + 14, box.height - 200), left: 16, right: 16 }
          : { bottom: Math.max(box.height - holeRect.y + 14, tabBarHeight + 16), left: 16, right: 16 };
    }
  }

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="box-none"
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        layoutRef.current = { width, height };
        setLayout({ width, height });
      }}
    >
      {holeRect && box ? (
        <>
          <View style={[styles.scrim, { left: 0, right: 0, top: 0, height: Math.max(holeRect.y, 0) }]} />
          <View style={[styles.scrim, { left: 0, right: 0, top: holeRect.y + holeRect.height, bottom: 0 }]} />
          <View style={[styles.scrim, { left: 0, width: Math.max(holeRect.x, 0), top: holeRect.y, height: holeRect.height }]} />
          <View style={[styles.scrim, { left: holeRect.x + holeRect.width, right: 0, top: holeRect.y, height: holeRect.height }]} />
        </>
      ) : (
        <View style={[styles.scrim, StyleSheet.absoluteFill]} />
      )}

      {step && !interactiveHole && step.kind !== 'sheet' ? (
        // Read steps: the hole is visual only — a tap anywhere advances.
        <Pressable style={StyleSheet.absoluteFill} onPress={advance} accessibilityRole="button" />
      ) : null}
      {step && step.kind === 'sheet' ? (
        // Sheet beat: everything blocked (including the real Claim button —
        // no accidental claim intents); GOT IT is the only way forward.
        <View style={StyleSheet.absoluteFill} pointerEvents="auto" />
      ) : null}

      {cardVisible && step ? (
        <Animated.View style={[styles.card, cardPos, { opacity: cardOpacity }]} pointerEvents="box-none">
          {step.kicker ? <Text style={styles.kicker}>{step.kicker}</Text> : null}
          <Text style={styles.body} accessibilityLiveRegion="polite">
            {step.text}
          </Text>
          {step.cta ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                runDemoAction('map.closeObjectiveSheet');
                advance();
              }}
              style={styles.cta}
            >
              <Text style={styles.ctaText}>{step.cta}</Text>
            </Pressable>
          ) : null}
        </Animated.View>
      ) : null}

      <Pressable
        accessibilityRole="button"
        onPress={() => finish(false)}
        hitSlop={12}
        style={[styles.skip, { top: (StatusBar.currentHeight ?? 0) + 12 }]}
      >
        <Text style={styles.skipText}>{t('demo.skip')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: {
    position: 'absolute',
    backgroundColor: SCRIM,
  },
  card: {
    position: 'absolute',
    backgroundColor: colors.ink2,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  kicker: {
    fontFamily: fonts.monoMedium,
    fontSize: 10,
    color: colors.claim,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  body: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 19,
    color: colors.bone,
  },
  cta: {
    marginTop: 12,
    alignSelf: 'flex-start',
    backgroundColor: colors.claim,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  ctaText: {
    fontFamily: fonts.monoMedium,
    fontSize: 11,
    color: colors.bone,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  skip: {
    position: 'absolute',
    right: 16,
  },
  skipText: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.slate2,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
});
