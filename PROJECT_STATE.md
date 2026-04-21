# DOMINIA — MASTER PROJECT STATE
Last updated: April 21, 2026

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
| nish_s player ID | 94a9036e-1d59-49ae-9b5f-eae064913fbf |
| nish_s clerk_id | user_3CRjZoj8XaCoFwuAayVcgA2RPaP |
| Rubik player ID | 788e9834 — same alliance as nish_s (KAI) |
| boo player ID | 53a0186a — enemy account, Gritty Greeks [GGG], holds Leidseplein + Prinsengracht |
| Kainetic Allied [KAI] | id=6bc19cb1-97ce-4f76-95fa-b645606c2b47 |

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

`players`: id, username, level, xp, home_city, alliance_id, created_at, clerk_id, has_onboarded, home_pin_lat, home_pin_lng, current_streak, longest_streak, last_active_date

`territories`: id, territory_name, tier, perimeter_distance, owner_id, alliance_id, development_level, longitude, latitude, created_at

`alliances`: id, name, short_name, city, created_at, founder_id

`player_challenges`: id, player_id, challenge_key, completed_at, date — UNIQUE constraint on (player_id, challenge_key, date)

**Test data:**
- 10 territories (Amsterdam, hardcoded bounding box polygons, all unclaimed unless noted):
  - Vondelpark (large, 3200m) · Leidseplein (small, 450m) · Prinsengracht (medium, 1800m) · Museumplein (medium, 1200m) · Sarphatipark (small, 600m)
  - Rembrandtplein · Oosterpark · Westerpark · Plantage · Oud-West (all unclaimed, added this session)
- Active alliances: Kainetic Allied [KAI] id=6bc19cb1-97ce-4f76-95fa-b645606c2b47 · Gritty Greeks [GGG]
- Test players: nish_s (94a9036e, KAI) · Rubik (788e9834, KAI) · boo (53a0186a, GGG — holds Leidseplein + Prinsengracht)
- Territory tier values must be **lowercase** in DB (small/medium/large) — check constraint enforces this

**Useful reset SQL:**
```sql
-- Reset a territory
UPDATE territories SET owner_id = null, alliance_id = null WHERE territory_name = 'X';
-- Reset player alliance (run before deleting alliance row — foreign key constraint)
UPDATE players SET alliance_id = NULL WHERE username = 'X';
```

---

## SCREENS — STATUS

| Screen | Status | Notes |
|---|---|---|
| Navigation (4 bottom tabs) | ✓ Done | Map, Activity, Alliance, Profile |
| Map screen | ✓ Done | Colours: green (own), purple (alliance), red (enemy), grey (unclaimed). TerritorySheet gated correctly. Cap enforcement: grey disabled block with message when at cap, Claim button hidden. |
| Activity screen | ✓ Done | Daily challenges card (Easy/Medium/Hard), completion state, XP award, Supabase writes. Stats pills. Weekly chart. Active Claim card removed. |
| Profile screen | ✓ Done | Real XP, level title (no level number shown), streak pill (current + best), territory cap (held/cap), territory list |
| Alliance screen | ✓ Done | Member/non-member from Supabase, real roster + territory count, create + join flows working |
| Active Claim screen | ✓ Done | DEV_MODE=true, mode param (claim/contest), opponent name + attacker alliance_id fetched on load |
| Claim Success screen | ✓ Done | Uses playerId from nav params, sets owner_id + alliance_id in Supabase |
| Contest Result screen | ✓ Done | 4 states via route.params, writes owner_id + alliance_id on attack_won |
| Sign In screen | ✓ Done | Sign in + sign up, passes playerId through nav params |
| Username screen | ✓ Done | Uses playerId from nav params |
| AuthGate | ✓ Done | Checks isSignedIn + has_onboarded, routes to Onboarding or MainTabs |
| Onboarding screen | ✓ Done | 5-step flow, uses playerId from nav params, home pin on real Mapbox map |
| Create Alliance screen | ✓ Done | 3-step founding flow — writes to alliances, updates players + territories |
| Alliance Joined screen | ✓ Done | Reads real alliance name, code, city from nav params |
| Permissions | ~ Partial | Requested inline in onboarding step 2 — not a standalone screen |
| Defender flow | ○ Deferred | Needs Ably real-time layer — not worth building a throwaway version. Revisit when backend is started. |
| Branding + UI polish | ○ Next | Brand guidelines (dominia-brand-guidelines-v1-1) and mockups (dominia-mockups-v4) ready. Starting next session. |

---

## KEY FILES

| File | Purpose |
|---|---|
| `App.js` | Root stack navigator, ClerkProvider (hardcoded publishable key), all screen registrations |
| `components/AuthGate.js` | Checks isSignedIn + has_onboarded, routes to Onboarding or MainTabs |
| `lib/supabase.js` | Supabase client with AsyncStorage (URL/key hardcoded — env vars unreliable in RN) |
| `lib/clerk.js` | ClerkProvider tokenCache with SecureStore |
| `lib/auth.js` | ensurePlayer(clerkUserId, email) — uses maybeSingle() to find or create player row |
| `lib/level.js` | LEVELS array, getLevelForXp, getNextLevel, getXpProgress, territoryCap per level |
| `lib/streak.js` | updateStreakOnChallengeComplete — fires on first challenge completion of the day, writes current_streak/longest_streak/last_active_date |
| `metro.config.js` | react-dom shim to fix @clerk/clerk-react bundling |
| `shims/react-dom-shim.js` | Empty module.exports shim |
| `screens/MapScreen.js` | Mapbox map, territory fetch + colour logic, HUD alliance badge, TerritorySheet with button gating, cap enforcement (getLevelForXp + allFeatures green count) |
| `screens/SignInScreen.js` | Sign in + sign up, passes playerId through nav params |
| `screens/UsernameScreen.js` | Uses playerId from nav params (not useAuth) |
| `screens/OnboardingScreen.js` | 5 steps, uses playerId from nav params, home pin Mapbox map, saves to Supabase |
| `screens/AllianceScreen.js` | NonMemberContent (join flow), MemberContent (real roster + territory count), CreateAlliance nav |
| `screens/CreateAllianceScreen.js` | 3-step founding flow — writes to alliances, updates players + territories |
| `screens/AllianceJoinedScreen.js` | Reads real name/code/city from route.params |
| `screens/ProfileScreen.js` | Real XP + level title from lib/level.js, streak pill (current + best) from players table, territory cap (held/cap), territory list, sign out |
| `screens/ActiveClaimScreen.js` | DEV_MODE=true at top, mode param (claim/contest), opponentNameRef + attackerAllianceRef fetched on screen load |
| `screens/ClaimSuccessScreen.js` | Uses playerId from nav params, sets owner_id + alliance_id in Supabase |
| `screens/ContestResultScreen.js` | 4 states via route.params, writes owner_id + alliance_id on attack_won |
| `screens/ActivityScreen.js` | Daily challenges card (Easy/Medium/Hard), completion state, XP award, Supabase writes to player_challenges, streak trigger, stats pills, weekly chart |
| `.env` | All 4 keys (Mapbox, Supabase URL, Supabase anon key, Clerk publishable key) — gitignored |
| `.npmrc` | legacy-peer-deps=true for EAS build compatibility |
| `app.json` | Plugins: expo-location, expo-sensors, expo-build-properties (minSdkVersion 26) |
| `eas.json` | EAS build profiles, MAPBOX_DOWNLOADS_TOKEN env reference |
| `android/gradle.properties` | Mapbox download token for builds |

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
| Client Trust disabled in Clerk | Disabled during dev to unblock sign-in. Needs proper 2FA or email OTP re-enabled before production. |
| Clerk email verification disabled | Disabled for dev (was causing status: missing_requirements). Must re-enable before production. |
| Real step tracking broken | `Pedometer.getStepCountAsync()` unsupported on Android. `react-native-health-connect` tried and removed — native crash on load. Steps currently hardcoded to 0. Possible fallback: `expo-sensors Pedometer.watchStepCount()`. DEV_MODE challenges use manual Complete button for now. |
| Defender flow deferred | Needs Ably real-time layer — not worth building a throwaway version. |
| Onboarding home pin verification not implemented | 500m proximity check deferred — home pin saves lat/lng but no verification step. |

---

## DEFERRED / OUT OF SCOPE

- Real OSM territory shapes — bounding box polygons sufficient for all mechanic testing, revisit when showing to people
- Real step tracking — Health Connect failed, expo-sensors fallback not yet tried, deferred due to EAS budget
- Defender flow — needs Ably real-time layer, deferred to backend phase
- Alliance disband flow — dropped from backlog, no real gameplay use case
- Alliance chat — post-MVP
- Onboarding home pin 500m verification — deferred
- Backend (Fastify, PostGIS, BullMQ, Ably, FCM) — not started, separate phase

---

## WHAT'S NEXT

**Immediate:** Apply Dominia branding — fonts, colours, component styles — starting with design tokens and working screen by screen. Brand guidelines (`dominia-brand-guidelines-v1-1`) and mockups (`dominia-mockups-v4`) are in the project files.

**Backlog (in rough order):**
1. Branding + UI polish
2. Real step tracking — try expo-sensors Pedometer.watchStepCount() as fallback (needs EAS build budget)
3. Onboarding home pin 500m verification
4. Backend phase (Fastify, PostGIS, BullMQ, Ably, FCM)
5. Defender flow — revisit once Ably is built

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
| playerId passed through nav params throughout | Removes useAuth() timing dependency — userId is null for new users immediately after sign-up |
| CreateAlliance screen name (not FoundAlliance) | "found" was ambiguous — "create" clearer |
| Founding steps 1+2 combined | Name and 3-letter code on one screen — reduces friction |
| Founder vs Member role derived from founder_id | No role column in DB yet — derived dynamically, deferred |
| Clerk email verification disabled for dev | Was causing status: missing_requirements on sign-up — must re-enable before production |
| lib/auth.js uses maybeSingle() not single() | single() throws PGRST116 on no rows — maybeSingle() returns null safely |
| Reuse ActiveClaimScreen with mode param | Avoids duplicate screen — same UI for claim and contest, mode param drives behaviour |
| Fetch opponent name at screen load not completion | Prevents stale data after ownership write in ContestResultScreen |
| Fetch attacker alliance_id in ActiveClaimScreen | ContestResultScreen should only write, not fetch — keeps write logic simple |
| DB cleanup — delete dummy accounts and alliances | Keep DB clean for real mechanic testing with real accounts |
| Defender flow deferred until Ably is built | Simultaneous race mechanic needs real-time layer — not worth building a throwaway version |
| Alliance disband dropped from backlog | No real gameplay use case — Founder can leave and role auto-transfers |
| Level numbers never shown to player | Titles only (Scout, Pathfinder etc) — level integer stays in DB for logic |
| Daily challenges reset via date-scoped queries | No cron job needed — UNIQUE constraint on (player_id, challenge_key, date) handles idempotency |
| DEV_MODE challenges use manual Complete button | No real step check until step tracking is solved — avoids blocking challenge testing |
| heldCount derived from allFeatures color property | No extra Supabase query needed for cap check — reuses green (#1D9E75) feature count already on screen |
| Territory tier values must be lowercase in DB | Check constraint enforces small/medium/large — capitalised values fail silently on INSERT |
| 10 test territories chosen for clean non-overlapping spread | Jordaan + De Pijp replaced with Plantage + Oud-West due to polygon overlap with existing territories |

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
