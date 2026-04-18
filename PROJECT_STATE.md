# DOMINIA — MASTER PROJECT STATE
Last updated: April 18, 2026

---

## WHAT IT IS
Real-world mobile territory game. Players walk to claim OSM-defined named territories on a city map. Physical activity is the only resource — distance walked determines what you can claim and contest. Alliance system (up to 20 members) for collective defence and warfare.

**Tagline:** Walk. Claim. Conquer. Defend.

---

## DEV ENVIRONMENT

| | |
|---|---|
| OS | Windows |
| Terminal | Warp — PowerShell syntax. Run commands one at a time. `&&` does not work. |
| Warp tabs | Ctrl+T = new tab. Never stop the Expo tab. Open new tab for everything else. |
| Editor | Cursor — Agent chat (Ctrl+L). Claude writes directly to files. Always check phone after Cursor makes changes. |
| Device | OnePlus Android |
| Screen mirror | scrcpy — run `scrcpy` to mirror phone to PC for sharing errors |
| GitHub | github.com/nishs580/dominia |

---

## STACK

| Layer | Technology | Status |
|---|---|---|
| Mobile | React Native + Expo SDK 54 | ✓ Running |
| Maps | Mapbox GL (`@rnmapbox/maps`) | ✓ Working |
| Database | Supabase (PostgreSQL) | ✓ Connected |
| Auth | Clerk (`@clerk/clerk-expo`) | ✓ Working end to end |
| Location | expo-location | ✓ Installed |
| Sensors | expo-sensors | ✓ Installed |
| Animations | react-native-svg | ✓ Installed |
| Navigation | @react-navigation/native-stack + bottom tabs | ✓ Working |
| Backend (future) | Node.js + Fastify + PostGIS | Not started |
| Real-time (future) | Ably | Not started |
| Push (future) | Firebase Cloud Messaging | Not started |

---

## IMPORTANT KEYS & IDS

| | |
|---|---|
| Supabase URL | https://rscregotvkwgfzpxnmwh.supabase.co |
| Clerk publishable key | pk_test_bGVuaWVudC1nb29zZS01My5jbGVyay5hY2NvdW50cy5kZXYk |
| Test user | real email + password: Test1234! |
| Your player ID | 94a9036e-1d59-49ae-9b5f-eae064913fbf |
| Your username | nish_s |
| Your clerk_id | user_3CRjZoj8XaCoFwuAayVcgA2RPaP |
| Vondelpark owner | your player (94a9036e) — shows green correctly when logged in as nish_s |
| Iron Wolves [INW] | id=e72aebff |
| Fire Blades [FBM] | id=127c7666 |

Clerk publishable key and Supabase URL/key are **hardcoded** in `App.js` and `lib/supabase.js` — env vars unreliable in React Native at runtime. All 4 keys also in `.env` (gitignored).

---

## SUBSCRIPTIONS & LIMITS

| Service | Plan | Key limits |
|---|---|---|
| Supabase | Free | 1 project, 500MB DB, 50MB storage, 2GB bandwidth/month |
| Mapbox | Free | 50,000 map loads/month |
| Clerk | Free | 10,000 MAU |
| EAS Build | Free | 30 builds/month (15 Android + 15 iOS). **~13 Android used, ~17 remaining.** |
| Cursor | Pro | No usage limits on AI edits |

---

## SUPABASE SCHEMA

**Tables:**

`players`: id, username, level, xp, home_city, alliance_id, created_at, clerk_id, has_onboarded, home_pin_lat, home_pin_lng

`territories`: id, territory_name, tier, perimeter_distance, owner_id, alliance_id, development_level, longitude, latitude, created_at

`alliances`: id, name, short_name, city, created_at

**Test data:**
- 4 territories: Vondelpark (large, 3200m) · Leidseplein (small, 450m) · Prinsengracht (medium, 1800m) · Museumplein (medium, 1200m) — Amsterdam, hardcoded bounding box polygons
- 2 alliances: Iron Wolves [INW] id=e72aebff, Fire Blades [FBM] id=127c7666
- nish_s player id: 94a9036e · clerk_id: user_3CRjZoj8XaCoFwuAayVcgA2RPaP
- ⚠️ Orphan row `nishan.shetty` (id=5d11b40b) still needs to be deleted from players table via Supabase dashboard

---

## SCREENS — STATUS

| Screen | Status | Notes |
|---|---|---|
| Navigation (4 bottom tabs) | ✓ Done | Map, Activity, Alliance, Profile |
| Map screen | ✓ Done | Mapbox map, Supabase territories, owner-aware bottom sheet (Claim/Contest/Abandon), Abandon confirmation Alert, map refreshes after claim/abandon |
| Activity screen | ✓ Done | Territory count + XP from Supabase, weekly chart highlights real day, steps hardcoded 0 |
| Profile screen | ✓ Done | Username, level, XP, territory list from Supabase — all real data |
| Alliance screen | ✓ Done | isMember from Supabase alliance_id, real alliance list with member counts, join flow working end to end |
| Active Claim screen | ✓ Done | Animated SVG progress ring, DEV_MODE toggle at top (true=fake interval, false=real GPS), passes territoryId through |
| Claim Success screen | ✓ Done | Updates territories.owner_id in Supabase on mount |
| Contest Result screen | ✓ Done | 4 states: attack_won / attack_lost / defend_won / defend_lost via route.params |
| Sign In screen | ✓ Done | Sign in + sign up modes, Clerk auth working end to end |
| Username screen | ✓ Done | Commander name picker, updates players.username by clerk_id |
| AuthGate | ✓ Done | Checks isSignedIn + has_onboarded, routes to Onboarding or MainTabs |
| Onboarding screen | ✓ Done | 5-step flow, has_onboarded flag, home pin on real Mapbox map saved to Supabase, back nav on steps 1–3 |
| Alliance Joined | ✓ Done | Welcome screen, hardcoded Iron Wolves [INW] data |
| Permissions | ~ Partial | Permissions requested inline in onboarding step 2 — not a standalone screen |
| Alliance Hub (create/found flow) | ~ Partial | Join flow works end to end. Create/found flow not built. |

---

## KEY FILES

| File | Purpose |
|---|---|
| `App.js` | Root stack navigator, ClerkProvider (hardcoded publishable key), AuthGate as initial route |
| `components/AuthGate.js` | Checks isSignedIn + has_onboarded, routes to Onboarding or MainTabs |
| `lib/supabase.js` | Supabase client with AsyncStorage (URL/key hardcoded — env vars unreliable in RN) |
| `lib/clerk.js` | ClerkProvider and tokenCache with SecureStore |
| `lib/auth.js` | ensurePlayer(clerkUserId, email) — finds or creates player row in Supabase |
| `metro.config.js` | react-dom shim to fix @clerk/clerk-react bundling |
| `shims/react-dom-shim.js` | Empty module.exports shim |
| `screens/MapScreen.js` | Mapbox map, Supabase territory fetch, TerritorySheet (Claim/Contest/Abandon), owner-aware colouring, Abandon Alert, fetchTerritories as useCallback for refresh |
| `screens/SignInScreen.js` | Sign in + sign up modes, ensurePlayer call |
| `screens/UsernameScreen.js` | Commander name picker, updates players.username by clerk_id |
| `screens/ActiveClaimScreen.js` | DEV_MODE constant at top (true=fake, false=real GPS), haversine distance tracking, passes territoryId to ClaimSuccessScreen |
| `screens/ClaimSuccessScreen.js` | Updates territories.owner_id in Supabase on mount |
| `screens/ContestResultScreen.js` | 4 contest states via route.params |
| `screens/OnboardingScreen.js` | 5 steps, has_onboarded update on finish, home pin Mapbox map on step 3, saves home_pin_lat/lng |
| `screens/AllianceScreen.js` | isMember from Supabase alliance_id, real alliance list, inline join confirmation |
| `screens/AllianceJoinedScreen.js` | Welcome screen, hardcoded Iron Wolves data |
| `screens/ActivityScreen.js` | XP + territory count from Supabase, steps hardcoded 0, weekly chart highlights real day |
| `screens/ProfileScreen.js` | Fetches players row by clerk_id, fetches owned territories — all real Supabase data |
| `.env` | All 4 keys (Mapbox, Supabase URL, Supabase anon key, Clerk publishable key) — gitignored |
| `.npmrc` | legacy-peer-deps=true for EAS build compatibility |
| `app.json` | Plugins: expo-location, expo-sensors, expo-build-properties (minSdkVersion 26) |
| `eas.json` | EAS build profiles, MAPBOX_DOWNLOADS_TOKEN env reference |
| `android/gradle.properties` | Mapbox download token for builds |
| `package.json` | All installed package versions |

---

## IMPORTANT COMMANDS

```
# Dev server (always use these flags)
npx expo start --dev-client --host lan
# If port busy: add --port 8082 or --port 8083
# Kill stuck ports: npx kill-port 8081 8082 8083

# ADB — run after every Metro restart
& "C:\platform-tools-latest-windows\platform-tools\adb.exe" reverse tcp:8081 tcp:8081

# ADB — fix unauthorized
adb kill-server
adb start-server
# then tap Allow on phone

# EAS build — BEFORE EVERY BUILD run this first:
npx expo install --fix
# Then build:
eas build --profile development --platform android

# Find cached APK
Get-ChildItem -Path "C:\Users\nisha\AppData\Local\Temp\eas-cli-nodejs\eas-build-run-cache" -Filter "*.apk"

# Install APK
& "C:\platform-tools-latest-windows\platform-tools\adb.exe" install -r "<path-to-apk>"

# Mirror phone to PC
scrcpy

# Save to GitHub
git add .
git commit -m "message"
git push
```

**EAS build budget:** 30/month. ~13 Android used, ~17 remaining. Only build for new native modules. Batch all native installs into one build — never build for a single package.

**Native module rule:** New native modules need an EAS build + APK reinstall. JS-only packages just need a Metro restart.

---

## OPEN BUGS

| Bug | Detail |
|---|---|
| Orphan DB row | `nishan.shetty` (id=5d11b40b) in players table — delete manually from Supabase dashboard. |
| Client Trust disabled in Clerk | Disabled during dev to unblock sign-in. Needs proper 2FA or email OTP re-enabled before production. |
| Real step tracking broken | `Pedometer.getStepCountAsync()` unsupported on Android. `react-native-health-connect` tried and removed — native crash on load (lateinit property error in HealthConnectManager). Steps currently hardcoded to 0. Revisit when step tracking is prioritised. |
| Contest flow incomplete | Contest uses same ActiveClaimScreen as claim — needs separate logic for contested territories. |
| Onboarding home pin verification not implemented | 500m proximity check deferred — home pin saves lat/lng but no verification step. |

---

## DEFERRED / OUT OF SCOPE

- Real OSM territory shapes — bounding box polygons sufficient for all mechanic testing
- Real step tracking — Health Connect failed, revisit when prioritised
- Alliance create/found flow — join works, found not built yet
- Alliance chat — post-MVP
- Branding and visual polish — after core loop is complete
- Onboarding home pin 500m verification — deferred
- Backend (Fastify, PostGIS, BullMQ, Ably, FCM) — not started, separate phase

---

## WHAT'S NEXT

**Immediate:** Build the Alliance create/found flow — "Found your own" path from Alliance screen, including alliance name, short name (3 letters), and saving to the alliances table in Supabase.

**Backlog (in rough order):**
1. Alliance create/found flow
2. Contest flow — separate logic from claim flow in ActiveClaimScreen
3. Real step tracking — revisit expo-sensors Pedometer.watchStepCount() as fallback
4. Onboarding home pin 500m verification
5. Backend phase (Fastify, PostGIS, BullMQ, Ably, FCM)

---

## DECISION LOG

| Decision | Reason |
|---|---|
| Mapbox over react-native-maps | Better OSM support, vector tile rendering, territory polygon overlays |
| Territory bottom sheet (not full screen) | Keeps map visible behind it |
| Territory bottom sheet shows perimeter distance, not geographic distance | Matches game mechanic |
| Mapbox token in .env only, never in source | Security — learned the hard way (git history rewrite needed after accidental commit) |
| Dev build required (not Expo Go) | Mapbox needs native modules |
| All screens hardcoded first, backend after | Build all screens before wiring Supabase — avoids premature complexity |
| @clerk/clerk-expo (not @clerk/expo) | Correct package; metro shim fixes react-dom bundling issue |
| `npx expo install --fix` before every EAS build | Catches version mismatches that silently break builds |
| Batch all native module installs into one EAS build | EAS budget is limited — never build for a single package |
| legacy-peer-deps=true in .npmrc | Required for EAS build npm ci to succeed |
| react-native-screens pinned to 4.16.0 | Fixes version conflict that caused IllegalViewOperationException |
| USB debugging via adb (not WiFi) | AVG firewall + VPN blocked WiFi Metro connection |
| OSM real territory shapes deferred | Bounding box polygons sufficient for all game mechanic testing |
| Alliance chat deferred to post-MVP | Complexity not needed until core loop is working |
| Clerk password breach protection disabled | Allows use of simple test password (Test1234!) during dev |
| Clerk publishable key hardcoded in App.js | Env vars unreliable in React Native at runtime |
| Supabase URL/key hardcoded in lib/supabase.js | Same reason — env vars unreliable at runtime |
| Client Trust disabled in Clerk dashboard | Was requiring 2FA which blocked sign-in completion — re-evaluate before production |
| DEV_MODE = true in ActiveClaimScreen | Fake interval for rapid testing — flip to false for real GPS walk test |
| Abandon over Patrol for own territories | Patrol mechanic not built end to end; Abandon more useful for testing with limited territory data |
| react-native-health-connect removed | Native crash on load (lateinit property error) — not worth debugging now, steps hardcoded to 0 |
| minSdkVersion 26 via expo-build-properties plugin | android.minSdkVersion in app.json not respected by Expo managed workflow — must use plugin |

---

## WORKING STYLE — ALWAYS FOLLOW THIS

Do not start coding immediately. Work conversationally:
- Explain what each screen or feature does before building it
- Show a wireframe or mockup when introducing a new screen
- Ask for confirmation before writing any code
- Wait for the user to say "yes" or "let's build it" before touching any files
- Once confirmed, provide the exact prompt to paste into Cursor's agent chat
- After Cursor builds it, wait for the user to check their phone and report back
- Give the user time to ask questions at every step
