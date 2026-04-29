# DOMINIA — MASTER PROJECT STATE
Last updated: April 29, 2026 (evening)

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
| Fonts | @expo-google-fonts/archivo + geist-mono + inter + expo-splash-screen | ✓ Installed |
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

`players`: id, username, level, xp, home_city, alliance_id, created_at, clerk_id, has_onboarded, home_pin_lat, home_pin_lng, current_streak, longest_streak, last_active_date, iron, stone, gold, morale

`territories`: id, territory_name, tier, perimeter_distance, owner_id, alliance_id, development_level, longitude, latitude, created_at, legacy_rank, upkeep_overdue

`alliances`: id, name, short_name, city, created_at, founder_id, morale

`player_challenges`: id, player_id, challenge_key, completed_at, date — UNIQUE constraint on (player_id, challenge_key, date)

**Test data:**
- 10 territories (Amsterdam, hardcoded bounding box polygons, all unclaimed unless noted):
  - Vondelpark (large, 3200m) · Leidseplein (small, 450m) · Prinsengracht (medium, 1800m) · Museumplein (medium, 1200m) · Sarphatipark (small, 600m)
  - Rembrandtplein · Oosterpark · Westerpark · Plantage · Oud-West (all unclaimed, added this session)
- Active alliances: Kainetic Allied [KAI] id=6bc19cb1-97ce-4f76-95fa-b645606c2b47 · Gritty Greeks [GGG]
- Test players: nish_s (94a9036e, KAI) · Rubik (788e9834, KAI) · boo (53a0186a, GGG — holds Leidseplein + Prinsengracht)
- Territory tier values must be **lowercase** in DB (small/medium/large) — check constraint enforces this

**Indexes added:**
- `idx_territories_owner_id` ON territories(owner_id)
- `idx_territories_alliance_id` ON territories(alliance_id)
- `idx_players_clerk_id` ON players(clerk_id)
- `idx_players_alliance_id` ON players(alliance_id)

**Row Level Security (RLS):**
- `players` table: **DISABLED** (manually via dashboard). Was causing 19-minute hangs because old policies referenced `auth.uid()` but project uses Clerk, not Supabase Auth.
- All other tables (`territories`, `alliances`, `player_challenges`): RLS off.
- ⚠️ **Re-enabling RLS on players without proper Clerk JWT integration will reintroduce the 19-min hang.** Implement Clerk-JWT-based RLS before production launch.

Note: territories.owner_id index alone took Profile load from minutes → ~425ms warm. Cold-start free-tier DB wake-up takes 30–120s (Supabase free tier pausing) — not a code issue.
```sql
-- Reset a territory
UPDATE territories SET owner_id = null, alliance_id = null WHERE territory_name = 'X';
-- Reset player alliance
UPDATE players SET alliance_id = NULL WHERE username = 'X';
-- Reset onboarding for dev testing
UPDATE players SET has_onboarded = false WHERE username = 'nish_s';
```

---

## SCREENS — STATUS

| Screen | Status | Notes |
|---|---|---|
| Navigation (4 bottom tabs) | ✓ Branded | Geist Mono, uppercase, Ink background, hairline-strong top border, Bone active / Slate inactive, no icons |
| Map screen | ✓ Live data | Resource banner (4 glyphs + live balances) refetches via useFocusEffect. TerritorySheet has state machine: 'info' → 'confirm' (sufficient or insufficient branch) → exit. Gold deducted on accept before walk. Inline Claim red error on failure. |
| Activity screen | ✓ Live data | Daily challenges with live XP + resource earning (calcResourceEarn()). Challenge XP fixed: easy 50, medium 150, hard 400. |
| Profile screen | ✓ Live data | Live Influence/day (calcDailyInfluence() summed across owned territories). Live Territory Power (calcTerritoryPower()). My Resources ghost button → WalletScreen. |
| Alliance screen | ✓ Branded | Join/create flow, roster, collective mission. War Room button now passes allianceId, allianceName, shortName as nav params. |
| War Room screen | ✓ Live data | Live alliance Influence/day. Live war chest Morale only (Iron/Gold/Stone removed — personal wallet, not alliance). All 6 abilities with correct costs. Header wired from nav params. |
| Wallet screen | ✓ New | Live resource fetch on open. 4 resources (Iron, Stone, Gold, Morale) with glyphs + balances. Accessible from Profile. |
| Onboarding screen | ✓ Branded | 5-step flow, typewriter animation on Step 0, numbered rows, Mapbox dark-v11 home pin map, resolvedPlayerId fallback, live username on Step 4 |
| Sign In screen | ✓ Branded | DOMINIA wordmark + ▪ claim mark, Geist Mono uppercase tagline, sharp inputs, Claim red button |
| Username screen | ✓ Branded | Sharp layout, Next button pinned to bottom, 2-char minimum enforced |
| Active Claim screen | ✓ Branded | Claim red ring (butt cap), sharp cards, Geist Mono labels, INK background, DEV_MODE=true |
| Claim Success screen | ✓ Branded | Solid Claim red square, "TERRITORY / is yours." typographic treatment, sharp cards |
| Contest Result screen | ✓ Branded | 4 states, animated solid/outline square per outcome, consequence line block, two-button CTA stack |
| Create Alliance screen | ✓ Branded | 3-step founding flow (identity → HQ territory → confirm). Archivo 900 titles, live [CODE] preview, hairline territory list, summary block, Claim two-line CTA. |
| Alliance Joined screen | ✓ Branded | Alliance green accent bar, Archivo 900 alliance name, [TAG], Italic subtitle, 2-col meta grid, 5 numbered benefit rows, Claim CTA. |
| AuthGate | ✓ Done | Checks isSignedIn + has_onboarded, routes to Onboarding or MainTabs |
| Permissions | ~ Partial | Requested inline in onboarding step 2 — not a standalone screen |
| Defender flow | ○ Deferred | Needs Ably real-time layer — revisit when backend is started. |

---

## KEY FILES

| File | Purpose |
|---|---|
| `App.js` | Root stack navigator, font loading (useFonts + SplashScreen guard), ClerkProvider, all screen registrations |
| `components/AuthGate.js` | Checks isSignedIn + has_onboarded, routes to Onboarding or MainTabs |
| `components/ResourceGlyphs.js` | 6 SVG glyph components: Stone, Iron, Gold, Shield, Morale, Influence — rendered at 28px in war chest |
| `components/ProgressBar.js` | 5 horizontal segments (28×2px), 0px radius, Bone active / HAIRLINE_STRONG inactive — used in onboarding |
| `components/PrimaryButton.js` | Claim red, 0px radius, two-line format (step label above, action label below), Geist Mono |
| `components/SectionLabel.js` | Geist Mono 9px uppercase + hairline rule extending right |
| `components/NumberedRow.js` | Geist Mono number column + Inter title/subtitle, hairline dividers |
| `lib/theme.js` | All Dominia design tokens — colours, fonts, fontSize scale, spacing, radius, borders, motion durations |
| `lib/supabase.js` | Supabase client with **fetch wrapper that forces `Connection: close` header** (CRITICAL — do not remove without re-testing on Android, the dead-pool bug will return). Includes [supabase fetch] timing logs. URL/key hardcoded. |
| `lib/clerk.js` | ClerkProvider tokenCache with SecureStore |
| `lib/auth.js` | ensurePlayer(clerkUserId, email) — uses maybeSingle() to find or create player row |
| `lib/formulas.js` | **Single source of truth for all game math** (CommonJS). XP thresholds, level titles, territory cap, Influence calc, contest walk distance, alliance missions, power, legacy rank. Includes TIER_NORMALISER + normaliseTier(), CLAIM_GOLD_REWARD, CLAIM_GOLD_COST, calcResourceEarn() (incl. contest_win). Aligned to v6.10. |
| `lib/streak.js` | updateStreakOnChallengeComplete — Supabase I/O for streak update on challenge complete |
| `lib/territory.js` | Display helpers only: developmentName(), legacyRankName(), streakTierName(), streakReductionPercent(). Numeric calc functions removed (moved to formulas.js). |
| `metro.config.js` | react-dom shim to fix @clerk/clerk-react bundling |
| `shims/react-dom-shim.js` | Empty module.exports shim |
| `screens/MapScreen.js` | Resource banner refetches via useFocusEffect (named `fetchResourceBanner` useCallback). Dark-v11 Mapbox. TerritorySheet state machine (info/confirm) handles Slice D Gold deduction on accept. Tier normalisers migrated to F.normaliseTier(). |
| `screens/ActivityScreen.js` | Daily challenges with live XP + resource earning (calcResourceEarn()). Parallel Supabase queries. Challenge XP: easy 50, medium 150, hard 400. |
| `screens/ProfileScreen.js` | Live Influence/day (calcDailyInfluence()). Live Territory Power (calcTerritoryPower()). My Resources ghost button → WalletScreen. XP via formulas.js. |
| `screens/AllianceScreen.js` | Join/create flow, roster, mission. War Room button passes allianceId, allianceName, shortName as nav params. |
| `screens/WarRoomScreen.js` | Live alliance Influence/day. Live war chest Morale only. All 6 abilities with correct costs. Header wired from nav params. |
| `screens/WalletScreen.js` | **New.** Live resource fetch on mount. 4 resources (Iron, Stone, Gold, Morale) with glyphs + balances. |
| `screens/SignInScreen.js` | Fully branded. DOMINIA wordmark + ▪ claim mark, Geist Mono tagline, sharp inputs + Claim button. |
| `screens/UsernameScreen.js` | Fully branded. Sharp layout, Next pinned to bottom, 2-char minimum. |
| `screens/OnboardingScreen.js` | Fully branded. 5-step flow, typewriter animation, numbered rows, Mapbox dark-v11 map, resolvedPlayerId fallback, live username |
| `screens/ActiveClaimScreen.js` | Fully branded. Claim red ring (butt cap), sharp cards, Geist Mono labels. DEV_MODE=true — flip to false for real GPS. |
| `screens/ClaimSuccessScreen.js` | Solid Claim red square, typographic treatment. Writes owner_id + alliance_id. Slice A: writes Gold reward to players.gold using F.CLAIM_GOLD_REWARD[tier], shows "+X GOLD EARNED" beat. ⚠️ **Has unresolved reward-not-landing-in-DB bug.** |
| `screens/ContestResultScreen.js` | 4 states, animated square, consequence block, two-button CTA. Slice B: writes contest win resource earn on attack_won via F.calcResourceEarn('contest_win') = {iron:15, gold:25, morale:8}. |
| `screens/CreateAllianceScreen.js` | Fully branded. 3-step founding flow. HQ picked from player-owned territories (Home District mechanic deferred). |
| `screens/AllianceJoinedScreen.js` | Fully branded. Alliance green accent bar, Archivo 900 name, [TAG], italic subtitle, 2-col meta grid, 5 numbered benefit rows. |
| `dominia_mechanics_v6_10.md` | Game design doc — formulas.js aligned to this version |
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

# Force-stop app on phone (required after lib/supabase.js changes — fully resets client singleton)
# Long-press app icon → App info → Force stop

# Diagnose "is the server slow or the phone slow" — run from PowerShell:
$headers = @{ "apikey"="<key>"; "Authorization"="Bearer <key>" }
Measure-Command { Invoke-RestMethod -Uri "<full-url>" -Headers $headers }
# If fast on PC + slow on phone → it's the dead-connection-pool bug.

# Save to GitHub
git add .
git commit -m "message"
git push
```

**EAS build budget:** 30/month. ~13 Android used, ~17 remaining. Only build for new native modules. Batch all native installs into one build — never build for a single package.

**Native module rule:** New native modules need an EAS build + APK reinstall. JS-only packages just need a Metro restart.

---

## KNOWN PITFALLS — RECOGNISE & RESPOND

These are bugs that have already cost significant debugging time. Learn the signatures.

**1. Dead TCP connection pool hang (Android, RN fetch / OkHttp)**
- **Signature:** Logs show `[supabase fetch] ERR ... after 1500000 ms — Network request failed` followed by an immediate retry that succeeds in ~1s. Backgrounding/foregrounding the app makes the screen suddenly load. First fetches in session are fast, fetches after idle are slow. Same query is fast from PowerShell on PC but slow from phone.
- **Cause:** OkHttp caches dead TCP connections in its pool. After app sits idle ~30s, intermediaries (router NAT, carrier) silently kill the connections. OkHttp tries to reuse corpse connections and hangs until RN's ~25-min internal timeout.
- **Fix:** Force `Connection: close` header on every Supabase request. Already implemented in `lib/supabase.js` fetch wrapper. **Do not remove the wrapper or the header without re-testing on Android.**

**2. RLS auth.uid() stall with Clerk projects**
- **Signature:** Profile/Alliance slow but Map fast. Disabling RLS on `players` collapses load times by ~7x.
- **Cause:** RLS policies referencing `auth.uid()` stall because project uses Clerk (not Supabase Auth) — `auth.uid()` returns null and the policy evaluator hangs.
- **Fix:** RLS currently DISABLED on `players`. Permanent fix: implement Clerk-JWT-based RLS before production.

**3. Headers spread silently drops apikey**
- **Signature:** 401 "No apikey" errors after wrapping fetch.
- **Cause:** Spreading a `Headers` object into a plain object literal (`{...init.headers}`) gives an empty object — `Headers` instances don't spread.
- **Fix:** Detect `Headers` via `typeof incoming.forEach === 'function'` and copy entries with `.forEach`. See `loggingFetch` in `lib/supabase.js`.

**4. Hooks order violation after early return (recurring pattern)**
- **Signature:** "Rendered more hooks than during the previous render" error.
- **Cause:** Adding a new `useEffect` / `useCallback` / `useState` *below* an early return like `if (!territory) return null`. On renders where the early return fires, the hook count is lower than on renders where it doesn't — React detects the mismatch and crashes.
- **Fix:** All hooks must be declared above any conditional early returns. Same family as the `useFonts()` decision in MapScreen — fonts loaded at App.js level so screens with early returns don't add useFonts(). When adding hooks to a component with early returns, scan for the early return first.

**Debugging playbook — when something is slow or broken:**
1. **PowerShell-from-PC test** — if fast on PC + slow on phone, it's the dead-pool bug or a client-side issue
2. **Fetch wrapper logs** — `[supabase fetch]` timing tells you whether the network call itself is slow
3. **EXPLAIN ANALYZE in SQL editor** — tells you if the database query is slow
4. **Force-stop the app** after `lib/supabase.js` changes — long-press app icon → App info → Force stop. Required to fully reset the client singleton.
5. **Get evidence before theorising.**

---

## OPEN BUGS

| Bug | Detail |
|---|---|
| **⚠️ CRITICAL — Gold reward not landing in DB after claim** | ClaimSuccessScreen writes Gold reward but DB only reflects post-deduction value. Wallet shows post-deduction-only number. Local setGoldEarned(10) fires, no console errors. **Diagnostic NOT YET RUN:** while on ClaimSuccess (before Back to Map), query `SELECT gold FROM players WHERE username='nish_s'` to confirm whether reward write committed (50=yes, 40=no, 30=duplicate deduction firing). **Get evidence FIRST in next session before changing any code.** |
| RLS missing on players table | Disabled to fix slow load. Needs proper Clerk-JWT-based RLS before production launch. |
| Diagnostic logs in code | `[Profile]`, `[Alliance]`, `[supabase fetch]` console.logs left in. Strip once app has been stable for a few sessions. |
| Client Trust disabled in Clerk | Disabled during dev. Needs proper 2FA or email OTP re-enabled before production. |
| Clerk email verification disabled | Disabled for dev. Must re-enable before production. |
| Real step tracking broken | `Pedometer.getStepCountAsync()` unsupported on Android. Health Connect removed — native crash. Steps hardcoded to 0. DEV_MODE=true on ActiveClaimScreen. |
| Defender flow deferred | Needs Ably real-time layer — not worth building a throwaway version. |
| Onboarding home pin verification not implemented | 500m proximity check deferred — home pin saves lat/lng but no verification step. |
| Auth flow order wrong | New users hit sign-up before seeing any game content (Steps 0+1). Fix deferred. |
| War Room ACTIVATE buttons not wired | Role gating for Founder/Marshal not built. Morale deduction on activate not wired. |
| Achievements table hardcoded | Distance, Calories, Active Minutes need HealthKit/Health Connect before real data possible. |
| Legacy Titles on Profile hardcoded | Needs Supabase wiring once real title data exists. |
| ProfileScreen colour constants not on theme tokens | Still uses local hex constants (CLAIM, INK, INK2 etc) — needs refactor to lib/theme.js. |
| TERRITORY_CAP_BY_LEVEL duplicated | Inlined in MapScreen.js and ProfileScreen.js — should move to formulas.js as calcTerritoryCapForLevel(). |
| formulas.js has no unit tests | High priority before backend phase. |
| player_number hardcoded as #0004 | Sequential player_number column in Supabase not yet added. |
| Territory sheet history data hardcoded | Held for X days (14), changed hands (6), Hall of Holders (12) — no history table in DB yet. |
| Legacy Rank auto-calc not built | legacy_rank column added to territories (default R1). Auto-calc needs territory_history table (Phase 4). |
| Phase 3 incomplete | Slice D done (claim Gold deduction). Still to do: Slice E (Iron deduction on contest initiation). Then Phase 3 closes. |
| Draggable bottom sheet deferred | More/Less toggle is a workaround — gorhom/bottom-sheet deferred until can batch into EAS build. |
| Home District mechanic incomplete | CreateAlliance HQ picker shows player-owned territories only. Spec: 5 nearest OSM territories. Deferred. |
| Invite non-player flow missing | No share/invite link flow exists yet. Needs building before launch. |

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

**MVP SCREENS BRANDED ✓ | GAME MATH ENGINE COMPLETE ✓ | RESOURCE SCHEMA LIVE ✓ | SLOW-LOAD CRISIS RESOLVED ✓**

**Immediate (next session — strict order):**
1. **Get evidence on the Gold reward bug.** Run `SELECT gold FROM players WHERE username='nish_s'` on ClaimSuccess screen BEFORE tapping Back to Map, with a clean known starting Gold value. Single SELECT tells us whether reward write is failing silently, never firing, or being overwritten by duplicate deduction. **Do not theorise across hypotheses again.**
2. Once root cause confirmed, write a fix prompt.
3. Complete Slice D testing (insufficient balance branch, cancel, network failure simulation).
4. Move to Slice E: Iron deduction on contest initiation in TerritorySheet — same state machine pattern, contest button instead of claim, Iron not Gold.

**Formula Build Phases:**
- Phase 1 ✓ — XP, level, streak, contest distance, challenge XP
- Phase 2 ✓ — Influence/day + Territory Power on Profile
- Phase 3 (in progress):
  - Slice A ✓ — Gold reward on claim (✓ written, ⚠️ DB landing bug)
  - Slice B ✓ — Contest win resource earn (attack_won)
  - Slice C ✓ — Resource banner refetch on focus
  - Slice D ✓ — Claim affordability gate + Gold deduction on accept
  - Slice E ○ — Iron deduction on contest initiation (next)
- Phase 4 — Territory history + Legacy Rank auto-calc (needs territory_history table)
- Phase 5 — Backend: Activity Power + Total Power + Alliance Power (needs activity_log + cron)

**Other backlog:**
- Implement Clerk-JWT-based RLS on players table (before production)
- Strip diagnostic console.logs once stable
- Move TERRITORY_CAP_BY_LEVEL into formulas.js
- Write unit tests for formulas.js
- Refactor static-table earn to calcCanonicalEarn once Supply Line + streak resource bonus globally wired
- Wire War Room ACTIVATE buttons (role gating + Morale deduction)
- Build calcFastestEarnPath() for dynamic insufficient-balance recommendations
- Refactor ProfileScreen colour constants to lib/theme.js
- Fix auth flow order
- Add territory history table
- Real step tracking — try expo-sensors Pedometer.watchStepCount()
- Draggable bottom sheet — batch into EAS build
- Invite non-player flow
- Home District mechanic
- Onboarding home pin 500m verification
- Backend phase (Fastify, PostGIS, BullMQ, Ably, FCM)
- Defender flow — revisit once Ably is built

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
| Cards used selectively in branded screens | Only status/action elements get INK2 box. Roster, contributors, territory rows sit openly on INK with hairline dividers — avoids monotony |
| Four tabs kept (not three) | Brand brief's "three tabs" was an early spec — didn't match what was built |
| War Room as separate screen from Alliance | Alliance = identity and people. War Room = strategy and action |
| Enter War Room button is a ghost button | Transparent background, Claim border. Claim solid fill reserved for primary join/confirm actions only |
| Legacy Titles section hardcoded in Profile | Makes player feel they are on a journey — real data wiring deferred |
| player_number hardcoded as #0001 | player_number auto-increment column in Supabase deferred |
| COMMANDER header frozen (doesn't scroll) | Identity element should always be visible — not part of scrollable content |
| Influence placed as hero block (Profile + War Room) | It is the empire resource — deserves highest prominence below the header |
| Influence context line differs per screen | "From 8 held territories" (personal) vs "Earned daily from alliance-held territories" (collective) |
| War chest Morale given full-width row | Command resource that powers all 4 morale abilities directly below it |
| Claim red NOT used for Influence readout | Claim locked to territories/CTAs/contests per brand brief |
| Today bar in weekly chart uses Bone not Claim | Claim is locked to territory/CTA signal — bar chart is performance data |
| Achievements section has no card background | Rows sit directly on Ink — achievementsCard style kept in StyleSheet for reuse elsewhere |
| Stats pills removed from Activity screen | Streak already in header, XP is lifetime not activity metric, Territories belongs on Profile |
| Achievements table uses fake data | Distance/Calories/Active Minutes need HealthKit/Health Connect — deferred |
| Claim square removed from step headings | Inline nested Text wraps unpredictably on real device widths — square on wordmark and CTA button is sufficient |
| Bone pin with Claim centre for home pin map | Dark-v11 map makes Bone readable; Claim outer was used before dark map was added |
| Pure RN teardrop pin instead of SVG | react-native-svg not installed for this shape — avoids EAS build |
| Map style dark-v11 via styleURL directly | lightPreset prop not reliable across rnmapbox versions |
| resolvedPlayerId fallback pattern | If playerId missing from nav params, fetch from Supabase using clerkUserId — prevents session error when nav param is dropped |
| Auth flow order deferred | New users should see Steps 0+1 before sign-up — fix after branding complete |
| has_onboarded reset via Supabase SQL | No DEV_SKIP_INTRO flag needed — direct SQL simpler for dev testing |
| Handle one screen or one fix at a time | Never batch unrelated changes — added to working style |
| ▪ claim mark sized at fontSize 9 at 32px wordmark | 20% of cap-height per brand brief, one character-space gap from A |
| useFonts() must NOT be added to MapScreen or ActiveClaimScreen | Hooks order violation because of early returns — fonts already loaded by App.js |
| Territory sheet top border = state colour at 1px | 1px not 2px — brand hairline rule |
| Influence per day defaults to legacyRank=1 | Placeholder until legacy_rank column added to DB |
| Abandon handler needs .select() after null write | Without .select(), Supabase silently ignores null value writes for alliance_id |
| Solid Claim red square for success/milestone moments | No tick, no illustration — typographic hierarchy principle per brand brief |
| ContestResultScreen built from brand director mockup | Not derived from existing functional code — clean rebuild |
| More/Less toggle kept on territory sheet | Draggable bottom sheet (gorhom) deferred — would require EAS build, applies across multiple screens |
| Cancel button on ActiveClaimScreen uses Slate2 not Claim | Claim reserved for territory/CTA signal only |
| "Found" → "Create" for alliance creation | "found" reads as past tense of "find" on quick scan |
| Claim red NOT used in non-member alliance list | Monochrome kept — no decorative use of Claim |
| "Find an alliance" CTA removed | The list IS the discovery surface — button was redundant |
| Create alliance demoted to small footer link | Joining existing alliances is the priority path |
| confirmAlliance state lifted to AllianceScreen level | Needed so screen-level header could conditionally hide when confirm view is active |
| Alliance Joined benefit list: 5 items (not 4) | Alliance missions is a real shipped feature — kept in |
| Alliance Joined: emoji removed entirely | Brand brief: no emoji in any product copy |
| Alliance Joined: benefit cards removed | Hairline-divided numbered rows replace card walls |
| Alliance Joined: Recruit copy changed to invite by username | Players have no short name — invite-by-short-name was incorrect |
| Bounded scroll list (maxHeight 320) for alliance list | Keeps header + footer always visible — better for discovery when list grows |
| formulas.js stays CommonJS (module.exports) | Works in both React Native and the future Fastify backend with no changes |
| lib/streak.js kept separate from formulas.js | streak.js does Supabase I/O — not pure math, no overlap with formulas.js |
| Tier casing handled at call site (normaliser) | DB stays lowercase (check constraint enforces it), formulas.js stays strict title-case — normaliser at MapScreen call sites |
| Adopted v6.10 XP thresholds over lib/level.js values | Level 2 is now 600 XP (was 150 XP). Test users may show a lower level — expected. |
| Parallelised Supabase queries with Promise.all | Sequential queries were causing multi-minute load times. Promise.all + DB indexes fixed it. |
| Single .in() query for alliance list | Replaced N-query loop — one query for all members of listed alliances |
| Influence on Profile shows daily earn RATE not balance | Balance needs influence_balance column + backend cron (Phase 4/5) |
| Territory Power gets its own block below stat grid | It's the defining metric — deserves more prominence than a stat pill |
| War chest holds Morale only | Iron/Gold/Stone are personal wallet resources, not alliance collective |
| WalletScreen fetches live from DB on every open | Avoids stale nav param problem — fast enough since DB is warm during session |
| Resource banner uses document flow not absolute | Mapbox zoom control sits below it naturally, no overlap |
| Legacy Rank defaulted to R1 for all territories | Auto-calculation needs territory_history table — deferred to Phase 4 |
| Force `Connection: close` on every Supabase fetch | Adds ~20-50ms TLS handshake overhead but eliminates dead-pool hang. Invisible at dev scale. Revisit at production scale. |
| Keep AsyncStorage and persistSession ON in supabase client | Removing them broke MapScreen territory rendering during diagnosis |
| Keep timing logs in code for now | `[Profile]`, `[Alliance]`, `[supabase fetch]` — strip once app has been stable for several sessions |
| RLS disabled on players table (temporary) | Old policies referenced `auth.uid()` but project uses Clerk — caused 19-min hangs. Must implement Clerk-JWT-based RLS before production. |
| TIER_NORMALISER lives in formulas.js (not lib/territory.js) | formulas.js is the strict title-case island and owns the conversion contract — ports unchanged to future Fastify backend |
| Static-table earn (not calcCanonicalEarn) | Match Slice A pattern. Refactor to canonical when Supply Line + streak resource bonus globally wired. |
| Slice D affordability check uses cached myPlayer.gold | Performance — fresh read happens at deduction itself |
| TerritorySheet state machine inline | No new modal component, no gorhom — keeps complexity contained |
| Deduct on accept (before walk), not on success | Player explicitly consents to spend at moment of friction. Matches "Iron is what you spent, not a hidden tax" philosophy. |
| Claim red used for inline error message | Operational signal, not decoration — "this action failed, retry it" |
| Insufficient-balance copy generic for now | Defer dynamic recommendation per v6.10 §5.1 until challenge rotation pool ships and calcFastestEarnPath() is built |
| "Confirm" state label reuses existing sheetStateLabel style | Same slot, different content — no new style needed |

---

## WORKING STYLE — ALWAYS FOLLOW THIS

Do not start coding immediately. Work conversationally:
- Explain what each screen or feature does before building it
- Show a wireframe or mockup when introducing a new screen
- Ask for confirmation before writing any code
- Wait for the user to say "yes" or "let's build it" before touching any files
- Once confirmed, provide the exact prompt to paste into Cursor's agent chat as a single copyable code block
- After Cursor builds it, wait for the user to check their phone and report back
- Give the user time to ask questions at every step
- Handle one screen or one fix at a time — never batch unrelated changes
- **When debugging: get evidence before theorising.** PowerShell-from-PC test, fetch wrapper logs, and EXPLAIN ANALYZE in SQL editor are the three fastest diagnostics for "is it server, client, or network".
