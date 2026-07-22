---
target: ActivityScreen
total_score: 23
p0_count: 1
p1_count: 2
timestamp: 2026-07-22T07-29-31Z
slug: screens-activityscreen-js
---
Method: dual-agent (A: Explore design review · B: Explore deterministic scan)

# Critique: ActivityScreen (retention surface — daily challenges, streak, earn loop) — 23/40

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | Auto-complete is silent — a tier flips to 9px green "DONE" with no acknowledgement of the day's core act |
| 2 | Match System / Real World | 3 | March/Range/Drill/Tempo learnable; ●/✕/×1.5 glyphs stack undocumented in one chip label |
| 3 | User Control and Freedom | 3 | Axis browsing reversible until commit; commit locks the day with one tap, no confirm |
| 4 | Consistency and Standards | 2 | "0 / 3 DONE" counts only the viewed axis, so a locked-March player viewing Range sees 0/3 while March is done |
| 5 | Error Prevention | 2 | The once-daily axis commit is a single tap, no confirmation |
| 6 | Recognition Rather Than Recall | 2 | Axis→resource mapping (which discipline pays Iron) shown nowhere at the decision point |
| 7 | Flexibility and Efficiency | 3 | Auto-complete means no busywork taps — good for a daily player |
| 8 | Aesthetic and Minimalist Design | 2 | Four red voices + theme badge + chips + glyph suffixes + achievements table + chart, dense |
| 9 | Error Recovery | 1 | loadTodayMenu failure is silent; no Health-Connect-missing state — challenges render bare "LOCKED" with no CTA |
| 10 | Help and Documentation | 3 | First-tap tips cover streak/health/challenges/achievements — genuine scaffolding |
| **Total** | | **23/40** | **Acceptable — significant improvements needed** |

## Anti-Patterns Verdict

**LLM assessment:** copy is clean (British, Inter sentences, mono labels), but the One Claim Rule is broken 4–6× on the resting challenge-day state. Non-semantic Claim Red co-renders on: rankTitle (the commander rank line, L1203), themeBadge ("MARCH DAY · PAYS ×1.5", L1339), challengeProgressFill (L1439), and the weekly chart trend line + dots (L217/224); the permission state adds permBannerLabel + permBannerBtn (L1300/1312). None are territory-ownership renders — red is being used as a generic accent for "your name", "featured", "progress", and "data trend", so it has lost all authority on the retention surface. Separately, a dead `ProgressBar` component (L131–138) and 7 dead styles carry pastel wellness fills (#E8F6F1/#C7EADF/#E9EEF0) and borderRadius:999 — an aesthetic PRODUCT.md explicitly rejects, sitting in the file as a landmine.

**Deterministic scan:** detector font warnings all false positives. Confirmed: the systemic Claim Red budget breach (8 CLAIM sites, 4–6 co-rendering per state); 5 sub-48dp touch targets with no hitSlop/minHeight (axis chips ~25dp L1009, commit ~28dp L1040, perm link ~13dp L959, perm btn ~27dp L940, complete btn ~27dp L1095); 2 production console.logs (L382, L558); the dead ProgressBar + 7 dead styles (the only home of the non-palette hex and 999 radii). Clean: shadows/gradients/side-stripes, live-code radius (0px), fonts, motion (none), uppercase-Inter/exclamations/emoji, travel copy, en/ru parity (65 keys). File imports lib/theme.

**Visual overlays:** not applicable — native surface.

## Overall Impression

This is the "why come back tomorrow" screen, and it under-dramatises the two things that answer that question: the streak (its retention thesis) is the smallest text on screen — slate2 11px, tucked at the tail of the rank line, the same size as the separator dots — while the biggest element is the static nav label "ACTIVITY" in 36px Archivo. And the map hands players here with an explicit "earn Iron" promise the screen doesn't receive. The engineering underneath (auto-complete, live/server metric reconciliation) is genuinely thoughtful; the surface just doesn't honour effort or reassure.

## What's Working

1. **Auto-complete honours effort without busywork** (L841–874) — thresholds watched, tier flips to DONE server-authoritatively; no "claim your reward" friction.
2. **Live/server metric reconciliation** (L463–479, 668–691) — the displayed metric equals the server gate metric, so the row and the completion never disagree.
3. **First-tap tips + graceful permission degradation** (L246–254, 805–836) — steps-only players still get the March axis; Health Connect settings deep-link handles Android's permission-sheet quirk.

## Priority Issues

**[P0] Claim Red budget blown 4–6×** (L1203, L1339, L1439, L217/224; perm state L1300/1312)
- Red used for name, featured badge, progress, and chart trend — none semantic. Fix: keep exactly one red (the commit/perm CTA, the real primary action); rank line → Bone, theme badge → Slate2 (or Caution Amber if "featured/pays" reads as a signal), progress fill → Bone/hairline-strong, chart trend → Bone.
- Suggested command: /impeccable polish

**[P1] The streak is buried on the surface built to protect it** (L924, L1210–1213)
- The "why come back tomorrow" number is 11px slate2 at the tail of a run-on rank line. Fix: a dedicated streak instrument near the top (Archivo 700, the sanctioned streak-counter readout), distinct from the name line, with the day count.
- Suggested command: /impeccable layout (hierarchy) + polish

**[P1] Map "go earn X" intent is dropped on arrival** (map.earnIron/goToActivity → nothing received)
- The player lands with no highlight of the Iron-paying axis and no resource→axis mapping. Fix: accept a needResource route param, surface a one-line banner + emphasise the paying axis, and show the earned resource on each chip.
- Suggested command: /impeccable harden (or shape, if the routing contract changes)

**[P2] No error/empty/missing-Health-Connect state** (L382 silent; !hcReady → bare LOCKED, L934)
- A mid-range Android without Health Connect hits a mute dead end. Fix: explicit "couldn't load — retry" state; an install/enable-Health-Connect card instead of bare LOCKED rows.
- Suggested command: /impeccable harden

**[P2] Completion has no beat; streak-at-risk has no warning**
- Ordinary completion = 9px green "DONE"; the caution token and the already-written sitrep.streakAtRisk copy go unused. Fix: a restrained completion acknowledgement (streak count-up is brand-legal) + a single Caution-Amber "streak ends tonight" line on an incomplete day.
- Suggested command: /impeccable delight + harden

**[P3] Dead ProgressBar + wellness styles, 5 sub-48dp targets, 2 console.logs, miscounting "0/3"**
- Delete the dead component/styles (the pastel/999-radius landmine); hitSlop/minHeight the chips, commit, perm, complete buttons; strip the logs; fix the challengeCount denominator to count the committed axis.
- Suggested command: /impeccable polish + adapt

## Persona Red Flags

**Alex:** well served on speed (auto-complete, live poll), but the "0 / 3 DONE" miscount across a locked axis reads as a bug to a daily player.
**Casey:** the four axis chips — the primary decision control — are ~25–28dp, the smallest targets on the screen; real one-handed miss risk.
**Priya:** axis→resource model never taught; military-abstract names with no plain hint of what each gives; 9px slate reward/difficulty labels wash out in sunlight; no Health Connect → the silent LOCKED dead end.
**Reason to return tomorrow?** Weakly. The streak is near-invisible, completion is unfelt, and there's no forward hook ("tomorrow is Range Day", "streak safe — come back tomorrow"). The mechanics exist server-side; the screen doesn't dramatise them.

## Minor Observations

- Dead ProgressBar (L131–138) + pastel/999-radius styles should be deleted outright.
- Fixed width:72 achievement columns + partial sp-scaling will clip at large system font sizes.
- Glyph soup: ●/✕/×1.5 stacked in one 9px mono chip label — one modifier max.
- Zero motion on the surface; pressed states are instant opacity toggles, not the 120ms transition — quiet but flat.
- challengeProgressTrack is 2px — nearly invisible as an instrument.

## Questions to Consider

1. If the streak is the product's entire retention thesis, why is it the smallest, least-ceremonial element on the retention screen — smaller than the word "ACTIVITY"?
2. The map says "earn Iron here" and sends the player to this screen — should today's menu reshape around the resource they came for, or is a generic menu a broken promise?
3. Four Claim Red elements each say "this is the important one." If everything is red, what is the one thing you want the returning player to do today — and is that the red element?
