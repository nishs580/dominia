# Game Feel — Tier 2.5: medal ceremony + deep-link polish

## Problem
All 16 Honor Medals earn live and push correctly, but the earn moment renders
as a small notification card in a dimmed backdrop — the quietest surface in the
app — while level-ups and streak milestones now get full takeovers. And a medal
push tap deep-links to the Profile honor section without opening the medal the
player just earned.

## Goal
A medal earn is a ceremony, and tapping its notification lands on that exact
medal.

## Out of scope
- Backend changes of any kind (pushes already carry `medalKey`, tier, count,
  year).
- Changes to medal earning logic, thresholds, or the flood guard.
- Non-medal notification cards (level/streak/alliance cards stay as they are).
- Medal art or catalog changes.

## User stories
- As a player whose 30-day defence earns THE WALL while the app is open, I want
  the moment presented at full ceremony — badge art at hero size, extended
  haptic — not a dialog box.
- As a player who taps a medal push from the tray, I want to land on that
  medal's detail card, not the top of my profile.

## Mechanics / behaviour
1. **MedalEarnTakeover** replaces MedalEarnCard as the medal branch inside
   NotificationCard's modal: full-bleed ink surface, 280 ms fade, extended
   haptic on show (milestone moment — brand-sanctioned). Content: kicker
   `▪ MEDAL EARNED` (claim red), badge art at 160 px, medal name at hero size,
   tier/count subline, tier ribbon, push body line. CTA stack: `VIEW MEDAL`
   (outline — navigates to Profile with `medalKey`) and `CONTINUE` (ghost —
   dismiss). `medalFromPush` moves into the new file; MedalEarnCard is deleted.
2. **Deep-link to the medal** — ProfileScreen reads `route.params.medalKey`
   (arriving from foreground VIEW MEDAL, background tap, or cold start — all
   three FcmLifecycle paths already pass it), forwards it to
   LegacyMedalsSection as `focusMedalKey`, and clears the param. When the medal
   state loads, the section opens the medal's category and its detail modal
   once, then reports consumption so re-renders don't reopen it.
3. Edge cases: unknown/missing `medalKey` → section renders normally, no modal.
   Medal fetch failure → no auto-open. Viewing another player's profile is
   unaffected (`focusMedalKey` only passed on the own-profile section).

## Anti-abuse / anti-cheat considerations
None — this feature does not touch distance, accounts, territory ownership, or
Realm assignment. Display-only.

## Acceptance criteria
- [ ] Foreground medal push presents the full takeover with extended haptic;
      backdrop-tap no longer dismisses it silently (explicit CTAs only).
- [ ] VIEW MEDAL and a background/cold-start tap all land on the earned medal's
      detail modal, category grid open behind it.
- [ ] Dismissing the detail modal leaves the profile usable; reopening the
      profile later does not replay the auto-open.
- [ ] Unknown medalKey degrades to the plain honor section.
- [ ] New copy in en + ru; jest suite green; all touched files parse.

## Open questions
- None blocking. (A future nicety: the takeover could show "NEW TIER" vs
  "MEDAL EARNED" kickers per push kind — deferred until copy review.)

## Dependencies
- Mobile only: Tier 1 haptics, existing cardController/NotificationCard stack,
  legacy medal catalog + art. No backend, DB, BullMQ, or Ably changes.
