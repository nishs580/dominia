# DOMINIA — MASTER PROJECT STATE
Last updated: May 19, 2026 (Session 20 — All three Session 19 bugs CLOSED. Bug 1 (screen-focus-bound polling) fixed by rearchitecting ActiveClaimScreen — new `lib/claimState.js` with shared module-level state + subscribe/emit + AsyncStorage snapshot; TaskManager task now owns the 10s calibration tick on the location-event stream (gated by `now - lastTickAt >= 10000`); screen is a pure consumer that subscribes and re-renders on emit. Bug 2 (GPS speed always 0) resolved as side-effect — non-zero realistic walking speeds confirmed (0.057–6.485 km/h + one 40 km/h jitter spike). Bug 3 (duplicate challenge writes on remount) fixed with DB-level idempotency: ActivityScreen `onCompleteChallenge` insert now chains `.select()` and inspects 23505/empty-rows, bailing before downstream writes on duplicate; `challengesLoaded` boolean gates the auto-complete watcher until completedKeys is hydrated from DB. Indoor lock-the-phone test: 23 ticks in 4 min (~10.4s cadence), 4 qualifying calibration ticks, claim of улица Хошимина (Small) completed cleanly with no duplicates on tab-switch remount. Next session: backend phase kickoff — Fastify + BullMQ + Ably scaffolding.)

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
| Animations | react-native-svg | ✓ Installed |
| Fonts | @expo-google-fonts/archivo + geist-mono + inter + expo-splash-screen | ✓ Installed |
| Navigation | @react-navigation/native-stack + bottom tabs | ✓ Working |
| Test runner | Jest 29.7 + jest-expo (downgraded from Jest 30 via `npx expo install --fix` in Session 19 — tests still green) | ✓ 348 tests passing |
| Backend (future) | Node.js + Fastify | Not started |
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
| SPB test home pin | Palace Square (jittered) for nish_s, Rubik, TINA, Alyona — reset 13 May for SPB testing |
| KAD ring road | OSM relation 1861646 (Cyrillic 'А-118') — defines SPB playable envelope |

---

## SUBSCRIPTIONS & LIMITS

| Service | Plan | Key limits |
|---|---|---|
| Supabase | Pro | Micro compute, ~$25/month all-in ($10 compute credit covers Micro). PostGIS 3.3.7 enabled in `postgis` schema. |
| Mapbox | Free | 50,000 map loads/month |
| Clerk | Free | 10,000 MAU |
| EAS Build | Free | 30 builds/month (15 Android + 15 iOS). **~18 Android used, ~12 remaining.** |
| Cursor | Pro | No usage limits on AI edits |

---

## SUPABASE SCHEMA

**Tables:**

`players`: id, username, level, xp, home_city, alliance_id, created_at, clerk_id, has_onboarded, home_pin_lat, home_pin_lng, current_streak, longest_streak, last_active_date, iron, stone, gold, morale, lifetime_contest_wins, lifetime_defence_wins

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
| Active Claim screen | ✓ Branded | Claim red ring (butt cap), sharp cards, Geist Mono labels, INK background, DEV_MODE=true |
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
| `lib/claim.js` | Claim-time helpers including `isQualifyingCalibrationWindow(...)`. **Session 19: return shape changed from `bool` → `{ qualifies, rejectReason }` where `rejectReason ∈ {'accuracy_low','accuracy_high','speed_high','window_short', null}`. Check order: accuracy_low → accuracy_high → speed_high → window_short.** All callers updated. Designed to power per-tick reject-reason histograms via `debug_events` (proved valuable in Session 19: revealed Bug 2 — speed=0 on every tick — in a single SQL query). |
| `lib/debug.js` | `logDebug(playerId, eventType, payload)` — fire-and-forget Supabase write to `debug_events`. Console.warn-only error handling, matches territory_history pattern. NEW Session 16. |
| `lib/claimState.js` | **NEW Session 20.** Module-level shared state for the active-claim flow + tiny subscribe/emit API + AsyncStorage snapshot. Exports: mutable `claimState` object (active, territoryId, playerId, perimeterM, distanceM, liveSteps, livePace, strideM, lastSpeedKmh, lastAccuracyM, lastRejectReason, lastQualifies, bannerState, gpsFixReady, completed, etc.); `subscribe(fn)` / `emit()` (listeners Set, try/catch around each fn call); `setTick(partial)` merges partial state + bumps `lastTickAt` + emits + fire-and-forget `snapshotToStorage()`; `startClaim({...})` / `endClaim()` lifecycle setters; `snapshotToStorage()` writes `JSON.stringify(claimState)` to AsyncStorage key `dominia.claimState.v1`; `rehydrateFromStorage()` reads back on screen mount. Bridges the TaskManager task (writer) and ActiveClaimScreen (reader). Survives screen unmount, screen sleep, and app kill (rehydrate on next mount). |
| `metro.config.js` | react-dom shim to fix @clerk/clerk-react bundling |
| `shims/react-dom-shim.js` | Empty module.exports shim |
| `plugins/withHealthConnect.js` | Custom Expo config plugin. Injects `HealthConnectPermissionDelegate.setPermissionDelegate(this)` into MainActivity.kt `onCreate` at prebuild time (anchor regex `/super\.onCreate\(.+?\)/` matches both `savedInstanceState` and `null` forms — Expo SDK 54 uses `null`). Adds `PermissionsRationaleActivity`, `ViewPermissionUsageActivity` activity-alias, and `com.google.android.apps.healthdata` `<queries>` tag. Owned in-repo over the community `expo-health-connect` plugin (last updated July 2024, predates RN 0.74+ New Arch). NEW Session 16. |
| `screens/MapScreen.js` | **PostGIS viewport-based architecture with client-side feature cache.** Single RPC call to `get_territories_in_viewport` per fetch. `featureCacheRef` (Map keyed by territory id) holds previously fetched features; new fetches **merge** into cache, never replace. ~3000-entry cap with viewport-edge eviction. Debounce 150ms on `onCameraChanged`. **Age-gated abort:** only cancels in-flight fetches older than 1s; recent ones complete and populate cache. Skip-if-recent-in-flight prevents pile-up. `handleTerritoriesRefetched(territoryId)` clears the cache entry on Abandon before refetch. Diagnostic logs (`[vp fetch] START / OK / ABORTED / ERROR / SKIP`) still in place — strip when zoom-simplify bug resolved. Feature builder reads FLAT fields. styleURL = `mapbox://styles/mapbox/light-v11` (dev). |
| `screens/ActivityScreen.js` | **Health Connect wired (Session 17). DB-level idempotency on challenge completion (Session 20).** 10s poll of today's steps via `useFocusEffect` + `setInterval` (note: this poll is separate from the claim loop — ActivityScreen's HC poll is screen-focus-bound by design, no claim happening here). Live tier progress UI, permission banner with GRANT PERMISSION button, auto-complete watcher that cascades Easy → Med → Hard. **Session 20 fix:** `challengesLoaded` boolean (default false, set true only after initial `player_challenges` fetch completes) gates the auto-complete watcher to close the race window where remount could fire writes before `completedKeys` was hydrated from DB. `onCompleteChallenge` insert now chains `.select()` and inspects the return — error code `23505` (unique_violation) OR empty rows array → bail with `return` BEFORE any XP/resource/activity_log/level/streak writes. Duplicate path refetches authoritative `xp` + `current_streak` to correct optimistic-UI drift. Non-duplicate errors `throw` to the existing catch (rolls back optimistic UI). Each tier still writes player_challenges + player update + activity_log independently per §6.1, but ONLY on genuine first-time insert. `DEV_MODE_MANUAL` constant at top of file gates COMPLETE buttons for manual testing — **currently TRUE (left flipped after Session 20 idempotency testing; flip back to false when no longer needed for manual challenge testing)**. Real weekly steps chart (`readWeeklySteps` HC read + group by local day key, today always last index, liveSteps overlay via Math.max) with bone-highlighted today bar, tap-to-reveal step count, and smooth Claim-red SVG `<Path>` trend curve (Catmull-Rom→Bézier, tension 0.2) drawn over bar tops via absolute-positioned `<Svg>` overlay with `pointerEvents="none"` so bars remain tappable. |
| `screens/ProfileScreen.js` | POWER section above Influence. Long-press on headerBlock (commander name, delayLongPress=1000) navigates to HealthConnectDebug. Same pattern reusable for future debug screens. |
| `screens/AllianceScreen.js` | Join/create flow, roster, mission. |
| `screens/WarRoomScreen.js` | All 6 abilities. ACTIVATE wired (Founder only) via `deduct_alliance_morale` RPC. |
| `screens/WalletScreen.js` | 4-resource view. Morale row → donate modal → `donate_morale` RPC. |
| `screens/SignInScreen.js` | Fully branded. |
| `screens/UsernameScreen.js` | Fully branded. 2-char minimum. |
| `screens/OnboardingScreen.js` | Fully branded. 5-step flow. |
| `screens/ActiveClaimScreen.js` | Fully branded. DEV_MODE=true. **Bug 1 fix (Session 20): rearchitected — TaskManager task owns the 10s calibration tick; screen is a pure consumer.** The `useFocusEffect` + `setInterval` poll has been REMOVED. The `TaskManager.defineTask(LOCATION_TASK_NAME, ...)` callback at module scope now runs the full tick logic (HC step read, vehicle filter, distance accumulation, calibration window, banner state, completion-flag write via `claimState.completed`, `DIAG_CALIBRATION` write to `debug_events`). The task fires on every location event (1s cadence from foreground service) but the tick body is gated by `now - claimState.lastTickAt >= POLL_INTERVAL_MS` to preserve the 10s cadence. All step/calibration/GPS refs that were component-scope (baselineSteps, lastSteps, calibrationWindowStart, calibrationSamples, currentStrideM, lastGpsFix, bannerStateModule, halfwayResetTimer, etc.) moved to module scope and survive screen unmount. The component now: rehydrates from AsyncStorage on mount (`rehydrateFromStorage()` from `lib/claimState.js`), calls `startClaim({...})` to reset shared state, subscribes to claimState emits via `subscribe()` + `useReducer` bump to force re-renders, reads ALL displayed values from `claimState.*` (distance, banner, steps, pace, stride, hcPermission), drives the progress ring Animated.Value from `claimState.distanceM / claimState.perimeterM` in a useEffect, watches `claimState.completed` and navigates to ClaimSuccess/ContestResult when it flips true (option B: task writes flag, screen owns navigation), and calls `endClaim()` on unmount only if not navigating cleanly. Foreground-service start/stop effect and HC permission init kept. **`DIAG_CALIBRATION` flag still default true** — writes one `claim_calibration_tick` row to `debug_events` per tick with `{ accuracyM, speedKmh, windowMs, stepsInWindow, gpsDistM, candidateStride, qualifies, rejectReason }`. Indoor verification (Session 20): 23 ticks in 4 min lock-the-phone test = ~10.4s cadence, realistic non-zero speeds (Bug 2 resolved as side-effect). |
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
| `app.json` | Plugins: expo-location, expo-sensors, expo-build-properties (minSdkVersion 26), **`./plugins/withHealthConnect.js`**. Android permissions include `android.permission.health.READ_STEPS`, `android.permission.health.READ_HEALTH_DATA_IN_BACKGROUND`, `android.permission.ACTIVITY_RECOGNITION`. |
| `eas.json` | EAS build profiles. **Preview profile (Session 19): `developmentClient: false` explicitly + `MAPBOX_DOWNLOADS_TOKEN` env reference. Default scaffolded preview profile was incomplete.** Used for standalone-APK outdoor walk tests (no Metro / no PC tether). |
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

# ADB — package name confirmation (Session 20)
# The correct Dominia package name is com.nish_s.dominia (UNDERSCORE, not nishs580).
# Always confirm before any install/uninstall:
adb shell pm list packages | findstr dominia
# Force-stop + uninstall (e.g. when switching from preview APK back to dev APK):
adb shell am force-stop com.nish_s.dominia
adb uninstall com.nish_s.dominia

# EAS build — BEFORE EVERY BUILD run this first:
npx expo install --fix
# Then build:
eas build --profile development --platform android

# EAS standalone preview APK (Session 19 — no Metro / no PC tether for outdoor walk tests)
eas build --profile preview --platform android
# Install via EAS dashboard URL or QR — APK runs without dev server.
# Requires: eas.json preview profile has developmentClient:false + MAPBOX_DOWNLOADS_TOKEN env ref,
# AND all EXPO_PUBLIC_* keys present in EAS preview env (see below).

# EAS env vars (separate system from legacy `eas secret:list`)
eas env:list --environment preview                          # list
eas env:list --environment preview --include-sensitive      # reveal values
eas env:create --environment preview --name EXPO_PUBLIC_FOO --type string --visibility plaintext
# CRITICAL: --name is the literal KEY (EXPO_PUBLIC_*); the VALUE is prompted afterwards.
eas env:delete --variable-name "EXPO_PUBLIC_FOO"            # no --environment flag
# Pre-flight check before any build (catches missing env vars):
Get-ChildItem -Recurse | Select-String "process\.env\.EXPO_PUBLIC_"

# Inspect EAS legacy secrets (e.g. MAPBOX_DOWNLOADS_TOKEN — applies across all build profiles)
eas secret:list

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

# Calibration-tick inspection SQL (Session 19 — diagnostic for ActiveClaimScreen calibration loop)
SELECT created_at, payload->>'accuracyM' AS acc_m, payload->>'speedKmh' AS spd_kmh,
       payload->>'windowMs' AS win_ms, payload->>'stepsInWindow' AS steps,
       payload->>'gpsDistM' AS gps_m, payload->>'candidateStride' AS stride,
       payload->>'qualifies' AS ok, payload->>'rejectReason' AS reason
FROM debug_events
WHERE event_type='claim_calibration_tick'
  AND player_id='94a9036e-1d59-49ae-9b5f-eae064913fbf'
ORDER BY created_at DESC LIMIT 30;
# Reject-reason histogram for a session:
SELECT payload->>'rejectReason' AS reason, COUNT(*)
FROM debug_events
WHERE event_type='claim_calibration_tick'
  AND created_at > now() - interval '2 hours'
GROUP BY 1 ORDER BY 2 DESC;

# Resource snapshot SQL — ALWAYS run before AND after any test action (Lesson Session 18 + 19)
# NOTE: activity_log has NO per-resource delta columns. Only xp_amount, km_amount, metadata jsonb,
# challenge_count, contest_count, event_type, occurred_at, created_at. (Session 20 correction)
# Resource deltas must be inferred from player table snapshots before/after, attributed by
# matching the timestamp to the corresponding activity_log event_type.
SELECT id, xp, level, iron, stone, gold, morale, current_streak, longest_streak
FROM players WHERE username='nish_s';
SELECT event_type, xp_amount, km_amount, challenge_count, contest_count, metadata, occurred_at, created_at
FROM activity_log WHERE player_id='94a9036e-1d59-49ae-9b5f-eae064913fbf'
ORDER BY created_at DESC LIMIT 20;

# Duplicate-write detection (Session 20 — Bug 3 surveillance)
# These counts must always match per tier per day. If activity_log > player_challenges,
# the cascade has a duplicate-write bug — see Pitfall #29.
SELECT challenge_key, COUNT(*) AS pc_count
FROM player_challenges
WHERE player_id='94a9036e-1d59-49ae-9b5f-eae064913fbf' AND date=CURRENT_DATE
GROUP BY challenge_key;
SELECT metadata->>'challenge_key' AS challenge_key, COUNT(*) AS al_count
FROM activity_log
WHERE player_id='94a9036e-1d59-49ae-9b5f-eae064913fbf'
  AND event_type='challenge_completed'
  AND created_at::date = CURRENT_DATE
GROUP BY metadata->>'challenge_key';
```

**EAS build budget:** 30/month. ~18 Android used, ~12 remaining. Only build for new native modules. Batch all native installs into one build.

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

**26. Default scaffolded EAS preview profile is incomplete (Session 19)**
- **Signature:** First standalone preview APK crashes on launch with an undefined Mapbox token, or builds without honouring `developmentClient: false` and tries to connect to Metro.
- **Cause:** The auto-scaffolded `eas.json` preview profile omits both `developmentClient: false` and the `MAPBOX_DOWNLOADS_TOKEN` env reference, and EAS preview environment ships with **no** `EXPO_PUBLIC_*` env vars even if those keys exist as legacy `eas secret:list` entries.
- **Fix:** Preview profile MUST explicitly set `developmentClient: false` AND reference `MAPBOX_DOWNLOADS_TOKEN`. Add every `EXPO_PUBLIC_*` key the JS bundle reads to the EAS preview environment (`eas env:create --environment preview --name EXPO_PUBLIC_X ...`). Pre-flight grep before every preview build: `Get-ChildItem -Recurse | Select-String "process\.env\.EXPO_PUBLIC_"`. The cost of skipping the grep is one wasted EAS build (out of 30/month).

**27. `eas env:create --name` is the literal KEY, not the value (Session 19)**
- **Signature:** EAS env var ends up with the secret value as its name and an empty value, visible in `eas env:list`.
- **Cause:** Reading the CLI prompt wrong — `--name EXPO_PUBLIC_MAPBOX_TOKEN` is correct; the value is prompted afterwards interactively.
- **Fix:** Delete the bad entry with `eas env:delete --variable-name "<NAME>"` (note: no `--environment` flag accepted on delete). Re-create with `--name` set to the literal key string and paste the value at the prompt that appears after.

**28. Screen-focus-bound `setInterval` halts background polling when screen sleeps (Session 19, ARCHITECTURAL — RESOLVED Session 20)**
- **Signature:** Outdoor walk for ~60 min yielded only ~31 calibration ticks (expected ~360 at 10s cadence). Every tick reported `speedKmh: 0`. Health Connect step total was still correct because HC reads after-the-fact, so the claim still completed — but stride calibration never qualified, calibration writes / progress UI / vehicle-filter were all dead.
- **Cause:** `ActiveClaimScreen` drove its 10s distance/calibration loop via `useFocusEffect` + `setInterval`. The moment the screen loses focus (phone in pocket, screen off, another app), the interval pauses. The TaskManager-to-poll bridge (`latestTaskFix → lastGpsFixRef`) was also not delivering GPS fixes to the poll — downstream consequence of the same architecture.
- **Fix (Session 20):** TaskManager.defineTask now OWNS the full tick logic. Task runs on every location event (1s cadence from foreground service); body is gated by `now - claimState.lastTickAt >= 10000` to preserve the 10s cadence. Task writes to module-level `claimState` (new `lib/claimState.js`) with subscribe/emit + AsyncStorage snapshot. Screen subscribes and re-renders on emit; reads ALL displayed values from `claimState.*`; watches `claimState.completed` flag and owns navigation. Bug 2 (speedKmh always 0) resolved as a side-effect — successive fixes are now available on the location-event stream for `computeSpeedKmh`. Indoor verification: 23 ticks in 4 min = ~10.4s cadence with realistic non-zero speeds.
- **General lesson:** any setInterval/useEffect work that must continue with screen off belongs in a TaskManager task. The screen should subscribe to shared state, not drive a timer.

**29. Component-scope idempotency guards die on remount; UNIQUE constraint is silent (Session 20, Bug 3 root cause)**
- **Signature:** Multiple `challenge_completed` rows in `activity_log` for the same `challenge_key + date`, but only ONE row in `player_challenges` (the UNIQUE constraint correctly blocks the duplicate row). Player resources / XP / level all over-paid by the duplicate count. Triggered by tab switches, app foreground/background cycles — anything that unmounts and remounts the screen during a session.
- **Cause:** ActivityScreen's `onCompleteChallenge` did `await supabase.from('player_challenges').insert(...)` with no `.select()` and no return-value check. The UNIQUE conflict raised an error but the code awaited only the promise and did not inspect the result, so downstream XP / resource / activity_log / level writes fired unconditionally. In-memory guards (`inFlightTiersRef`, `completedKeys`, `isCompleting`) all reset on unmount; the load effect re-hydrates `completedKeys` from DB but is async, opening a race window where the auto-complete watcher could fire before hydration.
- **Fix (Session 20):** (1) Chain `.select()` on the insert and inspect the return — error code `23505` (unique_violation) OR empty rows array → bail with `return` BEFORE downstream writes. Non-duplicate errors `throw` to the existing catch (rolls back optimistic UI). (2) Added `challengesLoaded` boolean (default false, true only after the initial `player_challenges` fetch completes); the auto-complete watcher is gated on it. (3) Duplicate-bail path refetches authoritative `xp` + `current_streak` to correct optimistic-UI drift.
- **General lesson:** any idempotent operation that crosses a DB boundary needs DB-level enforcement, not component-state guards. In-memory state is ephemeral; UNIQUE constraints are permanent. Always chain `.select()` on inserts that have a UNIQUE constraint, inspect the return for empty arrays, and gate downstream writes on the insert-actually-happened path.

**30. Async load effects open race windows with watcher effects (Session 20)**
- **Signature:** A watcher effect with a dependency array including async-loaded state can fire BEFORE the async load completes — using default/empty state and reaching wrong conclusions.
- **Cause:** `useEffect` with dependencies fires whenever any dependency changes. If `playerId` resolves before `completedKeys` (which it does — `setCompletedKeys` is the LAST setter in the load function), the watcher sees `playerId !== null` and `completedKeys.size === 0` and starts firing for tiers that are actually already done.
- **Fix:** Add a "loaded" boolean (e.g. `challengesLoaded`) set to true ONLY after every async setter in the load effect completes. Watcher guard: `if (!loaded) return`. Cheap, durable.
- **General lesson:** when a watcher effect depends on data that loads asynchronously, gate the watcher on a separate "loaded" flag. The dependency-array model isn't enough — React doesn't know which states are derived from the same async load.

**Debugging playbook — when something is slow or broken:**
1. **PowerShell-from-PC test** — if fast on PC + slow on phone, it's the dead-pool bug or a client-side issue
2. **Fetch wrapper logs** — `[supabase fetch]` timing tells you whether the network call is slow
3. **EXPLAIN ANALYZE in SQL editor** — tells you if the database query is slow
4. **Render-side check** — does a UI change in the same file appear on device? If not, you're on a stale bundle. Reload Metro before debugging the code.
5. **Force-stop the app** after `lib/supabase.js` changes — long-press app icon → App info → Force stop.
6. **Dump raw data first when rendering breaks** — `JSON.stringify(rows[0].geojson)` BEFORE chasing style hypotheses (Pitfall #12).
7. **For heavy spatial queries:** split into smaller steps, add planar ST_DWithin prefilter before geography ST_DWithin, and check ST_IsValid before any ST_Union (Pitfalls #16, #18).
8. **Snapshot resources in ONE SQL block immediately BEFORE and AFTER every test action** (Session 18 + 19 lesson, twice-reinforced). Mid-session forensics on live DB data gives ambiguous answers; controlled before/after is the only reliable way to attribute deltas to specific events. Same applies to local UI state — resource UI must reflect DB on every focus/return, never cached values.
9. **Verify EAS env vars match what the JS bundle reads BEFORE kicking a build.** Pre-flight grep: `Get-ChildItem -Recurse | Select-String "process\.env\.EXPO_PUBLIC_"`. Cost of skipping: one wasted EAS build (Pitfall #26).
10. **Get evidence before theorising.**

---

## OPEN BUGS

| Bug | Detail |
|---|---|
| **Nested / overlapping SPB territories (NEW Session 14 — STILL DEFERRED)** | Spotted on phone visual test after gap-fill propagation. Some gap-fill blocks overlap each other and/or overlap existing OSM-named SPB territories. Root cause unknown — could be (a) OSM-named territory containing one or more gap-fill blocks, (b) gap-fill block containing another gap-fill block, (c) partial overlap from polygonisation edges, or any combination. Diagnostic query needed: find all pairs where `postgis.ST_Overlaps(a.geom, b.geom)` or `postgis.ST_Contains(a.geom, b.geom)` is true beyond a tiny tolerance. Group results by overlap type before deciding handling per type (likely delete smaller / sub-tier or merge into larger). |
| **onMapIdle viewport re-fire unreliable (Session 6 — RESOLVED differently this session)** | ~~Fixed.~~ Replaced `onMapIdle` flow with `onCameraChanged` (150ms debounce) + client-side cache + merge-on-fetch. Pan/zoom now feels tile-like — visited areas stick, new areas populate reliably. Cache absorbs the higher fetch frequency safely. |
| **Zoom-level rendering: some small polygons missing at wide zoom (NEW this session, DEFERRED)** | At Mapbox scale ~500m/750m (zoom ~13–14), some territories that exist in DB do not render; same area at tighter zoom (≤250m, zoom ≥15) shows them. `get_territories_in_viewport` applies `postgis.ST_SimplifyPreserveTopology` with tolerance 0.00005° at zoom 12–14 and 0.0002° at zoom 10–12. Hypothesis: simplification collapses small polygons below the `ST_NPoints >= 4` filter threshold, hiding them. Diagnostic query drafted (count survives-simplify vs total in viewport) but not run. Fix likely: scale `simplify_tolerance` down further or only apply `ST_NPoints >= 4` to the un-simplified geom. Defer to map polish phase — performance is good enough to develop on. |
| **37 SPB gap-fill blocks flagged_oversize = true** | Perim > 8000m, manual visual review deferred. Examples: block #9771 'улица Демьяна Бедного' at 7052m perim (street name on a huge block — suspicious). |
| **Some OSM POI names are bureaucratic asset codes** | e.g. 'Near СО17-2873 N' as a tier-2 landmark name. Fix at frontend display layer (formatTerritoryDisplayName) when display surfaces are touched. |
| Diagnostic logs still in MapScreen.js | `[vp fetch] START / OK / ABORTED / ERROR / SKIP` + older `[geojson diag]`, `[shape source feed]`, `[feature builder]`, `[render]`. Keep until zoom-simplify + nested-territories bugs solved, then strip. AbortError logs are noise, not failures — they confirm the system is correctly cancelling stale requests. |
| Dead RPCs in Supabase | `get_all_territories_meta` and `get_territories_geojson_batch` no longer called. Safe to drop. |
| `retry-failed-polygons.js` has hardcoded service role key | Local-only file (never committed) but key must move to env var before file ever leaves the local machine. |
| RLS missing on all tables | Disabled to fix slow load. Re-enable with Clerk-JWT-based RLS before production. |
| Client Trust + email verification disabled in Clerk | Both disabled for dev. Re-enable before production. |
| Real step tracking in ActiveClaimScreen | Health Connect drives ActivityScreen daily challenges (Session 17). ActiveClaimScreen still on `DEV_MODE=true` (fake interval). **Session 19 added `DIAG_CALIBRATION` per-tick logging via `debug_events` and verified a real claim end-to-end on a standalone APK, but the 10s poll architecture is the next thing to replace (Bug 1).** Session C target: foreground service + GPS + live HC step reads, owned by a TaskManager background task. |
| Cascade auto-completion partially verified (NEW Session 17, UPDATED Session 19) | Manual one-by-one tier writes verified end-to-end (Session 17). **Session 19 outdoor walk: Easy + Medium daily challenges auto-completed mid-walk via Health Connect — confirms the cascade path on a real walking day.** Hard (15k) not yet crossed in a single session; true single-tick cascade (Hard crossing auto-completing Med + Easy in the same poll) still unverified but very low-risk given the tiered write path is otherwise proven. |
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
| lib/streak.js + lib/territory.js have no unit tests | Both do Supabase I/O — mocking strategy is the gating decision. |
| player_number hardcoded as #0001 | Sequential column not yet added. |
| Siege XP constants exist with no writers | XP_PER_DEFENCE_WIN, XP_RECONQUEST, XP_PER_DEV_TIER_REACHED, XP_ALLIANCE_MISSION, XP_STREAK_MILESTONE — each wires when feature arrives. |
| lifetime_defence_wins schema placeholder | No writer until defender flow ships. |
| Legacy Power inputs partial | titlesEarned + championshipWins hardcoded to 0. |
| Draggable bottom sheet deferred | gorhom/bottom-sheet — batch into next EAS build. |
| Home District mechanic incomplete | CreateAlliance HQ picker uses player-owned only. Spec: 5 nearest OSM. |
| Invite non-player flow missing | No share/invite link flow yet. |
| POI icons on Standard night basemap | Currently overridden by `light-v11` dev style. Will resurface at polish phase. |
| `formatTerritoryDisplayName()` not yet written | Frontend display formatter — strip 'Near' prefix on tight surfaces, truncate long Cyrillic names, hide bureaucratic asset codes. Build when first touching the relevant display surface. |
| 5 temp tables alive in DB | `gap_fill_roads_spb`, `gap_fill_pois_spb`, `gap_fill_blocks_spb`, `spb_districts`, `spb_okrugs`. **~3 days remaining of the ~1-week grace window** for oversize review + rollback, then drop. |
| `territory_name_v1` rollback column on gap-fill rows | **Same ~3-day grace window remaining** before drop. Drop together with the 5 temp tables. |

---

## DEFERRED / OUT OF SCOPE

- Real step tracking — Health Connect verified read-only foreground (Session 16); wired into ActivityScreen daily challenges with 10s poll + live weekly chart (Session 17); standalone APK end-to-end claim verified on a real outdoor walk (Session 19). Session C remaining: TaskManager-owned distance loop + foreground service GPS + live HC step reads for ActiveClaimScreen (Bug 1 — next session). Per-tick `DIAG_CALIBRATION` already in place to validate.
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

**MVP SCREENS BRANDED ✓ | GAME MATH ENGINE COMPLETE ✓ | RESOURCE ECONOMY ✓ | TERRITORY HISTORY + LEGACY RANK ✓ | 348 TESTS PASSING ✓ | SIEGE XP WIRED ✓ | POWER SECTION ✓ | WAR ROOM ACTIVATE WIRED ✓ | MORALE DONATION LIVE ✓ | POSTGIS VIEWPORT FETCH ✓ | SPB FULL CITY COVERAGE: 8,295 TERRITORIES, NAMED, DISAMBIGUATED, DISTRICT-ASSIGNED ✓ | MAP RENDER PERFORMANCE TILE-LIKE ✓ | HEALTH CONNECT READ-ONLY VERIFIED ✓ | ACTIVITY SCREEN LIVE STEP-DRIVEN ✓ | STANDALONE PREVIEW APK BUILT + END-TO-END CLAIM VERIFIED ON A REAL OUTDOOR WALK ✓ | CLAIM LOOP TASKMANAGER-OWNED, SCREEN-SLEEP RESILIENT ✓ | CHALLENGE CASCADE DB-LEVEL IDEMPOTENT ✓**

**Immediate — Backend phase kickoff: Fastify + BullMQ + Ably scaffolding.**

This is the foundation for defender flow, real-time multiplayer cache invalidation (already-stubbed hook in `MapScreen.js`), and FCM push. First-session scope to discuss at the start of next session:

1. Where the backend lives — separate repo (`dominia-backend`) vs mono-repo subfolder
2. Deployment target — Railway / Fly / Render — research and pick
3. Auth strategy — Clerk JWT verification middleware first
4. First endpoint — likely a stub `/healthcheck` + Clerk-verified `/me`
5. Whether to wire Ably at the same time or land Fastify first

The dev build is still installed on phone from Session 20. No EAS build needed at the start of the next session; just `npx expo start --dev-client --host lan` + ADB reverse and Metro reconnects.

**Outdoor walk validation of Bug 1/2/3 fixes — DEFERRED to a natural preview-build moment.** The indoor lock-the-phone test in Session 20 exercised the exact failure mode (screen sleeps, task continues) and passed cleanly. Bug fixes are correctness, not performance — they either work or they don't. No dedicated preview build for this validation; fold it into the next preview build whenever that naturally happens (e.g. validating Ably real-time, validating defender flow on the move, etc).

**Backlog — after backend foundation lands, pick next:**

- **`formatTerritoryDisplayName` helper** — clean up bureaucratic POI asset codes (e.g. `Near СО17-2873 N`), strip `Near ` prefix on tight surfaces, truncate long Cyrillic names. Cheap, high-visibility polish.
- **Tests for `lib/streak.js` and `lib/territory.js`** — Supabase mocking strategy is the gating decision. Both files in one session once strategy is agreed.
- **Daily Achievements live data** — wire Distance, Calories Burnt, Active Minutes via additional `readRecords` calls (Distance, TotalCaloriesBurned, ExerciseSession). Today/Best logic needs persistent best storage.

**Queued — deferred map work (revisit at polish phase):**
- Nested / overlapping SPB territories investigation — diagnostic query for `postgis.ST_Overlaps` / `postgis.ST_Contains` pairs, group by overlap type, decide handling per type
- Zoom-level simplification fix — diagnostic count of survives-simplify vs total in viewport, then scale tolerance down or move `ST_NPoints >= 4` to un-simplified geom
- Strip diagnostic logs in MapScreen.js (`[vp fetch] *`, `[geojson diag]`, etc.)
- Drop dead RPCs (`get_all_territories_meta`, `get_territories_geojson_batch`)
- Phone visual review of 37 `flagged_oversize` blocks
- Drop `territory_name_v1` rollback column once gap-fill names verified stable (grace window expired — do at start of next clean session)
- Drop 5 temp tables (`gap_fill_*`, `spb_*`) — grace window expired, do at start of next clean session
- Flip `DIAG_CALIBRATION` to false (or remove) — keep on for now while still building new claim functionality
- Flip `DEV_MODE_MANUAL` on ActivityScreen.js back to false when no longer needed for manual challenge testing (currently TRUE, left flipped after Session 20 idempotency testing)

**Queued — Ably real-time integration (~1 hour when backend lands):**
- Subscribe to `territory:updated` channel
- On event, call `featureCacheRef.current.delete(territoryId)` and trigger re-render
- Integrates cleanly with existing `handleTerritoriesRefetched(territoryId)` pattern already in MapScreen.js

**Queued — Amsterdam gap-fill:**
- Rerun the SPB pipeline pattern on Amsterdam envelope. Expected ≤30 new fill blocks. Validate same pipeline is idempotent across cities before adding Bengaluru / other cities.

**Queued — tests for `lib/streak.js` and `lib/territory.js`:**
- Agree on Supabase mocking strategy (manual mock vs jest.mock vs in-memory fake), then both files in one session.

**Queued — Phase 5a:**
- Raw events written to `activity_log` table; recompute Activity Power on read (Option A — no cache).
- Three event-write sites: ClaimSuccessScreen, ContestResultScreen, ActivityScreen.
- `km_amount` column NULL until step tracking lands.

**Queued — Map Session 3 (polish):**
- Switch styleURL back to custom night Studio style.
- First Claim visual pulse for Level 1-2 players on Smalls.
- Tier-aware visual treatment.
- Level-gate visual states.
- Territory tier audit across both Amsterdam and SPB.

**Queued — frontend display helper:**
- Write `formatTerritoryDisplayName(name)` — strip 'Near ' prefix on tight surfaces, truncate long Cyrillic names, hide bureaucratic POI asset codes (e.g. `СО17-2873`). Wire when first touching a display surface that hits the long-name cases.

**Queued — housekeeping decision:**
- Reconcile Jest version drift: state doc previously said "Jest 30, no jest-expo preset"; package.json is now Jest 29.7 + jest-expo (after `npx expo install --fix` in Session 19). Tests still 348/348 green — decide whether to revert package.json to 30 or accept 29.7 + jest-expo as the new baseline.

**Formula Build Phases:**
- Phase 1 ✓ — XP, level, streak, contest distance, challenge XP
- Phase 2 ✓ — Influence/day + Territory Power on Profile
- Phase 3 ✓ — Resource economy
- Phase 4 ✓ — territory_history + live Legacy Rank
- Phase 4.5 ✓ — Siege XP wired, POWER section, lifetime_contest_wins live
- Phase 4.6 ✓ — War Room ACTIVATE, Morale donation, OSM polygons for original 10 territories
- Phase 4.7 ✓ — PostGIS migration, viewport RPC, Amsterdam dataset (Session 6)
- Phase 4.8 ✓ — SPB full city coverage (Sessions 13–14): KAD envelope, 7,810 gap-fill blocks, 3-tier naming, district + okrug spatial join, hybrid disambiguation
- Phase 5a ○ — activity_log table + 3 event-write sites
- Phase 5b ○ — Backend: Activity Power read-side once step tracking lands + cron for Total/Alliance Power

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
| **Standalone preview APK over dev-build-with-Metro for outdoor walk tests (Session 19)** | One-time cost: 1 EAS build + 4 EAS env vars + 1 eas.json edit. Permanent unlock for all future real-walk verification (Phase 5a wiring, calibration tunes, anti-cheat, defender flow on the move, etc.). Wi-Fi-tethered dev builds were not viable outdoors. |
| **`isQualifyingCalibrationWindow` return shape `bool` → `{ qualifies, rejectReason }` (Session 19)** | Per-tick reject-reason histograms via `debug_events` proved valuable in a single SQL query: revealed Bug 2 (speed always 0) immediately, which a boolean return would have hidden. Reject reasons follow a strict check order: `accuracy_low → accuracy_high → speed_high → window_short`, so the first failing condition wins and the histogram tells you exactly which threshold is biting. |
| **`DIAG_CALIBRATION` defaults `true` for current preview builds (Session 19)** | Diagnostic logging cost is one row per 10s tick (~360/hour at full operation, ~31/hour in current screen-focus-bound reality). Fire-and-forget via `logDebug()` — no UX impact. Flip to false (or remove) once Bug 1 + Bug 2 are fixed and calibration thresholds are tuned. Until then, every walk produces a reject-reason histogram for the next session's first SQL query. |
| **Bug 3 (resource accounting) deferred behind Bug 1 + Bug 2 (Session 19)** | Mid-session forensics on live DB data gives ambiguous answers — Stone +35 and Morale +5 deltas without a clear `activity_log` source row can't be resolved without controlled writes from a clean baseline. Doing forensics now risks chasing a phantom. Fix the architectural bug first, then run controlled before/after SQL on a fresh walk. |
| **EAS preview env vars added even when keys are also hardcoded in source (Session 19)** | Supabase URL/anon key and Clerk publishable key are hardcoded in `lib/supabase.js` and `App.js` (env vars unreliable at RN runtime — earlier Decision Log entry). The 4 `EXPO_PUBLIC_*` keys are added to EAS preview anyway for future hygiene: when env-var support stabilises or when we want a single source of truth, the keys are already wired. Cost is near-zero. |
| **Snapshot resources BEFORE and AFTER every test action — twice burned, twice learned (Session 19, originally Session 18)** | Session 19 saw a "Gold -10 ghost" that was actually a stale UI state issue (Profile screen refresh corrected it). Lesson: local resource UI must reflect DB on every focus/return, and the only reliable way to attribute deltas to specific events is one SQL block immediately before and one immediately after each test action. Never trust mid-session UI state for resource accounting. |
| **TaskManager task owns the claim loop; screen is a pure consumer (Session 20, Bug 1 fix)** | Three options evaluated: (A) extend the existing TaskManager task with the 10s tick, (B) spin up a new dedicated Android foreground service, (C) hybrid TaskManager-for-GPS + separate `lib/claimLoop.js` setInterval module. Chose A — the task is already alive during a claim, already on the location-event stream, already survives screen sleep. Smallest architectural delta and closest match to "screen consumes, doesn't drive." B was overkill for a 60–90 min claim window; C added a second lifecycle to manage when one already exists. Validation: indoor lock-the-phone test produced 23 ticks in 4 min (~10.4s cadence) on the dev build. |
| **Module-level ref + AsyncStorage snapshot for shared claim state, not DB row (Session 20)** | Three options evaluated: (A) module-level mutable object + tiny subscribe/emit, (B) AsyncStorage-only (slow reads, durable), (C) live DB row in Supabase / `debug_events`. Chose A + AsyncStorage snapshot piggybacked on `setTick`. Module ref is the fast UI read path (instant, no async); snapshot survives the realistic failure mode (app killed in pocket — rehydrate on cold start). `debug_events` calibration ticks already give us the audit trail, so a third DB write per tick would be redundant. Smallest moving parts, fastest UI. |
| **Task writes `claimState.completed` flag; screen owns navigation (Session 20, option B for completion)** | Two options: (A) task detects threshold and triggers navigation, (B) task writes a flag, screen subscribes and navigates on next emit. Chose B — TaskManager runs outside React, has no nav context. If the screen is asleep when threshold is crossed, navigation fires the instant the user wakes it — which is the correct UX (you do not want navigation firing while phone is locked and in pocket). |
| **DB-level idempotency for challenge cascade, not better in-memory guards (Session 20, Bug 3 fix)** | Session 19 created 3x medium + 2x easy `challenge_completed` rows because the in-memory guards (`inFlightTiersRef` + `completedKeys`) reset on component remount during the 1hr walk's foreground/background cycles. Fix: chain `.select()` on the `player_challenges` insert and inspect the return; on `23505` (unique_violation) OR empty rows array, `return` before any downstream writes. In-memory state dies on unmount; the UNIQUE constraint is permanent. The right place to enforce single-pay is at the DB row, not in component refs. |
| **`challengesLoaded` boolean gates the auto-complete watcher (Session 20, Bug 3 fix)** | Even with DB-level idempotency in place, the auto-complete watcher could fire writes for the duration of the async `player_challenges` load on remount — every fire would hit the duplicate-bail path but still cost a network round-trip. Adding `challengesLoaded` (set true only after the initial fetch completes) closes the race window entirely. Defense in depth — the watcher does not even try until state is hydrated. |
| **Skip dedicated outdoor walk validation for Bug 1/2/3; fold into next natural preview build (Session 20)** | Two paths considered: (A) kick a fresh preview build now for a 30-45 min outdoor walk, (B) start backend on the current dev build and validate outdoors at the end of a future backend session that needs a preview build anyway. Chose B. The architectural fix passed the indoor lock-the-phone test (same code path: screen sleeps, task continues). Bug fixes are correctness, not performance — they either work or they don't. Outdoor adds GPS noise but no new code path. Costs 1 fewer EAS build now (~13 remaining → ~13). |

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
