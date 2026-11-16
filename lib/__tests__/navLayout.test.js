const fs = require('fs');
const path = require('path');
const flags = require('../flags');
const navLayout = require('../navLayout');

const ROOT = path.join(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

function setFlags(map) {
  process.env.EXPO_PUBLIC_FLAG_OVERRIDES = JSON.stringify(map);
}

beforeEach(() => {
  delete process.env.EXPO_PUBLIC_FLAG_OVERRIDES;
  flags._resetForTests();
});

afterAll(() => {
  delete process.env.EXPO_PUBLIC_FLAG_OVERRIDES;
  flags._resetForTests();
});

// lib/navigation.js is an ES module and jest here has no ESM transform, so the
// source is evaluated with its imports replaced: a recording navigationRef in
// place of @react-navigation/native, and the real flags / navLayout modules.
function loadNavigation() {
  const calls = [];
  const ref = {
    ready: true,
    isReady() { return this.ready; },
    navigate: (...args) => calls.push(args),
    getRootState: () => ({ index: 0, routes: [{ name: 'MainTabs' }] }),
    addListener() {},
    removeListener() {},
    reset: (...args) => calls.push(['reset', ...args]),
  };
  const src = read('lib/navigation.js')
    .replace(/^import .*$/gm, '')
    .replace(/^export\s+/gm, '');
  const ctx = {};
  new Function(
    'ctx', 'createNavigationContainerRef', 'getFlag', 'resolveNavTarget',
    `${src}\nctx.navigateTo = navigateTo; ctx.onNavigationReady = onNavigationReady; ctx.navigateToAfterAuthGate = navigateToAfterAuthGate;`,
  )(ctx, () => ref, flags.getFlag, navLayout.resolveNavTarget);
  return { ...ctx, ref, calls };
}

describe('navigateTo', () => {
  test('legacy_tabs off: Profile targets the root stack route', () => {
    setFlags({ legacy_tabs: false });
    const nav = loadNavigation();
    nav.navigateTo('Profile', { medalKey: 'm-1' });
    expect(nav.calls).toEqual([['Profile', { medalKey: 'm-1' }]]);
  });

  test('legacy_tabs off: Activity targets the Missions tab', () => {
    setFlags({ legacy_tabs: false });
    const nav = loadNavigation();
    nav.navigateTo('Activity', { needResource: 'gold' });
    expect(nav.calls).toEqual([
      ['MainTabs', { screen: 'Missions', params: { needResource: 'gold' } }],
    ]);
  });

  test('legacy_tabs on: Profile and Activity resolve to today\'s tabs', () => {
    setFlags({ legacy_tabs: true });
    const nav = loadNavigation();
    nav.navigateTo('Profile');
    nav.navigateTo('Activity');
    expect(nav.calls).toEqual([
      ['MainTabs', { screen: 'Profile', params: {} }],
      ['MainTabs', { screen: 'Activity', params: {} }],
    ]);
  });

  test('defaults (legacy_tabs on) keep today\'s navigation', () => {
    const nav = loadNavigation();
    nav.navigateTo('Profile');
    expect(nav.calls).toEqual([['MainTabs', { screen: 'Profile', params: {} }]]);
  });

  test('Map, Alliance and stack routes are unchanged in both modes', () => {
    for (const legacy of [true, false]) {
      setFlags({ legacy_tabs: legacy });
      const nav = loadNavigation();
      nav.navigateTo('Map', { x: 1 });
      nav.navigateTo('Alliance');
      nav.navigateTo('ActivityLog');
      expect(nav.calls).toEqual([
        ['MainTabs', { screen: 'Map', params: { x: 1 } }],
        ['MainTabs', { screen: 'Alliance', params: {} }],
        ['ActivityLog', {}],
      ]);
    }
  });

  test('legacy_tabs is read at call time, not at import', () => {
    setFlags({ legacy_tabs: true });
    const nav = loadNavigation();
    nav.navigateTo('Activity');
    setFlags({ legacy_tabs: false });
    nav.navigateTo('Activity');
    nav.navigateTo('Profile');
    expect(nav.calls).toEqual([
      ['MainTabs', { screen: 'Activity', params: {} }],
      ['MainTabs', { screen: 'Missions', params: {} }],
      ['Profile', {}],
    ]);
  });

  test('a navigation deferred before ready resolves against the mode at dispatch', () => {
    setFlags({ legacy_tabs: true });
    const nav = loadNavigation();
    nav.ref.ready = false;
    nav.navigateToAfterAuthGate('Profile');
    setFlags({ legacy_tabs: false });
    nav.ref.ready = true;
    nav.onNavigationReady();
    expect(nav.calls).toEqual([['Profile', {}]]);
  });

  test('a Figma-only name still lands with legacy_tabs on', () => {
    setFlags({ legacy_tabs: true });
    const nav = loadNavigation();
    nav.navigateTo('Missions');
    expect(nav.calls).toEqual([['MainTabs', { screen: 'Activity', params: {} }]]);
  });
});

describe('resolveNavTarget', () => {
  test('every resolved name is mounted in its mode', () => {
    for (const legacy of [true, false]) {
      const mounted = new Set([...navLayout.tabsFor(legacy), ...navLayout.rootRoutesFor(legacy)]);
      for (const target of [...navLayout.LEGACY_TABS, ...navLayout.FIGMA_TABS]) {
        const { name, inTabs } = navLayout.resolveNavTarget(target, legacy);
        expect(mounted.has(name)).toBe(true);
        expect(inTabs).toBe(navLayout.tabsFor(legacy).includes(name));
      }
    }
  });

  test('layouts match the plan', () => {
    expect(navLayout.tabsFor(true)).toEqual(['Map', 'Activity', 'Alliance', 'Profile']);
    expect(navLayout.tabsFor(false)).toEqual(['Map', 'Missions', 'Alliance', 'Events']);
    expect(navLayout.rootRoutesFor(true)).toEqual([]);
    expect(navLayout.rootRoutesFor(false)).toEqual(['Profile']);
  });
});

// Which screen file each tab mounts, read from App.js's TAB_SCREENS map and
// its imports.
function tabScreenFiles() {
  const app = read('App.js');
  const imports = {};
  for (const m of app.matchAll(/^import (\w+) from '\.\/(screens\/\w+)';$/gm)) imports[m[1]] = `${m[2]}.js`;
  const block = app.match(/const TAB_SCREENS = \{([\s\S]*?)\n\};/)[1];
  const files = {};
  for (const m of block.matchAll(/^\s{2}(\w+): \{ component: (\w+)/gm)) files[m[1]] = imports[m[2]];
  return files;
}

// A screen shows the avatar if it renders ProfileAvatarButton, directly or
// through TabScreenHeader or MapTopBar (which always render it).
function rendersAvatar(src) {
  return /<ProfileAvatarButton\b/.test(src) || /<TabScreenHeader\b/.test(src) || /<MapTopBar\b/.test(src);
}

describe('header avatar (legacy_tabs off)', () => {
  test('each of the four tabs renders the avatar', () => {
    const files = tabScreenFiles();
    expect(navLayout.avatarTabsFor(false)).toEqual(navLayout.tabsFor(false));
    for (const tab of navLayout.avatarTabsFor(false)) {
      expect(files[tab]).toBeDefined();
      if (!rendersAvatar(read(files[tab]))) throw new Error(`${tab} (${files[tab]}) has no header avatar`);
    }
    expect(read('components/TabScreenHeader.js')).toMatch(/<ProfileAvatarButton\b/);
    expect(read('components/MapTopBar.js')).toMatch(/<ProfileAvatarButton\b/);
  });

  test('the avatar opens Profile, which resolves to a mounted root route', () => {
    const button = read('components/ProfileAvatarButton.js');
    expect(button).toMatch(/onPress=\{\(\) => navigateTo\('Profile'\)\}/);
    const { name, inTabs } = navLayout.resolveNavTarget('Profile', false);
    expect(inTabs).toBe(false);
    expect(navLayout.rootRoutesFor(false)).toContain(name);
  });

  test('no avatar with legacy_tabs on, where Profile is a tab', () => {
    expect(navLayout.avatarTabsFor(true)).toEqual([]);
    expect(read('components/ProfileAvatarButton.js')).toMatch(/if \(legacyTabs\) return null;/);
  });
});

describe('callers', () => {
  // Bare navigation.navigate('Activity' | 'Profile') skips the legacy_tabs
  // resolution and breaks in the Figma layout. ActiveClaimScreen is owned by
  // another workstream and navigates only to MainTabs/Map.
  test('no screen or component navigates to Activity or Profile directly', () => {
    const dirs = ['screens', 'components'];
    const offenders = [];
    for (const dir of dirs) {
      for (const file of fs.readdirSync(path.join(ROOT, dir))) {
        if (!file.endsWith('.js')) continue;
        const src = read(`${dir}/${file}`);
        if (/navigation\.navigate\(\s*'(Activity|Profile)'/.test(src)
          || /screen:\s*'(Activity|Profile)'/.test(src)) offenders.push(`${dir}/${file}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  test('ProfileScreen reaches the tabs through navigateTo (it is a root screen with legacy_tabs off)', () => {
    const src = read('screens/ProfileScreen.js');
    expect(src).not.toMatch(/navigation\.navigate\(\s*'(Map|Activity|Alliance)'/);
  });
});
