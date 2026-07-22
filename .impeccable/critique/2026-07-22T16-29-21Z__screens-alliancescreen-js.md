---
target: AllianceScreen
total_score: 31
p0_count: 0
p1_count: 0
timestamp: 2026-07-22T16-29-21Z
slug: screens-alliancescreen-js
---
Method: dual-agent (A: Explore design review · B: Explore deterministic scan)

# Critique: AllianceScreen — post-fix run — 31/40 (was 23)

## Design Health Score

| # | Heuristic | Was | Now | Key finding |
|---|-----------|-----|-----|-------------|
| 1 | Visibility of System Status | 3 | 3 | Thorough loading/retry states; "LIVE" label deferred by owner (realtime is a backend task) |
| 2 | Match System / Real World | 3 | 3 | Coherent vocabulary; roster now shows real level + avatar |
| 3 | User Control and Freedom | 2 | 4 | Kick now has a confirm step; typed transfer guard; cancels everywhere |
| 4 | Consistency and Standards | 2 | 3 | Red reserved for destructive; promote/demote neutral; error text → Inter Bone |
| 5 | Error Prevention | 2 | 4 | Kick confirm + typed transfer; refresh failure no longer ejects the member |
| 6 | Recognition Rather Than Recall | 1 | 3 | Management is now a visible per-row MANAGE control, not a hidden long-press |
| 7 | Flexibility and Efficiency | 2 | 3 | Roster carries real data; still no roster search/sort for 20 members |
| 8 | Aesthetic and Minimalist Design | 3 | 4 | ~15 dead mission styles + zeroed avatar + dup keys removed; clean instrument look |
| 9 | Error Recovery | 2 | 4 | Wire retry + last-good member data retained on a refresh blip (inline banner) |
| 10 | Help and Documentation | 3 | 3 | Leave copy now points to the real MANAGE path |
| **Total** | | **23** | **31** | **Good — solid foundation** |

## Anti-Patterns Verdict

A: browse/join arc already strong; the member home is now honest and calm. B: with the fixes, the red budget holds — filled Claim Red is reserved for destructive/primary CTAs (leave/disband/kick-confirm/transfer/join); promote/demote are neutral Ink-2 secondaries; error text is Inter Bone; the [TAG] chip, roster roles (Slate-2, founder Alliance Green), and War Room button are all off red. Clean on radius, shadows, side-stripes, fonts, motion, uppercase-Inter, exclamations/emoji, travel copy; en/ru parity (101 keys). Detector font warnings the usual false positives.

## What the round shipped (verified: 630/630 jest, parse clean, alliance en/ru parity)

Red budget: roster roles → Slate-2 / founder Alliance Green; [TAG] chip → hairline+Bone; War Room → Ink-2 secondary; manage-sheet promote/demote → neutral (red only on kick/transfer); the "GOT IT" dismiss → neutral; error text → Inter Bone. Roster real data: shows member level + restores the avatar from avatar_url (was zero-size); dropped the false "N ACTIVE / RESETS MON" leaderboard framing (weekly steps aren't in the payload). Recognition: a visible per-row MANAGE control replaces the undiscoverable long-press; the founder-leave copy now points to it. Resilience: a detail-refresh failure retains last-good roster/alliance (inline banner) instead of ejecting the member to browse. Safety: a "Kick {name}?" confirm step. Slop: FOUNDR→FOUNDER, #08090C→ink, missionCard side-stripe removed with the dead block, dead lib/theme import + ~15 dead mission/progress styles + 3 dup style keys + sectionLabelRight + ctaStep removed, console.log stripped, uppercase-on-Inter fixed, 48dp on retry/cancel/leave/wire-retry/footer-create.

## Remaining backlog

- [P2] No roster search/sort/filter for up to 20 members — a leader managing a full alliance still scrolls a flat list.
- [P2] Prospective-joiner information gap: the browse row shows name + tag + city + n/20 only — no activity level or "is this alliance alive?" signal for the highest-stakes community decision.
- [P3] ctaDestructive is still visually identical to the constructive red `cta` (both filled CLAIM) — a dedicated destructive treatment (e.g. outline vs fill) would read more clearly; commandPostBtn computes ~47dp (borderline).
- Deferred (owner): the wire "▌ LIVE" realtime subscription; a true weekly-steps roster leaderboard (both need backend work).

## Persona Red Flags

Alex: management is discoverable now and kicks are confirmed; still wants roster search/sort. Casey: 48dp honoured; MANAGE is a single tap, not a two-hand long-press. Priya: roster now shows avatars + levels; 9px slate meta still strains in sun (label-scale brand choice). Prospective joiner: unchanged — still choosing blind on name + member count.

## Questions to Consider

1. A leader of 20 scrolls a flat roster — is search/sort the next lever, and should MANAGE gain a filter to "just the members I can act on"?
2. The join decision is still made on name + count alone — what one activity signal (last-active, weekly contribution) would most help a community-seeking joiner choose?
3. ctaDestructive and the constructive red cta are the same fill — should destructive actions look different from primary ones, or is the confirm step enough?
