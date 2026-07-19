---
target: OnboardingScreen
total_score: 26
p0_count: 1
p1_count: 2
timestamp: 2026-07-19T18-21-32Z
slug: screens-onboardingscreen-js
---
Method: dual-agent (A: Explore design review · B: Explore deterministic scan)

# Critique: OnboardingScreen.js (Dominia first-run flow)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Progress bar + "Step n of 5" clear; pin-save shows no progress text |
| 2 | Match System / Real World | 3 | "Attack enemy ground… under fire" is a wargamer's mental model, not a walker's |
| 3 | User Control and Freedom | 2 | Unskippable ~3.5s typewriter; no Back on steps 0/4; pin irreversible |
| 4 | Consistency and Standards | 2 | Animated type, round pin marker, native Alerts, 2–3 red elements per screen — all off the brand's own standard |
| 5 | Error Prevention | 3 | Confirm-pin disabled until pin exists; double-submit guards everywhere |
| 6 | Recognition Rather Than Recall | 3 | Mostly recognition; step 4 relies on remembering the pin→city link |
| 7 | Flexibility and Efficiency | 2 | No skip/fast path anywhere; every user pays the animation tax |
| 8 | Aesthetic and Minimalist Design | 3 | Clean and restrained; minor clutter (→ arrows, Archivo on every heading) |
| 9 | Error Recovery | 2 | Step-3 retry good; session error dead-ends in "restart the app" |
| 10 | Help and Documentation | 3 | Onboarding is the docs; "contest"/"alliance"/"territory" never defined for non-gamers |
| **Total** | | **26/40** | **Acceptable — significant improvements needed** |

## Anti-Patterns Verdict

**LLM assessment:** not generic slop — the ink field, hairline rules, mono labels, and square geometry are genuinely on-brief. But the screen breaks its own constitution in three load-bearing ways: animated type (the Still Type Rule), 2–3 Claim Red elements per screen state (the One Claim Rule), and Claim Red repurposed as an error colour (the Locked Meaning Rule). It passes a glance and fails an audit.

**Deterministic scan:** detect.mjs exited 2 with 26 font findings — all false positives (case-normalization artifact; every font is in the palette). The authoritative native scan found: borderRadius 14 on the pin marker (L461); 6 Claim Red sites producing 2–3 co-rendering red elements on steps 0, 2, and 3 (L60, 299, 384, 392, 468, 511); a red `borderLeftColor` side-stripe callout (L384 — an absolute-ban pattern); typewriter text animation at 55ms/200ms off-scale timings (L243–274); two touch targets far under 48dp (Retry L520, Back L668); and a systemic finding — the file imports nothing from lib/theme.js, re-declaring every token inline (L16–24). Rules 2 (shadows/gradients), 5 (fonts), 7 (copy mechanics) clean; copy rules 7/8 largely unverifiable here (strings live in i18n files).

**Visual overlays:** not applicable — native Android surface; no browser injection path exists, so no user-visible overlay was attempted.

## Overall Impression

A disciplined brand skin wrapped around three constitutional breaches and one geographic landmine. The structure (5 steps, one decision each, strong identity payoff at the end) is right; the violations are concentrated and fixable. The single biggest opportunity: the first 3.5 seconds and the first map — the typewriter delay and the Amsterdam fallback are exactly where a Bengaluru first-timer forms their opinion.

## What's Working

1. **Walk-from-anywhere compliance is exemplary** — "Walk a territory's perimeter distance — from anywhere — to own it" nails the brand's hardest copy rule; nothing implies travel.
2. **The final identity screen (L558–590)** — commander name in Archivo, "{city} is yours to take", "Three territories nearby are unclaimed" — ceremony used correctly, concrete next action given. A real peak.
3. **Robust async handling** — double-submit guards on every terminal step, and step 3 has an inline retry rather than only an alert.

## Priority Issues

**[P0] Typewriter intro animates type and gates the only CTA (L242–274)**
- Why it matters: directly violates the Still Type Rule and the motion vocabulary (55ms/200ms are not 120/280/2000); forces a ~3.5s no-action wait as the very first impression; the primary button is hidden until it finishes.
- Fix: render tagline, body, and Begin statically; at most one 280ms container fade on the brand curve.
- Suggested command: /impeccable animate (or fold into polish)

**[P1] One Claim Rule broken on steps 0, 2, and 3 — including a banned side-stripe (L60, 299, 384, 392, 468, 511)**
- Why it matters: 2–3 red elements per state spends the CTA's authority; L384 is a red borderLeft accent stripe (absolute ban); L511 repurposes Claim Red as an error colour (Locked Meaning Rule).
- Fix: wordmark mark → Bone; privacy callout → Ink-2 + full hairline border, slate label; error text → Bone/Slate-2 Inter. The button stays the only red element.
- Suggested command: /impeccable polish

**[P1] Amsterdam fallback map centre in a Bengaluru-first product (L450)**
- Why it matters: with location denied, the home-pin map opens in the Netherlands; the persona this launch depends on is dropped a continent away at the flow's highest-stakes step.
- Fix: default the fallback centre to Bengaluru; better, show an explicit "location needed to place your base" state instead of a silently wrong map.
- Suggested command: /impeccable harden

**[P2] Sub-48dp touch targets and an off-brand dead-end (L520, L668, L610–646)**
- Why it matters: Back and Retry are bare ~14dp Text pressables — hard to hit one-handed; session errors end in native Material Alert dialogs ("Please restart the app") — an off-brand component and an unrecoverable path.
- Fix: give both pressables padding/hitSlop to ≥48dp; replace Alerts with the existing inline retry pattern.
- Suggested command: /impeccable harden (targets + recovery), /impeccable adapt (touch sizing)

**[P2] The screen bypasses lib/theme.js entirely (L16–24, systemic)**
- Why it matters: every token is re-declared inline; values match today, but the screen will silently drift from any future theme change — and the borderRadius 14 pin marker (L461) shows drift has already begun.
- Fix: import colors/fonts/spacing/duration from ../lib/theme; square the pin marker or justify it as a map-glyph exception in DESIGN.md.
- Suggested command: /impeccable polish

## Persona Red Flags

**Jordan (first-timer):** typewriter with no visible button → "is it frozen?"; "Attack enemy ground… under fire" with no definition of contest/territory; "restart the app" alert offers no path back — Jordan quits there.

**Casey (distracted, one-handed):** cannot skip the 3.5s intro; 8–9px tracked mono labels hard to read in motion; step 3 demands precise map taps with scroll disabled — a mis-pan feels stuck.

**Priya (Bengaluru walker, fitness + community, no strategy background):** Amsterdam fallback is the headline failure; zero fitness framing in the entire flow and community reduced to one line ("Coordinate with 19 others") — her two actual motivations are absent; strategy jargon undefined; Slate-2 at 8–9px on Ink washes out in sunlight; Mapbox load on a mid-range Android on a step she can't skip.

## Minor Observations

- Step 2 fires Location + Pedometer permission prompts from one tap (Promise.allSettled, L599) with no per-prompt rationale; health prompt gets no reassurance copy at all.
- `→` arrow appended to every CTA is unsanctioned chrome.
- `adjustsFontSizeToFit` + `minimumFontScale 0.6` on the commander name fights sp-scaling; long usernames silently shrink.
- Progress is triplicated (dot bar, "Step n of 5", "Last step"); the dot bar sits between content and button — unusual stepper position.
- `heading3` i18n string has a trailing space.
- Copy rules (British English, no exclamations, travel-implying phrases) need a separate pass over the i18n files — unverifiable from this file.

## Questions to Consider

1. If fitness decides outcomes and Priya came for fitness + community, why does onboarding lead with conquest and "under fire" instead of the walk?
2. Is the typewriter worth breaking the brand's most quotable rule on impression number one?
3. Is a single irreversible tap on a possibly-wrong map the right weight for a permanent, identity-defining home-pin decision?
