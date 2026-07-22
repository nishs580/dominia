---
target: AllianceScreen
total_score: 23
p0_count: 1
p1_count: 2
timestamp: 2026-07-22T15-35-05Z
slug: screens-alliancescreen-js
---
Method: dual-agent (A: Explore design review · B: Explore deterministic scan)

# Critique: AllianceScreen (alliance hub — browse/join + member home + leader actions) — 23/40

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Thorough loading/loading-more/end/retry states; the "▌ LIVE" wire label is dishonest (fetch-per-focus, no realtime) |
| 2 | Match System / Real World | 3 | War chest/mission/wire/roster coherent; "REALM 01" is placeholder |
| 3 | User Control and Freedom | 2 | Cancel everywhere + typed TRANSFER guard, but KICK fires on one tap, no confirm |
| 4 | Consistency and Standards | 2 | Hardcoded #D64525 vs the CLAIM constant; duplicate style keys; error text in mono not Inter |
| 5 | Error Prevention | 2 | No kick confirm; the founder-leave blockedBody points to an "alliance settings" surface that does not exist |
| 6 | Recognition Rather Than Recall | 1 | Member management (kick/promote/demote) is an unsignposted long-press; tap opens a profile |
| 7 | Flexibility and Efficiency | 2 | No roster search/sort for 20 members; the roster's right column is a permanent "—" |
| 8 | Aesthetic and Minimalist Design | 3 | Clean instrument look, but ~15 dead mission/progress styles + a zero-size hidden avatar bloat it |
| 9 | Error Recovery | 2 | Wire retry is exemplary; a silent detail-refresh failure nulls myAlliance and ejects the member to browse |
| 10 | Help and Documentation | 3 | First-tap tips + good confirm bodies, undercut by the misleading blockedBody instruction |
| **Total** | | **23/40** | **Acceptable — significant improvements needed** |

## Anti-Patterns Verdict

**LLM assessment:** register is right (mono chrome, Inter prose, hard squares, no shadow/gradient/blur, British, no emoji), and the browse/join arc is genuinely on-brand. But the **member home shatters the One Claim Rule**: non-semantic Claim Red co-renders on the `[TAG]` short-name chip (1309–1318), **every roster row's role label — up to 20 of them** (rosterRole, 1761), and the War Room nav button (hardcoded #D64525, 1791/1801). Red teaches "your ground" on the map; here it means tag, role, and a nav button at once, diluting the one signal the system is built on. Product-register slop: the wire says "LIVE" but fetches once per focus (no subscription); "FOUNDR" is a title misspelled to fit a 52px column; en.json has duplicate alliance keys (couldNotLoad ×3, noAllianceTitle ×2, unaffiliated ×2).

**Deterministic scan:** confirms the red overspend; a **banned 2px coloured side-stripe** on missionCard (borderLeft, 1656); **off-palette #08090C** on the wire container/overlay (1810/1865); the whole `lib/theme` import is **dead** (file re-declares local hex); **uppercase on an Inter face** (rosterName, 1756); **~5 sub-48dp targets** (retryBtn ~33, cancelLink ×4 ~14, footer-create ~14, leaveLink ~29, wireRetry ~29; no hitSlop/minHeight anywhere); **1 console.log** (946); **3 duplicate/dead style keys** (sectionLabelText/Accent/Hairline); the zero-size rosterAvatar/rosterInitials + hardcoded `steps="—"` placeholder. Clean: shadows, fonts, motion, exclamations/emoji, travel copy, en/ru parity (97 keys). No Alert.alert.

**Visual overlays:** not applicable — native surface.

## Overall Impression

The join arc is the best-composed moment (calm single-red browse → Archivo "Join {name}?" → a dedicated ceremony). But most sessions END on the member home, which is the noisiest, least-honest surface in the app: 20 red role tags, a "LIVE" feed that isn't, a roster leaderboard promised ("· N ACTIVE", "RESETS MON 00:00") but delivered as a column of "—", and the leader's core tools hidden behind a gesture nobody can discover. For a product whose thesis is community, the hub feels like a busy console rather than *our* headquarters.

## What's Working

1. **Browse/join arc honours One Claim** — zero red in the list, a single red JOIN on confirm, then the dedicated AllianceJoined ceremony (200–262).
2. **Wire pagination + scoped recovery** — overlay spinner, retry-in-place, endOfWire, noTransmissions (806–843); errors recover the component, not the screen.
3. **Founder-transfer friction** — typed "TRANSFER" confirmation with demotion consequences spelled out (510, 604–614) is exactly right for an irreversible power handover.

## Priority Issues

**[P0] One Claim Rule shattered in the member state** (shortNameBox 1309/1317, rosterRole ×20 at 1761, warRoomBtn 1791/1801)
- Fix: roster roles → Slate-2 (founder optionally Alliance Green as identity); short-name tag → hairline + Bone; War Room → Ink-2 + hairline-strong secondary. Leave at most one red on the screen; the map is where red lives.
- Suggested command: /impeccable polish

**[P1] Member management is undiscoverable** (long-press, 886; tap → profile)
- A leader of 20 has no way to learn the kick/promote/demote gesture. Fix: a visible per-row Manage affordance (mono chevron/label on manageable rows) or a leader-only "MANAGE ROSTER" mode. Never gate the only management path behind a hidden gesture.
- Suggested command: /impeccable clarify (affordance) or shape (if a manage mode is built)

**[P1] Silent refresh failure destroys loaded member state** (1063–1068)
- A network blip on focus-refresh nulls myAlliance/roster → isMember false → the member is dumped into "join an alliance." Fix: keep last-good data; show a non-destructive inline banner (errorBanner exists at 1196) over retained content.
- Suggested command: /impeccable harden

**[P2] Kick has no confirmation** (submitManageAction, ~682)
- Removing someone from a ≤20-person community is one tap, inconsistent with the typed transfer guard. Fix: a one-step "Kick {name}?" confirm.
- Suggested command: /impeccable harden

**[P2] Misleading founder-leave guidance** (blockedBody points to non-existent "alliance settings")
- The instruction tells the founder to promote a Marshal via a settings surface that doesn't exist (promotion is the hidden long-press). Fix: rewrite to the real path once management is discoverable.
- Suggested command: /impeccable clarify

**[P3] Slop cluster** — FOUNDR typo; false "▌ LIVE"; duplicate en.json keys; ~15 dead mission/progress styles + 3 dead style keys + zero-size avatar; off-palette #08090C; 2px side-stripe on missionCard; dead lib/theme import; console.log; uppercase-Inter; sub-48dp targets; roster "—" placeholder.
- Suggested command: /impeccable polish + adapt

## Persona Red Flags

**Alex (leader, 20 members):** no roster search/sort; management is a hidden long-press; kicks are one tap; blockedBody sends him to a settings surface that doesn't exist. **Casey (one-handed):** sub-48dp leaveLink/cancelLink/wireRetry/footer-create; long-press-to-manage is a two-hand gesture; nested vertical ScrollViews fight touch. **Priya (Bengaluru, sunlight):** 9px slate roster/aMeta wash out in sun; per-focus COUNT + N-member fan-out on mid-range hardware. **Prospective joiner:** picks an alliance on name + tag + city + n/20 alone — no activity level, no mission standing, no "is this alliance alive?" — the highest-stakes community decision made blind.

## Minor Observations

- headerSubtitle sentence "You are unaffiliated" set in Geist Mono (1355) — a sentence belongs in Inter.
- confirmTitle uses Archivo 900 Black for routine Join/Leave sheets — ceremony creep (800 would fit).
- ctaDestructive is visually identical to cta (same red bg) — "destructive" styling communicates nothing.
- "RESETS MON 00:00" + "· N ACTIVE" promise a weekly roster leaderboard the "—" column never delivers.

## Questions to Consider

1. If the map is where Claim Red means "my ground," what is red *for* on the alliance hub — the one screen where it should mean nothing?
2. The wire says "LIVE" but fetches once per focus — build the realtime feed, or stop claiming a feature the product doesn't have?
3. A prospective joiner chooses an alliance on name + member count alone. For a product whose thesis is community, is the highest-stakes decision being made with the least information?
