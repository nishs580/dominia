# DOMINIA — MASTER PROJECT STATE
Last updated: May 16, 2026 (Session 18 — Step-tracking Session C complete: ActiveClaimScreen now fully steps-driven via Health Connect with foreground service GPS. Real-walk verified end-to-end on SPB. Stride calibration scaffolding live (writer active, qualifying window too strict — pending tune). `lib/claim.js` extracted. 15-min Continuous Walk Rule extended from contests to claims.)

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
| Database | Supabase (PostgreSQL + PostGIS 3.3.7) | ✓ Connected (Pro plan, Micro compute) |
| Auth | Clerk (`@clerk/clerk-expo`) | ✓ Working end to end |
| Location | expo-location | ✓ Installed |
| Sensors | expo-sensors | ✓ Installed |
| Health | react-native-health-connect 3.x | ✓ Working (read-only, foreground verified) |
| Background tasks | expo-task-manager + expo-location startLocationUpdatesAsync | ✓ Working (foreground service for active claim GPS) |
| Animations | react-native-svg | ✓ Installed |
| Fonts | @expo-google-fonts/archivo + geist-mono + inter + expo-splash-screen | ✓ Installed |
| Navigation | @react-navigation/native-stack + bottom tabs | ✓ Working |
| Test runner | Jest 30 (plain `testEnvironment: node`, NOT jest-expo preset) | ✓ 348 tests passing |
| Backend (future) | Node.js + Fastify | Not started |
| Real-time (future) | Ably | Not started |
| Push (future) | Firebase Cloud Messaging | Not started |

---

## IMPORTANT KEYS & IDS

| nish_s player ID | 94a9036e-1d59-49ae-9b5f-eae064913fbf |
| nish_s clerk_id | user_3CRjZoj8XaCoFwuAayVcgA2RPaP |
| nish_s territories | Рашетова улица (SPB), Near Колледж экономики и права (SPB), Лиственная улица (SPB), Museumplein (AMS) — 4 active |
| Rubik player ID | 788e9834 — KAI alliance, holds Sarphatipark |
| boo player ID | 53a0186a — GGG alliance |
| Phantom | alliance id 80caca88-85ba-4830-9b63-1c4fc8d8372c, holds Oud-West |
| Kainetic Allied [KAI] | id=6bc19cb1-97ce-4f76-95fa-b645606c2b47 |
| Unclaimed territories | Rembrandtplein, Plantage (both AMS) |
| SPB test home pin | Palace Square (jittered) for nish_s, Rubik, TINA, Alyona — reset 13 May for SPB testing |
| KAD ring road | OSM relation 1861646 (Cyrillic 'А-118') — defines SPB playable envelope |

---

## SUBSCRIPTIONS & LIMITS

| Service | Plan | Key limits |
|---|---|---|
| Supabase | Pro | Micro compute, ~$25/month all-in ($10 compute credit covers Micro). PostGIS 3.3.7 enabled in `postgis` schema. |
| Mapbox | Free | 50,000 map loads/month |
| Clerk | Free | 10,000 MAU |
| EAS Build | Free | 30 builds/month (15 Android + 15 iOS). **~17 Android used, ~13 remaining.** |
| Cursor | Pro | No usage limits on AI edits |

---

## SUPABASE SCHEMA

**Tables:**

`players`: id, username, level, xp, home_city, alliance_id, created_at, clerk_id, has_onboarded, home_pin_lat, home_pin_lng, current_streak, longest_streak, last_active_date, iron, stone, gold, morale, lifetime_contest_wins, lifetime_defence_wins, **stride_length_m float DEFAULT 0.75 (NEW Session 18)**, **stride_calibration_sessions int DEFAULT 0 (NEW Session 18)**, **stride_calibration_samples jsonb DEFAULT '[]' (NEW Session 18 — rolling max-10 sample buffer)**

`territories`: id, territory_name, tier, perimeter_distance, owner_id, alliance_id, development_level, longitude, latitude, created_at, legacy_rank, upkeep_overdue, osm_id (bigint), osm_type (text), geojson (jsonb), geom (postgis.geometry(Polygon, 4326)), **district (text, nullable, indexed — NEW Session 14)**, **territory_name_v1 (text, nullable — NEW Session 14, rollback backup on gap-fill rows only, drop after ~1 week of stable rendering)**

`alliances`: id, name, short_name, city, created_at, founder_id, morale

`player_challenges`: id, player_id, challenge_key, completed_at, date — UNIQUE constraint on (player_id, challenge_key, date)

`territory_history`: id, territory_id, owner_id, alliance_id (nullable), claimed_at, lost_at (nullable = currently held), backfilled (boolean), created_at

`debug_events`: id, player_id (FK CASCADE), event_type (text, freeform — no CHECK constraint), payload (jsonb), created_at — index on (player_id, created_at DESC), RLS off. Disposable infrastructure for fast iteration. Written via `lib/debug.js` `logDebug()` helper, fire-and-forget pattern (console.warn-only error handling, matches territory_history). **NEW Session 16.**

**TEMP tables (Sessions 13–14 — keep ~1 week post-ship for oversize review + rollback, then drop):**
- `public.gap_fill_roads_spb` — 27,899 SPB road LineStrings (no service roads), GIST indexed
- `public.gap_fill_pois_spb` — 1,721 SPB POIs for tier-2 landmark naming, GIST indexed
- `public.gap_fill_blocks_spb` — 7,810 rows: territory_name, name_tier, perimeter_m, flagged_oversize, district, okrug, outside_spb_admin
- `public.spb_districts` — 18 rows (OSM admin_level=5, район), GIST indexed
- `public.spb_okrugs` — 111 rows (OSM admin_level=8, окру́г), GIST indexed

**Test data — LIVE DB STATE (end of 14 May):**
- **Amsterdam: 239 territories** (all OSM-named, all unclaimed by default)
- **Saint Petersburg: 8,295 territories** (full city coverage)
  - 485 OSM-named (existing pre-Session 13, untouched in Phase 1)
  - 7,810 gap-fill city-blocks (new — fully named, disambiguated, district-assigned)
  - All 7,810 unique within (territory_name, district) scope — zero duplicates remaining
  - 37 flagged `flagged_oversize = true` (perim > 8000m, manual review deferred)
  - 263 flagged `outside_spb_admin = true` (Lomonosov/Petergof SW, Zanevka E — inside KAD ring, outside SPB city admin)
  - Name tier breakdown: 3,422 tier2_landmark · 4,388 tier3_street (after disambiguation: 2,154 originally tier-3 promoted to tier-2 via landmark backfill)
- 4 SPB test player home pins reset to Palace Square + jitter: nish_s, Rubik, TINA, Alyona
- Active alliances: Kainetic Allied [KAI] id=6bc19cb1-97ce-4f76-95fa-b645606c2b47 · Gritty Greeks [GGG]
- Territory tier values must be **lowercase** in DB (small/medium/large/epic) — check constraint enforces this. Epic tier used for SPB gap-fill blocks > 5000m perim.

**Indexes added:**
- `idx_territories_owner_id` ON territories(owner_id)
- `idx_territories_alliance_id` ON territories(alliance_id)
- `idx_territories_district` ON territories(district) — NEW Session 14
- `idx_players_clerk_id` ON players(clerk_id)
- `idx_players_alliance_id` ON players(alliance_id)
- `idx_territory_history_territory_id` ON territory_history(territory_id)
- `idx_territory_history_owner_id` ON territory_history(owner_id)
- `idx_territory_history_current_holder` partial index ON territory_history(territory_id) WHERE lost_at IS NULL
- `territories_geom_idx` **GIST index** on territories(geom) — powers fast viewport intersection queries

**Row Level Security (RLS):**
- `players` table: **DISABLED** (manually via dashboard). Was causing 19-minute hangs because old policies referenced `auth.uid()` but project uses Clerk, not Supabase Auth.
- All other tables (`territories`, `alliances`, `player_challenges`): RLS off.
- ⚠️ **Re-enabling RLS on players without proper Clerk JWT integration will reintroduce the 19-min hang.** Implement Clerk-JWT-based RLS before production launch.

```sql
-- Reset a territory (ALSO close any open history row — Session 18 lesson)
UPDATE territory_history SET lost_at = now()
  WHERE territory_id = (SELECT id FROM territories WHERE territory_name = 'X')
    AND lost_at IS NULL;
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
-- SPB district summary
SELECT district, COUNT(*) FROM territories WHERE territory_name IS NOT NULL
  AND ST_Intersects(geom, (SELECT geom FROM spb_districts LIMIT 1)) GROUP BY district;
```

**RPCs (server-side, atomic):**
- `get_territories_in_viewport(min_lon, min_lat, max_lon, max_lat)` — **canonical territory fetch for MapScreen.** SECURITY DEFINER + SET search_path = public, postgis. Returns 14 flat columns (no nested joins) including `owner_username`, `owner_clerk_id`, `owner_streak_days`, `alliance_short_name`, and CCW-corrected geojson via `postgis.ST_AsGeoJSON(postgis.ST_ForcePolygonCCW(t.geom))::jsonb`. Filters at source with `postgis.ST_IsValid` AND `postgis.ST_NPoints >= 4` to reject degenerate polygons.
- `deduct_alliance_morale(alliance_id, amount)` — guards `morale >= amount`, prevents negatives. Used by War Room ACTIVATE buttons.
- `donate_morale(player_id, alliance_id, amount)` — atomic transaction: deducts `players.morale` and credits `alliances.morale` in single call. Used by Wallet donate flow.
- **NEW Session 13 (loaders for SPB pipeline, idempotent):**
  - `insert_road_batch(geojson)` — SECURITY DEFINER, batched road insert via ST_GeomFromGeoJSON
  - `insert_poi_batch(geojson)` — SECURITY DEFINER, batched POI insert
- **NEW Session 14:**
  - `insert_district_batch(geojson)` — SECURITY DEFINER, batched district insert (ST_Multi on Polygon shapes)
  - `insert_okrug_batch(geojson)` — same pattern for okrugs

**SQL functions (Sessions 13–14, kept while temp tables alive):**
- `polygonise_spb_blocks()` — ST_Polygonize on road union clipped against existing 485 SPB territories
- `merge_sub_floor_blocks_spb()` — iterative merge of <100m sliver blocks into largest-shared-edge neighbour
- `merge_unnamed_spb_blocks()` — same but for late-stage unnamed-cluster cleanup
- `name_spb_blocks()` — 3-tier naming cascade: tier 1 OSM quarter, tier 2 POI landmark within 100m, tier 3 nearest street within 500m. Uses GET DIAGNOSTICS, not nested aggregate. Planar ST_DWithin GIST prefilter + geography ST_DWithin for true distance.
- `backfill_landmarks_for_duplicates_spb()` — for duplicate-group blocks, search POIs within 250m, rename to 'Near <POI>', promote to tier2_landmark
- `disambiguate_spb_blocks()` — append numeric suffix '2'..'N' to remaining duplicates ordered north→south then west→east

**Dead RPCs (safe to drop next session):**
- `get_all_territories_meta` — superseded by `get_territories_in_viewport`
- `get_territories_geojson_batch` — superseded by `get_territories_in_viewport`

---

## SCREENS — STATUS

| Screen | Status | Notes |
|---|---|---|
| Navigation (4 bottom tabs) | ✓ Branded | Geist Mono, uppercase, Ink background, hairline-strong top border, Bone active / Slate inactive, no icons |
| Map screen | ~ Live data | **PostGIS viewport-based fetch** via `get_territories_in_viewport` RPC. Renders Amsterdam (239) and SPB (8,295) territories from the same RPC depending on viewport. **Client-side feature cache (`featureCacheRef`, Map keyed by territory id, ~3000-entry cap with viewport-aware eviction)** + **merge-on-fetch** (never blanks the FeatureCollection on pan/zoom) + **age-gated abort** (only cancels in-flight fetches older than 1s, so near-complete fetches still populate cache). Debounce 150ms on `onCameraChanged`. Cache invalidates per-feature on Abandon via `handleTerritoriesRefetched(territoryId)`. Feature builder reads FLAT RPC columns. State-aware fill + line + label styles unchanged. styleURL temporarily `mapbox://styles/mapbox/light-v11` for dev visibility. **KNOWN BUGS: zoom-level simplification hides some small polygons at wide zoom; nested/overlapping territories detected on phone visual test — see Open Bugs.** |
| Activity screen | ✓ Live data | **Health Connect wired end-to-end (Session 17).** On focus: `initialize` + `getGrantedPermissions` + start 10s `readRecords('Steps', today 00:00 → now)` poll. Permission banner above challenge card when Steps read ungranted (LOCKED tier rows). Live tier progress `X / 5,000 steps` replaces COMPLETE button. Auto-complete watcher fires `onCompleteChallenge` for each tier whose target is crossed (Easy → Med → Hard cascade order); each tier writes player_challenges + atomic player update + activity_log independently. Idempotency via `inFlightTiersRef` + `completedKeys`. `DEV_MODE_MANUAL` constant at top of file restores COMPLETE buttons when set true (for testing without walking). Real 7-day weekly chart: `readWeeklySteps` reads HC for 7 days, groups by local day key, ends today at idx 6, overlays `liveSteps` via Math.max so today's bar animates with the poll. Today auto-highlighted in bone, tap-to-reveal step count label above chart, smooth Claim-red SVG trend curve over bar tops with dots at each day. |
| Profile screen | ✓ Live data | POWER section above Influence. Total Power hero + 3 breakdown rows: Activity (inactive), Territory (live), Legacy (live). My Resources ghost button → WalletScreen. **Long-press commander name (delayLongPress=1000) opens hidden HealthConnectDebug screen.** |
| Alliance screen | ✓ Branded | Join/create flow, roster, collective mission. War Room button passes allianceId, allianceName, shortName as nav params. |
| War Room screen | ✓ Live data | Live alliance Influence/day. Live war chest Morale only. All 6 abilities with correct costs. ACTIVATE buttons wired (Founder only) via `deduct_alliance_morale` RPC. |
| Wallet screen | ✓ Live data | Live resource fetch on open. 4 resources with glyphs + balances. Morale row → bottom modal sheet (custom amount + DONATE ALL) → `donate_morale` RPC. |
| Onboarding screen | ✓ Branded | 5-step flow, typewriter animation, numbered rows, Mapbox dark-v11 home pin map, resolvedPlayerId fallback, live username on Step 4 |
| Sign In screen | ✓ Branded | DOMINIA wordmark + ▪ claim mark, Geist Mono uppercase tagline, sharp inputs, Claim red button |
| Username screen | ✓ Branded | Sharp layout, Next button pinned to bottom, 2-char minimum enforced |
| Active Claim screen | ✓ Live data | **Steps-driven via Health Connect with foreground service GPS (Session 18 full rewrite).** On claim start: snapshot HC step baseline + start `Location.startLocationUpdatesAsync` with TaskManager-registered task `dominia-active-claim-location`. 10s `useFocusEffect` poll computes distance = (currentSteps − baseline − vehicleExcludedSteps) × strideM. Ring fills based on distance vs perimeter. GPS used for vehicle filter (>25 km/h excludes steps) + stride calibration writer (rolling 10-sample mean, sanity-bounded 0.4–1.1m, qualifying window: accuracy 5–20m AND speed <25 km/h AND >30s). Foreground service notification ("Dominia · Active Claim · Tracking your walk", colour #D64525) survives screen-off and pocket. 4-row stats panel: STEPS · DISTANCE · STRIDE (CAL/DEFAULT) · PACE (spm). Banner priority: vehicle → paused → reset → gpsWeak → halfway. 30s zero-step → PAUSED banner with countdown; 15-min zero-step → progress reset (§7.6 Continuous Walk Rule extended to claims). 50% halfway haptic-pulse fires once per claim. `DEV_MODE_MANUAL=false` flag (default false; flip true for COMPLETE NOW button without walking). GPS accuracy preset: `BestForNavigation`. Stale-position threshold: 5s. |
| HealthConnectDebug screen | ✓ Live data | Hidden, long-press Profile commander name. SDK status, permission state, today's steps + raw JSON dump, last 7 days breakdown, REQUEST PERMISSIONS button, REFRESH button, Log to Supabase button (writes `health_connect_snapshot` event to `debug_events`). **`handleRequestPermissions` now re-runs `loadTodaySteps` + `loadSevenDays` after permission grant (Session 17 fix — previously left `sevenDayBreakdown: []` in snapshot payload).** Permanent — reusable for every future HC bug. |
| Claim Success screen | ✓ Live data | Atomic write of Gold reward + Siege XP via single .update().select(). Tier fetched via .select('tier').single(). |
| Contest Result screen | ✓ Live data | 4 states. attack_won: close-out → territories → INSERT new history row, atomic write of iron/gold/morale + Siege XP + lifetime_contest_wins increment via single .update().select(). |
| Create Alliance screen | ✓ Branded | 3-step founding flow (identity → HQ territory → confirm). |
| Alliance Joined screen | ✓ Branded | Alliance green accent bar, Archivo 900 alliance name, [TAG], 5 numbered benefit rows. |
| AuthGate | ✓ Done | Checks isSignedIn + has_onboarded, routes to Onboarding or MainTabs |
| Permissions | ~ Partial | Requested inline in onboarding step 2 — not a standalone screen |
| Territory Detail (full screen) | ○ Not built | Currently a bottom sheet inside map. Full-screen version deferred. |
| Defender flow | ○ Deferred | Needs Ably real-time layer — revisit when backend is started. |
| Abandon flow | ○ Not built | Currently just an alert. When built, must UPDATE player's open territory_history row to set lost_at = now(). |

---

## KEY FILES

| File | Purpose |
|---|---|
| `App.js` | Root stack navigator, font loading (useFonts + SplashScreen guard), ClerkProvider, all screen registrations |
| `components/AuthGate.js` | Checks isSignedIn + has_onboarded, routes to Onboarding or MainTabs |
| `components/ResourceGlyphs.js` | 6 SVG glyph components: Stone, Iron, Gold, Shield, Morale, Influence |
| `components/ProgressBar.js` | 5 horizontal segments (28×2px), 0px radius, Bone active / HAIRLINE_STRONG inactive |
| `components/PrimaryButton.js` | Claim red, 0px radius, two-line format, Geist Mono |
| `components/SectionLabel.js` | Geist Mono 9px uppercase + hairline rule extending right |
| `components/NumberedRow.js` | Geist Mono number column + Inter title/subtitle, hairline dividers |
| `lib/theme.js` | All Dominia design tokens — colours, fonts, fontSize scale, spacing, radius, borders, motion durations |
| `lib/supabase.js` | Supabase client with **fetch wrapper that forces `Connection: close` header** (CRITICAL — do not remove without re-testing on Android, the dead-pool bug will return). URL/key hardcoded. |
| `lib/clerk.js` | ClerkProvider tokenCache with SecureStore |
| `lib/auth.js` | ensurePlayer(clerkUserId, email) — uses maybeSingle() to find or create player row |
| `lib/formulas.js` | **Single source of truth for all game math** (CommonJS, ~1500 lines, ~50+ exports). All XP / resource / Power / Legacy math. Aligned to v6.10. **FULLY UNIT TESTED — 348 tests passing.** |
| `lib/__tests__/formulas.test.js` | 348 Jest tests covering all of formulas.js. Run with `npm test`. Must stay green before any commit touching formulas.js. |
| `lib/streak.js` | updateStreakOnChallengeComplete — Supabase I/O. **No tests yet.** |
| `lib/territory.js` | Display helpers + getLegacyRankForTerritory + getTerritoryHistoryStats. **No tests yet.** |
| `lib/claim.js` | **NEW Session 18.** Pure math + Supabase I/O for ActiveClaimScreen. Exports `loadPlayerStride`, `stepsToMetres`, `computeSpeedKmh`, `isVehicleSpeed` (>25 km/h), `isQualifyingCalibrationWindow` (accuracy 5–20m AND speed <25 km/h AND >30s), `pushCalibrationSample` (rolling 10-sample mean writer, sanity-bounded 0.4–1.1m), `haversineMetres`, `paceSpm`, plus `CLAIM_CONSTANTS`. **No tests yet.** |
| `lib/debug.js` | `logDebug(playerId, eventType, payload)` — fire-and-forget Supabase write to `debug_events`. Console.warn-only error handling, matches territory_history pattern. NEW Session 16. |
| `metro.config.js` | react-dom shim to fix @clerk/clerk-react bundling |
| `shims/react-dom-shim.js` | Empty module.exports shim |
| `plugins/withHealthConnect.js` | Custom Expo config plugin. Injects `HealthConnectPermissionDelegate.setPermissionDelegate(this)` into MainActivity.kt `onCreate` at prebuild time (anchor regex `/super\.onCreate\(.+?\)/` matches both `savedInstanceState` and `null` forms — Expo SDK 54 uses `null`). Adds `PermissionsRationaleActivity`, `ViewPermissionUsageActivity` activity-alias, and `com.google.android.apps.healthdata` `<queries>` tag. Owned in-repo over the community `expo-health-connect` plugin (last updated July 2024, predates RN 0.74+ New Arch). NEW Session 16. |
| `screens/MapScreen.js` | **PostGIS viewport-based architecture with client-side feature cache.** Single RPC call to `get_territories_in_viewport` per fetch. `featureCacheRef` (Map keyed by territory id) holds previously fetched features; new fetches **merge** into cache, never replace. ~3000-entry cap with viewport-edge eviction. Debounce 150ms on `onCameraChanged`. **Age-gated abort:** only cancels in-flight fetches older than 1s; recent ones complete and populate cache. Skip-if-recent-in-flight prevents pile-up. `handleTerritoriesRefetched(territoryId)` clears the cache entry on Abandon before refetch. Diagnostic logs (`[vp fetch] START / OK / ABORTED / ERROR / SKIP`) still in place — strip when zoom-simplify bug resolved. Feature builder reads FLAT fields. styleURL = `mapbox://styles/mapbox/light-v11` (dev). |
| `screens/ActivityScreen.js` | **Health Connect wired (Session 17).** 10s poll of today's steps via `useFocusEffect` + `setInterval`. Live tier progress UI, permission banner with GRANT PERMISSION button, auto-complete watcher that cascades Easy → Med → Hard with idempotency guards (`inFlightTiersRef` + `completedKeys`). Each tier writes player_challenges + player update + activity_log independently per §6.1. `DEV_MODE_MANUAL` constant at top of file gates COMPLETE buttons for manual testing (default false). Real weekly steps chart (`readWeeklySteps` HC read + group by local day key, today always last index, liveSteps overlay via Math.max) with bone-highlighted today bar, tap-to-reveal step count, and smooth Claim-red SVG `<Path>` trend curve (Catmull-Rom→Bézier, tension 0.2) drawn over bar tops via absolute-positioned `<Svg>` overlay with `pointerEvents="none"` so bars remain tappable. |
| `screens/ProfileScreen.js` | POWER section above Influence. Long-press on headerBlock (commander name, delayLongPress=1000) navigates to HealthConnectDebug. Same pattern reusable for future debug screens. |
| `screens/AllianceScreen.js` | Join/create flow, roster, mission. |
| `screens/WarRoomScreen.js` | All 6 abilities. ACTIVATE wired (Founder only) via `deduct_alliance_morale` RPC. |
| `screens/WalletScreen.js` | 4-resource view. Morale row → donate modal → `donate_morale` RPC. |
| `screens/SignInScreen.js` | Fully branded. |
| `screens/UsernameScreen.js` | Fully branded. 2-char minimum. |
| `screens/OnboardingScreen.js` | Fully branded. 5-step flow. |
| `screens/ActiveClaimScreen.js` | **Full rewrite Session 18.** Steps-driven loop via Health Connect, foreground service GPS via `Location.startLocationUpdatesAsync` + `TaskManager.defineTask("dominia-active-claim-location")`. Module-level `latestTaskFix` bridged into `lastGpsFixRef` at start of each poll tick. Distance = (currentSteps − baseline − vehicleExcludedSteps) × strideM, recomputed every 10s. Stride calibration writer pushes (gpsDist/stepsInWindow) samples when qualifying window criteria met. 4-row stats panel (STEPS · DISTANCE · STRIDE (CAL/DEFAULT) · PACE). Banner priority queue: vehicle, paused, reset, gpsWeak, halfway. 30s zero-step → PAUSED MM:SS; 15-min zero-step → progress reset. 50% halfway haptic-pulse with idempotency flag. `DEV_MODE_MANUAL=false` constant at top (mirrors ActivityScreen pattern). All existing logic preserved: contest mode, opponent + attacker alliance fetches, contest-vs-claim destination, cancel button. |
| `screens/HealthConnectDebugScreen.js` | Hidden debug screen. SDK status check (`getSdkStatus`), permission request flow (`requestPermission` after MainActivity delegate is wired), today's steps via `readRecords('Steps', { timeRangeFilter: { operator: 'between', startTime, endTime } })`, raw JSON dump, last 7 days breakdown, snapshot write to `debug_events` via `lib/debug.js`. **`handleRequestPermissions` calls `loadTodaySteps` + `loadSevenDays` after `refreshGranted` (Session 17 fix — sevenDayBreakdown empty-array bug).** NEW Session 16. |
| `screens/ClaimSuccessScreen.js` | Atomic Gold + Siege XP write. |
| `screens/ContestResultScreen.js` | 4 states. attack_won: close-out → territories → INSERT → atomic player update. |
| `screens/CreateAllianceScreen.js` | Fully branded. 3-step founding flow. |
| `screens/AllianceJoinedScreen.js` | Fully branded. |
| **SPB GAP-FILL PIPELINE (local-only, gitignored, Session 13):** | |
| `fetch-spb-envelope.js` | Overpass query for KAD ring relation 1861646 (Cyrillic 'А-118'), stitches to closed polygon. Output: `spb_envelope.geojson`. |
| `fetch-roads-spb.js` | Overpass road fetch for SPB envelope, excludes service roads. Output: `roads_spb.geojson` (27,899 LineStrings). |
| `fetch-pois-spb.js` | Overpass POI fetch for tier-2 landmark naming. Output: `pois_spb.geojson` (1,721 POIs). |
| `load-roads-to-postgis.js` | Batched RPC loader via `insert_road_batch`. |
| `load-pois-to-postgis.js` | Batched RPC loader via `insert_poi_batch`. |
| **SPB ADMIN PIPELINE (local-only, gitignored, Session 14):** | |
| `fetch-spb-admin.js` | Overpass query for 18 districts (admin_level=5) + 111 okrugs (admin_level=8). |
| `load-admin-to-postgis.js` | Batched RPC loader, idempotent via ON CONFLICT DO NOTHING. |
| `districts_spb.geojson`, `okrugs_spb.geojson` | Output of fetch-spb-admin.js. |
| **SPB PASTE-ONLY SQL (may not exist locally — recreate from chat if needed):** | |
| `spb_admin_setup.sql` | Creates spb_districts, spb_okrugs tables + insert_district_batch, insert_okrug_batch RPCs. |
| `spb_disambiguate.sql` | Defines backfill_landmarks_for_duplicates_spb + disambiguate_spb_blocks functions. Paste-only, not saved locally. |
| **OLDER LOCAL-ONLY SCRIPTS:** | |
| `fetch-osm-polygons.js` | Reads osm_id + osm_type from territories table, fetches polygon from Overpass by ID. |
| `fetch-spb-candidates.js`, `filter-spb-candidates.js`, `insert-spb-territories.js` | Original 485 SPB OSM territory pipeline. |
| `migrate-territories-v2.js`, `retry-failed-polygons.js`, `analyze-territories.js` | Session 6 helpers. ⚠️ `retry-failed-polygons.js` still has hardcoded service role key — move to env var before it leaves the local machine. |
| `candidates_combined.csv` | Original Amsterdam OSM candidates source. |
| `dominia_mechanics_v6_10.md` | Game design doc — formulas.js aligned to this version |
| `.env` | All 4 keys — gitignored |
| `.npmrc` | legacy-peer-deps=true for EAS build compatibility |
| `app.json` | Plugins: expo-location (with `isIosBackgroundLocationEnabled: false` set explicit Session 18), expo-sensors, expo-build-properties (minSdkVersion 26), **`./plugins/withHealthConnect.js`**. Android permissions include `android.permission.health.READ_STEPS`, `android.permission.health.READ_HEALTH_DATA_IN_BACKGROUND`, `android.permission.ACTIVITY_RECOGNITION`, **`FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_LOCATION` (NEW Session 18 — required for sustained GPS on Android 14+)**. |
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

# Refresh OSM territory polygons (rerun anytime, or after adding new city rows)
cd C:\Users\nisha\dominia
node fetch-osm-polygons.js

# SPB gap-fill pipeline rerun order (if ever needed from scratch):
node fetch-spb-envelope.js     # KAD ring → closed polygon
node fetch-roads-spb.js        # 27,899 road LineStrings
node fetch-pois-spb.js         # 1,721 POIs
node load-roads-to-postgis.js  # batch insert via RPC
node load-pois-to-postgis.js   # batch insert via RPC
node fetch-spb-admin.js        # 18 districts + 111 okrugs
node load-admin-to-postgis.js  # batch insert via RPC
# Then SQL editor: polygonise_spb_blocks() → merge_sub_floor_blocks_spb() → name_spb_blocks()
# Then SQL editor: spatial join blocks→district/okrug → backfill_landmarks_for_duplicates_spb() → disambiguate_spb_blocks()

# PostGIS schema is `postgis` — all PostGIS types/functions must be schema-qualified:
#   postgis.geometry(Polygon, 4326)
#   postgis.ST_Intersects(geom, bbox)
#   postgis.ST_GeomFromGeoJSON(text)
#   postgis.ST_ForcePolygonCCW(geom)
#   postgis.ST_AsGeoJSON(geom)::jsonb
#   postgis.ST_MakeValid(geom)
# When changing an RPC return shape: DROP FUNCTION first, then CREATE.

# Overpass timeout for big SPB queries: add [out:json][timeout:900]; (900s) at start of query

# Heavy spatial joins: planar ST_DWithin (GIST-indexed, fast) prefilter, then
#   geography ST_DWithin for true metre-accurate distance. Splits a 60s+ timeout
#   query into two steps that each complete in seconds.

# Russian / Cyrillic CSV exports: open in Google Sheets (handles UTF-8 natively).
#   Excel mangles UTF-8 without the import wizard.

# When a Mapbox layer change isn't taking effect (native layer registry stale):
#   1. Uninstall the Dominia dev build from the phone
#   2. Stop Metro (Ctrl+C in the Expo Warp tab)
#   3. Restart: npx expo start --dev-client --host lan --clear
#   4. Reinstall the dev build

# Force-stop app on phone (required after lib/supabase.js changes OR after any EAS build install with native deps changes)
# Long-press app icon → App info → Force stop

# Health Connect — quick reference
# - HC app must be installed on the phone (built-in on Android 14+).
# - Permission flow: HealthConnectDebugScreen → REQUEST PERMISSIONS → Android system sheet → toggle Allow → Allow.
# - Read call: readRecords('Steps', { timeRangeFilter: { operator: 'between', startTime: ISO, endTime: ISO } })
# - Sum: records.reduce((s, r) => s + r.count, 0)
# - recordingMethod: 2 = automatic (sensor-tracked) — preferred for anti-cheat downstream.
# - dataOrigin shows source app (com.google.android.apps.fitness, OnePlus native, etc.) — use for cross-source dedup if needed.
# - Custom plugin (plugins/withHealthConnect.js) handles all native config — never edit AndroidManifest.xml or MainActivity.kt directly.
# - Long-press Profile commander name to open the debug screen.

# Diagnose "is the server slow or the phone slow" — run from PowerShell:
$headers = @{ "apikey"="<key>"; "Authorization"="Bearer <key>" }
Measure-Command { Invoke-RestMethod -Uri "<full-url>" -Headers $headers }

# Save to GitHub — NEVER use `git add .` (too easy to commit secrets or dev scripts)
git status
git add <specific files>
git commit -m "message"
git push
```

**EAS build budget:** 30/month. ~17 Android used, ~13 remaining. Only build for new native modules. Batch all native installs into one build.

**Native module rule:** New native modules need an EAS build + APK reinstall. JS-only packages just need a Metro restart.

---

## KNOWN PITFALLS — RECOGNISE & RESPOND

These are bugs that have already cost significant debugging time. Learn the signatures.

**1. Dead TCP connection pool hang (Android, RN fetch / OkHttp)**
- **Signature:** Logs show `[supabase fetch] ERR ... after 1500000 ms — Network request failed` followed by an immediate retry that succeeds in ~1s. Same query is fast from PowerShell on PC but slow from phone.
- **Cause:** OkHttp caches dead TCP connections in its pool.
- **Fix:** Force `Connection: close` header on every Supabase request. Already in `lib/supabase.js`.

**2. RLS auth.uid() stall with Clerk projects**
- **Signature:** Profile/Alliance slow but Map fast. Disabling RLS on `players` collapses load times by ~7x.
- **Cause:** RLS policies referencing `auth.uid()` stall because project uses Clerk.
- **Fix:** RLS currently DISABLED on `players`. Permanent fix: Clerk-JWT-based RLS before production.

**3. Headers spread silently drops apikey**
- **Signature:** 401 "No apikey" errors after wrapping fetch.
- **Cause:** `{...init.headers}` on a `Headers` instance gives an empty object.
- **Fix:** Detect `Headers` via `typeof incoming.forEach === 'function'` and copy with `.forEach`.

**4. Hooks order violation after early return (recurring pattern)**
- **Signature:** "Rendered more hooks than during the previous render."
- **Cause:** New hook added below an early return.
- **Fix:** All hooks above any conditional early returns. Scan for early returns first when adding hooks.

**5. Supabase .update() silently no-ops without .select() (recurring — 3 occurrences)**
- **Signature:** Write appears to succeed (no error logged), but DB value unchanged.
- **Fix:** Always chain `.select()` on every `.update()`.

**6. Cursor agent proposes shell commands instead of file edits**
- **Signature:** Cursor suggests `node -e "..."` or PowerShell to modify file content.
- **Fix:** Skip, redirect with "use file tools only, no shell commands."

**7. Stale Metro bundle (JS-only changes don't always hot-reload)**
- **Signature:** Code looks right + tests pass + DB writes partially succeed.
- **Fix:** Reload Metro (`r` in terminal, or shake phone → Reload) before debugging the code.

**8. Overpass API 406 Not Acceptable**
- **Signature:** Overpass returns HTTP 406 immediately with no useful body.
- **Cause:** Missing `Content-Type: application/x-www-form-urlencoded` and/or `User-Agent` header.
- **Fix:** Send both headers explicitly.

**9. Overpass API 429 rate limiting**
- **Signature:** First few queries succeed, then 429.
- **Fix:** Sleep 8000ms between requests. Slow but reliable.

**10. Supabase write fails with "Invalid path specified"**
- **Signature:** REST writes return 400 / "Invalid path specified" from external scripts.
- **Cause:** `SUPABASE_URL` has a trailing `/rest/v1/` suffix.
- **Fix:** Base domain only — no trailing path.

**11. Node 24 `fetch()` rejects raw string body for form-encoded POST**
- **Cause:** Node 24's built-in `fetch` rejects raw URL-encoded string bodies.
- **Fix:** Wrap in `URLSearchParams`.

**12. Single degenerate polygon poisons entire Mapbox source (Session 6)**
- **Signature:** Valid FeatureCollection returned from RPC, but nothing renders — fill, line, AND tap all fail. No errors logged.
- **Cause:** ONE malformed feature in the collection causes Mapbox GL Native v10 to silently drop the entire layer.
- **Fix:** Filter at source. RPC applies `postgis.ST_IsValid(geom)` AND `postgis.ST_NPoints(geom) >= 4`. Lesson: when fill + line + tap ALL fail on a "valid" feature collection, dump `JSON.stringify(rows[0].geojson)` BEFORE chasing style hypotheses.

**13. PostGIS schema qualification required (Session 6)**
- **Signature:** `type "geometry" does not exist` or `function st_intersects does not exist`.
- **Fix:** Every PostGIS type/function must be schema-qualified: `postgis.geometry`, `postgis.ST_Intersects`, etc. RPCs need `SET search_path = public, postgis`.

**14. Postgres function return-type changes require DROP + CREATE (Session 6)**
- **Signature:** `CREATE OR REPLACE FUNCTION` fails with `cannot change return type of existing function`.
- **Fix:** `DROP FUNCTION <name>(<arg types>);` first.

**15. GeoJSON CCW convention vs PostGIS CW convention (Session 6)**
- **Signature:** Polygons render flipped / inside-out / not at all.
- **Fix:** `postgis.ST_ForcePolygonCCW(geom)` inside the RPC before `postgis.ST_AsGeoJSON()`.

**16. ST_Union fails with TopologyException on invalid PostGIS geometries (Session 13)**
- **Signature:** `ST_Union(geom)` on a column you trusted to be valid throws `TopologyException: side location conflict` or similar. Often surfaces only when running a city-wide aggregate (one bad row out of thousands).
- **Cause:** PostGIS allows self-intersecting / duplicate-vertex polygons to be stored. `ST_Union` (and many other set operations) reject them.
- **Fix:** Run a triage pass: `SELECT id FROM territories WHERE NOT postgis.ST_IsValid(geom);`. For each, replace with `postgis.ST_MakeValid(geom)` and then take the largest piece via `postgis.ST_Dump` + ORDER BY ST_Area. 16 SPB rows fixed this way in Session 13 as unplanned cleanup before polygonisation. Worth adding a periodic validity check to CI.

**17. OSM relation names with non-Latin alphabets (Session 13)**
- **Signature:** Overpass returns empty for `relation[name="A-118"]` even though the road exists.
- **Cause:** Russian OSM tags the KAD ring as `name=А-118` in Cyrillic, not Latin `A-118`. Looks identical but they're different code points.
- **Fix:** Use the OSM relation ID directly (`relation(1861646)`) — ID lookup never depends on tag spelling. For any non-English city, always look up the relation in OSM first and copy the numeric ID.

**18. SQL editor 60s timeout on heavy PostGIS queries (Session 13)**
- **Signature:** Long-running query in Supabase SQL editor returns "canceling statement due to statement timeout" after exactly 60s, even when EXPLAIN says it should finish in 90s.
- **Cause:** Supabase SQL editor enforces a 60s wall clock. Affects polygonisation, large unions, geography ST_DWithin without prefilter.
- **Fix:** (a) Split work into smaller steps each well under 60s — operate by district or by chunk. (b) For distance joins, add a planar `postgis.ST_DWithin(geom, bbox_geom, buffer)` prefilter (uses GIST index, fast) BEFORE the geography `ST_DWithin` for true metre distance. Cuts 60s+ joins to seconds.

**19. PL/pgSQL nested aggregate error (Session 13)**
- **Signature:** `aggregate function calls cannot be nested` from a function body that uses `count(ST_Dump(...))` or similar.
- **Cause:** `ST_Dump` is set-returning, not aggregate, and wrapping it in `count()` produces an aggregate over a set-of-set.
- **Fix:** Use `GET DIAGNOSTICS row_count = ROW_COUNT` after the operation instead of wrapping `ST_Dump` in `count`. Or unnest into a CTE and count from there.

**20. Russian / Cyrillic CSV exports break in Excel (Session 13–14)**
- **Signature:** Cyrillic territory names render as gibberish (`Р“Р°РІР°РЅСЊ` etc) when CSV from Supabase is opened in Excel.
- **Cause:** Excel assumes Windows-1251 / CP-1252 on `.csv` open and does not honour the UTF-8 BOM by default.
- **Fix:** Open Cyrillic exports in Google Sheets (which detects UTF-8 natively) or use Excel's Data → From Text import wizard with UTF-8 encoding selected. Never trust a CSV double-click for non-Latin content.

**21. ST_GeomFromGeoJSON returns Polygon for MultiPolygon-shaped input (Session 14)**
- **Signature:** Inserting Overpass admin polygons via RPC fails on some rows with "Geometry type (Polygon) does not match column type (MultiPolygon)" or vice versa.
- **Cause:** Overpass relations sometimes resolve to a single Polygon outline, sometimes a MultiPolygon. The receiving column expects one shape.
- **Fix:** In the loader RPC, run `CASE WHEN GeometryType(g) = 'POLYGON' THEN ST_Multi(g) ELSE g END` before the INSERT so single Polygons get promoted to MultiPolygon.

**22. Aggressive AbortController blanks panned-through map areas (Session 15)**
- **Signature:** User pans fast across the map, intermediate areas show no polygons even after the pan stops. Logs are full of `AbortError` from cancelled fetches.
- **Cause:** Unconditional `abort()` on every new viewport fires cancels near-complete fetches mid-flight, so areas the user briefly passed through never populate the cache.
- **Fix:** **Age-gated abort** — only abort in-flight fetches older than 1s; recent fetches are allowed to complete. Pair with merge-on-fetch (don't replace the FeatureCollection — merge new features into a cache keyed by territory id) so the partial population persists. AbortError logs are then *expected noise* confirming stale-request cancellation, not failures.

**23. Replacing FeatureCollection on every pan = trailing-polygon symptom (Session 15)**
- **Signature:** "Polygons trail in late" on pan — already-visible territories briefly disappear during the fetch, then come back. Map feels laggy even when network is fast.
- **Cause:** Setting the shape source to a fresh FeatureCollection on each fetch blanks every feature for the duration of the round-trip.
- **Fix:** Hold features in an in-memory cache (`featureCacheRef`, Map keyed by territory id), bound it (~3000 entries with viewport-aware eviction so on-screen features never get evicted), and **merge** new fetch results in instead of replacing. Visible features then never blank. When real-time lands, invalidate per-entry via `featureCacheRef.current.delete(territoryId)`.

**24. react-native-health-connect crashes on requestPermission with New Architecture (Session 16)**
- **Signature:** App crashes with `UninitializedPropertyAccessException: lateinit property requestPermission has not been initialized` the moment `requestPermission` is called. New Architecture is on.
- **Cause:** Library Issue #214. The Health Connect permission delegate is `lateinit` in Kotlin and must be initialised by calling `HealthConnectPermissionDelegate.setPermissionDelegate(this)` inside MainActivity's `onCreate`. Without this, the first `requestPermission` call fires before init.
- **Fix:** Custom Expo config plugin `plugins/withHealthConnect.js` injects the `setPermissionDelegate(this)` line into MainActivity.kt `onCreate` at prebuild time, plus the `PermissionsRationaleActivity`, `ViewPermissionUsageActivity` activity-alias, and `com.google.android.apps.healthdata` `<queries>` manifest entries. Never edit MainActivity.kt or AndroidManifest.xml directly — the plugin re-runs every prebuild. New Arch stays on.

**25. Expo config plugin anchor regex must match SDK's actual MainActivity.kt (Session 16)**
- **Signature:** `npx expo prebuild` fails: "Failed to match anchor `/super\.onCreate\(savedInstanceState\)/` in MainActivity.kt."
- **Cause:** Expo SDK 54's MainActivity.kt calls `super.onCreate(null)`, not `super.onCreate(savedInstanceState)`. A regex written for an older template silently misses.
- **Fix:** Use the relaxed anchor `/super\.onCreate\(.+?\)/` that matches both forms. General lesson for any custom plugin that touches MainActivity.kt: never assume a specific argument name — match the call shape, not the argument string. Re-check the anchor every Expo SDK upgrade.

**26. Orphan territory_history rows after dev territory reset (Session 18)**
- **Signature:** A territory shows as "Unclaimed" (`territories.owner_id = NULL`) but a `territory_history` row for it still has `lost_at = NULL`, so it appears as currently-held in any history-driven query (Legacy Rank, dashboards, ownershipChanges).
- **Cause:** Old reset SQL snippet only updated `territories.owner_id = NULL` and missed closing the open history row. Two-table invariant broken.
- **Fix:** Always close the open history row first, then null the owner. Updated SQL snippet in this doc. Lesson: any write that changes ownership state MUST touch both `territories` and `territory_history` — they are paired writes and must be paired in every code path (including dev SQL).

**Debugging playbook — when something is slow or broken:**
1. **PowerShell-from-PC test** — if fast on PC + slow on phone, it's the dead-pool bug or a client-side issue
2. **Fetch wrapper logs** — `[supabase fetch]` timing tells you whether the network call is slow
3. **EXPLAIN ANALYZE in SQL editor** — tells you if the database query is slow
4. **Render-side check** — does a UI change in the same file appear on device? If not, you're on a stale bundle. Reload Metro before debugging the code.
5. **Force-stop the app** after `lib/supabase.js` changes — long-press app icon → App info → Force stop.
6. **Dump raw data first when rendering breaks** — `JSON.stringify(rows[0].geojson)` BEFORE chasing style hypotheses (Pitfall #12).
7. **For heavy spatial queries:** split into smaller steps, add planar ST_DWithin prefilter before geography ST_DWithin, and check ST_IsValid before any ST_Union (Pitfalls #16, #18).
8. **Get evidence before theorising.**

---

## OPEN BUGS

| Bug | Detail |
|---|---|
| **Nested / overlapping SPB territories (NEW Session 14 — NEXT SESSION'S FIRST TASK)** | Spotted on phone visual test after gap-fill propagation. Some gap-fill blocks overlap each other and/or overlap existing OSM-named SPB territories. Root cause unknown — could be (a) OSM-named territory containing one or more gap-fill blocks, (b) gap-fill block containing another gap-fill block, (c) partial overlap from polygonisation edges, or any combination. Diagnostic query needed: find all pairs where `postgis.ST_Overlaps(a.geom, b.geom)` or `postgis.ST_Contains(a.geom, b.geom)` is true beyond a tiny tolerance. Group results by overlap type before deciding handling per type (likely delete smaller / sub-tier or merge into larger). |
| **onMapIdle viewport re-fire unreliable (Session 6 — RESOLVED differently this session)** | ~~Fixed.~~ Replaced `onMapIdle` flow with `onCameraChanged` (150ms debounce) + client-side cache + merge-on-fetch. Pan/zoom now feels tile-like — visited areas stick, new areas populate reliably. Cache absorbs the higher fetch frequency safely. |
| **Zoom-level rendering: some small polygons missing at wide zoom (NEW this session, DEFERRED)** | At Mapbox scale ~500m/750m (zoom ~13–14), some territories that exist in DB do not render; same area at tighter zoom (≤250m, zoom ≥15) shows them. `get_territories_in_viewport` applies `postgis.ST_SimplifyPreserveTopology` with tolerance 0.00005° at zoom 12–14 and 0.0002° at zoom 10–12. Hypothesis: simplification collapses small polygons below the `ST_NPoints >= 4` filter threshold, hiding them. Diagnostic query drafted (count survives-simplify vs total in viewport) but not run. Fix likely: scale `simplify_tolerance` down further or only apply `ST_NPoints >= 4` to the un-simplified geom. Defer to map polish phase — performance is good enough to develop on. |
| **37 SPB gap-fill blocks flagged_oversize = true** | Perim > 8000m, manual visual review deferred. Examples: block #9771 'улица Демьяна Бедного' at 7052m perim (street name on a huge block — suspicious). |
| **Some OSM POI names are bureaucratic asset codes** | e.g. 'Near СО17-2873 N' as a tier-2 landmark name. Fix at frontend display layer (formatTerritoryDisplayName) when display surfaces are touched. |
| Diagnostic logs still in MapScreen.js | `[vp fetch] START / OK / ABORTED / ERROR / SKIP` + older `[geojson diag]`, `[shape source feed]`, `[feature builder]`, `[render]`. Keep until zoom-simplify + nested-territories bugs solved, then strip. AbortError logs are noise, not failures — they confirm the system is correctly cancelling stale requests. |
| Dead RPCs in Supabase | `get_all_territories_meta` and `get_territories_geojson_batch` no longer called. Safe to drop. |
| `retry-failed-polygons.js` has hardcoded service role key | Local-only file (never committed) but key must move to env var before file ever leaves the local machine. |
| RLS missing on all tables | Disabled to fix slow load. Re-enable with Clerk-JWT-based RLS before production. |
| Client Trust + email verification disabled in Clerk | Both disabled for dev. Re-enable before production. |
| **PACE (spm) reads 0 during phone-locked walks (NEW Session 18)** | JS tick suspended while phone is locked, so step delta isn't computed per tick; should spike-correct on unlock but instead reads 0. Display-only field — claim math (steps × stride) is unaffected. Root cause not yet diagnosed. Fix likely: calculate pace from `stepsSinceLastEffectiveTick / actualElapsedMs` rather than assuming POLL_INTERVAL_MS. Defer to ActiveClaimScreen polish pass. |
| **Stride calibration lower-bound accuracy too strict (NEW Session 18)** | Verification walk produced 0 qualifying calibration windows (sessions stayed 0, stride remained 0.75 default). Most likely cause: the 5m lower bound on GPS accuracy (intended to reject implausibly-perfect spoofed signals) is also rejecting clean outdoor signals. Likely fix: drop lower bound to 0m or 3m. Diagnostic logging of `(accuracyM, speedKmh, windowMs, qualifies)` per tick needed to confirm. |
| Cascade auto-completion not yet verified on a real walking day (Session 17) | Manual one-by-one tier writes (Easy → Med → Hard) verified end-to-end (one player_challenges row + one activity_log row per tier). True cascade (Hard crossing 15k in a single 10s poll tick auto-completing Med + Easy in the same loop) deferred to first natural 15k-step day. Logic is straightforward; the underlying write path is proven. |
| Notification icon for foreground service is app icon (NEW Session 18) | Should be monochrome 24×24 white PNG per Android notification icon spec. Currently uses app icon — works but not polished. ~30 min asset task; doesn't affect functionality. |
| v6.11 doc addendum: 15-min Continuous Walk Rule extended to claims (NEW Session 18) | Spec §7.6 currently scopes the 15-min reset rule to contests only. Session 18 designer call: apply same rule to claims. Worth a v6.11 mechanics doc addendum. |
| Steps (background read) permission not granted | Only required for true background reads when app is closed. Foreground reads from ActivityScreen on mount don't need it. Decide whether to request as part of onboarding or defer to a later "always-on tracking" feature. |
| 3 of 4 ContestResultScreen branches unverified on device | Code wired for attack_won, attack_lost, defence_won, defence_lost. Only attack_won verified on phone. Defence states need Ably real-time to test, so harder to verify in isolation. |
| Defender flow deferred | Needs Ably real-time layer. |
| Abandon flow not built | Must UPDATE open territory_history row when built. |
| Onboarding home pin verification not implemented | 500m proximity check deferred. |
| Auth flow order wrong | New users hit sign-up before seeing any game content. |
| Achievements table hardcoded | Distance, Calories, Active Minutes wiring deferred. Health Connect can now provide these via additional `readRecords` calls (Distance, TotalCaloriesBurned, ExerciseSession); iOS needs HealthKit later. |
| Marshal role not tracked | Founder-only currently. Marshal needs `players.role` column. |
| Legacy Titles on Profile hardcoded | Needs Supabase wiring once real title data exists. |
| ProfileScreen colour constants not on theme tokens | Refactor to lib/theme.js. |
| TERRITORY_CAP_BY_LEVEL duplicated | In MapScreen.js + ProfileScreen.js. Move to formulas.js. |
| lib/streak.js + lib/territory.js + lib/claim.js have no unit tests | All three do Supabase I/O — mocking strategy is the gating decision. |
| player_number hardcoded as #0001 | Sequential column not yet added. |
| Siege XP constants exist with no writers | XP_PER_DEFENCE_WIN, XP_RECONQUEST, XP_PER_DEV_TIER_REACHED, XP_ALLIANCE_MISSION, XP_STREAK_MILESTONE — each wires when feature arrives. |
| lifetime_defence_wins schema placeholder | No writer until defender flow ships. |
| Legacy Power inputs partial | titlesEarned + championshipWins hardcoded to 0. |
| Draggable bottom sheet deferred | gorhom/bottom-sheet — batch into next EAS build. |
| Home District mechanic incomplete | CreateAlliance HQ picker uses player-owned only. Spec: 5 nearest OSM. |
| Invite non-player flow missing | No share/invite link flow yet. |
| POI icons on Standard night basemap | Currently overridden by `light-v11` dev style. Will resurface at polish phase. |
| `formatTerritoryDisplayName()` not yet written | Frontend display formatter — strip 'Near' prefix on tight surfaces, truncate long Cyrillic names, hide bureaucratic asset codes. Build when first touching the relevant display surface. |
| `territory_name_v1` rollback column on gap-fill rows | Drop after ~1 week of stable rendering on phone. |
| 5 temp tables alive in DB | `gap_fill_roads_spb`, `gap_fill_pois_spb`, `gap_fill_blocks_spb`, `spb_districts`, `spb_okrugs`. Keep ~1 week for oversize review + rollback, then drop. |

---

## DEFERRED / OUT OF SCOPE

- Real step tracking — Health Connect verified read-only foreground (Session 16); wired into ActivityScreen daily challenges with 10s poll + live weekly chart (Session 17); ActiveClaimScreen now fully steps-driven with foreground service GPS (Session 18). All three step-tracking sessions complete. Remaining: pace (spm) lock-screen fix, stride calibration tuning, iOS HealthKit when iOS lands.
- Background step reads (`READ_HEALTH_DATA_IN_BACKGROUND` permission) — granted in manifest, not yet requested from user. Only needed when app is closed; defer until "always-on tracking" feature
- Defender flow — needs Ably real-time layer
- Alliance disband flow — no real gameplay use case
- Alliance chat — post-MVP
- Onboarding home pin 500m verification
- Backend (Fastify, BullMQ, Ably, FCM) — not started, separate phase
- **Phase 2 of SPB territory pool** — merging existing sub-tier OSM-named SPB territories (485 of them) into the unified gap-fill pool. Phase 1 was greenfield gap-fill only; Phase 2 deferred.
- **Amsterdam gap-fill pipeline** — expected ≤30 new fill blocks. Not run yet. Run after SPB nested-territories cleanup completes and pipeline is proven idempotent.
- Custom Mapbox night style swap-back (currently `light-v11` for dev)
- **Ably cache-invalidation hook in MapScreen.js** — when real-time multiplayer lands, subscribe to `territory:updated` channel and call `featureCacheRef.current.delete(territoryId)` on each event. ~1 hour of work; integrates with existing `handleTerritoriesRefetched(territoryId)` pattern.

---

## WHAT'S NEXT

**MVP SCREENS BRANDED ✓ | GAME MATH ENGINE COMPLETE ✓ | RESOURCE ECONOMY ✓ | TERRITORY HISTORY + LEGACY RANK ✓ | 348 TESTS PASSING ✓ | SIEGE XP WIRED ✓ | POWER SECTION ✓ | WAR ROOM ACTIVATE WIRED ✓ | MORALE DONATION LIVE ✓ | POSTGIS VIEWPORT FETCH ✓ | SPB FULL CITY COVERAGE: 8,295 TERRITORIES ✓ | MAP RENDER PERFORMANCE TILE-LIKE ✓ | HEALTH CONNECT READ-ONLY VERIFIED ✓ | ACTIVITY SCREEN LIVE STEP-DRIVEN ✓ | ACTIVE CLAIM STEP-DRIVEN WITH FOREGROUND GPS ✓**

**Immediate — discuss + pick from the backlog at start of next session.** Step-tracking 3-session split is complete (Sessions 16/17/18). Top candidates, in rough recommended order:

1. **Backend phase kickoff** — Fastify + BullMQ + Ably scaffolding. Highest-leverage unlock: enables defender flow, real-time territory updates, server-side anti-cheat, and the cache-invalidation hook in MapScreen.js. The longest unstarted phase in the project — worth starting before more frontend work accretes.
2. **ActiveClaimScreen polish pass** — pace (spm) lock-screen fix + widen stride calibration accuracy lower bound (5m → 0 or 3m) + add per-tick diagnostic logging of `(accuracyM, speedKmh, windowMs, qualifies)` to confirm. Small, focused, ships polish on what was just built.
3. **`formatTerritoryDisplayName` helper** — clean up bureaucratic POI asset codes (e.g. `Near СО17-2873 N`), strip `Near ` prefix on tight surfaces, truncate long Cyrillic names. Cheap, high-visibility polish on every label in the app.
4. **Tests for `lib/streak.js`, `lib/territory.js`, `lib/claim.js`** — Supabase mocking strategy is the gating decision. All three files in one session once strategy is agreed.
5. **Daily Achievements live data** — wire Distance, Calories Burnt, Active Minutes via additional `readRecords` calls (Distance, TotalCaloriesBurned, ExerciseSession). Today/Best logic needs persistent best storage.

**Companion doc work — v6.11 mechanics addendum:** 15-min Continuous Walk Rule extended to claims (currently §7.6 contests-only). Worth a small spec addendum so the doc and code agree.

**Queued — deferred map work (revisit at polish phase):**
- Nested / overlapping SPB territories investigation — diagnostic query for `postgis.ST_Overlaps` / `postgis.ST_Contains` pairs, group by overlap type, decide handling per type
- Zoom-level simplification fix — diagnostic count of survives-simplify vs total in viewport, then scale tolerance down or move `ST_NPoints >= 4` to un-simplified geom
- Strip diagnostic logs in MapScreen.js (`[vp fetch] *`, `[geojson diag]`, etc.)
- Drop dead RPCs (`get_all_territories_meta`, `get_territories_geojson_batch`)
- Phone visual review of 37 `flagged_oversize` blocks
- Drop `territory_name_v1` rollback column once gap-fill names verified stable
- Drop 5 temp tables (`gap_fill_*`, `spb_*`) once oversize review complete

**Queued — Ably real-time integration (~1 hour when backend lands):**
- Subscribe to `territory:updated` channel
- On event, call `featureCacheRef.current.delete(territoryId)` and trigger re-render
- Integrates cleanly with existing `handleTerritoriesRefetched(territoryId)` pattern already in MapScreen.js

**Queued — Amsterdam gap-fill:**
- Rerun the SPB pipeline pattern on Amsterdam envelope. Expected ≤30 new fill blocks. Validate same pipeline is idempotent across cities before adding Bengaluru / other cities.

**Queued — Phase 5a:**
- Raw events written to `activity_log` table; recompute Activity Power on read (Option A — no cache).
- Three event-write sites: ClaimSuccessScreen, ContestResultScreen, ActivityScreen.
- `km_amount` column NULL until step tracking lands. **NOTE Session 18:** real distance + step counts now available from ActiveClaimScreen — `km_amount` can be wired on the next Phase 5a pass.

**Queued — Map Session 3 (polish):**
- Switch styleURL back to custom night Studio style.
- First Claim visual pulse for Level 1-2 players on Smalls.
- Tier-aware visual treatment.
- Level-gate visual states.
- Territory tier audit across both Amsterdam and SPB.

**Formula Build Phases:**
- Phase 1 ✓ — XP, level, streak, contest distance, challenge XP
- Phase 2 ✓ — Influence/day + Territory Power on Profile
- Phase 3 ✓ — Resource economy
- Phase 4 ✓ — territory_history + live Legacy Rank
- Phase 4.5 ✓ — Siege XP wired, POWER section, lifetime_contest_wins live
- Phase 4.6 ✓ — War Room ACTIVATE, Morale donation, OSM polygons for original 10 territories
- Phase 4.7 ✓ — PostGIS migration, viewport RPC, Amsterdam dataset (Session 6)
- Phase 4.8 ✓ — SPB full city coverage (Sessions 13–14)
- Phase 4.9 ✓ — Health Connect end-to-end: ActivityScreen + ActiveClaimScreen step-driven (Sessions 16–18)
- Phase 5a ○ — activity_log table + 3 event-write sites
- Phase 5b ○ — Backend: Activity Power read-side once activity_log populates + cron for Total/Alliance Power

**Other backlog:**
- Implement Clerk-JWT-based RLS on all tables (before production)
- Strip diagnostic console.logs once stable
- Move TERRITORY_CAP_BY_LEVEL into formulas.js
- Refactor ProfileScreen colour constants to lib/theme.js
- Fix auth flow order
- `players.role` column migration → wire Marshal role for War Room ACTIVATE
- Request `READ_HEALTH_DATA_IN_BACKGROUND` permission from user (later — only when always-on tracking is built)
- Draggable bottom sheet — batch into EAS build
- Invite non-player flow
- Home District mechanic
- Onboarding home pin 500m verification
- Move hardcoded service role key in `retry-failed-polygons.js` to env var
- Add Bengaluru territory dataset (rerun fetch-osm-polygons.js + gap-fill pipeline)
- Backend phase (Fastify, BullMQ, Ably, FCM)
- Notification icon polish: monochrome 24×24 white PNG for foreground service notification

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
| Batch all native module installs into one EAS build | EAS budget is limited |
| legacy-peer-deps=true in .npmrc | Required for EAS build npm ci to succeed |
| react-native-screens pinned to 4.16.0 | Fixes version conflict that caused IllegalViewOperationException |
| USB debugging via adb (not WiFi) | AVG firewall + VPN blocked WiFi Metro connection |
| OSM real territory shapes deferred (originally) | Bounding box polygons sufficient for early mechanic testing |
| Alliance chat deferred to post-MVP | Complexity not needed until core loop is working |
| Clerk password breach protection disabled | Allows test password (Test1234!) during dev |
| Clerk publishable key hardcoded in App.js | Env vars unreliable in React Native at runtime |
| Supabase URL/key hardcoded in lib/supabase.js | Same reason — env vars unreliable at runtime |
| Client Trust disabled in Clerk dashboard | Was requiring 2FA which blocked sign-in |
| DEV_MODE = true in ActiveClaimScreen | Fake interval for rapid testing |
| Abandon over Patrol for own territories | Patrol mechanic not built end to end |
| ~~react-native-health-connect removed~~ → **react-native-health-connect 3.x reinstalled with custom Expo plugin (Session 16)** | Original removal was due to native crash on load before plugin existed. New approach: custom `plugins/withHealthConnect.js` injects `setPermissionDelegate(this)` into MainActivity.kt at prebuild — surgical, in-repo, easy to maintain at SDK upgrades. |
| minSdkVersion 26 via expo-build-properties plugin | android.minSdkVersion in app.json not respected by Expo managed workflow |
| App-code writes for territory_history (not Postgres triggers) | Easier to debug, matches existing pattern |
| Contest write order: close-out → territories → INSERT | Prevents two rows with lost_at = null for same territory |
| **Client-side feature cache over server-side caching (Session 15)** | Small, no infra change, works offline-ish on revisit. Server-side caching would have meant Redis or PG materialised views — both overkill for the actual problem (per-pan re-fetch of the same features). |
| **Stale-while-revalidate semantics for cache (Session 15)** | When Ably real-time lands, subscribe to `territory:updated` events and invalidate per-feature cache entries on each event. Pattern: `featureCacheRef.current.delete(territoryId)` + trigger re-render. Already wired via `handleTerritoriesRefetched(territoryId)` for Abandon flow — Ably integration extends the same hook. |
| **3000-entry cache cap with viewport-edge eviction (Session 15)** | Balances memory vs UX. Eviction never touches what's currently on screen — only features outside the viewport ring get dropped first. Re-fetching evicted features is cheap once they come back into view. |
| **Age-gated abort (1s threshold) over unconditional cancel (Session 15)** | Preserves intermediate viewport data when user pans fast. Recent fetches finish and populate the cache; only truly stale fetches (>1s) get killed. Single in-flight + skip-if-recent prevents pile-up. |
| **Merge-on-fetch over replace (Session 15)** | Visible features never blank during a pan. The FeatureCollection grows monotonically (bounded by cache cap), so the shape source is stable across fetches. |
| **150ms debounce on onCameraChanged (Session 15, down from 600ms on onMapIdle)** | Cache absorbs the resulting higher fetch frequency safely. Tight debounce gives near-immediate feedback on pan-end without the redundant fetches that caused the original perf problem. |
| **Zoom-simplify bug deferred (Session 15)** | Performance is good enough to develop on. Bug only affects wide zoom (≤zoom 14) on small polygons — most of the active gameplay happens at tighter zoom where everything renders. Fix when map polish lands; not blocking. |
| History writes use console.warn-only error handling | A history bug must never cause a player to lose XP, resources, or ownership |
| Currently-held rows count toward hold duration metrics | Player holding 30 days hits Rank 2 even before losing it |
| **Health Connect over expo-sensors Pedometer or raw step sensor (Session 16)** | Pedometer is foreground-only on Android per Expo docs. §6 daily challenges need background all-day reads (5k/10k/15k step tiers, Step Wall, Personal Records, anti-cheat). Background tracking is non-negotiable; HC is the only path that delivers it on Android. |
| **Custom Expo plugin over community `expo-health-connect` plugin (Session 16)** | Community plugin v0.1.1, last updated July 2024, 14 stars — predates RN 0.74+ New Arch changes. Custom in-repo plugin is surgical, owned, and easy to maintain at SDK upgrades. |
| **Kept New Architecture enabled (Session 16)** | `expo-doctor` showed no other New Arch issues. Disabling would add tech debt and have to be reverted at SDK 55 anyway. Better to solve the HC integration cleanly with a plugin than to disable a forward-compatible default. |
| **3-session split for step tracking (Session 16)** | Session A (this): HC verified standalone via debug screen. Session B: wire into ActivityScreen daily challenges. Session C: foreground service + GPS + live steps for Active Claim. Avoids debugging 3 integration points at once. |
| **Permanent HealthConnectDebugScreen, not temp (Session 16)** | Useful for the life of the project — every future HC bug (steps not syncing, permission revoked, background reads failing) starts with "what does HC actually return now?". Hidden behind long-press so no UI pollution. |
| **Long-press Profile commander name as hidden-debug trigger (Session 16)** | Invisible to real users, no UI pollution, reusable pattern for future debug screens (Ably state, BullMQ jobs, GPS drift). delayLongPress=1000ms is long enough to avoid accidental fires. |
| **`debug_events` is freeform event_type (no CHECK constraint) (Session 16)** | Disposable infrastructure for fast iteration. Adding new event types should never need a migration. RLS off, FK CASCADE on player_id. |
| **`logDebug()` is fire-and-forget with console.warn-only error handling (Session 16)** | Matches the `territory_history` pattern. A debug log failure must never block real gameplay or crash the screen. |
| Backfilled open rows excluded from ownershipChanges | Only completed holds count |
| Plain Jest config (testEnvironment: node), NOT jest-expo preset | formulas.js is pure CommonJS — jest-expo crashes on non-RN test files |
| Single test file sectioned with describe blocks | Easier to grep — all 348 tests run in one command |
| legacyRankName lookup uses object not array | Array with empty-string at index 0 caused `??` to skip fallback |
| When Cursor proposes shell commands for file edits: skip, redirect | Skip-then-redirect worked |
| Project knowledge sync habit established | Re-upload core libs whenever they change |
| POWER section sits above Influence on Profile | Power is §10 canonical ranking metric, Influence is a resource |
| Total Power hero shown even when 2 of 3 components blank | Better to show hero now with honest empty rows |
| calcContestWinXp + calcClaimXp return BASE XP only | Modifiers deferred to broader canonical-earn-calc wiring later |
| Atomic write of resource + xp in single .update() | Safer than separate writes |
| XP_PER_CONTEST_WIN naming wins over CONTEST_WIN_XP | Matches existing XP_PER_CHALLENGE pattern |
| SIEGE XP shown first in earned beat line | XP is the §5.7 lifetime record and outranks resources |
| Render-side check is a first-class diagnostic | If a UI change in the same file doesn't appear, the behaviour change isn't running |
| Reload Metro before testing JS-only changes | Stale bundle was a major debugging trap |
| Founder-only ACTIVATE (Marshal deferred) | Founder derived from `alliances.founder_id` — zero migration. Marshal needs `players.role` column |
| Server-side guards for alliance Morale via Supabase RPC | `deduct_alliance_morale` and `donate_morale` enforce invariants in SQL |
| Morale donate UI lives in Wallet (not War Room, not inline) | Contextual to where personal resources live |
| Modal bottom sheet (not new screen) for donate | One-decision flow — amount + confirm |
| OSM territories fetched by `osm_id`, not by name | Name matching is ambiguous and locale-fragile |
| `fetch-osm-polygons.js` reads territory list from Supabase | Adding a new city = add rows + rerun script. Zero code changes per city |
| One-off dev scripts live in project dir, gitignored | Easier to keep alongside the code; reusable for other cities |
| Custom layers on Mapbox Standard need `fillEmissiveStrength` + `lineEmissiveStrength = 1.0` | Otherwise night-preset ambient lighting dims layer colour |
| State-aware fillOpacity (case expression) | Saturation imbalance — per-state values compensate while preserving brief |
| Brand colours held against map-driven pressure | Solution was opacity tuning, not colour change |
| PostGIS lives in `postgis` schema, not `public` (Session 6) | Supabase's recommended pattern — separate schema isolates PostGIS types |
| RPC returns flat columns, not nested objects (Session 6) | Easier to debug, no nested null-relation surprises |
| Server-side ST_ForcePolygonCCW in RPC (Session 6) | PostGIS stores CW, GeoJSON/Mapbox require CCW. Fix at source |
| Server-side ST_IsValid + ST_NPoints >= 4 filter in RPC (Session 6) | One degenerate polygon silently broke entire Mapbox source. Filter at source |
| Single viewport RPC replaces two-phase fetch (Session 6) | ~10s+ → ~330ms |
| Light Mapbox style (`light-v11`) for dev, custom night at polish (Session 6) | Collapsed complex visual debugging into obvious binary check |
| Initial fetch waits for first onMapIdle, no hardcoded bbox (Session 6) | Single fetch code path handles every fetch |
| Delete degenerate territories rather than fix them (Session 6) | Weesperbuurt had 3 points, 0 m² area — no valid polygon to fix |
| DROP FUNCTION before CREATE when return shape changes (Session 6) | Postgres doesn't permit return-type changes via CREATE OR REPLACE |
| Mapbox `slot` semantics non-obvious, omit by default (Session 6) | Add slot only when layer-order problems are diagnosed |
| Never `git add .` — always specify files (Session 6) | One slip from leaking the service role key |
| Data-before-styling diagnostic (Session 6) | When fill + line + tap ALL fail on "valid" features, the cause is upstream — dump `JSON.stringify(rows[0].geojson)` first |
| **SPB envelope defined by KAD ring road (Session 13)** | OSM relation 1861646 (Cyrillic 'А-118'). Pargolovo excluded; Kronstadt only what's inside KAD. A bounded geographic envelope is essential — polygonising "all of SPB" with no border explodes to coastline + airports + farmland. |
| **Use OSM relation ID, not name, for non-Latin places (Session 13)** | OSM tags KAD as Cyrillic `А-118`; Latin `A-118` returns nothing. Looking up the relation in OSM and copying the numeric ID is the only reliable cross-locale approach. |
| **Service roads excluded from polygonisation (Session 13)** | Driveways and parking aisles run inside blocks, not between them — including them would shatter blocks into garages and rear lots. |
| **Hybrid 3-tier naming cascade (Session 13)** | Tier 1: OSM quarter (admin-level). Tier 2: 'Near <landmark>' within 100m. Tier 3: nearest street within 500m. Gives every block a human-recognisable name; cascade order matches how locals describe places (named neighbourhood > landmark > street). |
| **Merge floor 100m, ceiling 8000m (flag, don't auto-split) (Session 13)** | Sub-100m slivers always come from polygonisation noise — merge into largest-shared-edge neighbour. Above 8000m flag-don't-split because some genuine industrial blocks legitimately span large areas (e.g. shipyards, freight yards); auto-splitting destroys real game targets. Manual review separates them. |
| **Existing 485 OSM-named SPB territories never touched in Phase 1 (Session 13)** | Phase 1 was greenfield gap-fill only — touching named territories risks breaking already-claimable game state. Phase 2 (unifying the two pools) deferred. |
| **Temp tables kept post-session (Session 13)** | `gap_fill_*` and `spb_*` tables retained for ~1 week to enable rollback, oversize review, and follow-up disambiguation. Drop only after stable phone verification. |
| **Districts from OSM, not Google or Mapbox Geocoding (Session 14)** | Free. Matches Mapbox basemap labels. Polygons reusable for future district-level features (district leaderboards, district-level events). Geocoding APIs charge per-request and would cost real money at 7,810 lookups. |
| **Both admin_level=5 (район) AND admin_level=8 (okrug) fetched (Session 14)** | Okrug is the finer grain and more locally recognisable for disambiguation. Район kept as fallback when okrug spatial join misses. |
| **Centroid containment (not polygon intersection) for admin assignment (Session 14)** | Guarantees single-district per block. Polygon intersection would assign blocks to multiple districts when straddling a boundary, breaking the (territory_name, district) uniqueness constraint. |
| **200m snap radius for boundary-slop blocks (Session 14)** | 34 of 297 NULL-district blocks were within 200m of a district polygon — clear "centroid landed on the wrong side of the line" cases. Snap to nearest district. Beyond 200m, leave NULL — those are genuinely outside SPB admin and shouldn't be force-assigned. |
| **outside_spb_admin flag (Session 14)** | 263 blocks are inside KAD ring but outside SPB city admin (Lomonosov / Petergof SW corner, Zanevka E). Flagged rather than deleted because they're inside the playable envelope and players will walk through them. Distinct from genuinely-broken NULL districts. |
| **Hybrid disambiguation: landmark backfill first, numeric suffix as fallback (Session 14)** | Landmark backfill (250m POI search, wider than initial tier-2 100m) gives 2,154 of 7,013 duplicates a meaningful name ("Near St Isaac's Cathedral 2" beats "проспект Народного Ополчения 47"). Numeric fallback guarantees zero duplicates regardless. Two-pass beats one-pass because the second pass can rely on the first having already promoted easy wins. |
| **POI conflicts in landmark pass not pre-resolved (Session 14)** | If two duplicate blocks both rename to "Near St Isaac's Cathedral", let them. The numeric suffix pass then disambiguates them as "...Cathedral" and "...Cathedral 2". Simpler than greedy POI assignment. |
| **Numeric suffix ordering: north→south then west→east (Session 14)** | Stable, deterministic, and reproducible — anyone re-running the pipeline gets the same names. Players gradually learn that lower numbers are further north. |
| **Backend territory_name stays unique and complete; frontend handles display formatting (Session 14)** | Keeps disambiguation pure at the data layer. UI surfaces (chips, sheets, banners, claim text) each have different length budgets — best handled at the display call site via `formatTerritoryDisplayName()` rather than baking truncation into the canonical name. |
| **`public.territories.district` is generic, city-agnostic (Session 14)** | No okrug column, no outside_spb_admin column propagated to `territories`. District is the universal coarse label; SPB-specific concepts stay on temp tables. Adding Bengaluru / other cities doesn't need any new columns. |
| **`territory_name_v1` rollback column on gap-fill rows (Session 14)** | Cheap insurance against disambiguation bugs visible only on device. Drop after ~1 week of stable rendering. |
| **Verified originally-unique names preserved through disambiguation (Session 14)** | 850 names were unique pre-pass. All 850 verified untouched post-pass. The disambiguation functions are scoped to duplicates only — but verifying this empirically is cheap and catches regressions. |
| **`.gitignore` is the only file pushed for Sessions 13–14 (Session 14)** | All new scripts (fetch-spb-*, load-*-to-postgis.js) and all geojson outputs explicitly ignored. No secrets leaked. No app code changed in two sessions of heavy DB work — by design. |
| **10s polling cadence for ActivityScreen step reads (Session 17)** | Health Connect doesn't push events — it's read-only polling. 10s feels "live enough" for daily totals without battery cost. Polling is gated behind `useFocusEffect` so it only runs while ActivityScreen is focused. |
| **Permission banner + LOCKED tiers, not auto-prompt (Session 17)** | User controls the consent moment. Matches the HealthConnectDebugScreen pattern. The Steps-read permission is requested via an explicit GRANT PERMISSION button when the screen loads ungranted. |
| **Three separate atomic writes for cascaded tier completion (Session 17)** | §6.1 mandates each resolved tier pays out independently — Easy + Med + Hard each get their own `player_challenges` row, `activity_log` row, and player resource update when Hard crosses 15k. No batched single-write. |
| **`DEV_MODE_MANUAL` flag kept in source (Session 17)** | Mirrors `ActiveClaimScreen.DEV_MODE` pattern. Useful escape hatch for future HC debugging (permission revoked, sensor stops reporting, etc.). Default false; flip to true to bring back COMPLETE buttons without walking. |
| **Hardcoded Easy/Med/Hard step tiers in ActivityScreen (Session 17)** | Rotation pool (10 tasks per tier from §6.2) deferred to its own session. Step tracking works regardless of which task the rotation surfaces — current hardcoded tiers are the most common case anyway. |
| **Today's bar in weekly chart detected by position, not weekday (Session 17)** | `readWeeklySteps` always returns 7 rows ending today (idx 6). Bar highlight derived as `data.length - 1` — immune to weekday-indexing bugs and works across timezones. |
| **Smooth trend curve drawn as SVG overlay, pointerEvents="none" (Session 17)** | Bars remain independently tappable for step-count reveal. The curve is decorative, drawn via Catmull-Rom→Bézier conversion with tension 0.2 for a flowing rather than spiky look. Claim red for brand accent. |
| **Cascade verification deferred to first real 15k-step day (Session 17)** | Manual one-by-one tier writes proved the underlying write path. Synthesising a 15k step total just to verify the cascade loop wasn't worth the SQL setup; the logic is straightforward and reverting via SQL is cheap if it misbehaves. |
| **Steps-driven primary loop in ActiveClaimScreen, GPS only for vehicle filter + calibration (Session 18)** | Original GPS-as-distance approach was wrong per §7.3/§7.6 spec — "walk from anywhere", distance comes from steps × stride. Steps survive screen-off + pocket via Health Connect; GPS would have needed continuous foreground tracking just to be the source of truth, burning battery and creating jitter-driven false negatives. |
| **15-min Continuous Walk Rule extended from contests (§7.6) to claims (Session 18)** | Designer call. The rule's purpose — preventing AFK exploitation of long-distance progress bars — applies just as much to a 5km claim as to a contest. Worth a v6.11 spec addendum so the doc and code agree. |
| **GPS accuracy preset: BestForNavigation (Session 18)** | Anti-cheat integrity (clean speed signal for vehicle exclusion + stride calibration) outweighs the battery cost on what's typically a 5–60 min walk. Foreground service notification makes the battery cost transparent to the user anyway. |
| **Stale GPS-position threshold 5s (Session 18)** | Anything older than 5s shouldn't influence speed/distance calcs — a stale fix during a 10s poll tick can produce spurious vehicle-speed readings. 5s is short enough to reject staleness, long enough to tolerate occasional fix gaps in urban canyon. |
| **Rolling 10-sample stride calibration with mean (Session 18)** | Single-sample stride writes are too noisy. Rolling mean smooths over per-window GPS jitter while still tracking real changes in gait over time. Cap at 10 (FIFO eviction) so a recent gait change isn't drowned by ancient samples. Sanity bounds 0.4–1.1m reject implausible outliers before they enter the mean. |
| **Stride calibration qualifying window: accuracy 5–20m AND speed <25 km/h AND >30s (Session 18)** | Tight window to avoid contaminated samples (in-vehicle, lost-signal, transient bursts). **Lower bound on accuracy (5m) turned out too strict in practice — rejects clean outdoor signals.** Pending tune to 0m or 3m next session, gated on per-tick diagnostic logging. |
| **Zero-movement thresholds: 30s pause banner, 15-min full reset (Session 18)** | 30s is conservative enough that a stoplight wait doesn't fire the banner, but short enough that a real pause is visible immediately. 15-min matches §7.6's existing Continuous Walk Rule, applied to claims too. |
| **Foreground service notification "Dominia · Active Claim" with claim-red colour (Session 18)** | Required on Android 14+ for sustained GPS via `Location.startLocationUpdatesAsync` + TaskManager. Brand-consistent (Claim red #D64525). Notification icon is currently app icon — monochrome 24×24 PNG asset deferred (cosmetic only). |
| **`expo-task-manager` + module-level `latestTaskFix` + per-tick bridge into ref (Session 18)** | TaskManager tasks run outside React's lifecycle, so a module-level mutable variable is the cleanest hand-off. The poll tick reads-and-mirrors at the top of each 10s loop, which keeps all the React state in one place and avoids subscription gymnastics. Same pattern reusable for any other background sensor data we add later. |
| **Extracted `lib/claim.js` for pure math + Supabase I/O (Session 18)** | ActiveClaimScreen was approaching 800+ lines with all the calibration writers, speed calcs, and bridges inline. Extracting the pure functions makes them unit-testable later (alongside `lib/streak.js` and `lib/territory.js`) and clarifies what the screen does vs what the math does. Same pattern as `lib/streak.js` / `lib/territory.js`. |
| **`DEV_MODE_MANUAL=false` default in ActiveClaimScreen (Session 18, renamed from DEV_MODE=true)** | Mirrors ActivityScreen Session 17 pattern. Default false (real-walk mode) since the underlying step-tracking is now proven. Flip true to drop a COMPLETE NOW button for UI iteration without walking — useful for screen polish work that doesn't need to validate the math. |
| **Snapshot baseline step count from Health Connect on claim start (Session 18)** | All distance math is `(currentSteps − baseline − vehicleExcludedSteps) × strideM` — the baseline is the only thing the screen owns. HC handles the actual counting, so we never have to worry about catching every step event ourselves. Simple, robust to phone-locked walks, no drift accumulation. |
| **Snapshot resources before any test claim/contest going forward (Session 18 lesson)** | Couldn't prove a specific claim's resource delta from DB alone post-hoc — only saw current balances. From this session on: SELECT iron, stone, gold, morale, xp from players before any test, then diff after. Cheap insurance for future verification. |

---

## WORKING STYLE — ALWAYS FOLLOW THIS

Do not start coding immediately. Work conversationally:
- Explain what each screen or feature does before building it
- Show a wireframe or mockup when introducing a new screen
- Ask for confirmation before writing any code
- Wait for the user to say "yes" or "let's build it" before touching any files
- Once confirmed, provide the exact prompt to paste into Cursor's agent chat as a single copyable code block — one-click copyable, no inline prompts mixed with prose
- After Cursor builds it, wait for the user to check their phone and report back
- Give the user time to ask questions at every step
- Handle one screen or one fix at a time — never batch unrelated changes
- **For SQL: separate queries one at a time so user can verify each before proceeding.** Especially true for heavy PostGIS work — splitting also dodges the 60s SQL editor timeout.
- **When debugging: get evidence before theorising.** PowerShell-from-PC test, fetch wrapper logs, EXPLAIN ANALYZE in SQL editor, render-side check, and **raw-data dump (`JSON.stringify(rows[0])` before chasing style hypotheses)** are the fastest diagnostics. Cheapest binary test wins.
- **Filter / validate at the source, not at the client.** One bad row can silently break the whole UI. Server-side guards (PostGIS `ST_IsValid`, RPC argument checks, atomic transactions) are always cheaper than client-side defensive code.
- **When Cursor proposes shell commands (node -e, PowerShell) for tasks that are file edits:** SKIP, don't allowlist, redirect to use file tools only.
- **Never `git add .`** — always specify files. Local-only dev scripts and `.env` artefacts have already been kept out of the repo by this rule.
- **When the same problem resists multiple targeted fixes, the fix isn't another tweak — it's the architecture.** Session 5's wedge-transport problem became moot in Session 6 once the architecture changed; Session 13's "no SPB territories" problem became moot once the gap-fill pipeline replaced one-by-one OSM curation.
- **Crisp responses, recommend one option not pros/cons. No decisions without explicit user confirmation.**
