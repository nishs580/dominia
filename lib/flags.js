/**
 * lib/flags.js
 *
 * Feature flags and the economy table, served by Firebase Remote Config.
 *
 * USAGE
 *   import { getFlag, useFlag, getEconomy } from '../lib/flags';
 *   if (getFlag('war_room')) { ... }          // synchronous, outside React
 *   const warRoom = useFlag('war_room');      // re-renders on activation
 *   const { attack_gold_cost } = getEconomy();
 *
 * RESOLUTION (highest wins)
 *   1. EXPO_PUBLIC_FLAG_OVERRIDES — JSON object baked into demo builds,
 *      e.g. {"war_room":false,"economy_config":{"daily_reward_gold":100}}.
 *      Flag values must be JSON booleans; anything else is ignored.
 *   2. The last activated Remote Config value. Only boolean true or the
 *      string "true" is on; anything else ("yes", "1", "") is false.
 *   3. FLAG_DEFAULTS below.
 *   Names outside the registry are always false.
 *
 * GUARDS
 *   - holdFlagChanges() while a challenge is on screen: activations are
 *     queued and applied when the last hold is released.
 *   - onLegacyTabsChange(cb): fires when the applied `legacy_tabs` value
 *     changes, so the navigator can reset to Map instead of leaving the
 *     player on a tab that no longer exists.
 *
 * Feature code reads flags only through this module and never touches
 * Firebase. The native module is required lazily so the file loads under
 * jest's node environment; tests inject a fake with _setRemoteConfigForTests.
 */

'use strict';

const { useSyncExternalStore } = require('react');

// =============================================================================
// REGISTRY — every app-only feature, keyed exactly as in Remote Config.
// Defaults are true (today's app) during the Figma build-out; the release that
// completes Phase 3 flips each to false.
// =============================================================================

const FLAG_DEFAULTS = Object.freeze({
  multi_resource_economy: true,
  attack_day: true,
  full_territory_sheet: true,
  territory_development: true,
  territory_legacy: true,
  sitrep_card: true,
  first_claim_objective: true,
  battle_chips: true,
  home_bases: true,
  streaks: true,
  war_room: true,
  command_post: true,
  alliance_roster_tools: true,
  alliance_hq_create: true,
  power_rank: true,
  honour_medals: true,
  claim_celebration: true,
  contest_result_screen: true,
  legacy_tabs: true,
});

// One JSON parameter shared with the backend (backend:src/shared/flags.ts
// reads the same key and fields). claim_gold_cost, contest_iron_cost and
// stone_defence_cost mirror today's constants in lib/formulas.js; the rest are
// the Gold-only prices (attack by tier, mandatory defence fee, mission rewards
// by challenge tier, flat daily login reward).
const ECONOMY_PARAM = 'economy_config';

const ECONOMY_DEFAULTS = Object.freeze({
  claim_gold_cost: Object.freeze({ small: 10, medium: 25, large: 60, epic: 120 }),
  contest_iron_cost: Object.freeze({ small: 8, medium: 20, large: 45, epic: 80 }),
  stone_defence_cost: 10,
  attack_gold_cost: Object.freeze({ small: 8, medium: 20, large: 45, epic: 80 }),
  defence_gold_cost: 10,
  mission_gold_reward: Object.freeze({ easy: 10, medium: 20, hard: 40 }),
  daily_reward_gold: 60,
  // Gold for streak days 1–7 (Updated UX A6). The server picks the amount by
  // daily_reward_day; the app draws the strip from the same ladder.
  daily_reward_ladder: Object.freeze([60, 70, 80, 90, 100, 120, 200]),
});

const INIT_TIMEOUT_MS = 300;
const FETCH_INTERVAL_PROD_MS = 60 * 60 * 1000;

// =============================================================================
// STATE
// =============================================================================

// Last activated remote values that have been applied: { flags, economy }.
// `flags` holds only keys the template actually sets.
let applied = { flags: {}, economy: null };
// Activated while held; applied on the last release.
let pending = null;
let holdCount = 0;

// Resolved snapshot { flags, economy }, rebuilt on apply or override change.
let resolved = null;
const listeners = new Set();
const legacyTabsListeners = new Set();

let remoteConfigOverride = null;

// =============================================================================
// FIREBASE ACCESS
// =============================================================================

function isDev() {
  return typeof __DEV__ !== 'undefined' && __DEV__;
}

// Returns { ensureInitialized, fetchAndActivate, getAll } or null when the
// native module is unavailable (jest, web, a build without the pod).
function remoteConfig() {
  if (remoteConfigOverride) return remoteConfigOverride;
  try {
    // eslint-disable-next-line global-require
    const RC = require('@react-native-firebase/remote-config');
    const rc = RC.getRemoteConfig();
    return {
      ensureInitialized: () => RC.ensureInitialized(rc),
      fetchAndActivate: async () => {
        await RC.setConfigSettings(rc, {
          minimumFetchIntervalMillis: isDev() ? 0 : FETCH_INTERVAL_PROD_MS,
        });
        return RC.fetchAndActivate(rc);
      },
      getAll: () => RC.getAll(rc),
    };
  } catch (err) {
    console.warn('[flags] remote config unavailable:', err?.message);
    return null;
  }
}

function _setRemoteConfigForTests(fake) {
  remoteConfigOverride = fake;
}

// Reads the activated template into { flags, economy }. Values that came from
// in-app defaults ('default'/'static') are skipped so code defaults apply.
function readActivated(rc) {
  const all = rc.getAll() || {};
  const flags = {};
  let economy = null;
  for (const key of Object.keys(all)) {
    const value = all[key];
    if (!value || value.getSource?.() !== 'remote') continue;
    const raw = value.asString();
    if (key === ECONOMY_PARAM) {
      economy = parseEconomy(raw);
    } else if (Object.prototype.hasOwnProperty.call(FLAG_DEFAULTS, key)) {
      flags[key] = raw === true || raw === 'true';
    }
  }
  return { flags, economy };
}

// =============================================================================
// RESOLUTION
// =============================================================================

function parseEconomy(raw) {
  if (raw && typeof raw === 'object') return raw;
  if (typeof raw !== 'string' || raw === '') return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    console.warn('[flags] malformed economy parameter, using defaults');
    return null;
  }
}

function isPrice(v) {
  return Number.isInteger(v) && v >= 0;
}

// Same rules as the backend: a missing key takes its default, but any present
// key with a bad value (non-integer, negative, or a tier table missing a tier)
// rejects the whole parameter so app and backend never price from a half-read
// table. Unknown keys are ignored.
function mergeEconomy(defaults, candidate) {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return defaults;
  const out = {};
  for (const key of Object.keys(defaults)) {
    const def = defaults[key];
    if (!Object.prototype.hasOwnProperty.call(candidate, key)) {
      out[key] = def;
      continue;
    }
    const next = candidate[key];
    if (Array.isArray(def)) {
      // A ladder: same length as the default, every rung a price.
      if (!Array.isArray(next) || next.length !== def.length || !next.every(isPrice)) return invalidEconomy(key);
      out[key] = Object.freeze(next.slice());
    } else if (def && typeof def === 'object') {
      if (!next || typeof next !== 'object' || Array.isArray(next)) return invalidEconomy(key);
      const table = {};
      for (const tier of Object.keys(def)) {
        if (!isPrice(next[tier])) return invalidEconomy(key);
        table[tier] = next[tier];
      }
      out[key] = Object.freeze(table);
    } else {
      if (!isPrice(next)) return invalidEconomy(key);
      out[key] = next;
    }
  }
  return out;
}

function invalidEconomy(key) {
  console.warn(`[flags] invalid ${ECONOMY_PARAM}.${key}, using default prices`);
  return ECONOMY_DEFAULTS;
}

let overridesRaw;
let overridesParsed = {};

// Metro inlines EXPO_PUBLIC_* only on direct member access, so the name is
// spelled out. Re-parsed only when the string changes (tests set it).
function overrides() {
  const raw = process.env.EXPO_PUBLIC_FLAG_OVERRIDES;
  if (raw === overridesRaw) return overridesParsed;
  overridesRaw = raw;
  overridesParsed = {};
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) overridesParsed = parsed;
    } catch {
      console.warn('[flags] EXPO_PUBLIC_FLAG_OVERRIDES is not valid JSON, ignored');
    }
  }
  return overridesParsed;
}

function resolve() {
  const over = overrides();
  const flags = {};
  for (const name of Object.keys(FLAG_DEFAULTS)) {
    if (typeof over[name] === 'boolean') flags[name] = over[name];
    else if (typeof applied.flags[name] === 'boolean') flags[name] = applied.flags[name];
    else flags[name] = FLAG_DEFAULTS[name];
  }
  // An override economy is layered over the fetched one with the same rules.
  let economy = mergeEconomy(ECONOMY_DEFAULTS, applied.economy);
  if (over[ECONOMY_PARAM]) economy = mergeEconomy(economy, over[ECONOMY_PARAM]);
  return { flags: Object.freeze(flags), economy: Object.freeze(economy), overridesRaw };
}

// Recomputes the snapshot if the override env changed since the last read.
function current() {
  if (!resolved || process.env.EXPO_PUBLIC_FLAG_OVERRIDES !== resolved.overridesRaw) {
    resolved = resolve();
  }
  return resolved;
}

function apply(next) {
  const prevLegacyTabs = current().flags.legacy_tabs;
  applied = next;
  resolved = resolve();
  listeners.forEach((l) => l());
  if (resolved.flags.legacy_tabs !== prevLegacyTabs) {
    legacyTabsListeners.forEach((l) => {
      try {
        l(resolved.flags.legacy_tabs);
      } catch (err) {
        console.warn('[flags] legacy_tabs listener failed:', err?.message);
      }
    });
  }
}

// Applies now, or queues until the last hold is released.
function offer(next) {
  if (holdCount > 0) pending = next;
  else apply(next);
}

// =============================================================================
// PUBLIC API
// =============================================================================

function getFlag(name) {
  const flags = current().flags;
  return Object.prototype.hasOwnProperty.call(flags, name) ? flags[name] : false;
}

function getEconomy() {
  return current().economy;
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function useFlag(name) {
  return useSyncExternalStore(subscribe, () => getFlag(name));
}

function useEconomy() {
  return useSyncExternalStore(subscribe, getEconomy);
}

// Called once before the first render: makes the last activated values
// available without waiting on the network. Never throws; on timeout or
// failure the app starts on code defaults.
async function ensureFlagsInitialized({ timeoutMs = INIT_TIMEOUT_MS } = {}) {
  const rc = remoteConfig();
  if (!rc) return;
  let timer;
  try {
    const timedOut = await Promise.race([
      Promise.resolve(rc.ensureInitialized()).then(() => false),
      new Promise((r) => { timer = setTimeout(() => r(true), timeoutMs); }),
    ]);
    if (timedOut) {
      console.warn('[flags] ensureInitialized timed out, starting on defaults');
      return;
    }
    // Before the first render nothing is mounted to guard, so apply directly.
    apply(readActivated(rc));
  } catch (err) {
    console.warn('[flags] init failed:', err?.message);
  } finally {
    clearTimeout(timer);
  }
}

// Background fetch + activate. Never throws; a failure keeps current values.
async function refreshFlags() {
  const rc = remoteConfig();
  if (!rc) return;
  try {
    await rc.fetchAndActivate();
    offer(readActivated(rc));
  } catch (err) {
    console.warn('[flags] fetch failed:', err?.message);
  }
}

// Queues flag changes until the returned release function is called. Holds
// nest; changes apply when the last one is released. Release is idempotent.
function holdFlagChanges() {
  holdCount += 1;
  let released = false;
  return function releaseFlagChanges() {
    if (released) return;
    released = true;
    holdCount -= 1;
    if (holdCount === 0 && pending) {
      const next = pending;
      pending = null;
      apply(next);
    }
  };
}

function onLegacyTabsChange(listener) {
  legacyTabsListeners.add(listener);
  return () => legacyTabsListeners.delete(listener);
}

function _resetForTests() {
  applied = { flags: {}, economy: null };
  pending = null;
  holdCount = 0;
  remoteConfigOverride = null;
  listeners.clear();
  legacyTabsListeners.clear();
  overridesRaw = undefined;
  overridesParsed = {};
  resolved = null;
}

module.exports = {
  FLAG_DEFAULTS, ECONOMY_PARAM, ECONOMY_DEFAULTS, INIT_TIMEOUT_MS,
  getFlag, useFlag, getEconomy, useEconomy, subscribe,
  ensureFlagsInitialized, refreshFlags,
  holdFlagChanges, onLegacyTabsChange,
  _setRemoteConfigForTests, _resetForTests,
};
