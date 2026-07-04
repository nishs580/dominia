import Toast from 'react-native-toast-message';
import i18n from '../i18n';
import { hasFired, markFired } from './walkthroughFlags';

/**
 * Just-in-time resource education (spec: explain each resource exactly once,
 * at the moment it is first earned — never in a screen walkthrough too).
 *
 * Call with whatever was just earned, e.g. { xp: 40, ...calcResourceEarn(key) }.
 * Shows at most ONE toast per call — the first not-yet-explained resource in
 * priority order — so a challenge that pays four resources doesn't stack four
 * lessons; the rest fire on later earns. Fires-once flags are shared with the
 * walkthrough store, per player.
 */

const EXPLAIN_ORDER = ['stone', 'iron', 'gold', 'morale', 'xp', 'influence'];

export async function maybeExplainResources(userId, earned) {
  if (!userId || !earned) return;
  for (const key of EXPLAIN_ORDER) {
    const amount = Number(earned[key]) || 0;
    if (amount <= 0) continue;
    if (await hasFired(userId, `resource:${key}`)) continue;
    markFired(userId, `resource:${key}`);
    Toast.show({
      type: 'info',
      text1: i18n.t(`resourceIntro.${key}`),
      position: 'top',
      visibilityTime: 5000,
    });
    return;
  }
}
