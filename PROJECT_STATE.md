# DOMINIA — MASTER PROJECT STATE
Last updated: May 15, 2026 (Phase 5a complete — `activity_log` table live, 3 event-write sites wired, Activity Power rendering on Profile via `get_activity_stats_30d` RPC. nish_s Activity Power = 995.)

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
| EAS Build | Free | 30 builds/month (15 Android + 15 iOS). **~13 Android used, ~17 remaining.** |
| Cursor | Pro | No usage limits on AI edits |

---

## SUPABASE SCHEMA

**Tables:**

`players`: id, username, level, xp, home_city, alliance_id, created_at, clerk_id, has_onboarded, home_pin_lat, home_pin_lng, current_streak, longest_streak, last_active_date, iron, stone, gold, morale, lifetime_contest_wins, lifetime_defence_wins

`territories`: id, territory_name, tier, perimeter_distance, owner_id, alliance_id, development_level, longitude, latitude, created_at, legacy_rank, upkeep_overdue, osm_id (bigint), osm_type (text), geojson (jsonb), geom (postgis.geometry(Polygon, 4326)), **district (text, nullable, indexed — NEW Session 14)**, **territory_name_v1 (text, nullable — NEW Session 14, rollback backup on gap-fill rows only, drop after ~1 week of stable rendering)**

`alliances`: id, name, short_name, city, created_at, founder_id, morale

`player_challenges`: id, player_id, challenge_key, completed_at, date — UNIQUE constraint on (player_id, challenge_key, date)

`territory_history`: id, territory_id, owner_id, alliance_id (nullable), claimed_at, lost_at (nullable = currently held), backfilled (boolean), created_at

**`activity_log` (NEW Session 16 — Phase 5a):** id (uuid PK), player_id (uuid FK → players(id) ON DELETE CASCADE), event_type (text, CHECK: `'challenge_completed' | 'territory_claimed' | 'contest_participated' | 'km_walked'`), xp_amount (int, default 0), km_amount (numeric, nullable — stays NULL until step tracking lands), challenge_count (int, default 0), contest_count (int, default 0), territory_id (uuid, nullable), challenge_key (text, nullable), metadata (jsonb, nullable), created_at (timestamptz, default now()). RLS off. Single row per event (not aggregated daily roll-up) — aggregation happens on RPC read.

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
- `idx_activity_log_player_created` ON activity_log(player_id, created_at DESC) — powers rolling 30-day RPC
- `idx_activity_log_event_type` ON activity_log(event_type)

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
- **NEW Session 16 (Phase 5a):**
  - `get_activity_stats_30d(p_player_id uuid)` — rolling 30-day SUM across xp_amount, km_amount, challenge_count, contest_count. SECURITY DEFINER, `SET search_path = public`, COALESCE-protected zeros. Returns flat row: `{ xp_30d, km_30d, challenges_30d, contests_30d }`. Called by ProfileScreen → `calcActivityPower()` → renders Activity row + Total Power hero.
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
| Activity screen | ✓ Live data | Daily challenges with live XP + resource earning (calcResourceEarn()). Challenge XP fixed: easy 50, medium 150, hard 400. **Writes `activity_log` row (event_type='challenge_completed', challenge_count=1, xp_amount=earned) AFTER atomic player update succeeds. console.warn-only on failure — never blocks gameplay.** |
| Profile screen | ✓ Live data | POWER section above Influence. **Activity Power now LIVE** — calls `get_activity_stats_30d` RPC → `calcActivityPower()` → renders live Activity row. Total Power hero updates from all 3 components. Territory + Legacy already live. nish_s Activity Power = 995 = (1760×0.5) + (0×3) + (9×10) + (1×25). km component runs at 0 until step tracking lands. My Resources ghost button → WalletScreen. |
| Alliance screen | ✓ Branded | Join/create flow, roster, collective mission. War Room button passes allianceId, allianceName, shortName as nav params. |
| War Room screen | ✓ Live data | Live alliance Influence/day. Live war chest Morale only. All 6 abilities with correct costs. ACTIVATE buttons wired (Founder only) via `deduct_alliance_morale` RPC. |
| Wallet screen | ✓ Live data | Live resource fetch on open. 4 resources with glyphs + balances. Morale row → bottom modal sheet (custom amount + DONATE ALL) → `donate_morale` RPC. |
| Onboarding screen | ✓ Branded | 5-step flow, typewriter animation, numbered rows, Mapbox dark-v11 home pin map, resolvedPlayerId fallback, live username on Step 4 |
| Sign In screen | ✓ Branded | DOMINIA wordmark + ▪ claim mark, Geist Mono uppercase tagline, sharp inputs, Claim red button |
| Username screen | ✓ Branded | Sharp layout, Next button pinned to bottom, 2-char minimum enforced |
| Active Claim screen | ✓ Branded | Claim red ring (butt cap), sharp cards, Geist Mono labels, INK background, DEV_MODE=true |
| Claim Success screen | ✓ Live data | Atomic write of Gold reward + Siege XP via single .update().select(). Tier fetched via .select('tier').single(). **Writes `activity_log` row (event_type='territory_claimed', xp_amount=siegeXp, territory_id) AFTER atomic player update succeeds. console.warn-only on failure.** |
| Contest Result screen | ✓ Live data | 4 states. attack_won: close-out → territories → INSERT new history row, atomic write of iron/gold/morale + Siege XP + lifetime_contest_wins increment via single .update().select(). **Writes `activity_log` row (event_type='contest_participated', contest_count=1, xp_amount=branch reward) on ALL 4 outcomes per v6.10 §2152 ('contest participations, win or lose'). Cancelled contests naturally bypass (screen only renders on resolved outcomes). attack_won verified on device; 3 other branches code-wired but unverified (defence states need Ably).** |
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
| `metro.config.js` | react-dom shim to fix @clerk/clerk-react bundling |
| `shims/react-dom-shim.js` | Empty module.exports shim |
| `screens/MapScreen.js` | **PostGIS viewport-based architecture with client-side feature cache.** Single RPC call to `get_territories_in_viewport` per fetch. `featureCacheRef` (Map keyed by territory id) holds previously fetched features; new fetches **merge** into cache, never replace. ~3000-entry cap with viewport-edge eviction. Debounce 150ms on `onCameraChanged`. **Age-gated abort:** only cancels in-flight fetches older than 1s; recent ones complete and populate cache. Skip-if-recent-in-flight prevents pile-up. `handleTerritoriesRefetched(territoryId)` clears the cache entry on Abandon before refetch. Diagnostic logs (`[vp fetch] START / OK / ABORTED / ERROR / SKIP`) still in place — strip when zoom-simplify bug resolved. Feature builder reads FLAT fields. styleURL = `mapbox://styles/mapbox/light-v11` (dev). |
| `screens/ActivityScreen.js` | Daily challenges with live XP + resource earning. **Writes `activity_log` row (event_type='challenge_completed') after `player_challenges` insert + atomic player update succeed.** |
| `screens/ProfileScreen.js` | POWER section above Influence. **POWER FULLY LIVE** — calls `get_activity_stats_30d` RPC, runs result through `calcActivityPower()`, renders Activity row + updates Total Power hero. Territory + Legacy already live. |
| `screens/AllianceScreen.js` | Join/create flow, roster, mission. |
| `screens/WarRoomScreen.js` | All 6 abilities. ACTIVATE wired (Founder only) via `deduct_alliance_morale` RPC. |
| `screens/WalletScreen.js` | 4-resource view. Morale row → donate modal → `donate_morale` RPC. |
| `screens/SignInScreen.js` | Fully branded. |
| `screens/UsernameScreen.js` | Fully branded. 2-char minimum. |
| `screens/OnboardingScreen.js` | Fully branded. 5-step flow. |
| `screens/ActiveClaimScreen.js` | Fully branded. DEV_MODE=true. |
| `screens/ClaimSuccessScreen.js` | Atomic Gold + Siege XP write. **Writes `activity_log` row (event_type='territory_claimed') after atomic player update succeeds. INSERT runs OUTSIDE atomic update — gameplay state never rolls back on a logging failure.** |
| `screens/ContestResultScreen.js` | 4 states. attack_won: close-out → territories → INSERT → atomic player update. **Writes `activity_log` row (event_type='contest_participated', contest_count=1) on ALL 4 outcomes per v6.10 spec. xp_amount = whatever the branch awards.** |
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

# Force-stop app on phone (required after lib/supabase.js changes)
# Long-press app icon → App info → Force stop

# Diagnose "is the server slow or the phone slow" — run from PowerShell:
$headers = @{ "apikey"="<key>"; "Authorization"="Bearer <key>" }
Measure-Command { Invoke-RestMethod -Uri "<full-url>" -Headers $headers }

# Save to GitHub — NEVER use `git add .` (too easy to commit secrets or dev scripts)
git status
git add <specific files>
git commit -m "message"
git push
```

**EAS build budget:** 30/month. ~13 Android used, ~17 remaining. Only build for new native modules. Batch all native installs into one build.

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
| **3 of 4 ContestResultScreen branches unverified on device** | activity_log INSERT wired in all 4 outcomes; only attack_won tested live (rows confirmed). attack_lost, defence_won, defence_lost code-wired but defender states need Ably to test cleanly. Trust until naturally testable. |
| Real step tracking broken | `Pedometer.getStepCountAsync()` unsupported on Android. Health Connect crashed natively. expo-sensors `watchStepCount()` fallback untested. DEV_MODE=true on ActiveClaimScreen. **`activity_log.km_amount` stays NULL until this lands; Activity Power runs at 3/4 components.** |
| Defender flow deferred | Needs Ably real-time layer. |
| Abandon flow not built | Must UPDATE open territory_history row when built. |
| Onboarding home pin verification not implemented | 500m proximity check deferred. |
| Auth flow order wrong | New users hit sign-up before seeing any game content. |
| Achievements table hardcoded | Distance, Calories, Active Minutes need HealthKit/Health Connect. |
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
| `territory_name_v1` rollback column on gap-fill rows | Drop after ~1 week of stable rendering on phone. |
| 5 temp tables alive in DB | `gap_fill_roads_spb`, `gap_fill_pois_spb`, `gap_fill_blocks_spb`, `spb_districts`, `spb_okrugs`. Keep ~1 week for oversize review + rollback, then drop. |

---

## DEFERRED / OUT OF SCOPE

- Real step tracking — Health Connect failed, expo-sensors fallback not yet tried, deferred due to EAS budget
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

**MVP SCREENS BRANDED ✓ | GAME MATH ENGINE COMPLETE ✓ | RESOURCE ECONOMY ✓ | TERRITORY HISTORY + LEGACY RANK ✓ | 348 TESTS PASSING ✓ | SIEGE XP WIRED ✓ | POWER SECTION FULLY LIVE ✓ | WAR ROOM ACTIVATE WIRED ✓ | MORALE DONATION LIVE ✓ | POSTGIS VIEWPORT FETCH ✓ | SPB FULL CITY COVERAGE: 8,295 TERRITORIES, NAMED, DISAMBIGUATED, DISTRICT-ASSIGNED ✓ | MAP RENDER PERFORMANCE TILE-LIKE ✓ | PHASE 5a ACTIVITY_LOG + ACTIVITY POWER LIVE ✓**

**Immediate — real step tracking integration.** Replace `DEV_MODE=true` fake interval in ActiveClaimScreen with real km/step data; populate `activity_log.km_amount`; light up the 4th Activity Power component (currently runs at 3/4). Likely involves an EAS build (15 Android + 15 iOS fresh allocation available). **Decide approach early in session before building** — three candidates:
1. Revisit Health Connect (last attempt crashed natively — investigate why)
2. Try `expo-sensors` `Pedometer.watchStepCount()` (untested fallback)
3. Evaluate a third-party SDK

Expect debugging-heavy session given track record on this project. Ably is **not** next — doing Ably before step tracking would mean shipping multiplayer feel on top of a fake-interval claim system. Step tracking closes the 4th Activity Power component, fixes the DEV_MODE flow, and is single-player scope (no backend phase required).

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

**Queued — tests for `lib/streak.js` and `lib/territory.js`:**
- Agree on Supabase mocking strategy (manual mock vs jest.mock vs in-memory fake), then both files in one session.

**Queued — frontend display helper:**
- Write `formatTerritoryDisplayName(name)` — strip 'Near ' prefix on tight surfaces, truncate long Cyrillic names, hide bureaucratic POI asset codes (e.g. `СО17-2873`). Wire when first touching a display surface that hits the long-name cases.

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
- Phase 4.8 ✓ — SPB full city coverage (Sessions 13–14): KAD envelope, 7,810 gap-fill blocks, 3-tier naming, district + okrug spatial join, hybrid disambiguation
- Phase 5a ✓ — activity_log table + 3 event-write sites + get_activity_stats_30d RPC + ProfileScreen wiring (Session 16)
- Phase 5b ○ — Real step tracking → populates km_amount → 4th Activity Power component live (NEXT)
- Phase 5c ○ — Backend: cron for Total/Alliance Power, Ably real-time, defender flow

**Other backlog:**
- Implement Clerk-JWT-based RLS on all tables (before production)
- Strip diagnostic console.logs once stable
- Move TERRITORY_CAP_BY_LEVEL into formulas.js
- Refactor ProfileScreen colour constants to lib/theme.js
- Fix auth flow order
- `players.role` column migration → wire Marshal role for War Room ACTIVATE
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
| react-native-health-connect removed | Native crash on load |
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
| **ALTER over DROP for partial existing `activity_log` table (Session 16)** | Discovered 17 rows of dev test data already in a partial activity_log table from an earlier session. ALTER added the 4 missing columns + CHECK constraint + FK CASCADE + 2 indexes without losing the rows. Lower-risk than DROP, and no consumer was reading the table yet so historical rows could be normalised in place (event_type renames). |
| **Single row per event, not aggregated daily roll-up (Session 16)** | Simpler writes, no race conditions on concurrent events. Aggregation happens on RPC read via SUM. Cheap at current scale — revisit if scan cost becomes a concern. |
| **Separate `challenge_count` + `contest_count` columns over CASE WHEN in queries (Session 16)** | One-pass SUM in `get_activity_stats_30d` RPC. Storage cost is negligible; query simplicity wins. |
| **`activity_log` INSERT runs OUTSIDE the atomic player update, not inside (Session 16)** | Gameplay state must never roll back on a logging failure. Pattern: atomic .update().select() succeeds first → INSERT runs after → console.warn-only on failure. Mirrors the existing `territory_history` write pattern (the Pitfall #5 principle: a history bug must never cost a player XP, resources, or ownership). |
| **All 4 ContestResultScreen outcomes write `activity_log` (Session 16)** | Per v6.10 spec §2152 — "contest participations, win or lose". contest_count=1 always; xp_amount = whatever the branch awards. Cancelled contests naturally bypass because ContestResultScreen only renders on resolved outcomes. |
| **`km_amount` NULLABLE until step tracking lands (Session 16)** | Activity Power runs at 3/4 components for now. NULL is honest — distinguishes "no km data yet" from "0 km walked". `calcActivityPower()` treats NULL as 0 for the calc but the column stays NULL for future analytics. |
| **Step tracking before Ably (Session 16)** | Closes the 4th Activity Power component, fixes the DEV_MODE=true claim flow, single-player scope. Ably requires backend phase first (Fastify + BullMQ); doing Ably before step tracking would mean shipping multiplayer feel on top of a fake-interval claim system. |
| **Verify-and-trust on the 3 unverified contest branches (Session 16)** | attack_lost, defence_won, defence_lost code-wired identically to attack_won (which is verified). Defence states need Ably to test cleanly. Naturally testable when defender flow ships — not worth blocking on now. |
| History writes use console.warn-only error handling | A history bug must never cause a player to lose XP, resources, or ownership |
| Currently-held rows count toward hold duration metrics | Player holding 30 days hits Rank 2 even before losing it |
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
