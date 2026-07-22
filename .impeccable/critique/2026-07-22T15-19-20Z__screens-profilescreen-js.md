---
target: ProfileScreen
total_score: 31
p0_count: 0
p1_count: 1
timestamp: 2026-07-22T15-19-20Z
slug: screens-profilescreen-js
---
Method: dual-agent (A: Explore design review · B: Explore deterministic scan)

# Critique: ProfileScreen (+ medals section) — post-fix run — 31/40 (was 27)

## Design Health Score

| # | Heuristic | Was | Now | Key finding |
|---|-----------|-----|-----|-------------|
| 1 | Visibility of System Status | 3 | 3 | Good spinners + toasts; Legacy Power still 0-then-jumps on medals load |
| 2 | Match System / Real World | 3 | 3 | #0001 gone; "SIEGE XP" still slightly opaque |
| 3 | User Control and Freedom | 3 | 4 | Delete gated, sign-out/change-pw stay reachable on load error, cancels everywhere |
| 4 | Consistency and Standards | 2 | 3 | Red budget clean (badge+delete only); change-pw modal red fixed post-assessment |
| 5 | Error Prevention | 3 | 4 | Delete type-to-confirm + null-player gate = exemplary |
| 6 | Recognition Rather Than Recall | 3 | 3 | Power breakdown explains itself |
| 7 | Flexibility and Efficiency | 2 | 3 | No name edit; medals still double-fetch (screen + section) |
| 8 | Aesthetic and Minimalist Design | 2 | 2 | Two co-equal hero numbers (Power + Influence/day); figures restated across blocks |
| 9 | Error Recovery | 3 | 3 | Specific in-app toasts replaced the native dialogs |
| 10 | Help and Documentation | 3 | 3 | First-tap tips wired |
| **Total** | | **27** | **31** | **Good — solid foundation** |

## Anti-Patterns Verdict

A: "Opens proud; the constitution now holds." B: **zero new non-semantic Claim Red beyond the sanctioned avatar-badge + delete pair**; all other reds corrected (rank/XP/wallet/sign-out neutral, alliance name → Alliance Green); 48dp everywhere; one Alert.alert (the sign-out destructive confirm); no shadows/side-stripes/gradients; fonts/motion/copy/parity clean. The medals section flat-doctrine is restored (radius 0, ink scrim not pure black, hairlines on-token). Detector font warnings the usual false positives.

## What the round shipped (verified: 630/630 jest, parse clean, profile parity plural-tolerant)

Polish: corrected the non-badge reds (rank title/XP fill/wallet/sign-out → Bone; alliance name → Alliance Green; wallet → Ink-2 secondary); Sign out and Delete now visually distinct (P0); dropped the fake "#0001" serial; removed 6 dead styles; stripped 4 debug console.logs. Harden: gated the wallet + player-dependent settings on playerRow (sign-out/change-pw stay reachable on error); pluralised daysValue (ICU one/other + Russian few/many). Adapt: 48dp on territory/settings/modal targets; removed the dead "Notification settings" false-affordance row. Medals: LegacyMedalsSection + TierBars flat-doctrine (radius 8/14/1/2 → 0, pure-black backdrop → ink scrim, hairlines → 0.16 token). Alerts: 7 non-confirm success/error dialogs → in-app Toasts; sign-out confirm stays native.

Post-assessment straggler fixes (this session, folded in): the change-password modal reused the delete modal's red title + red error — now a neutral bone title and bone error (a routine action shouldn't wear destructive red); removed dead code both agents flagged (INK3 const, radius/borders/text dead theme imports, four dead medal-label imports).

## Remaining backlog

- [P1] Medals double-fetch: ProfileScreen and LegacyMedalsSection both fetch the legacy-medals payload on every open — lift to one fetch (shared prop or context).
- [P2] Two co-equal hero numbers (Power total + Influence/day) plus a stat grid restate figures — pick one hero, demote the rest, so the screen answers "what's my one number" at a glance.
- [P3] Legacy Power reads 0 then jumps when the medals section resolves — reserve the value or show a skeleton.
- No commander-name edit affordance on the identity screen (product decision).
- avatarImage borderRadius 4 (owner left as-is; the app is otherwise 0px — revisit if squaring the avatar is wanted).

## Persona Red Flags

Alex: no name edit; medals double-fetch; three stacked readout blocks. Casey: 48dp honoured now; sign-out/delete visually distinct so the fat-finger risk is real-signalled. Priya: slate 9–12px reason lines still wash out in sun (label-scale brand choice). Returning proud player: the honours wall now renders flat/square like the rest of the app — the "permanent" feel is restored.

## Questions to Consider

1. Three big-number blocks still each claim hero weight — if a Commander keeps one number on this screen, which is it, and does the layout make that obvious?
2. Should the identity screen let a player edit their commander name, or is that deliberately elsewhere?
3. The medals payload is fetched twice per open — is the screen-level fetch still needed now the section owns its own?
