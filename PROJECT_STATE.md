# DOMINIA — MASTER PROJECT STATE
Last updated: May 6, 2026 (Mapbox Standard night basemap + state-aware territory opacity)

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
| Test runner | Jest 30 (plain `testEnvironment: node`, NOT jest-expo preset) | ✓ 348 tests passing |
| Backend (future) | Node.js + Fastify + PostGIS | Not started |
| Real-time (future) | Ably | Not started |
| Push (future) | Firebase Cloud Messaging | Not started |

---

## IMPORTANT KEYS & IDS

| nish_s player ID | 94a9036e-1d59-49ae-9b5f-eae064913fbf |
| nish_s clerk_id | user_3CRjZoj8XaCoFwuAayVcgA2RPaP |
| nish_s territories | Museumplein, Oosterpark, Vondelpark, Leidseplein, Jordaan |
| Rubik player ID | 788e9834 — KAI alliance, holds Sarphatipark |
| boo player ID | 53a0186a — GGG alliance |
| Phantom | alliance id 80caca88-85ba-4830-9b63-1c4fc8d8372c, holds Oud-West |
| Kainetic Allied [KAI] | id=6bc19cb1-97ce-4f76-95fa-b645606c2b47 |
| Unclaimed territories | Rembrandtplein, Plantage |

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

`players`: id, username, level, xp, home_city, alliance_id, created_at, clerk_id, has_onboarded, home_pin_lat, home_pin_lng, current_streak, longest_streak, last_active_date, iron, stone, gold, morale, lifetime_contest_wins, lifetime_defence_wins

`territories`: id, territory_name, tier, perimeter_distance, owner_id, alliance_id, development_level, longitude, latitude, created_at, legacy_rank, upkeep_overdue, osm_id (bigint), osm_type (text), geojson (jsonb)

`alliances`: id, name, short_name, city, created_at, founder_id, morale

`player_challenges`: id, player_id, challenge_key, completed_at, date — UNIQUE constraint on (player_id, challenge_key, date)

`territory_history`: id, territory_id, owner_id, alliance_id (nullable), claimed_at, lost_at (nullable = currently held), backfilled (boolean), created_at

**Test data:**
- 10 territories (Amsterdam, **real OSM polygon shapes** via `geojson` column, all unclaimed unless noted):
  - Vondelpark (large, 3200m) · Leidseplein (small, 450m) · Jordaan (medium, 1800m) · Museumplein (medium, 1200m) · Sarphatipark (small, 600m)
  - Rembrandtplein · Oosterpark · Westerpark · Plantage · Oud-West (all unclaimed)
- Active alliances: Kainetic Allied [KAI] id=6bc19cb1-97ce-4f76-95fa-b645606c2b47 · Gritty Greeks [GGG]
- Test players: nish_s (94a9036e, KAI) · Rubik (788e9834, KAI) · boo (53a0186a, GGG)
- Territory tier values must be **lowercase** in DB (small/medium/large) — check constraint enforces this

**Indexes added:**
- `idx_territories_owner_id` ON territories(owner_id)
- `idx_territories_alliance_id` ON territories(alliance_id)
- `idx_players_clerk_id` ON players(clerk_id)
- `idx_players_alliance_id` ON players(alliance_id)
- `idx_territory_history_territory_id` ON territory_history(territory_id)
- `idx_territory_history_owner_id` ON territory_history(owner_id)
- `idx_territory_history_current_holder` partial index ON territory_history(territory_id) WHERE lost_at IS NULL

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
-- Set/add resource balance
UPDATE players SET iron = X WHERE username = 'nish_s';
UPDATE players SET iron = iron + 50 WHERE username = 'nish_s';
-- Inspect territory history
SELECT t.territory_name, p.username, th.claimed_at, th.lost_at, th.backfilled
FROM territory_history th
JOIN territories t ON t.id = th.territory_id
JOIN players p ON p.id = th.owner_id
WHERE t.territory_name = 'X'
ORDER BY th.claimed_at ASC;
```

**RPCs (server-side, atomic):**
- `deduct_alliance_morale(alliance_id, amount)` — guards `morale >= amount`, prevents negatives. Used by War Room ACTIVATE buttons.
- `donate_morale(player_id, alliance_id, amount)` — atomic transaction: deducts `players.morale` and credits `alliances.morale` in single call. Used by Wallet donate flow.

---

## SCREENS — STATUS

| Screen | Status | Notes |
|---|---|---|
| Navigation (4 bottom tabs) | ✓ Branded | Geist Mono, uppercase, Ink background, hairline-strong top border, Bone active / Slate inactive, no icons |
| Map screen | ✓ Live data | **Real OSM polygon shapes for all 10 territories** via `t.geojson` (rectangle fallback retained). Resource banner refetches via useFocusEffect. TerritorySheet state machine (info/confirm) with contestMode branch. Gold deducted on claim accept, Iron deducted on contest accept. Live Legacy Rank, Held days, Changed hands, Hall of Holders all wired from territory_history. All suppressed on unclaimed via shared !isUnclaimed wrapper. |
| Activity screen | ✓ Live data | Daily challenges with live XP + resource earning (calcResourceEarn()). Challenge XP fixed: easy 50, medium 150, hard 400. |
| Profile screen | ✓ Live data | POWER section above Influence (Power is §10 canonical metric, Influence demoted to resource). Total Power hero + 3 breakdown rows: Activity (inactive — em-dash + "Step tracking required"), Territory (live, calcTerritoryPower), Legacy (live, calcLegacyPower with lifetime_contest_wins + longest_streak inputs, reason "X contest wins · best streak Y days"). Hairline-divided rows. Live Influence/day below. My Resources ghost button → WalletScreen. |
| Alliance screen | ✓ Branded | Join/create flow, roster, collective mission. War Room button now passes allianceId, allianceName, shortName as nav params. |
| War Room screen | ✓ Live data | Live alliance Influence/day. Live war chest Morale only (Iron/Gold/Stone removed — personal wallet, not alliance). All 6 abilities with correct costs. Header wired from nav params. **ACTIVATE buttons wired (Founder only)** — role derived from `alliances.founder_id` (zero migration), confirmation alert, Morale deducted via `deduct_alliance_morale` RPC (server-side guard). |
| Wallet screen | ✓ Live data | Live resource fetch on open. 4 resources (Iron, Stone, Gold, Morale) with glyphs + balances. Accessible from Profile. **Morale row shows "DONATE →" hint** — tap opens bottom modal sheet (custom amount input + DONATE ALL button), atomic via `donate_morale` RPC. **← PROFILE back button** (Claim red, matches War Room pattern). |
| Onboarding screen | ✓ Branded | 5-step flow, typewriter animation on Step 0, numbered rows, Mapbox dark-v11 home pin map, resolvedPlayerId fallback, live username on Step 4 |
| Sign In screen | ✓ Branded | DOMINIA wordmark + ▪ claim mark, Geist Mono uppercase tagline, sharp inputs, Claim red button |
| Username screen | ✓ Branded | Sharp layout, Next button pinned to bottom, 2-char minimum enforced |
| Active Claim screen | ✓ Branded | Claim red ring (butt cap), sharp cards, Geist Mono labels, INK background, DEV_MODE=true |
| Claim Success screen | ✓ Live data | Solid Claim red square, typographic treatment. Writes owner_id + alliance_id, inserts territory_history row, atomic write of Gold reward + Siege XP via single .update().select() (calcClaimXp by tier). Tier fetched via .select('tier').single(). |
| Contest Result screen | ✓ Live data | 4 states, animated square, consequence block. attack_won: closes out previous holder's territory_history row, updates territories, inserts new history row (correct order), atomic write of iron/gold/morale + Siege XP (calcContestWinXp by tier) + lifetime_contest_wins increment via single .update().select(). SIEGE XP shown first in earned beat line. |
| Create Alliance screen | ✓ Branded | 3-step founding flow (identity → HQ territory → confirm). Archivo 900 titles, live [CODE] preview, hairline territory list, summary block, Claim two-line CTA. |
| Alliance Joined screen | ✓ Branded | Alliance green accent bar, Archivo 900 alliance name, [TAG], Italic subtitle, 2-col meta grid, 5 numbered benefit rows, Claim CTA. |
| AuthGate | ✓ Done | Checks isSignedIn + has_onboarded, routes to Onboarding or MainTabs |
| Permissions | ~ Partial | Requested inline in onboarding step 2 — not a standalone screen |
| Defender flow | ○ Deferred | Needs Ably real-time layer — revisit when backend is started. |
| Abandon flow | ○ Not built | Currently just an alert. When built, must UPDATE player's open territory_history row to set lost_at = now(). Same close-out pattern as contest, no follow-up insert. |

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
| `lib/formulas.js` | **Single source of truth for all game math** (CommonJS, ~1500 lines, ~50+ exports). XP thresholds, level titles, territory cap, Influence calc, contest walk distance, alliance missions, power, legacy rank, TIER_NORMALISER + normaliseTier(), CLAIM_GOLD_REWARD, CLAIM_GOLD_COST, CONTEST_IRON_COST, calcResourceEarn(). Siege XP layer: XP_PER_CLAIM, XP_PER_CONTEST_WIN, XP_PER_DEFENCE_WIN, XP_RECONQUEST, XP_PER_DEV_TIER_REACHED, XP_ALLIANCE_MISSION, XP_STREAK_MILESTONE constants + calcClaimXp(tier), calcContestWinXp(tier), calcDefenceWinXp(tier) helpers. Aligned to v6.10. **FULLY UNIT TESTED — 348 tests, all passing.** |
| `lib/__tests__/formulas.test.js` | 348 Jest tests covering all of formulas.js. Includes Siege XP coverage: all 4 tiers for each of calcClaimXp/calcContestWinXp/calcDefenceWinXp, invalid tier rejection, frozen constants check. Run with `npm test`. Must stay green before any commit touching formulas.js. |
| `lib/streak.js` | updateStreakOnChallengeComplete — Supabase I/O for streak update on challenge complete. **No tests yet.** |
| `lib/territory.js` | Display helpers (developmentName, legacyRankName, streakTierName, streakReductionPercent) + getLegacyRankForTerritory(territoryId) + getTerritoryHistoryStats(territoryId). **No tests yet.** |
| `metro.config.js` | react-dom shim to fix @clerk/clerk-react bundling |
| `shims/react-dom-shim.js` | Empty module.exports shim |
| `screens/MapScreen.js` | Renders real OSM polygon shapes via `t.geojson ?? rectangle fallback` (safe for territories without geojson yet). Resource banner refetches via useFocusEffect. TerritorySheet state machine (info/confirm) with contestMode branch. Gold deducted on claim accept (Slice D), Iron deducted on contest accept (Slice E). Live Legacy Rank fetched on territory change via getLegacyRankForTerritory(). |
| `screens/ActivityScreen.js` | Daily challenges with live XP + resource earning (calcResourceEarn()). Parallel Supabase queries. Challenge XP: easy 50, medium 150, hard 400. |
| `screens/ProfileScreen.js` | POWER section above Influence (Total Power hero + 3 rows: Activity inactive / Territory live / Legacy live). Fetches lifetime_contest_wins + lifetime_defence_wins. calcLegacyPower called with real inputs (titlesEarned + championshipWins still hardcoded to 0). Live Influence/day (calcDailyInfluence()). My Resources ghost button → WalletScreen. XP via formulas.js. |
| `screens/AllianceScreen.js` | Join/create flow, roster, mission. War Room button passes allianceId, allianceName, shortName as nav params. |
| `screens/WarRoomScreen.js` | Live alliance Influence/day. Live war chest Morale only. All 6 abilities with correct costs. Header wired from nav params. ACTIVATE buttons wired (Founder only) — role derived from `alliances.founder_id`, confirmation alert, Morale deducted via `deduct_alliance_morale` RPC. |
| `screens/WalletScreen.js` | Live resource fetch on mount. 4 resources (Iron, Stone, Gold, Morale) with glyphs + balances. Morale row → bottom modal sheet (custom amount + DONATE ALL) → `donate_morale` RPC. ← PROFILE back button (Claim red). |
| `screens/SignInScreen.js` | Fully branded. DOMINIA wordmark + ▪ claim mark, Geist Mono tagline, sharp inputs + Claim button. |
| `screens/UsernameScreen.js` | Fully branded. Sharp layout, Next pinned to bottom, 2-char minimum. |
| `screens/OnboardingScreen.js` | Fully branded. 5-step flow, typewriter animation, numbered rows, Mapbox dark-v11 map, resolvedPlayerId fallback, live username |
| `screens/ActiveClaimScreen.js` | Fully branded. Claim red ring (butt cap), sharp cards, Geist Mono labels. DEV_MODE=true — flip to false for real GPS. |
| `screens/ClaimSuccessScreen.js` | Writes owner_id + alliance_id to territories. Inserts territory_history row. Atomic write of Gold reward (F.CLAIM_GOLD_REWARD[tier]) + Siege XP (calcClaimXp(tier)) via single .update().select(). Tier fetched from territories.update().select('tier').single(). |
| `screens/ContestResultScreen.js` | 4 states, animated square, consequence block. attack_won: close-out UPDATE (lost_at = now()) → territories UPDATE (with .select('tier').single()) → INSERT new row → atomic player UPDATE writing iron/gold/morale + Siege XP (calcContestWinXp(tier)) + lifetime_contest_wins increment in single .update().select(). Order is critical — preserves single-open-row invariant. SIEGE XP shown first in earned beat line. |
| `screens/CreateAllianceScreen.js` | Fully branded. 3-step founding flow. HQ picked from player-owned territories (Home District mechanic deferred). |
| `screens/AllianceJoinedScreen.js` | Fully branded. Alliance green accent bar, Archivo 900 name, [TAG], italic subtitle, 2-col meta grid, 5 numbered benefit rows. |
| `fetch-osm-polygons.js` | **Standalone Node script (lives on Desktop, not in repo).** Reads `osm_id` + `osm_type` from Supabase territories table, fetches real polygon from Overpass API by ID, writes to `geojson` column. Reusable for any future city — add rows with osm_id + osm_type, rerun. Run with `cd Desktop → node fetch-osm-polygons.js`. |
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

# Run unit tests (must stay green before any commit touching formulas.js)
npm test

# Verify project file vs live file (check for drift)
Get-FileHash lib\formulas.js -Algorithm SHA256

# Mirror phone to PC
scrcpy

# Refresh OSM territory polygons (rerun anytime to refresh, or after adding new city rows)
cd Desktop
node fetch-osm-polygons.js

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

**5. Supabase .update() silently no-ops without .select() (recurring pattern — 3 occurrences)**
- **Signature:** Write appears to succeed (no error logged), but DB value unchanged. Affects null writes and reward writes equally.
- **Cause:** Without `.select()`, Supabase `.update()` does not force execution in certain cases and silently no-ops.
- **Fix:** Always chain `.select()` on every `.update()` call. This is now standard practice for all Supabase write operations in this codebase.

**6. Cursor agent proposes shell commands instead of file edits**
- **Signature:** Cursor suggests `node -e "..."` or PowerShell commands to append/modify file content instead of using its file edit tools.
- **Cause:** Cursor defaulting to shell execution path for large file modifications.
- **Fix:** Skip the shell command proposal. Redirect with explicit instruction: "use file tools only, no shell commands." Don't allowlist — shell commands for file edits are always the wrong path.

**7. Stale Metro bundle (JS-only changes don't always hot-reload)**
- **Signature:** Code looks right + tests pass + DB writes partially succeed. New write paths (e.g. XP) silently don't fire while existing write paths (e.g. resources) still do. Render-side UI changes in the same file also don't appear.
- **Cause:** Metro served the previous JS bundle while DB writes from existing code paths still fired. The render side is the diagnostic — if a UI change in the same file doesn't appear, the behaviour change isn't running either.
- **Fix:** Reload Metro before testing JS-only changes (press `r` in Metro terminal, or shake phone → Reload). When the symptom is "code looks right + tests pass + DB writes partially succeed", suspect the bundle on device before suspecting the code.

**8. Overpass API 406 Not Acceptable**
- **Signature:** `node fetch-osm-polygons.js` returns HTTP 406 immediately with no useful body.
- **Cause:** Overpass requires `Content-Type: application/x-www-form-urlencoded` and a `User-Agent` header. Without both, it rejects the request.
- **Fix:** Send both headers explicitly. See `fetch-osm-polygons.js`.

**9. Overpass API 429 rate limiting**
- **Signature:** First few queries succeed, then 429 Too Many Requests.
- **Cause:** Overpass enforces a per-IP slot quota; tight loops trip it within seconds.
- **Fix:** Sleep 8000ms between requests in the script. Slow but reliable for a 10-row backfill.

**10. Supabase write fails with "Invalid path specified"**
- **Signature:** REST writes from external scripts return 400 / "Invalid path specified" while reads work fine elsewhere.
- **Cause:** `SUPABASE_URL` env var has a trailing `/rest/v1/` suffix. The supabase-js client appends its own path and ends up with `/rest/v1/rest/v1/...`.
- **Fix:** `SUPABASE_URL` must be the **base domain only** (e.g. `https://xxx.supabase.co`) — no trailing path.

**11. Node 24 `fetch()` rejects raw string body for form-encoded POST**
- **Signature:** Overpass returns a parser error on a body that worked under older Node versions.
- **Cause:** Node 24's built-in `fetch` is stricter — a raw URL-encoded string body is no longer accepted as form data.
- **Fix:** Wrap in `URLSearchParams`. The runtime sets the body and Content-Length correctly.

**Debugging playbook — when something is slow or broken:**
1. **PowerShell-from-PC test** — if fast on PC + slow on phone, it's the dead-pool bug or a client-side issue
2. **Fetch wrapper logs** — `[supabase fetch]` timing tells you whether the network call itself is slow
3. **EXPLAIN ANALYZE in SQL editor** — tells you if the database query is slow
4. **Render-side check** — does a UI change in the same file appear on device? If not, you're on a stale bundle. Reload Metro (press `r`) before debugging the code.
5. **Force-stop the app** after `lib/supabase.js` changes — long-press app icon → App info → Force stop. Required to fully reset the client singleton.
6. **Get evidence before theorising.**

---

## OPEN BUGS

| Bug | Detail |
|---|---|
| RLS missing on all tables | Disabled to fix slow load. Re-enable with Clerk-JWT-based RLS before production launch. |
| Diagnostic logs in code | `[Profile]`, `[Alliance]`, `[supabase fetch]` console.logs left in. Strip once app has been stable for a few sessions. |
| Client Trust disabled in Clerk | Disabled during dev. Needs proper 2FA or email OTP re-enabled before production. |
| Clerk email verification disabled | Disabled for dev. Must re-enable before production. |
| Real step tracking broken | `Pedometer.getStepCountAsync()` unsupported on Android. Health Connect removed — native crash. Steps hardcoded to 0. DEV_MODE=true on ActiveClaimScreen. |
| Defender flow deferred | Needs Ably real-time layer — not worth building a throwaway version. |
| Abandon flow not built | Must UPDATE open territory_history row (lost_at = now()) when built. Same close-out pattern as contest, no follow-up insert. |
| Onboarding home pin verification not implemented | 500m proximity check deferred — home pin saves lat/lng but no verification step. |
| Auth flow order wrong | New users hit sign-up before seeing any game content (Steps 0+1). Fix deferred. |
| Achievements table hardcoded | Distance, Calories, Active Minutes need HealthKit/Health Connect before real data possible. |
| Marshal role not tracked | Founder is derived from `alliances.founder_id` (zero migration). Marshal needs `players.role` column — deferred until member management flow exists. Marshal currently cannot activate War Room abilities. |
| Legacy Titles on Profile hardcoded | Needs Supabase wiring once real title data exists. |
| ProfileScreen colour constants not on theme tokens | Still uses local hex constants (CLAIM, INK, INK2 etc) — needs refactor to lib/theme.js. |
| TERRITORY_CAP_BY_LEVEL duplicated | Inlined in MapScreen.js and ProfileScreen.js — should move to formulas.js as calcTerritoryCapForLevel(). |
| lib/streak.js has no unit tests | Has Supabase I/O so needs mocking strategy. ~60-min session. |
| lib/territory.js has no unit tests | Has Supabase I/O so needs mocking strategy. ~60-min session. |
| player_number hardcoded as #0001 | Sequential player_number column in Supabase not yet added. |
| Siege XP constants exist with no writers | XP_PER_DEFENCE_WIN (defender flow not built), XP_RECONQUEST (no reconquest mechanic), XP_PER_DEV_TIER_REACHED (no development), XP_ALLIANCE_MISSION (mission rewards), XP_STREAK_MILESTONE (no streak milestone events). Each is a small wiring task as relevant feature comes online. |
| lifetime_defence_wins schema placeholder | Column added but no writer until defender flow ships. |
| Legacy Power inputs partial | titlesEarned + championshipWins hardcoded to 0 on Profile — title system and championship system don't exist yet. |
| Draggable bottom sheet deferred | More/Less toggle is a workaround — gorhom/bottom-sheet deferred until can batch into EAS build. |
| Home District mechanic incomplete | CreateAlliance HQ picker shows player-owned territories only. Spec: 5 nearest OSM territories. Deferred. |
| Invite non-player flow missing | No share/invite link flow exists yet. Needs building before launch. |
| POI icons on Standard night basemap | Museums, hotels, breweries (e.g. Heineken Experience, Hotel Okura, Eye Filmmuseum) still render on Mapbox Standard night basemap despite both `showPointOfInterestLabels` and `showLandmarkIcons` toggles being OFF in Studio and published. Studio publish completes but icons persist on phone. Cause unclear — may be a deeper Studio config issue, a Standard style behaviour we haven't found docs for, or a `@rnmapbox/maps` v10 quirk. Not blocking — territories are the visual signal and read clearly. Revisit in Map Session 3. |

---

## DEFERRED / OUT OF SCOPE

- Real step tracking — Health Connect failed, expo-sensors fallback not yet tried, deferred due to EAS budget
- Defender flow — needs Ably real-time layer, deferred to backend phase
- Alliance disband flow — dropped from backlog, no real gameplay use case
- Alliance chat — post-MVP
- Onboarding home pin 500m verification — deferred
- Backend (Fastify, PostGIS, BullMQ, Ably, FCM) — not started, separate phase

---

## WHAT'S NEXT

**MVP SCREENS BRANDED ✓ | GAME MATH ENGINE COMPLETE ✓ | RESOURCE SCHEMA LIVE ✓ | SLOW-LOAD CRISIS RESOLVED ✓ | PHASE 3 RESOURCE ECONOMY COMPLETE ✓ | PHASE 4 TERRITORY HISTORY + LEGACY RANK COMPLETE ✓ | FORMULAS.JS FULLY UNIT TESTED (348 tests) ✓ | SIEGE XP WIRED ON CLAIM + CONTEST WIN ✓ | POWER SECTION ON PROFILE ✓ | WAR ROOM ACTIVATE WIRED ✓ | MORALE DONATION FLOW LIVE ✓ | REAL OSM POLYGONS FOR ALL 10 TERRITORIES ✓ | MAP HERO SCREEN: BRAND-BRIEF NIGHT BASEMAP + STATE-AWARE TERRITORY OPACITY ✓**

**Immediate — tests for `lib/streak.js`:**
- Agree on Supabase mocking strategy first (manual mock vs jest.mock vs in-memory fake), then write tests.
- `lib/streak.js` does Supabase I/O, so mocking is the gating decision — once chosen, the same pattern applies to `lib/territory.js` next.
- Open the chat and start with: "Tests for lib/streak.js — let's lock the Supabase mocking strategy before writing any tests."

**Phase 5a (queued, was previous immediate):**
- Raw events written to `activity_log` table; recompute Activity Power on read (Option A — no cache).
- Three event-write sites: ClaimSuccessScreen, ContestResultScreen, ActivityScreen.
- `km_amount` column exists from day one but stays NULL until step tracking lands.
- No read-side aggregator yet — nothing to display Activity Power until step tracking solves the km gap.

**Map Session 2 (queued — territory redesign):**
- Curate ~20-30 Amsterdam territories via Overpass Turbo with intent: 12 Small / 10 Medium / 4 Large / 2 Epic.
- Resolve overlaps (current 10 territories were named-by-search and some collide — e.g. Vondelpark / Museumplein boundary).
- Update fetch-osm-polygons.js for the new set; validate non-overlap visually before DB write.
- Currently no Large or Epic in DB — formulas.js validates all four tiers but data is Small/Medium only.

**Map Session 3 (queued — polish, after Session 2):**
- First Claim visual pulse for Level 1-2 players on Smalls (mechanics doc §7.2).
- Tier-aware visual treatment (Epic should feel heavier than Small).
- Level-gate visual states (lock indicator on Large for L1-3, Epic for L1-6).
- Resolve POI icons issue (see Open Bugs).

**Formula Build Phases:**
- Phase 1 ✓ — XP, level, streak, contest distance, challenge XP
- Phase 2 ✓ — Influence/day + Territory Power on Profile
- Phase 3 ✓ — Resource economy: claim/contest earn + deductions, banner refetch
- Phase 4 ✓ — territory_history table + live Legacy Rank + held days + changed hands wired
- Phase 4.5 ✓ — Siege XP wired (claim + contest win), POWER section on Profile, lifetime_contest_wins live
- Phase 4.6 ✓ — War Room ACTIVATE wired (Founder, atomic RPC), Morale donation flow (Wallet modal, atomic RPC), real OSM polygons for all 10 Amsterdam territories
- Phase 5a ○ — activity_log table + 3 event-write sites (no read-side aggregator yet)
- Phase 5b ○ — Backend: Activity Power read-side once step tracking lands + cron for Total/Alliance Power

**Quick wins to pick up any time:**
- Wire remaining Siege XP write sites as features come online (defence win, reconquest, dev tier reached, mission complete, streak milestone)
- Tests for lib/territory.js (~60-min session, same Supabase mocking strategy locked in for streak.js)

**Other backlog:**
- Implement Clerk-JWT-based RLS on all tables (before production)
- Strip diagnostic console.logs once stable
- Move TERRITORY_CAP_BY_LEVEL into formulas.js
- Refactor ProfileScreen colour constants to lib/theme.js
- Fix auth flow order
- `players.role` column migration → wire Marshal role for War Room ACTIVATE (currently Founder-only)
- Real step tracking — try expo-sensors Pedometer.watchStepCount() (blocks Activity Power read-side)
- Draggable bottom sheet — batch into EAS build
- Invite non-player flow
- Home District mechanic
- Onboarding home pin 500m verification
- Backend phase (Fastify, PostGIS, BullMQ, Ably, FCM)
- Defender flow — revisit once Ably is built (will then wire XP_PER_DEFENCE_WIN + lifetime_defence_wins)

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
| Custom Mapbox Studio style "Dominia Night" (`mapbox://styles/nishs/cmot1yv5h006z01sf32a7coow`) | Standard style + brand-brief config overrides applied at style level (night preset, POI off, transit off, place + road labels on, 3D on). V11 + StyleImport deferred — current `@rnmapbox/maps ^10.3.0` is V10, StyleImport requires V11 (would burn 1 EAS build). Studio style is configurable visually + JS-only swap. |
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
| contestMode boolean in TerritorySheet | Branches confirm UI between claim and contest — avoids duplicate confirm screens |
| .select() required on all null-value Supabase writes | Without .select(), Supabase .update() silently no-ops on null writes. Third occurrence (Abandon, alliance_id on claim, Gold reward). Standard practice: always chain .select() on every .update(). |
| Backfilled rows marked with backfilled=true | Honest audit trail — keeps door open to UI logic distinguishing seeded from real holds |
| App-code writes for territory_history (not Postgres triggers) | Easier to debug, matches existing pattern. Can move to triggers in backend phase. |
| Contest write order: close-out → territories → INSERT | Doing close-out first prevents moment where two rows have lost_at = null for same territory, which would break Legacy Rank calc. |
| History writes use console.warn-only error handling | A history bug must never cause a player to lose XP, resources, or ownership. Never throw, never block user flow. |
| Currently-held rows count toward hold duration metrics | Player holding 30 days hits Rank 2 even before losing it — Date.now() as end time for open rows. Mechanics doc supports this. |
| Backfilled open rows excluded from ownershipChanges | Only completed holds (lost_at set) count toward change tally. |
| Plain Jest config (testEnvironment: node), NOT jest-expo preset | formulas.js is pure CommonJS — jest-expo loads full Expo winter-runtime which crashes on non-RN test files. jest-expo left in devDependencies for future component tests; not in active global config. |
| Single test file sectioned with describe blocks | Easier to grep than multiple files — all 348 tests run in one command. |
| No snapshot tests | Decision held — not needed for pure math functions. |
| legacyRankName lookup uses object not array | Array with empty-string at index 0 caused `??` operator to skip fallback (empty string isn't nullish). Object keyed by valid ranks with `||` fallback is correct. |
| When Cursor proposes shell commands for file edits: skip, redirect | Cursor twice proposed `node -e` / PowerShell instead of direct file edits during test session. Skip-then-redirect worked. Added to working style. |
| Project knowledge sync habit established | Re-upload lib/formulas.js (and other core libs) whenever they change meaningfully. SHA256 hash check confirms sync. A 2-version drift caused 10 mins of confusion today. |
| "Confirm" state label reuses existing sheetStateLabel style | Same slot, different content — no new style needed |
| POWER section sits above Influence on Profile | Power is the §10 canonical ranking metric, Influence is a resource. Hierarchy was inverted; corrected. |
| Total Power hero shown even when 2 of 3 components blank | Today equals Territory Power, will diverge as Activity/Legacy come online. Better to show the hero now with honest empty rows than wait. |
| Inactive Power rows use em-dash + Inter inline reason | Light empty-state form ("Step tracking required" / "Contest history required"). Labels stay Slate-2 regardless of state. Inactive values use Slate, live values use Bone. |
| calcContestWinXp + calcClaimXp return BASE XP only | Modifiers (streak ×1.10, supply line ×1.20, city event ×1.5) deferred to broader canonical-earn-calc wiring later. Matches calcResourceEarn's base-only pattern. |
| Atomic write of resource + xp in single .update() | Safer than separate writes — if one column had an invalid value, all would fail together rather than splitting state. Matches Promise.all + indexes pattern. |
| lifetime_defence_wins added as schema placeholder | No writer until defender flow ships, but ready when it does. |
| XP_PER_CONTEST_WIN naming wins over CONTEST_WIN_XP | Cursor proactively used XP_PER_X to match existing XP_PER_CHALLENGE pattern. Kept Cursor's version — more consistent with file conventions. |
| SIEGE XP shown first in earned beat line | "+300 SIEGE XP · +15 IRON · ..." — XP is the §5.7 lifetime record and outranks resources. |
| Did not verify claim XP on device | Same code pattern as contest, trusted to work, moved on. Pattern reuse + tests + identical write shape = high enough confidence. |
| Render-side check is a first-class diagnostic | If a UI change in the same file doesn't appear, the behaviour change isn't running either. Added to debugging playbook as step 4. |
| Reload Metro before testing JS-only changes | Stale bundle was today's biggest debugging trap (wrong hypothesis chain: partial-edit → auth.js overwrite, real cause: bundle). Reload first, debug code second. |
| Founder-only ACTIVATE (Marshal deferred) | Founder derived from `alliances.founder_id` — zero migration. Marshal needs `players.role` column migration, deferred until member management flow is built. Ship the 80% now, wire Marshal when the column lands. |
| Server-side guards for alliance Morale via Supabase RPC | `deduct_alliance_morale` enforces `morale >= amount` in SQL — no negative balances possible even from buggy clients. Same pattern for `donate_morale` (atomic deduct + credit in single transaction). Pushes invariants down to where they cannot be bypassed. |
| Morale donate UI lives in Wallet (not War Room, not inline) | Contextual to where personal resources live; focused action sheet pattern matches game conventions. War Room would have made it feel like spending alliance Morale, not donating personal Morale. |
| Modal bottom sheet (not new screen) for donate | One-decision flow — amount + confirm. Doesn't justify a screen, doesn't need its own nav entry. |
| Prinsengracht renamed to Jordaan | Prinsengracht is a canal/street with no closed OSM polygon — not viable as a territory. Jordaan is the surrounding neighbourhood with a clean boundary that fetches reliably. Better to rename one row than fake a polygon. |
| OSM territories fetched by `osm_id`, not by name | Name matching is ambiguous (multiple "Westerpark" matches in OSM) and fragile (locale, casing). ID lookup is exact and scales to any city. |
| `fetch-osm-polygons.js` reads territory list from Supabase, not hardcoded | Adding a new city = add rows with `osm_id` + `osm_type` and rerun the script. Zero code changes per city. |
| `t.geojson ?? rectangle fallback` in MapScreen | Safe rollout — territories without geojson still render as bounding boxes during partial migrations. Removes the all-or-nothing risk of a schema change. |
| Script lives on Desktop, not in repo | One-off backfill / occasional refresh tool — not part of the app. Keeps repo clean. Reusable as-is for any future city. |
| Custom layers on Mapbox Standard need fillEmissiveStrength + lineEmissiveStrength = 1.0 | Otherwise the night-preset 3D ambient lighting dims the layer's true colour. Without this, Claim red rendered as muddy brown-red, Alliance green as olive, Slate hairline invisible. Set on FillLayer + LineLayer style objects. |
| State-aware fillOpacity (case expression) instead of flat opacity | Saturation imbalance — Claim ~80%, Alliance ~56%, Enemy ~30% — means flat opacity makes cool colours visually recede on night basemap. Per-state values (Claim 0.42 / Alliance 0.55 / Enemy 0.50) compensate while preserving brief intent (Claim loudest, Enemy quietest). Unclaimed remains line-only. |
| Brand colours held against map-driven pressure | Considered changing Alliance green / Enemy blue when they read weakly on night basemap; resisted because brief is explicit ("Five colours only"), every branded screen depends on these tokens, and map shouldn't dictate brand. Solution was opacity tuning, not colour change. |
| V11 upgrade for runtime style config deferred | Would enable runtime config switching (day/dusk events) and StyleImport API, but burns 1 EAS build and risks ripple to react-native-screens / legacy-peer-deps / expo-build-properties pinning. Custom Studio style covers static brand config without upgrade. Revisit when runtime switching becomes needed. |

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
- **When debugging: get evidence before theorising.** PowerShell-from-PC test, fetch wrapper logs, EXPLAIN ANALYZE in SQL editor, and **render-side check** (does the UI change show up?) are the four fastest diagnostics for "is it server, client, network, or stale bundle".
- **When Cursor proposes shell commands (node -e, PowerShell) for tasks that are file edits:** SKIP, don't allowlist, redirect to use file tools only.
