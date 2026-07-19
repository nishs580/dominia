---
target: MapScreen
total_score: 29
p0_count: 1
p1_count: 2
timestamp: 2026-07-19T22-12-33Z
slug: screens-mapscreen-js
---
Method: dual-agent (A: Explore design review · B: Explore deterministic scan)

# Critique: MapScreen.js — post-fix run — 29/40 (was 21)

## Design Health Score

| # | Heuristic | Was | Now | Key finding |
|---|-----------|-----|-----|-------------|
| 1 | Visibility of System Status | 2 | 4 | Loading pill, retry-on-error pill, empty-region line, processing states — comprehensive |
| 2 | Match System / Real World | 2 | 3 | Field-note voice lands; economic lexicon still heavy on a "walk to claim" core |
| 3 | User Control and Freedom | 3 | 2 | First-run flight (~4.1s) is uninterruptible with HUD zeroed and no skip |
| 4 | Consistency and Standards | 2 | 3 | Shell consistent; Inter-for-data and colour-repurposing breaks remain |
| 5 | Error Prevention | 3 | 3 | Confirm steps, destructive Alert, short-by pre-check |
| 6 | Recognition Rather Than Recall | 1 | 3 | Legend + glosses are real wins; streak tier names still demand recall |
| 7 | Flexibility and Efficiency | 1 | 2 | Develop is a three-tap wizard; no express paths |
| 8 | Aesthetic and Minimalist Design | 2 | 3 | Restrained; expanded enemy sheet still dense |
| 9 | Error Recovery | 2 | 3 | Coded error map with retry; some generic fallbacks |
| 10 | Help and Documentation | 3 | 3 | Tips, glosses, notif prime — good for beta |
| **Total** | | **21** | **29** | **Good — solid foundation, address weak areas** |

## Anti-Patterns Verdict

**LLM assessment:** not slop — disciplined, hand-built, with brand reasoning in the comments. The previous top layer (sixth colour, dead contest style, off-token pulse, silent failures, Amsterdam mount) is gone. What surfaced beneath: the Locked Meaning Rule is broken where develop rows colour values green-if-affordable / red-if-short (L999) and the owner streak turns red at ≥30 days (L650); confirm-screen data is set in Inter (sheetConfirmValue, L3266) against the Controlling Rule; and several sheet states still co-render more than one red element.

**Deterministic scan:** rules 1–3, 5–7, 10 all clean — theme imports in place, palette closed, fonts compliant, the pulse now runs 2000ms on the brand curve, en/ru parity at 114 keys. Remaining: Rule 4 — six red co-render states (5 confirmed: hint+CTA on the objective sheet, error+CTA on confirm and develop, top-border+CTA on own territory, the red-tinted Your-walk block with a red borderLeft); Rule 8 — objectiveBanner (~44dp) and mapErrorPill (~45dp) plausibly under 48 with no minHeight; Rule 9 — a 12-item dead-code cluster (9 unused hud/sheet styles, UNCLAIMED and HAIRLINE constants, write-only myAllianceName state).

**Visual overlays:** not applicable — native surface.

## Overall Impression

The resilience layer, legend, and constitution fixes moved every weak heuristic. The remaining work is one conceptual gap plus mop-up: the palette has no neutral way to say "sufficient/insufficient" or "warning", so screens keep borrowing territory colours — the provocative question worth answering before more patching.

## What's Working

1. **Failure/empty/loading coverage** (L2437–2466) — all three states cleanly separated with a tappable retry.
2. **First-claim spine choreography** (L1929–1980) — camera, objective, pulse, couch-close copy sequenced into one coherent moment; "Every colour on this map is a real person who walked for it" is the best line on the screen.
3. **Sunlight-aware chrome** — Locate/Key labels forced to Bone with the reasoning inline (L2926).

## Priority Issues

**[P0] Territory colours repurposed as success/error** (L999, L650)
- Green=affordable / red=short corrupts yours/ours/theirs. Fix: Bone (have) vs Slate (short) + weight; never colour. → /impeccable polish

**[P1] Confirm-screen data set in Inter** (L3266, used at 825–833, 957, 1002–1013)
- Measurements must be Geist Mono. Fix: sheetConfirmValue → GeistMono_500Medium. → /impeccable typeset

**[P1] Red co-renders in five sheet states** (L735+744, 843+865, 1031+1035, 555+754, 3123–3132)
- Hint/error/border reds stack with the red CTA. Fix: errors and hints in Bone Inter; Your-walk block → neutral card; falls out largely once P0 lands. → /impeccable polish

**[P2] Unskippable first-run flight** (L89–90, 2390)
- ~4.1s zero-agency cinematic. Fix: tap-anywhere-to-settle jumping to FLIGHT_SETTLED. → /impeccable onboard

**[P3] Mop-up: sub-48dp banner/error-pill + 12 dead-code items** (L2683, 2812; dead styles/constants/state)
- minHeight 48 on both; delete the dead cluster. → /impeccable polish

## Persona Red Flags

**Alex:** the unskippable flight; develop is a three-screen wizard with no express path.
**Casey:** sheet close × still top-right (at-spec size now, wrong reach); objective banner and Sitrep dismiss (~29dp) easy to miss while walking.
**Priya:** Locate/Key now Bone, but many readouts stay Slate-2 at 9–11px (hudLabel, influence labels, battle chips); watch mid-range jank — 200ms dash interval + pulses + per-feature SVGs on contested viewports.

## Minor Observations

- SitrepCard at-risk pulse uses Easing.linear with a "per brand" comment DESIGN.md contradicts — reconcile doc or code.
- ObjectivePulse is circular chrome-on-map (radius 36) — reads as a locator; consider adding to the sanctioned exception list explicitly.
- capReached is a dead end — link to Activity like the short-by state does.
- Sheet territory name is Inter 20px, a size outside the scale.

## Questions to Consider

1. Does the map's inspect sheet need the full economic ledger, or is it burying the one number that matters — walk distance?
2. If the first-claim flight is the most important 4 seconds in the product, why is it the only moment with zero player agency?
3. Is the system short one or two neutral state signals (caution/confirm that aren't territory colours) — and is that the real gap the repurposing keeps exposing?
