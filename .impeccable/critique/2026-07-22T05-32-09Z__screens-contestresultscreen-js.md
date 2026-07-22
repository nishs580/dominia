---
target: ContestResultScreen
total_score: 24
p0_count: 1
p1_count: 1
timestamp: 2026-07-22T05-32-09Z
slug: screens-contestresultscreen-js
---
Method: dual-agent (A: Explore design review · B: Explore deterministic scan)

# Critique: ContestResultScreen (PvP result reveal, four outcome states) — 24/40

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Reveal legible, but win/loss is signalled by colour that inverts on losses, muddying the read |
| 2 | Match System / Real World | 2 | "Held." is ambiguous (held by whom?); consequence sentences set in mono uppercase, not Inter |
| 3 | User Control and Freedom | 2 | Two CTAs, both call goToMap — same destination, different promises |
| 4 | Consistency and Standards | 1 | Locked Meaning broken on both losses; Claim Red overspent on win; two buttons, one action |
| 5 | Error Prevention | 2 | Primary CTA labels ("FORTIFY FOR 24H", "RECONQUER") imply flows the button never runs |
| 6 | Recognition Rather Than Recall | 3 | Outcome, opponent, distances all present |
| 7 | Flexibility and Efficiency | 2 | Two buttons that do the same thing; no fast path to the promised follow-up |
| 8 | Aesthetic and Minimalist Design | 3 | Structurally clean, undermined by red used so freely it stops meaning "yours" |
| 9 | Error Recovery | 3 | Losses surface the reconquest window and record the effort — genuine strength |
| 10 | Help and Documentation | 3 | Self-describing labels; N/A for this surface |
| **Total** | | **24/40** | **Acceptable — significant improvements needed** |

## Anti-Patterns Verdict

**LLM assessment:** not generic slop — flat, on-grid, correct fonts, 0px radius, no shadows/gradients, textbook 280ms reveal motion. The failure is deeper than styling: the screen breaks the Locked Meaning Rule on both loss states. `markColor` is derived from ROLE, not ownership (L78: `cfg.role === 'attacker' ? CLAIM : ALLIANCE`). So `defend_lost` paints a just-lost territory Alliance Green ("ours") while the headline reads "Taken.", and `attack_lost` paints a failed attack Claim Red ("yours") — Enemy Slate-Blue, the token that exists for exactly "theirs", is never used anywhere on the screen. On the win side the One Claim budget is blown: beyond the exempt silhouette, red lands on the eyebrow (L177), the winning distance readout (L218), the consequence box (L233), and the CTA (L418).

**Deterministic scan:** detector font warnings all false positives (case-normalization). Confirmed: role-based colour selection never uses ownership (L78); attack_won ≥4 co-rendering Claim elements; attack_lost Claim red on an un-taken territory + opponent's winning distance; defend_lost Alliance green on lost ground; two CTAs same destination with dishonest labels; ctaSecondary ~42dp and ctaPrimary ~46dp (borderline) under 48dp with no minHeight; dead constants INK_2 and HAIRLINE; file re-declares palette inline instead of importing lib/theme. Clean: radius, shadows, fonts, motion, uppercase-Inter/exclamations/emoji, travel copy, en/ru parity (all four state objects match).

**Visual overlays:** not applicable — native surface.

## Overall Impression

The copy on this screen is the best loss-writing in the app — "STREAK INTACT. RECONTEST WHEN READY", "RECONQUEST WINDOW OPEN: 72H. YOUR DEFENCE IS RECORDED" honour effort through precision with zero praise words. But a single structural decision — colour by seat, not by ownership — makes the screen emotionally lie to a losing player, telling them the ground they just lost is "still ours" (green) or that a failed attack is "yours" (red). That is the one defect to fix; almost everything else falls out behind it.

## What's Working

1. **Loss copy is genuinely on-brand** (en.json contestResult consequence lines) — surfaces the reconquest window and records the effort, no praise word or exclamation.
2. **Win reveal motion is correct** (L152–167) — 280ms silhouette fill on the brand curve, fill-vs-outline for win-vs-loss, type never animated, only XP counts up.
3. **Every entry route gets a mark** (L100–109, 187–206) — missing geometry is fetched on the notification/defender-accept paths, with a square fallback when no silhouette exists.

## Priority Issues

**[P0] Loss states invert the Locked Meaning colours** (L78, markColor keyed off role)
- defend_lost renders lost ground Alliance Green (ours); attack_lost renders a failed attack Claim Red (yours); Enemy Slate-Blue is never used. The colour contradicts the headline and the emotional truth.
- Fix: derive colour from post-contest ownership, not role. Territory you lost → Enemy Slate-Blue; territory you took → Claim Red; territory you held → Alliance Green.
- Suggested command: /impeccable polish

**[P1] Two CTAs, one action, dishonest labels** (L258, L267; labels "FORTIFY FOR 24H"/"RECONQUER"/"CLAIM & DEFEND")
- Both call goToMap; primary label promises a follow-up flow the button never runs — false affordance + redundant control.
- Fix: wire the primary to the real follow-up, or drop the secondary and rename primary to "BACK TO MAP".
- Suggested command: /impeccable clarify (or shape, if the follow-up flows get built)

**[P2] Claim Red overspent on attacker/win states** (L177, L218, L233, L418)
- Beyond the exempt ownership silhouette, red lands on eyebrow + winning distance + consequence chrome + CTA — 3–4 non-semantic reds against a budget of one.
- Fix: keep red for the ownership silhouette and the single CTA; eyebrow and consequence chrome → Bone/hairline; colour the winning stat only where it denotes ownership.
- Suggested command: /impeccable polish

**[P2] Consequence sentences set in Geist Mono uppercase** (L375)
- Readable sentences ("YOU ARE NOW IN THE HALL OF HOLDERS") belong in Inter sentence-case per the Controlling Rule.
- Suggested command: /impeccable typeset

**[P3] Sub-48dp CTAs + theme bypass + dead code** (L417/429; L24–34 inline palette; INK_2/HAIRLINE dead)
- ctaSecondary ~42dp, ctaPrimary ~46dp; file re-declares tokens instead of importing lib/theme; two dead constants.
- Suggested command: /impeccable polish

## Persona Red Flags

**Alex:** two identical buttons and a primary CTA promising "RECONQUER"/"FORTIFY" that dead-ends at the map — the affordance lied, trust lost.
**Casey:** ~42dp secondary target under the thumb; momentary win/loss colour ambiguity worst at half-attention.
**Priya:** 9px Slate-2 metadata in sunlight (her exact pain point); worse, on a defend_lost she walked real kilometres and the screen colours the loss "ours" green — the copy records her defence but the colour undercuts it.
**First-time loser:** the copy protects them (streak intact, reconquest window), but the loss honours the walked distance only as a static number while wins animate XP, and the inverted colour confuses the outcome. Not punitive in words; weaker peak-end than it should be.

## Minor Observations

- The sacred metric (metres walked) is static (L219) while derived XP counts up (L238) — animation hierarchy rewards the derived over the earned, even on wins.
- winner tie-break (L84–87) trusts cfg.outcome; a data mismatch between the outcome param and the distances would show a "winner" with the lower number — worth a guard.
- statusSpacer.height (L290) is always overridden inline — dead value.
- Both CTAs share goToMap; only three of four states pass a map celebration (attack_lost correctly gets none).

## Questions to Consider

1. If colour means ownership, why does this screen decide it from the player's seat rather than what they now hold?
2. When the primary CTA says "RECONQUER" but only returns to the map, is it a promise or a decoration?
3. On a loss the copy honours the walk but nothing else does — if distance is the only currency, why is it the one thing this screen never celebrates when you lose?
