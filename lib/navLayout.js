/**
 * lib/navLayout.js
 *
 * The tab layout for each `legacy_tabs` mode, and how a navigation target
 * name resolves in that mode. Pure and React-free so App.js, lib/navigation,
 * the push route table and tests all read one definition.
 *
 *   legacy_tabs on  (today):  tabs Map · Activity · Alliance · Profile
 *   legacy_tabs off (Figma):  tabs Map · Missions · Alliance · Events,
 *                             Profile is a root stack screen opened from the
 *                             header avatar (components/ProfileAvatarButton).
 *
 * Callers keep using today's names ('Activity', 'Profile'); resolveNavTarget
 * maps them to whatever the current mode registers. Callers pass the flag
 * value in, read at call time, so a Remote Config change applies to the next
 * navigation.
 */

'use strict';

const LEGACY_TABS = Object.freeze(['Map', 'Activity', 'Alliance', 'Profile']);
const FIGMA_TABS = Object.freeze(['Map', 'Missions', 'Alliance', 'Events']);

// Root stack screens that exist only in one mode.
const FIGMA_ROOT_ROUTES = Object.freeze(['Profile']);

// Names that don't exist in a mode, mapped to their counterpart there.
const LEGACY_ALIASES = Object.freeze({ Missions: 'Activity', Events: 'Map' });
const FIGMA_ALIASES = Object.freeze({ Activity: 'Missions' });

// Figma tabs whose header shows ProfileAvatarButton. With legacy_tabs on,
// Profile is its own tab and no header shows the avatar.
const AVATAR_TABS = FIGMA_TABS;

function tabsFor(legacyTabs) {
  return legacyTabs ? LEGACY_TABS : FIGMA_TABS;
}

function rootRoutesFor(legacyTabs) {
  return legacyTabs ? [] : FIGMA_ROOT_ROUTES;
}

function avatarTabsFor(legacyTabs) {
  return legacyTabs ? [] : AVATAR_TABS;
}

// Returns { name, inTabs }: the route name registered in this mode, and
// whether it lives under MainTabs (navigate('MainTabs', { screen: name }))
// or in the root stack (navigate(name)).
function resolveNavTarget(target, legacyTabs) {
  const aliases = legacyTabs ? LEGACY_ALIASES : FIGMA_ALIASES;
  const name = Object.prototype.hasOwnProperty.call(aliases, target) ? aliases[target] : target;
  return { name, inTabs: tabsFor(legacyTabs).includes(name) };
}

module.exports = {
  LEGACY_TABS,
  FIGMA_TABS,
  FIGMA_ROOT_ROUTES,
  AVATAR_TABS,
  tabsFor,
  rootRoutesFor,
  avatarTabsFor,
  resolveNavTarget,
};
