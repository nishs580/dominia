---
target: ActiveClaimScreen
total_score: 25
p0_count: 0
p1_count: 2
timestamp: 2026-07-20T05-08-54Z
slug: screens-activeclaimscreen-js
---
Method: dual-agent (A: Explore design review · B: Explore deterministic scan)

# Critique: ActiveClaimScreen + ClaimSuccessScreen — post-fix run — 25/40 (was 21)

## Design Health Score

| # | Heuristic | Was | Now | Key finding |
|---|-----------|-----|-----|-------------|
| 1 | Visibility of System Status | 2 | 2 | GPS-weak banner was dead code; "securing" wait is motionless |
| 2 | Match System / Real World | 3 | 2 | "STRIDE (CAL)", "spm" are engineering diagnostics, not walker vocabulary |
| 3 | User Control and Freedom | 1 | 3 | Two-step cancel naming the stakes — "excellent" |
| 4 | Consistency and Standards | 2 | 2 | Vehicle/reset banners still spent Claim Red at assessment time |
| 5 | Error Prevention | 1 | 2 | Cancel guard + HC block good; claim window still expires without a hard stop |
| 6 | Recognition Rather Than Recall | 3 | 3 | Stride diagnostics require recall to interpret |
| 7 | Flexibility and Efficiency | 2 | 3 | Fine for a single-task screen |
| 8 | Aesthetic and Minimalist Design | 3 | 2 | Distance duplicated (ring + stat row); diagnostics clutter |
| 9 | Error Recovery | 1 | 3 | HC-blocked route-out and success retry clear and honest |
| 10 | Help and Documentation | 3 | 3 | First-walk hint well judged |
| **Total** | | **21** | **25** | **Acceptable, trending up** |

## What the round shipped (verified: 630/630 jest, parse clean, en/ru parity 36/19/14)

Harden: claim-window countdown (H:MM:SS stat row, amber in the last 2 min) fed by expires_at now passed from MapScreen; ClaimSuccess ceremony held behind server confirm (securing phase, slate silhouette, haptic only on confirmation); two-step cancel naming forfeited gold; Health-Connect-denied blocking state with Open settings + Back to map. Polish: Caution Amber formally adopted (theme.js colors.caution + DESIGN.md rules); badge off red; caption/kicker off red; ring 900ms→280ms brand curve; theme imports both files. Adapt: 48dp via minHeight on all production buttons. Delight: DISTANCE WALKED card at the payoff (walkedM passed through), 90% NEARLY THERE beat, animation-dedup guard.

Post-assessment straggler fixes (same commit, flagged by this run): vehicle/reset banners → Caution Amber; no-silhouette fallback square → Bone; STATUS "Owned" off Alliance Green; dual-amber guard (time-left yields amber to caution banners); dead claimStartMs removed; GPS-weak dead-code condition fixed (banner now reachable); keepWalkingBtn border on token.

## Anti-Patterns Verdict

A: "Not slop — disciplined, token-driven." B: rules 1/2/5/6/7/8/10 clean; detector font warnings false positives (32, case-normalization). All confirmed mechanical findings from this run were fixed post-assessment as above.

## Remaining backlog

- [P2] Claim-window expiry has no hard stop — at 00:00 the player can keep walking a voided claim; surface a blocking expired state on the walk screen. (Game-behaviour change; owner call.)
- [P2] "Securing" beat is motionless at the emotional peak — add the sanctioned 2000ms ambient pulse to the securing silhouette/label.
- [P3] Instrument clutter: duplicate DISTANCE row; STRIDE/PACE diagnostics could sit behind the DIAG toggle; TIME LEFT deserves more visual priority than row one of a stat table.
- [P3] Press feedback is instant opacity rather than the 120ms transition — systemic across the app.
- Open voice question: "KEEP GOING" / "NEARLY THERE" edge toward the encouraging-friend voice the brand forbids — reword to field-note factual ("50% · HALFWAY", "90% · FINAL STRETCH")?

## Persona Red Flags

Alex: silent expiry is the sharpest remaining risk; wants the deadline as a hero readout. Casey: 4s auto-dismiss beats easy to miss mid-glance. Priya: 11px slate metres row fails sunlight contrast; BestForNavigation at 1s + foreground service is battery/thermal load on mid-range hardware.

## Questions to Consider

1. What stops the player from wasting distance after 00:00? Today, nothing.
2. Does a walker ever act on "STRIDE (CAL) 0.75 m" — or is it a diagnostic occupying the most pressured screen in the game?
3. Do "KEEP GOING"/"NEARLY THERE" belong in a brand that honours effort through precision, never praise?
