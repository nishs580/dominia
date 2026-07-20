---
target: ActiveClaimScreen
total_score: 21
p0_count: 2
p1_count: 2
timestamp: 2026-07-19T22-35-00Z
slug: screens-activeclaimscreen-js
---
Method: dual-agent (A: Explore design review · B: Explore deterministic scan)

# Critique: ActiveClaimScreen (+ ClaimSuccessScreen exit beat) — 21/40

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | Nothing moves between 10s polls; no claim time-window countdown at all |
| 2 | Match System / Real World | 3 | Honest field terms (STEPS WALKED, PACE spm, VEHICLE DETECTED) |
| 3 | User Control and Freedom | 1 | Cancel fires goBack() with no confirmation — gold silently forfeited |
| 4 | Consistency and Standards | 2 | Sixth colour (AMBER), 2–3 reds per state, 900ms ring animation |
| 5 | Error Prevention | 1 | Nothing guards accidental cancel; no warning that screen-lock may kill tracking |
| 6 | Recognition Rather Than Recall | 3 | Ring + panel glanceable; STRIDE label teaches calibration state |
| 7 | Flexibility and Efficiency | 2 | Progress lags real pace by up to 10s + 900ms |
| 8 | Aesthetic and Minimalist Design | 3 | Restrained and instrumental |
| 9 | Error Recovery | 1 | Health-Connect-denied banner names the problem, offers no action; mechanic dead |
| 10 | Help and Documentation | 3 | First-walk hint well gated per player |
| **Total** | | **21/40** | **Acceptable — significant improvements needed** |

## Anti-Patterns Verdict

**LLM assessment:** hand-built to the Field-Desk system, not slop — but three brand breaks: AMBER #D49A2B as a sixth colour on the paused banner (ActiveClaim L89/751); the One Claim Rule broken in the DEFAULT state (red ring stroke + red IN PROGRESS badge, plus a red banner = 3); and the most-watched animation on the screen — the progress ring — running 900ms/cubic-out, off the motion vocabulary (L449–450). CountUpText, by contrast, is doctrine-perfect at 280/bezier.

**Deterministic scan:** detector font warnings all false positives again. Confirmed: AMBER off-palette; multi-red co-renders on BOTH screens (ClaimSuccess standard success = 3 reds; first-claim success = 4 — silhouette + kicker + caption + nudge CTA); ring duration 900; cancelBtn ~42dp and all four ClaimSuccess buttons ~43dp with zero hitSlop anywhere; dead constants (SLATE, ALLIANCE, CLAIM_SOFT); neither file imports lib/theme. Clean: radius, shadows, fonts, uppercase-Inter, exclamations, travel copy, en/ru parity (25/17/14 keys).

**Visual overlays:** not applicable — native surface.

## Overall Impression

The engineering under the walk is the best in the app — module-scoped tracking survives screen-off and app-switch, and the anti-cheat ladder is honest and communicated. But the two moments that define the arc are broken: the walk screen hides the countdown that can void everything, and the success screen celebrates before the server confirms — a false peak that can flip to "gold forfeited" after the player already felt the win.

## What's Working

1. **Interruption resilience** (ActiveClaim L51–68, 621–632) — the walk survives blur/switch via foreground service.
2. **Honest, communicated anti-cheat** — vehicle exclusion + 30s/15min idle ladder with live countdown (L224, 237–264).
3. **Count-up to doctrine** — CountUpText at 280ms on the brand curve; numerals count, type never animates.

## Priority Issues

**[P0] No claim time-window countdown** — intents expire and forfeit gold ("Your claim expired. {{gold}} gold has been forfeited.") yet the walk screen never shows time remaining. Fix: mono countdown paired with the ring; escalate under ~2 min. → /impeccable harden

**[P0] Premature success ceremony** (ClaimSuccess L70, 77, 228) — haptic + silhouette + "is yours" fire on mount, before completeClaim resolves; can reverse to "Another player claimed this while you walked." Fix: neutral "securing…" beat first; ceremony only on server confirm. → /impeccable harden

**[P1] Unguarded cancel with stakes** (ActiveClaim L660–666) — one stray tap ends the claim and forfeits gold, no confirm, ~42dp target. Fix: confirmation naming the cost; 48dp. → /impeccable harden

**[P1] Health-Connect-denied dead end** (L744–746) — banner says steps can't be read while ring/stats imply a live walk. Fix: blocking state + "Open settings" + graceful exit. → /impeccable harden

**[P2] Brand mop-up** — AMBER out (or formally adopt a caution token in DESIGN.md); badge off red so the ring is the one red; ClaimSuccess red budget (silhouette carries the ceremony; kicker/caption/CTA demoted); ring to 280/brand curve; 48dp sweep; theme imports; dead constants. → /impeccable polish

## Persona Red Flags

**Alex:** ring lags his pace by 10s+900ms — reads "not counting"; no timer to optimise against; cancel burns gold without asking.
**Casey:** unconfirmed Cancel under the thumb at ~42dp is one mis-tap from forfeiting the walk; six-way banner zone thrashing while glancing.
**Priya:** only the 48px percentage survives midday sun — metres, stats, banners are 9–11px Slate-2; mid-range phones often lack Health Connect → straight into the dead-end banner; BestForNavigation at 1s + foreground service is real battery/heat in the sun.

## Minor Observations

- The payoff celebrates PERIMETER (the requirement), never the steps/distance actually walked — liveSteps/distanceM are dropped at navigation (L648–658).
- No "nearly there" beat after the 50% banner; 51→100% is emotionally flat.
- Progress effect has no dependency array (L443) — re-issues an animation every render on a battery-sensitive screen.
- Contest mode shows no opponent progress or timer; the tension is entirely off-screen.
- 5× console.warn; raw #D64525 literals duplicating CLAIM.

## Questions to Consider

1. If a claim can expire and burn gold, why is the countdown the one instrument absent from the walk screen?
2. Should the player ever feel the success haptic before the server has actually awarded the territory?
3. Which number honours the effort at the payoff — the distance the game required, or the distance the player walked?
