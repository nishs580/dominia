# DOMINIA — MASTER PROJECT STATE
Last updated: April 17, 2026 (evening)

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
| EAS Build | Free | 30 builds/month (15 Android + 15 iOS). **10 Android used, 20 remaining.** |
| Cursor | Pro | No usage limits on AI edits |

---

## SUPABASE SCHEMA

**Tables:** `players`, `alliances`, `territories`

**Seeded data:**
- 4 territories: Vondelpark, Leidseplein, Prinsengracht, Museumplein (Amsterdam, hardcoded bounding box polygons)
- 2 alliances: Iron Wolves [INW] id=e72aebff, Fire Blades [FBM] id=127c7666
- ⚠️ Orphan row `nishan.shetty` (id=5d11b40b) still needs to be deleted from players table via Supabase dashboard

---

## SCREENS — STATUS

| Screen | Status | Notes |
|---|---|---|
| Navigation (4 bottom tabs) | ✓ Done | Map, Activity, Alliance, Profile |
| Map screen | ✓ Done | Mapbox map, territories from Supabase, real owner/alliance colours, logged-in user's territory green |
| Activity screen | ✓ Done | Steps card, active claim progress, weekly bar chart |
| Profile screen | ✓ Done | XP progress, stats grid, territory list, functional sign out button — all hardcoded |
| Alliance screen | ✓ Done | 2 states via `isMember` boolean at top of AllianceScreen.js (currently `true`) |
| Active Claim screen | ✓ Done | Animated SVG progress ring, navigates to ClaimSuccess at 100% |
| Claim Success screen | ✓ Done | Celebration screen, fade-in animation, test contest result buttons |
| Contest Result screen | ✓ Done | 4 states: attack_won / attack_lost / defend_won / defend_lost via route.params |
| Sign In screen | ✓ Done | Sign in + sign up modes, Clerk auth working end to end |
| Username screen | ✓ Done | Commander name picker, updates players.username by clerk_id |
| AuthGate | ✓ Done | Checks isSignedIn on app load, routes to SignIn or MainTabs |
| Onboarding screen | ~ Partial | 5-step flow built, but shown every launch (needs first-launch flag in Supabase) |
| Permissions | ○ Not started | |
| Alliance Hub (create/join flow) | ○ Not started | |
| Alliance Joined | ✓ Done | Welcome screen, hardcoded Iron Wolves [INW] data |

---

## KEY FILES

| File | Purpose |
|---|---|
| `App.js` | Root stack navigator, ClerkProvider wrapper, AuthGate as initial route |
| `components/AuthGate.js` | Checks isSignedIn, redirects to SignIn or MainTabs |
| `lib/supabase.js` | Supabase client with AsyncStorage (URL/key currently hardcoded) |
| `lib/clerk.js` | ClerkProvider and tokenCache with SecureStore |
| `lib/auth.js` | ensurePlayer(clerkUserId, email) — finds or creates player row in Supabase |
| `metro.config.js` | react-dom shim to fix @clerk/clerk-react bundling |
| `shims/react-dom-shim.js` | Empty module.exports shim |
| `screens/MapScreen.js` | Mapbox map, Supabase territory fetch, bottom sheet, useAuth for green colouring |
| `screens/SignInScreen.js` | Sign in + sign up modes, ensurePlayer call |
| `screens/UsernameScreen.js` | Commander name picker, updates players.username by clerk_id |
| `screens/ActiveClaimScreen.js` | Animated SVG ring, navigates to ClaimSuccess at 100% |
| `screens/ClaimSuccessScreen.js` | Celebration screen, test buttons for ContestResult states |
| `screens/ContestResultScreen.js` | 4 contest states via route.params |
| `screens/OnboardingScreen.js` | 5-step flow, expo-location + expo-sensors permissions on step 3 |
| `screens/AllianceScreen.js` | isMember boolean at top (currently true) |
| `screens/AllianceJoinedScreen.js` | Welcome screen, hardcoded Iron Wolves data |
| `screens/ActivityScreen.js` | Steps card, active claim card, weekly bar chart |
| `screens/ProfileScreen.js` | XP progress, stats, sign out button |
| `.env` | All 4 keys (Mapbox, Supabase URL, Supabase anon key, Clerk publishable key) — gitignored |
| `.npmrc` | legacy-peer-deps=true for EAS build compatibility |
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

**EAS build budget:** 30/month. ~10 Android used. Only build for new native modules. Batch all native installs into one build — never build for a single package.

**Native module rule:** New native modules need an EAS build + APK reinstall. JS-only packages just need a Metro restart.

---

## OPEN BUGS

| Bug | Detail |
|---|---|
| Onboarding shown every launch | No first-launch flag. Needs a check against the `players` table after auth — deferred until after Profile screen is wired to real data. |
| Orphan DB row | `nishan.shetty` (id=5d11b40b) in players table — delete manually from Supabase dashboard. |
| Client Trust disabled in Clerk | Disabled during dev to unblock sign-in. Needs proper 2FA flow or email OTP re-enabled before production. |

---

## DEFERRED / OUT OF SCOPE

- Real OSM territory shapes — bounding box polygons sufficient for all mechanic testing
- Supabase wired to all screens — doing screen by screen, starting with Profile
- Alliance chat — post-MVP
- Branding and visual polish — after screens are complete
- Onboarding first-launch flag — after Profile screen is wired to real data
- Backend (Fastify, PostGIS, BullMQ, Ably, FCM) — not started, separate phase

---

## WHAT'S NEXT

**Immediate:** Wire Profile screen to real Supabase data — fetch logged-in player's username, level, XP, and territories using Clerk userId.

**After Profile screen:** Wire remaining screens to real data one by one.

**Screen backlog (in rough order):**
1. Profile screen — real Supabase data
2. Permissions screen
3. Alliance Hub (create/join flow)
4. Real claim flow with distance tracking via expo-location
5. Onboarding first-launch flag

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
