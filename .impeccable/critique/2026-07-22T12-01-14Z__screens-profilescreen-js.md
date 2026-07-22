---
target: ProfileScreen
total_score: 27
p0_count: 1
p1_count: 1
timestamp: 2026-07-22T12-01-14Z
slug: screens-profilescreen-js
---
Method: dual-agent (A: Explore design review · B: Explore deterministic scan)

# Critique: ProfileScreen (own identity / honours / account settings) — 27/40

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Good spinners; medals load separately and Legacy Power reads 0 then jumps on open |
| 2 | Match System / Real World | 3 | Coherent commander language; "#0001" and "SIEGE XP" strain plausibility |
| 3 | User Control and Freedom | 3 | Delete is well gated; the "Notification settings" row is a dead control with a chevron |
| 4 | Consistency and Standards | 2 | Claim Red spent ~5–7×; rounded medals vs square everything; sign-out = delete in colour |
| 5 | Error Prevention | 3 | Delete type-to-confirm gate is strong; the settings block still renders with a null player on load error |
| 6 | Recognition Rather Than Recall | 3 | Power breakdown explains itself |
| 7 | Flexibility and Efficiency | 2 | No commander-name edit; dead notification row; double medal fetch on every open |
| 8 | Aesthetic and Minimalist Design | 2 | Red noise competes for the eye; three near-identical big-number blocks stack with equal weight |
| 9 | Error Recovery | 3 | Delete-failed / upload-failed messages are specific and calm |
| 10 | Help and Documentation | 3 | First-tap tips wired to five sections |
| **Total** | | **27/40** | **Acceptable — significant improvements needed** |

## Anti-Patterns Verdict

**LLM assessment:** the typography constitution is right (mono chrome, Inter sentences, Archivo ceremony) and the identity header genuinely reads as a place of pride — but the colour constitution is broken. **~5–7 non-semantic Claim Red elements co-render** in the default state: avatar edit badge (L1043/1049), rank title (L1074), alliance name (L1089), XP progress fill (L1133), and the wallet CTA (L1286/1296). Two are worse than budget: the **alliance name in Claim Red is a Locked Meaning breach** — the alliance is "ours", it should be Alliance Green — and the wallet is a **red-bordered CTA**. Two data bugs sit on the most identity-loaded strings: `commanderLabel` is a hardcoded **"COMMANDER · #0001"** shown to every player, and `daysValue` has no plural so a 1-day streak renders **"1 days"**.

**Deterministic scan:** confirms the 5-element red co-render + alliance mis-colour + red CTA; **7+ sub-48dp touch targets** (territory rows ~26dp, four settings rows ~29dp, wallet ~46dp, modal buttons ~38dp, none with hitSlop/minHeight); **4 console.logs** (L392/414/451/452); **6 dead styles** (legacyList/Entry/Title/Descriptor, powerBlock); **7 off-brand Alert.alert dialogs** used for non-confirm success/error messaging (delete-failed, password-changed, five avatar-upload paths) — separate from the one accepted destructive sign-out confirm. Clean: shadows/side-stripes, fonts, motion, uppercase-Inter/exclamations/emoji, travel copy, en/ru parity. The imported medals section (LegacyMedalsSection.js) breaks the flat doctrine — borderRadius 8/14 and a pure-black rgba(0,0,0,0.7) modal backdrop — undercutting the "earned, permanent" peak.

**Visual overlays:** not applicable — native surface.

## Overall Impression

The screen opens proud — the 72px avatar + Archivo name + rank line is the best moment — and the delete-account safety gate is exactly right for a Play-Store-required destructive flow. But two things undercut it: red has lost all authority (spent on a rank title, an XP bar, an avatar badge, and a CTA), and the single most consequential fix is that **Sign out and Delete account render in identical Claim Red** — a routine daily action dressed with the same alarm as irreversible destruction. The screen opens proud and ends with two equally-red exits.

## What's Working

1. **Delete-account safety gate** (L142–231) — username re-type, case-insensitive match, confirm disabled until match, non-dismissable backdrop, specific failure alert, sign-out race with 5s fallback.
2. **Identity header** (L631–666) — correct type constitution with adjustsFontSizeToFit/numberOfLines guarding long names; a real pride surface.
3. **Power breakdown transparency** (L697–723) — each source shows a plain-Inter "reason" line, honouring the effort behind the number.

## Priority Issues

**[P0] Sign out and Delete account are visually identical, both Claim Red** (L917 + L184 share settingsSignOut)
- Colour carries no signal when a daily action and account destruction look the same. Fix: Delete stays the one destructive red; Sign out → neutral Bone. → polish

**[P1] One Claim Rule broken ~5–7×, incl. the alliance name in the wrong locked colour** (L1043/1074/1089/1133/1286)
- Fix: reserve one red (Delete, the true destructive endpoint); rank title / XP fill / avatar badge → Bone; wallet CTA → Ink-2 secondary; **alliance name → Alliance Green** (semantic). → polish

**[P2] Settings block renders during profile load-error with a null player** (L864 gate on !loading only)
- Delete-account then has username undefined and Wallet navigates with playerId undefined. Fix: gate the settings/wallet block on playerRow too. → harden

**[P2] Two data bugs on the identity strings**
- `commanderLabel` = static "COMMANDER · #0001" for everyone; `daysValue` "1 days" has no plural. Fix: wire a real id or drop the serial; pluralise daysValue (ICU one/other). → clarify/harden

**[P3] Touch targets, dead control, off-brand alerts, dead code, logs**
- 7+ sub-48dp rows/buttons (no hitSlop/minHeight); dead "Notification settings" row with a chevron; 7 non-confirm Alert.alert dialogs that should be in-app surfaces; 6 dead styles; 4 console.logs. → adapt + polish

## Persona Red Flags

**Alex:** no commander-name edit on the identity screen; three near-identical readout blocks (Power/Influence/stat grid); double medal fetch every open. **Casey:** 6px-tall settings rows and adjacent same-red Sign out / Delete invite a fat-finger (delete is modal-gated, so recoverable). **Priya:** slate-2 9–12px reason lines and hints wash out in sunlight; StatusBar padding can misplace the header on some OEM skins. **Returning proud player:** the honours wall renders in a visually foreign rounded/pure-black style, so it feels less permanent than the rest of the app; Legacy Power visibly jumps from 0 on open.

## Minor Observations

- avatarImage borderRadius 4 (L1017) — the pill exception is documented for map resource pills only, not avatars.
- Unused styles powerBlock / legacyEntry / legacyTitle etc.
- Delete confirm and Cancel are equal-weight flex:1 — destructive convention favours de-emphasising the destructive side.
- SIEGE XP / POWER / INFLUENCE — three big-number blocks each claim hero weight.

## Questions to Consider

1. If every non-map screen gets one red, why does the *identity* screen — the least combative surface in the game — spend it on an XP bar and a rank title? Should Profile be a zero-red screen, red reserved for the map and the single destructive endpoint?
2. The alliance is "ours" (green) everywhere else — is red here a deliberate reframing, or a copy-paste of the Claim style? If deliberate, document it like the other adjudicated exceptions.
3. Three stacked big-number blocks each claim "hero" weight — if a Commander could keep only one number on this screen, which is it, and does the layout make that obvious?
