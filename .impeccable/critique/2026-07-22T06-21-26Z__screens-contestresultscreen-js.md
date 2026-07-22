---
target: ContestResultScreen
total_score: 33
p0_count: 0
p1_count: 1
timestamp: 2026-07-22T06-21-26Z
slug: screens-contestresultscreen-js
---
Method: dual-agent (A: Explore design review · B: Explore deterministic scan)

# Critique: ContestResultScreen — post-fix run — 33/40 (was 24)

## Design Health Score

| # | Heuristic | Was | Now | Key finding |
|---|-----------|-----|-----|-------------|
| 1 | Visibility of System Status | 3 | 4 | Reveal + reward/effort beat + consequence all fire on arrival; haptic confirms |
| 2 | Match System / Real World | 2 | 4 | Field-note voice holds; "reconquest window open for 72 hours" concrete |
| 3 | User Control and Freedom | 2 | 2 | Single neutral exit; no way to act on the surfaced recontest/reconquest from here |
| 4 | Consistency and Standards | 1 | 3 | Colour discipline restored; stat cells asymmetric ("YOU" vs opponent role) |
| 5 | Error Prevention | 2 | 4 | winner forced from server outcome, never raw distances — reveal can't invert |
| 6 | Recognition Rather Than Recall | 3 | 4 | Ownership colour + silhouette make "who holds it now" recognisable |
| 7 | Flexibility and Efficiency | 2 | 2 | No shortcut to recontest/fortify or the territory |
| 8 | Aesthetic and Minimalist Design | 3 | 4 | Nothing decorative; every element earns its place |
| 9 | Error Recovery | 3 | 3 | Loss copy non-punitive and forward-looking, but recovery is copy-only |
| 10 | Help and Documentation | 3 | 3 | "Hall of Holders" unexplained lore |
| **Total** | | **24** | **33** | **Good — solid foundation** |

## Anti-Patterns Verdict

A: "Not slop. Disciplined, on-doctrine." Colour now tells the ownership truth on both losses — mark and deciding stat resolve to Enemy Slate-Blue, both losses use the un-filled outline so a loss never borrows a celebratory fill. B: **10/10 rules clean, zero violations** — radius, shadows/side-stripes, palette (theme imports), colour budget (ownership renders semantic), fonts, motion, copy mechanics, 48dp, dead code, en/ru parity (25 keys) all clean. Detector font warnings the usual false positives.

## What the round shipped (verified: 630/630 jest, parse clean, en/ru parity)

Polish: ownershipColour() derives the mark from post-contest ownership (lost→Enemy Slate-Blue — a colour the screen never used before, took→Claim Red, held→Alliance Green); winner now authoritatively follows the server outcome (tie-break/inverted-distance guard); eyebrow→Bone; consequence off the banned side-stripe into a neutral ink+hairline card; theme imports; dead constants (INK_2, HAIRLINE, CLAIM_SOFT, ALLIANCE_SOFT, statusSpacer) removed. Clarify: two CTAs → one honest neutral "Back to map" (dropped the false RECONQUER/FORTIFY/CLAIM&DEFEND promises + the per-state cta keys). Typeset: consequence sentences → Inter sentence-case (en+ru rewritten, opponent name no longer force-uppercased). Delight: losses get a distance-walked count-up beat ("METRES WALKED · RECORDED") mirroring the win's XP beat. Adapt: CTA minHeight 48; 9px stat labels → 10px for sunlight.

## Remaining backlog

- [P1] opponentName defaults to literal English 'opponent' (L75) with no localised fallback — shows lowercase English to a Russian (SPB) user when the server omits a name; also lands inside the interpolated consequence. Fix: default to a localised role noun / common.opponentFallback in both locales.
- [P2] Deciding-stat sunlight legibility: the ownership-colour model puts the winning distance on a loss in Enemy Slate-Blue (#4A6B8A) on Ink, and your losing distance in Slate — the lowest-luminance colours on the screen, on the number that decided the contest. Consider pairing the blue with a Bone unit/label or raising weight so the readout doesn't rely on the darkest colour alone.
- [P3] Reduced-motion not gated: the fill/border reveals and count-ups run unconditionally (PRODUCT.md flags reduced-motion as open). Gate on AccessibilityInfo.isReduceMotionEnabled, snap to final.
- [P3] Asymmetric/redundant stat cells: your-cell labels "YOU" while opponent-cell labels a role; your metres show dimly in the row and again in the effort beat on losses. Mirror the labels (your role vs opponent role); drop one duplication.
- Dead Animated values: fillOpacity/borderAnim only drive the fallback square (the real TerritorySilhouette animates itself) — harmless but removable.
- Open voice questions from the reviewers: (a) a failed attacker reads the defender's verb "Held." — narrating from the winner's POV; (b) the 72h reconquest window is an expiring state the new Caution Amber token could signal, currently copy-only; (c) an honest CTA that can't act yet still returns to map on both re-engagement promises.

## Persona Red Flags

Alex: no path to act on the outcome — recontest/reconquest are copy-only; single CTA dumps him on the map. Casey: clean — one 48dp bottom-anchored target, Back honoured. Priya: the deciding stat on losses is the darkest colour on the screen (P2); mark reads well, the numbers don't. First-time loser: NOT discouraged — streak-intact/defence-recorded copy plus the effort beat dignify the walk and invite another attempt; the only gap is the invitation isn't actionable yet.

## Questions to Consider

1. Is the 72h reconquest window an expiring state the Caution Amber token should signal, rather than a static sentence?
2. A failed attacker reads "Held." — the defender's verb. Are we narrating from the winner's POV even when the player lost?
3. Two different re-engagement promises, zero difference in action — does an honest CTA that can't act yet still risk a dead-end feeling at the moment retention is decided?
