# iOS_Plan.md — Making Dominia iOS-Compatible and Shipping on the App Store

**Written:** 2026-07-07 · **Audience:** an engineer or AI agent who has never seen this project.
This document is both a knowledge transfer (Part 1) and the execution plan (Part 2). Read Part 1 before touching anything — the iOS work touches every platform-coupled subsystem, and most of the risk lives in details that are easy to miss.

---

# PART 1 — HOW THE SYSTEM WORKS TODAY

## 1.1 What Dominia is

A real-world, GPS-driven mobile game. Players walk/run/cycle to claim and defend real, named OpenStreetMap territories on a city map. Physical activity (steps, distance, active calories) is the only resource. Levels 1–3 are solo; Level 3+ unlocks alliances (≤20 members). Tagline: *Walk. Claim. Conquer. Defend.* Pre-launch, building toward beta. Small team (one developer, Windows machine). Currently **Android-only** in practice — the codebase is React Native + Expo, so iOS was always the intent, but three subsystems are hard-wired to Android APIs.

## 1.2 The two repos

| | Mobile | Backend |
|---|---|---|
| Path | `C:\Users\nisha\dominia` | `C:\Users\nisha\dominia-backend` |
| GitHub | github.com/nishs580/dominia | github.com/nishs580/dominia-backend (private) |
| Stack | React Native 0.81.5 + Expo SDK 54, JS (not TS), New Architecture ON | Node 22 + TypeScript + Fastify 5 + Prisma 7 + PostGIS (Supabase) + Redis/BullMQ + Ably |
| Deploy | EAS Build / local `expo run:android`; APK sideloaded to test devices | **Railway auto-deploys every push to `main`** — there is no manual backend deploy step |
| Tests | Jest 29 + jest-expo, ~572 tests in `lib/__tests__/` | `npm test` boots a Docker Postgres (`postgis/postgis:16-3.4` on 127.0.0.1:5433), ~990 tests. `npx tsc --noEmit` is a mandatory pre-test gate |
| Live URL | — | https://dominia-backend-production.up.railway.app (hardcoded in `lib/api.js`) |

Third parties: **Clerk** (auth, JWT — never build auth in-house), **Supabase** (Postgres + PostGIS; mobile has anon read-only client in `lib/supabase.js`, backend uses service-role via Prisma), **Ably** (realtime, pure-JS client), **Firebase FCM** (push), **Mapbox** (maps — non-negotiable, never Google Maps).

## 1.3 Critical fact: native projects are generated, not hand-maintained

`.gitignore` lines 42–43 ignore `/ios` and `/android`. The `android/` folder on disk is the output of `npx expo prebuild` — **all native configuration flows through [app.config.js](app.config.js) and config plugins** (Expo "Continuous Native Generation"). This is the single most important fact for this plan: **adding iOS means adding config, not maintaining an Xcode project.** The one custom plugin is [plugins/withHealthConnect.js](plugins/withHealthConnect.js), which injects Health Connect manifest entries and a `MainActivity.kt` permission delegate — Android-only, harmless on iOS.

Current `app.config.js` facts you will change:
- `ios: { supportsTablet: true }` is the *only* iOS config that exists.
- **No `scheme` is set** (needed for OAuth/deep links; Android currently gets `exp+dominia` implicitly).
- Android package is `com.nish_s.dominia` — note the **underscore, which is illegal in an iOS bundle identifier**.
- `expo-location` plugin is configured with `isIosBackgroundLocationEnabled: false` — must flip to `true`.
- `googleServicesFile` points at `./google-services.json` (Android Firebase config, committed at repo root).
- `newArchEnabled: true` — every native lib you add must support the New Architecture.
- `userInterfaceStyle: 'light'`, portrait-only, `edgeToEdgeEnabled` (Android-only key, ignored on iOS).

## 1.4 Mobile app architecture

- **Entry:** [index.js](index.js) registers the FCM background handler *before anything else* (killed-state requirement), then initializes i18next (`i18n/index.js`, en + ru), then registers [App.js](App.js).
- **App.js:** `ClerkProvider` (publishable key hardcoded — a `pk_test_` key; `.env` also has `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`, unused) wraps three headless lifecycle components + a NavigationContainer (native-stack + bottom tabs: Map / Activity / Alliance / Profile, plus ~18 stack screens).
- **Headless lifecycles (mounted once, above navigation):**
  - [components/ActivitySyncLifecycle.js](components/ActivitySyncLifecycle.js) — resolves `playerId` from Supabase by Clerk id, then starts the **activity producer** (`lib/activity.js`) once the player is onboarded; wires AppState + NetInfo into it.
  - [components/FcmLifecycle.js](components/FcmLifecycle.js) — registers the FCM token after an in-app "notification prime" (Android 13+ only today; iOS path currently sets `notifReady=true` immediately, i.e., the OS permission prompt would fire on first sign-in with no prime), routes foreground/background/killed-state notification taps through `lib/notifications/route.js` (25+ push kinds → screens).
  - [components/StreakBreakLifecycle.js](components/StreakBreakLifecycle.js) — streak-break acknowledgement modal, pure JS.
- **State:** module-scope singletons + AsyncStorage (no Redux/Zustand in practice despite the stated stack). Screens are large single files — [screens/MapScreen.js](screens/MapScreen.js) is ~2,700 lines, [screens/ActivityScreen.js](screens/ActivityScreen.js) ~1,580.
- **Metro quirk:** [metro.config.js](metro.config.js) shims `react-dom` → `shims/react-dom-shim.js` (empty module). Platform-neutral, keep as-is.
- **i18n:** all user-facing strings go through i18next keys (`locales/en.json` is source of truth, `ru.json` full first pass). Any new iOS-facing copy (permission primes etc.) must be added to both.
- **Repo-root clutter:** the `*.geojson` / `candidates_*.csv` / `fetch-*.js` / `load-*.js` files at the mobile repo root are the old Saint-Petersburg territory-generation pipeline — data tooling, not app code. Ignore them for iOS work.

## 1.5 The five platform-coupled subsystems (where all the iOS work is)

### A) Health data — the biggest gap. 100% Android today.

`react-native-health-connect@^3.5.0` has **no iOS implementation at all** (its npm package contains an `android/` folder and no `ios/`). On iOS, any screen that imports it will fail at TurboModule resolution. Import sites (all must be abstracted):

| File | What it uses |
|---|---|
| [lib/activity.js](lib/activity.js) | `initialize`, `getSdkStatus`, `getGrantedPermissions`, `aggregateGroupByDuration` |
| [lib/healthConnect.js](lib/healthConnect.js) | Permission descriptors + grant-filtering helpers (pure JS, but HC-shaped) |
| [screens/ActivityScreen.js](screens/ActivityScreen.js) | `initialize`, `requestPermission`, `readRecords('Steps')` (today's total, 10s poll) |
| [screens/ActiveClaimScreen.js](screens/ActiveClaimScreen.js) | `readRecords('Steps')` polled every 10s during a claim/contest walk |
| [screens/HealthConnectDebugScreen.js](screens/HealthConnectDebugScreen.js) | Everything (debug surface) |
| [plugins/withHealthConnect.js](plugins/withHealthConnect.js) | Android manifest/MainActivity injection |

**How the activity producer works (this design ports to iOS almost unchanged — understand it before replacing its data source):** `lib/activity.js` is a foreground-only module-scope singleton. Every 2 minutes (and on start/foreground/manual flush) it calls `aggregateGroupByDuration` to read **1-minute buckets** of Steps + ActiveCaloriesBurned + Distance from local midnight (or a cursor) to now, merges the three metrics per minute (`lib/activity.helpers.js`), assigns each bucket a **deterministic `source_id` = SHA-256(playerId|windowStartMs|windowEndMs) formatted as a UUID** (server-side idempotency — re-posting the same minute is safe), buffers up to 1,000 samples in AsyncStorage, and POSTs batches of ≤100 to `POST /activity/steps`. The cursor clamps to local midnight so past days are never re-read (the backend rejects them). Two hard-won rules: **ACTIVE calories only, never TotalCaloriesBurned** (basal burn would auto-complete challenge tiers), and **no Speed permission** (backend derives tempo from distance ÷ active time).

**The 4-axis daily challenge system depends on these metrics:** Steps (March axis), ActiveCalories (Drill), Distance (Range/Tempo). Distance has a stride-length fallback (`players.stride` calibrated during claims), so steps-only degradation works.

### B) In-claim GPS + live steps — Android foreground service today.

[screens/ActiveClaimScreen.js](screens/ActiveClaimScreen.js) is where claims and contest walks happen. Today on Android:
- `TaskManager.defineTask` + `Location.startLocationUpdatesAsync` with a **`foregroundService`** block (persistent notification, 1s GPS fixes, `BestForNavigation`) → module-scope `latestTaskFix`. The foreground service is what keeps GPS alive with the screen off.
- Steps come from **polling Health Connect `readRecords('Steps')` every 10s** and diffing against a baseline.
- GPS is used for **anti-cheat** (`lib/claim.js`: `computeSpeedKmh`, `isVehicleSpeed` ~30 km/h cutoff, vehicle-excluded steps) and **stride calibration** (GPS distance ÷ steps over qualifying windows, `haversineMetres`).
- Contest walks aggregate steps+distance into 30s windows (`lib/contestWalk.js`) and POST to the backend, which resolves the contest transactionally and pushes `contest_resolved` over Ably channel `contest:<id>`.
- Pause detection: 30s of zero movement → "PAUSED" banner; 15 min → progress reset.

**iOS reality check:** there are no foreground services. The equivalent is background-location mode: `UIBackgroundModes: ["location"]` + While-Using permission + `startLocationUpdatesAsync` started in foreground keeps the app alive in background (blue pill indicator). Separately, **HealthKit step data is NOT real-time** — iPhone CoreMotion batches writes to HealthKit every few minutes, so polling HealthKit every 10s during a walk shows stale zeros. The correct iOS source for live in-claim steps is **CMPedometer** (exposed as `Pedometer` from `expo-sensors`, already a dependency and already permission-primed in [screens/OnboardingScreen.js:590](screens/OnboardingScreen.js:590)), which delivers live step counts and continues while the app is background-alive via the location updates.

### C) Push notifications — FCM, works on iOS but needs setup on every layer.

- Mobile: `@react-native-firebase/app` + `messaging` v23 (modular API). [lib/fcm.js](lib/fcm.js) requests permission (`PermissionsAndroid` on Android 13+; `requestPermission(getMessaging())` — which *is* the correct iOS API — otherwise), gets the token, and PATCHes it to `POST /me/fcm-token`. Foreground/background-tap/killed-state are all handled (`FcmLifecycle` + `index.js` background handler). Deep-link routing table: `lib/notifications/route.js`.
- Backend: `firebase-admin` singleton ([src/shared/firebase.ts](../dominia-backend/src/shared/firebase.ts), credentials via `FIREBASE_SERVICE_ACCOUNT_JSON` env on Railway). All sends go through [src/shared/notifications/send.ts](../dominia-backend/src/shared/notifications/send.ts): per-recipient locale translation at compose time, **Quiet Hours** (23:00–05:00 in `players.home_timezone`, deferred via BullMQ `quietHoursPushQueue`), stale-token cleanup on 3 FCM error codes. 25+ `PushNotificationKind`s. The send call currently sets **`android: { priority: "high" }` and nothing for APNs**.
- FCM delivers to iOS through APNs automatically once the iOS app is registered in the same Firebase project and an APNs key is uploaded. `players.fcm_token` is platform-agnostic; **no schema change needed**.

### D) Auth — Clerk, cross-platform, but App Store rules bite.

Email/password sign-in/up via `@clerk/clerk-expo` ([screens/SignInScreen.js](screens/SignInScreen.js)), token cache in `expo-secure-store` (`lib/clerk.js`), forgot/change password via Clerk custom flows. **Google SSO code was written (onboarding-tightening workstream) but is still pending Clerk-dashboard config + rebuild — it is not live in the JS today** (no `useSSO`/`useOAuth` imports exist). App Store Guideline 4.8: **if the app offers Google sign-in, it must also offer Sign in with Apple.** Email/password-only does not trigger the rule. Account deletion (a hard App Store requirement) already exists: `DELETE /me/account` + type-username confirm modal. Session bootstrap: `POST /me/bootstrap` creates the player row server-side (RLS is locked down; mobile Supabase client is anon **read-only**).

### E) Maps — Mapbox, cross-platform lib, iOS needs build-time token.

`@rnmapbox/maps@^10.3.0`. `MapboxGL.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_TOKEN)` in [screens/MapScreen.js:69](screens/MapScreen.js:69) and [screens/OnboardingScreen.js:13](screens/OnboardingScreen.js:13). MapScreen renders territory polygons via `ShapeSource`/`FillLayer`, `StyleImport` (Mapbox Standard style — a GL v11 feature), `Images` for alliance emblems/home-base icons, `UserLocation`, Living-Map layers (streak borders, ramparts, D4 walls, siege borders, battle chips). On Android the build pulls Mapbox SDKs using `MAPBOX_DOWNLOADS_TOKEN` (gradle property / EAS env — see [eas.json](eas.json) and `android/build.gradle`). **iOS CocoaPods needs the same secret** passed via the config plugin (`RNMapboxMapsDownloadToken`) — today the plugin is registered with no options.

## 1.6 Everything that is already cross-platform (don't rebuild these)

Clerk, Supabase JS client, Ably (pure JS realtime, `lib/chatRealtime.js`), all `lib/*Api.js` fetch wrappers, i18next, react-navigation, react-native-svg (all glyphs/medals are SVG — no icon-font risk), safe-area-context (tab bar already uses insets), toast-message, NetInfo, AsyncStorage, SecureStore, expo-crypto, expo-image-picker (plugin already sets `photosPermission` → iOS `NSPhotoLibraryUsageDescription`), expo-localization, fonts (@expo-google-fonts), the entire Jest suite (pure JS). Developers already wrote `Platform.OS === 'ios'` branches in every `KeyboardAvoidingView` — the JS layer was written with iOS in mind.

Two Android-shaped details worth knowing:
- `lib/supabase.js` and `lib/fcm.js` force `Connection: close` on every fetch — a workaround for an Android RN dead-connection-pool bug. Harmless on iOS (slightly slower); optionally platform-gate later, do not remove.
- `PermissionsAndroid` usage in `lib/fcm.js`, `FcmLifecycle.js`, `MapScreen.js:1187` is already guarded by `Platform.OS === 'android'` checks. Safe.

## 1.7 Development environment constraints (they shape the plan)

- **The developer machine is Windows.** You cannot run Xcode, the iOS Simulator, or `expo run:ios` locally. **All iOS builds go through EAS Build** (cloud Macs). The EAS project already exists (`projectId: a102d35e-…` in app.config.js, `eas.json` present with development/preview/production profiles).
- Therefore **a physical iPhone is required hardware** for all on-device testing (installed via TestFlight or ad-hoc dev builds registered to the device UDID). Budget for one (an iPhone with iOS 17+ is fine; HealthKit + GPS testing means it must be a real phone you can walk with).
- An **Apple Developer Program membership ($99/yr)** is required before anything ships to a device.
- Current test devices: OnePlus 12 (Metro-tethered dev client) + OnePlus 7T (standalone EAS preview). The iPhone becomes the third.

---

# PART 2 — THE PLAN

## Guiding principles

1. **Adapter, not fork.** The activity-producer architecture (minute buckets, deterministic source_ids, buffered idempotent posts) is platform-neutral above the data source. Build a `lib/health/` facade with `.android.js`/`.ios.js` implementations; never scatter `Platform.OS` checks through screens.
2. **Android must not regress.** Every phase ends with the Android app still building and the 572-test Jest suite green. The Android implementation of the facade is a mechanical extraction of existing code.
3. **Backend changes are tiny and safe.** One `apns` block in `send.ts`. Everything else (activity contract, contests, Ably, quiet hours) is platform-agnostic already. Remember: pushing backend `main` deploys to production.
4. **Ship in stages: boot → data → claims → push → polish → App Store.** Each phase has a demo-able exit criterion on a real iPhone.

## Phase 0 — Accounts, credentials, decisions (no code) — ~2–4 days elapsed (mostly waiting)

1. **Apple Developer Program** enrollment (individual or org — org requires a D-U-N-S number and takes longer; individual is fine for beta).
2. **Choose the iOS bundle identifier.** `com.nish_s.dominia` is invalid (underscore). Recommend `com.nishs.dominia`. It never has to match the Android package. Register the App ID with capabilities: **HealthKit, Push Notifications, Background Modes (location), Sign in with Apple** (future-proofing), Associated Domains (optional, for future universal links).
3. **Firebase:** in the existing Firebase project, add an **iOS app** with that bundle ID → download `GoogleService-Info.plist` → commit at repo root (like `google-services.json`). In Apple Developer portal create an **APNs Auth Key (.p8)** and upload it to Firebase project settings → Cloud Messaging. No backend credential changes.
4. **EAS credentials:** run `eas credentials` (or let the first `eas build -p ios` drive it) — EAS manages the distribution certificate + provisioning profiles remotely, which is exactly what you want on Windows. Register the test iPhone's UDID for internal-distribution dev builds (`eas device:create`).
5. **App Store Connect:** create the app record (name "Dominia" — check availability), attach the bundle ID.
6. **Clerk:** production instance planning. The app currently hardcodes a `pk_test_` key in App.js — fine for beta via TestFlight, but note it; move to `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` env during this work.
7. **Decision — HealthKit library:** recommend **`@kingstinct/react-native-healthkit`** (actively maintained, New-Architecture support, Expo config plugin, exposes `queryStatisticsCollectionForQuantity` which maps 1:1 to the minute-bucket aggregation). Fallback candidate `react-native-health` is stale and weak on New Arch — avoid. **Spike first** (Phase 2, task 1) before committing.
8. **Decision — iPad:** set `supportsTablet: false`. A GPS walking game on iPad is a review/QA surface with zero upside.
9. **Decision — in-claim steps on iOS:** CMPedometer via `expo-sensors` (live), HealthKit for daily totals only. (Rationale in §1.5-B; revisit only if the spike disproves the HealthKit latency assumption.)

## Phase 1 — First boot: config + dev build on an iPhone — ~2–4 days

Everything here is `app.config.js` + `eas.json`; no native files.

1. Add to `app.config.js`:
   ```js
   scheme: 'dominia',                       // also fixes pending Clerk SSO redirect config
   ios: {
     supportsTablet: false,
     bundleIdentifier: 'com.nishs.dominia',
     googleServicesFile: process.env.GOOGLE_SERVICES_INFO_PLIST ?? './GoogleService-Info.plist',
     infoPlist: {
       NSMotionUsageDescription: '…counts your steps during territory claims.',
       NSHealthShareUsageDescription: '…reads steps, distance and active calories to power claims and challenges.',
       // location strings come from the expo-location plugin below
     },
     entitlements: { 'com.apple.developer.healthkit': true },
   },
   ```
2. Flip `isIosBackgroundLocationEnabled: true` in the `expo-location` plugin block (adds `UIBackgroundModes: location`).
3. `expo-build-properties`: add `ios: { useFrameworks: 'static', deploymentTarget: '15.1' }`. **`useFrameworks: 'static'` is mandatory for `@react-native-firebase` on iOS** — this is the classic build-failure trap. `@rnmapbox/maps` is compatible with static frameworks, but this combination is the #1 risk of Phase 1; if pods fight, resolve here before writing any feature code.
4. `@rnmapbox/maps` plugin: pass `{ RNMapboxMapsDownloadToken: process.env.MAPBOX_DOWNLOADS_TOKEN }` so iOS pod install can fetch the SDK. Add `MAPBOX_DOWNLOADS_TOKEN` to the **production** profile env in `eas.json` too (today only development/preview have it).
5. **Stub the Android-only native module before first build:** create the `lib/health/` facade folder now with `index.android.js` (re-export current behavior) and `index.ios.js` (inert stubs: `getAvailability() → 'unavailable'`, empty grants, empty buckets), and switch the five import sites (§1.5-A) to the facade. The app must boot on iOS with Activity features gracefully dark, not crash at import.
6. `eas build --profile development --platform ios` → install on the registered iPhone → **exit criterion: sign in with email/password, see the Mapbox map with territory polygons, navigate all four tabs.** Expect to iterate on pods/build 2–5 times; that's normal.

## Phase 2 — Health data on iOS (the core port) — ~1.5–2.5 weeks

1. **Spike (timeboxed 2 days):** with `@kingstinct/react-native-healthkit` in a dev build, verify on the physical iPhone: (a) permission sheet shows Steps/Distance/ActiveEnergy read; (b) `queryStatisticsCollectionForQuantity` returns 1-minute cumulative-sum buckets for `stepCount`, `distanceWalkingRunning`, `activeEnergyBurned` over "local midnight → now"; (c) totals roughly match the Health app (HealthKit statistics de-duplicate iPhone+Watch sources automatically — verify, don't assume); (d) New Arch build is clean. If the spike fails, reassess library choice before proceeding.
2. **Define the facade contract** (what `lib/activity.js` and the screens actually need):
   - `getAvailability() → 'available' | 'unavailable'`
   - `requestActivityPermissions() → granted descriptor` (maps to HC `requestPermission(ACTIVITY_READ_PERMS)` / HK authorization)
   - `getGrantedMetrics() → { steps, activeCalories, distance }` booleans — **HealthKit caveat:** Apple never reveals read-permission status (denied looks identical to no-data). The iOS impl must infer "granted" as "authorization requested + data readable", and the UI copy must not promise to know. This affects `ActivityScreen`'s permission gating UX — plan an iOS-specific empty-state string ("If steps stay at 0, check Settings → Health → Data Access").
   - `aggregateMinuteBuckets(metric, startMs, endMs) → [{ windowStartMs, windowEndMs, value }]`
   - `readTodayStepsTotal() → number`
3. **Port `lib/activity.js` onto the facade.** The producer's logic (cursor, buffering, source_ids, flush triggers, AsyncStorage snapshot) stays byte-identical; only `_aggregateMinuteBuckets`, `getSdkStatus/initialize`, and `_checkPermission` route through the facade. Keep the existing helper tests green; add facade-contract tests with a mock iOS impl.
4. **ActivityScreen:** replace direct HC calls with the facade; add the iOS permission-request flow + copy (i18n en + ru).
5. **HealthConnectDebugScreen:** hide from iOS (conditionally register the route) or build a sibling HealthKitDebugScreen — recommend hiding at first, adding the debug surface once real-device data flows.
6. **Backend: zero changes.** The `POST /activity/steps` contract (samples with steps/kcal/distance per minute + source_id) is platform-neutral, and idempotency already protects against double-posting.
7. **Exit criterion:** walk 1,000+ steps with the iPhone, open the app → Activity screen shows today's steps; backend `daily_steps` matches; a daily challenge tier completes end-to-end on iOS.

## Phase 3 — Claims & contest walks on iOS — ~1.5–2 weeks

1. **Location task:** the `TaskManager.defineTask` + `startLocationUpdatesAsync` code in `ActiveClaimScreen` mostly works on iOS once background mode exists. Changes: wrap the `foregroundService` option Android-only (ignored on iOS but be explicit); set `showsBackgroundLocationIndicator: true`; set `activityType: Location.ActivityType.Fitness`; keep `pausesUpdatesAutomatically: false`. Request flow: While-Using is sufficient for background-continuation started in foreground — do **not** demand "Always" (Apple review friction, unnecessary).
2. **Live steps:** implement the in-claim step source behind a small second facade (`lib/health/liveSteps` or similar): Android = existing HC `readRecords` 10s polling; iOS = `Pedometer.watchStepCount` (expo-sensors, CMPedometer) with the same baseline-diff semantics feeding the existing calibration/anti-cheat/aggregator code. The 30s contest windows, stride calibration, vehicle-speed exclusion, and pause detection are all downstream of "current step count + GPS fixes" and port unchanged.
3. **Verify screen-locked behavior on a real walk:** iOS will keep delivering GPS (blue pill) and CMPedometer data while locked *as long as location updates are running*. This is the single most important physical test of the whole project — do a full claim walk and a contest walk with the phone locked in a pocket.
4. **Anti-cheat parity check with backend rules** (velocity ~30 km/h, home-pin `ST_Contains`, `SELECT FOR UPDATE` claim resolution) — all server-side, no changes; just confirm iOS GPS `speed` values feed `computeSpeedKmh` sanely (iOS reports -1 when unknown — guard exists? verify in `lib/claim.js`).
5. **Exit criterion:** complete a real territory claim and a contest walk on iPhone, screen locked most of the walk, stride calibration recorded, no progress resets.

## Phase 4 — Push notifications on iOS — ~1 week

1. Mobile: `lib/fcm.js` already calls the right iOS API (`requestPermission`). Extend the **notification prime** (`NotifPrimeModal` / `FcmLifecycle` gating) to iOS — today iOS would fire the OS prompt immediately on first sign-in, wasting the one-shot prompt. Gate it behind the same post-walkthrough prime as Android 13+ (`Platform.OS !== 'android'` branch in [components/FcmLifecycle.js:33](components/FcmLifecycle.js:33) is where this changes).
2. Backend ([src/shared/notifications/send.ts](../dominia-backend/src/shared/notifications/send.ts) `deliverPush`): add
   ```ts
   apns: { headers: { 'apns-priority': '10' }, payload: { aps: { sound: 'default' } } },
   ```
   alongside the existing `android` block. Verify the three stale-token FCM error codes also cover APNs-originated failures (they do — FCM abstracts this — but confirm in logs).
3. Killed-state deep-links: `getInitialNotification` works on iOS via RNFirebase; re-run the 12-case device matrix (foreground / background / killed × tap-routing) that S61b established for Android, on the iPhone.
4. Quiet Hours, locale translation, flood guards — all server-side, untouched.
5. **Exit criterion:** contest push received on locked iPhone, tap routes to the correct screen from killed state; quiet-hours deferral verified with a test push at 23:30 local.

## Phase 5 — Auth & account polish — ~3–5 days

1. When Google SSO ships (it's pending Clerk-dashboard config), **add Sign in with Apple in the same release** — Clerk supports it natively (`oauth_apple`); enable in Clerk dashboard + add the capability (already in the App ID from Phase 0) + a button on SignInScreen. If iOS beta launches email/password-only, Apple SSO can wait — but Google-without-Apple is an instant rejection.
2. The `scheme: 'dominia'` added in Phase 1 covers Clerk OAuth redirects on both platforms.
3. Account deletion already meets Apple's requirement (shipped Jul 5); the Play-Console web-deletion URL task has an App Store analog — none required if in-app deletion exists, which it does.
4. **Exit criterion:** fresh sign-up → username → onboarding (home pin, permission primes) → first claim, entirely on iOS.

## Phase 6 — UI/UX QA pass — ~1 week, parallelizable with 4–5

Screens were built Android-first; budget a full sweep on iPhone:
- Safe areas: notch/Dynamic Island (top) and home indicator (bottom) on all ~22 screens; tab bar already uses insets; check full-screen overlays (`GuidedDemo`, `FirstTapTips`, claim screens, toasts).
- **iOS swipe-back gesture:** native-stack enables it by default. Audit screens where mid-flow exit is dangerous — `ActiveClaimScreen` (claim in progress!), `ContestResultScreen`, onboarding — add `gestureEnabled: false` where a hardware-back equivalent was never handled on Android.
- Keyboard: `KeyboardAvoidingView` iOS branches exist; verify Chat, SignIn, Username, CreateAlliance.
- StatusBar (`style="auto"` on dark map = verify readability), splash (`splash-icon.png` on white — check on device), app icon (1024px source in `assets/icon.png` — verify no transparency, Apple rejects alpha in icons).
- Map: Mapbox Standard style + `StyleImport` config, emblem `Images`, Living-Map layers render identically; territory polygon tap targets.
- The guided 13-beat first-run demo — walk it fully on iOS (its tap-target frames are coordinate-sensitive; **memory rule: copy must never imply visiting the territory**).
- Fonts (`includeFontPadding` is Android-only, ignored — fine) and letter-spacing render slightly differently; eyeball the uppercase mono labels.

## Phase 7 — TestFlight beta → App Store submission — ~1–2 weeks elapsed (review latency)

1. `eas build --profile production -p ios` + `eas submit -p ios` → TestFlight internal testing (instant) → external testers (one-time beta review, ~1 day).
2. **App Privacy (nutrition labels):** declare Health & Fitness data, Precise Location, Identifiers (Clerk user id, FCM token), Usage Data (funnel instrumentation events). Health data must be declared as "linked to user". Get this right the first time — mismatches with observed traffic cause rejections.
3. **Review notes are critical for this app.** Provide: a demo account (pre-leveled past onboarding), a paragraph justifying background location ("live GPS validates walking speed during active territory claims; used only while a claim is active"), HealthKit justification, and ideally a 60-second screen recording of a claim walk. Apps that read HealthKit + background location get human review attention.
4. HealthKit rule: health data must never be used for advertising; the privacy policy URL (required) must say so explicitly. A privacy policy page must exist before submission — flag this early, it's non-code work with lead time.
5. Encryption compliance: standard HTTPS only → `ITSAppUsesNonExemptEncryption: false` in infoPlist (add in Phase 1 to skip the per-build questionnaire).
6. Version/build numbers: `autoIncrement` already set in eas.json production profile; `appVersionSource: remote` handles iOS buildNumber.
7. **Exit criterion: approved on the App Store.**

## Ongoing / cross-cutting

- **CI discipline:** after every phase, `npx tsc --noEmit` (backend), full Jest (mobile), full backend suite in Docker. Add at least one EAS iOS build per merged feature branch (EAS build minutes are the constraint — a weekly cadence build is acceptable).
- **PROJECT_STATE.md and the memory system are the project's institutional memory.** Every iOS session should be logged there the same way Android work is (date-tagged entries, commit hashes, device-smoke status).
- **Do not touch:** contest-resolution transaction path (extra-care zone), quiet-hours logic, RLS posture (mobile stays read-only), the deferred list (no web client, no Wanderer Mode, etc.).

## Effort summary (single engineer, sequential, excluding review wait)

| Phase | Work |
|---|---|
| 0 Accounts & decisions | 2–4 days (mostly waiting on Apple) |
| 1 First boot | 2–4 days |
| 2 HealthKit port | 1.5–2.5 weeks |
| 3 Claims/GPS | 1.5–2 weeks |
| 4 Push | 1 week |
| 5 Auth | 3–5 days |
| 6 UI QA | 1 week (parallelizable) |
| 7 Store | 1–2 weeks elapsed |
| **Total** | **~7–10 working weeks to App Store; TestFlight-ready around week 5–6** |

## Top risks, ranked

1. **HealthKit minute-bucket fidelity** (Phase 2 spike exists to kill this early): if 1-min statistics buckets are unreliable, fall back to 5-min buckets — the backend accepts arbitrary windows keyed by source_id, but challenge-completion math (`flushNow` before completion) must be re-verified.
2. **`useFrameworks: 'static'` (Firebase) × Mapbox × New Architecture pod matrix** — resolve fully in Phase 1 before any feature work; pin versions that co-build.
3. **Screen-locked claim walks** (Phase 3 test #3): if iOS suspends the app mid-claim despite location mode, claims silently fail — this is the game's core loop; test on day one of Phase 3.
4. **App Review** (background location + HealthKit): mitigated by review notes, demo video, conservative permission asks (While-Using only).
5. **No Mac** : some failures (e.g., a pod that only reproduces in Xcode) may eventually need a rented cloud Mac (MacinCloud/MacStadium) for an afternoon. Budget for it; don't buy hardware preemptively.
6. **HealthKit permission opacity** (can't detect "denied") — a UX problem, not a technical one; solved with copy, decided in Phase 2 task 2.

## Quick-reference: every file the iOS work touches

| File | Change |
|---|---|
| [app.config.js](app.config.js) | ios block, scheme, plugins (location flag, build-properties, mapbox token), plist strings, entitlements |
| [eas.json](eas.json) | MAPBOX_DOWNLOADS_TOKEN in production env |
| `GoogleService-Info.plist` | new, repo root |
| `lib/health/` (new) | facade: `index.android.js` (extracted HC code), `index.ios.js` (HealthKit), shared contract tests |
| [lib/activity.js](lib/activity.js) | swap direct HC calls → facade |
| [lib/healthConnect.js](lib/healthConnect.js) | absorb into facade's android impl |
| [screens/ActivityScreen.js](screens/ActivityScreen.js) | facade + iOS permission UX |
| [screens/ActiveClaimScreen.js](screens/ActiveClaimScreen.js) | facade for steps, iOS location options, live-steps source split |
| [screens/HealthConnectDebugScreen.js](screens/HealthConnectDebugScreen.js) | hide on iOS |
| [components/FcmLifecycle.js](components/FcmLifecycle.js) | extend notif prime to iOS |
| [screens/SignInScreen.js](screens/SignInScreen.js) | Apple SSO button (with Google SSO release) |
| [App.js](App.js) | Clerk key → env var |
| `locales/en.json` + `ru.json` | new iOS permission/empty-state copy |
| Backend [src/shared/notifications/send.ts](../dominia-backend/src/shared/notifications/send.ts) | add `apns` block to `deliverPush` |
| Backend — everything else | **no changes** |
