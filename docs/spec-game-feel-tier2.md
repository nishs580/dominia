# Game Feel — Tier 2 slice

## Problem
Tier 1 gave reward moments weight, but the game still doesn't react where the
player lives: the board and the daily loop. A claim celebrates on a result
screen, then the map just… shows it, already done. Opening the app presents a
silent map with no situation report. Streak milestones — the mechanic the brand
"honours through precision, not praise" — grant +250 XP server-side and say
nothing in the app. Development is a digit ("D2") in a sheet.

## Goal
The board reacts to conquest, the app opens with the day's situation, and the
streak's biggest days get their ceremony.

## Out of scope
- Medal-earn takeovers — the Legacy Medal award path (LM Phase 1) is still in
  flight; ceremonies land with that system, not before it.
- Sound design (still needs a brand-brief amendment).
- Level-up takeovers on challenge completions — Activity already has the L4
  card and the backend L3/L5/L6/L10 pushes; unifying those is a later cleanup.
- Nearest-contestable-territory suggestion in the daily brief (needs a new
  backend query; revisit with retention work).
- Ghost trails, Attack Day map effects (excluded since Living Map).
- Any change to streak rules, milestone days, or XP values.

## User stories
- As a fitness-motivated adult who just took a territory, I want to see it fall
  on the map itself — camera flies there, the ground floods claim red — so the
  board feels like the game, not a readout of it.
- As a daily player opening the app, I want one glance to tell me my streak,
  whether today's challenge is done, and whether it's an Attack Day, so the
  session starts with intent.
- As a player whose streak is on the line tonight, I want the app to signal it
  quietly before midnight, so a 30-day streak doesn't die of forgetfulness.
- As a player crossing 30 days, I want the moment marked — "30 DAYS. Unbroken."
  — the way the brand promised.

## Mechanics / behaviour

### 1. Map capture celebration
1. ClaimSuccess and ContestResult CTAs that return to the map pass a
   `celebration` param (`{ geojson, mode }`) into the Map tab —
   same nested-params channel `topBannerMessage` already uses.
2. Modes: `captured` (claim taken / attack won — claim red), `held`
   (defence won — alliance green), `lost` (defence lost — enemy blue,
   outline-weighted).
3. MapScreen consumes the param: flies the camera to the shape's bbox centre
   (600 ms), renders a temporary ShapeSource over the territory (fill + line in
   the mode colour, emissive like the objective layer), holds it, then fades it
   out — total on-screen life ~2.4 s (ambient 2000 ms fade after a short hold).
   The viewport refetch triggered by the camera move repaints the territory in
   its new authoritative colour beneath the overlay.
4. Edge cases: no geometry (silhouette fallback paths) → no celebration, plain
   return to map. Celebration param is cleared via `setParams` so re-focusing
   the tab never replays it. First-claim spine flow keeps its own flight; the
   spine's `claimAnother` path may celebrate (it has geometry).

### 2. Daily brief (session-start card)
1. Once per app session, when the Map screen has a signed-in player and the
   first-claim objective/spine is NOT active, fetch `/me/challenges/today` and
   show a card under the resource banner.
2. Content, field-note voice:
   - Streak line: "Streak: 12 days." Hidden at streak 0.
   - At-risk state (challenge day, nothing completed, streak > 0, local time
     ≥ 17:00): line swaps to "Streak at risk — 12 days on the line." and the
     card's marker pulses at the ambient 2000 ms cadence.
   - Day line: challenge day + none completed → "Today's challenge is open.";
     completed → "Challenge complete. Streak holds."; weekend →
     "Attack Day. Attacks and defences open."
3. Tap anywhere on the card → Activity tab. DISMISS (text, per brand — no ✕
   icon) hides it. Either way it stays gone until the next cold start.
4. Failure to fetch = no card, no retry, no spinner. The brief is a bonus, not
   a gate.

### 3. Streak milestone ceremony
1. Backend: `CompleteChallengeResult` gains `streak_milestone: number | null` —
   the milestone day (7/14/21/30/60/90) when this completion crossed it, else
   null. The crossing logic already exists (`milestoneCrossed`); this only
   surfaces it in the response. Idempotent replays return null.
2. Mobile: on a completion response with `streak_milestone`, ActivityScreen
   queues a MilestoneTakeover (Tier 1 component — extended haptic included):
   kicker `▪ STREAK`, title "30 DAYS", body "Unbroken. +250 Siege XP."
   (tier name from the response's `streak.tier_name`; XP from
   `XP_STREAK_MILESTONE`). Russian plurals via i18next `_one/_few/_many`.
3. Ordering: the takeover fires after the completion's own feedback settles
   (toasts still show underneath; takeover is the top layer). The L4 card and
   milestone takeover can theoretically stack — takeover wins, card shows
   after dismiss (existing card queue behaviour).

### 4. Development fortification glyph
1. New `DevGlyph` (SVG): four ascending wall segments, filled up to the
   territory's development level, hairline outlines for the rest. 0 px radius,
   flat fills, no decoration.
2. Rendered beside the existing D-level rows in the develop sheet (current
   level and target level rows), so spending resources visibly raises the wall.
   The map already renders D4 walls and ramparts (Living Map); this closes the
   gap in the sheet.

## Anti-abuse / anti-cheat considerations
None — this feature does not touch distance, accounts, territory ownership, or
Realm assignment. The streak milestone flag only reports a server-side decision
that already grants the XP; the client cannot trigger it.

## Acceptance criteria
- [ ] Claiming a territory, winning an attack, and winning a defence each play
      the map celebration in the correct colour; losing a defence shows the
      enemy-blue variant; no-geometry paths skip it silently.
- [ ] Celebration never replays on tab re-focus or param re-read.
- [ ] Daily brief appears once per session with correct streak/day lines,
      routes to Activity on tap, and never appears during the first-claim flow.
- [ ] At-risk styling only when: challenge day, zero completions, streak > 0,
      after 17:00 local.
- [ ] Crossing 7/14/21/30/60/90 days fires the streak takeover exactly once,
      with tier name and +250 XP; same-day replay completions do not.
- [ ] `streak_milestone` is null on idempotent completions and non-milestone
      days (backend test).
- [ ] DevGlyph shows the correct filled segments for D0–D4 in the develop
      sheet.
- [ ] All new copy in en + ru (Russian plurals correct), no exclamation marks,
      British English.
- [ ] Jest suites green in both repos' checks (mobile jest, backend tsc).

## Open questions
- 17:00 local as the at-risk hour uses device time, not home_timezone — close
  enough for launch; revisit if travel complaints appear.
- Should the daily brief surface grace days banked? Deferred — one more line
  risks turning the field note into a dashboard.
- 90-day milestone shows "Legendary" (tier unchanged from 60) — acceptable, or
  does 90 deserve distinct copy? Ship as-is, ask the beta.

## Dependencies
- Backend: one additive field on `/me/challenges/complete` response
  (challenge-complete.service.ts). Deploys via push to main.
- Mobile: `/me/challenges/today` (exists), Tier 1 primitives
  (MilestoneTakeover, haptics, territoryShape), @rnmapbox ShapeSource/layers
  (objective-layer pattern), formulas `XP_STREAK_MILESTONE` + `getStreakTier`.
- No database, BullMQ, or Ably changes.
