---
target: OnboardingScreen
total_score: 31
p0_count: 0
p1_count: 2
timestamp: 2026-07-19T18-48-24Z
slug: screens-onboardingscreen-js
---
Method: dual-agent (A: Explore design review · B: Explore deterministic scan)

# Critique: OnboardingScreen.js (Dominia first-run flow) — post-fix run

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Disabled CTA shows no "Saving…" text while savingPin/finishing run — only an opacity dip |
| 2 | Match System / Real World | 3 | "Perimeter distance" assumes the user can gauge it as effort |
| 3 | User Control and Freedom | 3 | Back on steps 1–3; no explicit "not now" on permissions; step 4 has no Back (deliberate post-write) |
| 4 | Consistency and Standards | 4 | Tokens, fonts, spacing, button structure fully consistent with theme.js/DESIGN.md |
| 5 | Error Prevention | 3 | Confirm-pin gated on pin + resolved session; no place-name echo to confirm intent |
| 6 | Recognition Rather Than Recall | 3 | Disabled-CTA cause (session resolving) surfaced only as a small caption far from the button |
| 7 | Flexibility and Efficiency | 2 | Rigid linear path; tap is the only pin method (no search / "use my location" control) |
| 8 | Aesthetic and Minimalist Design | 4 | Exemplary restraint; every element earns its place |
| 9 | Error Recovery | 3 | Session retry, inline save errors, denied-location recovery copy all present; wording generic |
| 10 | Help and Documentation | 3 | Step 1 doubles as docs; conquest terms still unglossed for non-gamers |
| **Total** | | **31/40** | **Good — solid foundation, address weak areas** |

## Anti-Patterns Verdict

**LLM assessment:** low slop, high craft. The Still Type Rule, One Claim Rule, and Flat Doctrine now all hold: one 280ms container fade on the brand curve with reduce-motion honoured, static type, exactly one red element per screen off-map, errors in Inter/Bone. Three remaining tells: a stale "Amsterdam" comment (L199), the hardcoded "Three territories nearby are unclaimed" claim, and Archivo spent on mundane step headers.

**Deterministic scan:** detect.mjs again produced 24 font findings — all confirmed false positives (case-normalization). Native scan: rules 1–9 all clean (borderRadius, shadows, palette, One Claim, fonts, motion, copy mechanics, travel-implying copy, touch targets ≥48dp). One real finding remains: rule 10 — fontFamily/fontSize literals duplicate theme tokens (`fonts.*`, `fontSize.*`) even though the file now imports `colors` and `duration`. Two borderline items adjudicated compliant: the Mapbox camera `animationDuration: 0` is an instant cut, and the intro fade animates a container, not type.

**Visual overlays:** not applicable — native surface, no browser injection path.

## Overall Impression

The constitutional breaches are gone and the geographic landmine is defused; what remains is experience-tier work: making the highest-commitment step (pin placed, session still resolving) explain itself, and deciding how the flow speaks to the walker who came for fitness and community.

## What's Working

1. **Motion doctrine is now textbook** (L238–257): one container fade, 280ms, brand curve, instant cut under reduce-motion, type static.
2. **Anxiety-timed privacy reassurance** (L378–382) co-located with the permission request.
3. **Honest failure states**: location denial produces an explicit recovery instruction; save/session errors get Inter-set messages with retry, never spending Claim Red.

## Priority Issues

**[P1] Confirm-pin can be silently un-pressable** (L696, L520–532)
- Pin placed, session still resolving → dead button with only a faint distant caption. Fix: swap CTA label to a preparing state, or move the loading/retry message adjacent to the button.
- Suggested command: /impeccable polish

**[P1] Two permission dialogs behind one tap** (L577–579)
- Sequential now, but still two OS prompts from one button; a dismissed pedometer prompt silently breaks the core loop with no recovery. Fix: add a step-counter denied/recovery state like the location one.
- Suggested command: /impeccable harden

**[P2] "Three territories nearby are unclaimed" is fabricated** (L562, en.json)
- A precise unverified number in a brand built on earned precision. Fix: data-drive it from the saved pin or soften to non-numeric copy.
- Suggested command: /impeccable clarify (copy) or harden (data-driven)

**[P2] Sunlight legibility** (L406, L469–472, L373)
- Slate-2 at 8–11px on Ink for the pin instruction and map overlay; the outdoor persona may not read it. Fix: promote key instructions to Bone, lift the overlay to the 10px floor.
- Suggested command: /impeccable typeset

**[P3] Remaining theme-token duplication + Archivo over-application**
- fontFamily/fontSize literals duplicate fonts.*/fontSize.* tokens (systemic across screens); Archivo on "TWO THINGS WE NEED" pre-spends the ceremony. Fix opportunistically.
- Suggested command: /impeccable polish

## Persona Red Flags

**Jordan:** dead Confirm button with a faint caption reads as broken; progress bar marks position, not fill; conquest terms arrive undefined.
**Casey:** precise tap-to-place with no search or "use my location" control is fiddly one-handed; two stacked OS dialogs easy to half-dismiss. (Back/Retry targets now ≥48dp — fixed.)
**Priya:** slate captions at 9–11px in sunlight; Mapbox dark map heavy on mid-range Android; zero fitness/community acknowledgement anywhere in the flow — a content gap distinct from the (approved) conquest tone.

## Minor Observations

- Stale "Amsterdam" comment at L199.
- maxFontSizeMultiplier 1.2 caps dynamic type at 120% (deliberate layout guard; note the trade).
- Progress bar could accumulate (fill) rather than mark position.
- CTA sub-label uses a bone-derived rgba rather than a named token.

## Questions to Consider

1. Should onboarding complete at all if the pedometer permission is denied — or does the game silently break after the ceremony?
2. When every step header is Archivo, is the step-4 ceremony still earned?
3. Where in this flow does Priya first see herself?
