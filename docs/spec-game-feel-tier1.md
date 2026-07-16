# Game Feel — Tier 1 slice

## Problem
Dominia's reward moments do not register as events. Claim success shows a generic
red square with XP and gold typeset at 9px; level-ups and first contest wins are
computed by the server, delivered to the client, and discarded (`void leveledUp`).
The three haptic moments mandated by Brand Guidelines v1.1 were never built, and
resource changes on the map banner swap silently. The result: the core loop pays
out, but the player never feels it.

## Goal
Every meaningful state change — claim, contest resolution, level-up, first contest
win, resource earn — is felt in the hand and given a visible beat, within the
existing brand system.

## Out of scope
- Sound design (requires a brand-brief amendment first).
- Map-side capture animations (fill sweep on the board) — Tier 2.
- Session-start ritual, streak ceremony, medal-earn takeovers — Tier 2.
- First **defence** win milestone — backend plumbing deferred (carry-forward
  `B-S74-X-first-defence-win-plumbing`).
- Any change to XP values, resource amounts, or contest resolution logic.
- New motion vocabulary beyond the three sanctioned durations (120/280/2000 ms).
- Level-6 alliance-unlock education flow (the takeover carries one line only).

## User stories
- As a fitness-motivated adult who just finished a 2 km claim walk, I want the
  moment of ownership to feel weighty — the shape of my new ground, a firm pulse
  in my hand, numbers that land — so the walk reads as conquest, not data entry.
- As a player crossing into Level 6, I want the rank change announced as a
  ceremony, so progression milestones feel earned rather than logged.
- As a player winning my first contest, I want the app to mark the occasion,
  so the riskiest action in the game has a memorable payoff.
- As a player returning to the map after any earn, I want to see what changed
  in my wallet without opening another screen.

## Mechanics / behaviour

### 1. Haptics (`lib/haptics.js`)
Exactly the three brand-sanctioned moments, no others:
1. `claimHaptic()` — single firm pulse. Fired once when ClaimSuccessScreen's
   success state mounts.
2. `contestHaptic()` — double pulse. Fired once when ContestResultScreen mounts
   (win or loss, both roles).
3. `milestoneHaptic()` — extended pulse. Fired when a milestone takeover becomes
   visible.

Implementation guards `require('expo-haptics')` and falls back to core
`Vibration` so the current dev client (built without the module) degrades
gracefully until the next rebuild. Never fired for taps, swipes, or navigation.

### 2. Territory silhouette reveal (`components/TerritorySilhouette.js`)
- Pure helpers in `lib/territoryShape.js`: extract the largest outer ring from a
  Polygon/MultiPolygon, apply cos(latitude) x-correction, normalise into a square
  SVG path.
- ClaimSuccessScreen: the generic 64px square is replaced by the actual claimed
  territory silhouette (≈120px) — hairline outline, fill fades in over 280 ms.
- ContestResultScreen: won → filled silhouette (280 ms fill); lost → stroke-only
  silhouette. Attacker mark = claim red, defender mark = alliance green
  (existing colour logic unchanged).
- Geometry travels by navigation param (`territoryGeojson`), threaded
  MapScreen → ActiveClaimScreen → result screens. Paths that cannot carry it —
  defender-accept (defend-preview now returns `territory_id`) and
  notification-opened results (contest pushes extract `territoryId`) — self-fetch
  the shape from the anon-readable `territories.geojson` column (populated for
  all 4,117 rows), which also supplies the territory name on the notification
  path. The legacy square/outline mark remains the fallback if the fetch fails.

### 3. Reward hierarchy + count-up (`components/CountUpText.js`)
- ClaimSuccess: XP and gold move from 9px mono lines to a two-cell readout row —
  Archivo 32px numbers counting up over 280 ms (cubic-bezier(0.2,0,0,1)), 9px
  mono labels beneath. Edge case: `already_completed === true` (re-open after
  process death) shows no reward beats, as today.
- ContestResult (won states): XP becomes a 32px count-up readout; the resource
  line (iron/stone/gold/morale) stays as the mono beat beneath it.
- Numbers only — type is never animated (brand rule); a changing numeral is data,
  not type animation.
- Pre-existing 520 ms fades on ClaimSuccess are normalised to 280 ms.

### 4. Milestone takeovers (`components/MilestoneTakeover.js`)
One full-screen opaque surface (ink background, fade-in 280 ms, extended haptic):
- **Level-up** — kicker `▪ LEVEL {{n}}` (mono, claim red), title = level rank
  name (Archivo 900, uppercase, hero size), body only at level 3
  (`ALLIANCE_UNLOCK_LEVEL`, aligned with the backend membership gate):
  "Alliances unlocked." CTA `CONTINUE` (hairline outline — claim red stays on
  the kicker only).
- **First contest win** — kicker `▪ MILESTONE`, title "FIRST CONTEST WON",
  one-line body.
- Triggers: ClaimSuccess when `envelope.leveled_up === true`
  (`level_after` names the rank); ContestResult when `leveledUp` /
  `firstContestWin` params are true. If both fire on one result, they queue —
  level-up first, first-win after dismiss.
- Dismiss is explicit (CTA tap). No auto-dismiss timer.

### 5. Resource delta chips (MapScreen banner, `components/ResourceDeltaValue.js`)
- Each banner value (iron, stone, gold, morale) renders through a component that
  tracks its previous value. On change: the value counts to the new number over
  280 ms and a `+N` / `−N` chip appears above it, fading linear over 2000 ms
  (the sanctioned ambient duration).
- Edge cases: initial load (null → first value) sets a baseline with no chip;
  rapid successive changes restart the chip with the latest delta.

## Anti-abuse / anti-cheat considerations
None — this feature does not touch distance, accounts, territory ownership, or
Realm assignment. All values displayed are server-computed; the client renders
envelopes it already receives.

## Acceptance criteria
- [ ] Claim success fires a single firm haptic; contest result fires a double;
      milestone takeover fires an extended pattern.
- [ ] App does not crash when expo-haptics is absent from the installed dev
      client (fallback to Vibration).
- [ ] Claim success shows the real territory silhouette when geometry is
      available, and the legacy square when it is not.
- [ ] Contest result shows filled silhouette on win, outline on loss, with
      role-correct colour — including defender-accept and notification-opened
      results, which fetch the shape by `territoryId`.
- [ ] XP and gold on claim success render at readout size and count up in 280 ms.
- [ ] Level-up on claim or contest presents the takeover with the correct rank
      title from `levelTitle.*` (en and ru).
- [ ] First contest win presents its takeover; level-up + first-win queue in
      order on the same result.
- [ ] `already_completed` replays show no reward beats and no takeover.
- [ ] Map banner values tick and show a fading delta chip on change; no chip on
      first load.
- [ ] All copy exists in `locales/en.json` and `locales/ru.json`; no exclamation
      marks, no emoji, British English.
- [ ] Jest suite passes, including new `territoryShape` tests.

## Open questions
- Extended-haptic feel on iOS (no long-vibration API via expo-haptics) — accept
  the notification+impact composite until the iOS port pass judges it on device.
- Should the level-3 takeover deep-link to alliance creation? Deferred — CTA
  returns to the result screen for now.
- Notification-opened contest results: RESOLVED — contest_won/contest_lost
  push payloads now carry the full role-aware result (outcome, role, names,
  distances, XP, resources, level/first-win flags); route.js maps them to
  screen params, with kind-derived outcome/role fallback for payloads sent
  before the enrichment (whose reward block is hidden rather than shown as +0).

## Dependencies
- `expo-haptics` (new native module — **requires the already-pending dev-client
  rebuild** to become active; code degrades to `Vibration` until then).
- `react-native-svg` (already installed) for silhouettes.
- Claim envelope fields `leveled_up` / `level_after` (already returned by
  `claim.service.ts`); contest envelope `leveled_up` / `first_contest_win` /
  `level_after` (already threaded by ActiveClaimScreen).
- Backend: defend-preview response gains `territory_id` (contest-defend-preview
  service) so defender results can fetch their silhouette. No database, BullMQ,
  or Ably changes; `territories.geojson` reads use the existing anon SELECT
  grant.
