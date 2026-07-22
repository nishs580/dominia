---
target: ActivityScreen
total_score: 27
p0_count: 0
p1_count: 1
timestamp: 2026-07-22T10-15-31Z
slug: screens-activityscreen-js
---
Method: dual-agent (A: Explore design review · B: Explore deterministic scan)

# Critique: ActivityScreen — post-fix run — 27/40 (was 23)

## Design Health Score

| # | Heuristic | Was | Now | Key finding |
|---|-----------|-----|-----|-------------|
| 1 | Visibility of System Status | 2 | 3 | Streak instrument now leads + count-ups when secured; normal auto-complete still silent |
| 2 | Match System / Real World | 3 | 2 | March/Range/Drill/Tempo opaque — the chip never says what metric/resource it pays |
| 3 | User Control and Freedom | 3 | 2 | Theme axis auto-arms and auto-locks on first walk; no undo of commit/lock |
| 4 | Consistency and Standards | 2 | 3 | Token use disciplined; the one breach was green "DONE" (fixed post-assessment) |
| 5 | Error Prevention | 2 | 3 | 403 cooldown/cap, 409 lock resync, optimistic rollback |
| 6 | Recognition Rather Than Recall | 2 | 2 | ●/✕ chip glyphs still unlabelled |
| 7 | Flexibility and Efficiency | 3 | 3 | Auto-complete + map pre-select serve the expert path |
| 8 | Aesthetic and Minimalist Design | 2 | 3 | Clean; reward line + appended glyphs still add noise |
| 9 | Error Recovery | 1 | 3 | menu-error retry + Health-Connect-absent card now present |
| 10 | Help and Documentation | 3 | 3 | First-tap tips wired |
| **Total** | | **23** | **27** | **Acceptable, top of band** |

## Anti-Patterns Verdict

A: "Not slop — a deliberately built instrument." **Red budget provably held**: commit and complete CTAs are mutually exclusive by lock state (commit needs lockedAxis===null, complete needs lockedAxis!==null), so ≤1 red per state; Caution Amber appears exactly once (the streak at-risk line, warning-only, gated after 17:00); progress fill/theme badge/rank/chart all recoloured off red; the permission grant button is deliberately ink3. B: 10 rules, red budget + amber + fonts + motion + copy + parity all clean; detector font warnings false positives.

## What the round shipped (verified: 630/630 jest, parse clean, activity en/ru parity)

Polish: reserved Claim Red for the one commit/complete CTA (rank/theme badge/progress fill/chart trend → Bone); deleted the dead ProgressBar + 7 pastel/999-radius wellness styles; console.logs → console.error; fixed the "n/3 DONE" count to the committed axis. Layout: streak lifted from an 11px slate footnote to a dedicated Archivo instrument near the top. Harden: needResource map handoff (banner names the resource + pre-selects a paying axis) + menu-load retry + Health-Connect-absent card. Delight: streak count-up on completion + a single Caution-Amber "streak ends tonight" line on incomplete challenge days after 17:00, "streak safe" when done. Adapt: 48dp on chips/commit/complete/perm/retry.

Post-assessment straggler fixes (this session, folded in): the needResource banner was rendering on weekends above the "no challenges on weekends" card — now gated on isChallengeDay (regression fixed); the "DONE" readout repurposed Alliance Green for generic success → now Bone (Locked Meaning Rule); dead `achievementsCard` style deleted.

## Remaining backlog

- [P2] Axis vocabulary undecodable for a non-strategy walker: chips show only March/Range/Drill/Tempo; the metric/resource each pays is hidden until you open the ladder. A per-chip mono sub-label ("DRILL · KCAL") would teach the map. (Deferred — worsens the chip's existing glyph density; needs a small redesign, not a one-liner.)
- [P3] The reward line (+XP · +Stone) is slate2 9px — the quietest text on the row, yet it's the payoff a retention player scans for. Lift to bone/md.
- [P3] Chip status glyphs ●/✕/×1.5 are unlabelled, don't scale with font settings, read as decoration; replace with a mono word or hairline treatment.
- Mid-day incomplete shows a bare streak number with no line — the reassurance/nudge is wired only to the done and after-17:00 edges; the lunchtime nudge window is empty.
- needResource:'gold' no-ops (no axis pays gold) — the map's claim dead-end routes here to a blank handoff; either the map shouldn't offer it, or Activity should say where gold comes from.
- Minor: HC-settings text link ~36dp even with hitSlop (tertiary); chart columns ~40dp wide on narrow phones; two inline bone-rgba literals with no token.

## Persona Red Flags

Alex: well served — streak leads, auto-complete fires, map pre-select is one tap from the resource; a real reason to return. Casey: 48dp honoured, but the commit button appears/disappears between the chip row and progress bar, reflowing content under the thumb mid-choice. Priya: hit hardest — opaque axis names, 9px slate chips/rewards in sunlight; she has the streak as a hook but the daily choice is confusing.

## Questions to Consider

1. If the streak is the reason to return, why does the mid-day incomplete state say nothing until 17:00?
2. The theme axis auto-arms and auto-locks on the first walk — is "pick one and walk" a conscious choice, or does the do-nothing player get March chosen for them and never learn the menu exists?
3. Four axes × three tiers × boost tags × status glyphs — is the pick-one menu a menu, or a spreadsheet the player learns to ignore in favour of whatever auto-completes?
