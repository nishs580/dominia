# DOMINIA — MASTER PROJECT STATE
Last updated: May 29, 2026 (Sessions 40–44 — **Progression module CORE COMPLETE**, slices 1–5 shipped)

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
| Editor | Cursor — Agent chat (Ctrl+L). Claude writes directly to files. Always check phone after Cursor makes changes. **Cursor remembers a stale working directory if a folder moves on disk — always `File → Open Folder` on the right repo before pasting a prompt.** |
| Device | OnePlus Android |
| Screen mirror | scrcpy — run `scrcpy` to mirror phone to PC for sharing errors |
| Mobile GitHub | github.com/nishs580/dominia |
| Mobile local path | `C:\Users\nisha\dominia` |
| Backend GitHub | github.com/nishs580/dominia-backend (**PRIVATE**) |
| Backend local path | `C:\Users\nisha\dominia-backend` |
| Backend live URL | https://dominia-backend-production.up.railway.app |

**TWO REPOS — ALWAYS BE EXPLICIT:**
- Every Cursor prompt must state which repo it targets before paste.
- Every Warp command sequence must start with the matching `cd`.
- Shorthand: `[MOBILE: C:\Users\nisha\dominia]` or `[BACKEND: C:\Users\nisha\dominia-backend]` at the top of the prompt block.

---

## STACK

**Mobile (`dominia` repo):**

| Layer | Technology | Status |
|---|---|---|
| Mobile | React Native + Expo SDK 54 | ✓ Running |
| Maps | Mapbox GL (`@rnmapbox/maps`) | ✓ Working |
| Database (client) | Supabase JS — anon key | ✓ Connected (Pro plan, Micro compute) |
| Auth | Clerk (`@clerk/clerk-expo`) | ✓ Working end to end |
| Location | expo-location | ✓ Installed |
| Sensors | expo-sensors | ✓ Installed |
| Health | react-native-health-connect 3.x | ✓ Working (read-only, foreground verified) |
| Animations | react-native-svg | ✓ Installed |
| Fonts | @expo-google-fonts/archivo + geist-mono + inter + expo-splash-screen | ✓ Installed |
| Navigation | @react-navigation/native-stack + bottom tabs | ✓ Working |
| Push notifications | `@react-native-firebase/app` + `@react-native-firebase/messaging` ^22.2.0 (namespaced API — v23 modular migration is a future task) | ✓ Working end to end |
| Test runner | Jest 29.7 + jest-expo (mobile, 348 tests) · `tsx --test` (backend, **193+ tests across 14+ files** — 55 progression + 12 shared/formulas + 54 me/ + 77 alliance) | ✓ All passing |

**Backend (`dominia-backend` repo):**

| Layer | Technology | Status |
|---|---|---|
| Runtime | Node.js 22 (pinned via `engines` + `.nvmrc`) | ✓ Running on Railway |
| Server | Fastify 5 + TypeScript (ES2022 / ESM / strict) | ✓ Live |
| Hosting | Railway (europe-west4 edge), auto-deploy on push to `main` | ✓ Deployed |
| Auth | `@clerk/backend` `verifyToken` (stateless, JWKS-verified) | ✓ Live (`requireAuth` Fastify preHandler) |
| Database (server) | `@supabase/supabase-js` — **service role key** (bypasses RLS) | ✓ Live |
| ORM | Prisma 7.8 (`@prisma/client` + adapter-pg, 13 models, schema introspected from live Supabase) | ✓ Live (singleton + adapter-pg) |
| Timezone derivation | `tz-lookup` 6.1 (pure JS, ~1MB, offline IANA lookup) | ✓ Live |
| Redis client | `ioredis` 5.x — singleton in `shared/redis.ts`, BullMQ-compatible config | ✓ Live |
| Redis (server) | Railway Redis plugin — REDIS_URL via reference variable `${{Redis.REDIS_URL}}` (private network); local dev uses `REDIS_PUBLIC_URL` | ✓ Live |
| Job queue | BullMQ 5.x — **4 queues LIVE**: `contestExpiryQueue` (one-shot, 23:59 home_pin expiry), `quietHoursPushQueue` (delayed FCM dispatch at next 05:00 local), `streakRolloverQueue` (repeatable cron `0 0 * * *` per distinct home_timezone), `streakBreakWarningQueue` (repeatable cron `55 23 * * *` per distinct home_timezone). jobIds use hyphens not colons; for tz-based jobs: `streak-rollover-${tz.replace(/\//g, '-')}` so `Europe/Moscow` → `streak-rollover-Europe-Moscow`. | ✓ Live |
| Real-time | Ably (free tier — Pub/Sub, 6M msg/month). `Ably.Rest` singleton in `shared/ably.ts`. 4 events live on `contest:<id>` channel: `contest_attacker_started_walking`, `contest_progress`, `contest_resolved`, `contest_expired`. Mobile Realtime client not yet wired. | ✓ Live |
| Validation | `zod` | ✓ Live |
| Push notifications | **Firebase Admin (FCM)** — `firebase-admin` v12+ singleton in `shared/firebase.ts`. 4 push kinds: `defender_notify`, `contest_won`, `contest_lost`, `streak_break_warning`. Quiet Hours 23:00–05:00 in player.home_timezone enforced at send site (enqueues delayed BullMQ job). `streak_break_warning` uses `sendImmediately` (not `sendPush`) to deliberately bypass Quiet Hours since 23:55 IS inside the window and spec mandates the push fires. Stale-token cleanup matches 3 error codes. | ✓ Live end to end |

---

## BACKEND ARCHITECTURE — MODULE STRUCTURE (target end-state)

The backend follows a module-based architecture. Every session builds toward this exact structure — no throwaway code. New modules are added as features land.

```
dominia-backend/
├── src/
│   ├── modules/
│   │   ├── player/                  ✓ LIVE — all routes on Prisma
│   │   │   ├── routes.ts            // GET /me ✓ · PATCH /me ✓
│   │   │   ├── service.ts           // getMe ✓, updateMe ✓ (username + has_onboarded)
│   │   │   ├── queries.ts           // Prisma-only
│   │   │   └── index.ts
│   │   │
│   │   ├── me/                      ✓ LIVE — sub-resource module for the authenticated player
│   │   │   ├── home-pin.routes.ts   ✓ // POST /me/home-pin — returns { home_timezone, home_city }
│   │   │   ├── home-pin.service.ts  ✓ // resolveHomeCityFromPin (PostGIS two-step: ST_Contains then nearest within 10km)
│   │   │   ├── home-pin.test.ts     ✓ // 3 cases: inside / nearest fallback / miss
│   │   │   ├── fcm-token.routes.ts  // PATCH /me/fcm-token ✓
│   │   │   ├── fcm-token.queries.ts // updateFcmToken
│   │   │   ├── challenge-complete.routes.ts ✓ // POST /me/challenge-complete
│   │   │   ├── challenge-complete.service.ts ✓ // orchestrator inside one prisma.$transaction
│   │   │   ├── challenge-complete.queries.ts ✓ // RACE-FIXED — Prisma {increment} for monetary fields
│   │   │   ├── challenge.formulas.ts ✓ // ported subset of root formulas.js (tiers, XP, resource earn, level)
│   │   │   ├── streak.helpers.ts    ✓ // pure: computeNewStreak, isGraceDayMilestone, applyGraceDayGrant
│   │   │   └── index.ts             // registerMeRoutes wires fcmTokenRoutes + challengeCompleteRoutes
│   │   │
│   │   ├── health/                  ✓ Scaffolded, Redis ping included
│   │   │   └── routes.ts            // GET /healthcheck ✓ — returns `{ status, redis: "PONG" }`; 503 on Redis error
│   │   │
│   │   ├── territory/               ✓ LIVE — GET + abandon + claim + full contest lifecycle
│   │   │   ├── routes.ts            // GET /territories ✓ (Supabase RPC pass-through, 5 params incl. zoom)
│   │   │   ├── abandon.{routes,service,queries}.ts ✓
│   │   │   ├── claim.{routes,service,queries,costs}.ts ✓
│   │   │   ├── contest.{routes,service,queries,costs,formulas}.ts ✓ // initiate, schedules contestExpiryQueue at 23:59 home_pin
│   │   │   ├── contest-defend.{routes,service,queries}.ts ✓
│   │   │   ├── contest-walk.{routes,service,queries}.ts ✓ // ingest + immediate resolution + post-commit Ably publishes + up to 3 FCM pushes
│   │   │   ├── contest-expiry.{queries,worker}.ts ✓ // BullMQ worker, SELECT FOR UPDATE, idempotent
│   │   │   └── index.ts             // wrapper plugin registers GET + abandon + claim + contest (initiate). NOTE: contest-defend + contest-walk registered DIRECTLY in app.ts
│   │   │
│   │   ├── alliance/                ✓ LIVE — full CRUD (found/join/leave/get) + membership management (kick/promote/demote) + founder voluntary transfer
│   │   │   ├── alliance.formulas.ts ✓ // ALLIANCE_ROLES, ROLE_SLOTS, ROLE_RANK, MAX_ALLIANCE_MEMBERS=20, MIN_LEVEL_TO_JOIN=6, SHORT_NAME_REGEX
│   │   │   ├── membership.helpers.ts ✓ // canFoundAlliance, canJoinAlliance, canLeaveAlliance, canKick, canPromote, canDemote, canTransferFounder (pure)
│   │   │   ├── alliance.queries.ts  ✓ // setAllianceIdOnPlayerTerritories, transitionHqTerritoryToAlliance, disbandAlliance, fetchAllianceWithRoster
│   │   │   ├── found.{service,routes,test}.ts ✓ // POST /alliances/found — returns full { alliance, members }
│   │   │   ├── join.{service,routes,test}.ts ✓ // POST /alliances/:id/join — propagates territory.alliance_id
│   │   │   ├── leave.{service,routes,test}.ts ✓ // POST /alliances/leave — founder-must-transfer guard + disband path
│   │   │   ├── kick.{service,routes,test}.ts ✓ // POST /alliances/:id/members/:playerId/kick
│   │   │   ├── promote.{service,routes,test}.ts ✓ // POST /alliances/:id/members/:playerId/promote (founder + marshal-up-to-officer)
│   │   │   ├── demote.{service,routes,test}.ts ✓ // POST /alliances/:id/members/:playerId/demote (founder-only)
│   │   │   ├── transfer.{service,routes,test}.ts ✓ // (38) POST /alliances/:id/members/:playerId/transfer — founder ↔ marshal/officer role swap, role counts conserved, no 409
│   │   │   ├── get.service.ts       ✓ // getAllianceById, getMyAlliance
│   │   │   └── index.ts             ✓ // registers found + join + leave + kick + promote + demote + transfer + get routes
│   │   ├── streak/                  ✓ LIVE — midnight rollover + 23:55 break-warning, both per-timezone BullMQ jobs
│   │   │   ├── streak-rollover.helpers.ts ✓ // pure evaluateRollover + yesterdayOf
│   │   │   ├── streak-rollover.queries.ts ✓ // fetchPlayersByTimezone, applyRolloverUpdate (optimistic concurrency), logStreakBroken
│   │   │   ├── streak-rollover.service.ts ✓ // processPlayerRollover per-player tx + runRolloverForTimezone batch
│   │   │   ├── bootstrap.ts         ✓ // registers cron '0 0 * * *' per distinct home_timezone
│   │   │   ├── streak-break-warning.helpers.ts ✓ // pure evaluateWarning + formatWarningMessage per spec §4.5.1
│   │   │   ├── streak-break-warning.queries.ts ✓ // fetchEligibleWarningPlayers via tagged $queryRaw
│   │   │   ├── streak-break-warning.service.ts ✓ // processPlayerWarning (sendImmediately bypasses Quiet Hours) + batch
│   │   │   └── bootstrap-warning.ts ✓ // registers cron '55 23 * * *' per distinct home_timezone
│   │   │
│   │   ├── debug/                   ✓ Live — routes gated by (NODE_ENV !== 'production' || ALLOW_DEBUG_ROUTES === 'true')
│   │   │   └── routes.ts            // POST /debug/streak-rollover ✓ · POST /debug/streak-break-warning ✓ · /debug/contest-expiry/:contestId ✓
│   │   │
│   │   ├── progression/             ✓ LIVE — Siege XP + Levels + Solo Protection (CORE COMPLETE S44)
│   │   │   ├── progression.formulas.ts  ✓ // LEVEL_XP_FLOORS, LEVEL_TITLES, TerritoryTier,
│   │   │   │                            //   XP_PER_CLAIM/CONTEST_WIN/DEFENCE_WIN,
│   │   │   │                            //   isTerritoryTier, calcLevel, calcLevelProgress,
│   │   │   │                            //   getLevelTitle, calcClaimXp, calcContestWinXp,
│   │   │   │                            //   calcDefenceWinXp (multiplier-aware), XpMultiplierOpts
│   │   │   ├── progression.queries.ts   ✓ // grantSiegeXp(tx, playerId, delta) — atomic Prisma
│   │   │   │                            //   {increment} + conditional 2nd UPDATE for level recompute.
│   │   │   │                            //   Returns {newXp, previousLevel, newLevel, leveledUp}.
│   │   │   │                            //   Null guard throws (loud-failure for data integrity).
│   │   │   ├── progression.helpers.ts   ✓ // (S44) canContestTerritory(attacker, target) — pure §8.1
│   │   │   │                            //   protection check. Returns discriminated union
│   │   │   │                            //   {ok:true} | {ok:false, reason}. 3 reasons:
│   │   │   │                            //   attacker_level_too_low / target_solo_protected /
│   │   │   │                            //   target_alliance_protected_from_solo.
│   │   │   ├── progression.test.ts             ✓ // 20 tests: 8 formulas + 3 grantSiegeXp DB + 9 multiplier
│   │   │   ├── progression.helpers.test.ts     ✓ // (S44) 21 protection-matrix tests (full §8.1 cross-product)
│   │   │   ├── progression-integration.test.ts ✓ // 14 wiring tests: S41 callsites + S42 multipliers
│   │   │   │                            //   + S43 milestone + S44 protection enforcement
│   │   │   └── index.ts                 ✓ // Library + helpers only — no routes registered.
│   │   │
│   │   ├── leaderboard/             ○ Not started — Redis Sorted Set (ZADD on resolution, ZREVRANGE on read)
│   │   ├── realm/                   ○ Not started — realm assignment, saturation monitoring
│   │   └── activity/                ○ Not started — POST /activity/steps, 25 km/h velocity check
│   │
│   ├── shared/
│   │   ├── formulas/                ✓ (S42/S43) Cross-module pure math — single source of truth
│   │   │   ├── canonical-earn.ts        ✓ // calcCanonicalEarn, BONUS_PRODUCT_CAP=3.0. One impl of
│   │   │   │                            //   buff stacking across modules.
│   │   │   ├── streak.ts                ✓ // STREAK_TIER_THRESHOLDS, STREAK_MULT_TIER_CAP,
│   │   │   │                            //   STREAK_MILESTONE_DAYS=[7,14,21,30,60,90],
│   │   │   │                            //   STREAK_MILESTONE_XP=250, getStreakTier,
│   │   │   │                            //   calcStreakMultiplier, isStreakMilestone.
│   │   │   └── streak.test.ts           ✓ // 12 unit tests (isStreakMilestone boundaries + sanity)
│   │   ├── prisma.ts                ✓ Singleton PrismaClient with `@prisma/adapter-pg`. globalThis-cached for tsx-watch hot reload survival.
│   │   ├── supabase.ts              ✓ Service-role client. Used only by territory GET (PostGIS RPC).
│   │   ├── auth.ts                  ✓ Clerk verifyToken middleware, per-route preHandler.
│   │   ├── redis.ts                 ✓ ioredis singleton. `maxRetriesPerRequest: null`, `enableReadyCheck: false`, `family: 0` (IPv6).
│   │   ├── ably.ts                  ✓ Ably.Rest singleton. Server-side publishing only.
│   │   ├── firebase.ts              ✓ Firebase Admin singleton — `admin.initializeApp` from `FIREBASE_SERVICE_ACCOUNT_JSON`.
│   │   ├── timezone.ts              ✓ `resolveLocalDateTimeToUtc`, `isQuietHours`, `computeNextQuietHoursDispatchUtc`.
│   │   ├── queues/                  ✓ Real BullMQ queues — contest-expiry, quiet-hours-push, streak-rollover, streak-break-warning.
│   │   ├── notifications/           ✓ FCM dispatch with Quiet Hours — send.ts, quiet-hours.worker.ts, types.ts (PushNotificationKind union, 4 kinds).
│   │   └── errors.ts                ○ typed app errors
│   │
│   ├── jobs/                        ○ Folder scaffolded — real workers currently live inside their modules.
│   ├── app.ts                       ✓ Fastify instance factory. Registers: health, player, me (incl. challenge-complete), territory, contestDefendRoutes (direct), contestWalkRoutes (direct), debug routes. Calls bootstrapStreakRolloverJobs + bootstrapStreakBreakWarningJobs after Fastify ready.
│   └── server.ts                    ✓ Entry point. Side-effect imports boot: firebase init, contest-expiry worker, quiet-hours worker, streak-rollover worker, streak-break-warning worker.
│
├── prisma/schema.prisma             ✓ Introspected from live Supabase — 14 models. PostGIS as `Unsupported("geometry")`.
├── prisma.config.ts                 ✓ Prisma 7 config — dotenv-loaded, `env("DIRECT_URL")` as datasource.url.
└── package.json                     ✓ Node >=22, ESM. `postinstall: "prisma generate"` so Railway `npm ci` generates the client before `tsc`.
```

**Module conventions (apply to every new module):**
- Each module is a folder with at minimum `index.ts` + `routes.ts`. Larger modules split into `service.ts` + `queries.ts` + `types.ts`.
- Routes use Clerk auth via `{ preHandler: requireAuth }` unless explicitly public.
- DB access: Prisma via `src/shared/prisma.ts`. Multi-table writes go through `prisma.$transaction(async (tx) => { ... })`. `shared/supabase.ts` only for PostGIS read paths.
- Every new module is wired in `src/app.ts`.
- BullMQ workers (`src/jobs/`) are thin — they delegate to module services, never duplicate business logic.

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
| SPB test home pin | Palace Square (jittered) for nish_s, Rubik, TINA, Alyona |
| KAD ring road | OSM relation 1861646 (Cyrillic 'А-118') — defines SPB playable envelope |
| Backend live URL | https://dominia-backend-production.up.railway.app |
| Backend env vars | `PORT`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CLERK_SECRET_KEY`, `DATABASE_URL` (port 6543 Transaction pooler), `DIRECT_URL` (port 5432 Session pooler IPv4), `REDIS_URL` (Railway ref `${{Redis.REDIS_URL}}` in prod; `REDIS_PUBLIC_URL` locally), `ABLY_API_KEY` (Root key), `FIREBASE_SERVICE_ACCOUNT_JSON` (single-line minified JSON; on Railway paste WITHOUT quotes, in local `.env` wrap in single quotes for dotenv), `ALLOW_DEBUG_ROUTES` (currently `true` on Railway — enables `/debug/*` in prod; flip OFF before any external playtest). Service account file at `C:\Users\nisha\dominia-secrets\firebase-admin.json` — NEVER commit. Values must NOT be wrapped in angle brackets. |
| Mobile EAS env vars | `EXPO_PUBLIC_*` keys (Mapbox etc.) + `GOOGLE_SERVICES_JSON` (Firebase Android config as EAS **file** env var, sensitive, environment=development). Referenced in `app.config.js` as `process.env.GOOGLE_SERVICES_JSON ?? './google-services.json'`. Local file at `C:\Users\nisha\dominia-secrets\google-services.json` — gitignored. |
| Clerk instance | Single test instance shared between mobile (`pk_test_bGVu...`) and backend (`sk_test_...`). |
| Firebase project | Android app registered as `com.nish_s.dominia` (underscore tolerated by Firebase but technically invalid per Android spec — first suspect if FCM ever rejects registration). |

---

## SUBSCRIPTIONS & LIMITS

| Service | Plan | Key limits |
|---|---|---|
| Supabase | Pro | Micro compute, ~$25/month all-in. PostGIS 3.3.7 in `postgis` schema. |
| Mapbox | Free | 50,000 map loads/month |
| Clerk | Free | 10,000 MAU |
| Railway | Hobby | Backend hosting + Redis plugin. Auto-deploys on push to `main`. Two services: `dominia-backend` (Node) + `Redis` (private network ref var, no egress in prod; `REDIS_PUBLIC_URL` for local dev). |
| Ably | Free tier (Pub/Sub) | 6M messages/month, 200 peak connections, 200 peak channels. Single app "Dominia". Single Root API key (backend only). Mobile will use scoped key or token auth when subscription is added. Currently publishes 4 events on `contest:<id>` channels. |
| Firebase | Free (Spark plan) | Cloud Messaging only. No quota limits on dev-tier FCM sends. |
| EAS Build | Free | 30 builds/month (15 Android + 15 iOS). **~22 Android used, ~8 remaining.** Failed builds DO NOT count against the cap. |
| Cursor | Pro | No usage limits on AI edits |

---

## SUPABASE SCHEMA

**Tables:**

`players`: id, username, level, xp, home_city (text — DERIVED via PostGIS in POST /me/home-pin; Title Case canonical form), alliance_id, created_at, clerk_id, has_onboarded, home_pin_lat, home_pin_lng, current_streak, longest_streak, last_active_date, grace_days_banked (int NOT NULL DEFAULT 0 — bank capped at 3, granted at 7/30/60-day milestones, one consumed per missed day at local midnight), iron, stone, gold, morale, lifetime_contest_wins, lifetime_defence_wins, home_timezone (text NOT NULL DEFAULT 'UTC', IANA tz string — derived from home pin via tz-lookup), fcm_token (text nullable — Firebase Cloud Messaging device token; set via PATCH /me/fcm-token; cleared on sign-out and on FCM stale-token error)

`contests`: id, territory_id (FK), attacker_id (FK), attacker_alliance_id (nullable, no FK yet), defender_id (FK, territory owner at initiate), defender_alliance_id (nullable, no FK), required_walk_m (int, frozen at initiate), attacker_walked_m (int default 0), defender_player_id (FK nullable — who tapped Defend), defender_walked_m (int default 0), defender_response_ratio (numeric(3,2) nullable — 1.00 with Stone, 1.25 without), iron_cost_paid (int), status (text, CHECK in 'active'/'attacker_won'/'defender_won'/'expired'), initiated_at (default now()), resolved_at (nullable), attack_day_date (date, set from player.home_timezone at initiate), defender_starting_walk_m (int NOT NULL default 0 — snapshot of defender's HC walk distance at /defend tap), attacker_first_walk_at (nullable — one-shot flag set on first non-zero attacker /walk; triggers defender_notify push), attacker_last_sample_at (nullable — last accepted attacker sample for CWR gap detection), defender_last_sample_at (nullable — same for defender)

`contest_walk_samples`: id (uuid PK), contest_id (FK), player_id (FK), source_id (text — client-side idempotency key), sample_timestamp (timestamptz), distance_m (int), accepted (boolean), rejection_reason (text nullable — set when accepted=false, e.g. 'vehicle_speed', 'invalid_timestamp'), created_at. UNIQUE (contest_id, player_id, source_id). CHECK `accepted = (rejection_reason IS NULL)`. Composite index on (contest_id, player_id, sample_timestamp).

`territories`: id, territory_name, tier, perimeter_distance, owner_id, alliance_id, development_level, longitude, latitude, created_at, legacy_rank, upkeep_overdue, osm_id (bigint), osm_type, geojson (jsonb), geom (postgis.geometry(Polygon, 4326)), district (text nullable, indexed), territory_name_v1 (nullable — rollback backup on gap-fill rows only), city (text — NORMALISED to Title Case: 'Amsterdam', 'Saint Petersburg')

`alliances`: id, name, short_name (text + UNIQUE + CHECK `^[A-Z]{3}$`), city, created_at, founder_id, morale, hq_territory_id (FK nullable), hq_timezone (text), disbanded_at (timestamptz nullable)

`alliance_members`: id, alliance_id (FK CASCADE), player_id (UNIQUE FK CASCADE — one alliance per player at DB level), role (CHECK in 'founder'/'marshal'/'officer'/'sergeant'/'soldier'/'recruit'), joined_at, recruit_streak_count, recruit_last_completion_date — indexes: `idx_alliance_members_alliance_id`, `idx_alliance_members_role`

`player_challenges`: id, player_id, challenge_key, completed_at, date — UNIQUE on (player_id, challenge_key, date)

`territory_history`: id, territory_id, owner_id, alliance_id (nullable), claimed_at, lost_at (nullable = currently held), backfilled (boolean), created_at

`debug_events`: id, player_id (FK CASCADE), event_type (text freeform, no CHECK), payload (jsonb), created_at — index on (player_id, created_at DESC), RLS off. Disposable infrastructure for fast iteration. Written via `lib/debug.js` `logDebug()` fire-and-forget.

**TEMP tables (keep ~1 week post-ship for oversize review + rollback, then drop):**
- `public.gap_fill_roads_spb` — 27,899 SPB road LineStrings, GIST indexed
- `public.gap_fill_pois_spb` — 1,721 SPB POIs, GIST indexed
- `public.gap_fill_blocks_spb` — 7,810 rows
- `public.spb_districts` — 18 rows (OSM admin_level=5), GIST indexed
- `public.spb_okrugs` — 111 rows (OSM admin_level=8), GIST indexed

**Test data:**
- **Amsterdam: 239 territories** (all OSM-named, all unclaimed by default)
- **Saint Petersburg: 8,295 territories** (full city coverage) — 485 OSM-named + 7,810 gap-fill blocks. 37 flagged `flagged_oversize`, 263 flagged `outside_spb_admin`.
- 4 SPB test player home pins at Palace Square + jitter: nish_s, Rubik, TINA, Alyona
- **testcity** (SPB, Level 6, xp=30000, iron/stone/gold/morale=100) — joined for multi-account device testing. Holds проспект Тореза 2 (claimed organically S37). Joined KAI alliance during S38 transfer testing.
- Active alliances: KAI · GGG
- **KAI alliance roster (end of S38):** nish_s=founder, Rubik=marshal, test7=recruit, testcity=recruit
- Territory tier values are **lowercase** in DB (small/medium/large/epic).

**Indexes:**
- `idx_territories_{owner_id, alliance_id, district}`
- `idx_players_{clerk_id, alliance_id}`
- `idx_territory_history_{territory_id, owner_id}` + partial `current_holder` WHERE lost_at IS NULL
- `territories_geom_idx` GIST on territories(geom)
- `contests_pkey`, `contests_territory_active_unique` (PARTIAL UNIQUE on `(territory_id) WHERE status='active'` — DB-level Single-Contest Rule), `contests_attacker_idx`, `contests_status_attack_day_idx`

**Row Level Security:**
- `players` table: **DISABLED** (manually). Was causing 19-min hangs from old `auth.uid()` policies (Clerk project, not Supabase Auth).
- All other tables: RLS off.
- ⚠️ Re-enabling RLS on players without Clerk JWT integration will reintroduce the 19-min hang.

```sql
-- Reset a territory
UPDATE territories SET owner_id = null, alliance_id = null WHERE territory_name = 'X';
-- Reset onboarding for dev testing
UPDATE players SET has_onboarded = false WHERE username = 'nish_s';
-- Resource adjustments
UPDATE players SET iron = iron + 50 WHERE username = 'nish_s';
-- Inspect territory history
SELECT t.territory_name, p.username, th.claimed_at, th.lost_at, th.backfilled
FROM territory_history th
JOIN territories t ON t.id = th.territory_id
JOIN players p ON p.id = th.owner_id
WHERE t.territory_name = 'X' ORDER BY th.claimed_at ASC;
```

**RPCs (server-side, atomic):**
- `get_territories_in_viewport(min_lon, min_lat, max_lon, max_lat, zoom)` — **canonical territory fetch for MapScreen.** SECURITY DEFINER + SET search_path = public, postgis. Returns 14 flat columns including owner_username, owner_streak_days, alliance_short_name. CCW-corrected via `postgis.ST_AsGeoJSON(postgis.ST_ForcePolygonCCW(t.geom))::jsonb`. Filters with `ST_IsValid` AND `ST_NPoints >= 4`.
- `deduct_alliance_morale(alliance_id, amount)` — guards `morale >= amount`. Used by War Room ACTIVATE.
- `donate_morale(player_id, alliance_id, amount)` — atomic transaction.
- `insert_road_batch / insert_poi_batch / insert_district_batch / insert_okrug_batch` — SECURITY DEFINER batched loaders for SPB pipeline.

**SQL functions (kept while temp tables alive):**
- `polygonise_spb_blocks()`, `merge_sub_floor_blocks_spb()`, `merge_unnamed_spb_blocks()`, `name_spb_blocks()` (3-tier naming cascade — uses GET DIAGNOSTICS, planar+geography ST_DWithin), `backfill_landmarks_for_duplicates_spb()`, `disambiguate_spb_blocks()`.

**Dead RPCs (safe to drop):** `get_all_territories_meta`, `get_territories_geojson_batch`.

---

## SCREENS — STATUS

| Screen | Status | Notes |
|---|---|---|
| Navigation (4 bottom tabs) | ✓ Branded | Geist Mono uppercase, hairline-strong top border, Bone active / Slate inactive |
| Map screen | ~ Live data | PostGIS viewport fetch via `get_territories_in_viewport` RPC. Client-side feature cache + merge-on-fetch + age-gated abort. Debounce 150ms. styleURL `light-v11` for dev. (S37) useFocusEffect also calls fetchPlayer; new useEffect tracks `myPlayer?.alliance_id` transitions via previousAllianceIdRef, clears featureCacheRef + refetches viewport on change (so joiner's territories visually update to alliance colour within seconds of join). Colour priority: own=red, alliance members=green, other=blue-grey. Known bugs: zoom-level simplification hides small polygons at wide zoom; nested/overlapping territories. |
| Activity screen | ✓ Live data | Health Connect wired end-to-end. 10s `useFocusEffect` poll. `onCompleteChallenge` REWRITTEN 31b: 6 direct Supabase writes → 1 `POST /me/challenge-complete` via `lib/challengeApi.js`. Pre-state snapshot for rollback. Optimistic UI applied immediately, reverted on failure, refreshed from backend response on success. Auto-complete cascade Easy → Med → Hard. DB-level idempotency via `player_challenges` UNIQUE inside backend tx. `challengesLoaded` gate. Real weekly chart with bone today-bar + Claim-red SVG trend curve. `DEV_MODE_MANUAL` flag (currently FALSE). |
| Profile screen | ✓ Live data | POWER + Influence sections. Long-press commander name (1000ms) opens HealthConnectDebug. Logout calls `clearFcmToken` before `signOut`, both now wrapped in Promise.race timeouts (3s/5s respectively). Sign-out completes in 2-3s on device (was hanging for minutes). |
| Alliance screen | ✓ Live data | MemberContent + NonMemberContent on live backend reads. Real roster, role badges, headers. Loading + error + retry states. Leave flow (3 confirm cases: non-founder, founder-blocked, founder-disband). Member-management full-screen confirm view with flat-list action picker (PROMOTE/DEMOTE/TRANSFER ALLIANCE/KICK/CANCEL). Server-confirmed updates. Uses canonical `getTokenRef` pattern. Transfer Alliance row (Founder→Marshal/Officer) has TYPE-TRANSFER text-gate. (S37) handleConfirmJoin navigates to AllianceJoined with `context: 'joined'` on success. |
| War Room screen | ✓ Live data | All 6 abilities. ACTIVATE wired (Founder only) via `deduct_alliance_morale` RPC. |
| Wallet screen | ✓ Live data | 4-resource view. Morale row → donate modal → `donate_morale` RPC. |
| Onboarding screen | ✓ Branded | 5-step flow, typewriter animation, Mapbox dark-v11 home pin map. Uses `lib/homePinApi.js` `setHomePin` (POST /me/home-pin — derives BOTH home_timezone AND home_city automatically). |
| Sign In screen | ✓ Branded | DOMINIA wordmark + ▪ claim mark |
| Username screen | ✓ Branded | 2-char minimum |
| Active Claim screen | ✓ Branded | (S38) Progress ring race FIXED: rehydrate-vs-startClaim stomp resolved in `lib/claimState.js` (capture wasActive before merge, selective merge of CONTINUATION_FIELDS only when wasActive=true). Device-verified screen-on + screen-locked-in-pocket. TaskManager-owned distance loop (screen is pure consumer of `claimState`). `DIAG_CALIBRATION` writes to debug_events per tick. |
| HealthConnectDebug screen | ✓ Live data | Hidden. SDK status, permission state, today's steps, raw JSON dump, 7-day breakdown, snapshot to `debug_events`. |
| Claim Success screen | ✓ Live data | Atomic Gold + Siege XP write. |
| Contest Result screen | ✓ Live data | 4 states. attack_won verified on device; defence states wired but not exercised end-to-end. |
| Create Alliance screen | ✓ Live data | 3-step founding wizard wired to POST /alliances/found. Body is `{full_name, short_name, hq_territory_id}`. Confirm step reads city from `player.home_city`. Short_name Supabase pre-check (silent fail-open). Inline error mapping for 8 backend codes. Navigates with only `{ allianceId }`. |
| Alliance Joined screen | ✓ Live data | (S37) Now context-aware: reads `context` from route.params. Conditional kicker ('Alliance joined' vs 'Alliance founded'), conditional subtitle ("You're no longer alone on this map." vs "Ready for war."), conditional benefits list (BENEFITS_FOUNDED vs BENEFITS_JOINED). Create flow passes no context → falls through to founded copy. Join flow passes `context: 'joined'`. Single screen, two copy paths. Still fetches by allianceId on mount via `getAllianceById`. Three render states (loading spinner / error+retry / loaded). Uses `getTokenRef` pattern. |
| AuthGate | ✓ Done | Checks isSignedIn + has_onboarded. Calls `registerFcmToken` inline in `runGate()` before navigation. |
| Permissions | ~ Partial | Inline in onboarding step 2 — not a standalone screen |
| Territory Detail (full screen) | ○ Not built | Currently a bottom sheet inside map. |
| Defender flow | ○ Deferred | Backend lifecycle live; mobile UI not built. |
| Abandon flow | ○ Not built | Currently just an alert. |

---

## KEY FILES — MOBILE

| File | Purpose |
|---|---|
| `App.js` | Root stack navigator, font loading, ClerkProvider, all screen registrations |
| `components/AuthGate.js` | Checks isSignedIn + has_onboarded. Calls `registerFcmToken` inline in `runGate()` (fire-and-forget) BEFORE `navigation.replace('MainTabs')`. See Decision Log: FCM AuthGate ordering. |
| `components/ResourceGlyphs.js` | 6 SVG glyph components: Stone, Iron, Gold, Shield, Morale, Influence |
| `components/ProgressBar.js` | 5 horizontal segments (28×2px), 0px radius |
| `components/PrimaryButton.js` | Claim red, 0px radius, Geist Mono |
| `components/SectionLabel.js` | Geist Mono 9px uppercase + hairline rule |
| `components/NumberedRow.js` | Geist Mono number + Inter title/subtitle |
| `lib/theme.js` | Design tokens — colours, fonts, fontSize, spacing, radius, borders, motion |
| `lib/supabase.js` | Supabase client with fetch wrapper that forces `Connection: close` header (CRITICAL — see Pitfall: dead TCP pool). URL/key hardcoded. |
| `lib/clerk.js` | ClerkProvider tokenCache with SecureStore |
| `lib/auth.js` | `ensurePlayer(clerkUserId, email)` — maybeSingle find-or-create |
| `lib/formulas.js` | **Single source of truth for game math** (CommonJS, ~1500 lines, ~50+ exports). Aligned to v6.10. **348 tests passing.** |
| `lib/__tests__/formulas.test.js` | 348 Jest tests. Run with `npm test`. Must stay green before any commit touching formulas.js. |
| `lib/streak.js` | **DEAD CODE as of 31b.** `updateStreakOnChallengeComplete` superseded by backend `POST /me/challenge-complete`. Deletion deferred to dedicated dead-code pass. |
| `lib/territory.js` | Display helpers + `getLegacyRankForTerritory` + `getTerritoryHistoryStats`. No tests yet. |
| `lib/claim.js` | `isQualifyingCalibrationWindow` — returns `{ qualifies, rejectReason }`. Check order: accuracy_low → accuracy_high → speed_high → window_short. |
| `lib/debug.js` | `logDebug(playerId, eventType, payload)` — fire-and-forget Supabase write to `debug_events`. |
| `lib/claimState.js` | (S38) Module-level shared state for active-claim flow + subscribe/emit API + AsyncStorage snapshot. Bridges TaskManager task (writer) and ActiveClaimScreen (reader). **rehydrateFromStorage now captures `wasActive = claimState.active === true` BEFORE any merge.** If wasActive=true: selective merge only — copies CONTINUATION_FIELDS (`strideM`, `strideSessions`) from parsed snapshot where current value is null. Never overwrites active/distanceM/completed/hcPermission. If !wasActive: full `Object.assign(claimState, parsed)` — preserves "app killed in pocket" recovery path. One `[claimState] rehydrate: wasActive=<bool>, snapshotActive=<bool>` console.log per call for future debugging. Fixes the stomp race where a fresh `startClaim()` setting active=true was overwritten by an async rehydrate of a stale snapshot. |
| `lib/api.js` | Exports `BACKEND_URL`. Single source of truth for backend base URL on mobile. |
| `lib/challengeApi.js` | (31b) `completeChallenge({clerkGetToken, challengeKey, tier, earnKey})` → `POST /me/challenge-complete`. Mirrors `lib/fcm.js` pattern. Clerk-authed. Forces `Connection: close`. Never throws — returns `{ok, data} \| {ok:false, status, error}`. Single-shot (no retry); failed POST reverts optimistic UI in ActivityScreen. Sends lowercase `tier` (`easy`/`medium`/`hard`), NOT TitleCase `ch.difficulty`. |
| `lib/allianceApi.js` | (32–38) `getMyAlliance`, `getAllianceById`, `foundAlliance`, `joinAlliance`, `leaveAlliance`, `kickMember`, `promoteMember`, `demoteMember`, `transferFounder` (S38). All Clerk-authed, `Connection: 'close'` header, `{ ok, data \| error }` discriminant, never throw. Canonical pattern mirroring `lib/challengeApi.js`. |
| `lib/alliancePermissions.js` | (36, 38) Pure JS port of backend `membership.helpers.ts` — `ROLE_RANK`, `ROLE_SLOTS`, `canKick`, `canPromote`, `canDemote`, `canTransferFounder` (S38), plus `getAvailableActions()` helper that returns all valid actions for an actor-target pair. Action ordering: promote → demote → transfer_founder → kick (ascending in irreversibility). Used by AllianceScreen's manage-member UI to decide whether a roster row is tappable. |
| `lib/homePinApi.js` | (33) `setHomePin` via `POST /me/home-pin`. Returns `{ home_timezone, home_city }`. Mobile reads home_timezone but still ignores home_city (UI deferred). |
| `lib/fcm.js` | Three exports: `registerFcmToken`, `clearFcmToken`, `patchFcmToken`. Uses namespaced `@react-native-firebase/messaging` API (v22 — v23 migration is a future task). All errors caught + logged, never thrown. **(S37) `patchFcmToken` now sends `Connection: close` header (matches `lib/supabase.js` pattern). `clearFcmToken` body wrapped in `Promise.race` against 3s timeout — best-effort cleanup, never blocks the caller.** |
| `metro.config.js` | react-dom shim for @clerk/clerk-react bundling |
| `shims/react-dom-shim.js` | Empty module.exports shim |
| `plugins/withHealthConnect.js` | Custom Expo config plugin. Injects `HealthConnectPermissionDelegate.setPermissionDelegate(this)` into MainActivity.kt onCreate. Anchor regex `/super\.onCreate\(.+?\)/` matches both `savedInstanceState` and `null` forms. Re-check anchor every Expo SDK upgrade. |
| `screens/MapScreen.js` | PostGIS viewport fetch via RPC. Feature cache + merge-on-fetch + age-gated abort (see Decision Log: client-side feature cache). Diagnostic `[vp fetch]` logs still in place. (S37) `useFocusEffect` now also calls `fetchPlayer`. New useEffect tracks `myPlayer?.alliance_id` transitions via `previousAllianceIdRef`; on change, clears `featureCacheRef` + refetches viewport so joiner's territories visually adopt alliance colour within seconds. |
| `screens/ActivityScreen.js` | (MODIFIED 31b) `onCompleteChallenge` body now: pre-state snapshot → optimistic UI → `completeChallenge()` POST → revert on failure / refresh from backend on success. HC wired. 10s `useFocusEffect` poll. Auto-complete cascade. `challengesLoaded` boolean gates watcher. `DEV_MODE_MANUAL` (currently FALSE) gates COMPLETE buttons. Real 7-day weekly chart with SVG trend curve. `useAuth` destructure includes `getToken`. |
| `screens/ProfileScreen.js` | POWER + Influence sections. Long-press commander name → HealthConnectDebug. Calls `clearFcmToken` then `signOut` on logout (order matters; see Decision Log: FCM auth-teardown ordering). (S37) Logout handler now races `signOut()` against a 5s timeout; `clearFcmToken` still called first to preserve JWT ordering. Sign-out completes in 2-3s on device. |
| `screens/AllianceScreen.js` | (32–38) MemberContent + NonMemberContent fully live. MemberContent: real roster via `GET /me/alliance` + `GET /alliances/:id`, role badges, loading/error/retry states. Leave flow with 3 confirm cases (non-founder, founder-blocked, founder-disband). Member-management full-screen confirm view with flat-list action picker (PROMOTE/DEMOTE/TRANSFER ALLIANCE/KICK). Server-confirmed updates via `onRefreshAfterLeave` callback. NonMemberContent: browse list filters on `.is('disbanded_at', null)` + `.eq('city', playerHomeCity)`, join flow via `POST /alliances/:id/join` with inline error mapping. Canonical `getTokenRef` pattern (Clerk getToken is a new ref every render — captured once). (S37) `handleConfirmJoin` now `navigation.navigate('AllianceJoined', { allianceId, context: 'joined' })` on success. (S38) TRANSFER ALLIANCE action row visible only to Founder when target is Marshal or Officer. Destructive styling. In-screen confirm view (reuses manage-confirm pattern, no new screen file) with TextInput requiring exact-match "TRANSFER" (case-sensitive) to enable confirm. Error mapping for all 4 status codes (400/403/404/500). |
| `screens/WarRoomScreen.js` | All 6 abilities. ACTIVATE wired (Founder only). |
| `screens/WalletScreen.js` | 4 resources. Morale row → donate modal → `donate_morale` RPC. |
| `screens/SignInScreen.js`, `UsernameScreen.js` | Fully branded. |
| `screens/OnboardingScreen.js` | (33) Uses `setHomePin` from `lib/homePinApi.js` (was direct Supabase update). POST /me/home-pin now derives both home_timezone AND home_city automatically. |
| `screens/ActiveClaimScreen.js` | TaskManager-owned 10s claim loop. Screen rehydrates from AsyncStorage on mount, subscribes to `claimState` emits, watches `claimState.completed` for navigation. `DIAG_CALIBRATION` flag default true. (S38) Progress-ring-frozen bug fixed at `lib/claimState.js` level (rehydrate-vs-startClaim race); screen itself unchanged. See Decision Log: TaskManager owns claim loop + selective-merge rehydrate. |
| `screens/HealthConnectDebugScreen.js` | Hidden debug screen. SDK status, permission flow, today's steps + 7-day breakdown, snapshot writer. |
| `screens/ClaimSuccessScreen.js` | Atomic Gold + Siege XP write. |
| `screens/ContestResultScreen.js` | 4 states. attack_won verified on device. |
| `screens/CreateAllianceScreen.js` | (32–35) 3-step founding wizard wired to `POST /alliances/found`. Body is `{full_name, short_name, hq_territory_id}`. Confirm step city reads from `player.home_city`. Short_name Supabase pre-check (silent fail-open on network error). Inline error mapping for 8 backend codes. Navigates with only `{ allianceId }` (no display props through nav). |
| `screens/AllianceJoinedScreen.js` | (35, 37) Multi-use: post-create AND post-join landing, switched on `context` route.param. Receives `{ allianceId, context? }`. Calls `getAllianceById(allianceId)` on mount. Three render states (loading spinner in CLAIM colour / error+retry / loaded). Conditional kicker ('Alliance joined' vs 'Alliance founded'), conditional subtitle ("You're no longer alone on this map." vs "Ready for war."), conditional benefits list (BENEFITS_FOUNDED vs BENEFITS_JOINED). Create flow passes no context → isJoined false → founded copy. Uses `getTokenRef` pattern. |
| `app.config.js` | Dynamic config (replaces `app.json`). Expo only expands `process.env` in dynamic configs. `android.googleServicesFile = process.env.GOOGLE_SERVICES_JSON ?? './google-services.json'`. Plugins: expo-location, expo-sensors, expo-build-properties (minSdkVersion 26), `./plugins/withHealthConnect.js`. Android permissions: health.READ_STEPS, READ_HEALTH_DATA_IN_BACKGROUND, ACTIVITY_RECOGNITION, POST_NOTIFICATIONS (Android 13+, runtime). |
| `google-services.json` | GITIGNORED. Firebase Android config. Local copy at `C:\Users\nisha\dominia-secrets\`. Uploaded to EAS as file env var `GOOGLE_SERVICES_JSON` (sensitive). |
| `eas.json` | EAS build profiles. Preview profile: `developmentClient: false` + `MAPBOX_DOWNLOADS_TOKEN` env reference. |
| `android/gradle.properties` | Mapbox download token for builds |
| `.env` | Gitignored |
| `.npmrc` | `legacy-peer-deps=true` for EAS build compatibility |

**Local-only / gitignored:** SPB pipeline scripts (`fetch-spb-*.js`, `load-*-to-postgis.js`, `*.geojson` outputs), original Amsterdam OSM helpers (`fetch-osm-polygons.js`, `migrate-territories-v2.js`, etc.), `candidates_combined.csv`. ⚠️ `retry-failed-polygons.js` still has hardcoded service role key — move to env var before file ever leaves the local machine.

`dominia_mechanics_v6_10.md` — game design doc, formulas.js aligned to this version.

---

## KEY FILES — BACKEND (`C:\Users\nisha\dominia-backend`)

| File | Purpose |
|---|---|
| `package.json` | Node `>=22`, ESM. Scripts: `dev` (tsx watch), `build` (tsc), `start` (node dist), `typecheck`, `postinstall` (`prisma generate` — required for Railway `npm ci`). |
| `.nvmrc` | `22` — required for Railway Nixpacks (Node 20 crashes on Supabase realtime-js). |
| `tsconfig.json` | ES2022, ESNext, Bundler resolution, strict, outDir `./dist`, rootDir `./src`. |
| `.env` (local, gitignored) | Same key set as Railway. See IMPORTANT KEYS for full list and quoting rules. |
| `.env.example` | Blank values, committed for documentation. |
| `prisma.config.ts` | Prisma 7 config — dotenv-loaded, `env("DIRECT_URL")` as datasource.url. CLI use only; runtime uses adapter. |
| `prisma/schema.prisma` | 13 models introspected from live Supabase. PostGIS `geom` as `Unsupported("geometry")`. |
| `src/server.ts` | Entry point. Side-effect imports boot Firebase + 2 BullMQ workers (contest-expiry, quiet-hours-push). |
| `src/app.ts` | `buildApp()` async factory. Registers all module routes. |
| `src/shared/prisma.ts` | Singleton PrismaClient with `PrismaPg` adapter. globalThis-cached for tsx-watch hot reload. |
| `src/shared/supabase.ts` | Service-role client. Used only by territory GET (PostGIS RPC). |
| `src/shared/auth.ts` | Clerk JWT verification — `requireAuth` Fastify preHandler. Reads `Authorization: Bearer`, calls `verifyToken`, attaches `payload.sub` to `request.clerkUserId`. **Never log token contents.** |
| `src/modules/player/*` | GET/PATCH /me. All Prisma. `PrismaClientKnownRequestError` imported from `@prisma/client/runtime/client` (Prisma 7 subpath). |
| `src/modules/me/home-pin.routes.ts` | (34) POST /me/home-pin. Zod body `{lat: number, lng: number}`. requireAuth. Returns `{ home_timezone, home_city }` (home_city nullable). |
| `src/modules/me/home-pin.service.ts` | (34) `resolveHomeCityFromPin` (PostGIS two-step lookup: ST_Contains on territories.geom → fallback nearest within 10km via ST_DWithin + KNN <-> operator. If both miss, home_city left unchanged). `ensurePostgisSearchPath()` helper using `set_config(..., true)` since Supabase puts PostGIS in the postgis schema. Wraps own `prisma.$transaction` when no tx passed so set_config + lookup share a pinned connection. `setHomePin` writes home_pin_lat/lng/home_timezone/home_city in one transaction. |
| `src/modules/me/fcm-token.*` | PATCH /me/fcm-token. Zod body `{fcm_token: string(1..4096) \| null}`. requireAuth. |
| `src/modules/me/challenge-complete.routes.ts` | (31a) POST /me/challenge-complete. Zod body validates `challenge_key`, `tier` (lowercase enum: easy/medium/hard), `earn_key`. requireAuth. |
| `src/modules/me/challenge-complete.service.ts` | (31a, S43) Orchestrates the entire flow inside ONE `prisma.$transaction`: idempotent player_challenges insert → streak advance → Grace Day grant at days 7/30/60 (capped at 3) → XP via `calcChallengeXp` → resources via `calcResourceEarn` flat table → level via `calcLevel` → single `activity_log` row. **(S43)** After `updatePlayerOnChallengeComplete` returns, checks `isStreakMilestone(newStreak) && snapshot.current_streak < newStreak` — on crossing 7/14/21/30/60/90, calls `grantSiegeXp(tx, playerId, 250)` AFTER the challenge XP increment (so milestone row's `level_before` reflects post-challenge state), then `logStreakMilestone` writes a second activity_log row. Two activity_log rows per milestone-day completion, one per non-milestone. Idempotent via existing `player_challenges` UNIQUE. Returns `{leveled_up, grace_day_granted, ...}`. |
| `src/modules/me/challenge-complete.queries.ts` | (31a, RACE-FIXED 31b, S43) Monetary fields (xp, iron, stone, gold, morale) use Prisma `{increment}` (atomic Postgres `column = column + N`) — fixes race where 3 concurrent POSTs from auto-complete watcher all read same pre-state and last-commit-wins lost easy+medium XP. Streak fields stay absolute SET (safe because `computeNewStreak` is idempotent for same-day repeats + gated by player_challenges UNIQUE). Level recomputed in second UPDATE inside same tx, gated by `calcLevel(newXp) !== currentLevel`. **(S43)** Adds `logStreakMilestone(tx, playerId, payload)` writer — inserts `streak_milestone` activity_log row with metadata `{streak_days, streak_tier, is_milestone:true, xp_awarded, level_before, level_after, leveled_up}`. Domain-local: NOT imported from territory's `XpGrant`/`StreakMetadata` types (cross-module type import would be wrong-direction). |
| `src/modules/me/challenge.formulas.ts` | (31a, S40 shim) Ported subset of root `formulas.js` — CHALLENGE_TIERS, STREAK_TIER_THRESHOLDS, calcChallengeXp, RESOURCE_EARN flat table, validators. **(S40)** `LEVEL_XP_FLOORS` and `calcLevel` now re-exported from `progression/progression.formulas.js` (backwards-compat shim; zero call-site change). |
| `src/modules/me/streak.helpers.ts` | (31a) Pure functions — `computeNewStreak`, `yesterdayOf`, `isGraceDayMilestone`, `applyGraceDayGrant`. |
| `src/modules/streak/streak-rollover.*` | (31c, audit-clarified S43) Midnight rollover. Per-tz repeatable cron `0 0 * * *`. `evaluateRollover` decides per player: consume_grace / reset_streak / no_op. Optimistic-concurrency UPDATE-with-WHERE-guard (`WHERE id=? AND last_active_date=expected`). Sequential per-player processing inside batch (not Promise.all). `activity_log streak_broken` row written in same tx. **(S43 audit clarification)** No XP writes happen here — rollover only handles missed-day paths. Streak ADVANCEMENT happens in `challenge-complete.service.ts` (which is also where the milestone +250 XP fires, alongside `applyGraceDayGrant`). 12 helper tests. |
| `src/modules/streak/streak-break-warning.*` | (31d) 23:55 warning push per-tz repeatable cron `55 23 * * *`. `evaluateWarning` + `formatWarningMessage` per spec §4.5.1. Copy: "You haven't completed today's challenge yet. You have 5 minutes before your streak resets. Grace Days: [N remaining / none]." Dispatched via `sendImmediately` (NOT `sendPush`) to bypass Quiet Hours queue — 23:55 IS inside 23:00–05:00 Quiet Hours and spec mandates the push fires. 13 helper tests. |
| `src/modules/streak/bootstrap.ts` | (31c) `bootstrapStreakRolloverJobs` — registers Queue/Worker pair on startup, then upserts one repeatable job per distinct `home_timezone` in players. 2 jobs registered currently (Europe/Moscow, Europe/Amsterdam). |
| `src/modules/streak/bootstrap-warning.ts` | (31d) `bootstrapStreakBreakWarningJobs` — same pattern for 23:55 warning. Separate file: each scheduled module gets its own bootstrap. |
| `src/modules/alliance/alliance.formulas.ts` | (32) `ALLIANCE_ROLES` tuple, `AllianceRole` type, `ROLE_SLOTS` (founder:1, marshal:2, officer:4, sergeant:6, soldier:null, recruit:null), `ROLE_RANK` (founder=5 → recruit=0), `MAX_ALLIANCE_MEMBERS=20`, `MIN_LEVEL_TO_JOIN=6`, `SHORT_NAME_REGEX`, `FULL_NAME_MIN/MAX_LENGTH`, `isValidShortName`, `isValidFullName`. |
| `src/modules/alliance/membership.helpers.ts` | (32, 36, 38) `canFoundAlliance`, `canJoinAlliance`, `canLeaveAlliance`, `canKick`, `canPromote`, `canDemote`, `canTransferFounder` (S38) — all pure, return `{ok}\|{ok:false, reason}`. `canTransferFounder` reasons: `not_founder` / `target_not_member` / `target_role_ineligible` / `cannot_transfer_to_self`. 34+ helper tests. |
| `src/modules/alliance/alliance.queries.ts` | (32–36) All transaction-safe queries: `fetchPlayerForFounding`, `fetchTerritoryForHq`, `findAllianceByShortName`, `createAllianceWithFounder`, `insertFounderMember`, `attachPlayerToAlliance`, `transitionHqTerritoryToAlliance`, `fetchAllianceForJoin`, `fetchAllianceWithRoster`, `fetchPlayerAllianceContext`, `fetchPlayerMembership`, `insertRecruitMember`, `removePlayerFromAlliance`, `disbandAlliance`, `setAllianceIdOnPlayerTerritories` (propagates territory.alliance_id on join/leave/kick — spec §2.3 + §3.8 + §8.4.2), log writers for founded/joined/left/kicked/promoted/demoted. |
| `src/modules/alliance/found.service.ts` | (32, 35) Orchestrator inside one `prisma.$transaction`. Validates: full_name, short_name format, player level ≥ 6, no current alliance, HQ ownership, HQ city match, short_name unique. HQ transition per spec §3.4: `territories.owner_id → NULL`, `territories.alliance_id → allianceId`. Returns 201 `{ alliance, members }` matching `getAllianceById` exactly (deepEqual-verified). Status codes: 400/403/404/409/422/500. 3 tests including HQ invariant + post-disband re-found regression. |
| `src/modules/alliance/join.service.ts` | (32, 36) Validates city + level + capacity + disbanded_at NULL. Inserts as 'recruit'. Calls `setAllianceIdOnPlayerTerritories` to propagate alliance_id to joiner's existing territories. 410 alliance_disbanded if applicable. 3 tests. |
| `src/modules/alliance/leave.service.ts` | (32, 36) `founder_must_transfer_first` guard. If founder is last member, `disbandAlliance` fires: `alliances.disbanded_at=now()`, `territories.alliance_id=NULL` (HQ reverts neutral per spec §3.4), DELETE alliance_members rows. Non-founder leave calls `setAllianceIdOnPlayerTerritories` to clear alliance_id from leaver's territories. 3 tests. |
| `src/modules/alliance/kick.service.ts` | (36) POST /alliances/:id/members/:playerId/kick. Permission check via `canKick`. Clears territory.alliance_id for kicked player. 6 tests including territory propagation. |
| `src/modules/alliance/promote.service.ts` | (36) POST /alliances/:id/members/:playerId/promote with `{to_role}` body. Founder promotes anyone; Marshal promotes up to Officer. Target roles restricted to marshal/officer/sergeant/soldier (no founder via this endpoint; no recruit — starting state only). 11 tests including `role_slots_full` 409. |
| `src/modules/alliance/demote.service.ts` | (36) POST /alliances/:id/members/:playerId/demote with `{to_role}` body. Founder-only per spec §3.3 literal reading. Same target-role restrictions as promote. 9 tests. |
| `src/modules/alliance/transfer.service.ts` | (38) POST /alliances/:id/members/:playerId/transfer. Caller is current Founder; `:playerId` is incoming Founder (must be Marshal or Officer per spec §3.3 amendment). Inside one `prisma.$transaction`: captures target's current role, then swaps — target → founder, caller → captured role. Uses `canTransferFounder` for validation. Status codes: 400 `cannot_transfer_to_self` / 403 `not_founder` / 403 `target_role_ineligible` / 404 `target_not_member` / 500. Intentionally no 409 (role conservation removes the slot-cap branch). Returns `{ alliance, members }` matching `getAllianceById` exactly (deepEqual-verified). 8 tests including role-count conservation invariant. |
| `src/modules/alliance/get.service.ts` | (32) `getAllianceById` (alliance + roster — source of truth for `{ alliance, members }` shape), `getMyAlliance` (player context). |
| `src/modules/alliance/index.ts` | (32–38) registers found + join + leave + kick + promote + demote + transfer + get routes. |
| `scripts/backfill-home-city.ts` | (34) Idempotent backfill for `players.home_city` via `resolveHomeCityFromPin`. Logs per-player progress and final totals. Ran 10/10 successfully against Railway. |
| `src/modules/debug/routes.ts` | Debug routes gated by `(NODE_ENV !== 'production' \|\| ALLOW_DEBUG_ROUTES === 'true')`. Active: POST /debug/streak-rollover, POST /debug/streak-break-warning, GET /debug/contest-expiry/:contestId. **`ALLOW_DEBUG_ROUTES` currently ON in Railway — flip OFF before any external playtest.** |
| `src/modules/territory/*` | Full CRUD + contest lifecycle. See BACKEND ARCHITECTURE for file breakdown. `claim.queries.ts findPlayerAllianceId` now reads `players.alliance_id` via tx (no longer a stub; unwired in 32). **(S41/S42/S44 progression hooks):** `claim.service.ts` grants `calcClaimXp(tier, {streakDays, isSupplyLineActive:false, isCityEvent:false})` via `grantSiegeXp` inside tx (S42 multiplier-aware). `contest.service.ts` initiate runs `canContestTerritory(attacker, target)` between self-contest guard and tier level gate (S44 §8.1 enforcement); 403 with `CONTEST_REJECT_MESSAGES[reason]`. `contest-walk.service.ts` grants `calcContestWinXp` (attacker_won) or `calcDefenceWinXp` (defender_won) — both multiplier-aware (S42). `contest-expiry.worker.ts` grants `calcDefenceWinXp` to `defender_player_id ?? defender_id`. All four use `findPlayerStreakDays(tx, ...)` to read streak inside tx. `abandon` correctly grants NO XP (Siege XP cannot diminish). Query extensions: `findPlayerByClerkIdForContest` selects `alliance_id`; `findTerritoryForContest` includes `players: {select: {level: true}}` (S44); `findContestForWalk`/`findContestForExpiry` include `tier` (S41). `contest.routes.ts CLIENT_ERROR_CODES` extended to include 403 (S44). |
| `src/modules/progression/progression.formulas.ts` | (S40) Pure math. `LEVEL_XP_FLOORS` (10 levels), `LEVEL_TITLES`, `TerritoryTier` type, `isTerritoryTier`, `calcLevel`, `calcLevelProgress`, `getLevelTitle`, `calcClaimXp`, `calcContestWinXp`, `calcDefenceWinXp` — all three earn formulas accept optional `XpMultiplierOpts` (S42) for streak/supply-line/city-event stacking. Backwards-compat: omit `opts` → flat base XP. Tier keys lowercase to match wire format. |
| `src/modules/progression/progression.queries.ts` | (S40) `grantSiegeXp(tx, playerId, delta)` — THE single XP-write primitive. Atomic Prisma `{increment}` on `players.xp` + conditional 2nd UPDATE for level recompute (gated by `calcLevel(newXp) !== currentLevel`). Returns `{newXp, previousLevel, newLevel, leveledUp}`. Null guard throws `serviceError(500)` with player ID + actual values — loud failure for data integrity, never silent 0/1 fallback. Used by all 4 XP-granting callsites + S43's milestone path. |
| `src/modules/progression/progression.helpers.ts` | (S44) `canContestTerritory(attacker, target): {ok:true} \| {ok:false, reason}` — pure §8.1 protection check, no DB. Discriminated union over 3 reasons: `attacker_level_too_low` (L1–3), `target_solo_protected` (L1–3 solo target), `target_alliance_protected_from_solo` (L4–5 solo attacker vs alliance territory). Pattern mirrors `alliance/membership.helpers.ts`. Reason codes are domain; player-facing copy lives at the callsite (`contest.service.ts CONTEST_REJECT_MESSAGES` map). |
| `src/shared/formulas/canonical-earn.ts` | (S42) `calcCanonicalEarn`, `BONUS_PRODUCT_CAP = 3.0`. Single source of truth for buff stacking — was previously duplicated across modules. Lifted to shared/ to end the drift trap. |
| `src/shared/formulas/streak.ts` | (S42/S43) `STREAK_TIER_THRESHOLDS`, `STREAK_MULT_TIER_CAP` (tier-specific multiplier cap, e.g. ×1.15 on Epic), `STREAK_MILESTONE_DAYS = [7,14,21,30,60,90]`, `STREAK_MILESTONE_XP = 250`, `getStreakTier`, `calcStreakMultiplier` (unified — pre-S42 had two definitions in two files), `isStreakMilestone(streakDays)`. The single source of truth for streak math; previously split between contest and progression modules. |
| `prisma/migrations-manual/20260528-add-streak-milestone-event-type.sql` | (S43) First migration committed under the new `migrations-manual/` convention. Extends `activity_log_event_type_check` constraint via DROP + ADD pattern to whitelist `streak_milestone`. Idempotent against known pre-state. Project uses `prisma db pull` introspection, not `prisma migrate` — hand-written SQL committed for replay/audit, applied via Supabase SQL Editor + verified with `pg_get_constraintdef`. Sets precedent for all future hand-written SQL migrations. |
| `src/shared/notifications/*` | FCM dispatch with Quiet Hours. `sendPush` (lookup token → quiet check → enqueue or immediate), `sendImmediately` (bypasses quiet check by design), `isStaleTokenError` matches 3 codes incl. `messaging/invalid-argument`. |
| `src/shared/queues/contest-expiry.queue.ts` | jobId `expiry-${contestId}` (hyphens not colons). One-shot. |
| `src/shared/queues/quiet-hours-push.queue.ts` | jobId `quiet-${playerId}-${kind}-${timestamp}`. Delayed dispatch to next 05:00 local. |
| `src/shared/queues/streak-rollover.queue.ts` | (31c) Queue + Worker. Repeatable jobId pattern: `streak-rollover-${tz.replace(/\//g, '-')}` (Europe/Moscow → `streak-rollover-Europe-Moscow`). Worker calls `runRolloverForTimezone(tz, todayYmd)`. |
| `src/shared/queues/streak-break-warning.queue.ts` | (31d) Queue + Worker. Same jobId pattern. Worker calls `runWarningForTimezone(tz, todayYmd)`. |
| `src/shared/notifications/types.ts` | (MODIFIED 31d) `PushNotificationKind` union — 4 kinds: `defender_notify`, `contest_won`, `contest_lost`, `streak_break_warning`. |
| `src/shared/notifications/send.ts` | `sendPush` — lookup token → Quiet Hours check → enqueue delayed or dispatch. `sendImmediately` — bypasses Quiet Hours queue by design (used by `streak_break_warning` at 23:55). `isStaleTokenError` matches 3 codes incl. `messaging/invalid-argument`. |
| `src/shared/timezone.ts` | (EXTENDED 31a) `resolveLocalDateTimeToUtc`, `isQuietHours`, `computeNextQuietHoursDispatchUtc`, `getLocalDateInTz(tz, now?)` — returns YYYY-MM-DD in IANA tz. Anchors all streak date arithmetic to `player.home_timezone`. 8 tests. |

---

## IMPORTANT COMMANDS

```
# === MOBILE DEV ===

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

# ADB — package name (UNDERSCORE: com.nish_s.dominia, not nishs580)
adb shell pm list packages | findstr dominia
adb shell am force-stop com.nish_s.dominia
adb uninstall com.nish_s.dominia

# Force-stop app on phone (required after lib/supabase.js changes OR after any EAS build install with native deps changes)
# long-press app icon → App info → Force stop

# Mirror phone to PC
scrcpy

# Unit tests (must stay green before any commit touching formulas.js)
npm test

# Verify project file vs live file (drift check)
Get-FileHash lib\formulas.js -Algorithm SHA256

# === EAS BUILDS ===

# Before EVERY build:
npx expo install --fix

# Dev build (Metro-tethered):
eas build --profile development --platform android

# Standalone preview APK (no Metro / no PC tether):
eas build --profile preview --platform android
# Requires: preview profile has developmentClient:false + MAPBOX_DOWNLOADS_TOKEN env ref,
# AND all EXPO_PUBLIC_* keys present in EAS preview env.

# EAS env vars (separate from legacy `eas secret:list`)
eas env:list --environment preview
eas env:list --environment preview --include-sensitive
eas env:create --environment <env> --name EXPO_PUBLIC_FOO --type string --visibility plaintext
# CRITICAL: --name is the literal KEY; the VALUE is prompted afterwards interactively.
eas env:delete --variable-name "EXPO_PUBLIC_FOO"            # no --environment flag

# File env vars (sensitive — e.g. google-services.json):
npx eas-cli env:create --scope project --environment <env> --name GOOGLE_SERVICES_JSON --type file --visibility sensitive --value <local-path>

# Pre-flight grep before any build:
Get-ChildItem -Recurse | Select-String "process\.env\.EXPO_PUBLIC_"

# Legacy secrets (e.g. MAPBOX_DOWNLOADS_TOKEN — applies across all profiles)
eas secret:list

# Find cached APK
Get-ChildItem -Path "C:\Users\nisha\AppData\Local\Temp\eas-cli-nodejs\eas-build-run-cache" -Filter "*.apk"

# Install APK
& "C:\platform-tools-latest-windows\platform-tools\adb.exe" install -r "<path-to-apk>"

# === BACKEND DEV ===

cd C:\Users\nisha\dominia-backend
npm run dev                           # tsx watch
npm run build                         # full tsc — pre-push gate (catches ESM .js extension issues that typecheck misses)
npm run typecheck                     # tsc --noEmit — NOT sufficient as pre-push gate

# Backend unit tests (193+ tests across 14+ files, native node test runner via tsx)
npx tsx --test src/modules/me/streak.helpers.test.ts
npx tsx --test src/modules/me/challenge.formulas.test.ts
npx tsx --test src/shared/timezone.test.ts
npx tsx --test src/shared/formulas/streak.test.ts          # (S43) 12 tests — isStreakMilestone + boundaries
npx tsx --test src/modules/streak/streak-rollover.helpers.test.ts
npx tsx --test src/modules/streak/streak-break-warning.helpers.test.ts
npx tsx --test src/modules/progression/progression.test.ts                # (S40/S42) 20 — formulas + grantSiegeXp + multipliers
npx tsx --test src/modules/progression/progression.helpers.test.ts        # (S44) 21 — full §8.1 protection matrix
npx tsx --test src/modules/progression/progression-integration.test.ts    # (S41-S44) 14 — all XP grants + protection enforcement
npx tsx --test src/modules/alliance/membership.helpers.test.ts
npx tsx --test src/modules/alliance/found.service.test.ts
npx tsx --test src/modules/alliance/join.service.test.ts
npx tsx --test src/modules/alliance/leave.service.test.ts
npx tsx --test src/modules/alliance/kick.service.test.ts
npx tsx --test src/modules/alliance/promote.service.test.ts
npx tsx --test src/modules/alliance/demote.service.test.ts
npx tsx --test src/modules/alliance/transfer.service.test.ts
# Run all alliance tests in one go (npm test script not yet added — cleanup deferred):
npx tsx --test "src/modules/alliance/**/*.test.ts"
npx tsx --test src/modules/me/home-pin.service.test.ts

# Healthcheck
curl https://dominia-backend-production.up.railway.app/healthcheck -UseBasicParsing

# Prisma
npx prisma db pull --print           # Dry-run introspect
npx prisma db pull                   # Introspect and write to prisma/schema.prisma
npx prisma generate                  # Regenerate @prisma/client

# Diagnostic: verify dotenv var loads correctly
node -e "require('dotenv').config(); console.log('VAR:', JSON.stringify(process.env.VAR_NAME))"

# === DEBUG ROUTES (gated by ALLOW_DEBUG_ROUTES=true on Railway) ===

# Fire streak rollover for a specific timezone (omit todayYmd to use real local date in tz)
$body = '{"tz":"Europe/Moscow","todayYmd":"2026-05-25"}'
Invoke-WebRequest -Uri "https://dominia-backend-production.up.railway.app/debug/streak-rollover" `
  -Method POST -ContentType "application/json" -Body $body -UseBasicParsing `
  | Select-Object -ExpandProperty Content

# Fire 23:55 streak-break warning
$body = '{"tz":"Europe/Moscow","todayYmd":"2026-05-25"}'
Invoke-WebRequest -Uri "https://dominia-backend-production.up.railway.app/debug/streak-break-warning" `
  -Method POST -ContentType "application/json" -Body $body -UseBasicParsing `
  | Select-Object -ExpandProperty Content

# Set up streak-rollover test scenario
# UPDATE players SET current_streak = <n>, last_active_date = '<YYYY-MM-DD>', grace_days_banked = <n> WHERE username = '<user>';

# Set up streak-break-warning test scenario (player must have fcm_token):
# UPDATE players SET current_streak = 5, last_active_date = '2026-05-24', grace_days_banked = 2 WHERE username = '<user>';

# Concurrent POST test pattern (PowerShell — exposes race conditions):
# $easy = Start-Job -ScriptBlock { param($u, $t) Invoke-WebRequest ... } -ArgumentList $uri, $token
# $easy, $medium, $hard | Wait-Job | Out-Null
# Receive-Job $easy
# Remove-Job $easy, $medium, $hard

# nish_s test-state reset (full):
# DELETE FROM player_challenges WHERE player_id = (SELECT id FROM players WHERE username = 'nish_s') AND date = CURRENT_DATE;
# DELETE FROM activity_log WHERE event_type = 'challenge_completed' AND player_id = (SELECT id FROM players WHERE username = 'nish_s') AND created_at::date = CURRENT_DATE;
# UPDATE players SET xp = <baseline>, iron = <baseline>, stone = <baseline>, gold = <baseline>, morale = <baseline>, current_streak = 0, last_active_date = NULL WHERE username = 'nish_s';

# Audit streak_broken history
# SELECT event_type, metadata, created_at FROM activity_log WHERE player_id = (SELECT id FROM players WHERE username = '<user>') AND event_type = 'streak_broken' ORDER BY created_at DESC;

# Today's challenge_completed audit
# SELECT metadata->>'challenge_key', metadata->>'earn_key', xp_amount, metadata->'resources_awarded',
#        metadata->>'streak_after', metadata->>'leveled_up', created_at
# FROM activity_log WHERE event_type = 'challenge_completed'
#   AND player_id = (SELECT id FROM players WHERE username = '<user>')
#   AND created_at::date = CURRENT_DATE
# ORDER BY created_at;

# === ALLIANCE TESTING ===

# Inspect alliance state
# SELECT a.short_name, p.username, am.role, am.joined_at FROM alliance_members am
# JOIN alliances a ON a.id = am.alliance_id JOIN players p ON p.id = am.player_id
# ORDER BY a.short_name, am.role;

# Inspect disbanded alliances
# SELECT short_name, name, disbanded_at FROM alliances WHERE disbanded_at IS NOT NULL;

# Verify HQ invariant (after found): territory.alliance_id matches, owner_id null
# SELECT a.short_name, t.territory_name, t.alliance_id, t.owner_id FROM alliances a
# JOIN territories t ON t.id = a.hq_territory_id WHERE a.disbanded_at IS NULL;

# Audit alliance event types in activity_log
# SELECT event_type, metadata, created_at FROM activity_log
# WHERE event_type LIKE 'alliance_%' ORDER BY created_at DESC LIMIT 20;

# Fire alliance found (PowerShell — token expires ~60s, paste as ONE block):
#   $token = "<jwt>"
#   $body = '{"full_name":"X","short_name":"XYZ","hq_territory_id":"<uuid>"}'
#   Invoke-WebRequest -Uri "https://dominia-backend-production.up.railway.app/alliances/found" `
#     -Method POST -ContentType "application/json" -Body $body `
#     -Headers @{ Authorization = "Bearer $token" } -UseBasicParsing | Select-Object -ExpandProperty Content

# Fire alliance join: POST /alliances/<id>/join with Body "{}"
# Fire alliance leave: POST /alliances/leave with Body "{}"
# Fire kick: POST /alliances/<id>/members/<playerId>/kick with Body "{}"
# Fire promote/demote: POST /alliances/<id>/members/<playerId>/promote with Body '{"to_role":"marshal"}'

# Run backfill script against Railway DB (no Railway CLI installed):
#   $env:DATABASE_URL="<railway_db_url>"
#   npx tsx scripts/backfill-home-city.ts
#   # close terminal after — env var must not persist

# CRITICAL: Supabase SQL editor returns "No rows" for any non-SELECT (UPDATE/DELETE/DDL) — NOT a failure.
# ALWAYS verify writes with a follow-up SELECT.

# === GIT WORKFLOW ===

# Never `git add .` — always specify files. Especially critical with two repos.
cd C:\Users\nisha\dominia-backend
git status
git diff --stat <file>               # Check actual changes before staging — Cursor opens cause phantom-modified files
git add <specific files>
git commit -m "message"
git push                              # Railway auto-deploys on push to main

# === CLERK JWT TESTING ===

# Tokens last ~60s. Grab + use FAST.
#   1. In Cursor on MOBILE repo, temporarily add inside components/AuthGate.js:
#        const { isSignedIn, isLoaded, userId, getToken } = useAuth();
#        useEffect(() => {
#          if (isLoaded && isSignedIn) getToken().then(t => console.log('[CLERK_TOKEN]', t));
#        }, [isLoaded, isSignedIn]);
#   2. Kill + reopen Dominia app on phone (Recents swipe).
#   3. Grep Metro for [CLERK_TOKEN], copy the JWT.
#   4. USE WITHIN ~60s.
#   5. ALWAYS remove the log after copying — NEVER commit.

# Assign $token ONCE, then run ALL test calls in a single Warp paste block.
$token = "ey..."
Invoke-WebRequest -Uri https://dominia-backend-production.up.railway.app/me `
  -Headers @{ Authorization = "Bearer $token" } -UseBasicParsing `
  | Select-Object -ExpandProperty Content

# See actual 4xx response body — Invoke-WebRequest throws on non-2xx and hides body by default
try {
  Invoke-WebRequest -Uri "..." -Headers @{ Authorization = "Bearer $token" } -UseBasicParsing
} catch {
  $_.Exception.Response.StatusCode.value__
  $_.ErrorDetails.Message
}

# Empty-body POST needs explicit Content-Type or Fastify returns 415
Invoke-WebRequest -Uri "..." -Method POST -ContentType "application/json" -Body "{}" `
  -Headers @{ Authorization = "Bearer $token" } -UseBasicParsing

# === DB SCHEMA CHANGES (Supabase SQL editor, no migrations tool yet) ===

# Inspect a CHECK constraint definition:
SELECT conname, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conname = 'activity_log_event_type_check';

# Extend activity_log event_type whitelist (DROP + ADD pattern — every new event_type needs this).
# Current whitelist (19): challenge_completed, territory_claimed, territory_abandoned,
# contest_participated, km_walked, contest_defended, contest_won, contest_lost,
# contest_held, contest_expired, streak_broken, streak_milestone,
# alliance_founded, alliance_joined, alliance_left, alliance_role_changed,
# alliance_kicked, alliance_demoted, alliance_promoted.
ALTER TABLE activity_log DROP CONSTRAINT activity_log_event_type_check;
ALTER TABLE activity_log ADD CONSTRAINT activity_log_event_type_check
CHECK (event_type = ANY (ARRAY[
  'challenge_completed', 'territory_claimed', 'territory_abandoned',
  'contest_participated', 'km_walked', 'contest_defended',
  'contest_won', 'contest_lost', 'contest_held', 'contest_expired',
  'streak_broken', 'streak_milestone',
  'alliance_founded', 'alliance_joined', 'alliance_left', 'alliance_role_changed',
  'alliance_kicked', 'alliance_demoted', 'alliance_promoted',
  '<new_event_type_here>'
]));

# (S43) For new SCHEMA changes (CHECK constraints, columns, etc): the project uses
# `prisma db pull` introspection, NOT `prisma migrate`. Hand-written SQL goes in
# `prisma/migrations-manual/<YYYYMMDD>-<description>.sql`, then is applied via
# Supabase SQL Editor + verified with pg_get_constraintdef. The migration file is
# committed to the repo for audit/replay. Example: `20260528-add-streak-milestone-event-type.sql`.

# Verify DDL ran (Supabase SQL editor returns "No rows" for DDL — NOT a failure):
SELECT COUNT(*) AS table_exists FROM information_schema.tables
WHERE table_schema='public' AND table_name='<my_table>';
```

---

## KNOWN PITFALLS — RECOGNISE & RESPOND

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

**8. Single degenerate polygon poisons entire Mapbox source**
- **Signature:** Valid FeatureCollection returned from RPC, but nothing renders — fill, line, AND tap all fail. No errors logged.
- **Cause:** ONE malformed feature in the collection causes Mapbox GL Native v10 to silently drop the entire layer.
- **Fix:** Filter at source. RPC applies `postgis.ST_IsValid(geom)` AND `postgis.ST_NPoints(geom) >= 4`. Lesson: when fill + line + tap ALL fail on a "valid" feature collection, dump `JSON.stringify(rows[0].geojson)` BEFORE chasing style hypotheses.

**9. PostGIS schema qualification required**
- **Signature:** `type "geometry" does not exist` or `function st_intersects does not exist`.
- **Fix:** Every PostGIS type/function must be schema-qualified: `postgis.geometry`, `postgis.ST_Intersects`, etc. RPCs need `SET search_path = public, postgis`.

**10. GeoJSON CCW convention vs PostGIS CW convention**
- **Signature:** Polygons render flipped / inside-out / not at all.
- **Fix:** `postgis.ST_ForcePolygonCCW(geom)` inside the RPC before `postgis.ST_AsGeoJSON()`.

**11. ST_GeomFromGeoJSON returns Polygon for MultiPolygon-shaped input**
- **Signature:** Inserting Overpass admin polygons via RPC fails on some rows with "Geometry type (Polygon) does not match column type (MultiPolygon)" or vice versa.
- **Cause:** Overpass relations sometimes resolve to a single Polygon outline, sometimes a MultiPolygon. The receiving column expects one shape.
- **Fix:** In the loader RPC, run `CASE WHEN GeometryType(g) = 'POLYGON' THEN ST_Multi(g) ELSE g END` before the INSERT. **Relevant for any future city expansion.**

**12. Aggressive AbortController blanks panned-through map areas**
- **Signature:** User pans fast across the map, intermediate areas show no polygons even after the pan stops. Logs are full of `AbortError` from cancelled fetches.
- **Cause:** Unconditional `abort()` on every new viewport fires cancels near-complete fetches mid-flight.
- **Fix:** **Age-gated abort** — only abort in-flight fetches older than 1s; recent fetches are allowed to complete. Pair with merge-on-fetch. AbortError logs are then *expected noise*, not failures.

**13. Replacing FeatureCollection on every pan = trailing-polygon symptom**
- **Signature:** "Polygons trail in late" on pan — already-visible territories briefly disappear during the fetch, then come back.
- **Cause:** Setting the shape source to a fresh FeatureCollection on each fetch blanks every feature for the duration of the round-trip.
- **Fix:** Hold features in an in-memory cache (`featureCacheRef`, Map keyed by territory id), bound it (~3000 entries with viewport-aware eviction), and **merge** new fetch results in instead of replacing. When real-time lands, invalidate per-entry via `featureCacheRef.current.delete(territoryId)`.

**14. react-native-health-connect crashes on requestPermission with New Architecture**
- **Signature:** App crashes with `UninitializedPropertyAccessException: lateinit property requestPermission has not been initialized`.
- **Cause:** Library Issue #214. The Health Connect permission delegate is `lateinit` in Kotlin and must be initialised by calling `HealthConnectPermissionDelegate.setPermissionDelegate(this)` inside MainActivity's `onCreate`.
- **Fix:** Custom Expo config plugin `plugins/withHealthConnect.js` injects the `setPermissionDelegate(this)` line into MainActivity.kt `onCreate` at prebuild time, plus the `PermissionsRationaleActivity`, `ViewPermissionUsageActivity` activity-alias, and `com.google.android.apps.healthdata` `<queries>` manifest entries. Never edit MainActivity.kt or AndroidManifest.xml directly — the plugin re-runs every prebuild.

**15. Screen-focus-bound `setInterval` halts background polling when screen sleeps (ARCHITECTURAL)**
- **Signature:** Outdoor walk for ~60 min yielded only ~31 calibration ticks (expected ~360 at 10s cadence). Every tick reported `speedKmh: 0`.
- **Cause:** `ActiveClaimScreen` drove its 10s distance/calibration loop via `useFocusEffect` + `setInterval`. The moment the screen loses focus (phone in pocket, screen off), the interval pauses.
- **Fix:** TaskManager.defineTask now OWNS the full tick logic. Task runs on every location event (1s cadence from foreground service); body is gated by `now - claimState.lastTickAt >= 10000` to preserve the 10s cadence. Task writes to module-level `claimState` with subscribe/emit + AsyncStorage snapshot. Screen subscribes and re-renders on emit.
- **General lesson:** any setInterval/useEffect work that must continue with screen off belongs in a TaskManager task. The screen should subscribe to shared state, not drive a timer.

**16. Component-scope idempotency guards die on remount; UNIQUE constraint is silent**
- **Signature:** Multiple `challenge_completed` rows in `activity_log` for the same `challenge_key + date`, but only ONE row in `player_challenges`. Triggered by tab switches, app foreground/background cycles.
- **Cause:** `onCompleteChallenge` did `await supabase.from('player_challenges').insert(...)` with no `.select()` and no return-value check. The UNIQUE conflict raised an error but downstream XP / resource / activity_log / level writes fired unconditionally. In-memory guards (`inFlightTiersRef`, `completedKeys`, `isCompleting`) all reset on unmount.
- **Fix:** (1) Chain `.select()` on the insert and inspect the return — error code `23505` (unique_violation) OR empty rows array → bail with `return` BEFORE downstream writes. (2) Added `challengesLoaded` boolean (default false, true only after initial `player_challenges` fetch completes); auto-complete watcher gated on it.
- **General lesson:** any idempotent operation that crosses a DB boundary needs DB-level enforcement, not component-state guards. In-memory state is ephemeral; UNIQUE constraints are permanent.

**17. Async load effects open race windows with watcher effects**
- **Signature:** A watcher effect with a dependency array including async-loaded state can fire BEFORE the async load completes — using default/empty state.
- **Cause:** `useEffect` with dependencies fires whenever any dependency changes. If `playerId` resolves before `completedKeys`, the watcher sees `playerId !== null` and `completedKeys.size === 0` and starts firing for tiers that are actually already done.
- **Fix:** Add a "loaded" boolean set to true ONLY after every async setter in the load effect completes. Watcher guard: `if (!loaded) return`.
- **General lesson:** when a watcher effect depends on data that loads asynchronously, gate the watcher on a separate "loaded" flag.

**18. Cursor remembers a stale working directory after files move on disk**
- **Signature:** You moved a folder. Subsequent Cursor agent prompts say they wrote files, but the files don't exist at the new path. They turn up at the OLD path, recreating the structure you just moved.
- **Cause:** Cursor caches the workspace's working directory.
- **Fix:** Always `File → Open Folder` on the correct repo path before pasting any prompt. After any folder move, `Remove-Item -Recurse -Force` the old (now empty) location so Cursor cannot accidentally recreate it. Verify with `dir <new path>` that files Cursor claimed to create actually exist.
- **General lesson:** Trust `dir`/`type` in Warp over Cursor's reported success message.

**19. Clerk JWTs are short-lived (~60s) — token expiry feels like a 401 bug**
- **Signature:** `/me` returns 401 "Invalid token" with a token you just copied from the phone. Re-grabbing the token and re-running curl within seconds succeeds.
- **Cause:** Clerk session JWTs default to ~60 second TTLs.
- **Fix:** Use the PowerShell variable form `$token = "..."` so you don't need to rebuild the request between attempts. When in doubt, regrab the token first, then theorise about other causes only if a fresh token also fails.
- **General lesson:** for any short-lived bearer scheme, "Invalid token" is almost always expiry on the first failure. Don't add diagnostic logging until you've confirmed it isn't expiry.

**20. `Invoke-WebRequest` swallows the 4xx response body**
- **Signature:** A request returns 400/401/404 and PowerShell shows `WebException` with no body.
- **Cause:** `Invoke-WebRequest` throws a terminating exception on any non-2xx response by default; the throw discards the response body unless you catch it.
- **Fix:** Wrap in try/catch and read `$_.ErrorDetails.Message`. See IMPORTANT COMMANDS.

**21. activity_log CHECK constraint silently rejects new event_types**
- **Signature:** Insert fails with `DriverAdapterError` mentioning a CHECK constraint. Error doesn't say which constraint.
- **Cause:** `activity_log.event_type` has a CHECK with a hardcoded ARRAY whitelist.
- **Fix:** DROP + ADD CONSTRAINT pattern. See IMPORTANT COMMANDS for full SQL.

**22. ESM relative imports without `.js` extension crash on Railway but pass locally**
- **Signature:** Local dev works fine. Push to Railway. Deploy logs show `Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/app/dist/shared/queue'`. `npm run typecheck` was clean before push.
- **Cause:** Backend is `"type": "module"` (ESM). Node's ESM resolution requires explicit file extensions in relative imports — `./shared/queue.js`, not `./shared/queue`. Dev runtime (`tsx`) uses TypeScript-style resolution and is forgiving; production is strict. `tsc --noEmit` doesn't catch this; full `tsc` does.
- **Fix:** Add `.js` to every relative import between TS files. Bare imports of npm packages do NOT need the extension. Always run `npm run build` (not just `npm run typecheck`) before pushing.

**23. BullMQ rejects jobIds containing colons — use hyphens**
- **Signature:** `BullMQ throws "Custom Id cannot contain :"` when calling `queue.add(name, data, { jobId: "expiry:${contestId}" })`.
- **Cause:** BullMQ reserves `:` as a Redis key separator internally.
- **Fix:** Use hyphens. Convention: `expiry-${contestId}`, `quiet-${playerId}-${kind}-${timestamp}`. Apply to ALL future scheduled-job IDs.

**24. AuthGate useEffect race: navigation unmounts component before async state update — register lifecycle hooks INLINE inside runGate, not in a separate effect**
- **Signature:** A useEffect in AuthGate.js gated on a local `isOnboarded` boolean never fires its body, even on first sign-in.
- **Cause:** The gate sets `isOnboarded` via `setIsOnboarded(true)` AFTER navigating to MainTabs. But `navigation.replace('MainTabs')` unmounts AuthGate. The state update fires on an unmounted component → React skips the re-render → the useEffect never fires.
- **Fix:** Register lifecycle hooks (e.g. FCM token grab) INLINE inside the imperative `runGate()` function, BEFORE the navigation call, fire-and-forget with `.catch`. Don't use a separate `useEffect` gated on transient state.
- **General lesson:** any side-effect that needs to run "after gate checks pass" should run inside the gate function itself, not in a downstream useEffect.

**25. Concurrent POSTs to same row: read-modify-write absolute SET loses increments (ARCHITECTURAL)**
- **Signature:** Three challenge-complete POSTs fire within <1s from auto-complete watcher on screen mount (liveSteps > all three tier thresholds). Each transaction reads same pre-state, computes `xp = pre.xp + tierXp`, writes absolute SET. Last commit wins — easy + medium XP awards are lost. UNIQUE on player_challenges prevents double-completion but does NOT serialise the read-modify-write of the players row.
- **Cause:** `prisma.update({ data: { xp: pre.xp + delta } })` is a textbook lost-update race when concurrent.
- **Fix:** Use Prisma `{increment}` for ALL accumulator columns (`xp: { increment: delta }`, same for iron/stone/gold/morale). This compiles to atomic Postgres `UPDATE ... SET xp = xp + N`. Streak fields can stay absolute SET ONLY because (a) `computeNewStreak` is idempotent for same-day repeats and (b) `player_challenges` UNIQUE gates entry. Level recompute goes in a SECOND update inside same tx, reading post-increment xp.
- **General lesson:** any monetary/counter column updated by potentially-concurrent endpoints needs `{increment}`, never read-modify-write. Use PowerShell `Start-Job` parallel POSTs to surface this race in dev before users do.

**26. Prisma DATE column returns JS Date object, NOT YYYY-MM-DD string**
- **Signature:** Streak rollover comparison `player.last_active_date === yesterdayYmd` always false. Logs show `last_active_date: 2026-05-24T00:00:00.000Z` (Date) vs expected string `'2026-05-24'`.
- **Cause:** Postgres `DATE` columns deserialise to JS `Date` in Prisma. String comparison silently fails.
- **Fix:** Convert via `toISOString().slice(0, 10)` for YYYY-MM-DD comparison; convert back to `Date` for writes. Apply consistently in any streak/date-arithmetic code path.
- **General lesson:** for any Postgres DATE/TIMESTAMP column, decide string-or-Date at the ORM boundary and convert at one well-named seam.

**27. Debug routes return 404 in production — env-var bypass over flipping NODE_ENV**
- **Signature:** POST /debug/streak-rollover returns 404 on Railway. Same route works locally.
- **Cause:** Debug routes gated by `NODE_ENV !== 'production'`. Railway sets `NODE_ENV=production`.
- **Fix:** Added `ALLOW_DEBUG_ROUTES` env-var bypass: `if (process.env.NODE_ENV !== 'production' || process.env.ALLOW_DEBUG_ROUTES === 'true')`. Keeps prod-strictness elsewhere; debug routes opt-in via env. **MUST flip OFF before any external playtest.**
- **General lesson:** when prod-mode strictness blocks a legitimate test path, add an opt-in env flag rather than weaken `NODE_ENV` semantics globally.

**28. 23:55 push falls inside Quiet Hours (23:00–05:00) but spec mandates it fires**
- **Signature:** Calling `sendPush({kind:'streak_break_warning'})` at 23:55 enqueues a deferred BullMQ job to dispatch at 05:00 next morning — defeats the whole purpose of the 5-minute warning.
- **Cause:** `sendPush` enforces Quiet Hours at the send site by enqueueing delayed dispatch. 23:55 is inside the quiet window by design.
- **Fix:** Use `sendImmediately` (already exists in `shared/notifications/send.ts`) — it bypasses the Quiet Hours queue and dispatches directly via FCM. Spec §4.5.1 explicitly mandates this push fires inside Quiet Hours.
- **General lesson:** before inventing a new bypass flag, scan the existing API surface — `sendImmediately` was already there for exactly this case.

**29. Clerk `getToken` is a new function reference on every render — useEffect infinite loop**
- **Signature:** `Maximum update depth exceeded` error on a screen that fetches with a Clerk token. Metro spams the fetch. UI flashes.
- **Cause:** `const { getToken } = useAuth()` — `getToken` is a fresh function reference every render. Including it in `useEffect` dep array causes infinite re-runs.
- **Fix:** Capture once via ref. Pattern: `const getTokenRef = useRef(getToken); getTokenRef.current = getToken;` then call `() => getTokenRef.current()` inside the fetch. Exclude `getToken` from dep array.
- **General lesson:** any value from a third-party hook that's a new reference on every render needs to be captured via ref before use in effects. AllianceScreen.js is the canonical example in this codebase.

**30. Supabase PostGIS lives in `postgis` schema, not on default search_path — ST_Contains/ST_DWithin fail silently**
- **Signature:** Prisma `$queryRaw` for `ST_Contains(geom, ST_SetSRID(ST_MakePoint($lng, $lat), 4326))` returns empty or errors with "function does not exist".
- **Cause:** Supabase puts PostGIS in a dedicated `postgis` schema. Default Postgres search_path doesn't include it.
- **Fix:** Run `set_config('search_path', 'postgis, public', true)` at the start of every transaction that touches PostGIS. The `true` flag scopes it to the current tx — does not leak across connections. Wrap helper as `ensurePostgisSearchPath(tx)`. When called without a tx (e.g. backfill scripts), wrap in own `prisma.$transaction` so set_config + lookup share a pinned connection.
- **General lesson:** for any Postgres extension on a non-default schema, set search_path per transaction. Schema-qualifying every function call (`postgis.ST_Contains`) works too but is noisier.

**31. Stale session-summary observations masquerading as code bugs**
- **Signature:** Session summary lists a bug. New session opens to fix it. Reading current code shows the bug is already fixed — the original observation was stale data from before a prior fix, or test debris from a crashed cleanup hook.
- **Cause:** Session summaries are written at the end of a session and capture a snapshot. By the next session, behaviour may have changed via other commits, or the "bug" was always a data issue rather than a code issue.
- **Fix:** Before scheduling a fix session, read the current code directly — the actual source file, not the session summary. If the code is correct, the right move is a regression test that locks the behaviour, not a rebuild. Two suspected bugs in S35 (founding HQ link, disband member cleanup) turned out to be already-fixed in current code at S36.
- **General lesson:** session summaries are notes, not source of truth. When in doubt, `view` the file. Particularly suspect: bugs filed against data state (those are usually one-off cleanups, not code fixes). **Applied throughout S37 and S38 — both sessions changed the hypothesis at least once after the read-only diagnosis pass.**

**32. Best-effort cleanup awaited without a timeout can hang the UI for minutes (auth teardown chains)**
- **Signature:** Sign-out, account-switch, or other teardown action hangs for multiple minutes before completing. User has to clear app storage to recover. Same call works fast from a fresh session.
- **Cause:** Awaited network calls in a teardown chain (e.g. `await clearFcmToken(); await signOut()`) with no timeout. Either call can hang on a dead TCP pool for minutes. The cleanup PATCH needs the JWT, so ordering (cleanup-before-auth-teardown) is correct, but neither call should be allowed to block the UI indefinitely.
- **Fix:** Wrap every best-effort cleanup side-effect in `Promise.race` against a `setTimeout`. Pattern lives in `lib/fcm.js` `clearFcmToken` (3s timeout) and `screens/ProfileScreen.js` logout handler (`signOut()` raced against 5s). Also add `Connection: close` header to any raw `fetch` in the cleanup path (matches `lib/supabase.js` pattern). The auth library clears local session state synchronously — the network revoke is best-effort.
- **General lesson:** any best-effort cleanup in a teardown chain must have a timeout race. The user's UI should never block more than ~6s on cleanup. (S37)

**33. Live-state-vs-persisted-snapshot merge: capture the live flag BEFORE merging, branch on the captured value**
- **Signature:** Two parallel mount effects — one runs synchronously and sets `state.active=true`, the other resolves async and does `Object.assign(state, persistedSnapshot)`. The async one wins because it's later. The fresh `active=true` is stomped by a stale snapshot's `active=false`. Downstream consumer (e.g. a TaskManager loop) hits an `!state.active` early-return on every tick and never makes progress.
- **Cause:** `Object.assign(state, parsed)` is a full overwrite. If you treat the persisted snapshot as authoritative without checking whether the live state has already been freshly set, you lose the live update.
- **Fix:** Capture the live flag BEFORE any merge: `const wasActive = state.active === true;`. Then branch:
  - If `wasActive`: selective merge only — copy a fixed list of CONTINUATION_FIELDS from parsed into state where state's value is null. Never overwrite the live fields.
  - If `!wasActive`: full `Object.assign(state, parsed)` — preserves the recovery path (e.g. "app killed in pocket", cold mount).
- **General lesson:** for any "in-memory state + persisted snapshot" merge pattern, capture the live flag before merging, branch on the captured value, never trust post-merge state for the branch decision. Lives in `lib/claimState.js` `rehydrateFromStorage`. (S38)

**34. Subtle-position-sensitive Cursor edits fail repeatedly — escalate to whole-function replacement prompts**
- **Signature:** A diff requires surgical placement (e.g. "capture X BEFORE the assign that's already there"). Cursor's first attempt leaves the assign in the wrong place, defeating the fix. Second attempt with the same instructions still fails. Wasted 2+ round-trips.
- **Cause:** Cursor handles position-sensitive diffs less reliably than whole-function rewrites. The instruction "capture X before Y" gets executed as "add the capture line near Y" which can land on either side.
- **Fix:** When a position-sensitive diff fails twice, skip "diff instructions" and go straight to "replace this entire function with exactly this code, character for character." Whole-function replacements land reliably on the first try.
- **General lesson:** when Cursor keeps missing a subtle edit, switch from describing the delta to providing the full target shape. (S38)

**35. "Code-complete + green-tests + closed-IDE ≠ shipped" — uncommitted slices look identical to live ones**
- **Signature:** PROJECT_STATE marks a slice as shipped. Next session's Step 5 file-audit (`git log --oneline -10`) shows the latest commit is from a previous slice, with all the "shipped" files unstaged in working tree. Tests are still green because they ran locally against the uncommitted code.
- **Cause:** Closing the IDE / wrapping the session before running `git push`. Local green tests don't imply upstream deployment. S42 was marked shipped May 28; surfaced May 29 in S43.
- **Fix:** Every slice's final step explicitly requires: (1) `git status` clean, (2) commit pushed to `main`, (3) Railway healthcheck returns 200 against the new commit hash. "Shipped" is a three-condition state, not a feeling. Burned into S44's plan structure onward.
- **General lesson:** the only valid "shipped" signal is upstream verification. Before declaring a slice done, paste `git log -1 --oneline` + a `curl /healthcheck` result into the session record. (S43)

**36. Top-level imports of contest/Redis-backed services hang Windows test runners on open handles**
- **Signature:** `tsx --test` tests pass on Windows but the runner never exits. CI hangs. Test that imports `initiateContest` from `contest.service.js` at the top of the file is the trigger.
- **Cause:** Top-level `import { initiateContest } from 'contest.service.js'` transitively loads BullMQ + ioredis singletons (`shared/redis.ts`, queue files). On Windows, those open handles prevent the Node test runner from exiting after tests complete.
- **Fix:** Two changes: (1) dynamic `await import(...)` inside the helper that needs the service, NOT at the top of the file. (2) Explicit `await redis.quit()` in a file-level `after()` hook. Pattern applies to ANY test that exercises contest-initiate, contest-walk, or any service that transitively loads queue/Redis singletons.
- **General lesson:** if a test that should pass-and-exit hangs on Windows, suspect top-level imports of services with persistent connections. Convert to dynamic import + explicit teardown. (S44)

**37. Prisma relation names aren't always auto-generated — read schema.prisma before using them**
- **Signature:** Test or service code uses a Prisma relation name like `players_territories_owner_idToplayers` (the multi-FK auto-generation pattern). Prisma errors: "Unknown field `players_territories_owner_idToplayers` on model Territory."
- **Cause:** Prisma only generates the disambiguated relation name when there are MULTIPLE FKs from the same source model to the same target model. With only one FK from `territories` to `players`, the relation is just `players` — not the verbose auto-name.
- **Fix:** Always grep `schema.prisma` for the exact relation field name before referencing it in includes/selects. Audit step explicitly: "find the literal relation name used in schema.prisma" before writing any Prisma include.
- **General lesson:** don't guess Prisma relation names from convention — read the schema. The autonaming rules only apply on collision. (S44)

**38. Spec contradictions must be resolved BEFORE building, not during**
- **Signature:** Step 3 of building a slice surfaces a contradiction between spec sections (e.g. §8.1's "Solo-vs-Solo Only" heading vs a conflicting bullet allowing L4–5 solos to attack alliance territory). Tests start to bake in one interpretation; unwinding is expensive.
- **Cause:** Spec drift — different sections edited at different times with different mental models. Catching this mid-build means choosing while in code-writing mode, which biases toward whatever's easier to keep coding.
- **Fix:** A "decisions-locking" step BEFORE Step 1 audit. Read the relevant spec sections cold; flag every contradiction; pick one interpretation explicitly and queue a spec correction. Build proceeds against the locked interpretation. Step 1 audit confirms the locked decision is still right against the current code.
- **General lesson:** spec contradictions are real. Resolve them in planning, not in coding. The cost of an unwind is much higher than the cost of an extra read-through. (S44)

**39. Domain-locality discipline for writer helpers and helper module placement**
- **Signature:** Tempted to import `XpGrant`/`StreakMetadata` types from `territory/xp-grant.types.ts` into `me/challenge-complete.queries.ts` to write a milestone log row. Cross-module type import for ONE writer creates wrong-direction module dependency (challenge-complete → territory).
- **Cause:** Reusing types because they share a shape, not because they share a domain. Territory's `StreakMetadata` carries multiplier-specific fields (`streak_multiplier`) that don't apply to flat 250 milestones.
- **Fix:** Add a domain-local writer (`logStreakMilestone` in `me/challenge-complete.queries.ts`) with an INLINE metadata signature mirroring `logChallengeCompleted` in the same file. New function, no cross-module imports. Helper modules for pure rule-checks live with the DOMAIN of the rule, not the domain of the caller: `progression.helpers.ts` for `canContestTerritory`, even though the only caller is `territory/contest.service.ts`.
- **General lesson:** module ownership is by domain (whose rule is this?), not by call site (who needs to call it?). Same applies to keeping player-facing copy at the callsite (`CONTEST_REJECT_MESSAGES`) while reason codes stay in the helper. (S43/S44)

**40. Discriminated-union return shapes beat thrown errors for pure rule helpers**
- **Signature:** A pure rule-check helper throws on failure. Every test wraps it in try/catch and inspects `error.message`. Tests are noisy; multiple-reason rejections require string matching on the error message.
- **Cause:** Throwing is fine for "this should never happen" guards but wrong for "this is one of N legitimate outcomes." Throwing forces every caller to do exception inspection where they could be doing a switch on a reason code.
- **Fix:** Return `{ok: true} | {ok: false; reason: ReasonCode}`. Tests assert on `result.reason` directly. Service layer maps reason codes to wire errors (HTTP status + player-facing message). The HELPER stays pure: no knowledge of HTTP, no string copy. The SERVICE owns the wire mapping (`CONTEST_REJECT_MESSAGES`). Mirrors `alliance/membership.helpers.ts` pattern.
- **General lesson:** if a function has multiple legitimate failure outcomes that the caller needs to discriminate, return a discriminated union, not a thrown error. Reserve throws for invariant violations. (S44)

**Debugging playbook — when something is slow or broken:**
1. **PowerShell-from-PC test** — if fast on PC + slow on phone, it's the dead-pool bug or a client-side issue
2. **Fetch wrapper logs** — `[supabase fetch]` timing tells you whether the network call is slow
3. **EXPLAIN ANALYZE in SQL editor** — tells you if the database query is slow
4. **Render-side check** — does a UI change in the same file appear on device? If not, you're on a stale bundle. Reload Metro before debugging the code.
5. **Force-stop the app** after `lib/supabase.js` changes — long-press app icon → App info → Force stop.
6. **Dump raw data first when rendering breaks** — `JSON.stringify(rows[0].geojson)` BEFORE chasing style hypotheses (Pitfall #8).
7. **Snapshot resources in ONE SQL block immediately BEFORE and AFTER every test action.** Mid-session forensics on live DB data gives ambiguous answers.
8. **Verify EAS env vars match what the JS bundle reads BEFORE kicking a build.** Pre-flight grep: `Get-ChildItem -Recurse | Select-String "process\.env\.EXPO_PUBLIC_"`.
9. **Get evidence before theorising.**

---

## OPEN BUGS

| Bug | Detail |
|---|---|
| **Phantom git "modified" status on backend territory files (recurring)** | `git status` shows backend files as modified after Cursor sessions, but `git diff --stat <file>` shows 0 inserts/deletes — content byte-identical to HEAD. Cosmetic only. Verify with `git diff --stat` BEFORE staging; only `git add` files with real changes. |
| **BigInt JSON serialization for `osm_id` (masked)** | Typecheck passes but runtime serialization may need a Fastify JSON serializer if `osm_id` ever lands in an outgoing payload. Currently masked because test territories have `osm_id = null`. |
| **Cross-player defender_notify FCM real-device test still deferred** | Server-side defender_notify trigger verified via temp debug route (now removed). The real flow (second player attacks nish_s, attacker_first_walk_at sets, defender_notify push lands on nish_s's device) NOT verified end-to-end. Requires second device + second Clerk account, or another tester. Same surface verifies the deferred defender-role /walk test. |
| **403 not_a_participant on /walk untested** | Code path for "player is neither attacker nor defender_player_id" is straightforward but untested via real third-player token. Defer until a third Clerk account is in physical reach. |
| **React Native Firebase v22 namespaced API deprecation warnings** | Logs deprecation warnings on every call. Modular API migration required before v23 ships. Cosmetic for now. |
| **`onTokenRefresh` listener not cleaned up at unmount** | FCM listener registered in `registerFcmToken` lives for app lifetime — no cleanup at AuthGate unmount (deliberately moved away from useEffect, see Pitfall #24). Idempotent: re-subscribing on next gate run would duplicate calls. Only matters if session lifecycle ever changes (e.g. account switching without app restart). |
| **Mobile FCM foreground push handler not wired** | Notifications only display when app backgrounded — Android system tray handles those automatically. Foreground delivery (in-app banner) requires `messaging().onMessage(...)`. |
| **Nested / overlapping SPB territories** | Spotted on phone visual test after gap-fill propagation. Some gap-fill blocks overlap each other and/or existing OSM-named SPB territories. Root cause unknown. Diagnostic query needed: find pairs where `postgis.ST_Overlaps(a.geom, b.geom)` or `postgis.ST_Contains(a.geom, b.geom)` is true beyond a tiny tolerance. |
| **Zoom-level rendering: some small polygons missing at wide zoom** | At Mapbox scale ~500m/750m, some territories that exist in DB don't render; at tighter zoom they show. Hypothesis: `ST_SimplifyPreserveTopology` tolerance collapses small polygons below `ST_NPoints >= 4`. |
| **37 SPB gap-fill blocks flagged_oversize = true** | Perim > 8000m, manual visual review deferred. |
| **Some OSM POI names are bureaucratic asset codes** | e.g. 'Near СО17-2873 N' as a tier-2 landmark. Fix at frontend display layer (`formatTerritoryDisplayName`). |
| Diagnostic logs still in MapScreen.js | `[vp fetch] START / OK / ABORTED / ERROR / SKIP` + older `[geojson diag]`, `[shape source feed]`, `[feature builder]`, `[render]`. Keep until zoom-simplify + nested-territories bugs solved. |
| Dead RPCs in Supabase | `get_all_territories_meta` and `get_territories_geojson_batch` no longer called. Safe to drop. |
| `retry-failed-polygons.js` has hardcoded service role key | Local-only file (never committed) but key must move to env var before file ever leaves local machine. |
| RLS missing on all tables | Disabled to fix slow load. Re-enable with Clerk-JWT-based RLS before production. |
| Client Trust + email verification disabled in Clerk | Both disabled for dev. Re-enable before production. |
| Real step tracking in ActiveClaimScreen | (S31, S38) TaskManager + Health Connect drive the real 10s loop (the "DEV_MODE=true / fake interval" earlier note was outdated — that path was removed when TaskManager took over in S31). S38 fixed the rehydrate-vs-startClaim race in `lib/claimState.js`. Distance ring now advances correctly on device, screen-on + screen-locked-in-pocket. |
| Cascade auto-completion partially verified | Easy + Medium auto-completion verified mid-walk. Hard (15k) single-tick cascade unverified but very low-risk. |
| Steps (background read) permission not granted | Only required for true background reads when app is closed. |
| 3 of 4 ContestResultScreen branches unverified on device | Code wired for attack_won, attack_lost, defence_won, defence_lost. Only attack_won verified. |
| Onboarding home pin verification not implemented | 500m proximity check deferred. |
| Auth flow order wrong | New users hit sign-up before seeing any game content. |
| Achievements table hardcoded | Distance, Calories, Active Minutes wiring deferred. HC can provide via additional `readRecords` calls. |
| **4 pre-HQ-feature alliances have NULL hq_territory_id** | (36) KAI, GGG, SNW, BUD founded before HQ designation existed. Not a bug in current code. Resolve by either leaving them, adding a "designate HQ retroactively" endpoint, or forcing re-founding. KAI used in S38 for transfer testing — confirmed NULL hq doesn't affect transfer endpoint. Defer. |
| **Slot-cap error (role_slots_full 409) not device-verified** | (36) KAI doesn't have enough members to fill slots. Backend test #8 in `promote.service.test.ts` covers it; client error path is identical to join-error path which is device-verified. |
| **GET /alliances?city=X endpoint not built** | (32+) Mobile browse list works via direct Supabase reads with `.is('disbanded_at', null)` + `.eq('city', playerHomeCity)`. Cleanup, not blocker. |
| **Mobile "TOP CONTRIBUTORS" and "MISSION" cards on MemberContent still stub UI** | (34+) Neither endpoint exists yet. |
| **Mobile "Detected city: X — correct?" UI in onboarding not wired** | (34+) `POST /me/home-pin` now returns home_city; mobile still ignores. Low priority since derivation is reliable. |
| **Spec §3.1 still describes "Home District" 5-nearest picker** | (33+) Columns dropped in S33, derivation auto-resolves in S34. Spec rewrite still pending (Home District = home city, not a territory). |
| **short_name re-use after disband not addressed in spec** | (32+) Currently blocked by UNIQUE constraint on alliances.short_name. Decide before launch: free up on disband_at OR keep permanent (Hall of Holders attribution). |
| Legacy Titles on Profile hardcoded | Needs Supabase wiring once real title data exists. |
| ProfileScreen colour constants not on theme tokens | Refactor to lib/theme.js. |
| TERRITORY_CAP_BY_LEVEL duplicated | In MapScreen.js + ProfileScreen.js. Move to formulas.js. |
| lib/streak.js DEAD CODE awaiting deletion | (31b) `updateStreakOnChallengeComplete` superseded by backend `POST /me/challenge-complete`. Deferred to dedicated dead-code pass. |
| lib/territory.js has no unit tests | Does Supabase I/O — mocking strategy is the gating decision. |
| player_number hardcoded as #0001 | Sequential column not yet added. |
| Siege XP constants — partial coverage | (S40-S44) **WRITERS NOW LIVE** for XP_PER_CLAIM (S41/S42), XP_PER_CONTEST_WIN (S41/S42), XP_PER_DEFENCE_WIN (S41/S42), and STREAK_MILESTONE (S43, +250 at days 7/14/21/30/60/90). Still no writers: XP_RECONQUEST (depends on reconquest tracking; schema is ready), XP_PER_DEV_TIER_REACHED (depends on Territory Development), XP_ALLIANCE_MISSION (depends on Alliance Missions module), XP_WEEKLY_BONUS (depends on weekly challenge system). Each unwired source is now a one-line hook at an existing callsite when its dependency ships. |
| **`total_xp` field in `/me/challenge-complete` response is stale on milestone days** | (S43, cosmetic) When a milestone fires, the HTTP response's `total_xp` is computed BEFORE the milestone `grantSiegeXp` so it lags by +250. DB state and activity_log rows are correct; response is one grant behind. One-line fix: `milestoneGrant?.newXp ?? updateResult.new_xp` when building the response payload. Deferred — out of S43 scope. |
| **Spec §8.1 internal contradiction (Solo-vs-Solo Only heading vs L4-5-can-attack-alliance bullet)** | (S44) Section §8.1 heading reads "Solo-vs-Solo Only" and L4 unlock copy says *"Alliance forces still can't touch you"* — implying symmetric protection. A conflicting bullet allows L4-5 solos to attack alliance territory. S44 locked Option A (stricter mirror-symmetric) in code; spec correction queued. Build behaviour: L4-5 solo attacker vs alliance territory → 403 `target_alliance_protected_from_solo`. |
| **§7.7 reconquest XP (+400 within 72h) not wired** | (S44) Backlog. Schema is ready: `territory_history.owner_id` (prior holder FK) + `lost_at` (nullable timestamptz). `flipTerritoryToAttacker` already sets `lost_at` on flip. Detection query: `territory_history WHERE owner_id = attacker_id AND lost_at > now() - interval '72 hours'`. Hook into `contest-walk.service.ts` attacker_won branch. Multiplier-aware path is live (S42) — slots into the same `calcContestWinXp(tier, opts)` shape. One-day slice. |
| **Stubs `isSupplyLineActive: false` / `isCityEvent: false` at 4 callsites** | (S42) Hardcoded literals at every claim/contest-walk/contest-expiry XP grant. Flip when Alliance Abilities (Supply Line, ×1.20 Siege XP) and City Events (×1.5 Siege XP) modules ship. One-line change per callsite. |
| Legacy Power inputs partial | titlesEarned + championshipWins hardcoded to 0. |
| Draggable bottom sheet deferred | gorhom/bottom-sheet — batch into next EAS build. |
| Invite non-player flow missing | No share/invite link flow yet. |
| POI icons on Standard night basemap | Currently overridden by `light-v11` dev style. Will resurface at polish phase. |
| `formatTerritoryDisplayName()` not yet written | Frontend display formatter — strip 'Near' prefix on tight surfaces, truncate long Cyrillic names, hide bureaucratic asset codes. |
| BullMQ delayed push jobIds use timestamp suffix | `quiet-${playerId}-${kind}-${Date.now()}` — edge case if same trigger fires twice within 1ms. Unlikely in practice. Real fix is contestId+kind suffix; non-blocking. |
| Attack Day check (Wed/Sat/Sun) still DEFERRED with TODO on contest.service.ts (inherited by /walk) | A player CAN currently post /contests AND /walk on a non-Attack-Day if a contest is somehow active. Wiring is a 5-line addition using `Intl.DateTimeFormat` + player.home_timezone. Wire before any external playtest. |
| **ALLOW_DEBUG_ROUTES=true still ON in Railway** | (31c) Enables `/debug/*` in prod. Flip OFF before any external playtest. |
| **lib/challengeApi.js has no retry logic** | (31b) Single-shot POST — failed call reverts optimistic UI and returns. Player can re-tap or auto-complete refires on next liveSteps tick. Acceptable for MVP; revisit if flaky-network reports surface. |
| **Milestone push notifications (Day 7/14/21/30/60/90) not wired** | (S43 update) **Backend milestone XP +250 + `streak_milestone` activity_log row NOW LIVE** in challenge-complete.service.ts. FCM plumbing also LIVE since 30b/30c. What's missing is only the mobile push trigger + in-app celebration UI. Both deferred to notifications consolidation session. |
| **Level-up + Grace-Day UI surfaces on mobile not wired** | `POST /me/challenge-complete` already returns `leveled_up` + `grace_day_granted` booleans in response. Mobile reads them but doesn't surface a UI moment. Spec §4.5 (Grace Day grant banner) + level-up animation deferred. |
| **Spec §4.5.2 break confirmation message** | "In-app message on next app open after streak break" — mobile UI not built. Backend writes `streak_broken` to `activity_log`; mobile needs to detect on first read after break. |
| **Spec §4.5.3 re-entry framing** | "Back. That's what matters." copy on first challenge after a break. Mobile UI not built. |
| **New-timezone hot-registration not implemented** | (31c/31d) Player setting a new home pin in a tz nobody else uses won't get rollover/warning jobs until next backend restart. `bootstrapStreakRolloverJobs` runs once on Fastify ready. Acceptable for MVP — only matters when first player in a new tz signs up between restarts. Real fix: trigger bootstrap re-scan when `POST /me/home-pin` writes a tz not already in the registered set. |
| **City Event detection stubbed (`isCityEvent=false`) in calcChallengeXp** | Spec §6.4.3. Deferred until City Event infrastructure exists. |
| **Daily/weekly earn cap stubbed (`capFactor=1.0`) in calcChallengeXp** | Spec §13. Deferred. |
| **Resource earn uses flat table, not canonical earn** | Spec §5 +10% Committed-tier bonus not applied. Matches existing mobile behaviour for backend cut-over parity. Spec-alignment task deferred. |
| **Marshal-granted Grace Day not implemented** | (32–36) Marshal role now exists via `alliance_members.role`. Endpoint `POST /alliances/:id/grant-grace` not built; spec §4 mentions Marshal can grant. Deferred. |

---

## DEFERRED / OUT OF SCOPE

- Background step reads (`READ_HEALTH_DATA_IN_BACKGROUND` permission) — granted in manifest, not yet requested from user. Defer until "always-on tracking" feature.
- Alliance chat — post-MVP.
- Onboarding home pin 500m verification.
- **Phase 2 of SPB territory pool** — merging existing 485 sub-tier OSM-named SPB territories into the unified gap-fill pool.
- **Amsterdam gap-fill pipeline** — expected ≤30 new fill blocks. Run after SPB nested-territories cleanup proves the pipeline idempotent.
- Custom Mapbox night style swap-back (currently `light-v11` for dev).
- **Ably cache-invalidation hook in MapScreen.js** — when real-time multiplayer lands, subscribe to `territory:updated` channel and call `featureCacheRef.current.delete(territoryId)` on each event. ~1 hour of work; integrates with existing `handleTerritoriesRefetched(territoryId)` pattern.

---

## WHAT'S NEXT

**Immediate — Next session — Activity module scoping (planning only, NO CODE).**

Progression module is now CORE COMPLETE (S40-S44). All 11 Siege XP earn sources in the module's independent surface are live: claim, contest_won, contest_held, contest_expired, streak milestones. Six remaining earn sources (reconquest, dev tier, alliance mission, weekly bonus, supply line, city event) are now one-line hooks at existing callsites — they ship when their dependent modules ship, not as Progression-module work.

The next big build is the **Activity module** — `POST /activity/steps` with backend-side velocity-check anti-cheat (25 km/h threshold). Single source of truth for step credit. Distinct from contest `/walk`. Leaderboard module is gated on this (it reads from Activity's verified step credit).

**Scope (Activity scoping session):**
1. Read spec §6 (challenges) and §13 (anti-cheat / daily caps) carefully.
2. Audit existing step-credit paths: mobile's Health Connect read, contest `/walk` ingest pattern, `challenge-complete` flow. Identify the seam where step credit should be centralised.
3. Draft the `activity/` module structure: `routes.ts`, `service.ts`, `queries.ts`, `velocity.helpers.ts` (25 km/h check). Decide how it composes with existing challenge-complete + contest-walk endpoints.
4. Identify the smallest first slice — probably the velocity-check helper + `POST /activity/steps` endpoint with player-anchored window, leaving daily cap enforcement and integration with challenges for follow-up.
5. **Output:** a session plan document + a draft module structure ready to build from in the session after. Same pattern as S32 (alliance) and the implicit pre-S40 progression scoping.

**Also do at the start of next session, before scoping:**
- Verify Progression module is marked CORE COMPLETE in this doc (done in this update).
- Confirm `total_xp` stale-response bug from S43 is on the backlog (done).
- Confirm §8.1 spec contradiction is queued for correction (done).

**Alternative picks if deferring Activity scoping:**
- (a) **Wire reconquest +400 XP** — §7.7. Schema is ready, hook into contest-walk attacker_won branch, one-line `calcContestWinXp(tier, opts)` call. ~half-day slice.
- (b) **Fix `total_xp` stale response on milestone days** — one-line fix in challenge-complete response payload. ~15 min.
- (c) **Spec §7.8 rewording** — own=red, alliance=green, other=blue-grey alignment. ~15 min.
- (d) **GET /alliances?city=X backend endpoint** — mobile browse cleanup. ~30 min.
- (e) **Inactive-Founder auto-succession** (30+7 day rule, spec §3.3) — scheduled BullMQ job, multi-session.

---

## BACKLOG

**Backend modules to land:**
- **Progression module** ✅ **CORE COMPLETE (S40-S44)** — Siege XP grants live across claim/contest_won/contest_held/contest_expired; streak milestone +250 XP at 7/14/21/30/60/90; solo protection enforced at contest initiate. 55 progression tests + 12 shared/formulas tests + 54 me/ tests green. Six earn sources (reconquest, dev tier, alliance mission, weekly bonus, supply line, city event) remain as one-line hooks at existing callsites, gated on their dependent modules shipping.
- **Activity module — `POST /activity/steps`** ⭐ NEXT — backend-side velocity-check anti-cheat (25 km/h threshold), single source of truth for step credit. Distinct from contest `/walk`.
- **Notifications consolidation session** — see "Deferred to notifications consolidation session" bucket below. Lands after Activity.
- **Leaderboard module** — Redis Sorted Set reads, ZADD on contest resolution. Lands after Activity (depends on Activity's verified step credit).
- **Realm module** — realm assignment, saturation monitoring.
- **Inactive-Founder auto-succession (30+7 day rule, spec §3.3)** — needs scheduled BullMQ job. Defer.
- **Recruit auto-promote on 3 consecutive challenges (§3.3 probation)** — lives in `challenge-complete.service.ts`, not alliance module.
- **HQ contest adjacency-first rules (§3.4)** — gated on contest spec re-read.
- **Weekly alliance missions (§3.10)** — post-promote endpoints session.
- **GET /alliances?city=X endpoint** — cleanup, not blocker. Mobile browse list works via direct Supabase reads.
- **Cross-player contest stress-test.** With Ably mobile client + push subscriber both wired, run a multi-player attack scenario end-to-end on two real devices.
- **`territory:updated` Ably channel** — publish from claim / abandon / contest resolve so mobile MapScreen can invalidate `featureCacheRef`. Gating the MapScreen GET /territories cut-over.

**Mobile migrations / hardening:**
- **Mobile "Detected city: X — correct?" UI in onboarding** — `POST /me/home-pin` now returns home_city; mobile still ignores. Low priority since derivation is reliable.
- **Mobile "TOP CONTRIBUTORS" and "MISSION" cards on Alliance MemberContent** — stub UI, no endpoints yet.
- **MapScreen from direct RPC → backend `GET /territories`** — cut-over when realtime invalidation via Ably is wired.
- **Direct `players.update()` calls → `PATCH /me` / `POST /me/home-pin`** — audit + cut-over.
- **Delete dead code: `lib/streak.js` + `updateStreakOnChallengeComplete`** — dedicated dead-code pass.
- **RN Firebase v22 → v23 migration** — namespaced → modular API. Migrate before v22 deprecation hits.
- **`formatTerritoryDisplayName` helper** — clean up bureaucratic POI asset codes, strip `Near ` prefix on tight surfaces, truncate long Cyrillic names.
- **Tests for `lib/territory.js`** — Supabase mocking strategy is the gating decision.
- **Daily Achievements live data** — wire Distance, Calories Burnt, Active Minutes via additional `readRecords` calls.

**Deferred to notifications consolidation session** (a single future session that wires all notification triggers + UI surfaces at once, so the foreground push handler and in-app notification surface get designed once across everything):
- Kick / demote / promote / join / leave triggers — backend FCM plumbing LIVE, copy + triggers not wired.
- **Streak milestone celebration UI** (spec §4.5.2 — "Day 7. Proven streak.") — backend `streak_milestone` activity_log row + +250 XP grant LIVE since S43. Mobile push trigger + in-app moment deferred to this session.
- **Level-up notifications and mobile UI** — backend writes `leveled_up:true`, `level_before:N`, `level_after:N` to `activity_log.metadata` from S41 onward (also returned in `/me/challenge-complete` response). Mobile UI deferred to this session.
- **Streak XP bonus UI** (e.g. "Proven streak: +15%" on claim/contest screens) — backend writes `streak_multiplier` to metadata from S42 onward. Mobile UI deferred.
- **403 reject-message mobile mapping** (S44) — mobile currently displays the wire payload `{error:"<message>"}` verbatim. Future work may map machine-readable reason codes to localized strings — backend already supplies the reason internally, just not on the wire today.
- First-earn notification plumbing — push infra LIVE; needs the actual first-earn detection + dispatch.
- Level-up + Grace-Day UI surfaces on mobile — `POST /me/challenge-complete` returns booleans, mobile doesn't show them.
- Spec §4.5.2 break confirmation + §4.5.3 "Back. That's what matters." re-entry framing — mobile UI on next app open after a break.
- Spec §8.4.2 alliance system message to all existing Alliance members on join.
- Foreground push handler — wire `messaging().onMessage(...)` to surface in-app banner or route to relevant screen.
- `onTokenRefresh` listener cleanup — unsubscribe pattern so AuthGate re-mounts don't stack listeners.
- In-app notification center / inbox screen — doesn't exist yet.

**Backend hardening:**
- **Attack Day check** (Wed/Sat/Sun) on `/contests` initiate + `/walk` — both deferred with TODO. Wire together using `player.home_timezone` via `Intl.DateTimeFormat`.
- **Flip `ALLOW_DEBUG_ROUTES` OFF on Railway before external playtest.**
- **New-timezone hot-registration** — trigger `bootstrapStreakRolloverJobs` re-scan on `POST /me/home-pin` if tz is new.
- **Prisma migrations setup** — activity_log CHECK constraint at 18 event_types; every new module adds more.
- **Generate Supabase types** for backend `Database` type. Currently `any` (only used by territory GET module now).
- **Add `cors` to Fastify** before mobile starts hitting backend cross-origin browser-side.
- **402 insufficient-resource path on claim + contest-initiate + defend (Stone)** all untested.
- **Spec-alignment: Resource earn through canonical-earn (Committed-tier +10% bonus)** — currently flat table on backend. Mobile already uses flat too.
- **`lib/challengeApi.js` retry logic** — currently single-shot. Acceptable for MVP, revisit if flaky-network reports.
- **4 pre-HQ-feature alliances (KAI, GGG, SNW, BUD) with NULL hq_territory_id** — resolve by leaving them, adding a "designate HQ retroactively" endpoint, or forcing re-founding.

**Carried open sub-questions (mobile):**
- Mobile MapScreen still calls `supabase.rpc('get_territories_in_viewport')` directly. Cut-over deferred until mobile Ably realtime layer is wired.
- Mobile direct `supabase.from('players').update(...)` calls are divergent state since `PATCH /me` and `POST /me/home-pin` exist.

**Spec rewrites:**
- **Spec §3.1 still describes "Home District" 5-nearest picker** — columns dropped in S33, derivation auto-resolves in S34. Spec needs rewrite (Home District = home city, not a separate territory).
- **Spec §7.8 needs rewording** — (S37) current literal text says "all alliance-affiliated territories display in the same faction colour" but actual design is: own = red, alliance members = green, other = blue-grey. The current design lets a player instantly see which territories are theirs vs their alliance's — more useful than uniform green. Spec text to match design.
- **Spec §3.3 amended in S38** — outgoing Founder takes incoming Founder's previous role (not always Marshal). Already updated in `dominia_mechanics_v6_10.md` by user.
- **short_name re-use after disband policy** — spec doesn't address. Currently blocked by UNIQUE constraint. Decide before launch.

**Map polish (queued):**
- Nested / overlapping SPB territories investigation — diagnostic query for `ST_Overlaps` / `ST_Contains` pairs.
- Zoom-level simplification fix — diagnostic count of survives-simplify vs total in viewport.
- Strip diagnostic logs in MapScreen.js (`[vp fetch] *`, `[geojson diag]`, etc.).
- Drop dead RPCs (`get_all_territories_meta`, `get_territories_geojson_batch`).
- Phone visual review of 37 `flagged_oversize` blocks.
- Drop `territory_name_v1` rollback column once gap-fill names verified stable.
- Drop 5 temp tables (`gap_fill_*`, `spb_*`).
- Flip `DIAG_CALIBRATION` to false (or remove).
- Flip `DEV_MODE_MANUAL` on ActivityScreen back to false.

---

## DECISION LOG

| Decision | Reason |
|---|---|
| Mapbox over react-native-maps | Better OSM support, vector tile rendering, territory polygon overlays |
| Territory bottom sheet (not full screen) | Keeps map visible behind it |
| Territory bottom sheet shows perimeter distance, not geographic distance | Matches game mechanic |
| Mapbox token in .env only, never in source | Security — learned the hard way (git history rewrite after accidental commit) |
| Dev build required (not Expo Go) | Mapbox needs native modules |
| All screens hardcoded first, backend after | Build all screens before wiring Supabase — avoids premature complexity |
| @clerk/clerk-expo (not @clerk/expo) | Correct package; metro shim fixes react-dom bundling |
| `npx expo install --fix` before every EAS build | Catches version mismatches that silently break builds |
| Batch all native module installs into one EAS build | EAS budget is limited |
| legacy-peer-deps=true in .npmrc | Required for EAS build npm ci to succeed |
| react-native-screens pinned to 4.16.0 | Fixes IllegalViewOperationException |
| USB debugging via adb (not WiFi) | AVG firewall + VPN blocked WiFi Metro connection |
| Alliance chat deferred to post-MVP | Complexity not needed until core loop is working |
| Clerk password breach protection disabled | Allows test password during dev |
| Clerk publishable key hardcoded in App.js | Env vars unreliable in React Native at runtime |
| Supabase URL/key hardcoded in lib/supabase.js | Same reason — env vars unreliable at runtime |
| DEV_MODE = true in ActiveClaimScreen | Fake interval for rapid testing |
| Abandon over Patrol for own territories | Patrol mechanic not built end to end |
| **react-native-health-connect 3.x with custom Expo plugin** | Custom `plugins/withHealthConnect.js` injects `setPermissionDelegate(this)` into MainActivity.kt at prebuild — surgical, in-repo, easy to maintain at SDK upgrades. |
| minSdkVersion 26 via expo-build-properties plugin | android.minSdkVersion in app.json not respected by Expo managed workflow |
| App-code writes for territory_history (not Postgres triggers) | Easier to debug, matches existing pattern |
| Contest write order: close-out → territories → INSERT | Prevents two rows with lost_at = null for same territory |
| **Client-side feature cache over server-side caching** | Small, no infra change, works offline-ish on revisit. Server-side would mean Redis or PG materialised views — overkill for per-pan re-fetch. |
| **Stale-while-revalidate semantics for cache** | When Ably real-time lands, invalidate via `featureCacheRef.current.delete(territoryId)` + trigger re-render. Already wired via `handleTerritoriesRefetched` for Abandon flow. |
| **3000-entry cache cap with viewport-edge eviction** | Balances memory vs UX. Eviction never touches what's currently on screen. |
| **Age-gated abort (1s threshold) over unconditional cancel** | Preserves intermediate viewport data when user pans fast. Single in-flight + skip-if-recent prevents pile-up. |
| **Merge-on-fetch over replace** | Visible features never blank during a pan. FeatureCollection grows monotonically (bounded by cache cap). |
| **150ms debounce on onCameraChanged** | Cache absorbs higher fetch frequency safely. Tight debounce gives near-immediate feedback. |
| **Zoom-simplify bug deferred** | Performance is good enough to develop on. Only affects wide zoom on small polygons. |
| History writes use console.warn-only error handling | A history bug must never cause a player to lose XP, resources, or ownership |
| Currently-held rows count toward hold duration metrics | Player holding 30 days hits Rank 2 even before losing it |
| **Health Connect over expo-sensors Pedometer** | Pedometer is foreground-only on Android. §6 daily challenges need background reads. |
| **Custom Expo plugin over community `expo-health-connect`** | Community plugin v0.1.1, July 2024, predates RN 0.74+ New Arch. Custom in-repo is surgical and easy to maintain. |
| **Kept New Architecture enabled** | `expo-doctor` showed no other issues. Disabling adds tech debt that has to be reverted at SDK 55 anyway. |
| **3-session split for step tracking** | Session A: HC verified standalone. Session B: wire into ActivityScreen. Session C: foreground service + GPS + live steps for Active Claim. Avoids debugging 3 integration points at once. |
| **Permanent HealthConnectDebugScreen, not temp** | Useful for the life of the project — every future HC bug starts with "what does HC actually return now?". |
| **Long-press Profile commander name as hidden-debug trigger** | Invisible to real users, no UI pollution, reusable for future debug screens. |
| **`debug_events` is freeform event_type** | Disposable infrastructure for fast iteration. Adding new event types should never need a migration. |
| **`logDebug()` is fire-and-forget with console.warn-only error handling** | A debug log failure must never block real gameplay. |
| Backfilled open rows excluded from ownershipChanges | Only completed holds count |
| Plain Jest config (testEnvironment: node), NOT jest-expo preset | formulas.js is pure CommonJS — jest-expo crashes on non-RN test files |
| Single test file sectioned with describe blocks | Easier to grep — all 348 tests run in one command |
| legacyRankName lookup uses object not array | Array with empty-string at index 0 caused `??` to skip fallback |
| When Cursor proposes shell commands for file edits: skip, redirect | Skip-then-redirect worked |
| POWER section sits above Influence on Profile | Power is §10 canonical ranking metric, Influence is a resource |
| Total Power hero shown even when 2 of 3 components blank | Better to show hero now with honest empty rows |
| calcContestWinXp + calcClaimXp return BASE XP only | Modifiers deferred to broader canonical-earn-calc wiring |
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
| PostGIS lives in `postgis` schema, not `public` | Supabase's recommended pattern — separate schema isolates PostGIS types |
| RPC returns flat columns, not nested objects | Easier to debug, no nested null-relation surprises |
| Server-side ST_ForcePolygonCCW in RPC | PostGIS stores CW, GeoJSON/Mapbox require CCW. Fix at source |
| Server-side ST_IsValid + ST_NPoints >= 4 filter in RPC | One degenerate polygon silently broke entire Mapbox source |
| Single viewport RPC replaces two-phase fetch | ~10s+ → ~330ms |
| Light Mapbox style (`light-v11`) for dev, custom night at polish | Collapsed complex visual debugging into obvious binary check |
| Delete degenerate territories rather than fix them | Some had 3 points, 0 m² area — no valid polygon to fix |
| Mapbox `slot` semantics non-obvious, omit by default | Add slot only when layer-order problems are diagnosed |
| Never `git add .` — always specify files | One slip from leaking the service role key |
| Data-before-styling diagnostic | When fill + line + tap ALL fail on "valid" features, dump `JSON.stringify(rows[0].geojson)` first |
| **SPB envelope defined by KAD ring road** | OSM relation 1861646 (Cyrillic 'А-118'). A bounded envelope is essential — polygonising "all of SPB" with no border explodes to coastline + airports + farmland. |
| **Use OSM relation ID, not name, for non-Latin places** | OSM tags KAD as Cyrillic; Latin returns nothing. Numeric ID is the only reliable cross-locale approach. |
| **Service roads excluded from polygonisation** | Driveways and parking aisles run inside blocks, not between them. |
| **Hybrid 3-tier naming cascade** | Tier 1 OSM quarter, Tier 2 'Near <landmark>' within 100m, Tier 3 nearest street within 500m. Matches how locals describe places. |
| **Merge floor 100m, ceiling 8000m (flag, don't auto-split)** | Sub-100m slivers are polygonisation noise — merge into largest-shared-edge neighbour. Above 8000m flag-don't-split because some legitimately span large areas. |
| **Existing 485 OSM-named SPB territories never touched in Phase 1** | Phase 1 was greenfield gap-fill only — touching named territories risks breaking claimable game state. |
| **Temp tables kept post-session** | `gap_fill_*` and `spb_*` retained for ~1 week for rollback, oversize review, and follow-up disambiguation. |
| **Districts from OSM, not Google/Mapbox Geocoding** | Free. Matches Mapbox basemap labels. Polygons reusable for district-level features. Geocoding APIs would cost real money at 7,810 lookups. |
| **Both admin_level=5 (район) AND admin_level=8 (okrug) fetched** | Okrug is finer grain and more locally recognisable; район kept as fallback. |
| **Centroid containment (not polygon intersection) for admin assignment** | Guarantees single-district per block. Polygon intersection would assign blocks straddling boundaries to multiple districts. |
| **200m snap radius for boundary-slop blocks** | 34 of 297 NULL-district blocks were within 200m of a district polygon — clear "centroid landed on the wrong side" cases. |
| **outside_spb_admin flag** | 263 blocks inside KAD ring but outside SPB city admin. Flagged not deleted — inside playable envelope. |
| **Hybrid disambiguation: landmark backfill first, numeric suffix as fallback** | Landmark backfill (250m POI search) gives 2,154/7,013 duplicates a meaningful name. Numeric fallback guarantees zero duplicates. |
| **POI conflicts in landmark pass not pre-resolved** | If two blocks both rename to "Near St Isaac's Cathedral", let them — numeric suffix pass disambiguates. Simpler than greedy POI assignment. |
| **Numeric suffix ordering: north→south then west→east** | Stable, deterministic, reproducible. |
| **Backend territory_name stays unique and complete; frontend handles display formatting** | Keeps disambiguation pure at data layer; UI surfaces have different length budgets. |
| **`public.territories.district` is generic, city-agnostic** | No okrug column, no outside_spb_admin propagated to `territories`. Adding new cities doesn't need new columns. |
| **10s polling cadence for ActivityScreen step reads** | Health Connect is read-only polling. 10s feels "live enough" without battery cost. |
| **Permission banner + LOCKED tiers, not auto-prompt** | User controls the consent moment. |
| **Three separate atomic writes for cascaded tier completion** | §6.1 mandates each resolved tier pays out independently. |
| **`DEV_MODE_MANUAL` flag kept in source** | Mirrors `ActiveClaimScreen.DEV_MODE`. Useful escape hatch for HC debugging. |
| **Today's bar in weekly chart detected by position, not weekday** | `readWeeklySteps` always returns 7 rows ending today (idx 6). Immune to weekday-indexing bugs. |
| **Smooth trend curve drawn as SVG overlay, pointerEvents="none"** | Bars remain independently tappable. Curve is decorative. |
| **Standalone preview APK over dev-build-with-Metro for outdoor walk tests** | One-time cost: 1 EAS build + 4 EAS env vars + 1 eas.json edit. Permanent unlock for all future real-walk verification. |
| **`isQualifyingCalibrationWindow` return shape `bool` → `{ qualifies, rejectReason }`** | Per-tick reject-reason histograms via `debug_events` proved valuable. Check order: accuracy_low → accuracy_high → speed_high → window_short. |
| **`DIAG_CALIBRATION` defaults `true` for current preview builds** | One row per 10s tick, fire-and-forget. Every walk produces a reject-reason histogram for next session's first SQL query. |
| **TaskManager task owns the claim loop; screen is a pure consumer** | The task is already alive during a claim, already on the location-event stream, already survives screen sleep. Smallest architectural delta. |
| **Module-level ref + AsyncStorage snapshot for shared claim state, not DB row** | Module ref is the fast UI read path; snapshot survives the realistic failure mode (app killed in pocket). |
| **Task writes `claimState.completed` flag; screen owns navigation** | TaskManager runs outside React, has no nav context. If the screen is asleep when threshold is crossed, navigation fires the instant the user wakes it. |
| **DB-level idempotency for challenge cascade, not better in-memory guards** | In-memory state dies on unmount; UNIQUE constraint is permanent. Chain `.select()` on insert, check 23505 + empty array, bail before downstream writes. |
| **`challengesLoaded` boolean gates the auto-complete watcher** | Defense in depth — watcher doesn't try until state is hydrated. |
| **Separate backend repo, not monorepo** | Cleaner CI, independent deploy cadence, no risk of Expo build picking up server-only deps. |
| **Railway over Fly / Render for backend hosting** | Easiest Postgres-adjacent deploy, generous free credits, GitHub auto-deploy, simpler ops surface. |
| **TypeScript on backend, plain JS stays on mobile** | Backend touches more typed boundaries (Supabase, Clerk, BullMQ, Prisma). Mobile stays JS — the two never share source. |
| **Prisma on backend, Supabase JS stays on mobile** | Backend write paths need Prisma's transactions. Mobile uses Supabase JS for reads/simple writes. |
| **Clerk `verifyToken` (Option A) over `clerkClient.authenticateRequest`** | Stateless mobile-backend API — no session storage/SSR/cookies needed. |
| **Service role Supabase key on backend, anon key stays on mobile** | Backend must bypass RLS for trusted operations. Service role never leaves server. |
| **Fastify first, Ably later** | Land repo + deploy + auth cleanly before realtime layer. |
| **First endpoints `/healthcheck` + `/me`** | Together they validate the entire stack. |
| **Pin Node 22 in BOTH `package.json` engines AND `.nvmrc`** | Belt + braces. Railway crashed on first deploy with Node 20 (Supabase realtime-js needs native WebSocket). |
| **PRIVATE GitHub repo for backend** | Eventually holds service-role keys, Clerk secret keys, FCM credentials. Flippable to public later. |
| **All Cursor prompts state target repo in copyable code block** | Two repos = two working directories. Explicit `[BACKEND: ...]` or `[MOBILE: ...]` header prevents cross-repo accidents. |
| **Module-based backend structure committed as target end-state** | Every session adds modules toward this structure — never throwaway scaffolds. Settling architecture upfront removes recurring cost. |
| **Prisma 7 over Prisma 6 — fresh install, no migration cost** | Prisma 7 was current stable when we installed. Breaking changes (URL in `prisma.config.ts`, single `url` field) were free for greenfield. |
| **Full Supabase schema introspected, only `players` model used initially** | Schema mirrors DB reality; every model ready when needed; "unsupported" warnings cost nothing because Prisma is query-only. |
| **Session pooler as DIRECT_URL, Transaction pooler as DATABASE_URL** | Windows home networks IPv4-only → Direct unreachable. Session pooler for CLI, Transaction pooler for runtime. |
| **Alphanumeric-only Supabase DB password** | Symbols break dotenv parsing silently. 24-char alphanumeric has equivalent entropy and zero parsing surprises. |
| **Prisma generates to default `node_modules/@prisma/client` path** | Conventional import path, all Prisma docs use it. |
| **Prisma is query-only — Supabase owns schema, not Prisma** | Schema changes done in Supabase first, then `prisma db pull` syncs. Avoids dual-source-of-truth conflicts. |
| **Verify env vars with dotenv diagnostic before debugging Prisma** | `node -e "require('dotenv').config(); console.log(...)"` is the cheapest first move. |
| **Prisma 7 driver adapter (`@prisma/adapter-pg`) over `engineType="library"`** | Prisma 7's `engineType="library"` is silently ignored. Adapter is the only viable self-hosted Postgres path. |
| **`PrismaClientKnownRequestError` from `@prisma/client/runtime/client` in Prisma 7** | Runtime subpath changed. `tsc --noEmit` passes locally but full build fails. Always `npm run build` before pushing. |
| **`postinstall: "prisma generate"` in package.json** | Railway `npm ci` doesn't auto-generate the client. Two-line fix. |
| **`PATCH /me` MVP fields are username + has_onboarded only; home_pin moved to `POST /me/home-pin`** | Home pin sets are conceptually different (may eventually be paid for moves). Separate validation logic. One endpoint per concern. |
| **Prisma singleton is fine on Railway, revisit if serverless** | Railway runs persistent Node process per deploy. Serverless would need per-request instantiation OR Data Proxy. |
| **`GET /territories` wraps the existing Supabase RPC, NOT Prisma `$queryRaw`** | PostGIS `geom` is `Unsupported`. The RPC encodes hard-won fixes (CCW correction, ST_IsValid, ST_NPoints, simplify tolerance). Zero behaviour drift. |
| **5 viewport params (including zoom), not 4** | Zoom drives `ST_SimplifyPreserveTopology` tolerance. Source of truth is mobile's call site. |
| **Viewport size cap: 0.5° on each axis** | Generous for legitimate use, hard ceiling on abuse. |
| **All multi-table writes go through `prisma.$transaction`** | The first abandon attempt actually hit a CHECK constraint and rolled back cleanly — proving the pattern. Template for every write endpoint. |
| **Abandon side effects: close `territory_history` + clear `alliance_id` + write `activity_log`** | History must close (open rows = current claim). Alliance must clear (no orphan alliance ownership). Activity log makes it visible to player. NO territory-count decrement (counts computed live). |
| **Activity log event_type pattern: DROP + ADD CONSTRAINT for every new event_type** | No migrations tool yet. Trigger to revisit: 3rd or 4th occurrence (already happening). |
| **Fastify default content-type parser returns 415 on body-less POST** | Mobile clients always send Content-Type via fetch wrapper. PowerShell tests need explicit `-ContentType "application/json" -Body "{}"`. |
| **Phantom git "modified" status on Cursor-opened files** | OS file-stat changes invalidate git stat cache. Run `git diff <file>` first — if empty, leave it alone. |
| **Race-condition strategy for territory claims: optimistic UPDATE-with-WHERE-guard, not SELECT FOR UPDATE** | Single atomic `UPDATE territories SET owner_id = me WHERE id = X AND owner_id IS NULL`, inspect rowCount. Single round-trip, no lock contention. count===0 → 409. Pattern applies to all future contested writes. |
| **Claim Gold REWARD (+10/+20/+50/+100) deferred from claim endpoint** | Gated by first-earn notification system that doesn't yet exist. Cost-only deduction lands the mechanic; reward is a one-line addition when notification plumbing ships. |
| **Tier cost constants live in backend's own `claim.costs.ts`, no shared module with mobile** | Constants change rarely; two repos have different tier-key casing (DB lowercase vs mobile TitleCase). Trigger to share: 3+ pieces of game math. |
| **Free-claim rule requires BOTH level===1 AND territory_count<3 AND tier ∈ {small, medium}** | §7.2 reading. All three conditions must hold simultaneously. |
| **`findPlayerAllianceId` stubbed null in claim until alliance schema lands** | Avoid premature schema guessing. Stub leaves clear TODO. |
| **Multi-line `Invoke-WebRequest` backticks break under interactive paste — use single-line form** | Backtick chain broke mid-paste during a Clerk token expiry, turning POST into effective GET. |
| **Anchor test-territory selection to a known player territory** | Recognisable neighbours surface immediately vs random UUIDs. |
| **Contest endpoint scope: INITIATE ONLY per session, lifecycle phased Sessions 27–30** | Too large for one session given infra dependencies (Redis/BullMQ/Ably). Phasing: S27 initiate, S28 infra, S29 defend, S30+ ingestion + resolution. |
| **Single-Contest Rule enforced BOTH in app code AND DB (partial unique index)** | App-only check has TOCTOU window. DB-only returns opaque Postgres error. Both: clean 409 for common case + race-condition guard for rare case. |
| **Buff snapshots NOT stored on contests row — only frozen `required_walk_m` is persisted** | Deterministic formula. Audit/replay not MVP. activity_log is the audit trail. |
| **Alliance FK columns nullable on `contests`, no FK constraint until alliance module lands** | Stub null at insert; wire when alliance module ships. Columns exist so schema doesn't grow then. |
| **NO denormalised counters on `players` for events already in `activity_log`** | activity_log is source of truth. Denormalised counters drift. `SELECT COUNT(*) FROM activity_log WHERE player_id=X AND event_type='X'` is fast indexed query. Applies to all future event-style data. |
| **`calcRequiredContestWalk` duplicated into backend `contest.formulas.ts`** | Same call as tier-cost constants. Pure function, 30 lines, 10-min port. Backend uses lowercase tier keys. Trigger to share: 3+ pieces. |
| **Attack Day check (Wed/Sat/Sun) DEFERRED on contest endpoint to allow weekday testing** | Implement everything else; stub Step 7 with TODO. Wire before any external playtest. |
| **`tz-lookup` over `geo-tz` for home pin timezone derivation** | Pure JS, ~1MB, instant lookups. Home pins at city granularity — border accuracy is overkill. |
| **`players.home_timezone` is NOT NULL (with backfill) rather than nullable-with-fallback** | Required by contest endpoint. Nullable + UTC fallback creates silent bug surface. Backfill is cheap (7 rows). |
| **Backfill via script that PRINTS UPDATE statements** | Review-before-mutate is safer for one-shot scripts touching every row. 7 rows easy to eyeball-validate. |
| **Clerk token batching: assign `$token` once, run ALL test invocations in one Warp paste** | Whole block executes in under 5 seconds. Tokens expire in ~60s. |
| **For contest testing where attacker owns every territory: temporarily transfer ONE to a player in a DIFFERENT alliance** | One UPDATE, fully reversible. Tests realistic enemy-attack flow. Cross-alliance test data avoids same-alliance edge case. |
| **Ably REST client on backend, not Realtime** | Backend only publishes — no subscribe/presence. Stateless, cheaper, survives restart-heavy environments. Mobile uses Realtime client. |
| **Pub/Sub product selected at Ably signup — does not restrict the app** | All products enabled regardless of choice. Picked Pub/Sub for documentation. |
| **Single Root API key for backend; mobile auth strategy deferred** | Backend (server-side only): Root key. Mobile: options A (scoped key) or B (short-lived tokens via backend endpoint). Decide when mobile actually subscribes. |
| **Redis env var via Railway reference variable, not pasted value** | `${{Redis.REDIS_URL}}` auto-resolves on credential rotation. Zero ops on rotation. Local dev uses `REDIS_PUBLIC_URL`. |
| **Debug routes (`/debug/*`) gated behind NODE_ENV !== 'production'** | Routes are scaffolding — will be removed when real publishes ship. Building auth layer for code-to-be-deleted is waste. |
| **CRITICAL ESM gotcha — explicit `.js` extensions REQUIRED in relative imports for production** | Backend is `"type": "module"`. Dev runtime (`tsx`) forgiving; production strict. ALL relative imports between TS files must end in `.js`. ALWAYS `npm run build` (not just `typecheck`) before pushing. |
| **Territory-owner-only on /defend, NO alliance-member fallback** | Spec §7.4 ambiguous. Picked owner-only because alliance membership reads are stubbed null. Trigger to revisit: when alliance module ships AND playtest reveals owner-not-online hurts retention. |
| **Stone activation via explicit `{useStone: true}` body field, not active-buffs lookup** | No `player_buffs` table. Stone is consumed at use, not pre-activated. UI flow matches. |
| **`defender_starting_walk_m` as a column on `contests` (frozen at /defend tap)** | Mirrors `required_walk_m` "freeze at initiate" pattern. Resolution path is single column read instead of activity_log scan. |
| **Defender push notification triggered by first non-zero attacker `/walk` sample, NOT by `/contests` initiate** | Reduces false-alarm pushes. Gives defenders actionable signal — someone is *actually* walking against your territory right now. |
| **Event-driven contest resolution (any /walk sample can resolve), NOT 23:59-only** | Feels live — winner gets territory the moment they earn it. BullMQ 23:59 path is fallback ("nobody reached threshold, defender wins on tie"). |
| **Dynamic defender catch-up target (`defender_response_ratio × attacker_walked_m`)** | Makes game-sense — defender's catch-up scales with attacker's actual threat. Lets defender win even if attacker stalls. |
| **No per-sample distance cap on /walk — vehicle filter (>25 km/h) is the only anti-abuse gate** | Vehicle filter is unambiguous. Continuous Walk Rule (15-min gap reset) already constrains accumulation. Future revisit: rolling-window speed check if fraud emerges. |
| **`territory_history` is authoritative on flip, no denormalised columns added to `territories`** | territory_history is already source of truth for ownership over time. Denormalised flip-metadata creates same drift surface. |
| **Ably publishes happen AFTER tx commit, never inside the transaction** | If Ably is slow/down, DB tx shouldn't be held open. If Ably fails after commit, worst case is missed notification (recoverable). If Ably succeeded inside a rolled-back tx, subscribers see ghost events (much worse). |
| **Quiet Hours (23:00–05:00) enforced at `sendPush` call site, not at FCM dispatch** | Puts policy at the boundary where the decision lives. BullMQ has built-in delayed jobs. Avoids separate outbox abstraction. |
| **Firebase service account stored as single-line JSON in env var, NOT as file path** | Railway env vars encrypted at rest, rotation-friendly. No file lifecycles on Railway's ephemeral filesystem. |
| **Debug routes for new infra: ship with code, register-then-cleanup before prod** | `/debug/contest-expiry/:contestId` used to verify worker fires without waiting for real 23:59 local. Removed at end of session. Discipline: every debug route logged in session summary and removed before merge. |
| **Mobile FCM client deferred from Session 30b to Session 30c** | Backend FCM independently verifiable via Firebase Console. Mobile FCM has its own failure modes (google-services.json, dynamic config, AuthGate timing) deserving focused attention. Validated: 30c hit several sharp edges that would have cratered a combined session. |
| **`google-services.json` via EAS file env var (sensitive), not committed to repo** | Even though file is technically not secret, mixing public Firebase config into the repo confuses what *is* secret. EAS file env vars with sensitive visibility give one consistent pattern for "credentials and credential-adjacent things". |
| **`app.json` → `app.config.js` migration for Expo dynamic config** | Expo only expands `process.env.X` in dynamic configs. Any field needing env var substitution requires dynamic config. **Delete app.json after migration** — having both is a footgun. |
| **`registerFcmToken` called INLINE in `AuthGate.runGate()`, NOT in a useEffect (FCM AuthGate ordering)** | useEffect-gated-on-state failed because navigation unmounts AuthGate before effect can fire. Imperative-then-navigate inside `runGate` is the only ordering that guarantees execution. Pattern: for "do X then navigate", do X inline imperatively. |
| **`clearFcmToken` called BEFORE `signOut()` (FCM auth-teardown ordering)** | PATCH /me/fcm-token requires a valid Clerk JWT. signOut() invalidates the JWT. Any authenticated cleanup must happen before auth-state teardown. |
| **EAS dev build failures DO NOT count against the monthly cap** | Empirical observation: only successful builds decrement the counter. Failed builds (compile error, missing env var, gradle failure) are free retries. |
| **Firebase Android package `com.nish_s.dominia` — underscore tolerated but technically invalid** | Android package convention is reverse-domain lowercase + digits + dots, no underscores. Firebase accepted it; Google Play Console may complain at release. First suspect if FCM ever rejects token registration with opaque error. Fix before first Play Store upload. |
| **Backend owns full challenge-completion flow inside ONE `prisma.$transaction`** | (31a + 31b) Single source of truth. Mobile is thin client: optimistic UI + one network call + state refresh. Eliminates 6 separate Supabase writes from mobile that previously caused partial-state on flaky network. |
| **All streak date arithmetic anchored to `player.home_timezone` via `getLocalDateInTz`** | (31a) `player_challenges.date` column compared as YYYY-MM-DD string. Pure string compare = zero timezone drift. Backend converts Postgres DATE → YYYY-MM-DD at the ORM seam. |
| **Grace Day model: bank capped at 3, granted at days 7/30/60, one consumed per missed day** | (31a + 31c) Reset only when bank hits 0 with gap still present. Multi-day absences drain bank over consecutive nights. |
| **Resource earn uses flat table on backend, NOT canonical-earn routing** | (31a) Matches existing mobile behaviour for cut-over parity. Spec §5 +10% Committed-tier bonus deferred to spec-alignment task. |
| **Prisma `{increment}` for accumulator columns; absolute SET only for streak fields** | (31b) `xp/iron/stone/gold/morale` → `{increment}` (atomic at Postgres level). Streak fields stay SET only because `computeNewStreak` is idempotent for same-day repeats + gated by `player_challenges` UNIQUE. Level recomputed in second UPDATE in same tx. Surfaced by 3-concurrent-POST race in auto-complete watcher. |
| **Per-timezone repeatable BullMQ job (cron tz option) over per-player jobs** | (31c + 31d) Scales O(distinct_timezones), not O(players). Same pattern for rollover + warning. JobId `streak-rollover-${tz.replace(/\//g, '-')}` so `Europe/Moscow` → `streak-rollover-Europe-Moscow`. |
| **Optimistic-concurrency UPDATE-with-WHERE-guard for per-player rollover updates** | (31c) Same pattern as claim endpoint. `WHERE id=? AND last_active_date=expected`. Conflict counted as 'skipped' in batch summary. No SELECT FOR UPDATE. |
| **Sequential per-player processing inside each tz batch (not Promise.all)** | (31c + 31d) Predictable DB load, simpler error semantics. Revisit at 1000+ players per tz. |
| **`ALLOW_DEBUG_ROUTES` env-var bypass over flipping `NODE_ENV`** | (31c) Keeps prod-strictness everywhere else; debug routes opt-in. Flip OFF before any external playtest. |
| **23:55 timing kept per spec even though 5 min isn't enough to complete Easy challenge** | (31d) Honest signal that streak is about to break, not an actionable rescue. Cron string trivial to swap to 21:00 later if we want an actionable nudge. |
| **`sendImmediately` (not `sendPush`) for 23:55 dispatch** | (31d) `sendPush` defers to next 05:00 via Quiet Hours queue, defeating purpose. `sendImmediately` already existed for exactly this case — used existing API over adding a `bypassQuietHours` flag. |
| **Separate `bootstrap-warning.ts` (not merged into `bootstrap.ts`)** | (31d) Each scheduled module gets its own bootstrap as more per-tz jobs are added. Trigger to consolidate: 4+ bootstraps. |
| **Backend zod enum lowercase-only (`easy`/`medium`/`hard`)** | (31b) Mobile sends `ch.key` (lowercase) not `ch.difficulty` (TitleCase display string). Backend rejects TitleCase. Wire-format normalised at API boundary. |
| **`lib/challengeApi.js` mirrors `lib/fcm.js` pattern: Clerk-authed, forces `Connection: close`, never throws** | (31b) Returns `{ok, data} \| {ok:false, status, error}`. Mobile handles failure via revert-optimistic-UI. Same dead-pool defence as Supabase fetch wrapper. |
| **Centralise rule for backend formulas: 3+ modules sharing same math** | (31a) Ported subset to module-local `challenge.formulas.ts`. Will centralise to `src/shared/formulas.ts` when 3rd module needs it. |
| **Stale UI state on Metro reload → force-stop + reopen, not just reload** | (31b) Metro reload alone doesn't always trigger full re-mount + re-hydration. Force-stop + reopen is the reliable reset. |
| **84 backend tests across 5 files via native `tsx --test` (Node test runner)** | (31a + 31c + 31d) No Jest dependency on backend. `npx tsx --test <file>` runs one suite. Mobile keeps Jest for formulas.js (348 tests). |
| **`streak_broken` activity_log row written in same tx as player rollover update** | (31c) Metadata: `{previous_streak, grace_day_used, new_current_streak, new_grace_days_banked}`. Audit trail for every streak transition. |
| **Alliance schema: short_name as text + UNIQUE + CHECK regex, not character(3)** | (32) character(n) pads with spaces and breaks comparisons. text + CHECK `^[A-Z]{3}$` enforces the same constraint cleanly. |
| **Alliance membership: separate `alliance_members` join table with UNIQUE on player_id, not just `players.alliance_id`** | (32) DB-level "one alliance per player" enforcement. Join table cleanly supports per-member role, joined_at, recruit_streak_count, recruit_last_completion_date without polluting players. `players.alliance_id` retained as denormalised mirror for fast joins. |
| **ROLE_SLOTS uses `null` for unlimited (soldier, recruit); cap-checks gate on `!= null`** | (32) Cleaner than sentinel values like Infinity. Helpers test `cap != null` then `count < cap`. |
| **Service-layer transaction pattern: services take `tx` as first arg, called inside `prisma.$transaction` in service layer** | (32) Mirrors challenge-complete pattern. Every alliance write goes through one tx. |
| **HQ transition on found: `owner_id=NULL` + `alliance_id=set`, in same tx as alliance insert** | (32) Per spec §3.4. Founder's HQ territory becomes alliance-owned, not personally owned. Reverse on disband. |
| **Disband behaviour: alliance row persists (`disbanded_at` set), HQ reverts neutral, `alliance_members` rows deleted** | (32) Keeps disbanded alliances in history for audit. short_name NOT freed — UNIQUE holds the row. Decide before launch: free up on disband OR keep permanent (Hall of Holders attribution). |
| **`/me/alliance` lives in alliance module despite `/me` path prefix** | (32) URL convention is not module boundary. Keeps all alliance code in one place. |
| **Skipped tz-lookup for hq_timezone derivation — used `player.home_timezone` directly** | (32) Founder + HQ are same-city by city-match rule. One fewer dep call. |
| **`findPlayerAllianceId` reads `players.alliance_id` via tx, not via membership table join** | (32) Denormalised mirror is the fast path for claim/contest. Membership table is source of truth on writes. |
| **Schema correction: Home District = home city itself (text on player), HQ = territory player owns IN that city** | (33) S32 added `alliances.home_district` + `home_district_territory_id` FK in a misreading of spec §3.1. Both dropped. Home District is the city; HQ is the seat. Two concepts, two columns — no separate "home district territory". |
| **Mobile founding flow: pre-check short_name uniqueness in Supabase before submit; fail open on network error** | (33) UX > one source of truth at the wizard step. Backend remains authoritative. Network failure shouldn't block submission — let the backend reject if needed. |
| **`getTokenRef` pattern for Clerk-authed fetches inside `useEffect`** | (33, 35) Clerk's `getToken` is a new function reference on every render. Including it in `useEffect` deps causes infinite re-runs. Capture via `useRef`, exclude from deps, call `() => getTokenRef.current()` inside the fetch. Adopted as codebase convention. |
| **Browse list filters on both `.is('disbanded_at', null)` AND `.eq('city', playerHomeCity)`** | (33) Disbanded alliances must not appear (rejoin would 410). City filter matches game rule (same-city only). |
| **home_city derivation via PostGIS two-step: ST_Contains then ST_DWithin within 10km** | (34) Fast path for pins inside a territory; nearest-fallback for residential/sparse areas. 10km cap prevents cross-country wrong assignments. If both miss, home_city left unchanged. |
| **`ensurePostgisSearchPath()` runs `set_config(..., true)` per transaction** | (34) Supabase puts PostGIS in `postgis` schema, not on default search_path. Without set_config, ST_Contains/ST_DWithin fail to resolve. Local `set_config` is tx-scoped, so it doesn't leak to other connections. |
| **`resolveHomeCityFromPin` wraps own `prisma.$transaction` when no tx passed** | (34) set_config + lookup queries must share a pinned connection. Backfill script calls without tx — needed own internal tx to keep search_path consistent. |
| **`territories.city` canonical form: Title Case ('Amsterdam', 'Saint Petersburg')** | (34) Was mixed casing ('amsterdam' lowercase, 'Saint Petersburg' Title Case). Normalised DB + test fixtures. Title Case matches UI display, avoids transform on read. |
| **`/alliances/found` returns full `{ alliance, members }` matching `getAllianceById` exactly (deepEqual-verified)** | (35) Consistency > micro-optimisation. Single shape for both fetch-by-id and post-create. Test asserts deepEqual so they can't drift. |
| **Mobile AllianceJoinedScreen fetches by id on mount, doesn't receive object via nav params** | (35) Single code path. Screen always reflects backend state. ~200ms cost invisible behind founding celebration copy. Same path will serve future join flow. |
| **Loading/error/retry as canonical 3-state pattern for fetch-by-id screens** | (35) ActivityIndicator in CLAIM colour, minimal mono error message with CLAIM-bordered Retry button. Re-fetch via `retryCount` state increment. Adopted from AllianceScreen.js, applied to AllianceJoinedScreen.js. |
| **Demote is Founder-only per spec §3.3 literal reading** | (36) Spec lists "promote/demote all roles" only under Founder. Keeps permission graph simple and matches "Built this alliance. Full authority." framing. |
| **Promote/demote target roles restricted to marshal/officer/sergeant/soldier (no founder, no recruit)** | (36) Founder transfer is a separate flow (voluntary transfer endpoint, deferred). Recruit is starting state only — entered via join, exited via auto-promote after 3 streak days. |
| **Mobile manage-member UI: full-screen confirm view + flat-list action picker (no nested role-picker, no bottom sheet)** | (36) Same pattern as leave-confirm. "Type is the hierarchy" — flat list ordered by destructive-ness. Consistency with existing patterns wins. |
| **Mobile manage actions are server-confirmed, not optimistic** | (36) Matches existing leave/join flow. No rollback complexity. Backend tx is the source of truth. |
| **Did NOT pre-check slot caps client-side; backend rejects with role_slots_full 409, rendered in error band** | (36) Slot state is edge case + client mirror adds state complexity. Backend already enforces. Same pattern as join error path. |
| **Distinct event types per action (`alliance_promoted` / `alliance_demoted`) over generic `alliance_role_changed`** | (36) Symmetric, more grep-able, audit-friendly. One more constraint ALTER on prod is cheap. |
| **Territory propagation on join/leave/kick via `setAllianceIdOnPlayerTerritories`; disband path skips (already bulk-clears via `disbandAlliance`)** | (36) Spec §2.3 + §3.8 + §8.4.2. Joiner's existing territories adopt alliance_id; leaver/kicked-player's territories release it. Disband already clears all alliance territories in one bulk update — no double-clear needed. |
| **Bug-verification before fix-scheduling: read current code directly, do not trust stale session-summary observations** | (36) Two suspected bugs from S35 (founding HQ link, disband member cleanup) turned out to be already fixed in current code. S35 observations were stale data, not code bugs. Locked correctness with regression tests instead of rebuilding. |
| **Every new activity_log event_type requires SQL ALTER on BOTH dev AND prod constraints** | (32, 36) Cursor modified dev DB directly when adding new event types without notifying. Caught twice — applied same ALTER to prod before pushing. Pattern: keep dev + prod constraint diff at zero. |
| **Supabase SQL editor returns "No rows" for any non-SELECT (UPDATE/DELETE/DDL) — always verify writes with follow-up SELECT** | (35, 36) Editor's "no rows" is not a failure signal; it's the default for non-SELECT. Multiple data cleanups went un-verified before this was internalised. |
| **Confirm backend deploys reached Railway with `git log -1 --oneline` before assuming changes shipped** | (35) Cursor's "tests green" report only verifies local changes. Files were modified-but-not-committed for a long stretch. Final commit was what triggered Railway redeploy. |
| **Sign-out cleanup is best-effort with hard timeouts; ordering preserved (cleanup before auth teardown for JWT)** | (37) `clearFcmToken` then `signOut`, both raced against timeouts (3s / 5s). Neither cleanup nor the auth call itself should ever block the UI for more than ~6s. General pattern: any best-effort cleanup in a teardown chain must have a timeout race. |
| **Player's OWN territories ALWAYS render claim red, even when in an alliance; alliance green reserved for OTHER members' territories** | (37) Spec §7.8 wording ("all alliance-affiliated territories display in the same faction colour") is too literal. The current design (own=red, alliance=green, other=blue-grey) lets a player instantly see which territories are theirs vs their alliance's — more useful than uniform green. Spec rewording deferred. |
| **AllianceJoinedScreen is multi-use: post-create AND post-join, switched on `context` route param** | (37) Create flow passes no context (falls through to 'founded' copy). Join flow passes `context: 'joined'`. Single screen, two copy paths, zero duplication. |
| **MapScreen owns its own alliance_id refetch logic (focus-driven + ref-tracked transition)** | (37) Did not introduce a cross-screen event bus or shared state — kept coupling low. `useFocusEffect` calls `fetchPlayer`; separate useEffect with `previousAllianceIdRef` watches `myPlayer?.alliance_id`; on transition, clears `featureCacheRef` + refetches viewport. Brief stale-cache window between join confirmation and Map tab open is well within spec's 60s requirement. |
| **Diagnosis-first pattern: read-only Cursor pass on current code before any write, both fixes** | (37, 38) Reinforced across both S37 fixes and S38's claim race fix. In every case the diagnosis changed the hypothesis at least once — including the sign-out hang (was in our own fetch, not Clerk's SDK) and the claim race (rehydrate stomping startClaim, not DEV_MODE flag). Codifies Pitfall #31 as a working pattern: never act on a stale hypothesis. |
| **Selective-merge semantics for claim state rehydrate; snapshot is for "app killed in pocket" recovery, NOT normal mount** | (38) `rehydrateFromStorage` captures `wasActive` BEFORE any merge. If wasActive=true: selective merge only (`CONTINUATION_FIELDS`: `strideM`, `strideSessions` where current null). If !wasActive: full `Object.assign` for cold-mount recovery. Generalises to any "live state vs persisted snapshot" merge — Pitfall #33. |
| **Spec §3.3 amended: outgoing Founder takes incoming Founder's previous role (not always Marshal)** | (38) Eliminates slot-cap check entirely — role counts conserved by construction. No 409 path needed in transfer endpoint, smaller test matrix, smaller mobile error surface. Considered "founder can transfer to anyone" — rejected as a griefing vector (could hand alliance to inactive Recruit on the way out). Marshal/Officer restriction preserved. |
| **TRANSFER text-gate adopted on the Transfer Alliance confirm view (case-sensitive exact match)** | (38) Founder transfer is one of the heaviest single actions in the system; friction is correct here. Matches GitHub repo-delete and similar destructive-action UX patterns. |
| **"Transfer Alliance" copy over "Transfer Founder"** | (38) Founder isn't transferring a title, they're handing over the whole alliance. Sharper framing. |
| **Notifications consolidation deferred to a dedicated future session, after Progression + Activity** | (38) Several notification triggers piling up (kick/demote/promote/join/leave, milestone push, first-earn, level-up UI, grace day UI, break confirmation, foreground push handler). Building them per-module means revisiting the same code 8 times. Consolidate once Progression + Activity land — by then the foreground handler + in-app notification surface can be designed once across everything. |
| **Roadmap order: Progression → Activity → Notifications consolidation → Leaderboard → Realm** | (38) Progression is the foundation everything reads from (XP, levels, Siege XP, solo protection tiers). Activity owns step credit + anti-cheat. Notifications consolidation needs both. Leaderboard reads from Progression + Activity. Realm last. |
| **Action ordering in alliance member-management: promote → demote → transfer_founder → kick (ascending in irreversibility)** | (38) Kick is last because it removes the member; transfer_founder is above kick because it's irreversible from the founder's perspective without the new founder cooperating. Consistent with destructive-last pattern across the codebase. |
| **Transfer endpoint returns `{ alliance, members }` matching `getAllianceById` exactly (deepEqual-verified)** | (38) Same consistency pattern as found/promote/demote. Test asserts deepEqual so the shapes can't drift across endpoints. |
| **`grantSiegeXp(tx, playerId, delta)` is THE single XP-write primitive — atomic `{increment}` + conditional 2nd UPDATE** | (S40) One canonical writer for every XP grant. Atomic Prisma `{increment}` on players.xp inside the passed tx + a conditional 2nd UPDATE for level recompute, gated by `calcLevel(newXp) !== currentLevel`. Returns `{newXp, previousLevel, newLevel, leveledUp}` so callers can write metadata without re-reading. Loud-failure null guard throws on data-integrity violation rather than silently fallback to 0/1. Used by all 4 XP-granting callsites + S43's milestone path. |
| **Helper naming matches root `formulas.js`: `calcClaimXp`, `calcContestWinXp`, `calcDefenceWinXp`** | (S40) Drift in naming between backend and the canonical formulas file makes future ports harder. Root `formulas.js` is the spec for backend formulas — naming alignment is non-negotiable. |
| **Tier keys lowercase in backend, TitleCase in root — documented inline at top of progression.formulas.ts** | (S40) Backend matches wire format (DB representation). Root matches its own legacy. Drift is real but explicit and commented. |
| **Backwards-compat shim via re-export, not duplication: `me/challenge.formulas.ts` re-exports `LEVEL_XP_FLOORS` + `calcLevel` from progression module** | (S40) Zero call-site change in challenge-complete service/queries. Re-export driven by import graph, not spec grouping — only re-export what's actually imported externally. |
| **Lift-and-share over re-implement for cross-module math: `shared/formulas/canonical-earn.ts` + `shared/formulas/streak.ts`** | (S42) Two `calcStreakMultiplier` definitions in two files was a drift trap waiting to happen. The S42 lift to `shared/formulas/` ended that risk for streak and canonical-earn math forever. Same pattern when a 3rd module ever needs `calcChallengeXp` math. |
| **Optional `XpMultiplierOpts` parameter on calcClaimXp/calcContestWinXp/calcDefenceWinXp for backwards compatibility** | (S42) Adding the param as optional meant zero break for tests/callers that didn't yet supply multipliers. S41 metadata shape unchanged for streak=0 players (the streak_* keys ABSENT — not falsy — from JSON). When `opts` omitted, formulas return flat base XP. |
| **`streak_tier` in metadata reflects RAW streak; `streak_multiplier` reflects APPLIED (post-cap) value** | (S42) A Legendary streak (60 days, raw ×1.5) on Epic territory caps the multiplier to ×1.15. Player UI shows "Legendary" badge (tier is achievement state) but XP grant uses ×1.15 (multiplier is applied effect). Separating these in activity_log metadata makes mobile UI lookup-free. Locked by integration test + device test. |
| **Streak read happens INSIDE the tx (`findPlayerStreakDays(tx, playerId)`), not pre-tx** | (S42) Avoids stale read if streak-rollover fires mid-action. Tx-pinned read = consistent snapshot. Same reasoning as S41's player select inside tx. |
| **Stubs `isSupplyLineActive: false` and `isCityEvent: false` literally hardcoded at all 4 callsites** | (S42) Pattern matches challenge-complete service. When the underlying modules ship, single-line change at each callsite. No premature abstraction. |
| **Milestone grant lives in `challenge-complete.service.ts`, NOT `streak-rollover.worker.ts`** | (S43) Original plan was wrong: rollover doesn't advance `current_streak`, it only handles missed-day paths. Streak advance happens in challenge-complete. The "day a player hits N" is the day they complete a challenge that crosses N, not the next midnight. Co-locates milestone XP with existing `applyGraceDayGrant` (which shares identical trigger semantics — Grace Day grants at 7/30/60 also fire on the crossing completion). Caught at Step 1 audit before any code. |
| **Milestone XP is FLAT 250, NOT multiplied** | (S43) Spec §5.7 lists "Streak milestone (Days 7, 14, 21, 30, 60, 90)" as its own line in the Siege XP earn table. The streak XP modifier (×1.10 at Reliable+) already amplifies daily challenge XP throughout the streak — stacking on milestone would double-dip the same buff in one tx. Milestone is a "reach a state" reward, not an activity-based earn event. One-line revert path: route through `calcCanonicalEarn` if spec re-read contradicts. |
| **Milestone grant via separate `grantSiegeXp` call, NOT folded into challenge XP `{increment}`** | (S43) One XP grant = one activity_log row with clean `level_before`/`level_after` attribution. Folding +250 into the challenge XP increment would make level-up attribution ambiguous (which delta caused it?). Separate calls give clean audit trail. Locked by integration test on level-up attribution. |
| **Tx ordering: challenge XP increment → milestone grantSiegeXp → log challenge_completed → log streak_milestone** | (S43) Milestone row's `level_before` reflects post-challenge-XP state. If player at xp=1800 completes hard challenge (+400, still L2) and it's day 7 (+250, crosses L3 floor), milestone row correctly shows `level_before:2, level_after:3, leveled_up:true` — attributing the boundary crossing to the milestone, not the challenge. |
| **Idempotency: FREE via existing `player_challenges` UNIQUE; no new lookup or de-dup needed** | (S43) Same-day re-POST hits `!inserted` early-return at the top of `completeChallenge`, never reaches the milestone grant. Originally considered an `activity_log` lookup before milestone grant — audit revealed the UPSTREAM constraint already prevents the issue. Free was better than designed. |
| **Two activity_log rows on milestone-day completion (one `challenge_completed` + one `streak_milestone`)** | (S43) Each event_type is independently queryable by mobile activity feed, leaderboards, future achievement systems. Separate rows = clean attribution per event_type. Slight cost (2 inserts on milestone days) is worth it. |
| **CHECK constraint migration via hand-written SQL in `prisma/migrations-manual/`, NOT `prisma migrate`** | (S43) Project uses `prisma db pull` introspection, not `prisma migrate`. `prisma migrate dev` against introspected schema would attempt a destructive baseline ritual for one constraint change. Hand-written SQL committed to `prisma/migrations-manual/<YYYYMMDD>-<description>.sql` + applied via Supabase SQL Editor matches convention, is replayable, is auditable. First migration sets the precedent for all future schema changes. |
| **`is_milestone: true` in activity_log metadata is defensive denormalisation** | (S43) Even though `event_type='streak_milestone'` already implies it, `is_milestone` in metadata is cheap and downstream-friendly for filters that scan metadata without joining on event_type. |
| **"Shipped" requires commit pushed AND Railway healthcheck 200 — code-complete + green-tests + closed-IDE is NOT shipped** | (S43) S42 was marked shipped May 28 with code uncommitted. Surfaced May 29 in S43 Step 5 file-changed audit. Burned in as Step 6 of every slice from S44 onward: explicit upstream-verification before declaring done. Paste `git log -1 --oneline` + curl /healthcheck result into the session record. |
| **Helper module placement: NEW `progression.helpers.ts` for pure rule-checks (distinct from `.formulas.ts` for pure math)** | (S44) `canContestTerritory` is a pure helper — no DB, no Prisma types. Lives in `progression/` (domain locality: protection is a level-driven rule, even though territory imports it), not in `progression.formulas.ts` (math) or territory (caller). New `.helpers.ts` file sets a per-module convention. Mirrors `alliance/membership.helpers.ts` exactly, including the discriminated-union return shape. |
| **Discriminated union `{ok:true} \| {ok:false, reason}` for pure rule helpers, NOT thrown errors** | (S44) Helper is pure — no knowledge of HTTP semantics. Service maps `reason` to `serviceError(403, ...)`. Tests assert on `result.reason` directly without try/catch noise. Mirrors alliance helper pattern. Reserve throws for invariant violations only. |
| **Player-facing copy lives at the callsite (`CONTEST_REJECT_MESSAGES` in contest.service.ts), NOT in the pure helper** | (S44) Reasons are DOMAIN (progression — what rule was violated); messages are UX/WIRE (territory/contest — how we tell the player). Separation lets future endpoints reuse `canContestTerritory` with their own copy. Single grep-able location for copywriter pass. |
| **Wire payload shape unchanged: `{ error: "<player-facing string>" }`** | (S44) Mobile expects this shape today. Adding a machine-readable `reason` code on the wire would be an unrelated breaking change. Reason stays internal; mobile maps message → display copy. Future Notifications Consolidation can plumb reason through if needed. |
| **Check-chain ordering in contest initiate: identity → entitlement-to-attack-this-target → state → economy** | (S44) Protection check inserted between self-contest guard and tier level gate (position 4 of 9). Protection is a free in-memory check; iron is a DB read. Fail-fast on cheapest rejections. Tier level gate (per-tier minimums) remains separate from protection check (cross-product of attacker × target levels) — different concepts. |
| **§8.1 contradiction resolved in favour of Option A (stricter "Solo-vs-Solo Only")** | (S44) §8.1 heading + L4 unlock copy imply symmetric mirror rule. Conflicting bullet allowing L4-5 solos to attack alliance territory reads as editorial drift. Roadmap wins. L4-5 solo attacker hitting alliance territory → 403 `target_alliance_protected_from_solo`. Conflicting bullet queued for spec correction. |
| **No grace-period for newly-leveled players** | (S44) Spec §8.1 has no transition rule. Protection state is a pure function of current level at the moment of contest initiate. Snapshot read inside the request, no decay window. |
| **Defensive `serviceError(500, "Territory owner level unavailable")` when owner_id non-null but Prisma include returns no player record** | (S44) Loud failure for data integrity violation rather than silent fallback to level=0. Same discipline as `grantSiegeXp`'s null guard from S40. Loud failures are diagnostically cheap; silent fallbacks are diagnostic poison. |
| **Module is "done" when its independent surface is complete, NOT when every spec'd earn source is wired** | (S44) Six feature-dependent earn sources remain unwired at end of S44 — but they're no longer "Progression module work." They're one-line hooks at existing callsites that ship when their respective modules ship (Reconquest, Dev tier, Alliance Missions, Weekly Challenges, Alliance Abilities, City Events). The Progression module has shipped everything it owns. |

---

## WORKING STYLE — ALWAYS FOLLOW THIS

Do not start coding immediately. Work conversationally:
- Explain what each screen or feature does before building it
- Show a wireframe or mockup when introducing a new screen
- Ask for confirmation before writing any code
- Wait for the user to say "yes" or "let's build it" before touching any files
- Once confirmed, provide the exact prompt to paste into Cursor's agent chat as a single copyable code block — one-click copyable, no inline prompts mixed with prose
- **ALWAYS state which repo every Cursor prompt and Warp command targets.** Cursor prompts include a `[MOBILE: ...]` or `[BACKEND: ...]` header. Every Warp command sequence starts with the matching `cd`.
- **For Cursor: confirm `File → Open Folder` is on the right repo before pasting.** Cursor caches working directory and can write files to the wrong path silently if the workspace has moved.
- **When Cursor proposes shell commands (`npm install`, `npm run typecheck`, etc): SKIP and run them in Warp instead.** Warp is the single source of truth for what was executed.
- After Cursor builds it, wait for the user to check their phone and report back
- Give the user time to ask questions at every step
- Handle one screen or one fix at a time — never batch unrelated changes
- **For SQL: separate queries one at a time so user can verify each before proceeding.** Especially true for heavy PostGIS work — splitting also dodges the 60s SQL editor timeout.
- **When debugging: get evidence before theorising.** PowerShell-from-PC test, fetch wrapper logs, EXPLAIN ANALYZE, render-side check, and **raw-data dump (`JSON.stringify(rows[0])` before chasing style hypotheses)** are the fastest diagnostics. Cheapest binary test wins.
- **For backend 401s: regrab a fresh Clerk token before adding diagnostic logging.** Clerk tokens are ~60s TTL — expiry is the most likely cause.
- **Filter / validate at the source, not at the client.** One bad row can silently break the whole UI. Server-side guards are always cheaper than client-side defensive code.
- **Never `git add .`** — always specify files. Especially critical with two repos.
- **Always verify with `git diff --stat` before staging on Windows.** Cursor opening files can cause CRLF/LF noise in `git status` — files appear modified but content is byte-identical. Stage only files with real changes.
- **`npm run build` (full tsc emit), not `npm run typecheck`, is the pre-push gate for backend.** `tsc --noEmit` doesn't catch ESM `.js` extension issues or wrong runtime subpath imports — both crash on Railway.
- **When the same problem resists multiple targeted fixes, the fix isn't another tweak — it's the architecture.**
- **Clerk JWTs expire in ~60s — assign once and batch ALL test invocations in a single Warp paste.** A `$token = "..."` line followed by N `try { Invoke-WebRequest ... } catch { ... }` calls executes in under 5s.
- **For BullMQ jobIds: NEVER colons, ALWAYS hyphens.** BullMQ rejects `:`. Pattern: `<queue>-<context>-<id>`.
- **For mobile imperative work that must happen before navigation: call it INLINE inside the imperative function, NOT in a useEffect.** The useEffect-on-state-change pattern is fragile — the gate often unmounts before the effect fires.
- **For mobile auth cleanup: do it BEFORE auth teardown, not after.** `clearFcmToken` then `signOut`, not the other way around. The cleanup PATCH needs the JWT.
- **For any accumulator column updated by potentially-concurrent endpoints, use Prisma `{increment}`, never read-modify-write.** Use PowerShell `Start-Job` parallel POSTs to surface lost-update races BEFORE users do.
- **STUB-then-real for any new module touching FCM/external IO.** Build helpers + tests → queries + service with STUB sender → queue + bootstrap + debug route → verify SQL filter + batch loop + copy on Railway → swap STUB for real FCM. Each stage independently verifiable.
- **For Postgres DATE columns: convert to YYYY-MM-DD string at the ORM seam, not at the comparison.** Prisma returns `Date`; string compare against `'YYYY-MM-DD'` silently fails. One conversion point per code path.
- **Before inventing a new API flag, grep the existing surface.** `sendImmediately` already existed for the Quiet Hours bypass case; no new flag needed.
- **`tier` enums on the wire: lowercase, normalised at API boundary.** Display strings (`'Easy'`/`'Medium'`/`'Hard'`) belong to UI; wire format is `'easy'`/`'medium'`/`'hard'`. Mobile sends `ch.key`, not `ch.difficulty`.
- **Always confirm Cursor's open repo BEFORE pasting a prompt that creates files.** `dir <expected-path>` after Cursor reports success — `Move-Item` is the fix when it lands in the wrong repo.
- **Crisp responses, recommend one option not pros/cons. No decisions without explicit user confirmation.**
