# DOMINIA — MASTER PROJECT STATE
Last updated: July 8, 2026 (see **SINCE JUL 7** block directly below for the newest work; the **SINCE JUL 5** block after it is the prior burst, and the paragraph after that is the Jul 5 catch-up). Prior header text: catch-up covering all work since S82 close on June 21 — sessions since then ran in Claude Code without S-numbers; entries below are **date-tagged** instead. **Fourteen feature workstreams shipped Jun 23–Jul 5**, all on `main` in both repos (backend auto-deploys to Railway on push — there is NO manual backend deploy step): **RLS lockdown Phases 1+2** (Jun 23–24 — RLS enabled on all public tables, all mobile writes moved server-side, temp anon-write policies dropped; `players`/`territories` now anon-READ-only), **pg-pool hardening + session pooler + activity-batch refactor** (Jun 23–24, `c17f013`/`e7afe26`/`de86364` — fixed the P2028 claim contention root cause), **profile pictures** (Jun 24, Clerk-hosted avatars → `players.avatar_url`; verified on device), **Daily Achievements live data** (Jun 24, `2ed8177`+`3dc3048`), **onboarding tightening** (Jun 24 — dead-ends fixed, Google SSO code, value-first Welcome→SignIn reorder, live username check, funnel instrumentation, UPPERCASE usernames), **Honor Medals / Legacy Medal system** (Jun 28–30 — 16 medals, backend G1–G8+G7 push 100% complete `63261b6`→`0be2949`, mobile UI + final designer badge art + earn celebration + Legacy Power from medals), **i18n Parts A+B+C** (Jun 29–30 — app i18next foundation, per-recipient backend push translation via `players.locale`, full Russian first pass 709 keys + brand transcreation; needs native review), **public player profiles** (Jun 30–Jul 1, mobile-only), **Command Post v1** (Jul 1, `41cdfe6` — Founder-only retention surface, panels 1/2/5), **Living Map Phases 1–3** (Jul 2 — streak borders, ramparts, alliance emblems, home bases w/ 250m snap, D4 walls, siege borders, battle chips; alliance gate lowered to L3 `507edde`), **username uniqueness** (Jul 3, `cb4b89d` — case-insensitive `lower(username)` unique index), **daily challenge redesign** (Jul 3, `ad70b52`+`ffbd4cd` — 4-axis pick-one menu Mon–Fri, Sat/Sun-only Attack Days, weekend-neutral streaks; on-device verified; `ATTACK_DAY_GATE` ships default-OFF), **first-run flow** (Jul 4, `5162fcf`+`a744b2a` — per-screen walkthroughs + persistent first-claim objective + earn-moment resource toasts), **account deletion + password flows** (Jul 5, `eaa3da1`+`36d39d0`+`ef21158` — DELETE /me/account full purge + Clerk delete, forgot/change password via Clerk custom flows). Backend test baseline: **931+ green** (at Jul 3; up from 750 at S82). Mobile: **572 jest** (Jul 3; up from 533). **Big pending bundle: one Android app rebuild** picks up everything since Jun 24 (expo-image-picker native module, `scheme: 'dominia'`, new HC permissions, ru locale, Living Map, walkthroughs, delete-account, password flows) — see WHAT'S NEXT. The three S82-era smokes (chat M2 EAS, defender lifecycle, Activity Slice 7) remain open. Backend slices G1–G4 shipped in `dominia-backend` across `c453da5` (G1 schema + reads + alliance lifecycle hooks), `b8251c6` (G2 write + Ably + rate limit + keyword filter), `db93ace` (G3 moderation + admin endpoints + strike escalation), `95d194b` (G4 alliance push + archive worker + admin queue); the M2-prerequisite `PATCH /me/alliance-chat-push-enabled` endpoint was added inline at `05cd372`. Mobile slices M1–M2 shipped in `dominia` across `a18716b` (M1 read-only scaffold + ChatSideRail + chatApi) and `4e47f22` (M2 composer + Ably realtime + push deep link + AllianceChatPushToggleRow). Backend test baseline: **750/750** zero-flake at `05cd372` (up from 638 at S81 close; +112). Mobile baseline: **533/533** zero-flake at `4e47f22` (up from 505 at S81 close; +28). Railway green; `prisma/migrations-manual/20260621-add-chat-module/up.sql` applied to prod; `CHAT_ADMIN_CLERK_IDS` env var set on Railway with nish_s clerk id; `chat-archive-daily-utc` BullMQ cron registered (`0 3 * * *` UTC). Mobile `ably 2.23.0` added (pure JS — no EAS rebuild required for M2 itself). **Leaderboard module** had shipped at S80 (`16930ac`) between Defender close and Chat open. **Three smokes still pending at chat close**: M2 EAS standalone smoke on Alyona OnePlus 7T (chat send/receive + push deep link), Defender Lifecycle device smoke (carried from S74), Activity Slice 7 device smoke (carried from S66). Carry-forward `B-S81-OPS-realm-removal-state-cleanup` due now at chat close — strip Realm from this doc's "future modules" list.

**SINCE JUL 7 (Jul 7 — War Room abilities made functional, all on `main`, backend auto-deployed; mobile pending one rebuild):**
- **War Room morale abilities** ✅ **SHIPPED** (backend `da7c51d`, mobile `9d6c036`+`ac64d2e`). Previously the panel only burned morale with **no effect** and trusted a client-supplied spend amount. Now a full server-authoritative system: new table `alliance_ability_activations` (**migration `20260707-alliance-abilities` applied live**, RLS deny-all); `ability.catalog.ts` is the single source of truth for costs/durations/windows/cooldowns/effect factors; `GET /alliances/:id/abilities` + `POST /alliances/:id/abilities/:ability/activate` (Founder+Marshal via `can_manage`, morale UPDATE-first row-lock makes concurrent activation race-safe). Old `POST /alliances/:id/morale/spend` route/service + mobile `spendAllianceMorale` **removed**.
- **Windows/cooldowns (user-specified):** **Unified Front REMOVED** → 5 abilities. War Surge / Iron Bulwark / Rally Cry / Steadfast are **Sat/Sun-only with an 8h per-ability cooldown** (Activate button becomes a live countdown). Supply Line is **Mon–Fri-only, once per Monday-anchored calendar week** (leader home tz). Window checks gate on `ATTACK_DAY_GATE` (off in dev → testable any day; on at launch, same switch as the contest gate); cooldown + week-limit always enforced.
- **Effects now real (not just morale burns):** War Surge −40% attacker contest Iron · Iron Bulwark +40% Iron to contest the buffed alliance's land (stacks) · Rally Cry attacker walks 80% of contest distance · Steadfast defender response ratio ×0.8 (incl. defend preview) · Supply Line +20% **XP and resources** across challenge/claim/contest/defence earns. Wired via `ability.effects.ts` buff lookups into contest/defend/walk/expiry/claim/challenge paths.
- **Real Attack Day countdown** (mobile `ac64d2e`): replaced the hardcoded "2D 14H · SATURDAY" placeholder — counts to the next Sat/Sun 05:00 opening (TODAY/SATURDAY/SUNDAY), flips to a LIVE claim-accent state counting to the 23:00 close during the weekend window; mirrors the 05:00–23:00 backend contest hours; units localised (en D/H/M, ru Д/Ч/М). Same 10s tick drives the ability cooldown/active timers.
- **Backend test baseline: 1007 pass** (up from 990; +17 in `ability.catalog.test.ts`), tsc clean, both locales valid JSON. **Pending:** one Android rebuild to pick up the War Room UI + on-device check.

**SINCE JUL 5 (Jul 5–7 — two new modules + a launch-hardening audit burst, all on `main`, backend auto-deployed):**
- **Alliance Weekly Tasks module** ✅ **SHIPPED** (backend `82305ee`+`629ee72`, mobile `bba50c8`+`ce4e011`; spec `docs/specs/alliance-weekly-tasks.md`). 5-task leader-picked weekly challenge (Long March / Muster / Forge / Drill / Expansion Order); Founder+Marshal pick Sat–Sun in `hq_timezone` (least-recently-run auto-assign fallback); **Monday 00:10 rollover per hq-tz cohort** in one guarded tx (evaluate last week → tier → per-contributor payouts → war chest → activate + snapshot this week). **Snapshot invariant:** the Monday roster defines BOTH target and reward eligibility (closes leave-Sun/rejoin-Mon exploit). 50% personal floor, half/full tiers, per-task-type payouts, war-chest Morale capped 150/wk. Aggregates accepted `activity_samples` only. Routes `GET/POST /alliances/:id/weekly-task[/menu|/pick]`; Ably + quiet-hours pushes (en+ru). New tables `alliance_weekly_tasks` + members snapshot, `alliances.iron/stone/gold` war-chest cols, `weekly_task_reward` event; **migration `20260705-alliance-weekly-tasks` applied live**. Mobile: weekly-task card + Command Post orders w/ explicit CHOOSE button. *(This resolves the old "Weekly alliance missions §3.10" backlog + the flat alliance-mission payout placeholder.)*
- **Territory Development module** ✅ **SHIPPED** (backend `a478a0f`, mobile `990a0c6`; mechanics §5.8.1 amended). D0→D4 develop as **one ATOMIC per-level spend** (no partial contributions) and **NO upkeep** (both are deliberate deviations from spec). `POST /territories/:id/develop` holder-only, single balance-guarded + level-guarded tx (double-tap safe); **D3 gated at player L8, D4 at L9**; +500 XP flat/tier; D3/D4 emit alliance-feed rows; **D4 writes a permanent `development_records` row** + Ably `development_updated`. **Influence wallet:** `players.influence`/`lifetime_influence` (x10 fixed-point) + one-shot §5.8.4 milestone acks; **daily influence tick 00:05 per tz** (owner home pin / alliance HQ) via BullMQ repeatable jobs, `influence_credited_ymd` CAS idempotent. **Migration `20260706-territory-development` applied live.** Mobile: develop panel + influence wallet + feed rows + Citadel records.
- **First-run demo — 3rd iteration** (mobile `d3383e3`→`d7bcdce`→`512472f`, Jul 6): replaced the Jul-4 pointer walkthrough with first-tap tips, then a **gated 13-beat guided demo across four tabs** (claim-red frames on tap targets, coloured colour-words, lazy claim beats). Supersedes the "first-run flow (Jul 4)" entry elsewhere in this doc.
- **Security lockdown audit** ✅ **SHIPPED** (backend `3653157`, mobile `3e0a32e`, Jul 7). Migration `20260707-security-lockdown-rpcs` (**applied live**): REVOKE anon/PUBLIC EXECUTE on **10 script-only SPB pipeline/loader RPCs** + pin `search_path` on flagged fns; drop `debug_events_anon_insert_temp` policy + revoke table grants. Debug routes now require `requireAuth`+`requireAdmin` (**new `src/shared/admin.ts`, `ADMIN_CLERK_IDS` env**) instead of an env flag alone. `app.ts`: **`@fastify/helmet` + `@fastify/rate-limit` (120/min, healthcheck exempt) + `trustProxy` + global `setErrorHandler`** (generic 500, no message leak). New authed **`POST /me/debug-log`** (derives player_id from token) replaces the mobile anon `debug_events` insert path. **`npm audit fix` cleared all 5 high-sev advisories.**
- **Perf/ops audit burst** ✅ **SHIPPED** (Jul 6–7): `66d5b9a` **trim query projections** (~20 authed handlers pulling every `players` column; `/me`+bootstrap stopped echoing `fcm_token`/`stride_calibration_samples`/server cursors; new slim id-only helper + `PLAYER_ME_SELECT`) · `f0070a8` **collapse 11 N+1 cohort jobs to set-based** (push batch helpers, chat-archive, weekly-task rollover, week-in-review, daily-influence tick, streak rollover — all idempotency/CAS preserved; `evaluatePlayerDailyMedals` intentionally left per-player) · `229149f` **graceful shutdown** (new `src/shared/shutdown.ts`, fastify→workers→queues→redis→prisma→firebase, 25s cap; gate dev `testQueue`/`testWorker` behind the `/debug` env check so prod drops the idle Redis pull-loop; fix 3 scripts that `process.exit`'d without disconnecting) · `ca0ab97` **batch contest-walk sample lookups+inserts** (per-sample findUnique+create loop → one findMany pre-read + one createMany; removes the last known intra-tx N+1 pool-hold risk).
- **Backend test baseline: 990 pass** (at `a478a0f`, Jul 6; up from 931+). **Pending externals for this burst:** set `ADMIN_CLERK_IDS` on Railway (nish_s) + confirm debug routes now admin-gated; one Android rebuild still picks up the mobile weekly-task/develop/demo/debug-log UI.

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
| Devices | **OnePlus 12** (primary dev client, Metro-tethered, player `nish_s`) + **OnePlus 7t** (standalone EAS preview build, player "Alyona" — autonomous G2 data collection + release-mode smoke; only device that can verify killed-state Effect 5 paths) |
| Screen mirror | scrcpy — run `scrcpy` to mirror phone to PC for sharing errors |
| Android local build | **(Jul 5)** npm `android`/`ios` scripts now use `expo run:*` (`4e0b118`) — local builds instead of EAS for dev. JDK 17 required; local emulator AVD `Pixel_7`; AV intercepts HTTPS on Windows → SSL Windows-ROOT workaround needed (see android-dev-setup notes). |
| Docker | **Docker Desktop (installed S66)** — required for backend tests. `npm test` auto-starts an isolated local Postgres container (`postgis/postgis:16-3.4`, container `dominia-test-db`, `127.0.0.1:5433`, named volume `dominia-test-pgdata`). Backend tests will not run without it. |
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
| Push notifications | `@react-native-firebase/app` + `@react-native-firebase/messaging` **^23.0.0 (modular API — migrated S53)** + `react-native-toast-message` ^2.3.3. Foreground/background/killed-state all handled via `FcmLifecycle` Effects 3/4/5; D1 routing table in `lib/notifications/route.js` (**20 entries** — added `chat_alliance_message` at S82 M2) | ✓ Working end to end (12/12 device matrix S61b) |
| Realtime client | **`ably ^2.23.0` (added S82 M2)** — pure JS, no native module. `lib/chatRealtime.js` wraps `Ably.Realtime` with token-auth callback for refresh; subscribe per accessible chat room (`chat:${room_id}` namespace); dedupe via `client_temp_id`. No EAS rebuild required for the lib itself. | ✓ Live |
| Network status | `@react-native-community/netinfo` (Expo SDK 54-compat, native — added S51 for Activity producer) | ✓ Installed |
| Activity producer | `expo-crypto` (SHA-256 sourceId) + `react-native-health-connect@^3.5.0` (Android-only) | ✓ Live on beta. **(Jul 3)** Now also reads ActiveCaloriesBurned + Distance (NOT TotalCalories — basal kcal would auto-complete tiers; NO Speed — backend derives tempo); producer merges 3 metrics into 1-min buckets. |
| i18n | `i18next` + `react-i18next` + `expo-localization ~17.0.9` — config `i18n/index.js`, en fallback + device-locale detect + ru v4 plurals. `locales/en.json` source of truth; `ru.json` full first pass (709 keys, needs native review). Territory names (OSM proper nouns) never translated. | ✓ Live (Jun 29) |
| Avatars | `expo-image-picker` (NEW native module — **in the pending rebuild**) + Clerk-hosted avatar CDN (`user.setProfileImage` → `players.avatar_url` via PATCH /me) | ✓ Live (Jun 24) |
| Test runner | Jest 29.7 + jest-expo (mobile, **533 tests** as of S82 M2 — 348 formulas + 63 activity.helpers + 40 contest/claim API+producer+helpers + 17 push-route table tests + ~37 leaderboard/chat additions across S80/S82; 533/533 × 4 baseline clean at HEAD `4e47f22`) · backend: `node --test --import tsx` via `npm test`, which **auto-bootstraps an isolated local Docker Postgres** (S66) and runs the **full 750-test suite** sequentially (`--test-concurrency=1`, ~85–100s/run as of S82, 4-run zero-flake gate at HEAD `05cd372`). The historic "79 pre-existing Supabase statement-timeout failures" workaround is obsolete — the full suite now runs clean against the isolated DB. `npx tsc --noEmit` is a mandatory pre-test gate (S65a). | ✓ Green (full suite, isolated DB) |

**Backend (`dominia-backend` repo):**

| Layer | Technology | Status |
|---|---|---|
| Runtime | Node.js 22 (pinned via `engines` + `.nvmrc`) | ✓ Running on Railway |
| Server | Fastify 5 + TypeScript (ES2022 / ESM / strict) | ✓ Live |
| Hosting | Railway (europe-west4 edge), auto-deploy on push to `main` | ✓ Deployed |
| Auth | `@clerk/backend` `verifyToken` (stateless, JWKS-verified) | ✓ Live (`requireAuth` Fastify preHandler) |
| Database (server) | `@supabase/supabase-js` — **service role key** (bypasses RLS) | ✓ Live |
| ORM | Prisma 7.8 (`@prisma/client` + adapter-pg, 16 models, schema introspected from live Supabase (claim_intents added S64)) | ✓ Live (singleton + adapter-pg) |
| Timezone derivation | `tz-lookup` 6.1 (pure JS, ~1MB, offline IANA lookup) | ✓ Live |
| Redis client | `ioredis` 5.x — singleton in `shared/redis.ts`, BullMQ-compatible config | ✓ Live |
| Redis (server) | Railway Redis plugin — REDIS_URL via reference variable `${{Redis.REDIS_URL}}` (private network); local dev uses `REDIS_PUBLIC_URL` | ✓ Live |
| Job queue | BullMQ 5.x — **8 queues LIVE** (**+3 Jul 5–6:** weekly-task rollover repeatable cron `10 0 * * 1` per hq-tz cohort [Monday 00:10]; weekly-task pick-reminder; territory-development daily-influence tick repeatable `5 0 * * *` per tz [00:05, `influence_credited_ymd` CAS idempotent]): `contestExpiryQueue` (one-shot, 23:59 home_pin expiry), `quietHoursPushQueue` (delayed FCM dispatch at next 05:00 local), `streakRolloverQueue` (repeatable cron `0 0 * * *` per distinct home_timezone), `streakBreakWarningQueue` (repeatable cron `55 23 * * *` per distinct home_timezone), **`chatArchiveQueue`** (S82 G4 — repeatable cron `0 3 * * *` global UTC, jobId `chat-archive-daily-utc`, moves city `chat_messages` older than 30 days to `chat_messages_archive` + recomputes `chat_rooms.last_message_at` for affected rooms). jobIds use hyphens not colons; for tz-based jobs: `streak-rollover-${tz.replace(/\//g, '-')}` so `Europe/Moscow` → `streak-rollover-Europe-Moscow`. | ✓ Live |
| Real-time | Ably (free tier — Pub/Sub, 6M msg/month, 200 peak channels, 200 peak connections). `Ably.Rest` singleton in `shared/ably.ts`. 4 events live on `contest:<id>` channel: `contest_attacker_started_walking`, `contest_progress`, `contest_resolved`, `contest_expired`. **S82 G2+M2:** new `chat:${room_id}` namespace; backend publishes `chat:message` events post-tx-commit per R-S81-4 (mutable `activePublisher` slot in `modules/chat/chat-ably.ts` for test injection — replaces env-var-bypass pattern). Mobile Realtime client wired at M2 (`lib/chatRealtime.js`) — fetches a JWT-style token with 1h TTL + per-room channel allowlist from `POST /chat/ably-token`, refreshes via authCallback. | ✓ Live |
| Validation | `zod` | ✓ Live |
| Push notifications | **Firebase Admin (FCM)** — `firebase-admin` v12+ singleton in `shared/firebase.ts`. `PushNotificationKind` union now **22 kinds** (S53→S82): contest lifecycle (defender_notify, contest_won, contest_lost), streak_break_warning, streak_milestone, 7 alliance lifecycle kinds (S57, `_broadcast` suffix convention), level_up_5/6/10 (S59), first_claim / first_contest_win / first_reconquest / first_alliance_mission (S60), **`chat_alliance_message`** (S82 G4 — alliance chat only at v1; city chat push deferred to post-launch @mention-only slice). Dispatch via per-domain **post-tx push composers** (see Decision Log). Quiet Hours 23:00–05:00 enforced at send site; `sendImmediately` bypasses for 23:55 streak warning. Stale-token cleanup matches 3 error codes. **S82:** `modules/chat/chat-push.composer.ts` honors `players.alliance_chat_push_enabled` at enqueue time (`WHERE alliance_chat_push_enabled = true`) and skips the sender; uses mutable-emitter test injection. **(Jun 28–29)** +3 `legacy_medal_*` kinds (tier-up / count / one-off; per-player hourly Redis flood guard, ETERNAL bypasses quiet hours) → **25 kinds**. **(Jun 29 i18n Part B)** push copy now translated per-recipient at compose time via `PushRequest` (titleKey/bodyKey/params) + `src/shared/i18n/` resolver + `players.locale`; `$t:<key>` param nesting localizes medal/role/tier names. | ✓ Live end to end |

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
│   │   │   ├── alliance-chat-push.routes.ts ✓ // (S82) PATCH /me/alliance-chat-push-enabled — Zod boolean body, mirrors fcm-token route shape; handler exported as handlePatchAllianceChatPushEnabled for test injection (requireAuth bypass pattern). Honored by chat-push.composer.ts at enqueue time.
│   │   │   ├── alliance-chat-push.routes.test.ts ✓ // 6 tests: flip off, flip on, missing body 400, non-bool 400, no auth 401, unknown clerk 404
│   │   │   ├── challenge-complete.routes.ts ✓ // POST /me/challenge-complete; S62 403 catch maps to { error: 'daily_steps_under_threshold' | 'daily_calories_under_threshold', message }
│   │   │   ├── challenge-complete.service.ts ✓ // orchestrator inside one prisma.$transaction; S58 streak_re_entry field; S59 leveled_up row + level-up push (post-tx emit); S62 in-tx CC enforcement guard (AFTER idempotent early-return, BEFORE grants) + §13 capFactor threaded through XP + resources; S64 EXPORTS LEVEL_UP_EVENT_LEVELS + LEVEL_UP_PUSH_LEVELS for cross-module reuse by claim/contest
│   │   │   ├── challenge-complete.queries.ts ✓ // RACE-FIXED — Prisma {increment}; S59 logLeveledUp writer; S62 getPlayerStreakSnapshot extended to read daily_steps + daily_calories + weekly_steps_total in-tx (rename to getPlayerCompleteChallengeSnapshot deferred B-S62-X2)
│   │   │   ├── challenge.formulas.ts ✓ // ported subset of root formulas.js; S62 adds STEP_TIER_THRESHOLDS (5000/10000/15000), CALORIE_TIER_THRESHOLDS (200/400/700), getChallengeTypeFromEarnKey(earnKey)→'steps'|'calories'|null, calcResourceEarn(opts.capFactor) via calcCanonicalEarn
│   │   │   ├── streak.helpers.ts    ✓ // pure: computeNewStreak, isGraceDayMilestone, applyGraceDayGrant
│   │   │   ├── activity-log.*       ✓ // (S54) GET /me/activity-log cursor-paginated + PATCH .../read
│   │   │   ├── streak-break-status.* ✓ // (S58) GET /me/streak-break-status + POST /me/streak-break/acknowledge
│   │   │   ├── level-up-push.composer.ts ✓ // (S59) §B-10 — LEVEL_COPY for 5/6/10, SKIP_LEVEL_UP_PUSH_EMIT
│   │   │   ├── first-earn-push.composer.ts ✓ // (S60) §B-14 — FIRST_EARN_COPY all 4 spec §5.1 sources, SKIP_FIRST_EARN_PUSH_EMIT
│   │   │   └── index.ts             // registerMeRoutes wires fcmTokenRoutes + challengeCompleteRoutes + activity-log + streak-break routes
│   │   │
│   │   ├── health/                  ✓ Scaffolded, Redis ping included
│   │   │   └── routes.ts            // GET /healthcheck ✓ — returns `{ status, redis: "PONG" }`; 503 on Redis error
│   │   │
│   │   ├── territory/               ✓ LIVE — GET + abandon + claim (two-phase, backend-authoritative S64) + full contest lifecycle (backend-authoritative S65a)
│   │   │   ├── routes.ts            // GET /territories ✓ (Supabase RPC pass-through, 5 params incl. zoom)
│   │   │   ├── abandon.{routes,service,queries}.ts ✓
│   │   │   ├── claim-errors.ts ✓    // (S64) 10 shared typed Error classes (code+context) used by /start AND /complete
│   │   │   ├── claim-start.{service,queries,routes}.ts ✓ // (S64) NEW POST /territories/:id/claim/start — commitment-fee deduct + claim_intents row; 9 typed error codes; 9-field envelope (intent_id, free_claim, gold_paid, gold_balance_after, started_at, expires_at, already_started)
│   │   │   ├── claim.{service,queries,routes,costs}.ts ✓ // (S64) repurposed POST /territories/:id/claim as COMPLETE — backend-resolved intent lookup + Q-P already_completed branching + CC-mirror snake_case envelope + split leveled_up row; claim.costs.ts now holds CLAIM_GOLD_REWARD (Small:10 Medium:20 Large:50 Epic:100 — claims net-negative gold by design)
│   │   │   ├── contest-errors.ts ✓  // (S65a) 18 shared typed Error classes (code+context) across create + walk
│   │   │   ├── contest.{routes,service,queries,costs,formulas}.ts ✓ // (S65a) POST /territories/:id/contest refactored — snake_case 9-field envelope, already_started idempotency, 13 typed errors, attacker_username lookup. costs.ts now holds CONTEST_WIN_REWARDS (iron 15, gold 25, morale 8) + DEFENCE_WIN_REWARDS (stone 20, gold 15, morale 8). Schedules contestExpiryQueue at 23:59 home_pin
│   │   │   ├── contest-defend.{routes,service,queries}.ts ✓ // (S69–S72) Backend sub-slice 1 COMPLETE — G1 normalized 7 typed error codes (contest_not_found / not_active / not_authorised_defender / contest_already_defended / contest_too_advanced / outside_defend_hours / insufficient_stone / invalid_body), G2 attacker_alliance_id + defender_alliance_id populated at contest create, G3 widened auth to alliance collective defense + 75% attacker-progress cutoff, G4 defender_notify push fan-out (solo → [defenderId]; alliance → findAllianceBroadcastRecipients excluding attacker, including owner; recipients pre-resolved IN-tx, composer fires POST-tx), G5 added GET /contests/:id/defend-preview returning 16-field envelope (200 for active-but-defended; 409 for non-active). `isAuthorisedDefender(player, contest)` is the single source of truth consumed by BOTH POST /defend and GET /defend-preview (Q-G5-H lock).
│   │   │   ├── contest-walk.{routes,service,queries}.ts ✓ // (S65a) snake_case request body (source_id, distance_m) + snake_case response envelope; CC-mirror progression block on outcome resolved; resource grant via grantPlayerResources; leveled_up split row; 6 typed errors; post-commit Ably publishes (snake_case keys) + up to 3 FCM pushes
│   │   │   ├── contest-expiry.{queries,worker}.ts ✓ // BullMQ worker, SELECT FOR UPDATE, idempotent
│   │   │   └── index.ts             // wrapper plugin registers GET + abandon + claim/start + claim/complete + contest (create). NOTE: contest-defend + contest-walk registered DIRECTLY in app.ts
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
│   │   │   ├── alliance-push.composer.ts ✓ // (S57) emitAllianceLifecyclePushes — discriminated union for 5 events / 7 wires (kicked+left = subject+broadcast; joined = broadcast-only; promoted+demoted = subject-only). SKIP_ALLIANCE_PUSH_EMIT bypass
│   │   │   ├── activity-log.*       ✓ // (S56) GET /alliances/:id/activity-log + PATCH .../read — alliance feed, separate read cursor, username enrichment
│   │   │   └── index.ts             ✓ // registers found + join + leave + kick + promote + demote + transfer + get + activity-log routes
│   │   ├── streak/                  ✓ LIVE — midnight rollover + 23:55 break-warning, both per-timezone BullMQ jobs
│   │   │   ├── streak-rollover.helpers.ts ✓ // pure evaluateRollover + yesterdayOf
│   │   │   ├── streak-rollover.queries.ts ✓ // fetchPlayersByTimezone, applyRolloverUpdate (optimistic concurrency), logStreakBroken
│   │   │   ├── streak-rollover.service.ts ✓ // processPlayerRollover per-player tx + runRolloverForTimezone batch
│   │   │   ├── bootstrap.ts         ✓ // registers cron '0 0 * * *' per distinct home_timezone
│   │   │   ├── streak-break-warning.helpers.ts ✓ // pure evaluateWarning + formatWarningMessage per spec §4.5.1
│   │   │   ├── streak-break-warning.queries.ts ✓ // fetchEligibleWarningPlayers via tagged $queryRaw
│   │   │   ├── streak-break-warning.service.ts ✓ // processPlayerWarning (sendImmediately bypasses Quiet Hours) + batch
│   │   │   ├── streak-milestone-push.composer.ts ✓ // (S58) §B-6 — 6 tier copies days 7/14/21/30/60/90 (Day 60 amended S59: third Grace Day banked). SKIP_STREAK_PUSH_EMIT bypass
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
│   │   ├── leaderboard/             ✓ LIVE (shipped S80, `16930ac`) — territory + battles + power boards, players + alliances subjects.
│   │   │   ├── leaderboard.routes.ts         ✓ // GET /leaderboards/:board/:subject (board in {territory|battles|power}, subject in {players|alliances})
│   │   │   ├── leaderboard.service.ts        ✓ // dispatcher over the 6 board×subject combinations
│   │   │   ├── leaderboard.queries.ts        ✓ // getTerritoryLeaderboard* via groupBy + enrichment; getBattles/Power via tagged $queryRaw with 30d activity_log CTE for power boards
│   │   │   ├── leaderboard.formulas.ts       ✓ // (S80 G3) ported Power/Alliance Power formulas + calcFullValueCap; source of truth = mobile formulas.js
│   │   │   ├── leaderboard-errors.ts         ✓ // InvalidBoardError, InvalidSubjectError (hyphenated file naming established here, reused for chat)
│   │   │   ├── leaderboard.{routes,service,formulas}.test.ts  ✓
│   │   │   └── index.ts                       ✓ // registerLeaderboardRoutes
│   │   ├── chat/                    ✅ LIVE — S82 ship (G1–G4 backend + M1–M2 mobile). City Chat + Alliance Chat, real-time via Ably (`chat:${room_id}`), Postgres-persisted, surfaced via Map side-rail.
│   │   │   ├── chat-errors.ts                ✓ // 13 typed errors: Player/Room/Message/Report NotFound · RoomAccessForbidden · InvalidCursor/Limit/ReadState/Content · MessageFiltered · ChatMuted (with muted_until) · RateLimited (with retry_after_seconds) · ReportAlreadyResolved · AdminForbidden
│   │   │   ├── chat.queries.ts               ✓ // 18 repository functions: findPlayerByClerkIdForChat, getCityRoomByKey, upsertCityRoom (lazy-on-first-reference per Q-S81-F), getAllianceRoom, insertAllianceChatRoom (used by alliance/found.service tx), archiveAllianceChatRoom (used by alliance/leave.service disband-branch tx), getMessagesByCursor, getLatestMessagePreviewForRoom, countUnreadForRoom, getReadState, upsertReadState, insertChatMessage, updateRoomLastMessageAt, getSenderEnrichment, findMessageById, findExistingReport, insertReport, findReportById, countStrikesInWindow, insertMuteAudit, updatePlayerChatMutedUntilIfLater, setReportStatus, listReportsByStatus
│   │   │   ├── chat.service.ts               ✓ // listAccessibleRooms · listRoomMessages (cursor pagination, limit≤50) · updateRoomReadState · postMessage (validate→mute guard→keyword filter→rate limit→tx insert+last_message_at→post-commit Ably publish→alliance push composer) · issueAblyToken (per-room capability allowlist, 1h TTL) · reportMessage (idempotent via unique constraint)
│   │   │   ├── chat.routes.ts                ✓ // GET /chat/rooms · GET /chat/rooms/:room_id/messages · PATCH /chat/rooms/:room_id/read-state · POST /chat/rooms/:room_id/messages · POST /chat/ably-token · POST /chat/messages/:message_id/report
│   │   │   ├── chat-admin.routes.ts          ✓ // GET /admin/chat-reports (cursor-paginated review queue, status filter) · POST /admin/chat-reports/:report_id/confirm · POST /admin/chat-reports/:report_id/dismiss · all preHandler [requireAuth, requireChatAdmin]
│   │   │   ├── chat-admin.service.ts         ✓ // confirmReport (strike escalation: count includes this strike; ===3 → +24h mute, ===5 → +48h mute; updates players.chat_muted_until cache, only ever extends) · dismissReport · listReports (cursor pagination) · constants STRIKE_WINDOW_MS (30d), MUTE_24H_MS, MUTE_48H_MS
│   │   │   ├── chat-admin.middleware.ts      ✓ // requireChatAdmin reads CHAT_ADMIN_CLERK_IDS env (comma-separated) fresh per call; isChatAdmin helper
│   │   │   ├── chat-moderation.filters.ts    ✓ // KEYWORD_FILTER_LIST starter is empty per Q-G2-B (carry-forward B-S82-FF-keyword-filter-list); matchesKeywordFilter uses case-insensitive `\b(...)\b` whole-word boundary
│   │   │   ├── chat-ratelimit.ts             ✓ // Redis-backed `chat:rate:<player_id>` global counter, 5 messages / 30 seconds per Q-S81-M; INCR + TTL via multi pipeline; resetChatRateForTesting helper
│   │   │   ├── chat-ably.ts                  ✓ // publishChatMessage wrapper + issueAblyTokenRequest (capability serialized to JSON string for Ably 2 typings); mutable activePublisher/activeTokenIssuer slots with __set*ForTesting/__reset*ForTesting helpers — test injection pattern that replaces SKIP_*_PUSH_EMIT env-var bypass
│   │   │   ├── chat-push.composer.ts         ✓ // emitChatAlliancePush — fetches recipients via `WHERE alliance_id=? AND id!=sender AND alliance_chat_push_enabled=true`, builds [SHORTNAME] sender title + 100-char preview body, sendPush per recipient via Promise.allSettled; mutable activeEmitter slot for test injection
│   │   │   ├── chat-archive.service.ts       ✓ // runChatArchiveOnce(now) — find city chat_messages older than (now - 30d), createMany into chat_messages_archive with skipDuplicates, deleteMany from hot, recompute chat_rooms.last_message_at for affected rooms only; returns {archived_count, rooms_recomputed, cutoff}
│   │   │   ├── chat-archive.worker.ts        ✓ // BullMQ Queue + Worker on `chat-archive` queue; spawns at server start via side-effect import in server.ts
│   │   │   ├── bootstrap.ts                  ✓ // bootstrapChatArchiveJob registers `chat-archive-daily-utc` jobId with `repeat: { pattern: '0 3 * * *', tz: 'UTC' }`; called from app.ts after Fastify ready
│   │   │   ├── chat.{routes,service}.test.ts             ✓
│   │   │   ├── chat-admin.{routes,service}.test.ts       ✓
│   │   │   ├── chat-archive.service.test.ts              ✓
│   │   │   ├── chat-push.composer.test.ts                ✓
│   │   │   └── index.ts                                  ✓ // registers chatRoutes + chatAdminRoutes
│   │   ├── weekly-task/             ✅ LIVE (Jul 5, `82305ee`+`629ee72`) — alliance weekly tasks, leader-picked, snapshot-fair. Spec docs/specs/alliance-weekly-tasks.md.
│   │   │   ├── weekly-task.formulas.ts    ✓ // 5-task menu (Long March/Muster/Forge/Drill/Expansion Order), quota×snapshot-members targets, 50% floor, half/full tiers, per-task payouts + war-chest Morale cap 150/wk
│   │   │   ├── pick.service.ts            ✓ // Founder+Marshal pick Sat–Sun in hq_timezone + least-recently-run auto-assign fallback
│   │   │   ├── progress.service.ts        ✓ // aggregates accepted activity_samples only (anti-cheat inherited from ingest); Drill reuses ingest session stitching
│   │   │   ├── rollover.service.ts        ✓ // Monday 00:10 per hq-tz cohort — one guarded tx: contributions→tier→per-contributor payouts→war chest, then activate+snapshot this week (Monday roster = target + eligibility)
│   │   │   ├── weekly-task-push.composer.ts ✓ // quiet-hours-aware pushes (en+ru), weekly_task_reward
│   │   │   ├── bootstrap.ts               ✓ // registers rollover + pick-reminder repeatable jobs per hq-tz
│   │   │   ├── weekly-task.routes.ts      ✓ // GET/POST /alliances/:id/weekly-task[/menu|/pick]
│   │   │   ├── {formulas,rollover}.test.ts ✓
│   │   │   └── index.ts                   ✓
│   │   ├── development/             ✅ LIVE (Jul 6, `a478a0f`) — territory D0→D4 develop (ATOMIC per-level, NO upkeep) + influence economy. Mechanics §5.8.1 amended.
│   │   │   ├── development.formulas.ts    ✓ // per-level costs, D3 gate L8 / D4 gate L9, +500 XP/tier; parity vs mobile lib/formulas.js
│   │   │   ├── develop.service.ts         ✓ // POST /territories/:id/develop — one balance+level-guarded tx (double-tap safe); D3/D4 alliance-feed rows; D4 → permanent development_records + Ably development_updated
│   │   │   ├── develop.{routes,queries}.ts ✓
│   │   │   ├── daily-influence.service.ts ✓ // 00:05 per-tz tick (owner home pin / alliance HQ); influence_credited_ymd CAS idempotent; one-shot §5.8.4 milestone acks
│   │   │   ├── daily-influence.queries.ts ✓
│   │   │   ├── bootstrap.ts               ✓ // registers daily-influence repeatable jobs per tz
│   │   │   ├── {develop.service,daily-influence.service,development.formulas}.test.ts ✓
│   │   │   └── (wallet cols players.influence/lifetime_influence x10 fixed-point; migration 20260706-territory-development applied live)
│   │   ├── realm/                   ○ Out of code model — corporate ops concept only per Q-S81-B; future realm = separate Supabase project + Railway deployment, not a column. (Realm-column removal from this doc tracked as `B-S81-OPS-realm-removal-state-cleanup`.)
│   │   └── activity/                ✓ LIVE (S46–S51) — POST /activity/steps + tz-batch midnight aggregate reset
│   │       ├── activity.helpers.ts    ✓ // canCreditSample, bucketSampleByDay, computeLongestSessionMin (pure, S47)
│   │       ├── activity.routes.ts     ✓ // POST /activity/steps with .strict() zod (S49)
│   │       ├── activity.service.ts    ✓ // ingestActivitySamples — interactive prisma.$transaction({timeout:30_000}) (S49 + S51 hotfix)
│   │       ├── activity.queries.ts    ✓ // 6 fns, all in-tx via Prisma.TransactionClient (S49)
│   │       └── index.ts               ✓ // registerActivityRoutes aggregator (S49)
│   │
│   ├── shared/
│   │   ├── formulas/                ✓ (S42/S43/S46/S47) Cross-module pure math — single source of truth
│   │   │   ├── canonical-earn.ts        ✓ // calcCanonicalEarn, BONUS_PRODUCT_CAP=3.0. One impl of
│   │   │   │                            //   buff stacking across modules.
│   │   │   ├── streak.ts                ✓ // STREAK_TIER_THRESHOLDS, STREAK_MULT_TIER_CAP,
│   │   │   │                            //   STREAK_MILESTONE_DAYS=[7,14,21,30,60,90],
│   │   │   │                            //   STREAK_MILESTONE_XP=250, getStreakTier,
│   │   │   │                            //   calcStreakMultiplier, isStreakMilestone.
│   │   │   ├── streak.test.ts           ✓ // 12 unit tests (isStreakMilestone boundaries + sanity)
│   │   │   ├── velocity.ts              ✓ // (S46/S47) MAX_PLAUSIBLE_KMH=25 (25-vs-30 doc inconsistency canonically resolved to 25 in S62), MAX_PLAUSIBLE_MS (derived),
│   │   │   │                            //   SESSION_IDLE_THRESHOLD_MIN=15, DEFAULT_STRIDE_M=0.75,
│   │   │   │                            //   FUTURE_TIMESTAMP_TOLERANCE_MS (lifted from contest-walk in S47),
│   │   │   │                            //   isStepWindowOverVelocityCap, isVelocityOverCap, stepsToKm.
│   │   │   │                            //   contest-walk + activity both import from here. 27 unit tests.
│   │   │   ├── velocity.test.ts         ✓ // 27 unit tests (S46)
│   │   │   ├── wellbeing-caps.ts         ✓ // (S62) §13 cap-band constants {STEP 15k:1.0/17.5k:0.75/20k:0.40/Inf:0; CALORIE 700/800/900/Inf; weekly ≤100k:1.0/>100k:0.5} + effectivenessForChallenge. Sibling to velocity.ts. 29 unit tests.
│   │   │   └── wellbeing-caps.test.ts    ✓ // (S62) 29 tests — band boundaries + weekly factor + missing-stats defaulting + error cases
│   │   ├── prisma.ts                ✓ Singleton PrismaClient with `@prisma/adapter-pg`. globalThis-cached for tsx-watch hot reload survival.
│   │   ├── supabase.ts              ✓ Service-role client. Used only by territory GET (PostGIS RPC).
│   │   ├── auth.ts                  ✓ Clerk verifyToken middleware, per-route preHandler.
│   │   ├── redis.ts                 ✓ ioredis singleton. `maxRetriesPerRequest: null`, `enableReadyCheck: false`, `family: 0` (IPv6).
│   │   ├── ably.ts                  ✓ Ably.Rest singleton. Server-side publishing only.
│   │   ├── firebase.ts              ✓ Firebase Admin singleton — `admin.initializeApp` from `FIREBASE_SERVICE_ACCOUNT_JSON`.
│   │   ├── timezone.ts              ✓ `resolveLocalDateTimeToUtc`, `isQuietHours`, `computeNextQuietHoursDispatchUtc`, `getLocalDateInTz`, `getLocalHour`, `isMondayInTz` (S50 — pure over already-tz-local YMD string, DST-irrelevant).
│   │   ├── queues/                  ✓ Real BullMQ queues — contest-expiry, quiet-hours-push, streak-rollover, streak-break-warning.
│   │   ├── admin.ts                 ✓ (Jul 7 `3653157`) requireAdmin preHandler + isAdmin helper over `ADMIN_CLERK_IDS` env — gates /debug routes + POST /me/debug-log.
│   │   ├── shutdown.ts              ✓ (Jul 6 `229149f`) central graceful-shutdown handler: fastify→workers→queues→redis→prisma→firebase, 25s cap under Railway SIGKILL window.
│   │   ├── notifications/           ✓ FCM dispatch with Quiet Hours — send.ts (**+ sendPushBatch/sendPushWithContext/sendImmediatelyWithContext, Jul 6 `f0070a8` — cut composer fanouts from N queries to 1**), quiet-hours.worker.ts, types.ts (PushNotificationKind union, **21 kinds** as of S60; see STACK for the full 25-kind count).
│   │   ├── constants/activityLog.ts ✓ (S54/S59) PLAYER_FEED_EVENT_TYPES + ALLIANCE_FEED_EVENT_TYPES whitelists for the feed endpoints.
│   │   └── errors.ts                ○ typed app errors
│   │
│   ├── jobs/                        ○ Folder scaffolded — real workers currently live inside their modules.
│   ├── test-setup/                  ✓ (S66) DATABASE_URL safety guard — guard-impl.ts (assertTestDatabaseUrl: host ∈ {localhost,127.0.0.1}, no supabase.co/com, port 5433, dbname includes '_test') + guard.ts (node:test --import runtime re-validation).
│   ├── app.ts                       ✓ Fastify instance factory. Registers: health, player, me (incl. challenge-complete + debug-log), territory, contestDefendRoutes (direct), contestWalkRoutes (direct), **activity routes (S49)**, **weekly-task + development routes (Jul 5–6)**, debug routes (now admin-gated). **Jul 7 `3653157`: `@fastify/helmet` + `@fastify/rate-limit` (120/min, healthcheck exempt) + `trustProxy` + global `setErrorHandler` (generic 500).** Calls bootstrapStreakRolloverJobs + bootstrapStreakBreakWarningJobs + weekly-task/development bootstraps after Fastify ready.
│   └── server.ts                    ✓ Entry point. Side-effect imports boot: firebase init, contest-expiry worker, quiet-hours worker, streak-rollover worker, streak-break-warning worker.
│
├── scripts/run-tests.mts            ✓ (S66) Test wrapper: env load → DATABASE_URL guard → destructive-op grep (TRUNCATE/DROP/$executeRawUnsafe/deleteMany-no-where/raw DELETE) → docker compose up → health wait → `prisma db push --accept-data-loss --url <test url>` → spawn node:test. Run via `npm test`.
├── scripts/test-db-reset.mts        ✓ (S66) `docker compose down -v` — drops the test container + volume so next `npm test` rebuilds fresh.
├── docker-compose.yml               ✓ (S66) db-test service (postgis/postgis:16-3.4, 127.0.0.1:5433, volume dominia-test-pgdata).
├── .env.test.example                ✓ (S66) template; copy to .env.test (gitignored) carrying the local test DATABASE_URL.
├── docs/TEST_DB.md                  ✓ (S66) operational reference for the isolated test DB.
├── docs/POSTMORTEM-2026-06-12.md    ✓ (S66) incident timeline (TRUNCATE-CASCADE-on-prod) + forbidden patterns + restore procedure.
│
├── prisma/schema.prisma             ✓ Introspected from live Supabase — 16 models (added `activity_samples` S48, `claim_intents` S64). PostGIS as `Unsupported("geometry")`. **S66: this file is now the schema source of truth for the test DB (via `prisma db push`) — drift vs prod must be checked (B-S66-X-schema-prisma-prod-drift-check).**
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
| Backend env vars | `PORT`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CLERK_SECRET_KEY`, `DATABASE_URL` (port 6543 Transaction pooler), `DIRECT_URL` (port 5432 Session pooler IPv4), `REDIS_URL` (Railway ref `${{Redis.REDIS_URL}}` in prod; `REDIS_PUBLIC_URL` locally), `ABLY_API_KEY` (Root key), `FIREBASE_SERVICE_ACCOUNT_JSON` (single-line minified JSON; on Railway paste WITHOUT quotes, in local `.env` wrap in single quotes for dotenv), `ALLOW_DEBUG_ROUTES` (currently `true` on Railway — enables `/debug/*` in prod; flip OFF before any external playtest), **`CHAT_ADMIN_CLERK_IDS` (S82 G3 — comma-separated Clerk user ids; read fresh per call by `chat-admin.middleware.ts`; unset/empty means no admins; currently set on Railway to nish_s clerk id `user_3CRjZoj8XaCoFwuAayVcgA2RPaP`)**. Service account file at `C:\Users\nisha\dominia-secrets\firebase-admin.json` — NEVER commit. Values must NOT be wrapped in angle brackets. |
| Mobile EAS env vars | `EXPO_PUBLIC_*` keys (Mapbox etc.) + `GOOGLE_SERVICES_JSON` (Firebase Android config as EAS **file** env var, sensitive, environment=development). Referenced in `app.config.js` as `process.env.GOOGLE_SERVICES_JSON ?? './google-services.json'`. Local file at `C:\Users\nisha\dominia-secrets\google-services.json` — gitignored. |
| Clerk instance | Single test instance shared between mobile (`pk_test_bGVu...`) and backend (`sk_test_...`). |
| Firebase project | Android app registered as `com.nish_s.dominia` (underscore tolerated by Firebase but technically invalid per Android spec — first suspect if FCM ever rejects registration). |

---

## SUBSCRIPTIONS & LIMITS

| Service | Plan | Key limits |
|---|---|---|
| Supabase | Pro | Micro compute, ~$25/month all-in. PostGIS 3.3.7 in `postgis` schema. **Single project — NO separate test DB; prod and dev share one database (the root cause of the S65a TRUNCATE-CASCADE wipe).** Daily scheduled physical backups taken ~06:15–06:21 UTC, ~7-day retention (used to recover the wipe — restored 12 Jun 06:19 UTC). PITR NOT enabled. |
| Docker Desktop | Free | Local only. Hosts the isolated backend test Postgres (`postgis/postgis:16-3.4`). Required for `npm test` on backend (S66). |
| Mapbox | Free | 50,000 map loads/month |
| Clerk | Free | 10,000 MAU |
| Railway | Hobby | Backend hosting + Redis plugin. Auto-deploys on push to `main`. Two services: `dominia-backend` (Node) + `Redis` (private network ref var, no egress in prod; `REDIS_PUBLIC_URL` for local dev). |
| Ably | Free tier (Pub/Sub) | 6M messages/month, 200 peak connections, 200 peak channels. Single app "Dominia". Single Root API key (backend only). Mobile will use scoped key or token auth when subscription is added. Currently publishes 4 events on `contest:<id>` channels. |
| Firebase | Free (Spark plan) | Cloud Messaging only. No quota limits on dev-tier FCM sends. |
| EAS Build | Free | 30 builds/month (15 Android + 15 iOS). **~23 Android used, ~7 remaining** (no builds consumed S62–S66 — Alyona's standalone preview is still on PRE-S64 code; rebuild deliberately deferred until the S67 onboarding-hardening + defender-lifecycle deltas accumulate AND Slice 7 smoke is verified). Failed builds DO NOT count against the cap. |
| Cursor | Pro | No usage limits on AI edits |

---

## SUPABASE SCHEMA

**Tables:**

`players`: id, username, level, xp, home_city (text — DERIVED via PostGIS in POST /me/home-pin; Title Case canonical form), alliance_id, created_at, clerk_id, has_onboarded, home_pin_lat, home_pin_lng, current_streak, longest_streak, last_active_date, grace_days_banked (int NOT NULL DEFAULT 0 — bank capped at 3, granted at 7/30/60-day milestones, one consumed per missed day at local midnight), iron, stone, gold, morale, lifetime_contest_wins, lifetime_defence_wins, home_timezone (text NOT NULL DEFAULT 'UTC', IANA tz string — derived from home pin via tz-lookup), fcm_token (text nullable — Firebase Cloud Messaging device token; set via PATCH /me/fcm-token; cleared on sign-out and on FCM stale-token error), **daily_steps (int NOT NULL DEFAULT 0 — S48; incremented per accepted activity sample, zeroed at midnight local-tz via streak-rollover S50; S62: now READ in-tx by /me/challenge-complete to GATE step-tier challenges against STEP_TIER_THRESHOLDS — backend-enforced, 403 daily_steps_under_threshold on fail)**, **daily_calories (int NOT NULL DEFAULT 0 — S48; incremented only when kcal present, mobile sends in Slice 8)**, **weekly_steps_total (int NOT NULL DEFAULT 0 — S48; incremented per accepted sample, zeroed Mondays only)**, **longest_session_min (int NOT NULL DEFAULT 0 — S48; recomputed inside ingest tx via computeLongestSessionMin when acceptedCount > 0; zeroed daily)**, **player-feed read cursor (S54 — advanced via `PATCH /me/activity-log/read`)**, **alliance_feed_last_read_at (S56 — separate read cursor for the alliance feed)**, **streak_broken_acknowledged_at (timestamptz nullable — S58, §B-8 break-confirmation acknowledgement; paired UP/DOWN folder migration)**, **chat_muted_until (timestamptz nullable — S82 G1; denormalised mirror of MAX(chat_mutes.muted_until) for hot-path mute check; source of truth is chat_mutes audit table; only ever extends, never shortens)**, **alliance_chat_push_enabled (boolean NOT NULL DEFAULT true — S82 G1; honored at enqueue time by chat-push.composer; flipped via PATCH /me/alliance-chat-push-enabled S82 M2)**, **avatar_url (text nullable — Jun 24; Clerk-hosted image URL, https ≤2048 chars via PATCH /me; returned on chat sender, roster, leaderboard rows)**, **locale (text NOT NULL DEFAULT 'en' — Jun 29 i18n Part B; drives per-recipient push translation; app sends `i18n.language` via patchMe on launch)**, **daily_distance_m + daily_tempo_tier (Jul 3 challenge-axes migration — Range/Tempo axis aggregates, zeroed at midnight rollover)**. **Usernames stored UPPERCASE since Jun 24** (two-pass prod migration `uppercase_usernames`); **case-insensitive uniqueness enforced by functional index `players_username_lower_key ON players (lower(username))`** (Jul 3; pre-existing `BOO`/`boo` collision resolved by renaming the newer to `boo.1`)

`chat_rooms` (S82 G1): id (uuid PK gen_random_uuid), room_type (text + CHECK in `city`/`alliance` per Q-S81-E), room_key (text — city name Title Case for city rooms, alliance.id text for alliance rooms), alliance_id (uuid FK alliances ON DELETE SET NULL, nullable), created_at, last_message_at (nullable — recomputed by chat-archive worker for affected city rooms), archived_at (nullable — set by leave.service.ts disband-branch). **UNIQUE (room_type, room_key)** (Prisma TS field name `room_type_room_key`, NOT the SQL constraint name — see Pitfall #63). Indexes: `idx_chat_rooms_alliance` partial WHERE alliance_id IS NOT NULL · `idx_chat_rooms_last_message_at` on (last_message_at DESC). Q-S81-F: alliance rooms eager-created in `found.service.ts` tx; city rooms lazy-upsert on first reference.

`chat_messages` (S82 G1, hot table): id (uuid PK), room_id (FK chat_rooms ON DELETE CASCADE), sender_player_id (FK players ON DELETE NO ACTION), content (text, 500-char Zod max enforced at API boundary per Q-G1-Schema — no DB length cap), created_at. Indexes: `idx_chat_messages_room_created` on (room_id, created_at DESC) · `idx_chat_messages_sender`. R-S81-3: insert + last_message_at update inside one `prisma.$transaction`. R-S81-4: Ably publish happens AFTER tx commit, non-fatal.

`chat_messages_archive` (S82 G1, cold table): id (uuid PK — preserved from hot table for traceability), room_id, sender_player_id, content, created_at, archived_at (DEFAULT now()). Indexed on (room_id, created_at DESC). Write-only at v1 per Q-S81-G; "load older messages" UI is carry-forward `B-S81-PHASE2-archive-restore`. Filled by (a) `chat-archive-daily-utc` BullMQ cron for city messages older than 30 days, and (b) `leave.service.ts` disband-branch for ALL alliance messages in one tx.

`chat_read_state` (S82 G1): player_id (uuid FK players ON DELETE CASCADE), room_id (uuid FK chat_rooms ON DELETE CASCADE), last_read_message_id (uuid nullable — reserved for "scroll to first unread" future UX), last_read_at (timestamptz NOT NULL). **PRIMARY KEY (player_id, room_id)** (composite; Prisma TS field name `player_id_room_id`). Upserted from mobile on screen-blur per Q-S81-K. Unread count derived by `countUnreadForRoom(roomId, lastReadAt)` via indexed range scan on `chat_messages.created_at`.

`chat_mutes` (S82 G1, audit table): id (uuid PK), player_id (FK players), muted_until (timestamptz NOT NULL — set to applied_at for non-mute strikes, future date for 24h/48h mutes), reason (text nullable — `confirmed_report` in current writer), applied_at (DEFAULT now()), applied_by_clerk_id (text — admin Clerk id, populated from request.clerkUserId at confirm time), source_report_id (uuid nullable, references the originating chat_reports.id). Index on (player_id, applied_at DESC). Source of truth for the 30-day rolling strike window count.

`chat_reports` (S82 G1): id (uuid PK), message_id (FK chat_messages ON DELETE NO ACTION), reporter_player_id (FK players), reason (text nullable), status (text DEFAULT `pending`, CHECK in pending/confirmed/dismissed), reported_at (DEFAULT now()), resolved_at (nullable), resolved_by_clerk_id (text nullable). **UNIQUE (reporter_player_id, message_id)** for idempotency (Prisma TS field name `reporter_player_id_message_id`). Index on (status, reported_at) for the admin queue read path.

`legacy_medal_stats` (Jun 28): one row per player — per-medal counters/peaks (~20 cols incl. `daily_eval_ymd` idempotency marker for the midnight-cron medal pass). `legacy_medal_earnings` (Jun 28): one row per earn event (audit log + THE WALL per-territory reset marker in metadata), partial unique idx `lme_tier_unique` + `lme_count_unique`. Both RLS-on, reads go through backend `GET /legacy/medals` APIs. Migration `20260628-add-legacy-medal-tables` + `20260628-add-daily-eval-marker`.

`alliance_week_in_review` (Jul 1, Command Post): weekly digest rows per alliance; RLS enabled + 0 policies (default-deny). Migration `20260701-add-command-post`.

`alliance_ability_activations` (Jul 7, War Room abilities): id (uuid PK), alliance_id (FK alliances ON DELETE CASCADE), ability (text + CHECK in war_surge/iron_bulwark/rally_cry/steadfast/supply_line), activated_by (uuid FK players ON DELETE SET NULL, nullable), morale_cost (int), activated_at (timestamptz DEFAULT now()), expires_at (timestamptz). Indexes: `idx_aaa_alliance_ability_activated` (alliance_id, ability, activated_at DESC) for cooldown/week-limit lookups · `idx_aaa_alliance_expires` (alliance_id, expires_at) for active-buff scans. RLS enabled + 0 policies (default-deny; service-role bypasses). Cooldown (8h weekend abilities) + supply_line once-per-week are DERIVED from the latest `activated_at` per (alliance, ability) — no state column. Migration `20260707-alliance-abilities` **applied live**.

`activity_samples` (S48): id (uuid PK, gen_random_uuid), player_id (uuid FK), source_id (text — deterministic SHA-256 UUID-shaped from `playerId|windowStartMs|windowEndMs` per Q-D), window_start (timestamptz), window_end (timestamptz), steps (int), distance_m (int), kcal (int nullable — D9 phase 1), avg_gps_speed_ms (numeric nullable — D10 scalar speed only, no coordinates), bucket_ymd (varchar(10) — YYYY-MM-DD in player tz at write time, denormalised per D5), accepted (boolean), rejection_reason (text nullable — `velocity_capped` / `window_too_short` / `future_timestamp` / `past_day` / `duplicate` etc., app-layer validated against `CreditSampleRejectionReason` union), created_at. **UNIQUE (player_id, source_id)** for D6 idempotency. Covering indexes: `(player_id, bucket_ymd)` for daily aggregate reads, `(player_id, window_end)` for chronology queries. No DB-level CHECK on `accepted XOR rejection_reason` — app-layer enforced + T9 runtime invariant test. **Append-only audit log; never updated.**

`contests`: id, territory_id (FK), attacker_id (FK), attacker_alliance_id (nullable, no FK yet), defender_id (FK, territory owner at initiate), defender_alliance_id (nullable, no FK), required_walk_m (int, frozen at initiate), attacker_walked_m (int default 0), defender_player_id (FK nullable — who tapped Defend), defender_walked_m (int default 0), defender_response_ratio (numeric(3,2) nullable — 1.00 with Stone, 1.25 without), iron_cost_paid (int), status (text, CHECK in 'active'/'attacker_won'/'defender_won'/'expired'), initiated_at (default now()), resolved_at (nullable), attack_day_date (date, set from player.home_timezone at initiate), defender_starting_walk_m (int NOT NULL default 0 — snapshot of defender's HC walk distance at /defend tap), attacker_first_walk_at (nullable — one-shot flag set on first non-zero attacker /walk; triggers defender_notify push), attacker_last_sample_at (nullable — last accepted attacker sample for CWR gap detection), defender_last_sample_at (nullable — same for defender)

`contest_walk_samples`: id (uuid PK), contest_id (FK), player_id (FK), source_id (text — client-side idempotency key), sample_timestamp (timestamptz), distance_m (int), accepted (boolean), rejection_reason (text nullable — set when accepted=false, e.g. 'vehicle_speed', 'invalid_timestamp'), created_at. UNIQUE (contest_id, player_id, source_id). CHECK `accepted = (rejection_reason IS NULL)`. Composite index on (contest_id, player_id, sample_timestamp).

`claim_intents` (S64 — backend-authoritative claim two-phase): id (uuid PK), player_id (FK CASCADE), territory_id (FK CASCADE), status (text + CHECK — `pending` while walk in progress, consumed/expired thereafter), gold_paid (int — commitment fee deducted at /start), free_claim (boolean), started_at (timestamptz), expires_at (timestamptz — 60-min wall-clock, lazy-expired pre-tx, no cron), created_at. **Two field-level partial UNIQUE indexes: `(player_id) WHERE status='pending'`** (one pending claim per player — bounds the reservation grief vector) **and `(territory_id) WHERE status='pending'`** (single-pending-per-territory reservation, Q-H). Composite index `(player_id, territory_id)` for the already_completed lookup. Migration `prisma/migrations-manual/20260612-add-claim-intents-table/{up,down}.sql`.

`territories`: id, territory_name, tier, perimeter_distance, owner_id, alliance_id, development_level, longitude, latitude, created_at, legacy_rank, upkeep_overdue, osm_id (bigint), osm_type, geojson (jsonb), geom (postgis.geometry(Polygon, 4326)), district (text nullable, indexed), territory_name_v1 (nullable — rollback backup on gap-fill rows only), city (text — NORMALISED to Title Case: 'Amsterdam', 'Saint Petersburg')

`alliances`: id, name, short_name (text + UNIQUE + CHECK `^[A-Z]{3}$`), city, created_at, founder_id, morale, hq_territory_id (FK nullable), hq_timezone (text), disbanded_at (timestamptz nullable), **emblem (text + CHECK, 7 keys vanguard/bastion/summit/wayfinder/ember/forge/banner — Jul 2 Living Map; founder-chosen at founding via optional Zod enum, defaults vanguard, unchangeable post-founding)**

`alliance_members`: id, alliance_id (FK CASCADE), player_id (UNIQUE FK CASCADE — one alliance per player at DB level), role (CHECK in 'founder'/'marshal'/'officer'/'sergeant'/'soldier'/'recruit'), joined_at, recruit_streak_count, recruit_last_completion_date — indexes: `idx_alliance_members_alliance_id`, `idx_alliance_members_role`

`player_challenges`: id, player_id, challenge_key, completed_at, date — UNIQUE on (player_id, challenge_key, date), **axis (text nullable — Jul 3; the day's locked axis derivable in-tx, NULL for non-axis keys)**

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

**⚠️ PRODUCTION DATA INCIDENT + RESTORE (S65a→S65b discovery, see `docs/POSTMORTEM-2026-06-12.md`):**
An S65a backend test ran `TRUNCATE alliances RESTART IDENTITY CASCADE` against **production** (the summary called it a "shared test DB" but no separate test DB existed — single Supabase project). FK CASCADE wiped players, territories, contests, activity_log. Reverting the test code did NOT restore rows. Symptom surfaced in S65b as an onboarding hang (Clerk SecureStore kept nish_s "signed in" against a deleted row). **Recovered** by restoring the **12 Jun 2026 06:19:22 UTC** scheduled backup (before S65a). Post-restore healthy: 59 players (nish_s present, has_onboarded=true), 8560 territories, 26 alliances, 7 contests, 135 activity_log.
- **Test pollution still present in the restored DB (pre-dates the incident):** 48 of 59 players + 16 of 26 alliances are June-8 test artifacts (prefixes `activity-test-s49-*`, `kick-test-*`, `demote-test-*`, `aalog-test-*`, `transfer-test-*`, `leave-test-*`, `promote-test-*`, `rollover-int-*`; clerk_id mirrors username instead of real `user_*`). **Real users (11):** nish_s, Alyona, testcity, Sofia, David, test7, test5, TINA, Phantom, boo, Rubik. **Real alliances (10):** Bikers United, Snow Walkers, Gritty Greeks, Kainetic Allied, Neva Walkers, Sofias Vanguard, Saint Runners, Sofa walkers, Tina Turners, Engelsa Walkers. Cleanup DEFERRED (B-S66-X-test-row-cleanup-deferred) — FK graph has NO-ACTION constraints on territories (10 rows by owner_id, 18 by alliance_id) + 15 activity_samples; needs full FK-ordered delete. Safe to run only now that test isolation (S66) prevents repopulation.

**Indexes:**
- `idx_territories_{owner_id, alliance_id, district}`
- `idx_players_{clerk_id, alliance_id}`
- `idx_territory_history_{territory_id, owner_id}` + partial `current_holder` WHERE lost_at IS NULL
- `territories_geom_idx` GIST on territories(geom)
- `contests_pkey`, `contests_territory_active_unique` (PARTIAL UNIQUE on `(territory_id) WHERE status='active'` — DB-level Single-Contest Rule), `contests_attacker_idx`, `contests_status_attack_day_idx`, partial `contests (territory_id, resolved_at DESC)` (Jul 2 — Living Map battle-state LATERAL)
- `players_username_lower_key` UNIQUE on `lower(username)` (Jul 3 — authoritative; old case-sensitive `players_username_key` left in place, redundant/harmless)

**Row Level Security — LOCKED DOWN (Jun 23–24, Phases 1+2 COMPLETE):**
- **RLS is now ENABLED on ALL public tables.** Migration `20260623-enable-rls-phase1` (applied live). Backend is unaffected — it connects as `postgres` (`rolbypassrls = true`), so RLS never explains a backend query failure.
- Anon (mobile) policies: **SELECT-only** on `players`/`territories`/`alliances`/`territory_history`/`player_challenges`; `debug_events` anon-INSERT kept deliberately (lib/debug.js funnel events). Everything else = RLS-on, no policy = denied.
- Phase 2 (`phase2_drop_temp_policies`, Jun 24): all mobile WRITES moved to backend endpoints (`POST /me/bootstrap`, `PATCH /me`, `POST /me/stride-calibration`, abandon routes, `POST /alliances/:id/morale/{donate,spend}`) and the temp anon-write policies + the `donate_morale`/`deduct_alliance_morale` SQL functions were **DROPPED**. Verified end-to-end on device (signup, username, onboarding, donate-morale, claim).
- The old "19-min hang" note is obsolete — policies are anon-key-based, not `auth.uid()`. Clerk→Supabase JWT is still NOT wired (mobile reads ride the anon SELECT policies; owner-scoped read RLS would require the backend-read migration path noted in public-profiles).

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
- `get_territories_in_viewport(min_lon, min_lat, max_lon, max_lat, zoom)` — **canonical territory fetch for MapScreen.** SECURITY DEFINER + SET search_path = public, postgis. Returns flat columns including owner_username, owner_streak_days, alliance_short_name, **+ (Jul 2 Living Map, drop+recreate, grants re-issued): `alliance_emblem`, `contest_active`, `last_battle_outcome` ('fell'/'held'), `last_battle_at` (contests resolved within 24h via LATERAL)**. CCW-corrected via `postgis.ST_AsGeoJSON(postgis.ST_ForcePolygonCCW(t.geom))::jsonb`. Filters with `ST_IsValid` AND `ST_NPoints >= 4`.
- `get_home_bases_in_viewport` (Jul 2, Living Map Phase 2) — active players (last_active_date within 45d) with home pins; **coords snapped server-side to ~250m grid — raw pins never leave the DB**; bbox filter runs on snapped coords.
- ~~`deduct_alliance_morale` / `donate_morale`~~ — **DROPPED Jun 24 (RLS Phase 2)**; replaced by backend `POST /alliances/:id/morale/{spend,donate}`.
- `insert_road_batch / insert_poi_batch / insert_district_batch / insert_okrug_batch` — SECURITY DEFINER batched loaders for SPB pipeline.

**SQL functions (kept while temp tables alive):**
- `polygonise_spb_blocks()`, `merge_sub_floor_blocks_spb()`, `merge_unnamed_spb_blocks()`, `name_spb_blocks()` (3-tier naming cascade — uses GET DIAGNOSTICS, planar+geography ST_DWithin), `backfill_landmarks_for_duplicates_spb()`, `disambiguate_spb_blocks()`.

**Dead RPCs (safe to drop):** `get_all_territories_meta`, `get_territories_geojson_batch`.

---

## SCREENS — STATUS

| Screen | Status | Notes |
|---|---|---|
| Navigation (4 bottom tabs) | ✓ Branded | Geist Mono uppercase, hairline-strong top border, Bone active / Slate inactive |
| Map screen | ~ Live data | PostGIS viewport fetch via `get_territories_in_viewport` RPC. Client-side feature cache + merge-on-fetch + age-gated abort. Debounce 150ms. styleURL `light-v11` for dev. (S37) useFocusEffect also calls fetchPlayer; alliance_id transition tracking clears featureCacheRef + refetches. Colour priority: own=red, alliance members=green, other=blue-grey. **(S55)** Player activity-feed side-rail on the Map tab only. **(S64)** `handleAcceptClaim` now calls `startClaim` (`lib/claimApi.js`) instead of a direct Supabase gold deduct; per-code error UX inline on confirm sheet with live countdown for `territory_being_claimed` / `active_claim_in_progress`. **(S65b)** `handleAcceptContest` now calls `startContest` (`lib/contestWalkApi.js`) instead of a direct Supabase iron UPDATE; 3-tier error UX (inline-in-sheet 6 codes / top-banner auto-dismiss 7 codes / `contest_already_active` 409 info card); navigates to ActiveClaim with backend `required_walk_m` (fixes old raw-perimeter bug) + `contest_id` + `iron_balance_after`. **(S80)** `<LeaderboardsSideRail hidden={selected != null} />` rendered at `bottom: tabBarHeight + 72`. **(S82 M1)** `<ChatSideRail hidden={selected != null} />` rendered above the other two rails at `bottom: tabBarHeight + 132` (3rd rail up — math: 12+48+12+48+12). **(Jul 2 Living Map 1–3, pending rebuild + on-device offset checks)** streak-band borders (base <7d / hardened 7–20d / fortified 21+d), D2+ ramparts, alliance emblem SymbolLayer zoom≥13, two-line labels (`name` + `D3 · [TAG]`), home-base structures zoom≥12 (camp/outpost/keep/citadel by level band; own = Claim red at exact pin, others = Bone at snapped coords; tap → PublicProfile), alliance pennants, D4 FillExtrusionLayer 14m, marching-dash siege borders (200ms interval gated on contested-feature presence), battle chips (`lib/battleChips.js`, 24h decay); opens on home pin instead of Amsterdam (`5182060`). **(Jul 4 first-run)** objective banner + red dashed perimeter + ObjectivePulse MarkerView for the first-claim objective. Known bugs: zoom-simplify hides small polygons; nested/overlapping territories. |
| Chat screen | ✓ Live data | **(NEW S82 M1+M2)** CITY \| ALLIANCE tab strip mirroring `LeaderboardsScreen.boardStrip`; alliance tab filtered out when player has no alliance room (snaps back to city). Per-room state maps for messagesByRoom + nextCursorByRoom + endReachedByRoom + loading flags. **Inverted FlatList** (newest at bottom, chat-app convention) with `onEndReached` cursor pagination. Read-state PATCH on navigation `blur` event per Q-S81-K. **M2 composer footer:** TextInput multiline w/ maxLength 500 + minHeight 36 + maxHeight 96 (auto-grow up to ~4 lines per Q-M2-A); 500-char counter on right side; explicit SEND button (Claim red, brand single-CTA) — bare Enter inserts newline per Q-M2-B. **Optimistic insert:** client-generated `client_temp_id` row appears immediately (opacity 0.55 via `_optimistic` style flag), replaced on POST success preserving `client_temp_id` for Ably echo dedupe per Q-M2-C; rollback on failure with draft restored. **Banner UX:** inline above composer, red `rgba(214,69,37,0.85)` for muted/filtered/error or amber `rgba(212,160,40,0.85)` for rate_limited; 5s auto-dismiss. **Ably realtime:** connects via `lib/chatRealtime.js` after `roomsLoaded`, subscribes to each accessible room channel; incoming `chat:message` payload merges into messagesByRoom with `client_temp_id`-based dedupe. **KeyboardAvoidingView** padding-on-iOS / undefined-on-Android (avoids inverted-FlatList interaction bug on Android). **Push deep link:** reads `route.params.initialTab` to set the initial active tab when launched from a `chat_alliance_message` FCM tap. Empty states: NO MESSAGES YET / NO CITY YET (Set your home pin) / NO ALLIANCE (Join an alliance). **(Jun 24)** 32px sender avatar thumb per message (initials fallback); tap a sender → PublicProfile (Jun 30). |
| Leaderboards screen | ✓ Live data | **(SHIPPED S80, `16930ac`)** L14 visual reference for chat. Header + hairline-strong. `boardStrip` (44px, 3 cells: POWER / TERRITORY / BATTLES) + `subjectStrip` (36px, 2 cells: PLAYERS / ALLIANCES). FlatList rendering board-specific row variants (PowerRow/TerritoryRow/BattlesRow). Self-row highlight via viewerPlayerId + viewerAllianceId match against row. Pull-to-refresh. S80 hotfix (`5425130`) closed render-state coherence on board-subject toggle via fetchSeqRef + synchronous onSelectBoard/onSelectSubject handlers. |
| Activity screen | ✓ Live data | Health Connect wired end-to-end. 10s `useFocusEffect` poll. `onCompleteChallenge` REWRITTEN 31b: 6 direct Supabase writes → 1 `POST /me/challenge-complete` via `lib/challengeApi.js`. Pre-state snapshot for rollback. Optimistic UI applied immediately, reverted on failure, refreshed from backend response on success. Auto-complete cascade Easy → Med → Hard. DB-level idempotency via `player_challenges` UNIQUE inside backend tx. `challengesLoaded` gate. Real weekly chart with bone today-bar + Claim-red SVG trend curve. `DEV_MODE_MANUAL` flag (currently FALSE). **(S51)** Refactored to import `STEPS_READ_PERM` + `hasForegroundStepsRead` from shared `lib/healthConnect.js`; `activityProducer.onPermissionGranted()` after grant. **(S58/S59)** Post-challenge success branch fires response-side triggers in order: §B-9 streak re-entry Toast → §B-11 grace-day Toast (`grace_day_granted: true`) → §B-10 Level 4 in-app CARD (`leveled_up && level_after === 4`). Rule: response-side trigger ONLY when no push channel exists for the moment. **(Jun 24)** Daily Achievements wired to real data (`GET /me/activity-bests`). **(Jul 3 — 4-axis redesign, ON-DEVICE VERIFIED)** axis chips (March/Range/Drill/Tempo) + explicit "Train X today" commit (AsyncStorage per-day) + weekend Attack Day card via `GET /me/challenges/today`; theme axis armed by default at 00:00, server locks axis on first completion (409 `axis_locked`), Sat/Sun → 403 `weekend_no_challenges`; HC permission banner when kcal/distance grants missing + settings deep-link fallback (`beb7280`/`0b61633`); 401-retry-flood fixed via getTokenRef (`3a97855`). |
| Profile screen | ✓ Live data | POWER + Influence sections. Long-press commander name (1000ms) opens HealthConnectDebug. Logout calls `clearFcmToken` before `signOut`, both now wrapped in Promise.race timeouts (3s/5s respectively). Sign-out completes in 2-3s on device (was hanging for minutes). **(S82 M2)** SETTINGS card now has `AllianceChatPushToggleRow` (Pressable, ON/OFF text indicator on right — Bone when ON, Slate when OFF; optimistic flip with revert on backend failure via `patchAllianceChatPushEnabled` → PATCH /me/alliance-chat-push-enabled). Placed first in the SETTINGS list, above the existing "Notification settings" placeholder row. Supabase select clause extended to include `alliance_chat_push_enabled`. **(Jun 24)** header avatar 72px, tap → expo-image-picker → Clerk `setProfileImage` → `patchMe({avatar_url})`. **(Jun 28–30)** FAKE_LEGACY_TITLES replaced by `<LegacyMedalsSection>` ("HONOR MEDALS" header) — 16 real medals via `GET /legacy/medals`, final designer badge art (`9fc97a9`), earn celebration card + push deep-link to Profile; **Legacy Power now = `calcMedalPower(medals)`** (`a4c0d63`). **(Jul 5)** `ChangePasswordSection` (hidden for SSO-only accounts) + `DeleteAccountSection` (type-username confirm modal → `DELETE /me/account` → signOut). |
| Alliance screen | ✓ Live data | MemberContent + NonMemberContent on live backend reads. Real roster, role badges, headers. Loading + error + retry states. Leave flow (3 confirm cases). Member-management full-screen confirm view (PROMOTE/DEMOTE/TRANSFER ALLIANCE/KICK/CANCEL). Canonical `getTokenRef` pattern. Transfer Alliance row has TYPE-TRANSFER text-gate. **(S56)** Inline "Alliance messages" wire section — 320px terminal-aesthetic container with "▌ LIVE" header, 6 styled alliance-lifecycle renderers, backed by `GET /alliances/:id/activity-log`. **(Jun 30–Jul 1)** roster row tap → PublicProfile (read-only); long-press a manageable member → the existing kick/promote/demote modal (deliberately restored `16232a4` — modal stays the single management surface). **(Jul 1)** Founder-only green "Command Post" entry button above War Room. |
| Activity Log screen | ✓ Live data | **(S55)** Full player feed: FlatList cursor pagination against `GET /me/activity-log`, per-event renderer matrix in `components/ActivityLogEvent.js` (incl. S59 `LeveledUpRow`), mark-read on mount. Also the DEFAULT_ROUTE target for unknown push kinds (forward-compat verified S61b). |
| War Room screen | ✓ Live data | **(REWORKED Jul 7 — abilities now functional, pending rebuild + on-device)** 5 abilities (Unified Front REMOVED). Panel driven by `GET /alliances/:id/abilities` (server-authoritative costs, active-buff countdown, cooldown countdown on the button, Supply Line used-this-week / resets-Monday, window chips SAT–SUN / MON–FRI 1×/WEEK). ACTIVATE → `POST /alliances/:id/abilities/:ability/activate` (no client cost; **Founder + Marshal** via server `can_manage`), replaces the old `deduct_alliance_morale` RPC / `spendAllianceMorale`. Error alerts map server reject codes (morale/cooldown/week/window). **Attack Day countdown card is now REAL** — counts to next Sat/Sun 05:00 (labelled TODAY/SATURDAY/SUNDAY), flips to a LIVE state (claim accent, counts to 23:00 close) during the weekend window; mirrors the 05:00–23:00 backend contest hours. Countdown units localised (en D/H/M, ru Д/Ч/М). |
| Wallet screen | ✓ Live data | 4-resource view. Morale row → donate modal → `donateMorale` (`lib/allianceApi.js`) → `POST /alliances/:id/morale/donate` (the `donate_morale` RPC was dropped Jun 24, RLS Phase 2). |
| Onboarding screen | ✓ Live data | **(REORDERED Jun 24 — value-first)** trimmed to 3 account-bound steps (permissions → home pin → payoff); intro/pitch moved to pre-auth WelcomeScreen. Home-pin map centers on device location + pre-drops pin; save validates backend-resolved `home_city` and blocks with "Not live here yet" outside live realms; payoff shows real city + real `unclaimed_nearby` count (returned by setHomePin, 2km radius). Location-denial recovery (Open settings / Try again). Funnel `logDebug` events across the whole flow. |
| Welcome screen | ✓ Branded | **(NEW Jun 24)** Pre-auth pitch: intro typewriter (tap-to-skip) + how-it-works, "Get started" → SignIn (signup mode) + persistent "Already have an account? Sign in". AuthGate routes unauthenticated users here. |
| Sign In screen | ✓ Live data | DOMINIA wordmark + ▪ claim mark. **(Jun 24)** "Continue with Google" primary button (`useSSO().startSSOFlow`) — **code only; needs Clerk-dashboard Google connection + rebuild for `scheme:'dominia'`**; Clerk email-code verification step; routing delegated to AuthGate; reads `route.params.mode`. **(Jul 5)** "Forgot password?" link. Client-side password length guards (`5adb49c`, min 8 / max 72 via `lib/passwordPolicy.js`). |
| Forgot Password screen | ✓ Live data | **(NEW Jul 5, pending rebuild + on-device test)** Clerk custom flow: email → `reset_password_email_code` → code + new password → session. No backend/email service — Clerk sends reset emails. |
| Username screen | ✓ Live data | 2–20 chars `[a-zA-Z0-9._]`, stored UPPERCASE (autoCapitalize=characters). **(Jun 24 + Jul 3)** debounced live availability via `GET /me/username-available` (Checking/Available/Taken inline states, Next gated on available); "taken" only on real 409. |
| Public Profile screen | ✓ Live data | **(NEW Jun 30, on-device verified Jul 1)** Read-only `PublicProfileScreen` — tap a player anywhere (chat, leaderboards, roster, home bases) → profile. Mobile-only: direct Supabase reads by player id + `GET /players/:id/legacy/medals`. WarRoom rows not yet wired. |
| Command Post screen | ✓ Live data | **(NEW Jul 1, pending on-device smoke)** Founder-only retention surface: Lapse Radar, Roster Readiness (readiness\|steps sort), Week in Review card w/ RN Share. `lib/commandPostApi.js` → `GET /alliances/:id/command-post` + `/week-in-review` (server-enforced founder gate). Refetch-loop + stuck-spinner fixed (`cdabb09`/`ae14f43`). |
| Active Claim screen | ✓ Branded | (S38) Progress ring race FIXED in `lib/claimState.js`. TaskManager-owned distance loop (screen is pure consumer of `claimState`). `DIAG_CALIBRATION` writes to debug_events per tick. **(S65b) Contest mode rewritten:** owns the `lib/contestWalk.js` producer; a 30s window aggregator feeds `enqueueSample` on each HC tick; `producer.onResolved` navigates to ContestResultScreen with envelope-mapped params; `producer.onWalkError` does `navigation.reset` to Map with a top-banner toast; the old hardcoded `attack_won` at perimeter is GONE — backend is authoritative on the contest outcome. **(S74 M4)** `role` nav-param now read at mount; defaults to `'attacker'` (MapScreen attacker contest path unchanged); DefenderAcceptScreen passes `role: 'defender'` explicitly. Backend remains role-agnostic from nav-param perspective (server infers from auth+contest participant lookup). |
| HealthConnectDebug screen | ✓ Live data | Hidden. SDK status, permission state, today's steps, raw JSON dump, 7-day breakdown, snapshot to `debug_events`. |
| Claim Success screen | ✓ Live data | **(S64) Cut over to backend authority:** mount `useEffect` calls `completeClaim` (`lib/claimApi.js`) instead of 5 direct Supabase writes; renders backend-authoritative envelope (xp/gold/level/streak/resources); `already_completed=true` suppresses delta animations; per-code error UX with retry for retry-eligible codes; `formulas.js` + `supabase` imports removed entirely. Smoke-verified happy path on nish_s (S64). |
| Contest Result screen | ✓ Live data | **(S65b) PURE DISPLAY** — reads `{outcome, role, resourcesAwarded, xpGained, balances, leveledUp, firstContestWin}` from nav params; derives the 4-state STATE_CONFIG key via `mobileStateFromOutcome` (`lib/contestResultHelpers.js`, which bridges backend 2-state `attacker_won`/`defender_won` to mobile 4-state). NO Supabase territory flip, NO reward writes, NO `formulas.js`. **(S74 M4)** All four branches now wired: attack_won + attack_lost + defence_won + defence_lost. Reads role-appropriate fields from the symmetric `WalkResolvedResult` envelope per Q-M4-D (both `attacker_walked_m` and `defender_walked_m` always present; `resources_awarded` same shape regardless of outcome). `earnedBeat` shows STONE for defender vs IRON for attacker (per `formulas.js`: `defence_win: { iron:0, stone:20, gold:15, morale:8 }` vs `contest_win: { iron:15, stone:0, gold:25, morale:8 }`). `firstDefenceWin` plumbing DEFERRED — pre-existing `firstContestWin` TODO at L131-134 voids the field downstream; carry-forward `B-S74-X-first-defence-win-plumbing`. Smoke pending (S75). |
| Defender Accept screen | ✓ Live data | **(NEW S74 M2, commit `0111011`)** `DefenderAcceptScreen` — entry surface for the defender side of the contest lifecycle. Receives `{ contestId }` only as nav-param (Q-M-B contract); fetches 16-field preview on mount via `GET /contests/:id/defend-preview` (`lib/defenderApi.js getDefendPreview`); renders attacker username, territory, attacker progress %, required defender walk_m at both ratios (1.00 with stone / 1.25 without), current stone balance, cutoff timer. Stone toggle is a Pressable with Unicode markers (no `react-native` Switch precedent in repo per Q-M-F). On ACCEPT: POST `/contests/:id/defend` via `lib/defenderApi.js acceptDefend`; per-code error UX over 8 backend defend error codes (`contest_not_found`, `not_active`, `contest_already_defended`, `contest_too_advanced`, `not_authorised_defender`, `outside_defend_hours`, `insufficient_stone`, `invalid_body`); on success navigates to ActiveClaimScreen with `{ role: 'defender', contestId, required_walk_m: floor(selectedRatio × attacker_walked_m), iron_balance_after: null }`. **Snapshot defender threshold at accept-time** (Q-M-H) — not dynamic; carry-forward `B-S73-X-defender-threshold-display-policy` tracks the H3 dynamic-update slice. Already-defended (200 payload, `defender_player_id` non-null) and past-cutoff (200 payload, `already_past_cutoff: true`) render terminal states from preview, not from 4xx. Smoke pending (S75). |
| Defender flow | ✓ Live data | **(S74) SHIPPED-PENDING-SMOKE.** Full lifecycle wired across backend G1–G5 (S69–S72) and mobile M1–M4 (S73–S74). DefenderAcceptScreen + `lib/defenderApi.js` (M1) + push deep-link infra via `extractParams` in `lib/notifications/route.js` (M3) + role plumbing through ActiveClaimScreen + ContestResultScreen defender branches (M4). Foundational invariant: push is the only defender activation surface; `attacker_first_walk_at` always non-null by the time any defender enters the lifecycle (locked design invariant #1). Device smoke deferred to S75. |
| Create Alliance screen | ✓ Live data | 3-step founding wizard wired to POST /alliances/found. Body is `{full_name, short_name, hq_territory_id}`. Confirm step reads city from `player.home_city`. Short_name Supabase pre-check (silent fail-open). Inline error mapping for 8 backend codes. Navigates with only `{ allianceId }`. |
| Alliance Joined screen | ✓ Live data | (S37) Now context-aware: reads `context` from route.params. Conditional kicker ('Alliance joined' vs 'Alliance founded'), conditional subtitle ("You're no longer alone on this map." vs "Ready for war."), conditional benefits list (BENEFITS_FOUNDED vs BENEFITS_JOINED). Create flow passes no context → falls through to founded copy. Join flow passes `context: 'joined'`. Single screen, two copy paths. Still fetches by allianceId on mount via `getAllianceById`. Three render states (loading spinner / error+retry / loaded). Uses `getTokenRef` pattern. |
| AuthGate | ✓ Done | Checks isSignedIn + has_onboarded. **(S53, D5)** FCM registration REMOVED — AuthGate is navigation-only; `FcmLifecycle` owns all FCM concerns. **(Jun 24)** gates on idempotent `POST /me/bootstrap` instead of a direct Supabase players read (kills the "ACCOUNT NOT FOUND" new-signup race); routes unauthenticated → Welcome; "Waking the server…" message after 4s (Railway cold start). |
| Permissions | ~ Partial | Inline in onboarding step 2 — not a standalone screen |
| Territory Detail (full screen) | ○ Not built | Currently a bottom sheet inside map. |
| Abandon flow | ○ Not built | Currently just an alert. |

---

## KEY FILES — MOBILE

| File | Purpose |
|---|---|
| `App.js` | Root stack navigator, font loading, ClerkProvider, all screen registrations. **(S51)** `<ActivitySyncLifecycle />` inside `<ClerkProvider>`. **(S53)** `navigationRef` + `<FcmLifecycle />` + `<NotificationCard />` + `<Toast />` mounted inside `<ClerkProvider>`. **(S58)** `<StreakBreakLifecycle />` mounted. **(S80)** `Stack.Screen name="Leaderboards"` registered. **(S82 M1)** `Stack.Screen name="Chat"` registered. |
| `components/ChatSideRail.js` | **(NEW S82 M1)** Parallel to LeaderboardsSideRail + ActivityLogSideRail per Q-M1-A. Position `right: 12`, `bottom: tabBarHeight + 132` (3rd rail up). `useFocusEffect` calls `getRooms` then sums `unread_count` across all rooms; label `CHAT` / `CHAT · N` / `CHAT · 99+` (mirrors ActivityLogSideRail). Press → `navigation.navigate('Chat')`. Same Ink-2 #1A1D24 surface + Geist Mono 500 11px label as the other rails. |
| `screens/ChatScreen.js` | **(NEW S82 M1+M2)** See SCREENS table for full details. M2 owns the composer + optimistic insert + Ably subscription + banner + push deep-link `route.params.initialTab`. The single `lastObservedByRoom` ref captures `{lastReadMessageId, observedAt}` per visited room and patches read-state on navigation `blur`. Cleanup unsubscribes all Ably channels + closes the singleton on unmount. |
| `lib/chatApi.js` | **(NEW S82 M1, extended M2)** Mirrors `lib/leaderboardApi.js` performLeaderboardRequest pattern verbatim — `{ok:true, data}` / `{ok:false, status, code, context}` discriminant; 15s `AbortController`; `Connection: close`; snake_case wire format passed through to screen layer (no camelCase conversion). Exports: `getRooms` (GET /chat/rooms) · `getMessages({roomId, beforeCursor, limit})` (GET /chat/rooms/:room_id/messages?before&limit, query params via URLSearchParams) · `patchReadState({roomId, lastReadMessageId, lastReadAt})` (PATCH /chat/rooms/:room_id/read-state) · `getAblyToken` (POST /chat/ably-token) · **M2:** `postMessage({roomId, content})` (POST /chat/rooms/:room_id/messages) · `patchAllianceChatPushEnabled({enabled})` (PATCH /me/alliance-chat-push-enabled, boolean-coerced body). |
| `lib/chatRealtime.js` | **(NEW S82 M2)** Ably realtime client wrapper. `connectChatRealtime({clerkGetToken})` fetches a token via `getAblyToken`, instantiates `Ably.Realtime` with an `authCallback` for token refresh on expiry (calls getAblyToken again, returns `data.token_request`), seeds initial token. `subscribeToChannel(realtime, channelName, onMessage)` returns an unsubscribe closure that handles unmount cleanup. `disconnectChatRealtime()` closes the module-singleton realtime. Pure JS — no native module. |
| `lib/__tests__/chatApi.test.js` | **(NEW S82 M1, extended M2)** 24 Jest tests (8 from M1, 8 added in M2, 4 in `patchAllianceChatPushEnabled` + `postMessage` happy/error). `fs.readFileSync` + `new Function` loader pattern (S65b precedent) with `jest.fn()` for `global.fetch` — zero-mocks of imports per Q-L. Covers: getRooms (URL, envelope, no_token), getMessages (URL+query, snake_case passthrough, error preservation), patchReadState (PATCH method + body shape, null fallback), getAblyToken (POST + envelope, 404), postMessage (201 + 5 error discriminants: message_filtered, chat_muted, rate_limited, room_access_forbidden, invalid_content), patchAllianceChatPushEnabled (boolean coercion), network behaviour (TypeError, AbortError, unparseable JSON, non-2xx without error field). |
| `lib/notifications/route.js` | **(S53/S57–S60/S74/S82)** D1 routing table: pure `routeForPush(kind, data)` → `{ surface, target, kind, params }`. **20 entries** as of S82. **(S82 M2)** Adds `chat_alliance_message` entry: surface TOAST, target `Chat`, `extractParams: (data) => ({ initialTab: 'alliance', roomId: data?.room_id ?? null })`. Mobile ChatScreen reads `route.params.initialTab` on mount. Backend `chat-push.composer.ts` sends `kind: 'chat_alliance_message'` + `data: { room_id, message_id, sender_id, alliance_short_name, kind }`. |
| `lib/notifications/__tests__/route.test.js` | **(S74, extended S82)** Now 21 tests. **(S82)** Added chat_alliance_message block (4: routes to Chat with initialTab alliance plus roomId, missing room_id yields null, null data yields null, kind preserved). |
| `screens/ProfileScreen.js` | POWER + Influence sections. **(S82 M2)** SETTINGS card now has `AllianceChatPushToggleRow` (defined in same file) — Pressable mirroring SettingsRow shape with right-aligned ON/OFF text in Bone/Slate per state; optimistic toggle reverts on backend failure via `patchAllianceChatPushEnabled`. Placed first in SETTINGS list above Notification settings placeholder. Supabase select extended to include `alliance_chat_push_enabled`. Long-press commander name → HealthConnectDebug. Calls `clearFcmToken` then `signOut` on logout (order matters; see Decision Log: FCM auth-teardown ordering). |
| `screens/MapScreen.js` | PostGIS viewport fetch via RPC. Feature cache + merge-on-fetch + age-gated abort. (S37/S64/S65b/S80 noted above). **(S82 M1)** `<ChatSideRail hidden={selected != null} />` rendered above LeaderboardsSideRail + ActivityLogSideRail. Three rails stack right-aligned at `bottom: tabBarHeight + {12, 72, 132}`. |
| `index.js` | **(S53)** `setBackgroundMessageHandler` no-op at boot (silences "no background handler" warning; B-S53-3 tracks future AsyncStorage replay). |
| `components/AuthGate.js` | Checks isSignedIn + has_onboarded. **(S53, D5)** FCM registration REMOVED — navigation-only. Its parameterless `navigation.replace('MainTabs')` is the race partner the S61a `navigateToAfterAuthGate` deferral was built against. |
| `components/FcmLifecycle.js` | **(S53)** Null-render component owning ALL FCM concerns: registration, `onTokenRefresh` cleanup (`useRef` pattern for getToken), and 3 push handlers — Effect 3 foreground `onMessage`, Effect 4 background tap `onNotificationOpenedApp`, Effect 5 killed-state `getInitialNotification`. **(S61a)** Effect 5 calls `navigateToAfterAuthGate` (not `navigateTo`) to survive the AuthGate replace race. |
| `components/notifications/NotificationCard.js` | **(S53/S55)** Full-screen modal subscribed to `cardController`; foreground tap → route nav (S55 fix). `DEFAULT_TITLES` safety-net map (15 entries post-S60). FCM-delivered cards use payload `notification.*` fields; locally-invoked cards (L4 level-up, §B-8 break confirmation) control `data` fully. |
| `components/StreakBreakLifecycle.js` | **(S58)** §B-8 break confirmation: cold-start + AppState 'active' re-fetch of `GET /me/streak-break-status`, nav-route-gate, acknowledge POST on dismiss via cardController `onDismiss`. Known: fires 401 `no_token` on cold start before Clerk ready (B-S61-X1); nav-listener cleanup style differs from `lib/navigation.js` (B-S58-Q2). |
| `components/ActivityLogEvent.js` | **(S55/S59)** Per-event-type renderer matrix for the feed (styled rows + stubs; `LeveledUpRow` inline after `StreakMilestoneRow`, hero=level_after, accent CLAIM). `getMeta(event, ...keys)` dual-fallback absorbs camelCase/snake_case emitter drift. Header comment count is one off (B-S59-X2, doc nit). |
| `lib/navigation.js` | **(S53/S61a)** `navigationRef` + `navigateTo` + `onNavigationReady` with `pendingTarget` + state-listener deferral machinery (`tryDispatch` / `armStateListener` lifted to module scope in S61a). **(S61a)** `navigateToAfterAuthGate()` — defers killed-state push routing until current root route is MainTabs, eliminating the AuthGate replace clobber window. |
| `lib/notifications/route.js` | **(S53/S57–S60/S74)** D1 routing table: pure `routeForPush(kind, data)` → `{ surface, target, kind, params }`. 19 entries; `defender_notify` retargeted from WarRoom → `'DefenderAccept'` in S74 M3. **(S74 M3)** Adds `extractParams(data)` declaration per entry — the single source of truth for push payload → nav-params mapping. Backend `baseData` uses **camelCase** (verified from `contest-walk.service.ts` L218/L642-645), so `defender_notify` extractParams is `(data) => ({ contestId: data?.contestId })` (corrected at Q-M3-A from the original snake_case Q-M-B lock). Kinds without `extractParams` default to `params: {}` (backward compat). Unknown kinds fall to DEFAULT_ROUTE (toast + ActivityLog). **Audit this file before constructing any push test — never guess kind names.** Locked design invariant #10 (DEFENDER_ROADMAP.md). |
| `lib/notifications/__tests__/route.test.js` | **(NEW S74 M3)** 17 tests covering `routeForPush(kind, data)` envelope shape, `extractParams` invocation per entry, defender_notify camelCase pass-through, missing-data graceful fallback, unknown-kind DEFAULT_ROUTE behaviour. Closes the previously-zero test gap on the routing table; carry-forward `B-S74-X-lib-notifications-test-gap-closure` still tracks broader cardController/lifecycle tests. |
| `lib/defenderApi.js` | **(NEW S74 M1, commit `eaa9604`)** Clerk-authed wrappers for the defender backend surface — `getDefendPreview(contestId)` against `GET /contests/:id/defend-preview` (returns 16-field envelope), `acceptDefend(contestId, body)` against `POST /contests/:id/defend`. Canonical `{ok, status, code, context}` discriminant matching `claimApi.js`/`contestWalkApi.js`/`streakBreakApi.js`. Sibling-precedent pattern; no new deps. Tests in `lib/__tests__/defenderApi.test.js` (covered in M1 add). |
| `screens/DefenderAcceptScreen.js` | **(NEW S74 M2, commit `0111011`)** See SCREENS table for full details. Receives `{ contestId }` only as nav-param (Q-M-B locked contract); fetches preview on mount; stone toggle (Pressable + Unicode markers); 8 error-code UX paths; navigates ActiveClaimScreen with `{ role: 'defender', contestId, required_walk_m, iron_balance_after: null }` on POST /defend success. |
| `lib/contestResultHelpers.js` | (S65b) `mobileStateFromOutcome(outcome, role)` — pure bridge from backend 2-state (`attacker_won`/`defender_won`) to mobile 4-state STATE_CONFIG key (`attack_won`/`attack_lost`/`defence_won`/`defence_lost`). CJS sibling tested via normal `require()` (no ESM loader hack). **(S74 M4)** All four states now exercised by ContestResultScreen; defender branches read symmetric `WalkResolvedResult` envelope fields. |
| `screens/ContestResultScreen.js` | (S65b/S74 M4) Pure-display result screen. **(S74 M4)** Defender branches now rendered: `defence_won` (STONE earned-beat per `defence_win: { iron:0, stone:20, gold:15, morale:8 }`) and `defence_lost`. `firstDefenceWin` plumbing deferred — pre-existing TODO at L131-134 voids the `firstContestWin` field downstream so the defender analog rides the same TODO closure (carry-forward `B-S74-X-first-defence-win-plumbing`). |
| `lib/notifications/cardController.js` | **(S53/S58)** Imperative singleton: `showCard` / `hideCard` / `subscribe`; `hideCard` takes optional `onDismiss` callback (S58). |
| `screens/ActivityLogScreen.js` | **(S55)** Player feed screen: FlatList cursor pagination, mark-read on mount. |
| `lib/streakBreakApi.js` | **(S58)** Clerk-authed wrappers for streak-break status + acknowledge endpoints, canonical `{ok, data}` discriminant. |
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
| `lib/healthConnect.js` | **(NEW S51)** Single source of truth for Health Connect permission descriptor + grant filtering. Exports `STEPS_READ_PERM`, `hasForegroundStepsRead`, `hasBackgroundStepsRead`. Used by `lib/activity.js`, `screens/ActivityScreen.js`, `screens/HealthConnectDebugScreen.js`. K.7 extraction — eliminated 3-copy drift across screens + producer. |
| `lib/activity.helpers.js` | **(NEW S51)** 7 pure helpers: `formatHexAsUuid`, `alignToMinute`, `buildSampleFromBucket` (returns null on zero-step buckets per R.7), `evictOldestIfOverCap`, `shouldFlush`, `buildPostBody` (ms→ISO conversion + 100-sample batch cap per R.4 + S51-scope `kcal`/`avgGpsSpeedMs` omission), `mergeRehydratedState` (Q-F.6 playerId-match account-switch safety). CommonJS, side-effect-free, no native imports. |
| `lib/__tests__/activity.helpers.test.js` | **(NEW S51)** 63 unit tests across all 7 helpers. Zero `jest.mock`, zero native-module imports, runs under Jest `testEnvironment: 'node'`. Combined with `formulas.test.js` (348) + S65b contest/claim tests (40) = **451 total green, zero flake**. |
| `lib/activityApi.js` | **(NEW S51)** `postActivitySteps({clerkGetToken, samples})` wrapper. 15s `AbortController` timeout. Single targeted retry: 401 → fresh JWT no delay; 5xx/network/timeout → 1s delay; other 4xx → terminal drop with error log. Never throws. Returns Q-G discriminated union `{ok:true, data} \| {ok:false, status, error, retryable}`. `Connection: close` header preserved. Single-in-flight enforcement lives in producer not wrapper. |
| `lib/activity.js` | **(NEW S51, ~310 lines)** Module-level mutable state producer mirroring `lib/claimState.js` exactly. Public API: `start(playerId, getToken)`, `stop()`, `onAppStateChange(nextState)`, `onNetworkChange({isConnected})`, `onPermissionGranted()`, `flushNow()` (Promise<void>, in-flight dedup, exposed for Slice 7), `getBufferSize()`. HC integration via `aggregateGroupByDuration` with `{duration:'MINUTES', length:1}` slicer (Q-C). sourceId via `Crypto.digestStringAsync(SHA-256, "${playerId}\|${start}\|${end}")` formatted 8-4-4-4-12 (Q-D). AsyncStorage buffer key `'dominia.activity.buffer.v1'`, cap 1000 FIFO (Q-F). Seven flush triggers: periodic 2min, background, foreground-after-5min-inactive, network-restored (gated on lastFlushFailed), buffer-full=100, startup-drain, manual `flushNow`. Pre-flush guard skips offline. Recovery sweep capped 6h back (R.5); cold-start first-collection = 5min back (R.6). Logging per Q-N (`[activity.producer]` + `[activity.api]` tags, key=value). |
| `components/ActivitySyncLifecycle.js` | **(NEW S51)** Null-render component mounted in `App.js` inside `<ClerkProvider>`, sibling of `<NavigationContainer>` (Q-I.1). Resolves playerId + has_onboarded via Supabase (mirrors `AuthGate.js` exactly). Gates `producer.start()` on `isLoaded && isSignedIn && userId && playerId && hasOnboarded`. Hosts `AppState` + `NetInfo` listeners that dispatch to producer methods. NetInfo seed via `NetInfo.fetch()` immediately after start (Q-J.6). Cleans up on sign-out via captured `appStateSub.remove()` + `netInfoUnsub()` + `producer.stop()`. **(S52a `9c97fe7`)** Effect 2 race fix (B13): `getToken` stashed in `useRef`, dropped from Effect 2 deps; producer reads ref at flush time. |
| `lib/challengeApi.js` | (31b) `completeChallenge({clerkGetToken, challengeKey, tier, earnKey})` → `POST /me/challenge-complete`. Mirrors `lib/fcm.js` pattern. Clerk-authed. Forces `Connection: close`. Never throws — returns `{ok, data} \| {ok:false, status, error}`. Single-shot (no retry); failed POST reverts optimistic UI in ActivityScreen. Sends lowercase `tier` (`easy`/`medium`/`hard`), NOT TitleCase `ch.difficulty`. |
| `lib/allianceApi.js` | (32–38) `getMyAlliance`, `getAllianceById`, `foundAlliance`, `joinAlliance`, `leaveAlliance`, `kickMember`, `promoteMember`, `demoteMember`, `transferFounder` (S38). All Clerk-authed, `Connection: 'close'` header, `{ ok, data \| error }` discriminant, never throw. Canonical pattern mirroring `lib/challengeApi.js`. |
| `lib/alliancePermissions.js` | (36, 38) Pure JS port of backend `membership.helpers.ts` — `ROLE_RANK`, `ROLE_SLOTS`, `canKick`, `canPromote`, `canDemote`, `canTransferFounder` (S38), plus `getAvailableActions()` helper that returns all valid actions for an actor-target pair. Action ordering: promote → demote → transfer_founder → kick (ascending in irreversibility). Used by AllianceScreen's manage-member UI to decide whether a roster row is tappable. |
| `lib/homePinApi.js` | (33) `setHomePin` via `POST /me/home-pin`. Returns `{ home_timezone, home_city }`. Mobile reads home_timezone but still ignores home_city (UI deferred). |
| `lib/fcm.js` | `registerFcmToken`, `clearFcmToken`, `patchFcmToken` + **(S53)** v23 modular wrappers `onForegroundMessage`, `onBackgroundTap`, `getInitialPushPayload`. All errors caught + logged, never thrown. `patchFcmToken` sends `Connection: close`; `clearFcmToken` raced against 3s timeout. Note: `getInitialPushPayload` returns null in Metro dev mode (bundle race) — killed-state paths verify only on release-mode EAS builds. |
| `metro.config.js` | react-dom shim for @clerk/clerk-react bundling |
| `shims/react-dom-shim.js` | Empty module.exports shim |
| `plugins/withHealthConnect.js` | Custom Expo config plugin. Injects `HealthConnectPermissionDelegate.setPermissionDelegate(this)` into MainActivity.kt onCreate. Anchor regex `/super\.onCreate\(.+?\)/` matches both `savedInstanceState` and `null` forms. Re-check anchor every Expo SDK upgrade. |
| `screens/MapScreen.js` | PostGIS viewport fetch via RPC. Feature cache + merge-on-fetch + age-gated abort. Diagnostic `[vp fetch]` logs. (S37) `useFocusEffect` calls `fetchPlayer`; alliance_id transition refetch. **(S64)** `handleAcceptClaim` calls `startClaim` (no direct Supabase deduct); `useAuth().getToken` via `getTokenRef`; `startError {code, context, status}` object; per-code error rendering on confirm sheet + live countdown ticker. **(S65b)** `handleAcceptContest` calls `startContest` (no direct iron UPDATE); pessimistic local state + iron pre-check retained; 3-tier error UX (inline-in-sheet / topBanner 5s auto-dismiss / `contest_already_active` 409 info card); navigates with backend `required_walk_m` + `contest_id` + `attacker_alliance_id` + `iron_balance_after`; `topBannerMessage` nav-param effect surfaces walk-error exit toasts from ActiveClaim. |
| `screens/ActiveClaimScreen.js` | TaskManager-owned 10s claim loop. Rehydrate-vs-startClaim race fixed at `lib/claimState.js`. `DIAG_CALIBRATION` default true. **(S64)** route.params extended with `goldPaid` + `freeClaim`, forwarded to ClaimSuccessScreen. **(S65b)** Contest mode rewritten: owns the `lib/contestWalk.js` producer; 30s window aggregator on HC tick drives `enqueueSample`; `producer.onResolved` → ContestResultScreen with Q-mobile-E nav params (`env.player_resources.{iron,stone,gold,morale}`, `env.total_xp`, `env.level_after`); `producer.onWalkError` → `navigation.reset` to Map with toast; hardcoded `attack_won` at perimeter removed. |
| `screens/ClaimSuccessScreen.js` | **(S64)** Mount `useEffect` calls `completeClaim` (`lib/claimApi.js`) instead of 5 Supabase writes; envelope state replaces goldEarned/xpEarned null-gating; per-code error UX with retry for `intent_not_found`/`network_error`/`unknown_error`; `already_completed=true` suppresses beat animations; `formulas.js` + `supabase` imports removed entirely. **(S65b)** 4 dev test buttons updated to the new contest nav-param shape (`{outcome, role, resourcesAwarded, xpGained, balances, leveledUp, firstContestWin}`). |
| `screens/ContestResultScreen.js` | **(S65b) PURE DISPLAY.** Reads `outcome` + `role` from nav params; derives stateKey via `mobileStateFromOutcome`; renders resourcesAwarded + xpGained + distance comparison. No `supabase`, no `formulas.js` imports. |
| `lib/claimApi.js` | **(NEW S64)** Never-throws wrapper for the two-phase claim. `startClaim` + `completeClaim`, both returning the parsed `{ ok, status, code, context }` shape (diverges from challengeApi.js raw-body shape — sets the §B-15 retrofit precedent). Six failure paths handled; shared `performClaimRequest` helper. ⚠️ Production-critical never-throws contract but has NO tests yet (B-S65b-X-claim-api-untested). |
| `lib/contestWalkApi.js` | **(NEW S65b)** Never-throws API wrapper mirroring `claimApi.js` parsed shape. `startContest` (create endpoint) + `postContestSamples` (`/contests/:id/walk` batch). 13 startContest + 6 walk typed error codes. 26 tests (`lib/__tests__/contestWalkApi.test.js`, ESM via `fs.readFileSync` + `new Function` loader). |
| `lib/contestWalk.js` | **(NEW S65b)** Module-singleton walk-sample producer (foreground-only, screen-scoped — distinct from `lib/activity.js`). Public API: `start`/`stop`/`enqueueSample`/`flushNow`/`onAppStateChange`/`getCumulativeDistance`/`getBufferSize` + `onResolved`/`onWalkError` callbacks. 30s cadence + immediate `flushNow` on client-detected threshold; 100-cap buffer; in-memory only (no AsyncStorage — 30s max loss on app kill, persistence deferred to Resume-UX slice). `sourceId = SHA-256(playerId\|contestId\|windowStartMs\|windowEndMs)` batched in `flushNow` via `Promise.all` (race-fix: buffer holds raw shape, hashing deferred to flush so `enqueueSample` stays sync). 10 tests. |
| `lib/contestResultHelpers.js` | **(NEW S65b, CJS)** `mobileStateFromOutcome({outcome, role})` → 4-state mobile STATE_CONFIG key. Bridges backend 2-state (`attacker_won`/`defender_won`) to mobile 4-state (`attack_won`/`defend_won`/`attack_lost`/`defend_lost`). Plain CJS so it's `require()`-testable (4 tests). |
| `screens/ActivityScreen.js` | (MODIFIED 31b) `onCompleteChallenge` body: pre-state snapshot → optimistic UI → `completeChallenge()` POST → revert on failure / refresh from backend on success. HC wired. 10s `useFocusEffect` poll. Auto-complete cascade. `challengesLoaded` boolean gates watcher. `DEV_MODE_MANUAL` (currently FALSE) gates COMPLETE buttons. Real 7-day weekly chart with SVG trend curve. **(S63)** Single-line `await activityProducer.flushNow()` inserted immediately BEFORE `backendCompleteChallenge` inside the existing defensive try block (the single CC funnel covers both the auto-complete useEffect AND the manual button) — flushes pending step samples so the backend CC enforcement (S62) reads fresh `daily_steps` and doesn't false-reject on a stale aggregate within the 2-min producer cadence. `flushNow` is non-throwing (R.3). |
| `screens/ProfileScreen.js` | POWER + Influence sections. Long-press commander name → HealthConnectDebug. Calls `clearFcmToken` then `signOut` on logout (order matters; see Decision Log: FCM auth-teardown ordering). (S37) Logout handler now races `signOut()` against a 5s timeout; `clearFcmToken` still called first to preserve JWT ordering. Sign-out completes in 2-3s on device. |
| `screens/AllianceScreen.js` | (32–38) MemberContent + NonMemberContent fully live. MemberContent: real roster via `GET /me/alliance` + `GET /alliances/:id`, role badges, loading/error/retry states. Leave flow with 3 confirm cases (non-founder, founder-blocked, founder-disband). Member-management full-screen confirm view with flat-list action picker (PROMOTE/DEMOTE/TRANSFER ALLIANCE/KICK). Server-confirmed updates via `onRefreshAfterLeave` callback. NonMemberContent: browse list filters on `.is('disbanded_at', null)` + `.eq('city', playerHomeCity)`, join flow via `POST /alliances/:id/join` with inline error mapping. Canonical `getTokenRef` pattern (Clerk getToken is a new ref every render — captured once). (S37) `handleConfirmJoin` now `navigation.navigate('AllianceJoined', { allianceId, context: 'joined' })` on success. (S38) TRANSFER ALLIANCE action row visible only to Founder when target is Marshal or Officer. Destructive styling. In-screen confirm view (reuses manage-confirm pattern, no new screen file) with TextInput requiring exact-match "TRANSFER" (case-sensitive) to enable confirm. Error mapping for all 4 status codes (400/403/404/500). |
| `screens/WarRoomScreen.js` | **(Jul 7)** 5 abilities (Unified Front removed); ability panel + Activate buttons driven by `GET /alliances/:id/abilities`; live cooldown/active/attack-day countdowns off a 10s `nowMs` tick; `nextAttackWindow` + `formatDayCountdown` compute the real Attack Day card; `activateAllianceAbility`/`getAllianceAbilities` from `lib/allianceApi.js` (old `spendAllianceMorale` removed). |
| `screens/WalletScreen.js` | 4 resources. Morale row → donate modal → `donateMorale` (`lib/allianceApi.js`) → `POST /alliances/:id/morale/donate` (RPC dropped Jun 24). |
| `screens/SignInScreen.js`, `UsernameScreen.js` | Fully branded. |
| `screens/OnboardingScreen.js` | (33) Uses `setHomePin` from `lib/homePinApi.js` (was direct Supabase update). POST /me/home-pin now derives both home_timezone AND home_city automatically. |
| `screens/HealthConnectDebugScreen.js` | Hidden debug screen. SDK status, permission flow, today's steps + 7-day breakdown, snapshot writer. **(S51)** Refactored to import `STEPS_READ_PERM`, `isBackgroundPermission`, `hasForegroundStepsRead`, `hasBackgroundStepsRead` from shared `lib/healthConnect.js`. Foreground + background grant status pills preserved. |
| `screens/CreateAllianceScreen.js` | (32–35) 3-step founding wizard wired to `POST /alliances/found`. Body is `{full_name, short_name, hq_territory_id}`. Confirm step city reads from `player.home_city`. Short_name Supabase pre-check (silent fail-open on network error). Inline error mapping for 8 backend codes. Navigates with only `{ allianceId }` (no display props through nav). |
| `screens/AllianceJoinedScreen.js` | (35, 37) Multi-use: post-create AND post-join landing, switched on `context` route.param. Receives `{ allianceId, context? }`. Calls `getAllianceById(allianceId)` on mount. Three render states (loading spinner in CLAIM colour / error+retry / loaded). Conditional kicker ('Alliance joined' vs 'Alliance founded'), conditional subtitle ("You're no longer alone on this map." vs "Ready for war."), conditional benefits list (BENEFITS_FOUNDED vs BENEFITS_JOINED). Create flow passes no context → isJoined false → founded copy. Uses `getTokenRef` pattern. |
| `app.config.js` | Dynamic config (replaces `app.json`). Expo only expands `process.env` in dynamic configs. `android.googleServicesFile = process.env.GOOGLE_SERVICES_JSON ?? './google-services.json'`. Plugins: expo-location, expo-sensors, expo-build-properties (minSdkVersion 26), `./plugins/withHealthConnect.js`. Android permissions: health.READ_STEPS, ACTIVITY_RECOGNITION, POST_NOTIFICATIONS (Android 13+, runtime). **(S52a `0b3559e`, B15 closed)** `READ_HEALTH_DATA_IN_BACKGROUND` removed — declared but never requested at runtime; cleanup for Play Store policy. First preview build `8d7db4da-2b41-4300-8a72-ae2f5cefa2e2` carried this change. |
| `google-services.json` | GITIGNORED. Firebase Android config. Local copy at `C:\Users\nisha\dominia-secrets\`. Uploaded to EAS as file env var `GOOGLE_SERVICES_JSON` (sensitive). |
| `eas.json` | EAS build profiles. Preview profile: `developmentClient: false` + `MAPBOX_DOWNLOADS_TOKEN` env reference. |
| `android/gradle.properties` | Mapbox download token for builds |
| `.env` | Gitignored |
| `.npmrc` | `legacy-peer-deps=true` for EAS build compatibility |
| `i18n/index.js` + `locales/{en,ru}.json` | (Jun 29) i18next config + all UI strings (709 keys, ru full first pass pending native review). Keys namespaced per screen; count-plurals via `_one`/`_few`/`_many`/`_other`. |
| `lib/meApi.js` + `lib/territoryApi.js` | (Jun 24, RLS Phase 2) bootstrapPlayer / patchMe / pushStrideCalibration / checkUsernameAvailable / deleteAccount + abandon — the backend write path that replaced direct Supabase writes. |
| `lib/avatar.js` | (Jun 24) `avatarThumb(url,size)` (Clerk CDN `?width=` retina) + `avatarInitials(name)`. |
| `components/medals/` + `lib/legacyMedals.js` + `lib/legacyMedalsApi.js` + `lib/medalBadges.js` | (Jun 28–30) Honor Medals UI: LegacyMedalsSection (summary → 2×2 grid → detail modal), MedalIcon via SvgXml final designer art (generated by `scripts/gen-medal-badges.mjs`), TierBars, MedalEarnCard celebration. |
| `screens/PublicProfileScreen.js` | (Jun 30) read-only player profile; watch `git add` — was left untracked once and broke origin/main until `a92c218`. |
| `screens/CommandPostScreen.js` + `lib/commandPostApi.js` | (Jul 1) Founder-only Command Post (3 panels). |
| `lib/allianceEmblems.js` + `lib/homeBases.js` + `lib/battleChips.js` | (Jul 2, Living Map) emblem SVGs (`GLYPHS` map = designer swap point; `emblemXml(key,{glyph,shield,field})` stable contract), level-band base structures (CommonJS so plain-node jest loads it; `BASE_GLYPHS` = designer swap point), battle-chip pure classifier (24h decay). |
| `lib/challengeAxes.js` + `lib/challengesTodayApi.js` | (Jul 3) 4-axis catalog + `GET /me/challenges/today` client (replaced direct Supabase player_challenges read). |
| `components/WalkthroughOverlay.js` + `lib/walkthroughFlags.js` + `lib/resourceIntro.js` | (Jul 4, first-run) walkthrough engine (core Animated — repo has NO reanimated), AsyncStorage fires-once flags + event bridge, earn-moment resource toasts. |
| `screens/WelcomeScreen.js` / `screens/ForgotPasswordScreen.js` / `lib/passwordPolicy.js` | (Jun 24 / Jul 5) pre-auth pitch; Clerk reset-code flow; shared password bounds (8/72). |

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
| `prisma/schema.prisma` | 16 models introspected from live Supabase. PostGIS `geom` as `Unsupported("geometry")`. Includes `activity_samples` (S48) + `claim_intents` (S64). **(S66)** Now drives the isolated test DB via `prisma db push` — schema source of truth for tests. |
| `prisma/migrations-manual/` | Hand-written paired UP/DOWN SQL — `20260531-activity-schema/up.sql` + `down.sql` (S48, folder convention established this slice). Round-trip verified against production Supabase before code merge. |
| `src/server.ts` | Entry point. Side-effect imports boot Firebase + **3 BullMQ workers** as of S82 (contest-expiry, **chat-archive (S82 G4)**, quiet-hours-push). |
| `src/app.ts` | `buildApp()` async factory. Registers all module routes (player, me, alliance, territory, contest-defend, contest-walk, activity, leaderboard, **chat (S82)**, debug). Calls `bootstrapStreakRolloverJobs` + `bootstrapStreakBreakWarningJobs` + **`bootstrapChatArchiveJob` (S82 G4 — registers the `chat-archive-daily-utc` cron with `repeat: { pattern: '0 3 * * *', tz: 'UTC' }`)** after Fastify ready. |
| `src/shared/prisma.ts` | Singleton PrismaClient with `PrismaPg` adapter. globalThis-cached for tsx-watch hot reload. |
| `src/shared/supabase.ts` | Service-role client. Used only by territory GET (PostGIS RPC). |
| `src/shared/auth.ts` | Clerk JWT verification — `requireAuth` Fastify preHandler. Reads `Authorization: Bearer`, calls `verifyToken`, attaches `payload.sub` to `request.clerkUserId`. **Never log token contents.** |
| `src/modules/player/*` | GET/PATCH /me. All Prisma. `PrismaClientKnownRequestError` imported from `@prisma/client/runtime/client` (Prisma 7 subpath). |
| `src/modules/me/home-pin.routes.ts` | (34) POST /me/home-pin. Zod body `{lat: number, lng: number}`. requireAuth. Returns `{ home_timezone, home_city }` (home_city nullable). |
| `src/modules/me/home-pin.service.ts` | (34) `resolveHomeCityFromPin` (PostGIS two-step lookup: ST_Contains on territories.geom → fallback nearest within 10km via ST_DWithin + KNN <-> operator. If both miss, home_city left unchanged). `ensurePostgisSearchPath()` helper using `set_config(..., true)` since Supabase puts PostGIS in the postgis schema. Wraps own `prisma.$transaction` when no tx passed so set_config + lookup share a pinned connection. `setHomePin` writes home_pin_lat/lng/home_timezone/home_city in one transaction. |
| `src/modules/me/fcm-token.*` | PATCH /me/fcm-token. Zod body `{fcm_token: string(1..4096) \| null}`. requireAuth. |
| `src/modules/me/alliance-chat-push.routes.ts` | **(NEW S82, commit `05cd372`)** PATCH /me/alliance-chat-push-enabled. Zod boolean body, requireAuth, getPlayerByClerkId lookup, `prisma.players.update`, P2025 → 404. Returns `{ok:true, alliance_chat_push_enabled: bool}` echo for client confirmation. Handler exported as `handlePatchAllianceChatPushEnabled` for test injection (bypasses requireAuth in tests; pattern matches chat-admin tests). 6 tests. Prerequisite for the M2 settings toggle — discovered missing at M2 audit and shipped inline rather than punted. |
| `src/modules/me/challenge-complete.routes.ts` | (31a) POST /me/challenge-complete. Zod body validates `challenge_key`, `tier` (lowercase enum: easy/medium/hard), `earn_key`. requireAuth. |
| `src/modules/me/challenge-complete.service.ts` | (31a, S43) Orchestrates the entire flow inside ONE `prisma.$transaction`: idempotent player_challenges insert → streak advance → Grace Day grant at days 7/30/60 (capped at 3) → XP via `calcChallengeXp` → resources via `calcResourceEarn` flat table → level via `calcLevel` → single `activity_log` row. **(S43)** After `updatePlayerOnChallengeComplete` returns, checks `isStreakMilestone(newStreak) && snapshot.current_streak < newStreak` — on crossing 7/14/21/30/60/90, calls `grantSiegeXp(tx, playerId, 250)` AFTER the challenge XP increment (so milestone row's `level_before` reflects post-challenge state), then `logStreakMilestone` writes a second activity_log row. Two activity_log rows per milestone-day completion, one per non-milestone. Idempotent via existing `player_challenges` UNIQUE. Returns `{leveled_up, grace_day_granted, ...}`. **(S62 Slice 7)** In-tx CC enforcement guard: placed AFTER the idempotent early-return (so `already_completed` re-POSTs skip enforcement) and BEFORE all grants (so a throw rolls back the `insertPlayerChallenge` row). `getChallengeTypeFromEarnKey(earnKey)` resolves steps/calories; gate reads `daily_steps`/`daily_calories` from the extended snapshot against `STEP_TIER_THRESHOLDS`/`CALORIE_TIER_THRESHOLDS`; on fail throws `ChallengeAggregateUnderThresholdError` → routes map to 403. §13 `capFactor` (from `effectivenessForChallenge`) computed once and threaded through BOTH `calcChallengeXp` and `calcResourceEarn` per §5.6.1 canonical earn. **(S64)** EXPORTS `LEVEL_UP_EVENT_LEVELS` + `LEVEL_UP_PUSH_LEVELS` so claim/contest can reuse the split-leveled_up-row pattern. |
| `src/modules/me/challenge-complete.queries.ts` | (31a, RACE-FIXED 31b, S43) Monetary fields (xp, iron, stone, gold, morale) use Prisma `{increment}` (atomic Postgres `column = column + N`) — fixes race where 3 concurrent POSTs from auto-complete watcher all read same pre-state and last-commit-wins lost easy+medium XP. Streak fields stay absolute SET (safe because `computeNewStreak` is idempotent for same-day repeats + gated by player_challenges UNIQUE). Level recomputed in second UPDATE inside same tx, gated by `calcLevel(newXp) !== currentLevel`. **(S43)** Adds `logStreakMilestone(tx, playerId, payload)` writer — inserts `streak_milestone` activity_log row with metadata `{streak_days, streak_tier, is_milestone:true, xp_awarded, level_before, level_after, leveled_up}`. Domain-local: NOT imported from territory's `XpGrant`/`StreakMetadata` types (cross-module type import would be wrong-direction). |
| `src/modules/me/challenge.formulas.ts` | (31a, S40 shim) Ported subset of root `formulas.js` — CHALLENGE_TIERS, STREAK_TIER_THRESHOLDS, calcChallengeXp, RESOURCE_EARN flat table, validators. **(S40)** `LEVEL_XP_FLOORS` + `calcLevel` re-exported from `progression/progression.formulas.js` (shim). **(S62)** Adds `STEP_TIER_THRESHOLDS` (easy 5000 / medium 10000 / hard 15000), `CALORIE_TIER_THRESHOLDS` (easy 200 / medium 400 / hard 700), `getChallengeTypeFromEarnKey(earnKey) → 'steps' | 'calories' | null`, and `calcResourceEarn` now accepts `opts.capFactor` (backward-compatible default 1.0) routed through `calcCanonicalEarn`. |
| `src/modules/me/streak.helpers.ts` | (31a) Pure functions — `computeNewStreak`, `yesterdayOf`, `isGraceDayMilestone`, `applyGraceDayGrant`. |
| `src/modules/streak/streak-rollover.*` | (31c, audit-clarified S43, **extended S50**) Midnight rollover. Per-tz repeatable cron `0 0 * * *`. `evaluateRollover` decides per player: consume_grace / reset_streak / no_op. Optimistic-concurrency UPDATE-with-WHERE-guard (`WHERE id=? AND last_active_date=expected`). Sequential per-player processing inside batch (not Promise.all). `activity_log streak_broken` row written in same tx. **(S43 audit clarification)** No XP writes happen here — rollover only handles missed-day paths. Streak ADVANCEMENT happens in `challenge-complete.service.ts`. **(S50)** Now ALSO zeros Activity aggregates: tz-wide batch `updateMany` (`zeroActivityAggregatesForTimezone(tz, isMonday)`) always zeros `daily_steps`/`daily_calories`/`longest_session_min`; conditionally zeros `weekly_steps_total` when `isMondayInTz(todayYmd)=true`. Runs AFTER per-player streak loop, separate from it (folding would skip the no-op-skip majority). Aggregate-zero failure logged but non-throwing. `RolloverBatchSummary` extended with `aggregatesZeroedDaily`/`aggregatesZeroedWeekly`/`isMonday`. 12 helper tests (S31c) + 14 new (S50: 6 unit + 8 integration). |
| `src/modules/streak/streak-break-warning.*` | (31d) 23:55 warning push per-tz repeatable cron `55 23 * * *`. `evaluateWarning` + `formatWarningMessage` per spec §4.5.1. Copy: "You haven't completed today's challenge yet. You have 5 minutes before your streak resets. Grace Days: [N remaining / none]." Dispatched via `sendImmediately` (NOT `sendPush`) to bypass Quiet Hours queue — 23:55 IS inside 23:00–05:00 Quiet Hours and spec mandates the push fires. 13 helper tests. |
| `src/modules/streak/bootstrap.ts` | (31c) `bootstrapStreakRolloverJobs` — registers Queue/Worker pair on startup, then upserts one repeatable job per distinct `home_timezone` in players. 2 jobs registered currently (Europe/Moscow, Europe/Amsterdam). |
| `src/modules/streak/bootstrap-warning.ts` | (31d) `bootstrapStreakBreakWarningJobs` — same pattern for 23:55 warning. Separate file: each scheduled module gets its own bootstrap. |
| `src/shared/formulas/velocity.ts` | **(S46)** Single source of truth for velocity primitives. Constants: `MAX_PLAUSIBLE_KMH=25`, `MAX_PLAUSIBLE_MS=25/3.6` (derived), `SESSION_IDLE_THRESHOLD_MIN=15`, `DEFAULT_STRIDE_M=0.75`, `FUTURE_TIMESTAMP_TOLERANCE_MS` (lifted from contest-walk in S47). Helpers: `isStepWindowOverVelocityCap`, `isVelocityOverCap`, `stepsToKm`. 27 unit tests. Imported by both `contest-walk.service.ts` (S46/S47 migration) and `activity/*`. |
| `src/modules/activity/activity.helpers.ts` | **(S47)** Three pure helpers. `canCreditSample(sample, playerStride, now, playerTz)` composes D3/D4/D5 + window-too-short + future-timestamp gates with first-fails-wins check order; `bucketSampleByDay(sample, playerTz)` returns `YYYY-MM-DD` in player tz keyed off `windowEnd`; `computeLongestSessionMin(samples, idleThresholdMin)` derives session math with 15-min idle gap. Pure, side-effect-free, `now: Date = new Date()` injectable. 46 unit tests co-located. |
| `src/modules/activity/activity.routes.ts` | **(S49)** `POST /activity/steps` with `{ preHandler: requireAuth }`. Inline zod schemas both with **`.strict()`** — deliberate deviation from repo convention to enforce D10. Validation-error envelope mirrors `contest-walk.routes.ts` verbatim. |
| `src/modules/activity/activity.service.ts` | **(S49, S51 hotfix)** `ingestActivitySamples(clerkUserId, body, now?)` orchestrates the Q-F 7-step pipeline: pre-tx player snapshot → interactive `prisma.$transaction(..., { timeout: 30_000 })` (S51 bump from default 5s, covers worst-case 100-sample batch ~90ms/sample) → per-sample loop inside tx (duplicate check → `canCreditSample` decision → store row → bump aggregates atomically via `{increment}`) → recompute `longest_session_min` inside tx when `acceptedCount > 0`. Response envelope camelCase: `{acceptedCount, rejectedCount, duplicateCount, rejections:[{sourceId, reason}]}`. Three separate counters — duplicates NOT in `rejections[]`. Always 200 on successful tx. 15 integration tests. |
| `src/modules/activity/activity.queries.ts` | **(S49)** Six functions; all in-tx queries use `Prisma.TransactionClient` exclusively. `daily_calories` increment conditional-spread on `kcal` presence. |
| `src/modules/activity/index.ts` | **(S47, S49)** Started as empty barrel (`export {}`) in S47; S49 swapped to `registerActivityRoutes` aggregator. Registered in `app.ts` after `contestWalkRoutes`. |
| `src/modules/alliance/alliance.formulas.ts` | (32) `ALLIANCE_ROLES` tuple, `AllianceRole` type, `ROLE_SLOTS` (founder:1, marshal:2, officer:4, sergeant:6, soldier:null, recruit:null), `ROLE_RANK` (founder=5 → recruit=0), `MAX_ALLIANCE_MEMBERS=20`, `MIN_LEVEL_TO_JOIN=6`, `SHORT_NAME_REGEX`, `FULL_NAME_MIN/MAX_LENGTH`, `isValidShortName`, `isValidFullName`. |
| `src/modules/alliance/membership.helpers.ts` | (32, 36, 38) `canFoundAlliance`, `canJoinAlliance`, `canLeaveAlliance`, `canKick`, `canPromote`, `canDemote`, `canTransferFounder` (S38) — all pure, return `{ok}\|{ok:false, reason}`. `canTransferFounder` reasons: `not_founder` / `target_not_member` / `target_role_ineligible` / `cannot_transfer_to_self`. 34+ helper tests. |
| `src/modules/alliance/alliance.queries.ts` | (32–36) All transaction-safe queries: `fetchPlayerForFounding`, `fetchTerritoryForHq`, `findAllianceByShortName`, `createAllianceWithFounder`, `insertFounderMember`, `attachPlayerToAlliance`, `transitionHqTerritoryToAlliance`, `fetchAllianceForJoin`, `fetchAllianceWithRoster`, `fetchPlayerAllianceContext`, `fetchPlayerMembership`, `insertRecruitMember`, `removePlayerFromAlliance`, `disbandAlliance`, `setAllianceIdOnPlayerTerritories` (propagates territory.alliance_id on join/leave/kick — spec §2.3 + §3.8 + §8.4.2), log writers for founded/joined/left/kicked/promoted/demoted. |
| `src/modules/alliance/found.service.ts` | (32, 35) Orchestrator inside one `prisma.$transaction`. Validates: full_name, short_name format, player level ≥ 6, no current alliance, HQ ownership, HQ city match, short_name unique. HQ transition per spec §3.4: `territories.owner_id → NULL`, `territories.alliance_id → allianceId`. Returns 201 `{ alliance, members }` matching `getAllianceById` exactly (deepEqual-verified). Status codes: 400/403/404/409/422/500. **(S82 G1)** Now also calls `insertAllianceChatRoom(tx, alliance_id)` from `modules/chat/chat.queries.ts` inside the same tx — eager-creates the alliance chat room at founding time per Q-S81-F. Cross-module import from alliance → chat is one-way. 3 tests including HQ invariant + post-disband re-found regression. |
| `src/modules/alliance/join.service.ts` | (32, 36) Validates city + level + capacity + disbanded_at NULL. Inserts as 'recruit'. Calls `setAllianceIdOnPlayerTerritories` to propagate alliance_id to joiner's existing territories. 410 alliance_disbanded if applicable. 3 tests. |
| `src/modules/alliance/leave.service.ts` | (32, 36) `founder_must_transfer_first` guard. If founder is last member, `disbandAlliance` fires: `alliances.disbanded_at=now()`, `territories.alliance_id=NULL` (HQ reverts neutral per spec §3.4), DELETE alliance_members rows. Non-founder leave calls `setAllianceIdOnPlayerTerritories` to clear alliance_id from leaver's territories. **(S82 G1)** Disband branch now also calls `archiveAllianceChatRoom(tx, allianceId)` from `modules/chat/chat.queries.ts` before `disbandAlliance` — copies all chat_messages for the room into chat_messages_archive via tx-scoped `$executeRaw` INSERT...SELECT, deletes from the hot table, sets `chat_rooms.archived_at = now()`. All in the same tx as the disband per Q-S81-G. 3 tests. |
| `src/modules/alliance/kick.service.ts` | (36) POST /alliances/:id/members/:playerId/kick. Permission check via `canKick`. Clears territory.alliance_id for kicked player. 6 tests including territory propagation. |
| `src/modules/alliance/promote.service.ts` | (36) POST /alliances/:id/members/:playerId/promote with `{to_role}` body. Founder promotes anyone; Marshal promotes up to Officer. Target roles restricted to marshal/officer/sergeant/soldier (no founder via this endpoint; no recruit — starting state only). 11 tests including `role_slots_full` 409. |
| `src/modules/alliance/demote.service.ts` | (36) POST /alliances/:id/members/:playerId/demote with `{to_role}` body. Founder-only per spec §3.3 literal reading. Same target-role restrictions as promote. 9 tests. |
| `src/modules/alliance/transfer.service.ts` | (38) POST /alliances/:id/members/:playerId/transfer. Caller is current Founder; `:playerId` is incoming Founder (must be Marshal or Officer per spec §3.3 amendment). Inside one `prisma.$transaction`: captures target's current role, then swaps — target → founder, caller → captured role. Uses `canTransferFounder` for validation. Status codes: 400 `cannot_transfer_to_self` / 403 `not_founder` / 403 `target_role_ineligible` / 404 `target_not_member` / 500. Intentionally no 409 (role conservation removes the slot-cap branch). Returns `{ alliance, members }` matching `getAllianceById` exactly (deepEqual-verified). 8 tests including role-count conservation invariant. |
| `src/modules/alliance/get.service.ts` | (32) `getAllianceById` (alliance + roster — source of truth for `{ alliance, members }` shape), `getMyAlliance` (player context). |
| `src/modules/alliance/index.ts` | (32–38) registers found + join + leave + kick + promote + demote + transfer + get + activity-log + morale + **ability (Jul 7)** routes. |
| `src/modules/alliance/ability.catalog.ts` | **(NEW Jul 7)** Single server-side source of truth for the 5 War Room abilities: `ALLIANCE_ABILITIES` (costs 80/80/60/60/40, durations 6/6/12/12/24h), weekend window + 8h cooldown for the 4 combat abilities, weekday window + once-per-week for supply_line. Effect factors (`WAR_SURGE_IRON_COST_FACTOR` 0.6, `IRON_BULWARK_IRON_COST_FACTOR` 1.4, `STEADFAST_DEFENDER_RATIO_FACTOR` 0.8, `SUPPLY_LINE_EARN_MULT` 1.2) + pure rule helpers (`isWithinAbilityWindow`, `mondayOfWeekYmd`, `cooldownUntil`, `abilityExpiresAt`, `applyContestIronCostModifiers`, `scaleResourcesForSupplyLine`). Window checks gate on `ATTACK_DAY_GATE` (same switch as the contest gate); cooldown + week-limit always enforced. `ability.catalog.test.ts` (17 assertions). |
| `src/modules/alliance/ability.service.ts` | **(NEW Jul 7)** `getAbilityStates` (any member; `can_manage` = founder/marshal) + `activateAbility` (founder/marshal only). Activation runs the conditional morale UPDATE FIRST inside the tx → locks the alliances row so concurrent activations serialize and the cooldown/week-limit check is race-safe; rejections throw + roll back. Records into `alliance_ability_activations`. |
| `src/modules/alliance/ability.effects.ts` | **(NEW Jul 7)** Active-buff lookups on the hot paths: `getActiveAllianceAbilities(db, allianceId, now)` (unexpired activations → Set), `getActiveAbilitiesForPlayer`, `isSupplyLineActiveForPlayer`. |
| `src/modules/alliance/ability.routes.ts` | **(NEW Jul 7)** `GET /alliances/:id/abilities` + `POST /alliances/:id/abilities/:ability/activate` (id validated via `isAbilityId`, no client cost). |
| `scripts/backfill-home-city.ts` | (34) Idempotent backfill for `players.home_city` via `resolveHomeCityFromPin`. Logs per-player progress and final totals. Ran 10/10 successfully against Railway. |
| `src/modules/debug/routes.ts` | Debug routes gated by `(NODE_ENV !== 'production' \|\| ALLOW_DEBUG_ROUTES === 'true')`. Active: POST /debug/streak-rollover, POST /debug/streak-break-warning, GET /debug/contest-expiry/:contestId. **`ALLOW_DEBUG_ROUTES` currently ON in Railway — flip OFF before any external playtest.** |
| `src/modules/territory/*` | Full CRUD + contest lifecycle. See BACKEND ARCHITECTURE for file breakdown. `claim.queries.ts findPlayerAllianceId` now reads `players.alliance_id` via tx (no longer a stub; unwired in 32). **(S41/S42/S44 progression hooks):** `claim.service.ts` grants `calcClaimXp(tier, {streakDays, isSupplyLineActive:false, isCityEvent:false})` via `grantSiegeXp` inside tx (S42 multiplier-aware). `contest.service.ts` initiate runs `canContestTerritory(attacker, target)` between self-contest guard and tier level gate (S44 §8.1 enforcement); 403 with `CONTEST_REJECT_MESSAGES[reason]`. `contest-walk.service.ts` grants `calcContestWinXp` (attacker_won) or `calcDefenceWinXp` (defender_won) — both multiplier-aware (S42). `contest-expiry.worker.ts` grants `calcDefenceWinXp` to `defender_player_id ?? defender_id`. All four use `findPlayerStreakDays(tx, ...)` to read streak inside tx. `abandon` correctly grants NO XP (Siege XP cannot diminish). Query extensions: `findPlayerByClerkIdForContest` selects `alliance_id`; `findTerritoryForContest` includes `players: {select: {level: true}}` (S44); `findContestForWalk`/`findContestForExpiry` include `tier` (S41). `contest.routes.ts CLIENT_ERROR_CODES` extended to include 403 (S44). **(S60 §B-14):** `claim.service.ts` — first-claim detection via `tx.activity_log.findFirst` on prior `territory_claimed` rows inside tx, outer-scope `let firstEarnTrigger = null` capture, post-tx `emitFirstEarnPush` (this slice introduced claim.service's post-tx phase). `contest-walk.service.ts` — pre-tx `players.findUnique({select:{lifetime_contest_wins}})` (`findContestForWalk` does NOT return attacker fields), `isFirstContestWin = wins === 0` (race-safe: single-active-contest rule), post-tx emit on `attacker_won`. **(S64/S65a backend-authority cutover — claim + contest now own all reward/XP/streak math; mobile consumes the envelope. See dedicated rows below.)** **(S69 G2)** `contest.service.ts` create path now populates BOTH `attacker_alliance_id` and `defender_alliance_id` on the contests row (Q-G2-B B2 expansion — G2 originally scoped to `defender_alliance_id`, expanded after sibling audit revealed attacker_alliance_id was also null at create). Unblocks the defender_notify fan-out (G4) and addresses pre-existing B-S65a-X-contest-alliance-propagation. **(S70–S71 contest-walk extensions for defender lifecycle)** `contest-walk.service.ts` `defender_notify` push composer reads `attacker_first_walk_at` IS NULL one-shot flag inside tx; sets the flag on first non-zero attacker walk; pre-resolves recipients in-tx, fires composer post-tx. Backend `WalkResolvedResult` envelope confirmed symmetric across roles (Q-M4-A): both `attacker_walked_m` and `defender_walked_m` always present; `resources_awarded { iron, stone, gold, morale }` same shape regardless of outcome; both `first_contest_win` (attacker analog) and `first_defence_win` (defender analog) present. Mobile reads role-appropriate fields per Q-M4-D — no backend changes were required for M4. |
| `src/modules/territory/claim-errors.ts` | **(NEW S64)** 10 shared typed Error classes (code + context, no human message) used by BOTH `/claim/start` and `/claim` (complete). Sibling precedent for `contest-errors.ts`. |
| `src/modules/territory/claim-start.{service,queries,routes}.ts` | **(NEW S64)** POST `/territories/:id/claim/start` — `startClaim` deducts the commitment fee + inserts a `pending` `claim_intents` row (with the two partial-unique reservation indexes); per-error catch ladder over 9 codes; 9-field envelope (`intent_id`, `free_claim`, `gold_paid`, `gold_balance_after`, `started_at`, `expires_at`, `already_started`). Idempotent retry echoes original `gold_paid`. |
| `src/modules/territory/claim.{service,queries,routes}.ts` | **(S64 repurposed as COMPLETE)** POST `/territories/:id/claim` = ownership flip + rewards + log. Backend-resolved intent lookup (NO intent_id in body) with Q-P branching: pending+valid / pending+expired / no-pending-most-recent-consumed-and-owned (→ `already_completed:true`, zero deltas, current-state envelope — network-retry-safe) / no-pending-most-recent-expired / otherwise. CC-mirror snake_case envelope + split `leveled_up` row via imported `logLeveledUp`. Gold reward via `incrementPlayerGold`. **Lazy-expire is PRE-TX** (a `markIntentExpired` inside a tx that later throws is rolled back, stranding the intent — see Pitfall). |
| `src/modules/territory/claim.costs.ts` | **(S64)** Now holds `CLAIM_GOLD_REWARD` (Small:10, Medium:20, Large:50, Epic:100) alongside `CLAIM_GOLD_COST`. Claims net-negative gold by design (fee exceeds reward; territory + XP carry the value). Canonical values mirrored from mobile `formulas.js`. Duplicated mobile/backend (B-S64-X2). |
| `src/modules/territory/contest-errors.ts` | **(NEW S65a)** 18 shared typed Error classes (code + context) across `/contest` create + `/walk`. Sibling to `claim-errors.ts`. |
| `src/modules/territory/contest.costs.ts` | **(S65a)** Now holds `CONTEST_WIN_REWARDS` (iron 15, gold 25, morale 8) + `DEFENCE_WIN_REWARDS` (stone 20, gold 15, morale 8), canonical from mobile `formulas.js`. |
| `src/modules/territory/contest-defend.{routes,service,queries}.ts` | **(S69–S72) Backend sub-slice 1 of defender lifecycle.** POST `/contests/:id/defend` (alliance collective defense — first alliance member to call becomes the contest's defender) + GET `/contests/:id/defend-preview` (G5, 16-field envelope, 200 for active-but-defended, 409 for non-active). 8 typed snake_case error codes (G1): `contest_not_found` / `not_active` / `not_authorised_defender` / `contest_already_defended` / `contest_too_advanced` / `outside_defend_hours` / `insufficient_stone` / `invalid_body`. G3 widened auth via `isAuthorisedDefender(player, contest)` in `contest-defend.queries.ts` — single source of truth consumed by BOTH POST /defend and GET /defend-preview (Q-G5-H lock). 75% attacker-progress cutoff enforced at /defend only (Q-68-F2/F3); once defender has accepted, no time check on subsequent /walk. Alliance membership checked live at /defend only — defender who leaves alliance mid-walk completes the defense. G4 defender_notify fan-out: recipients pre-resolved IN-transaction (solo → `[defenderId]`; alliance → `findAllianceBroadcastRecipients` with `subjectPlayerId: attacker_id`, excludes attacker, includes owner); composer fires POST-transaction. |
| `src/shared/formulas/wellbeing-caps.ts` | **(NEW S62)** §13 cap-band constants (`STEP` 15k:1.0/17.5k:0.75/20k:0.40/Inf:0; `CALORIE` 700/800/900/Inf; weekly ≤100k:1.0/>100k:0.5) + `effectivenessForChallenge`. Sibling to `velocity.ts`. Session-cap explicitly OUT of Slice 7 (§13.6). 29 unit tests in `wellbeing-caps.test.ts`. |
| `scripts/run-tests.mts` | **(NEW S66)** The `npm test` entry point. Loads `.env.test` → asserts the DATABASE_URL guard → greps for destructive ops → `docker compose up` test DB → waits healthy → `prisma db push --accept-data-loss --url <test url>` → spawns `node:test`. `shell:false` for `.exe` targets, `shell:true` only for the `npx`/`npm` `.cmd` shims (Windows arg-shredding fix). |
| `scripts/test-db-reset.mts` | **(NEW S66)** `docker compose down -v` — drops container + volume; next `npm test` rebuilds fresh. |
| `src/test-setup/guard-impl.ts` + `guard.ts` | **(NEW S66)** Three-layer DATABASE_URL guard. `assertTestDatabaseUrl` asserts host ∈ {localhost, 127.0.0.1}, no `supabase.co`/`.com` substring, port 5433, dbname includes `_test`. `guard.ts` re-validates as a `node:test --import`. Container is bound to 127.0.0.1 only. |
| `docs/POSTMORTEM-2026-06-12.md` + `docs/TEST_DB.md` | **(NEW S66)** Incident timeline (TRUNCATE-CASCADE-on-prod) + forbidden patterns + restore procedure; operational reference for the isolated test DB. |
| `prisma/migrations-manual/20260612-add-claim-intents-table/{up,down}.sql` | **(S64)** Folder-per-migration for the `claim_intents` table (2 partial unique indexes WHERE pending + composite + ON DELETE CASCADE). Applied to Supabase. |
| `prisma/migrations-manual/20260621-add-chat-module/{up,down}.sql` | **(NEW S82 G1)** Creates 6 chat tables (chat_rooms, chat_messages, chat_messages_archive, chat_read_state, chat_mutes, chat_reports) + adds 2 players columns (chat_muted_until, alliance_chat_push_enabled DEFAULT true). Indexes per §5.1 of CHAT_ROADMAP.md minus NULLS LAST clause (not expressible in Prisma schema; semantic-equivalent index lives in `schema.prisma`). All `gen_random_uuid()` defaults, TIMESTAMPTZ(6) precision matching repo convention. Applied manually to Supabase prod after backend deploy (no auto-migrate); test DB picks it up automatically via `prisma db push`. |
| `src/modules/chat/*` | **(NEW S82 G1–G4)** Full chat module — see `BACKEND ARCHITECTURE` tree for per-file role summary. 12 production files (5 routes/services + 1 middleware + 3 helpers + 2 workers/bootstrap + 1 index) + 5 test files. Sibling-precedent confirmed: backend skeleton mirrors leaderboard module verbatim; admin file split (`chat-admin.*`) is new for this module and worth reusing when next "ops surface" module ships. |
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
| `src/shared/notifications/types.ts` | `PushNotificationKind` union — **22 kinds** post-S82 (4 original + streak_milestone + 7 alliance S57 + 3 level_up S59 + 4 first_* S60 + **`chat_alliance_message` S82 G4**). |
| `src/shared/notifications/send.ts` | `sendPush` — lookup token → Quiet Hours check → enqueue delayed or dispatch. `sendImmediately` — bypasses Quiet Hours queue by design. `isStaleTokenError` matches 3 codes. ⚠️ Importing this at test-module load cascades into Firebase + BullMQ + ioredis and keeps the event loop alive — composers use `SKIP_*_EMIT` env bypass + dynamic imports (Pitfall #47). |
| `src/shared/constants/activityLog.ts` | (S54/S59) `PLAYER_FEED_EVENT_TYPES` (incl. `leveled_up`) + `ALLIANCE_FEED_EVENT_TYPES` whitelists for the feed endpoints. |
| `src/modules/me/activity-log.*` | (S54) `GET /me/activity-log` cursor-paginated player feed + `PATCH /me/activity-log/read`. Cursor codec: base64url `{ occurred_at, id }`. |
| `src/modules/alliance/activity-log.*` | (S56) `GET /alliances/:id/activity-log` + `PATCH .../read` — alliance feed, separate `alliance_feed_last_read_at` cursor, username enrichment. |
| `src/modules/me/streak-break-status.*` | (S58) `GET /me/streak-break-status` + `POST /me/streak-break/acknowledge` (action-shaped POST, not cursor PATCH). Backed by `players.streak_broken_acknowledged_at`. |
| `src/modules/alliance/alliance-push.composer.ts` | (S57) First of the composer quartet. `emitAllianceLifecyclePushes(trigger)` — discriminated-union trigger over 5 events / 7 wires, `_broadcast` suffix convention, `SKIP_ALLIANCE_PUSH_EMIT` bypass, Promise.allSettled fanout, try/catch+console.error swallow around sendPush. |
| `src/modules/streak/streak-milestone-push.composer.ts` | (S58) §B-6 — `MILESTONE_COPY` for days 7/14/21/30/60/90; Day 60 amended S59 ("Your third Grace Day is banked."). `SKIP_STREAK_PUSH_EMIT` bypass. |
| `src/modules/me/level-up-push.composer.ts` | (S59) §B-10 — `LEVEL_COPY` keyed by levelAfter with entries for 5/6/10 only (`if (!copy) return` gating; L4 is mobile in-app CARD only). `[X,XXX]` interpolation via `toLocaleString`. `SKIP_LEVEL_UP_PUSH_EMIT` bypass. |
| `src/modules/me/first-earn-push.composer.ts` | (S60) §B-14 — `FIRST_EARN_COPY` scaffolds all 4 spec §5.1 sources (claim, contest_win, reconquest, alliance_mission) with verbatim copy; only claim + contest_win invoked from live writers — reconquest + alliance_mission emit calls are one-line additions when those writers ship. Push-only per Q-C C3 (no activity_log row). `SKIP_FIRST_EARN_PUSH_EMIT` bypass. Em-dash in contest_win body is real Unicode. |
| `prisma/migrations-manual/<YYYYMMDD>-<desc>/` | **Folder-per-migration convention (S58 Q-J)** — paired `up.sql`/`down.sql` per change (S43 flat file is the outlier). Live examples: `20260609-add-leveled-up-event-type/` (S59), the S58 `streak_broken_acknowledged_at` column-add. Applied via Supabase SQL Editor, verified with `pg_get_constraintdef` / follow-up SELECT. |
| `scripts/sendTestPush.ts` | (S53) Layer 1 push smoke CLI: `npx tsx scripts/sendTestPush.ts <fcm_token> [kind] [title] [body]` against Railway prod. Layer 1 = route mapping + render + tap nav; Layer 2 = real writer → detection → post-tx emit (opportunistic, rides natural gameplay). |
| `src/shared/timezone.ts` | (EXTENDED 31a, **S50**) `resolveLocalDateTimeToUtc`, `isQuietHours`, `computeNextQuietHoursDispatchUtc`, `getLocalDateInTz(tz, now?)` — returns YYYY-MM-DD in IANA tz, `getLocalHour`, **`isMondayInTz(todayYmd: string): boolean`** (S50 — pure over already-tz-local YMD string, DST-irrelevant by construction). Anchors all streak date arithmetic + activity aggregate rollover to `player.home_timezone`. 8 tests. |
| `src/modules/legacy-medal/` | (Jun 28) Honor Medal engine: `legacy-medal.catalog.ts` (all 16 medals, thresholds, updateMode), `legacy-medal.queries.ts` (applyIncrementMedal/applyCountMedal/applyMaxMedal/applyOneOffMedal), per-category earn hooks (`.combat/.defense/.distance/.endurance.ts`), read layer + routes (`GET /legacy/medals`, `GET /players/:id/legacy/medals`), backfill worker (DO NOT run backfill on this realm — deliberately skipped, only test accounts), `legacy-medal-push.composer.ts`. Cron medals ride the streak-rollover daily-eval hook (idempotent via `daily_eval_ymd`). |
| `src/modules/command-post/` | (Jul 1) Founder-only endpoints `GET /alliances/:id/command-post` + `/week-in-review`; thresholds in `command-post.constants.ts` (lapse N=3d, recruit 7d, stall grace 2d); `shared/queues/week-in-review.queue.ts`. |
| `src/shared/i18n/` | (Jun 29) dep-free `translate(locale,key,params)` resolver + TS resource modules (survive tsc→dist); `$t:<key>` param nesting for brand-name transcreation. All push copy flows through it per-recipient. |
| `src/modules/me/account-delete.{routes,service,queries}.ts` | (Jul 5) `DELETE /me/account` — one-tx purge of all NoAction-FK rows, territories released to neutral, founder auto-succession/disband, then Clerk user delete via `src/shared/clerk.ts` (lazy init). **Any new NoAction-FK table referencing players MUST be added to `purgePlayerData()` or deletion 500s.** |
| `src/modules/territory/first-claim.{routes,queries}.ts` | (Jul 4) `GET /territories/first-claim-objective` — held_count + nearest unclaimed small/medium (KNN, no distance cap) + geojson; target null once held_count > 0. |
| `src/shared/formulas/tempo.ts` + `challenge-days.ts` | (Jul 3) session tempo-tier classifier + theme calendar (previousTaskDayOf, isAttackDayYmd, THEME_BOOST_MULT ×1.5). |
| `src/modules/me/bootstrap.*` + `stride-calibration.*`, `src/modules/alliance/morale.*` | (Jun 23–24, RLS Phase 2) the server-side write endpoints that replaced mobile direct writes. **(Jul 7)** `morale.*` now only holds `donate` — the client-priced `spend` route/service was removed in favour of the ability module. |
| Ability effect wiring (Jul 7) | Buff lookups threaded into: `territory/contest.service.ts` (war_surge −40% attacker Iron + iron_bulwark +40% Iron via `applyContestIronCostModifiers`; rally_cry 80% walk via `allianceBuffs`), `territory/contest-defend.service.ts` + `contest-defend-preview.service.ts` (steadfast ×0.8 defender response ratio), `territory/contest-walk.queries.ts` + `contest-expiry.worker.ts` + `territory/claim.service.ts` + `me/challenge-complete.service.ts` (supply_line +20% XP + resources via `isSupplyLineActiveForPlayer` / `scaleResourcesForSupplyLine`; `challenge.formulas.ts calcResourceEarn` gained `isSupplyLineActive`). |

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

# Unit tests (533 tests across 9 suites as of S82; must run 4x zero-flake before any commit)
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

# Backend tests (S66: ISOLATED local Docker Postgres — REQUIRES Docker Desktop running)
# Pre-commit gate (UNBLOCKED as of S66):
#   1. npx tsc --noEmit            # MANDATORY (S65a) — exit 0 required BEFORE tests; tsx type-strips, tsc rejects what Railway will
#   2. npm test                    # auto-bootstraps the test container, runs the FULL 750-test suite sequentially (~85-100s as of S82). Run 4x, zero-flake.
#   3. git status + git diff --stat ; git add . ; git commit (multi -m, ASCII) ; git push origin main
#   4. Railway healthcheck (60-90s wait) ; device smoke if behaviour changed
# First-time setup per machine: install Docker Desktop, then: Copy-Item .env.test.example .env.test ; npm test
npm test                              # full suite against isolated DB (auto-starts container)
npm run test:db:up                    # start test container in background
npm run test:db:down                  # stop container (keeps volume)
npm run test:db:reset                 # stop AND remove volume (next npm test rebuilds fresh)
docker compose exec db-test psql -U test -d dominia_test   # inspect test DB
# Targeted 4-run baseline for claim/contest/CC scope only:
node --test --import tsx src/modules/progression/progression-integration.test.ts   # run 4x
# (Legacy per-file `npx tsx --test <file>` still works for ad-hoc single-file runs;
#  the historic 79-pre-existing-timeout-failures workaround is OBSOLETE post-S66.)

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

# Extend activity_log event_type whitelist (DROP + ADD pattern — every new event_type needs this;
# prefer the folder-per-migration convention: prisma/migrations-manual/<YYYYMMDD>-<desc>/{up,down}.sql).
# Current whitelist (20): challenge_completed, territory_claimed, territory_abandoned,
# contest_participated, km_walked, contest_defended, contest_won, contest_lost,
# contest_held, contest_expired, streak_broken, streak_milestone,
# alliance_founded, alliance_joined, alliance_left, alliance_role_changed,
# alliance_kicked, alliance_demoted, alliance_promoted, leveled_up (S59).
# NOTE: CHECK-constraint-only changes do NOT require prisma generate; column adds need
# BOTH `prisma db pull` AND `prisma generate` (two-step sync).
ALTER TABLE activity_log DROP CONSTRAINT activity_log_event_type_check;
ALTER TABLE activity_log ADD CONSTRAINT activity_log_event_type_check
CHECK (event_type = ANY (ARRAY[
  'challenge_completed', 'territory_claimed', 'territory_abandoned',
  'contest_participated', 'km_walked', 'contest_defended',
  'contest_won', 'contest_lost', 'contest_held', 'contest_expired',
  'streak_broken', 'streak_milestone',
  'alliance_founded', 'alliance_joined', 'alliance_left', 'alliance_role_changed',
  'alliance_kicked', 'alliance_demoted', 'alliance_promoted', 'leveled_up',
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

# === NOTIFICATIONS (S53–S61b) ===

# Layer 1 push smoke against Railway prod (verifies route mapping + render + tap nav).
# ALWAYS audit lib/notifications/route.js for the exact kind string FIRST — wrong kinds
# silently fall to DEFAULT_ROUTE and mask what the test proves.
npx tsx scripts/sendTestPush.ts <fcm_token> <kind> "<title>" "<body>"

# Test env bypasses — set when running tests that import services wired to push composers
# (prevents Firebase/BullMQ/ioredis from loading and hanging the runner):
# SKIP_ALLIANCE_PUSH_EMIT=true · SKIP_STREAK_PUSH_EMIT=true
# SKIP_LEVEL_UP_PUSH_EMIT=true · SKIP_FIRST_EARN_PUSH_EMIT=true

# (S66) The full suite now runs CLEAN against the isolated test DB via `npm test` — the old
# "79 pre-existing Supabase statement-timeout failures" workaround is OBSOLETE. The narrow-scope
# file set below is still useful as a fast targeted baseline during a slice (4-run zero-flake):
node --test --import tsx \
  src/modules/me/home-pin.service.test.ts \
  src/modules/me/streak-break-status.service.test.ts \
  src/modules/me/challenge.formulas.test.ts \
  src/modules/me/activity-log.service.test.ts \
  src/modules/me/streak.helpers.test.ts \
  src/modules/progression/progression-integration.test.ts

# Layer 2 first_contest_win smoke setup (B-S60-X1, opportunistic — when nish_s next walks a contest):
# UPDATE players SET lifetime_contest_wins = 0 WHERE username = 'nish_s';
# Then walk + win any contest → expect BOTH contest_won + first_contest_win pushes
# (lifetime_contest_wins auto-restores to 1 via the contest-walk tx).

# === GIT COMMIT HYGIENE (PowerShell) ===

# Default: ASCII-only messages via multi -m flags (no tempfile, no editor):
git commit -a -m "subject" -m "body line 1" -m "body line 2"
# (S65a) PowerShell: NEVER leave an empty -m "" between -m flags — the collapse causes pathspec errors.
#   Concatenate paragraphs into single -m strings or use multiple non-empty -m flags only.
# Messages needing § / em-dash / Cyrillic: PowerShell -m mangles them to '?'.
# Write a UTF-8 NO-BOM tempfile, then: git commit -F <tempfile>
# Cursor agent commits inject a "Co-authored-by: Cursor" trailer — project convention is
# single-author; strip with git commit-tree plumbing + git push --force-with-lease origin main.
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

**41. Prisma `$transaction` 5s default timeout breaks on batched per-row writes (P2028)**
- **Signature:** Backend tests at 5-sample batches pass green. Mobile producer's first real recovery-sweep batch (58 samples after a long offline period) returns `PrismaClientKnownRequestError P2028` → HTTP 500. No code path bug; each per-sample tx step (~90 ms against Railway-Supabase: 1 SELECT for dup + 1 INSERT + 1 UPDATE + computation) × 58 ≈ 5.2 s, exceeding default 5000 ms.
- **Cause:** `prisma.$transaction(async (tx) => { ... })` defaults `timeout: 5000`. Per-row `create` loops scale linearly with batch size; D1's 100-sample wire cap is the worst case.
- **Fix (surgical):** Pass `{ timeout: 30_000 }` as 2nd arg. 30 s covers worst-case 100-sample batch at ~90 ms/sample with margin. **Fix (long-term, B14):** refactor to `createMany` for inserts + batched aggregate update — reduces per-batch tx duration from ~90 ms/sample to ~constant.
- **General lesson:** when batch sizes can grow beyond what unit-test fixtures simulate (recovery sweeps, cold-start drains, backfills), audit the transaction-timeout headroom. Default Prisma 5 s is too tight for any tx that processes more than ~50 rows with non-trivial per-row work. (S51 hotfix)

**42. Deterministic-from-physical-input sourceId is THE primitive that makes idempotent ingest self-healing**
- **Signature:** A mobile producer needs to handle: app kill, OS kill, device reboot, network loss, backend 500, mid-flight crash, concurrent flush races. Each can produce a re-send of an already-accepted sample.
- **Cause:** A random per-collection UUID would make each retry/replay a fresh row — triple-counted steps the first time anything goes wrong.
- **Fix:** SourceId is `SHA-256("${playerId}|${windowStartMs}|${windowEndMs}")` formatted 8-4-4-4-12. Same physical window → same sourceId → backend's `@@unique(player_id, source_id)` rejects as duplicate. Three independent organic races in S51 device smoke (Effect 2 concurrent flushes, backend tx-timeout retry replay, OS-process-kill rehydrate) all generated would-be duplicate writes; backend returned `duplicate=N` every time, zero data integrity impact.
- **General lesson:** when an idempotency decision has the option of app-layer-only (token stored at request time, lost on retry) vs deterministic-from-physical-input (regenerable from the raw event identity), deterministic wins. The "regenerate from raw inputs" property is what makes the system self-healing without explicit crash-recovery code. (S51)

**43. `node:test` file-level parallelism breaks tz-wide side-effect-count assertions**
- **Signature:** An integration test asserts on `updateMany.count` from a tz-wide aggregate operation. Passes in isolation; flakes in 3 of 4 full-suite runs.
- **Cause:** `node:test` runs test files in parallel by default. Other files inserting Amsterdam fixture players between the two consecutive calls shifts the count. The assertion is parallel-unsafe because it counts a side-effect across fixture boundaries.
- **Fix:** Scope every assertion to fixture player IDs, not side-effect counts. Read the rows the test cares about by `id IN (...)` after the operation; assert on those fields. Never assert on "how many players were touched" tz-wide.
- **General lesson:** when an integration test asserts on a property that crosses fixture boundaries (counts, aggregates, "how many rows changed"), it is parallel-unsafe by default. Scope every assertion to fixture IDs from the start of the test, not retroactively after a flake. (S50)

**44. Cross-repo Step 0 audit is non-negotiable — repo-internal assumptions die when the slice crosses repos**
- **Signature:** First slice that touches the mobile repo. Plan was written from backend-context. Plan assumed TypeScript (reality: JavaScript with TS only in devDeps), MMKV/queue patterns (reality: AsyncStorage + module-state mirror `lib/claimState.js`), AppState/NetInfo hooks already wired (reality: zero usage anywhere — NetInfo not even installed).
- **Cause:** Plans authored from outside a repo drift on infrastructure assumptions in ways that don't surface until implementation. Three assumptions died in a 12-file Step 0 read; none would have been caught by code review alone.
- **Fix:** Cross-repo slices MUST start with a Step 0 audit of the new repo: read package.json, App.js, the canonical API wrapper pattern, the canonical state-management pattern, every screen the slice touches, every plugin/config file. Lock decisions only AFTER Step 0. Producer code in S51 was authored against the verified mobile patterns, not against the inferred ones.
- **General lesson:** the "I've worked in this codebase before, I know the conventions" reflex is wrong when crossing repos. Audit the new repo from scratch every time. (S51)

**45. Scope-discipline is a means, not an end — refactor IN-slice when surfacing the duplication justifies it**
- **Signature:** Slice plan says "no refactoring." Audit reveals a constant (`STEPS_READ_PERM` HC permission descriptor) is duplicated across two screens and the new producer would be a 3rd copy. Strict scope-discipline = defer the extraction; right call = take the 20-minute extraction in the slice that surfaces the third copy.
- **Cause:** Scope-discipline serves shipping speed. Deferring a refactor that surfaces duplication-in-three-places means the duplication ships, and the deferred extraction is unlikely to ever happen.
- **Fix:** When a refactor IS the right time-to-fix vs forever-drift trade, take it in the slice that surfaces the duplication. Document the deviation as an explicit option (e.g. "Q-K.7 Option B: extract to shared") so the rationale is reviewable. K.7 in S51 extracted to `lib/healthConnect.js` — eliminated 3-copy drift forever.
- **General lesson:** scope-discipline is a tool, not a rule. The cost of "one more copy" compounds; the cost of "extract now" is once. (S51)

**46. Discovered bugs don't always need same-session fix — file-and-ship is highest-value when data integrity is protected by another primitive**
- **Signature:** Mid-session smoke surfaces a non-trivial bug (ActivitySyncLifecycle Effect 2 re-firing on Clerk `getToken` reference instability, causing concurrent producer stop+restart cycles with overlapping flush attempts). Fix is ~10 lines. Stopping to patch would cost 30 minutes mid-smoke.
- **Cause:** "Discovered bug = same-session fix" is a reflex, not a rule. The actual decision is a three-way: cost-of-discovery + cost-of-deferral + cost-of-fix-now.
- **Fix:** Bug-1 (B13) was filed and shipped around: data integrity was unaffected (Q-D deterministic sourceId absorbed all 3 race occurrences), behaviour was correct under the bug (producer cleaned up + restarted, just twice in a row), patch could land in any follow-up session at zero risk. S52a closed it cleanly in commit `9c97fe7` (`useRef` for getToken, drop from Effect 2 deps).
- **General lesson:** when a discovered bug has zero data-integrity impact AND a separate primitive (idempotency in this case) is absorbing the consequences AND the fix is a clean follow-up, "ship + file backlog" is the right call. Not every discovered bug earns same-session fix. (S51 → S52a)

**47. Importing push-composer-adjacent modules at test load cascades into Firebase/BullMQ/ioredis and hangs the runner**
- **Signature:** Tests that import a service wired to a push composer pass but the runner never exits (extends Pitfall #36 to the notifications surface). Importing `send.ts` at module load is the trigger.
- **Cause:** `send.ts` transitively initializes Firebase Admin, BullMQ Queue, and ioredis singletons — open handles keep the Node event loop alive.
- **Fix:** Three-part pattern (S57): `SKIP_<DOMAIN>_PUSH_EMIT` env bypass at composer entry, `lazyConnect: true` on Redis, dynamic `await import()` for Firebase/queue modules. Every new composer inherits all three.

**48. tx-callback discriminated unions broaden to `boolean` without explicit return type annotations**
- **Signature:** A `prisma.$transaction(async (tx) => {...})` callback returns `{ok: true, ...} | {ok: false, reason}`; TypeScript broadens `ok` to `boolean`, downstream narrowing fails, or Railway's full `tsc` throws TS2322 that local `tsx` (type-stripping) never surfaced.
- **Fix:** Annotate the callback explicitly: `prisma.$transaction(async (tx): Promise<XxxResult> => {...})`. Project pattern since S57. Corollary (S58): run `npm run build` after EVERY Cursor prompt that touches a `.ts` file — including tests and types — not just implementation prompts.

**49. JSONB metadata key drift — lock field names via SQL diagnostic BEFORE writing any renderer**
- **Signature:** Feed renderer shows blanks for one event_type. Renderer guessed `streakDays`/`streak_days`; real key is `previous_streak`. Burned a smoke iteration (S55).
- **Cause:** camelCase/snake_case emitter drift across backend writers is the default, not the exception.
- **Fix:** Run `jsonb_object_keys` across all in-scope event_types FIRST, then write renderers. Defensive `getMeta(event, ...keys)` dual-fallback absorbs residual drift.

**50. Never guess FCM kind names or routing targets — audit `lib/notifications/route.js` before constructing any push test**
- **Signature:** S61a burned 3 of 4 verifications sending pushes with wrong kind strings (`alliance_member_promoted` vs actual `alliance_promoted`; `streak_re_entry` which has NO FCM kind — it's a response-side toast). All fell silently to DEFAULT_ROUTE, masking what the test proved.
- **Fix:** Kind-name audit precedes test command construction, even when "pretty sure" from memory. A surface rendering as the DEFAULT toast when a specific surface was expected = wrong kind string, not a routing bug.

**51. Killed-state cold-start has TWO independent failure modes — Metro payload race AND AuthGate nav clobber**
- **Signature:** (a) Metro dev mode: `getInitialPushPayload` returns null (bundle race) — push routing never dispatches; (b) release mode: routing dispatches correctly, then AuthGate's async parameterless `navigation.replace('MainTabs')` clobbers the push-driven tab selection milliseconds later ("brief correct flash → Map override").
- **Fix:** (a) is Metro-only — killed-state Effect 5 paths can ONLY be verified on a release-mode EAS build (Alyona). (b) fixed in S61a: `navigateToAfterAuthGate` defers dispatch via the existing `pendingTarget` + state-listener machinery until the root route is MainTabs.
- **General lesson:** when an existing deferral mechanism almost covers a new case, lift its helpers to module scope and add a second entry point — don't build parallel deferral logic. And distinguish "fix verified on one device/runtime" from "fix shipped to all environments."

**52. Pre-existing scaffolding placeholders may be mis-targeted — re-verify against spec at adoption time**
- **Signature:** S53 scaffolded an aggregate `first_earn` → Wallet route entry. S60 spec audit showed per-source copy registers pointing at Map/Alliance — the Wallet target was a placeholder guess, not a locked decision. Adopting it would have shipped wrong tap targets.
- **Fix:** Placeholders ≠ locked decisions. When wiring a previously-scaffolded entry, re-run the copy/spec audit before adopting the scaffold's choices. S60 deleted the aggregate entry and added 4 per-source entries.

**53. Audits must verify the slice's PREREQUISITES, not just its code surface — architectural drift hides outside the diff**
- **Signature:** §B-7 ("Proven streak: +15%" label) was framed as mobile-only UI polish. The S60 bundle audit revealed mobile bypasses backend `/territories/:id/claim` + `/contests/:id/walk` entirely — direct Supabase writes with FLAT XP; the S42 multiplier logic is live but unreached (B-S60-X2). Shipping the label would have been dishonest UI.
- **Fix:** Bundle audits extend to the premises the slice depends on. When the audit invalidates a premise, DEFER and bundle with the architectural fix (Activity Slice 7 carrier). Honest carry-forward beats dishonest ship.

**54. 🚨 Backend tests shared infrastructure with PRODUCTION — a single destructive test op wiped the prod DB (CATASTROPHIC, S65a→S65b)**
- **Signature:** All core tables suddenly empty (players=0, territories=0, alliances=0, contests=0, activity_log=0). Symptom may not surface for a session or more — persisted Clerk SecureStore keeps the user "signed in" against a row that no longer exists, presenting as an onboarding/loading hang rather than an obvious data error.
- **Cause:** An S65a test ran `TRUNCATE alliances RESTART IDENTITY CASCADE`. The summary called the target a "shared test DB", but no separate test DB existed — there was ONE Supabase project. FK CASCADE wiped players → territories/contests/activity_log. Reverting the test code did NOT restore the rows; the damage is durable.
- **Fix:** Restore the most recent scheduled physical backup (Supabase Dashboard → Database → Backups → Scheduled). Then ship test-DB isolation (done S66) so it can never recur. **Forbidden patterns:** TRUNCATE/DROP/sweeping-DELETE in any test that could touch prod; "test DB"/"shared test DB" terminology unless a separate database demonstrably exists and is configured.
- **General lessons:** (a) production data integrity is a top-of-stack concern — any test-infra change touching shared resources must explicitly verify isolation before approval; (b) persisted client-side auth masks server-side data loss — cross-check server state when diagnosing auth/onboarding UI bugs; (c) prior-session summaries can contain factual errors (infra descriptions) that propagate — verify against actual config when they materially affect decisions.

**55. `markIntentExpired` (or any state-mark) inside a Prisma tx that later throws gets ROLLED BACK (S64)**
- **Signature:** A claim_intent marked expired stays `pending` forever; the mark "didn't take."
- **Cause:** The lazy-expire write lived inside the same `$transaction` that then threw `IntentExpiredError` — the throw rolled back the expiry mark along with everything else.
- **Fix:** Do the lazy-expire PRE-TX against the plain prisma client (not the tx), THEN throw. Caught by an integration test before commit — a reason to split impl and test phases (tests-against-working-code catch what tests-against-spec miss).

**56. Test changes escape `tsx` gating and break only at Railway — `tsc --noEmit` is mandatory on test-touching passes too (S65a)**
- **Signature:** Production-code phases ran tsc clean; a later test-only / helper-widening / fixture pass skipped tsc; the build then failed at Railway (e.g. a leftover 2-arg `foundTestAlliance(suffix, 6)` call, or `FREE_CLAIM_LIMIT` imported from the wrong `.costs.js`).
- **Cause:** `tsx`/`node --test --import tsx` type-strips at runtime and tolerates type errors; only full `tsc` rejects them.
- **Fix:** `npx tsc --noEmit` is part of the pre-commit gate for EVERY pass, including test-only changes. This was the single largest gap-class of escapes-to-Railway in the contest slice.

**57. New mobile test file silently invisible if placed outside Jest's `testMatch` (S65b)**
- **Signature:** A test file with 100% pass that `npm test` never runs. Placing it at `lib/foo.test.js` instead of `lib/__tests__/foo.test.js`.
- **Cause:** Jest default `testMatch = "**/__tests__/**/*.test.js"`. Files outside `__tests__/` folders are skipped, not errored.
- **Fix:** Test-discovery validation is distinct from test-pass validation. Put files under `lib/__tests__/` and confirm the default runner picks them up before declaring tests done.

**58. Pure-CJS Jest (zero mocks, S51 Q-L) cannot `require()` an ESM source file (S65b)**
- **Signature:** Importing `lib/contestWalkApi.js` (ESM) into a CJS Jest test throws on load. There was also NO precedent — the assumed sibling `claimApi.test.js` did not exist (claimApi.js is still untested).
- **Fix:** Use the `fs.readFileSync` + `new Function` loader pattern with stub injection as function args to test ESM lib files. CJS lib files (e.g. `contestResultHelpers.js`) test with normal `require()` — put helper extractions in CJS-style files when testability matters. Also: VERIFY a sibling exists before citing it as precedent.

**59. Windows `spawnSync({ shell: true })` shreds multi-word args before cmd.exe (S66)**
- **Signature:** A multi-word SQL string passed to a spawned `.exe` arrives mangled / split.
- **Cause:** With `shell:true`, args are concatenated and re-parsed by cmd.exe.
- **Fix:** `shell:false` for `.exe` targets; reserve `shell:true` only for `.cmd` shims (`npx`, `npm`) called with flag-only args.

**60. `prisma db push` reads its datasource URL from `prisma.config.ts` (e.g. `DIRECT_URL`), not necessarily `DATABASE_URL` (S66)**
- **Signature:** `prisma db push` targets the wrong database despite `DATABASE_URL` being set for the test DB; `--skip-generate` rejected by current Prisma.
- **Fix:** Pass `--url <test-db-url>` explicitly to override the config datasource ambiguity. Also verify the schema SOURCE OF TRUTH in prod (schema.prisma vs manual migration files vs hybrid) BEFORE designing a test bootstrap — Dominia's baseline schema lives in `schema.prisma`, not in `migrations-manual`, so `prisma db push` (not replaying migration files) is the correct bootstrap.

**61. FK constraints with `NO ACTION` require child-row cleanup before parent DELETE — map the full FK graph first (S66)**
- **Signature:** A prepared cleanup DELETE fails on a FK error; reordering hits the next FK; iterating one error at a time never converges (alliances ← players ← territories owner_id/alliance_id ← activity_samples).
- **Fix:** Map the entire FK graph up front (`pg_constraint` join `pg_attribute`) and delete children-first in one planned pass. (This is why the test-row cleanup was DEFERRED in S66 — B-S66-X-test-row-cleanup-deferred.)

**62. Reward constant aliased from the COST constant silently zeroes out an asymmetry the spec encodes (S64)**
- **Signature:** Claims become net-zero gold instead of net-negative; `CLAIM_GOLD_REWARD` was aliased from `CLAIM_GOLD_COST` because the reward constant didn't exist in the backend repo.
- **Fix:** Reward and cost are independent canonical values from mobile `formulas.js` (`CLAIM_GOLD_REWARD` = Small:10/Medium:20/Large:50/Epic:100). Cross-check against the mobile source-of-truth when porting a constant; don't assume symmetry. (Constants now duplicated mobile/backend — B-S64-X2.)

**63. Prisma compound-unique TypeScript field name is `field1_field2`, NOT the SQL constraint name from `map:` (S82 G1)**
- **Signature:** `tsc --noEmit` errors with `Object literal may only specify known properties, and 'chat_rooms_type_key_unique' does not exist in type 'chat_roomsWhereUniqueInput'.` after writing `prisma.chat_rooms.findUnique({ where: { chat_rooms_type_key_unique: {...} } })`.
- **Cause:** The `map: "..."` attribute on `@@unique` only renames the SQL constraint. The Prisma TypeScript key follows the pattern `field1_field2` regardless. Same for composite primary keys (`@@id([player_id, room_id])` → `player_id_room_id`).
- **Fix:** Use `room_type_room_key` / `reporter_player_id_message_id` / `player_id_room_id` as the where-input key. When introducing a compound unique, run `npx prisma generate` then `npx tsc --noEmit` immediately to surface the real key name. (Bit me 4 times in chat.queries.ts before the pattern clicked.)

**64. Registering a route module with `requireAuth` preHandler blocks unit tests that don't hit Clerk — extract the handler for test injection (S82 backend(me))**
- **Signature:** Route-level test that uses an `app.addHook('preHandler', ...)` to set `request.clerkUserId` from a test header still gets `401 "Missing or malformed Authorization header"` from the real route.
- **Cause:** Fastify global preHandler hooks run BEFORE per-route preHandlers, but `requireAuth` reads the `Authorization: Bearer` header — it doesn't trust whatever the global hook set. Registering the full route module (`app.register(allianceChatPushRoutes)`) brings in the real `requireAuth`.
- **Fix:** Export the handler function (`handlePatchAllianceChatPushEnabled` / `handleAdminConfirmReport` / etc.) and register it directly in the test app WITHOUT the `requireAuth` preHandler. Same pattern used by chat-admin tests. Production keeps `requireAuth`; tests bypass via header injection. All `/me/*` and `/admin/chat-*` route files now follow this dual-export pattern.


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
| **Jun 23–Jul 5 carry-forwards (consolidated)** | Google Play Console needs a **web** account-deletion URL for the Data safety form (in-app path alone insufficient) · Google SSO needs Clerk-dashboard Google connection (prod needs real OAuth client id/secret) · medal deep-link opens Profile but not the specific medal's detail modal (optional polish) · ProfileScreen double-fetches medals (power + section — accepted) · WarRoom player rows not wired to PublicProfile · mobile `activity.producer` still flushes ~102 zero-activity samples every ~2 min (client-side efficiency, not correctness) · claim-start's 15s band-aid tx timeout can be lowered now that activity contention is fixed · `insert_*_batch` SECURITY DEFINER pipeline fns still anon-callable + `function_search_path_mutable` warnings · War Room ability `spend` amount still client-supplied (costs should be server-defined) · ProfileScreen sign-out routes to SignIn, skipping the Welcome pitch (intentional, flagged) · `firstClaim.nudgeBody` strings with territory names exist but unused (endpoint would need nearby list). |
| **Phantom git "modified" status on backend territory files (recurring)** | `git status` shows backend files as modified after Cursor sessions, but `git diff --stat <file>` shows 0 inserts/deletes — content byte-identical to HEAD. Cosmetic only. Verify with `git diff --stat` BEFORE staging; only `git add` files with real changes. |
| **BigInt JSON serialization for `osm_id` (masked)** | Typecheck passes but runtime serialization may need a Fastify JSON serializer if `osm_id` ever lands in an outgoing payload. Currently masked because test territories have `osm_id = null`. |
| **Cross-player defender_notify FCM real-device test deferred to S75 smoke** | Server-side defender_notify trigger verified via temp debug route (now removed). The real flow (second player attacks nish_s, attacker_first_walk_at sets, defender_notify push lands on nish_s's device, deep-links to DefenderAcceptScreen with `extractParams` populating `{contestId}`) NOT verified end-to-end yet. Now wired across S69–S74; verification gated on S75 device smoke (Alyona attacks `nish_s`). Same surface verifies the deferred defender-role /walk test. |
| **403 not_a_participant on /walk untested** | Code path for "player is neither attacker nor defender_player_id" is straightforward but untested via real third-player token. Defer until a third Clerk account is in physical reach. |
| **B-S61-X1: StreakBreakLifecycle 401 `no_token` on cold start** | Status check fires before Clerk token is ready. Likely fix: gate on `isLoaded && isSignedIn` or adopt FcmLifecycle's `useRef(getToken)` pattern. Low priority; bundles with B-S58-Q2 as a StreakBreakLifecycle hardening micro-slice (S62b candidate). |
| **B-S58-Q2: nav-listener cleanup style inconsistency** | `StreakBreakLifecycle` (`return unsubscribe;`) vs `lib/navigation.js` (`removeListener`). Both work; inconsistency invites drift. Bundles with B-S61-X1. |
| **B-S60-X1: Layer 2 first_contest_win smoke pending (opportunistic)** | SQL reset `lifetime_contest_wins = 0` for nish_s → walk + win any contest → expect contest_won + first_contest_win pushes. Setup SQL in IMPORTANT COMMANDS. Rides natural gameplay, does not gate anything. |
| **Slice 7 SMOKE PENDING on nish_s (gates Activity Slice 7 closure)** | The full claim + contest backend-authority cutover (S64/S65a/S65b) shipped on `main` but the end-to-end device smoke was deferred (session closed outside contest hours 05:00–22:59 local). Must verify: tap → confirm sheet → Accept → ActiveClaim with `required_walk_m` → walk → resolution → ContestResultScreen → territory flip on map. Spot-checks: `insufficient_iron` / `level_too_low` / `outside_contest_hours` inline errors. **Slice 7 cannot be declared closed until verified.** |
| **B-S60-X2: mobile→backend claim/contest cutover — SHIPPED (smoke pending)** | RESOLVED in code across S64 (claim) + S65a (contest backend) + S65b (contest mobile). Mobile no longer writes claim/contest state directly to Supabase; backend is authoritative for XP/resources/streak/level. Remaining: device smoke (above). Unblocks §B-7 (streak XP bonus UI) + §B-15 (403 reject-message mapping). |
| **B-S64-X1: mobile pre-flight gold gating ignores free-claim eligibility** | A level-1 player with 0 gold may be blocked from the confirm sheet for `FREE_CLAIM_TIERS` even though the backend would allow it. Pre-existing; surfaced during S64 audit, not introduced by S64. |
| **B-S64-X2: reward constants duplicated mobile/backend** | `CLAIM_GOLD_REWARD` + `CONTEST_WIN_REWARDS` + `DEFENCE_WIN_REWARDS` maintained in both `formulas.js` and backend `*.costs.ts`. Decide source-of-truth strategy (codegen, npm-workspace shared module, or discipline). |
| **B-S64-X4: vehicle false-positive on initial GPS sample** | First GPS sample after a walk start can read as vehicle speed and pause the claim for a 15-min reset. Pre-existing velocity-spec inconsistency; folds into the 25 km/h doc-cleanup carry-forward. Investigate the initial-sample velocity calc. |
| **B-S64-X5: Clerk session-refresh hang after ~30 min app-idle (dev only)** | Silent fetch hang at `await clerkGetToken()` after extended idle on the dev device; force-stop + cold launch recovers. Real users on active sessions unlikely to hit. Optional fix: a `clerkGetToken` timeout wrapper. |
| **B-S65a-X-contest-alliance-propagation** | Backend sets `attacker_alliance_id`/`defender_alliance_id` to null on contest create; the territory flip uses `contest.attacker_alliance_id` (always null at win) — alliance affiliation is not propagated to a won territory. |
| **B-S65a-X-contest-streak-coupling** | Contest XP is fixed-per-tier (no streak multiplier). Game-balance review needed on whether contest XP should be streak-multiplied like challenge XP. |
| **B-S65a / B-S65b test + casing carry-forwards** | `activity-log-casing-sweep` (normalise non-touched emitters — expiry worker, defender accept — to snake_case) · `file-rename-symmetry` (`contest.service.ts`→`contest-create.service.ts` pairs with `claim.service.ts`→`claim-complete.service.ts`) · `alliance-test-sequencing` (`--test-concurrency=1` is global; consider isolating alliance tests as a serial sub-suite) · `alliance-test-shared-helper` (extract `uniqueShortName` to a shared util — currently duplicated in 8 files) · `api-test-module-style` (decide ESM Jest transform vs CJS conversion of `claimApi.js`/`contestWalkApi.js`/`contestWalk.js` — currently the `fs.readFileSync`+`new Function` loader hack) · `state-config-nesting` (flatten the mobile 4-state STATE_CONFIG when defender lifecycle ships) · `iron-precheck-drift` (MapScreen iron pre-check could silently mismatch backend if costs diverge) · `contest-buffer-persistence` (add AsyncStorage to `lib/contestWalk.js` when Resume-UX lands) · `claim-api-untested` (`lib/claimApi.js` has no tests; symmetry candidate with the 26-test `contestWalkApi.js`). |
| **B-S66 carry-forwards** | `scripts-typecheck` (add `tsconfig.scripts.json` so `scripts/*.mts` are covered by `tsc --noEmit`) · `schema-prisma-prod-drift-check` (run `prisma db pull` vs prod, diff committed `schema.prisma`, reconcile — the test DB is now driven entirely by schema.prisma so drift = tests validate the wrong shape) · `migration-convention-cleanup` (restructure the flat `20260528-add-streak-milestone-event-type.sql` into the folder-per-migration convention) · `test-row-cleanup-deferred` (clean 48 test players + 16 test alliances + 15 activity_samples + 10 territories owner_id + 18 territories alliance_id — FK-ordered, only now that isolation prevents repopulation). |
| **B-S73 carry-forwards (defender sub-slice 2 — still open at S75 start)** | `contest-result-push-deeplink-params` (broader fix for `contest_won`/`contest_lost` push taps landing on ContestResultScreen with STATE_CONFIG defaults silently applied — M3 fixed infra for defender_notify only, this slice extends it to the result-screen push kinds; backend baseData camelCase convention locked) · `contest-api-shared-fetch-helper` (extract shared Clerk-authed fetch wrapper across `claimApi.js`/`contestWalkApi.js`/`defenderApi.js`/`streakBreakApi.js` — currently 4 near-identical impls; defer until third-+ consumer surfaces beyond the existing pattern duplication) · `defend-preview-territory-id` (backend hygiene: GET /defend-preview envelope omits `territory_id` even though it's queryable from the contests row; low priority) · `defender-threshold-display-policy` (gated on Q-68-H3 dynamic-update continuous catch-up scaling — when H3 ships, replace M2's accept-time snapshot with a live-updating display) · `color-constant-naming-convergence` (repo-wide hygiene: `lib/theme.js` colour tokens vs DefenderAcceptScreen inline `#` literals — defer to global theme pass). |
| **B-S74 carry-forwards (defender sub-slice 2 — opened at S74 close)** | `lib-notifications-test-gap-closure` (M3 added route.test.js with 17 tests; broader `cardController` + `FcmLifecycle` Effects 3/4/5 still have zero unit tests — defer until next mobile hardening pass) · `first-defence-win-plumbing` (gated on the pre-existing `firstContestWin` TODO at ContestResultScreen L131-134 — when first-win UI ships for attacker, slot in the defender analog using the symmetric `first_defence_win` field already present in `WalkResolvedResult`) · `contest-result-dead-nav-params` (pre-existing hygiene: ContestResultScreen receives several nav-params from S65b that aren't read by the current pure-display impl — audit and prune in a dedicated cleanup pass). |
| **B-S82 carry-forwards (chat module — opened at S82 close, see CHAT_ROADMAP.md §9 for full list)** | 🟢 `B-S82-OPS-m2-eas-smoke` (EAS standalone smoke on Alyona OP7T for chat send/receive between OnePlus 12 dev client and OP7T standalone + chat_alliance_message push deep link; same protocol as Defender Lifecycle smoke) · 🟢 `B-S82-FF-keyword-filter-list` (populate `KEYWORD_FILTER_LIST` in chat-moderation.filters.ts from observed beta moderation reports; starter is intentionally empty per Q-G2-B so filter is currently a no-op) · 🟢 `B-S82-OPS-chat-archive-monitoring` (the `chat-archive-daily-utc` cron logs to stdout only; no Railway alert; add observability when friends-beta nears 10k city messages) · 🟢 `B-S82-OPS-ably-realtime-disconnect-handling` (`lib/chatRealtime.js` auto-reconnects via Ably defaults but does not surface a "reconnecting" UI hint; optimistic sends during disconnect could go to /dev/null silently before Ably establishes fallback) · 🟢 `B-S81-OPS-realm-removal-state-cleanup` (this doc's Realm references now updated — module entry, BACKLOG, DECISION LOG, WHAT'S NEXT — per Q-S81-B Realm is corporate ops concept only, future realm = separate Supabase + Railway deployment). **Phase-2 deferrals (⚪ active):** B-S81-FF-message-hide-on-confirm, B-S81-PHASE2-city-mention-push, B-S81-PHASE2-help-channel, B-S81-PHASE2-dms (gated on Subscription module), B-S81-PHASE2-event-chat, B-S81-PHASE2-edit-delete, B-S81-PHASE2-read-receipts, B-S81-PHASE2-admin-ui (full dashboard on top of the cursor-paginated GET admin queue from G4), B-S81-PHASE2-archive-restore, B-S81-PHASE2-per-room-mute, B-S81-OPS-ably-scale-ceiling (re-evaluate when concurrent active users exceed 150), B-S81-OPS-third-party-moderation (OpenAI Moderation API / Perspective API when regex maintenance load grows). |
| **B-S62 carry-forwards** | `past_day rejection volume` (167/97% over 7 days — likely Alyona autonomous producer replaying old-window samples post-restart) · `getPlayerStreakSnapshot→getPlayerCompleteChallengeSnapshot` rename (cosmetic; now reads non-streak columns) · CC tier/earnKey/challengeKey cross-validation (pre-existing trust hole — backend accepts mobile triplet without consistency check) · HTTP route-layer tests for the CC 403 body shape (no route-layer tests anywhere in `src/modules/me/`). |
| **B-S59-X1: `leveled_up` attribution is challenge-XP-driven only** | Streak-milestone XP grants that also cross a level threshold don't get a `leveled_up` activity_log row. Pre-existing semantic, documented. |
| **B-S59-X2: ActivityLogEvent.js header comment count off by one** | Pure doc nit, no functional drift. |
| **B-S53-2: Railway cold-start anomaly** | Idle service → 26s/128s/250s response times + intermittent 401 from JWT TTL expiring mid-wait. |
| **B-S53-3: `setBackgroundMessageHandler` is a no-op** | Silences the warning only. Future: log killed-state events to AsyncStorage for replay. |
| **§B-12 Layer 2 alliance broadcast smoke pending (opportunistic)** | Alyona-side push receipt for the 3 S57 broadcast wires. Alyona is on the S57+ build, so only the alliance-action trigger is opportunistic. |
| **Nested / overlapping SPB territories** | Spotted on phone visual test after gap-fill propagation. Some gap-fill blocks overlap each other and/or existing OSM-named SPB territories. Root cause unknown. Diagnostic query needed: find pairs where `postgis.ST_Overlaps(a.geom, b.geom)` or `postgis.ST_Contains(a.geom, b.geom)` is true beyond a tiny tolerance. |
| **Zoom-level rendering: some small polygons missing at wide zoom** | At Mapbox scale ~500m/750m, some territories that exist in DB don't render; at tighter zoom they show. Hypothesis: `ST_SimplifyPreserveTopology` tolerance collapses small polygons below `ST_NPoints >= 4`. |
| **37 SPB gap-fill blocks flagged_oversize = true** | Perim > 8000m, manual visual review deferred. |
| **Some OSM POI names are bureaucratic asset codes** | e.g. 'Near СО17-2873 N' as a tier-2 landmark. Fix at frontend display layer (`formatTerritoryDisplayName`). |
| Diagnostic logs still in MapScreen.js | `[vp fetch] START / OK / ABORTED / ERROR / SKIP` + older `[geojson diag]`, `[shape source feed]`, `[feature builder]`, `[render]`. Keep until zoom-simplify + nested-territories bugs solved. |
| Dead RPCs in Supabase | `get_all_territories_meta` and `get_territories_geojson_batch` no longer called. Safe to drop. |
| `retry-failed-polygons.js` has hardcoded service role key | Local-only file (never committed) but key must move to env var before file ever leaves local machine. |
| Client Trust disabled in Clerk; email verification at sign-up deliberately skipped | (Updated Jul 5) SignIn has the email-code verification step wired (safe whether or not the instance requires it), but requiring verification at sign-up is deliberately OFF for friends-beta (reset-password flow proves inbox ownership). Revisit before public launch — `+clerk_test@` addresses w/ code 424242 keep test accounts easy. Also confirm "Reset password" is enabled in Clerk dashboard (default on). |
| Real step tracking in ActiveClaimScreen | (S31, S38) TaskManager + Health Connect drive the real 10s loop (the "DEV_MODE=true / fake interval" earlier note was outdated — that path was removed when TaskManager took over in S31). S38 fixed the rehydrate-vs-startClaim race in `lib/claimState.js`. Distance ring now advances correctly on device, screen-on + screen-locked-in-pocket. |
| Cascade auto-completion partially verified | Easy + Medium auto-completion verified mid-walk. Hard (15k) single-tick cascade unverified but very low-risk. |
| Steps (background read) permission not granted | Only required for true background reads when app is closed. |
| 3 of 4 ContestResultScreen branches unverified on device | Code wired for attack_won, attack_lost, defence_won, defence_lost. Only attack_won verified. |
| Onboarding home pin verification not implemented | 500m proximity check deferred. |
| **4 pre-HQ-feature alliances have NULL hq_territory_id** | (36) KAI, GGG, SNW, BUD founded before HQ designation existed. Not a bug in current code. Resolve by either leaving them, adding a "designate HQ retroactively" endpoint, or forcing re-founding. KAI used in S38 for transfer testing — confirmed NULL hq doesn't affect transfer endpoint. Defer. |
| **Slot-cap error (role_slots_full 409) not device-verified** | (36) KAI doesn't have enough members to fill slots. Backend test #8 in `promote.service.test.ts` covers it; client error path is identical to join-error path which is device-verified. |
| **GET /alliances?city=X endpoint not built** | (32+) Mobile browse list works via direct Supabase reads with `.is('disbanded_at', null)` + `.eq('city', playerHomeCity)`. Cleanup, not blocker. |
| **Mobile "TOP CONTRIBUTORS" and "MISSION" cards on MemberContent still stub UI** | (34+) Neither endpoint exists yet. |
| **Mobile "Detected city: X — correct?" UI in onboarding not wired** | (34+) `POST /me/home-pin` now returns home_city; mobile still ignores. Low priority since derivation is reliable. |
| **Spec §3.1 still describes "Home District" 5-nearest picker** | (33+) Columns dropped in S33, derivation auto-resolves in S34. Spec rewrite still pending (Home District = home city, not a territory). |
| **short_name re-use after disband not addressed in spec** | (32+) Currently blocked by UNIQUE constraint on alliances.short_name. Decide before launch: free up on disband_at OR keep permanent (Hall of Holders attribution). |
| ProfileScreen colour constants not on theme tokens | Refactor to lib/theme.js. |
| TERRITORY_CAP_BY_LEVEL duplicated | In MapScreen.js + ProfileScreen.js. Move to formulas.js. |
| lib/territory.js has no unit tests | Does Supabase I/O — mocking strategy is the gating decision. |
| player_number hardcoded as #0001 | Sequential column not yet added. |
| Siege XP constants — partial coverage | (S40-S44) **WRITERS NOW LIVE** for XP_PER_CLAIM (S41/S42), XP_PER_CONTEST_WIN (S41/S42), XP_PER_DEFENCE_WIN (S41/S42), and STREAK_MILESTONE (S43, +250 at days 7/14/21/30/60/90). Still no writers: XP_RECONQUEST (depends on reconquest tracking; schema is ready), XP_PER_DEV_TIER_REACHED (depends on Territory Development), XP_ALLIANCE_MISSION (depends on Alliance Missions module), XP_WEEKLY_BONUS (depends on weekly challenge system). Each unwired source is now a one-line hook at an existing callsite when its dependency ships. |
| **`total_xp` field in `/me/challenge-complete` response is stale on milestone days** | (S43, cosmetic) When a milestone fires, the HTTP response's `total_xp` is computed BEFORE the milestone `grantSiegeXp` so it lags by +250. DB state and activity_log rows are correct; response is one grant behind. One-line fix: `milestoneGrant?.newXp ?? updateResult.new_xp` when building the response payload. Deferred — out of S43 scope. |
| **Spec §8.1 internal contradiction (Solo-vs-Solo Only heading vs L4-5-can-attack-alliance bullet)** | (S44) Section §8.1 heading reads "Solo-vs-Solo Only" and L4 unlock copy says *"Alliance forces still can't touch you"* — implying symmetric protection. A conflicting bullet allows L4-5 solos to attack alliance territory. S44 locked Option A (stricter mirror-symmetric) in code; spec correction queued. Build behaviour: L4-5 solo attacker vs alliance territory → 403 `target_alliance_protected_from_solo`. |
| **§7.7 reconquest XP (+400 within 72h) not wired** | (S44) Backlog. Schema is ready: `territory_history.owner_id` (prior holder FK) + `lost_at` (nullable timestamptz). `flipTerritoryToAttacker` already sets `lost_at` on flip. Detection query: `territory_history WHERE owner_id = attacker_id AND lost_at > now() - interval '72 hours'`. Hook into `contest-walk.service.ts` attacker_won branch. Multiplier-aware path is live (S42) — slots into the same `calcContestWinXp(tier, opts)` shape. One-day slice. |
| **Stubs `isSupplyLineActive: false` / `isCityEvent: false` at 4 callsites** | (S42) Hardcoded literals at every claim/contest-walk/contest-expiry XP grant. Flip when Alliance Abilities (Supply Line, ×1.20 Siege XP) and City Events (×1.5 Siege XP) modules ship. One-line change per callsite. |
| Draggable bottom sheet deferred | gorhom/bottom-sheet — batch into next EAS build. |
| Invite non-player flow missing | No share/invite link flow yet. |
| POI icons on Standard night basemap | Currently overridden by `light-v11` dev style. Will resurface at polish phase. |
| `formatTerritoryDisplayName()` not yet written | Frontend display formatter — strip 'Near' prefix on tight surfaces, truncate long Cyrillic names, hide bureaucratic asset codes. |
| BullMQ delayed push jobIds use timestamp suffix | `quiet-${playerId}-${kind}-${Date.now()}` — edge case if same trigger fires twice within 1ms. Unlikely in practice. Real fix is contestId+kind suffix; non-blocking. |
| **Attack Day gate BUILT (Jul 3) but ships DEFAULT-OFF** | Sat+Sun-only contest gate (supersedes the old Wed/Sat/Sun doc TODO) is wired in contest.service.ts but only enforced when `ATTACK_DAY_GATE=on` (Railway env). **Flip ON at launch / before any external playtest.** |
| **ALLOW_DEBUG_ROUTES=true still ON in Railway** | (31c) Enables `/debug/*` in prod. Flip OFF before any external playtest. |
| **lib/challengeApi.js has no retry logic** | (31b) Single-shot POST — failed call reverts optimistic UI and returns. Player can re-tap or auto-complete refires on next liveSteps tick. Acceptable for MVP; revisit if flaky-network reports surface. |
| **New-timezone hot-registration not implemented** | (31c/31d) Player setting a new home pin in a tz nobody else uses won't get rollover/warning jobs until next backend restart. `bootstrapStreakRolloverJobs` runs once on Fastify ready. Acceptable for MVP — only matters when first player in a new tz signs up between restarts. Real fix: trigger bootstrap re-scan when `POST /me/home-pin` writes a tz not already in the registered set. |
| **City Event detection stubbed (`isCityEvent=false`) in calcChallengeXp** | Spec §6.4.3. Deferred until City Event infrastructure exists. |
| **Daily/weekly earn cap stubbed (`capFactor=1.0`) in calcChallengeXp** | Spec §13. Deferred. |
| **Resource earn uses flat table, not canonical earn** | Spec §5 +10% Committed-tier bonus not applied. Matches existing mobile behaviour for backend cut-over parity. Spec-alignment task deferred. |
| **Marshal-granted Grace Day not implemented** | (32–36) Marshal role now exists via `alliance_members.role`. Endpoint `POST /alliances/:id/grant-grace` not built; spec §4 mentions Marshal can grant. Deferred. |

---

## DEFERRED / OUT OF SCOPE

- Background step reads (`READ_HEALTH_DATA_IN_BACKGROUND` permission) — **REMOVED from manifest in S52a (B15)**. Producer scope is foreground only; revisit if "always-on tracking" feature lands.
- **iOS HealthKit integration** — the producer is Android-only (`react-native-health-connect@3.5.0`). iOS deferred to Slice 8+ (concurrent with kcal Phase 2), itself gated behind Activity Slice 7 smoke. No HealthKit library installed yet.
- **iOS push parity** — Notifications module shipped Android-only; revisit post-MVP alongside the first iOS slice.
- **kcal collection from mobile** — ✅ **SHIPPED Jul 3** with the 4-axis challenge redesign (producer reads ActiveCaloriesBurned + Distance, merges into 1-min buckets). No longer deferred.
- **Living Map: Attack Day atmosphere DEFERRED by user; ghost trails REJECTED by user** (walk-from-anywhere makes route trails semantically wrong) — do not build either without asking (Jul 2).
- **Command Post v2 panels (3 Intervention prompts, 4 Mission Command, 6 per-member opt-in)** — do NOT build without explicit go (Jul 1).
- **Medal-notification mute toggle DECIDED AGAINST** (Jun 28) — medal earns are rare + celebratory, always-on; do NOT build `players.medal_push_enabled`. Global Quiet Hours + 1/hour flood guard still apply.
- **Medal backfill script** — do NOT run `scripts/run-medal-backfill.mts` on this realm (user decision Jun 28: only test accounts exist, medals start fresh).
- **CC enforcement (reading `daily_steps`/`daily_calories` to gate challenge completion)** — D7 phase 2. ✅ **SHIPPED S62** (backend in-tx guard, 403 `daily_steps_under_threshold`/`daily_calories_under_threshold`). No longer deferred.
- **Activity-type classification (walking vs running vs cycling)** — out of Activity-module scope forever. §5.2 "Run 2km" challenge handled by separate GPS-verified path (deferred).
- **GPS coordinates / heatmap** — D10 locks: Activity never collects or stores GPS coordinates. Scalar `avgGpsSpeedMs` only. Future opt-in heatmap would be a separate module with own consent flow.
- **`activity_samples` retention policy** — B7. Operationally fine to keep all samples for first months. Define hot/cold/delete schedule before production launch.
- **Rate limiting on `POST /activity/steps`** — B12. Acceptable while mobile is the only client (producer-side rate-controls cap call rate). Add server-side rate limit before public launch.
- **Operator dashboard / fraud-review queue UI** — `activity_samples` queryable for ad-hoc review. Admin UI is separate ops project.
- **Backend `createMany` batching for activity sample inserts** — B14. S51 hotfix bumped tx timeout to 30s as surgical fix. `createMany` refactor would reduce per-batch tx duration; not urgent at current scale.
- ~~Alliance chat — post-MVP.~~ **SHIPPED S82** (CHAT_ROADMAP.md closed; module supports City Chat + Alliance Chat with Ably realtime + moderation + admin queue + archival cron + push w/ per-player toggle).
- Onboarding home pin 500m verification.
- **Phase 2 of SPB territory pool** — merging existing 485 sub-tier OSM-named SPB territories into the unified gap-fill pool.
- **Amsterdam gap-fill pipeline** — expected ≤30 new fill blocks. Run after SPB nested-territories cleanup proves the pipeline idempotent.
- Custom Mapbox night style swap-back (currently `light-v11` for dev).
- **Ably cache-invalidation hook in MapScreen.js** — when real-time multiplayer lands, subscribe to `territory:updated` channel and call `featureCacheRef.current.delete(territoryId)` on each event. ~1 hour of work; integrates with existing `handleTerritoriesRefetched(territoryId)` pattern.

---

## WHAT'S NEXT

**Module sequence (locked + actual): Progression ✅ → Activity ✅ (Slice 7 smoke pending) → Notifications ✅ → Defender Lifecycle ✅ (smoke pending) → Leaderboard ✅ → Chat ✅ (M2 EAS smoke pending) → then the Jun 23–Jul 5 launch-readiness burst: RLS lockdown ✅ → profile pictures ✅ → onboarding tightening ✅ → Honor Medals ✅ → i18n (ru) ✅ code-complete → public profiles ✅ → Command Post v1 ✅ → Living Map 1–3 ✅ → daily challenge redesign ✅ → first-run flow ✅ → account deletion + password flows ✅ → **alliance weekly tasks ✅ → territory development ✅ → security lockdown + perf/ops audit burst ✅** (Jul 5–7 — see SINCE JUL 5 block at top).**

**IMMEDIATE (Jul 5):**

1. **ONE Android app rebuild** (`npx expo run:android` locally or EAS — npm scripts switched to `expo run:*` at `4e0b118`), then the on-device verification bundle it unblocks: expo-image-picker (avatars), `scheme:'dominia'` (Google SSO), new HC perms (ActiveCaloriesBurned + Distance), ru locale rendering + C4 layout spots (warRoom header, chat SEND, АКТИВНОСТЬ tab), Living Map offset checks (pennant/base iconOffset, lineOffset inset direction, label/emblem collision, rampart legibility on smallest SPB territories), first-run walkthrough pointer coordinate spaces + scroll-reveal + MarkerView, Command Post smoke, delete-account modal, forgot/change-password flows, **(Jul 7) War Room abilities smoke — activate as Founder/Marshal, cooldown countdown appears on the button, active-buff line shows, Supply Line used/resets-Monday state, Attack Day card counts down + flips LIVE on a weekend (or with `ATTACK_DAY_GATE` off, test any day)**.
2. **Non-code externals:** Clerk dashboard — enable Google social connection (+ real OAuth creds for prod) + confirm "Reset password" on · Play Console — host a web account-deletion URL for the Data safety form · **native Russian review** of ru.json + push copy + brand transcreation (medal names, axis names Марш/Рейд/Муштра/Темп, emblem names) · flip **`ATTACK_DAY_GATE=on`** in Railway at launch · designer may replace the 7 emblem glyphs + base structure glyphs (swap points documented in lib files) · update mechanics doc §6 to the shipped 4-axis design.

**STILL-CARRIED S82-ERA SMOKES (unblocked by the same rebuild):**

1. **Three carried smokes — clear ALL THREE before next module work.** All currently rely on a single device run inside contest hours (05:00–22:59 local).
   - **(a) Chat M2 EAS standalone smoke (NEW S82, carry-forward `B-S82-OPS-m2-eas-smoke`).** Trigger EAS preview build on `dominia` HEAD `4e47f22`; install on Alyona OP7T. Walk path: nish_s on OnePlus 12 Metro dev client + Alyona on OP7T standalone, both in same alliance. Verify (i) chat send/receive end-to-end via Ably realtime echo (<200ms one device → other); (ii) `chat_alliance_message` push fires when one device sends to alliance, the other receives + foreground card OR background banner OR killed-state ChatScreen+ALLIANCE tab on tap; (iii) settings toggle to OFF on receiving device suppresses push but realtime still works; (iv) optimistic-insert + Ably echo dedupe (no ghost duplicates); (v) rate-limit banner after 6 sends in 30s; (vi) blur-time read-state PATCH (verify in Supabase `chat_read_state` table). Pass criteria: zero console errors, zero ghost dupes, push deep link lands on ALLIANCE tab.
   - **(b) Defender lifecycle device smoke (S74 carry, hard-ordered ahead at S75 plan).** Setup + scope unchanged from previous What's Next; full happy path + already-defended terminal + past-cutoff terminal + preview-retry + 8 submit-error code matrix. Defender Lifecycle still SHIPPED-PENDING-SMOKE until clean.
   - **(c) Activity Slice 7 device smoke (S66 carry).** Same nish_s device, same contest hours. Full happy path + insufficient_iron / level_too_low / outside_contest_hours inline error spot-checks. Activity Slice 7 NOT closed until verified.

2. **PROJECT_STATE.md cleanup after smokes pass.** Strip SHIPPED-PENDING-SMOKE status from relevant entries; close `B-S82-OPS-m2-eas-smoke` if (1a) passes.

3. **B-S65b-X-onboarding-hardening (b/c/d only, scoped down)** — still applicable, carried forward from S67. Small + contained.

4. **Carry-forward sweep.** Walk B-S82-* (chat — see Open Bugs row for full list, prioritise OPS items: chat-archive-monitoring, ably-realtime-disconnect-handling, keyword-filter-list once first reports land) + B-S73-X-* / B-S74-X-* (defender) + B-S62/B-S65a/B-S66 (older) — close anything that no longer applies; queue actionable ones for dedicated slices.

**Next-module kickoff candidates (post-smoke-closure):**

- **Chat Phase-2 fast-follow: `B-S81-FF-message-hide-on-confirm`** — adds `chat_messages.hidden_at` + filter at read paths; triggered when observed moderation load shows confirmed-but-still-visible messages causing user complaints.
- **Help Channel (`B-S81-PHASE2-help-channel`)** — separate Q&A channel without level gate; deferred until City Chat moderation load is observed.
- **Subscription module** — prerequisite for `B-S81-PHASE2-dms` (1:1 DMs). Larger module; sets up tier gating for premium features. Pre-launch consideration anyway.
- **Slice 8 — kcal Phase 2 (mobile + iOS HealthKit)** — HC ActiveCaloriesBurned read on Android + first iOS slice. Backend has accepted `kcal` since S49.
- **(Realm explicitly OUT of next-module sequence per Q-S81-B — corporate ops concept only, future realm = separate Supabase + Railway deployment, not a code module.)**

**Quick alternative picks if blocked on smokes:** (a) `total_xp` stale-response one-liner on milestone days (~15 min); (b) GET /alliances?city=X endpoint (~30 min); (c) reconquest +400 XP writer (§7.7, schema ready; **must also call `emitFirstEarnPush({source:'reconquest'})` — composer entry pre-staged from S60**, ~half-day); (d) test-row cleanup (B-S66-X-test-row-cleanup-deferred) now safe to run post-isolation; (e) populate `KEYWORD_FILTER_LIST` once first chat reports land; (f) any of the B-S62/B-S65a/B-S66/B-S73/B-S74/B-S82 backlog carry-forwards.

---

## BACKLOG

**Backend modules to land:**
- **Progression module** ✅ **CORE COMPLETE (S40-S44)** — Siege XP grants live across claim/contest_won/contest_held/contest_expired; streak milestone +250 XP at 7/14/21/30/60/90; solo protection enforced at contest initiate.
- **Activity module** ✅ **BACKEND TRACK COMPLETE (S46–S50), MOBILE PRODUCER LIVE (S51), SLICE 7 SHIPPED (S62–S65b, smoke pending)** — `POST /activity/steps` ingests 60s-windowed samples, validates D3/D4/D5, idempotent, atomic aggregate bumps; midnight rollover zeros aggregates per tz. **Slice 7 (CC enforcement + backend-authoritative claim/contest)**: `/me/challenge-complete` reads `daily_steps`/`daily_calories` in-tx to gate step/calorie challenges (S62); mobile flushes the producer before completing (S63); claim (S64) and contest (S65a backend + S65b mobile) cut over from direct Supabase writes to backend endpoints with snake_case CC-mirror envelopes + typed error codes. **Remaining:** device smoke (gates closure) → Slice 8 (kcal Phase 2 + iOS HealthKit).
- **Defender Lifecycle module** ✅ **CODE-COMPLETE S68–S74 (shipped-pending-smoke on `main`)** — Backend sub-slice 1 (G1–G5) + mobile sub-slice 2 (M1–M4) shipped across S69–S74. POST `/defend` + GET `/defend-preview` + alliance collective defense via `isAuthorisedDefender` + 75% attacker-progress cutoff + defender_notify push fan-out. Mobile DefenderAcceptScreen + `lib/defenderApi.js` + `extractParams` deep-link infra in `lib/notifications/route.js` + ContestResultScreen defender branches (STONE earned-beat). Remaining: S75 device smoke (gates module closure).
- **Notifications module** ✅ **COMPLETE & CLOSED (S53–S61b)** — foundation + 7/8 §B trigger wires + S61a killed-state nav fix + 12/12 device matrix. **§B-7 + §B-15 were carried on the B-S60-X2 carrier (Activity Slice 7) — now UNBLOCKED by the S64/S65 cutover; ship alongside their consumers.** Reconquest + alliance_mission first-earn emits remain pre-staged one-liners.
- **Leaderboard module** ✅ **SHIPPED S80** (`16930ac`). Territory + battles + power boards, players + alliances subjects. Sibling-precedent for the Chat module file naming + test patterns.
- **Chat module** ✅ **SHIPPED S82** (backend `c453da5`→`05cd372`, mobile `a18716b`→`4e47f22`) — see top of this doc for full ship register; M2 EAS smoke is the only remaining gate.
- **Jun 23–Jul 5 burst (all ✅ SHIPPED, see header):** RLS lockdown Phases 1+2 · profile pictures · onboarding tightening · **Honor Medals (Legacy Medal) module** (backend 100% G1–G8+G7, mobile M1–M3) · **i18n Parts A+B+C** (code-complete; ru native review pending) · public player profiles · **Command Post v1** (panels 1/2/5) · **Living Map Phases 1–3** · username uniqueness · **daily challenge redesign** (4-axis) · **first-run flow** · **account deletion** · **password flows**. Remaining gates are non-code (rebuild + on-device checks + ru review + Clerk/Play Console config) — see WHAT'S NEXT.
- **Jul 5–7 burst (all ✅ SHIPPED, see SINCE JUL 5 block at top):** **Alliance Weekly Tasks module** (leader-picked weekly challenge + Monday rollover + war chest) · **Territory Development module** (D0→D4 atomic develop + influence wallet + daily tick) · **first-run demo 3rd iteration** · **security lockdown** (RPC EXECUTE revokes + admin-gated debug routes + helmet/rate-limit/error-handler + `POST /me/debug-log` + npm audit fix) · **perf/ops audit burst** (projection trims, 11 N+1→set-based, graceful shutdown, contest-walk batching). Backend baseline 990 pass. Pending: `ADMIN_CLERK_IDS` on Railway + one rebuild for the mobile UI.
- ~~**Realm module**~~ — Out of code model per Q-S81-B (corporate ops concept only; future realm = separate Supabase project + Railway deployment, not a column).
- **Inactive-Founder auto-succession (30+7 day rule, spec §3.3)** — needs scheduled BullMQ job. Defer.
- **Recruit auto-promote on 3 consecutive challenges (§3.3 probation)** — lives in `challenge-complete.service.ts`, not alliance module.
- **HQ contest adjacency-first rules (§3.4)** — gated on contest spec re-read.
- ~~**Weekly alliance missions (§3.10)**~~ — ✅ SHIPPED Jul 5 as the **Alliance Weekly Tasks module** (`82305ee`+`629ee72`; 5-task leader-picked weekly challenge, Monday rollover, snapshot-fair). See SINCE JUL 5 block at top.
- **GET /alliances?city=X endpoint** — cleanup, not blocker. Mobile browse list works via direct Supabase reads.
- **Cross-player contest stress-test.** With Ably mobile client + push subscriber both wired, run a multi-player attack scenario end-to-end on two real devices.
- **`territory:updated` Ably channel** — publish from claim / abandon / contest resolve so mobile MapScreen can invalidate `featureCacheRef`. Gating the MapScreen GET /territories cut-over.

**Mobile migrations / hardening:**
- ~~Mobile "Detected city" UI~~ — ✅ DONE Jun 24 (onboarding validates + displays the backend-resolved city).
- **Mobile "TOP CONTRIBUTORS" and "MISSION" cards on Alliance MemberContent** — stub UI, no endpoints yet.
- **MapScreen from direct RPC → backend `GET /territories`** — cut-over when realtime invalidation via Ably is wired.
- ~~Direct `players.update()` calls → backend~~ — ✅ DONE Jun 24 (RLS Phase 2; all mobile writes are server-side; remaining `.from('players')` are READS under the anon SELECT policy).
- ~~Delete dead code `lib/streak.js`~~ — ✅ DELETED Jun 24 (RLS Phase 2 cut-over).
- **`formatTerritoryDisplayName` helper** — clean up bureaucratic POI asset codes, strip `Near ` prefix on tight surfaces, truncate long Cyrillic names.
- **Tests for `lib/territory.js`** — Supabase mocking strategy is the gating decision.
- ~~Daily Achievements live data~~ — ✅ DONE Jun 24 (`GET /me/activity-bests` + mobile wiring `3dc3048`).

**Resolved: the former “deferred to notifications consolidation session” bucket shipped in S53–S61b.** Only two items survive it, both gated on the B-S60-X2 carrier (Activity Slice 7): §B-7 streak XP bonus UI and §B-15 403 reject-message mapping.

**Backend hardening:**
- ~~Attack Day check~~ — ✅ BUILT Jul 3 (Sat+Sun only, supersedes Wed/Sat/Sun). Ships default-OFF; **flip `ATTACK_DAY_GATE=on` at launch**.
- ~~**Flip `ALLOW_DEBUG_ROUTES` OFF before playtest**~~ — largely superseded Jul 7 (`3653157`): debug routes now require `requireAuth`+`requireAdmin` via `ADMIN_CLERK_IDS`, not the env flag alone. **Still set `ADMIN_CLERK_IDS` on Railway** (nish_s) so the admin gate has an allowlist.
- **New-timezone hot-registration** — trigger `bootstrapStreakRolloverJobs` re-scan on `POST /me/home-pin` if tz is new.
- **Prisma migrations setup** — activity_log CHECK constraint at 20 event_types and growing; folder-per-migration convention (S58) covers the need for now, revisit a real tool if churn accelerates.
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
- **Velocity threshold inconsistency** — 30 km/h stated in three docs vs canonical 25 km/h in §14.1 (carried from Notifications close-out).

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
| **Activity module: samples + denormalised aggregate columns, not aggregate-only** | (S45 D2) Append-only `activity_samples` (audit, fraud-review queryable) + denormalised `players.daily_steps/daily_calories/weekly_steps_total/longest_session_min` (fast read path for CC enforcement). Both surfaces. Audit-friendly and O(1) at read time. |
| **Activity: per-window average velocity primitive `(steps × stride) / window_duration`, not derived-from-distance** | (S45 D3) Step-based credit needs step-based check. Single physics model across both step gates and GPS cross-check. |
| **Activity: steps required + GPS optional cross-check, stricter wins** | (S45 D4) Catches phone-shaker-in-car (GPS detects) AND indoor fake-step generator (steps detect). Either signal can reject; both must accept to credit. |
| **Activity: late samples (past local-day) stored with `rejection_reason='past_day'`, no retroactive credit by `windowEnd` in player tz** | (S45 D5) Closes backdate-streak-save exploit. Aggregate keyed off `bucket_ymd` denormalised at write-time from player home_timezone. |
| **Activity: per-sample client UUID via `sourceId` for idempotency, `@@unique([player_id, source_id])`** | (S45 D6) Handles HC multi-source overlap + offline replay + crash recovery. S51 elevated to deterministic SHA-256 over `playerId|windowStart|windowEnd` so the property survives buffer loss + OS kill. |
| **Activity: enforcement phasing — bookkeeping first (S46–S50), CC enforcement deferred (Slice 7)** | (S45 D7) Backend infrastructure ships first; CC gates on real beta sample-data review (P-5 rejection-breakdown query). Producer ships before consumer enforcement; data flows for ≥1 week before flipping the gate. |
| **Activity: shared `shared/formulas/velocity.ts` for cross-module constants and primitives** | (S45 D8 / S46) `MAX_PLAUSIBLE_KMH=25`, `MAX_PLAUSIBLE_MS=25/3.6` (derived, single source of truth), `SESSION_IDLE_THRESHOLD_MIN=15`, `DEFAULT_STRIDE_M=0.75`, `FUTURE_TIMESTAMP_TOLERANCE_MS`. Both contest-walk and activity import from here. Algorithmic helpers (canCreditSample, etc.) stay module-specific. |
| **Activity: no GPS coordinates EVER stored; only scalar `avgGpsSpeedMs` for velocity cross-check** | (S45 D10) Minimum HC/HK permission set. GDPR-aligned. Any future feature needing coordinates is a separate module with own consent flow. Enforced at the wire via zod `.strict()` schemas. |
| **Activity: paired UP/DOWN migration under `prisma/migrations-manual/<YYYYMMDD>-<description>/up.sql + down.sql`** | (S48) Round-trip verified against production Supabase before any code merge. Folder convention introduced this slice; supersedes S43's flat-file UP-only pattern. Lesson: when a slice raises the durability bar (rollbackable), establish the convention in that slice. |
| **Activity sibling-table precedent: `contest_walk_samples` is the schema spec for `activity_samples`** | (S48) Four schema decisions came from sibling precedent (id type, source_id as text, accepted/rejection_reason as separate columns, no DB-level CHECK for the XOR invariant). Lesson: schema-slice audit prompts must paste the closest sibling model verbatim and treat it as the spec. |
| **Activity: response envelope camelCase with three separate counters; duplicates NOT in `rejections[]`** | (S49 Q-E) `{acceptedCount, rejectedCount, duplicateCount, rejections:[{sourceId, reason}]}`. Duplicates are a normal idempotency outcome, not a rejection — keeping them separate avoids client logic conflating them with real velocity/window rejections. |
| **Activity: zod `.strict()` on the wire — deliberate deviation from repo convention** | (S49 Q-C) Repo otherwise uses non-strict zod. Activity deviates to enforce D10 (no coordinates ever). Deviation named in lock, commented in code, noted in commit. Lesson: sibling-precedent-wins is a strong default, not absolute — when a D-lock conflicts, the D-lock wins, but the deviation must be explicit. |
| **Activity: aggregate zeroing is SEPARATE tz-wide `updateMany` from per-player streak update, NOT folded into the existing rollover loop** | (S50 Q-A/Q-H/Q-M) Folding would miss the no-op-skip majority of players (most rollover players are no_op_* — they skip the DB entirely; folding aggregate zeroing into their streak update would silently miss them). Separate tz-scoped `updateMany` always touches every player in that tz, one DB roundtrip. Idempotent. Aggregate-zero failure logged but non-throwing — streak rollover correctness is preserved even if aggregate zeroing fails. |
| **`isMondayInTz(todayYmd: string): boolean` — pure helper over already-tz-local YMD string, DST-irrelevant** | (S50 Q-D) Originally locked as `isMondayInTz(tz, now?)`; refined during locks to take the already-computed `todayYmd` (worker has it; passing it in saves the Intl call and makes the helper DST-irrelevant by construction). Lesson: re-examine helper signatures during lock-down — a sibling-precedent signature isn't always right once the actual data flow is traced. |
| **Activity producer: module-level mutable state pattern (mirrors `lib/claimState.js`), NOT class or factory** | (S51 R.2) Repo convention. Producer exports methods directly. AsyncStorage buffer key `'dominia.activity.buffer.v1'`. Buffer cap 1000 FIFO. Write on every mutation (no debounce). |
| **Activity producer sourceId: deterministic SHA-256 over `playerId\|windowStartMs\|windowEndMs`, UUID-shaped 8-4-4-4-12** | (S51 Q-D) Computed once at window collection, stored in buffer, never regenerated on retry. Same physical window → same sourceId → backend dedupes via `@@unique` even if buffer is lost or OS killed the app. Absorbed three independent races in S51 device smoke without data-integrity impact. |
| **Activity producer: seven flush triggers** | (S51 Q-E) Periodic 2min (M), background, foreground-after-5min-inactive (N), network-restored (gated on `lastFlushFailed`), buffer-full=100 (matches D1 wire cap), startup-drain (rehydrated buffer non-empty), manual `flushNow()` (E.9, exposed for Slice 7 CC enforcement to call before challenge completion). Single in-flight via `flushInProgress` flag. Pre-flush guard skips if offline. 1-second trigger coalescing. |
| **Activity producer: single-batch-per-flush (`samples.slice(0, 100)`), not multi-batch sweep** | (S51 R.4) Worst case (1000-sample buffer) drains in 10 periodic ticks. Bounds tx duration to one D1 wire cap; backend `{timeout: 30_000}` covers it with margin. Multi-batch would risk runaway flush + ambiguous failure recovery. |
| **Activity producer: recovery sweep capped 6 hours back; cold-start first-collection = 5 minutes back** | (S51 R.5, R.6) Anything older than 6h is implicitly skipped (backend would reject as `past_day` per D5 anyway). 5-min cold-start range matches Q-E.3 foreground threshold — captures recent pre-launch activity without flooding. |
| **Activity producer: zero-step bucket filtering at sample construction (`buildSampleFromBucket` returns null when `COUNT_TOTAL === 0`)** | (S51 R.7) Avoids backend `window_too_short` rejections and wasted POST bandwidth. Filtered at the producer's enqueue layer, not at the wrapper. |
| **Activity producer: extract `lib/healthConnect.js` IN the producer slice, not deferred** | (S51 Q-K.7 Option B) Permission descriptor + grant filters were duplicated across ActivityScreen + HealthConnectDebugScreen + would have been 3rd copy in producer. 20-minute extraction in-slice prevented 3-copy drift forever. Naming made symmetric: `hasForegroundStepsRead` / `hasBackgroundStepsRead` (vs ambiguous `hasStepsRead`). Lesson: scope-discipline serves shipping speed; when extracting now vs forever-drift, take the in-slice cost. |
| **Activity producer lifecycle: `<ActivitySyncLifecycle />` null-render component in `App.js` inside `<ClerkProvider>`, outside `<NavigationContainer>`** | (S51 Q-I) Must access `useAuth().getToken` (inside ClerkProvider) and survive all routing (outside NavigationContainer). Resolves playerId via Supabase (mirrors AuthGate.js). Hosts AppState + NetInfo listeners. Account switch (userId change) triggers stop+start; sign-out triggers stop. |
| **Activity producer test strategy: pure-function extraction + 63 unit tests, all native integrations validated EXCLUSIVELY via device smoke** | (S51 Q-L) No `jest.mock`, no native-module imports in tests. Matches existing repo convention (`lib/formulas.test.js`). 411 mobile tests total (348 existing + 63 new), zero flake. Producer file, API wrapper, lifecycle component, HC/AsyncStorage/NetInfo/expo-crypto all validated only via 8-stage device smoke against production Railway. |
| **Activity producer: silent UX for every error condition** | (S51 Q-O) Existing ActivityScreen permission banner is the only HC-related UX surface; all producer errors are dev-side only (logcat, Metro console, Supabase SQL). Backlog items spawned for future UX: B16 (banner precision), B17 (external logging sink), B18 (sync indicator), B19 (persistent-failure alerting). Premise: a 60s-windowed producer cannot show user-actionable errors per-failure; aggregate failure detection is a separate ops project. |
| **Surgical Prisma `$transaction({timeout: 30_000})` bump over `createMany` refactor — fix in the slice that surfaces the failure** | (S51 hotfix, B14 deferred) 58-sample recovery batch hit P2028 default 5s timeout. Bump to 30s safely covers worst-case 100-sample batch at ~90ms/sample with margin. Deeper refactor (`createMany` + batched aggregate update) deferred to B14 — not urgent at current scale. Lesson: when a default-config limit surfaces under real load, prefer the surgical config fix; refactor when the surgical fix stops covering. |
| **Bug-discovered-mid-smoke decision matrix: cost-of-discovery + cost-of-deferral + cost-of-fix-now** | (S51 B13 deferred to S52a `9c97fe7`) Effect 2 race generated concurrent flushes in 3 of 8 smoke stages. Q-D absorbed all 3 — data integrity unaffected. Fix-now would have cost 30 min mid-smoke; ship-and-file cost nothing. S52a closed it in one targeted commit. Lesson: not every discovered bug earns same-session fix; data-integrity-protected cosmetic bugs can ship + backlog cleanly. |
| **Activity track sequencing: backend complete → mobile producer → CC enforcement gated on real beta data** | (S45–S52a) Slices 1–5 (S46–S50) shipped backend track to "ready and waiting" state. Slice 6 (S51) added mobile producer. S52a hardened it (B13/B15/B20). Slice 7 (CC enforcement) gates on ≥1 week of G2 beta sample-data review (P-5 query). Module enters consumer-flip stage only after producer proves stable. Lesson: when a backend module's full lifecycle ships before its producer integrates, "ready and waiting" is a valid state — the next slice can be externally triggered without backend coordination overhead. |
| **Notifications D1: channel routing table (kind → render) designed once for ALL kinds** | (S53) Pure `routeForPush(kind)` in `lib/notifications/route.js` over 4 outcomes: full-screen CARD, top TOAST, banner-with-route, feed-only DEFAULT. Every future push kind is a table row, not a new handler. Unknown kinds fall to DEFAULT — forward-compat verified end-to-end S61b. |
| **Notifications D4: feed = inbox = notification center, single surface** | (S53) No separate inbox screen. The persistent `activity_log` feed (player side-rail on Map + ActivityLogScreen; inline alliance wire in AllianceScreen) is the structural fallback for every push — dismissed/missed/killed-state pushes are still recoverable from the feed. |
| **Notifications D5: FcmLifecycle owns ALL FCM concerns; AuthGate is navigation-only** | (S53) Registration, onTokenRefresh cleanup, and the 3 push handlers (foreground/background/killed-state) live in one null-render component. Supersedes the S30-era "registerFcmToken inline in runGate" decision. |
| **D2 revised: player feed side-rail on Map tab ONLY, not all MainTabs** | (S55, B-S55-4) Original D2 put the side-rail on every tab; revised to Map-only. Hidden while TerritorySheet is open. |
| **Foundation-vs-consumption layering for cross-repo notification work** | (S53) Ship routing infrastructure first with synthetic smoke (`sendTestPush.ts` verified all routing outcomes BEFORE any real emitter existed), then surfaces, then real triggers. Each layer independently verifiable; doing all three at once tangles failure modes. |
| **Post-tx push composer pattern (S57/S58/S59/S60 quartet)** | One composer file per trigger domain (`alliance/`, `streak/`, `me/` for player-level meta-events); COPY table keyed by domain value; `if (!copy) return` gating; discriminated-union trigger type; trigger captured in outer-scope `let` inside the tx, emitted AFTER tx commit; `SKIP_<DOMAIN>_PUSH_EMIT` env bypass at entry; try/catch + `console.error` swallow around sendPush (push failure never breaks the game write); Promise.allSettled for multi-recipient fanout. Composer stays a dumb dispatcher — detection logic is the caller's. |
| **Activity_log event_type decision per trigger — three patterns, closest-sibling-by-shape wins** | (S57–S60) New event_type when the moment is a distinct feed-worthy row (streak_milestone, leveled_up); push-only with NO row when the moment rides on an existing event (streak_re_entry, all first-earn — the underlying territory_claimed/contest_won row preserves D4's feed-fallback); metadata flag on an existing row (least established, avoided). |
| **Distinct push kinds per source over aggregate kinds** | (S60 Q-B B2) `first_claim`/`first_contest_win`/`first_reconquest`/`first_alliance_mission` instead of one `first_earn`. Per-source Firebase delivery stats + per-source route targets justify distinct kinds even when render shape is shared. Route targets follow the COPY REGISTER (territorial copy → Map; alliance copy → Alliance), not placeholder guesses. |
| **Scaffold-all-sources / wire-live-writers-only for multi-source composers** | (S60 Q-A A2) FIRST_EARN_COPY holds all 4 spec §5.1 sources; only claim + contest_win have live writers. Reconquest + alliance_mission emits are one-line additions in those features' future writer slices. Sibling: S59 LEVEL_COPY with `if (!copy) return`. |
| **Response-side trigger fires ONLY when no push channel exists for the moment** | (S59 Q-E E1, cemented) §B-9 re-entry Toast + §B-11 grace-day Toast are response-side because no push exists; level-up 5/6/10 have pushes so NO response-side duplicate (double-render when push delivers foreground). L4 is the deliberate exception: in-app CARD via mobile direct invoke, no push at all. |
| **Mixed first-earn detection per source — use the cheapest correct primitive available** | (S60 Q-D D1) Claim: `tx.activity_log.findFirst` on prior `territory_claimed` inside tx (no counter column exists). Contest win: pre-tx `lifetime_contest_wins === 0` read (column exists since S40; race-safe via single-active-contest rule). Don't invent a uniform mechanism when per-source primitives differ. |
| **Detection-only for §B-8 break confirmation (in-app, NOT push)** | (S58, Q-A B1→B2-i revised after spec §4.5.2 verbatim audit) New `streak_broken_acknowledged_at` column + GET/POST endpoints + StreakBreakLifecycle component. Action-shaped POST for one-shot acknowledgement vs cursor-shaped PATCH for read positions. |
| **`xp_amount: 0` for meta-events, never null** | (S59) `leveled_up` rows are consequences of XP, not XP grants — write 0 (schema is non-nullable anyway) and put attribution in metadata. |
| **Folder-per-migration: `prisma/migrations-manual/<YYYYMMDD>-<desc>/{up,down}.sql`** | (S58 Q-J) Paired UP/DOWN per change; S43's flat file is the outlier, not the precedent. CHECK-constraint-only changes need no `prisma generate`; column adds need `db pull` + `generate` (two-step). |
| **No composer unit tests — Layer 1 smoke + 4-run regression baseline of existing suite is the verification bar** | (S60 Q-H H2, consistent S57–S59) Push-only composers have no DB delta to assert; copy drift is caught by device smoke. Service wiring verified via Layer 2 smoke OR code review + sibling-precedent confidence. |
| **Layer 2 smokes are opportunistic by design, not gating** | (S60 Q-K K1, S61b) Backend-writer→FCM verifications that need multi-step game state (alliance broadcast receipt, first_contest_win) ride on natural gameplay, never staged sessions. Module close-out criterion is the routing-surface matrix, which is structurally separate and fully verifiable. |
| **§B-7 deferred over dishonest UI** | (S60 Q-L L1) Showing "Proven streak: +15%" without backend authority over the actual XP grant (mobile writes flat XP via direct Supabase) would lie to the player. The label ships with the mobile→backend claim/contest migration (Activity Slice 7 / B-S60-X2 carrier). Honest carry-forward beats dishonest ship. |
| **Killed-state nav: reuse the existing `pendingTarget` deferral, don't build parallel machinery** | (S61a) `navigateToAfterAuthGate` lifts `tryDispatch`/`armStateListener` to module scope and adds a second entry point covering the "nav ready but stack still on AuthGate" gap. Effects 3+4 verifiable on OP12 Metro; Effect 5 ONLY on release-mode EAS (Alyona). |
| **Bundle EAS rebuilds with module close-out, not per-slice** | (S55/S61b) Preview rebuild #2 carried five sessions of mobile deltas (S57–S61a) to Alyona in one artifact. In-place install preserved Clerk session, HC permission, AsyncStorage buffer, and 7+ days of G2 data — rebuild/verify cycles don't disrupt accumulating producer state. When a module accumulates mobile deltas across sessions, plan one rebuild + full device matrix into close-out so killed-state never stays unverified. |
| **Single-author commits; ASCII multi `-m` default, UTF-8 tempfile `-F` only when needed** | (S60/S61) PowerShell `-m` mangles § and → to `?`. Default path: ASCII-only messages via `git commit -m "subject" -m "body"`. Unicode messages: UTF-8 no-BOM tempfile + `git commit -F`. Cursor's `Co-authored-by: Cursor` trailer is stripped via `git commit-tree` + `--force-with-lease` (single-developer repo). |
| **CC enforcement guard placed AFTER idempotent early-return, BEFORE grants** | (S62 Slice 7) `already_completed` re-POSTs skip enforcement (no false-rejection on replay); a real under-threshold throw rolls back the `insertPlayerChallenge` row. capFactor wires through BOTH XP and resources per §5.6.1 (calcResourceEarn was previously raw — now spec-compliant via calcCanonicalEarn). |
| **§13 cap bands in a new `shared/formulas/wellbeing-caps.ts`; tier thresholds in `challenge.formulas.ts`** | (S62 Q-I) Cap bands + `effectivenessForChallenge` are cross-module pure math (sibling to `velocity.ts`); STEP/CALORIE tier thresholds live next to XP_PER_CHALLENGE/RESOURCE_EARN. Session-cap explicitly OUT of Slice 7 (§13.6 only affects contest distance). |
| **Mobile `flushNow()` await placed inside the existing CC try block, before `backendCompleteChallenge`** | (S63 Q-A) Preserves optimistic UI (DONE shows instantly), reuses the existing R.3 non-throwing defensive umbrella with zero new error handling, and the single `onCompleteChallenge` funnel covers both auto-complete useEffect AND the manual button. |
| **Velocity MAX_PLAUSIBLE_KMH = 25 (25-vs-30 doc inconsistency resolved to 25)** | (S62 Q-C) Data-confirmed: only 3 velocity rejections in 11 days, single-device cluster. Doc cleanup (§14.1 + 3 refs) queued. |
| **Two-phase backend-authoritative claim: `/claim/start` (commitment fee + intent) + `/claim` (complete)** | (S64 Q-D) Preserves the gold commitment-fee anti-grief mechanic. DB-row-tracked `claim_intents` (Q-E) with single-pending-per-player + single-pending-per-territory partial unique indexes; reservation enabled (Q-H, pivoted from no-reservation after the "Player B walks 95% then loses to an earlier start" UX gap was surfaced). 60-min lazy expiry, no cron (Q-G). |
| **Snake_case CC-mirror envelopes + code+context typed errors across claim AND contest** | (S64 Q-B/Q-C/Q-I, S65a Q-B/Q-C) "Sibling precedent" = the most recent/active surface (CC is snake_case), resolving the backend's three reward-envelope dialects (CC snake_case, old claim camelCase, old contest-walk camelCase). Wrappers return parsed `{ok, status, code, context}` — diverges from challengeApi.js raw-body shape; sets the §B-15 retrofit precedent. |
| **No optimistic UI on claim/contest calls** | (S64 Q-N) `formulas.js` can't predict backend-authoritative XP (streak multipliers are backend-only), so a loading state matching existing null-gated chrome is used instead of a guessed delta. |
| **`LEVEL_UP_EVENT_LEVELS`/`LEVEL_UP_PUSH_LEVELS` exported from CC service for cross-module reuse** | (S64) Claim + contest reuse the S58/S59 split-leveled_up-row pattern instead of re-implementing it. Cross-module reuse flows from CC (the established surface) outward. |
| **Split B-S60-X2 into focused single-endpoint cutovers (S64 claim / S65a backend / S65b mobile)** | (S64 Q-A, S65a Q-A) The audit revealed the slice was far larger than the 2-3h estimate; splitting per-endpoint and per-repo-phase keeps scope bounded, risk low, and test cycles clean — mirrors S62's effective backend-first-then-mobile sequence with session boundaries. |
| **New foreground-only `lib/contestWalk.js` producer (not a reuse of `lib/activity.js`)** | (S65b Q-mobile-A) Cadence mismatch (30s vs 2min), different endpoint, screen-scoped ownership. Client-detected completion + immediate flushNow; backend stays authoritative on outcome (server-only reactive too slow at 30s). In-memory only — 30s max sample loss on app kill, persistence deferred to Resume-UX. |
| **SHA-256 sourceId deferred to `flushNow` (batched), buffer holds raw shape** | (S65b Q-mobile-C amendment) `expo-crypto` SHA-256 is async; hashing at enqueue forced a fire-and-forget IIFE that raced the synchronous threshold check. Deferring hashing to a `Promise.all` batch just before POST keeps `enqueueSample` sync and the public contract unchanged. |
| **🚨 Test-DB isolation: local Docker Postgres with a three-layer DATABASE_URL guard** | (S66 Q-66-A..I) After the TRUNCATE-CASCADE wiped production, backend tests now run against `postgis/postgis:16-3.4` on `127.0.0.1:5433`, auto-bootstrapped by `scripts/run-tests.mts`, schema via `prisma db push` (Q-66-H pivot — the baseline schema lives in `schema.prisma`, not migration files). Guard: wrapper pre-flight + `node:test --import` re-validation + container bound to 127.0.0.1 + destructive-op grep. `.env.test` gitignored. |
| **`--test-concurrency=1` + `uniqueShortName` helper; TRUNCATE-in-parallel-tests prohibited** | (S65a) The parallel-execution race on the alliances table (and the TRUNCATE that hit prod) is fixed by sequential execution + per-run unique short_names across the 8 alliance test files (closed B-S64-X3). CASCADE wipes shared seed data durably — sequential execution OR per-test cleanup only, never TRUNCATE. |
| **`tsc --noEmit` mandatory on test-touching passes too** | (S65a) `tsx`/`node --test --import tsx` type-strips at runtime; only full `tsc` rejects what Railway will. Skipping tsc on test-only changes was the single largest escapes-to-Railway gap-class in the contest slice. |
| **Onboarding-hardening scoped to b/c/d only; (a) AuthGate missing-row fallback skipped** | (S66→S67) The restored DB + S66 test isolation make the missing-row defensive net redundant; (b) silent-fail retry, (c) playerId nav-param, and (d) clerk-id drift detection are real bugs worth fixing regardless. |
| **Test-row cleanup DEFERRED until after isolation ships** | (S66 Q-66-I) Running the cleanup before isolation would let the next test run repopulate the rows; and the FK graph has NO-ACTION constraints on territories needing a full FK-ordered delete. Safe to run only post-S66. |
| **Defender lifecycle decomposed: 2 sub-slices, then 9 atomic groups** | (S68→S74) Original `B-S65-X-defender-lifecycle` slice estimate at S65 close was "6–8 hours, 12–18 decision locks" — the actual audit at S68 revealed backend was ~80% complete already (`POST /defend` exists, `WalkRole` typed, schema ready) and the slice was mobile-heavy with targeted backend additions. Split into `B-S68-A-defender-backend` (5 groups G1–G5: error normalization / alliance-id population / auth widening + cutoff / push fan-out / defend-preview endpoint) and `B-S68-B-defender-mobile` (4 groups M1–M4: api client / accept screen / push deep-link infra / role plumbing + result branches). One group per session keeps scope bounded and tests clean — mirrors the S64/S65 backend-first-then-mobile sequence. |
| **Push is the only defender activation surface; `attacker_first_walk_at` always non-null by defender entry** | (S68 locked design invariant #1) Future surfaces that expose contests pre-walk must re-examine Q-68-F3 (cutoff applies only at /defend, not /walk). |
| **Backend infers defender role from auth + contest participant lookup; mobile never passes role to backend** | (S68 invariant #2) `WalkRole = "attacker" \| "defender"` typed at `contest-walk.service.ts:69`. Mobile DOES pass `role` as a nav-param between SCREENS per Q-M-H + Q-M4-B for client-side rendering only — backend remains role-agnostic from nav-param perspective. |
| **Alliance membership checked live at `/defend` only, never again on `/walk`** | (S68 Q-68-F2 invariant #4) Defender who leaves alliance mid-walk completes the defense. Time window enforcement (75% attacker progress cutoff) happens at `/defend` only — once defender has accepted, no time check on subsequent /walk. |
| **Defender auth gate is single-source-of-truth via `isAuthorisedDefender(player, contest)`** | (G5 Q-G5-H invariant #8) Pure helper in `contest-defend.queries.ts`; both POST /defend and GET /defend-preview consume it. Future surfaces that need "is this caller authorised to act on this contest as defender?" MUST use the helper, not re-implement the check. |
| **`GET /contests/:id/defend-preview` returns 200 for active-but-defended state (`status:active` AND `defender_player_id !== null`)** | (G5 Q-G5-D invariant #9) 409 reserved for non-active contests. Mobile renders the "already being defended" terminal UX from payload `defender_player_id` + `defender_username` fields, NOT from a 4xx error. `ContestAlreadyDefendedError` is thrown only by POST /defend, never by preview. |
| **`extractParams(data)` per `ROUTE_TABLE` entry is the single source of truth for push payload → nav-params mapping** | (M3 Q-M3-A invariant #10) `routeForPush(kind, data)` returns `{ surface, target, kind, params }`. Kinds without `extractParams` default to `params: {}` (backward compat). Backend `baseData` uses **camelCase** (verified from `contest-walk.service.ts` L218/L642-645) — `defender_notify` extractParams is `(data) => ({ contestId: data?.contestId })`. Mobile route table lives at `lib/notifications/route.js`, NOT `lib/route.js` (corrected from S73 roadmap reference). |
| **DefenderAcceptScreen `route.params` contract is `{ contestId }` only — all other data fetched on mount** | (M2 Q-M-B + Q-M-E + Q-68-F1 invariant #11) Future surfaces deep-linking to defender accept must respect this minimal contract; do NOT add fields to extractParams without revisiting Q-M-B. Cheapest minimal contract — 200 payload error states (already-defended, past-cutoff) render terminal UX from `GET /defend-preview` envelope, not from 4xx codes. |
| **Snapshot defender threshold at accept-time (not dynamic)** | (M2 Q-M-H invariant #12) M2 passes `requiredWalkM = floor(selectedRatio × attacker_walked_m)` to ActiveClaim on POST /defend success. Acceptable per Q-68-H3 deferral — continuous catch-up scaling is the natural endpoint that supersedes the snapshot. Carry-forward `B-S73-X-defender-threshold-display-policy` tracks the dynamic-update slice when H3 ships. |
| **ActiveClaimScreen `role` nav-param defaults to `'attacker'`** | (M4 Q-M4-B invariant #13) MapScreen attacker contest nav site does not pass `role`; default preserves backward compat. DefenderAcceptScreen passes `role: 'defender'` explicitly. Backend remains role-agnostic from nav-param perspective; role is inferred server-side per invariant #2. |
| **Backend `WalkResolvedResult` envelope is symmetric across roles** | (M4 Q-M4-A invariant #14) Both `attacker_walked_m` and `defender_walked_m` present in every resolved walk envelope; `resources_awarded { iron, stone, gold, morale }` same shape regardless of outcome; both `first_contest_win` (attacker analog) and `first_defence_win` (defender analog) present. Mobile reads role-appropriate fields per Q-M4-D. Future contest-result surfaces should use this symmetry rather than role-conditional backend variants. Defender rewards differ in resource shape (verified from `formulas.js` L152-153): `contest_win: { iron:15, stone:0, gold:25, morale:8 }` vs `defence_win: { iron:0, stone:20, gold:15, morale:8 }`. Iron↔Stone swap; both award Morale. |
| **Defer `firstDefenceWin` plumbing on dead-code surface; ride pre-existing `firstContestWin` TODO closure** | (M4 carry-forward `B-S74-X-first-defence-win-plumbing`) Pre-existing TODO stub at ContestResultScreen L131-134 voids `firstContestWin` downstream; plumbing the symmetric `firstDefenceWin` now would expand the silent dead-code surface. When first-win UI ships for attacker, slot in the defender analog using the symmetric `first_defence_win` field already present in `WalkResolvedResult`. |
| **One atomic group per session under sequential decision locks (defender lifecycle methodology)** | (S68–S74 throughout) Roadmap review → read-only audit Cursor prompt → open questions resolved via labeled decision locks (Q-X-A/Q-X-B/…) with explicit single-confirmation per step → 4-run zero-flake baseline validated BEFORE code changes → implementation Cursor prompt (structural discovery first) → separate test prompt against landed code (3a/3b split prevents type-signature drift) → commit → push → Railway healthcheck green → roadmap update + session handover. This methodology is now the project's standard for any module with cross-session scope. |
| **Chat scope locked to City Chat + Alliance Chat at v1 (Q-S81-A)** | (S82) Help Channel deferred until City Chat moderation load is observed (B-S81-PHASE2-help-channel). 1:1 DMs deferred to post-Subscription module (B-S81-PHASE2-dms — subscription-gated). Event-scoped ephemeral rooms out of v1 (B-S81-PHASE2-event-chat). Lowest-friction shipping path that still unlocks the two highest-value chat surfaces. |
| **Realm removed from code model (Q-S81-B)** | (S82) Single-instance backend architecture; `realm` not added as a column anywhere. Future realm = separate Supabase project + Railway deployment (corporate ops concept). Removed from this doc's module list + BACKLOG at chat module-close per carry-forward `B-S81-OPS-realm-removal-state-cleanup`. |
| **Ably for chat realtime (extends existing `contest:<id>` namespace, new `chat:${room_id}` namespace)** | (S82 Q-S81-C) Already on stack; free-tier 200 channels / 200 connections sufficient for friends-beta. Mobile uses scoped token auth with per-room capability allowlist (`POST /chat/ably-token`, 1h TTL via `Ably.Realtime` authCallback for refresh). No new realtime infrastructure needed. |
| **City keying via existing `players.home_city` text (no new `cities` table)** | (S82 Q-S81-D) Sibling-precedent: alliance browse already uses `.eq('city', playerHomeCity)`. City rooms upsert lazily on first reference (one row per distinct city). Saves a table + an admin pre-seed step. |
| **Explicit `chat_rooms` table, city + alliance rooms are PEERS (not hierarchical)** | (S82 Q-S81-E) Composite UNIQUE on `(room_type, room_key)` for collisions. A player in Amsterdam + SNW alliance has access to two independent rooms. Hierarchical (alliance-inside-city) would have made multi-city alliances impossible. |
| **Alliance rooms eager-on-founding tx; city rooms lazy-upsert on first reference (Q-S81-F)** | (S82) Founding tx already touches multiple tables — one more insert via `insertAllianceChatRoom(tx, allianceId)` is free. City rooms eager-create would require an admin pre-seed or a "first ever player in this city" detection; lazy upsert sidesteps both. |
| **City messages 30d → archive table (daily UTC cron); alliance messages permanent until disband (Q-S81-G)** | (S82) City churn is high (potentially every player in city) — bounded retention keeps hot table small. Alliance churn is low (bounded by 20-member cap) — full history serves the small-group continuity model. Disband-tx archives the whole room in one atomic step. |
| **Global mute via `chat_mutes` audit table + cached `players.chat_muted_until`; 30-day rolling strike window; 24h@3, 48h@5 (Q-S81-H)** | (S82) Audit table is source of truth; player column is a denormalised mirror for hot-path mute check (read in postMessage's mute guard). 30d window prevents stale strike accumulation; 3/5 thresholds match LSS pattern. Counter includes the just-applied strike; non-mute strikes insert audit-only row. |
| **Skeleton-faithful moderation: regex filter + human report queue + admin Clerk allowlist (Q-S81-I)** | (S82) Filter rejects at write boundary (422 message_filtered, no DB row). Reports queue in `chat_reports` (idempotent on reporter+message). Admin Clerk allowlist via env var (`CHAT_ADMIN_CLERK_IDS`) — no DB role table. Empty starter keyword list (Q-G2-B) so filter is a no-op until populated from observed beta load (B-S82-FF-keyword-filter-list). |
| **Alliance chat push only at v1; City chat push deferred to @mention-only post-launch slice (Q-S81-L)** | (S82 G4) City chat would generate too much push volume without @mention filtering. Per-player `players.alliance_chat_push_enabled` toggle (default true) honored at enqueue. Sender skipped. Quiet hours + stale token handling come for free via existing `sendPush`. |
| **Mobile API client mirrors `lib/leaderboardApi.js` (NOT contestDefendApi.js)** | (S82 M1) Cleanest sibling for read-heavy GET endpoints. `contestDefendApi.js` has body/non-body request variants and slightly different log conventions. Wire format snake_case passed through to screen — no camelCase conversion (matches contestDefendApi shape, diverges from activityLogApi's camelCase shape; the latter is a one-off for that endpoint). |
| **Inverted FlatList for chat (Q-M1-D)** | (S82 M1) Newest at bottom is the chat-app convention; the known iOS/Android inverted issues primarily affect content insets in conjunction with KeyboardAvoidingView — inert in M1 (no composer) and mitigated in M2 (KeyboardAvoidingView with platform-padding behavior, no complex insets). |
| **`client_temp_id` for optimistic-insert dedupe across HTTP response + Ably echo (Q-M2-C)** | (S82 M2) Client generates `tmp-<base36-ts>-<base36-rand>` before POST. POST response replaces optimistic row preserving the client_temp_id. Ably echo arrives with the same client_temp_id (server echoes it in the publish payload via the chat-ably composer). Mobile dedupes by matching against existing rows' `client_temp_id`. Avoids ghost duplicates regardless of which arrives first (HTTP response or Ably echo). |
| **Mutable-publisher test injection pattern (replaces SKIP_*_PUSH_EMIT env var)** | (S82 G2 chat-ably.ts, G4 chat-push.composer.ts) Each side-effect (Ably publish, token mint, push emit) lives behind a `let active* : Fn = production*;` slot with `__set*ForTesting(stub)` + `__reset*ForTesting(prev)` helpers exported. Tests capture invocations + assert on them. Cleaner than the alliance-push composer's env-var bypass — no env mutation, exact call-capture semantics, no risk of forgetting to unset. New pattern is the project standard going forward for side-effect-emitting modules. |
| **Admin code split into `chat-admin.{routes,service,middleware}.ts` (S82 G3 implicit lock)** | Keeps admin authorization (`requireChatAdmin` env-var allowlist) isolated from player-facing chat code. Lets G4 add `GET /admin/chat-reports` (queue read) without touching the player-facing routes file. Pattern worth reusing for any future "ops surface" module. |
| **Daily UTC cron for chat-archive (not per-tz like streak-rollover) — Q-G4-A** | (S82 G4) Streak rollover cares about local-day boundaries (per player tz); archive housekeeping doesn't care about local time. One global cron `0 3 * * *` UTC with jobId `chat-archive-daily-utc` (stable, makes re-bootstrap idempotent). 03:00 UTC is mid-night for Europe and afternoon for US — low traffic globally. |
| **PATCH /me/alliance-chat-push-enabled added inline during M2 (Q-S82-implicit)** | (S82 backend prereq `05cd372`) G1 added the column without a way to flip it from the client; discovery at M2 audit. Adding inline rather than punting to a follow-up keeps the M2 settings toggle functional at ship. Sets precedent: when M-slice audit surfaces a missing backend prereq, ship the prereq inline as a separate commit rather than half-shipping the UI feature. |
| **RLS on everywhere + all writes server-side ("Option B"), not Clerk→Supabase JWT RLS** | (Jun 23–24) Anon key shipped in the app had full CRUD on every table — anyone could write any row. Clerk JWT isn't wired into the Supabase client, so owner-scoped RLS wasn't possible; moving writes behind the backend (which bypasses RLS as `postgres`) closed the hole with zero mobile-auth work. Mobile keeps anon SELECT for reads. |
| **Session pooler (5432) for the backend, not transaction pooler (6543)** | (Jun 23) A persistent Node server belongs on the session pooler; 6543 is for serverless. Plus pg pool hardening (`keepAlive`, idle/connection timeouts, statement_timeout 20s) against silently-dropped idle pooler connections. |
| **Activity ingest: classify in memory → one `createMany` + ONE combined players UPDATE** | (Jun 24 `de86364`) The old per-sample loop held the player-row lock 15–30s per batch → P2028 on claim/donate. Root-cause fix, not the tx-timeout band-aid. |
| **Clerk-hosted avatars, not Supabase Storage** | (Jun 24) Clerk's free CDN resizes via `?width=` at $0 egress; Supabase resize is Pro-only. `imageUrl` cached to `players.avatar_url` so chat/roster/leaderboards don't call Clerk per row. Roster avatar slot deliberately zeroed (founder choice); backend returns it there anyway. |
| **Usernames stored UPPERCASE + case-insensitive unique `lower(username)` index** | (Jun 24 + Jul 3) Every display surface consistent, identity case-insensitive; functional index closes the concurrent-insert race; `PATCH /me` maps P2002 → 409. |
| **Value-first onboarding: pitch BEFORE the auth wall (WelcomeScreen)** | (Jun 24) New users were hitting sign-up before seeing any game content — top drop-off suspect. Onboarding trimmed to 3 account-bound steps; real resolved city + real nearby-unclaimed count replace fabricated payoff copy. |
| **Honor Medals replace §9.3 Legacy Titles; system name stays `legacy_medal`** | (Jun 28) 16 medals / 4 categories; schema = stats table + earnings event table; only the UI header says "HONOR MEDALS" — `medal_key` namespace (`combat.conqueror` etc.) unchanged. PHOENIX/ETERNAL/TIME SERVED backfill=0 (no history tables — activity_log `streak_broken` is the streak-history source; no new table needed). |
| **Medal earn celebration rides the existing FCM/card stack, NOT Ably** | (Jun 28) G7 push already carries medal data — no new channel/token work. 3 `legacy_medal_*` kinds → CARD surface → deep-link to Profile. |
| **i18n: English-plumbing-first, then Russian as clean follow-up** | (Jun 29) Migrate all strings to keys with zero user-visible change first; de-risks the big migration from translation-quality work. Push copy translated per-recipient at compose time via `players.locale`; brand transcreation via `$t:<key>` param nesting; territory names (OSM proper nouns) never translated; DOMINIA wordmark stays Latin. |
| **Public profiles: mobile-only direct reads, no new backend endpoint** | (Jun 30) Mirrors existing read patterns; `GET /players/:id/profile` is the migration path if reads ever get locked down. Roster: tap → read-only profile, long-press → management modal (modal deliberately restored as the single management surface, `16232a4`). |
| **Command Post v1: Founder-only, pull-only, existing data only** | (Jul 1) Server-enforced via `alliances.founder_id` (zero migration); no founder FCM push; lapse N=3d / recruit 7d / stall grace 2d in constants. Panels 3/4/6 deferred pending explicit go. |
| **Alliance gate lowered to L3; solo phase ends at L3** | (Jul 2 `507edde`) Beta-sizing decision so founders reach the alliance surface sooner. |
| **Home-base coords snapped to ~250m grid SERVER-side; 45d dormancy window** | (Jul 2) Raw home pins never leave the DB (privacy); own base re-anchored to exact pin client-side only for the owner. Emblems: founder-chosen at founding, unchangeable after, non-unique across alliances; existing test alliances stay on the vanguard default (no re-pick surface). |
| **Daily challenges: 4 axes, player picks ONE per day (lock on first completion)** | (Jul 3) Axes are physically correlated (one walk = steps+distance+kcal) — lock-in prevents triple-dipping; daily ceiling = one axis ladder = same economy as the old 3-task system. Theme day ×1.5 on axis primary resource only; ActiveCaloriesBurned NOT TotalCalories (basal kcal would auto-complete tiers); tempo derived server-side from session distance/time (no Speed permission). |
| **Attack Days = Sat+Sun only; weekends streak-neutral; gate ships default-OFF** | (Jul 3) Supersedes doc v6.10's Wed/Sat/Sun. No challenges Sat/Sun — weekends free for war; Fri streak carries to Mon; milestones counted in task-days. `ATTACK_DAY_GATE=on` at launch. |
| **First-run walkthroughs: tap-driven, NEVER timer-driven; resource education via earn-moment toasts only** | (Jul 4) Russian strings run 20–30% longer — timers rejected. One fires-once toast per resource at the earn moment, never in walkthroughs; objective highlight uses claim red (no gold — brand colours only). First-claim objective never re-runs once held_count > 0 (incl. reinstalls). |
| **Account deletion: one-tx purge + territories to neutral + founder auto-succession; Clerk delete AFTER the tx** | (Jul 5) Play Store requires in-app deletion. Map is never deleted — territories release to neutral. Founder-with-members auto-promotes highest-ranked longest-tenured member; solo founder disbands. Idempotent retry covers partial Clerk failure. **New NoAction-FK tables must be added to `purgePlayerData()`.** |
| **Password flows via Clerk custom flows; no email service; sign-up verification skipped for friends-beta** | (Jul 5) Clerk sends reset emails itself (no SendGrid/Resend). Reset flow proves inbox ownership; keeps onboarding short. Change-password hidden for SSO-only accounts (`user.passwordEnabled`). Revisit verification before public launch. |
| **War Room abilities server-authoritative; client sends only the ability id** | (Jul 7) The old `POST /alliances/:id/morale/spend` trusted a client-supplied amount (a modified client could "activate" for 1 morale) and applied no effect. Replaced by `POST /alliances/:id/abilities/:ability/activate` — the server prices from `ability.catalog.ts` and deducts. The morale UPDATE runs first inside the tx so the alliances row-lock serializes concurrent activations, making the cooldown/week-limit check race-safe. Founder+marshal only (matches the "FOUNDER · MARSHAL ONLY" copy; the old RPC allowed any member server-side). |
| **Unified Front removed from the ability set** | (Jul 7, user decision) Dropped to 5 abilities; the streak-protection effect had no backend hook and no clean anti-abuse story. Removed from the catalog CHECK constraint, both locales, and the mobile list. |
| **Ability windows reuse the Attack Day calendar + ATTACK_DAY_GATE; cooldown/week-limit always on** | (Jul 7) The 4 combat abilities are weekend-only (Sat/Sun) with an 8h per-ability cooldown; Supply Line is weekday-only (Mon–Fri), once per Monday-anchored calendar week in the leader's home tz. Window enforcement gates on the same `ATTACK_DAY_GATE` env as the contest gate (off in dev so any day is testable; on at launch); the 8h cooldown and the once-per-week limit are enforced regardless. Cooldown + week-limit are DERIVED from the latest `activated_at` — no state column to go stale. |
| **Supply Line boosts BOTH XP and resources (+20%)** | (Jul 7) The locale copy said "resources" but the existing formula hooks (`SUPPLY_LINE_BONUS_MULT`) were XP-only. Applied to both (challenge/claim/contest/defence earns) and updated the copy, since a resource-only reading would leave the pre-built XP hook dead. Routed through `calcCanonicalEarn`'s bonus_product on the challenge path so the global ×3.0 earn ceiling still holds; flat-reward paths (contest/defence win) scale via `scaleResourcesForSupplyLine`. |
| **Attack Day countdown computed client-side from the device clock** | (Jul 7) The card mirrors the backend 05:00–23:00 weekend contest hours but computes locally off the same 10s `nowMs` tick as the ability timers — no server round-trip for a countdown. Diverges from the backend's home-tz basis only when the player is physically travelling across timezones, which matches how the rest of the War Room screen already behaves. |

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
- **4-run zero-flake test baseline before any commit.** A single clean run is not sufficient. When the full backend suite carries pre-existing flake/timeouts, run the narrow-scope file set 4× instead — confirms the new work without conflating with known noise.
- **Resolve spec contradictions via decision locks BEFORE any code is written.** Spec verbatim audit across ALL sections that mention the moment (not just the most-cited one), flag every contradiction, lock one interpretation, queue the spec correction.
- **`npm run build` after EVERY Cursor prompt that touches a `.ts` file** — including tests, helpers, and types. Local `tsx` is type-stripping; only full `tsc` catches what Railway will reject.
- **Never guess FCM kind names or metadata keys.** Audit `lib/notifications/route.js` before constructing push tests; run `jsonb_object_keys` before writing feed renderers. Wrong kinds fall silently to DEFAULT_ROUTE and mask what the test proves.
- **Require Step 0 shape-verification in every Cursor implementation prompt.** Cursor's audit catches planning assumptions that don't match actual code shape (file layout AND data shape) — when it flags a mismatch, PAUSE and revise the prompt before proceeding.
- **🚨 Production data integrity is top-of-stack.** Any test-infra change touching shared resources must explicitly verify isolation before approval. "Test DB"/"shared test DB" terminology is forbidden unless a separate database demonstrably exists and is configured. When backend tests share infra with prod, every run is a potential catastrophic event — a destructive op committed + run once = durable loss even after the code is reverted. **TRUNCATE/DROP/sweeping-DELETE in tests is prohibited;** sequential execution (`--test-concurrency=1`) or per-test cleanup only.
- **`npx tsc --noEmit` is a pre-test gate on EVERY pass, including test-only/fixture/helper changes** (S65a). `tsx` type-strips; only `tsc` rejects what Railway rejects.
- **Test-discovery validation is distinct from test-pass validation** (S65b). A 100%-passing file outside Jest's `**/__tests__/**/*.test.js` is silently invisible — confirm the default runner picks new files up before declaring tests done.
- **Under pure CJS Jest + zero mocks (S51 Q-L), ESM source files need the `fs.readFileSync` + `new Function` loader with stub injection;** CJS lib files test with normal `require()`. Put helper extractions in CJS-style files when testability matters. And VERIFY a sibling exists before citing it as precedent (S65b: `claimApi.test.js` was assumed but didn't exist).
- **Persisted client-side auth (Clerk SecureStore) masks server-side data loss** — cross-check server state when diagnosing auth/onboarding UI bugs.
- **Prior-session summaries can carry factual errors** (esp. infra descriptions like "test DB") that propagate — cross-check against actual configuration when they materially affect a decision.
- **Verify the schema source of truth in prod (schema.prisma vs migration files vs hybrid) BEFORE designing any test bootstrap** (S66). Dominia's baseline lives in `schema.prisma`, so `prisma db push --url <test>` is the bootstrap (a wrong assumption cost two iterations). `prisma db push` may read the datasource from a non-`DATABASE_URL` var (`DIRECT_URL`) — pass `--url` explicitly.
- **On Windows, `spawnSync({shell:true})` shreds multi-word args** — `shell:false` for `.exe` targets; `shell:true` only for `.cmd` shims (`npx`/`npm`) with flag-only args.
- **FK constraints with `NO ACTION` need children-first deletes** — map the full FK graph (`pg_constraint` join `pg_attribute`) up front; don't iterate one error at a time.
- **Reconsider a locked decision when the user (or the implementer mid-phase) surfaces a real-world gap the planner missed** — the Q-H reservation pivot (S64) and the Q-mobile-C SHA-256 race amendment (S65b) are precedents. Honest reconsideration beats stubborn commitment.
- **Cross-check ported constants against the mobile `formulas.js` source-of-truth** — don't alias a reward from a cost (S64 `CLAIM_GOLD_REWARD` would have zeroed the spec's intended cost-asymmetry).
- **When a file rename is tempting for symmetry (`claim.service.ts`/`contest.service.ts` → `*-complete`/`*-create`), defer it out of a behaviour-changing slice** — rename as a separate cleanup pass.
