# DOMINIA — MASTER PROJECT STATE
Last updated: April 25, 2026

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
| Map screen | ✓ Branded | Dark-v11 Mapbox style, brand territory colours, sharp HUD pills, richer TerritorySheet with Influence readout, More/Less expandable section |
| Activity screen | ✓ Branded | Frozen COMMANDER header (live username/level/streak), daily challenges, achievements table (hardcoded), weekly chart |
| Profile screen | ✓ Branded | Frozen header, stat grid, XP progress, Influence hero block (hardcoded), territory rows, legacy titles (hardcoded), settings |
| Alliance screen | ✓ Branded | Member: mission card, top 3 contributors, roster, War Room button. Non-member: bounded scrollable alliance list (tap-to-join rows with founder username), confirm view, header hides during confirm, "create" footer link. |
| War Room screen | ✓ Branded | All theme tokens. Influence hero block, Morale full-width, Iron/Gold/Stone/Shield 2×2 grid, morale abilities. All hardcoded. |
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
| `lib/supabase.js` | Supabase client with AsyncStorage (URL/key hardcoded — env vars unreliable in RN) |
| `lib/clerk.js` | ClerkProvider tokenCache with SecureStore |
| `lib/auth.js` | ensurePlayer(clerkUserId, email) — uses maybeSingle() to find or create player row |
| `lib/level.js` | LEVELS array, getLevelForXp, getNextLevel, getXpProgress, territoryCap per level |
| `lib/streak.js` | updateStreakOnChallengeComplete — fires on first challenge completion of the day |
| `lib/territory.js` | Pure territory calculation helpers: streakTier, influencePerDay, contestWalkDistance, streakReductionPercent, developmentMultiplier, legacyRankMultiplier, etc. |
| `metro.config.js` | react-dom shim to fix @clerk/clerk-react bundling |
| `shims/react-dom-shim.js` | Empty module.exports shim |
| `screens/MapScreen.js` | Fully branded. Dark-v11 Mapbox style, brand territory colours, sharp HUD pills, richer TerritorySheet with Influence readout + More/Less expandable section |
| `screens/ActivityScreen.js` | Fully branded. Frozen COMMANDER header (live data from Supabase), daily challenges, achievements table (hardcoded), weekly chart |
| `screens/ProfileScreen.js` | Fully branded. Frozen header, stat grid, XP progress, Influence hero block (hardcoded), territory rows, legacy titles (hardcoded), settings |
| `screens/AllianceScreen.js` | Fully branded. Member: mission card, contributors, roster, War Room button. Non-member: bounded ScrollView alliance list (maxHeight 320), tap-to-join rows with founder username, confirm view with branded Archivo 900 name + body copy, confirmAlliance state at screen level so header hides during confirm. |
| `screens/WarRoomScreen.js` | Fully branded. All theme tokens. Influence hero block, Morale full-width, 2×2 resource grid, morale abilities. All hardcoded. |
| `screens/SignInScreen.js` | Fully branded. DOMINIA wordmark + ▪ claim mark, Geist Mono tagline, sharp inputs + Claim button. |
| `screens/UsernameScreen.js` | Fully branded. Sharp layout, Next pinned to bottom, 2-char minimum. |
| `screens/OnboardingScreen.js` | Fully branded. 5-step flow, typewriter animation, numbered rows, Mapbox dark-v11 map, resolvedPlayerId fallback, live username |
| `screens/ActiveClaimScreen.js` | Fully branded. Claim red ring (butt cap), sharp cards, Geist Mono labels. DEV_MODE=true — flip to false for real GPS. |
| `screens/ClaimSuccessScreen.js` | Fully branded. Solid Claim red square, typographic treatment. Writes owner_id + alliance_id to Supabase. |
| `screens/ContestResultScreen.js` | Fully branded. 4 states, animated square, consequence block, two-button CTA stack. Writes on attack_won. |
| `screens/CreateAllianceScreen.js` | Fully branded. 3-step founding flow (identity → HQ territory → confirm). HQ picked from player-owned territories (Home District mechanic deferred). |
| `screens/AllianceJoinedScreen.js` | Fully branded. Alliance green accent bar, Archivo 900 name, [TAG], italic subtitle, 2-col meta grid, 5 numbered benefit rows. Reads allianceName/shortName/city/memberCount from route.params. |
| `lib/territory.js` | Pure territory calculation helpers: streakTier(), developmentName(), developmentMultiplier(), legacyRankName(), legacyRankMultiplier(), baseInfluencePerDay(), influencePerDay(), streakCapForTier(), cappedStreakMultiplier(), contestWalkDistance(), streakReductionPercent() |
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
| Client Trust disabled in Clerk | Disabled during dev. Needs proper 2FA or email OTP re-enabled before production. |
| Clerk email verification disabled | Disabled for dev. Must re-enable before production. |
| Real step tracking broken | `Pedometer.getStepCountAsync()` unsupported on Android. Health Connect removed — native crash. Steps hardcoded to 0. DEV_MODE=true on ActiveClaimScreen. |
| Defender flow deferred | Needs Ably real-time layer — not worth building a throwaway version. |
| Onboarding home pin verification not implemented | 500m proximity check deferred — home pin saves lat/lng but no verification step. |
| Auth flow order wrong | New users hit sign-up before seeing any game content (Steps 0+1). Fix deferred until after branding complete. |
| War Room + Profile values hardcoded | War chest resources, Influence, top 3 contributors, morale ability costs all hardcoded. Needs Supabase schema + queries + role gating for ACTIVATE buttons. |
| Achievements table hardcoded | Distance, Calories, Active Minutes need HealthKit/Health Connect before real data possible. |
| Legacy Titles on Profile hardcoded | Needs Supabase wiring once real title data exists. |
| ProfileScreen colour constants not on theme tokens | Still uses local hex constants (CLAIM, INK, INK2 etc) — needs refactor to lib/theme.js. |
| player_number hardcoded as #0004 | Sequential player_number column in Supabase not yet added. |
| Territory sheet history data hardcoded | Held for X days (14), changed hands count (6), Hall of Holders count (12) all hardcoded. No history table in DB yet. |
| Legacy Rank hardcoded R1 | No legacy_rank column in DB yet — influencePerDay() defaults to Rank 1 (Unproven). |
| Draggable bottom sheet deferred | More/Less toggle on territory sheet is a workaround — gorhom/bottom-sheet deferred until it can be batched into an EAS build. |
| Home District mechanic incomplete | CreateAlliance HQ picker shows player-owned territories only. Spec says should show 5 nearest OSM territories. Deferred. |
| Invite non-player flow missing | AllianceJoined copy references inviting by username, but no share/invite link flow exists yet. Needs building before launch. |

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

**ALL MVP SCREENS ARE FULLY BRANDED. ✓**

**Immediate:** Wire up first real data to War Room or Profile — decide which resource (Influence, War Chest, or roster stats) to pull from Supabase first, build the query, remove the hardcoded placeholder. Start by pasting WarRoomScreen.js into chat.

**Branding order — COMPLETE:**
1. ✓ Tab bar
2. ✓ Profile screen
3. ✓ Alliance screen + War Room
4. ✓ Activity screen
5. ✓ Onboarding screen
6. ✓ Map screen
7. ✓ Sign In, Username
8. ✓ Active Claim, Claim Success, Contest Result
9. ✓ Create Alliance, Alliance Joined

**Data / mechanics backlog:**
- Wire War Room + Profile Influence/war chest to real Supabase data
- Refactor ProfileScreen colour constants to lib/theme.js tokens
- Fix auth flow order (new users should see Steps 0+1 before sign-up)
- Add territory history table (held days, changed hands, Hall of Holders)
- Add legacy_rank column to territories table
- Real step tracking — try expo-sensors Pedometer.watchStepCount()
- Draggable bottom sheet — gorhom/bottom-sheet when batching EAS build
- Invite non-player flow (share/invite link before launch)
- Home District mechanic — 5 nearest OSM territories for HQ picker
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
