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
 * hole (a territory, a tab button) — framed in Claim red so the eye lands on
 * it — and advance only when the player performs that exact tap for real.
 * No system-driven motion beyond a 280ms card fade, per brand motion rules.
 *
 * The tour starts immediately (no waiting on the network). The first-claim
 * beats resolve lazily when the tour reaches them: the objective fetch gets
 * the whole duration of the first two read beats to survive a backend cold
 * start. Territory holders (held_count > 0) never get the claim beats.
 *
 * SKIP TOUR is always available and ends the tour without marking the
 * per-element tips, so the reactive tips backfill anything a skipper never
 * read. Completing marks them — nothing is explained twice.
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
  const objectiveRef = useRef(null);
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
    (city) => [
      {
        key: 'intro',
        kind: 'read',
        tipFlag: 'tip:map:intro',
        text: city
          ? t('walkthrough.map.intro', { city })
          : t('walkthrough.map.introNoCity'),
      },
      {
        key: 'colours',
        kind: 'read',
        tipFlag: 'tip:map:colours',
        // Colour words typeset in their own territory colour (map screen —
        // the max-two-territory-colours rule does not apply here).
        segments: [
          { text: t('walkthrough.map.coloursParts.pre') },
          { text: t('walkthrough.map.coloursParts.red'), color: colors.claim },
          { text: t('walkthrough.map.coloursParts.redRest') },
          { text: t('walkthrough.map.coloursParts.green'), color: colors.alliance },
          { text: t('walkthrough.map.coloursParts.greenRest') },
          { text: t('walkthrough.map.coloursParts.blue'), color: colors.enemy },
          { text: t('walkthrough.map.coloursParts.blueRest') },
        ],
        text: t('walkthrough.map.colours'),
      },
      {
        key: 'tapTerritory',
        kind: 'target-territory',
        tipFlag: 'tip:map:card',
        kicker: t('firstClaim.kicker'),
        dynamic: true,
      },
      {
        key: 'sheet',
        kind: 'sheet',
        kicker: t('firstClaim.kicker'),
        cta: t('walkthrough.gotIt'),
        dynamic: true,
      },
      { key: 'tapActivity', kind: 'target-tab', tab: 'Activity', text: t('demo.tapActivity') },
      { key: 'streak', kind: 'read', rectKey: 'activity.streak', tipFlag: 'tip:activity:streak', text: t('walkthrough.activity.streak') },
      { key: 'challenges', kind: 'read', rectKey: 'activity.challenges', tipFlag: 'tip:activity:challenges', text: t('walkthrough.activity.challenges') },
      { key: 'tapAlliance', kind: 'target-tab', tab: 'Alliance', text: t('demo.tapAlliance') },
      { key: 'solo', kind: 'read', rectKey: 'alliance.solo', tipFlag: 'tip:alliance:solo', skipIfNoRect: true, text: t('walkthrough.alliance.solo') },
      { key: 'tapProfile', kind: 'target-tab', tab: 'Profile', text: t('demo.tapProfile') },
      { key: 'power', kind: 'read', rectKey: 'profile.power', tipFlag: 'tip:profile:power', text: t('walkthrough.profile.power') },
      { key: 'resources', kind: 'read', rectKey: 'profile.resources', tipFlag: 'tip:profile:resources', text: t('walkthrough.profile.resources') },
      { key: 'tapMap', kind: 'target-tab', tab: 'Map', text: t('demo.tapMap') },
    ],
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

  // Latest first-claim state from MapScreen; undefined = not yet resolved.
  const waitForObjectiveResolution = useCallback(async (timeoutMs) => {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const payload = getLastDemoEvent('map.objectiveResolved');
      if (payload !== undefined) return payload ?? null;
      if (Date.now() >= deadline) return null;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }, []);

  const finish = useCallback(
    (completed) => {
      if (statusRef.current === 'done') return;
      markFired(userId, 'demo');
      if (completed) {
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
        // Lazy first-claim resolution: the backend had the two read beats to
        // wake up. Holders (held_count > 0) resolve to a null objective and
        // skip both claim beats by design.
        const payload = await waitForObjectiveResolution(12000);
        const objective = payload?.objective ?? null;
        objectiveRef.current = objective;
        if (!objective) {
          console.log(
            '[demo] claim beats skipped:',
            payload == null
              ? 'objective unresolved (timeout or fetch failed)'
              : 'no claimable target (player already holds territory, or none exists)',
          );
          runStep(index + 2);
          return;
        }
        step.text = t('demo.tapTerritory', { name: objective.name });
        rect = await resolveDemoRect('map.objectiveRect', { tries: 3, delayMs: 300 });
        if (!rect) {
          console.log('[demo] claim beats skipped: objective rect unmeasurable');
          runStep(index + 2);
          return;
        }
      } else if (step.kind === 'sheet') {
        const objective = objectiveRef.current;
        if (!objective) {
          runStep(index + 1);
          return;
        }
        step.text = `${t('firstClaim.instruction', {
          distance: formatWalkDistance(objective.distance_m),
          name: objective.name,
        })} ${t('demo.fromAnywhere')}`;
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
    [cardOpacity, finish, t, tabRect, waitForObjectiveResolution],
  );

  const advance = useCallback(() => {
    runStep(stepIndexRef.current + 1);
  }, [runStep]);

  // Boot: block interaction from the first frame, give the player fetch a
  // moment to supply the city name, then run — the tour never waits on the
  // first-claim endpoint here.
  useEffect(() => {
    if (!userId || statusRef.current !== 'idle') return undefined;
    let cancelled = false;

    (async () => {
      if (await hasFired(userId, 'demo')) {
        if (!cancelled) setStatus('done');
        return;
      }
      if (cancelled) return;
      setDemoActive(true);
      setStatus('blocking');
      statusRef.current = 'blocking';

      const deadline = Date.now() + 1200;
      let city = null;
      while (Date.now() < deadline && !cancelled) {
        const payload = getLastDemoEvent('map.objectiveResolved');
        if (payload !== undefined) {
          city = payload?.city ?? null;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 150));
      }
      if (cancelled || statusRef.current !== 'blocking') return;

      stepsRef.current = buildSteps(city);
      setStatus('running');
      statusRef.current = 'running';
      runStep(0);
    })();

    return () => {
      cancelled = true;
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

      {interactiveHole && holeRect ? (
        // The tap target must catch the eye: Claim frame around the hole
        // (Claim = the single urgent action, and these steps are that action).
        <View
          pointerEvents="none"
          style={[
            styles.holeFrame,
            {
              left: holeRect.x,
              top: holeRect.y,
              width: holeRect.width,
              height: holeRect.height,
            },
          ]}
        />
      ) : null}

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
          {step.segments ? (
            <Text style={styles.body} accessibilityLiveRegion="polite">
              {step.segments.map((seg, i) => (
                <Text
                  key={`${step.key}-${i}`}
                  style={seg.color ? { color: seg.color, fontFamily: fonts.bodyMedium } : null}
                >
                  {seg.text}
                </Text>
              ))}
            </Text>
          ) : (
            <Text style={styles.body} accessibilityLiveRegion="polite">
              {step.text}
            </Text>
          )}
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
  holeFrame: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: colors.claim,
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
