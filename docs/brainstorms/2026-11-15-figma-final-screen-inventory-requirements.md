---
date: 2026-11-15
topic: figma-final-screen-inventory
figma: https://www.figma.com/design/gcZD0MW7gKKW1vAGDeNW0p/Dominia?node-id=387-352 (page "Final")
supersedes: docs/brainstorms/2026-11-08-figma-vs-app-gap-requirements.md
---

# Figma "Final" page: screen inventory vs. the app

## Summary

Every screen and numbered case on Figma's "Final" page, checked against the app on `main` (`fd5a76e`). Each one is marked built, partly built, or missing. Missing screens come first. Figma is the source of truth: missing screens get built, and app screens Figma doesn't have go behind Remote Config flags (see Key decisions).

## How this was compared

- **Figma:** read on 2026-11-15 in a signed-in, view-only browser session. The layer list was used to enumerate every section and case label, then each section was zoomed and read. Dev Mode specs were not available ("Request access"), so nothing was measured.
- **App:** read from code, not run. `main` has not changed since the 8 Nov comparison. A separate verification pass confirmed every "missing" claim below against the app and backend code.
- **Figma sections on the page:** Login Individual Flow · Core loop of the app/game · After Core Loop FTUE (main screen explanation) · Alliance Screen Explanation · Missions Screen Explanation · Challenge Flow · MVP Gameplay Loop · Resources Sink MVP · Finalized Screens · Pending tasks / Edge cases / Revision notes.

Status key: **Missing** = no equivalent in the app · **Partial** = exists but differs from Figma · **Built** = matches Figma's intent.

---

## Missing screens and states

These have no equivalent in the app. They are the requirements this document hands to planning.

**Onboarding**
- R1. Splash screen with the DOMINIA logo before the landing page.
- R2. Landing page with "Continue with Google", "Continue with Email" and "Already playing? Sign in". The app puts Google and email on one combined form.
- R3. "Select your Age" step with a slider.
- R4. Daily Rewards screen ("Day 1: 60", Tap to Collect), shown in the core loop after the age step.
- R5. City intro screen ("Bangalore Map: Let's start your journey from Bangalore").
- R6. "Welcome to Dominia: tap to continue" overlay on the map.
- R7. Five tutorial cards with Skip / Next: What are territories? · How to start? · Claiming territory · Attack or defend · End goal.
- R8. Feature tutorial cards: "What are alliances?" and "Join or create" on the Alliance tab, and "Missions type" on the Missions tab.

**Map**
- R9. Profile avatar at the top-left of the map, opening Profile.
- R10. Economy Panel at the top-right showing Gold.
- R11. Territory search bar.
- R12. Side rail with five controls: Territories colouring (key) · Locate me · Leaderboard · Log · Chat.
- R13. Defend pop-up on the map for a solo owner (Main · Case 7: "Under attack by Mr ABC · DEFEND TERRITORY").
- R14. Defend pop-up for alliance members whose ally is under attack (Main · Case 8).
- R15. State shown to other alliance members once someone has already started defending (Main · "Condition for when it is already started").

**Challenge**
- R16. Live map on the challenge screen with the territory polygon filling by percentage (Challenge · Cases 1–5).
- R17. Distinct DEFENDING header with CANCEL DEFENSE (Challenge · Case 4) and ATTACKING header with CANCEL ATTACK (Case 3).
- R18. Recenter control when the player has panned the map mid-challenge (Challenge · Case 5).
- R19. DEFEAT overlay on the challenge screen ("Defend lost, better luck next time! … now belongs to Mr.ABC", Case 6).
- R20. VICTORY overlay on the challenge screen ("Defend won, territory is saved", Case 7).

**Missions** (Figma's tab; the app's nearest is Activity › Daily Challenges)
- R21. "Your Missions" screen with a "Refreshes in 3h 40m" countdown and an info button.
- R22. LOCK button that fixes the mission type (MARCH or RANGE) for the day, with the "Missions type" explainer. The app already locks the axis on the first completion; it has no explicit lock action.
- R23. Missions locked state with progress bars and a disabled CLAIM (Missions · Case 2).
- R24. Rewards-ready state with a CLAIM button per mission (Missions · Case 3).
- R25. Alliance Missions section ("The Long March") inside the Missions screen, with a "Join or create an alliance to be part of alliance missions" variant for players without an alliance.

**Alliance**
- R26. Alliance search ("Alliance name, Alliance tag…" + Search).
- R27. Alliance list rows showing name with tag, territory count and members out of 20.
- R28. Alliance detail pop-up (Alliance · Case 3): emblem, name and tag, description, Location, Territories, Type ("Invite only"), Members, Join, and a ranked member list with territories held.
- R29. Member view header with description, Location, Territories, Type and member count (Alliance · Case 4), plus an Alliance Members list with territories held.
- R30. Alliance Rules field on the create form (Alliance · Case 5).
- R31. Alliance name validation states on the create form (Alliance · Case 6).

**Profile**
- R32. Accordion layout: Your Territories · Activity · Resource Balance · App Settings · Statistics.
- R33. Resource Balance section: current gold balance and total gold used.
- R34. Statistics section.
- R35. Units and Measurements setting (Kilometres) under App Settings.
- R36. Edit Profile page: My Details, change / remove photo, name (Profile · Case 4).

**Additional screens**
- R37. Leaderboards with a Territories / Distance selector, SOLO / ALLIANCE toggle, top-3 podium, and a pinned "Your position" row.
- R38. Events tab as a "coming soon" placeholder (Figma marks Events "Not for MVP").

---

## Full inventory

### Login Individual Flow

| Figma flow | App today | Status |
|---|---|---|
| Sign up · Google (success) → FTUE | Google sign-in on the combined SignIn screen | Partial |
| Sign up · Email (success): splash → landing → email + password (8+ characters) → SIGN UP → FTUE | Combined SignIn form in Create Account mode. A 6-digit code step appears only when Clerk requires email verification | Partial |
| Sign in · Google (success) → map | Google sign-in | Built |
| Sign in · Email (success): email, password, Forgot password, SIGN BACK IN, Sign in with Google, "Haven't started yet? Sign up" | Combined SignIn form in Sign In mode | Partial |
| Sign in · Email failure: wrong password, wrong email | Error handling on the SignIn form | Partial |
| Forgot password, correct code: "LOCKED OUT?" → SEND RESET LINK → "GET BACK IN" (code + new password) → CREATE NEW PASSWORD → map | "Reset password" → Send Code → code + new password → back to sign in | Partial |
| Forgot password, wrong code | Error state on ForgotPassword | Partial |
| Signed in → map | AuthGate routes signed-in players to the map | Built |

### Core loop (onboarding)

| Figma screen | App today | Status |
|---|---|---|
| Choose your name, with taken and invalid-character errors | UsernameScreen with live availability check | Built |
| Select your Age | — | Missing (R3) |
| Daily Rewards, Day 1: 60 | — | Missing (R4) |
| Bangalore Map city intro | City set silently from the home pin or locale | Missing (R5) |
| Welcome to Dominia | Welcome intro before sign-in | Missing (R6) |
| 5 tutorial cards | 3-row "How it works" + first-tap coach marks | Missing (R7) |
| Main-screen coach marks: side-rail callouts → "tap a territory" → "Start claiming" | First-tap tips + pulsing objective ring | Partial |

### Map (Finalized · Main Screen)

| Figma case | App today | Status |
|---|---|---|
| Chrome: avatar, Economy Panel, search, 5-icon rail, tabs Map · Missions · Alliance · Events | Resource banner (Iron · Stone · Gold · Morale), Sitrep card, text rail (CHAT · BOARDS · LOG), tabs Map · Activity · Alliance · Profile | Partial (R9–R12) |
| Case 1: no territories captured | Map with unclaimed territories | Built |
| Case 2: some territories captured, coloured by owner | Territory fills: yours red, alliance green, enemy blue | Built |
| Case 3: tap empty territory → compact card (Unclaimed, distance, 30-min limit, "10 gold START CLAIMING") | Full TerritorySheet with Claim | Partial |
| Case 4: tap solo player's territory → "Mr. ABC territory", "8 gold CONTEST TERRITORY" | TerritorySheet with Contest, priced in Iron | Partial |
| Case 5: tap alliance player's territory | TerritorySheet alliance state | Partial |
| Case 6: Key tapped: Your / Alliance / Enemy | Key legend adds Unclaimed and Under siege | Partial |
| Case 7: solo defend pop-up | Push notification → DefenderAccept screen | Missing (R13) |
| Case 8: alliance defend pop-up | Push to the defender's alliance → DefenderAccept | Missing (R14) |
| Already-started condition for alliance members | DefenderAccept "Already defended" state, reached by push only | Missing (R15) |

### Challenge (Finalized · Challenge Screen and Challenge Flow)

| Figma case | App today | Status |
|---|---|---|
| Arm: "57 Seconds to start · Walk 5m · 10 minutes · 10 Gold is used once you start · START WALK / NOT YET" | ActiveClaim arm phase with the same structure | Built |
| Case 1: challenge started, live map, polygon fills, TIME LEFT, STEPS WALKED | SVG progress ring, no map | Partial (R16) |
| Case 2: cancel confirm → "Cancelling the claim…" | Cancel confirm with free / paid / contest copy | Built |
| Case 3: claiming an enemy territory being defended (ATTACKING) | CONTESTING header | Partial (R17) |
| Case 4: defending (DEFENDING, CANCEL DEFENSE) | No distinct defending header | Missing (R17) |
| Case 5: map moved mid-challenge, recenter | — | Missing (R18) |
| Case 6: defender fails → DEFEAT | ContestResultScreen "Territory lost" | Partial (R19) |
| Case 7: defender succeeds → VICTORY | ContestResultScreen "Territory held" | Partial (R20) |
| Success: "Securing the claim…" → map | ClaimSuccessScreen securing state, then a celebration | Partial |

### Missions (Finalized · Missions Screen and Missions Screen Explanation)

| Figma case | App today | Status |
|---|---|---|
| Case 1: default "Your Missions", MARCH / RANGE, Easy 5k · Medium 10k · Hard 15k steps → 10 / 20 / 40 Gold, LOCK, Alliance Missions | Activity › Daily Challenges: 3 tiers, axes March / Range / Drill / Tempo, mixed XP and resource rewards | Partial (R21, R22, R25) |
| Case 2: missions locked | — | Missing (R23) |
| Case 3: rewards ready to claim | "COMPLETE" button per challenge | Partial (R24) |
| Without-alliance variant | — | Missing (R25) |
| "Missions type" explainer card | — | Missing (R8) |

### Alliance (Finalized · Alliance Screen and Alliance Screen Explanation)

| Figma case | App today | Status |
|---|---|---|
| Case 1: default list with 3 alliances, search, Create | City list without search, "Or create your own alliance →" | Partial (R26, R27) |
| Case 2: many alliances, scrolling | Scrolling list | Built |
| Case 3: alliance detail pop-up | "Join {name}?" modal, no detail | Missing (R28) |
| Case 4: member view: header stats, Alliance Missions, Alliance Messages (Live, "No transmissions", Chat), Alliance Members, Leave Alliance | Weekly mission, Wire messages, roster, Leave; no header stats or territories per member | Partial (R29) |
| Case 5: create: full name 3–24, short name 3 letters, logo grid, Alliance Rules, CREATE ALLIANCE | 3-step create: name + tag + emblem → HQ territory → confirm | Partial (R30) |
| Case 6: alliance name issues | Create form validation (not compared in detail) | Partial (R31) |
| Tutorial: What are alliances? / Join or create | — | Missing (R8) |

### Profile (Finalized · Profile Screen)

| Figma case | App today | Status |
|---|---|---|
| Case 1: default accordion, all sections closed | Long scroll: power, rank, territories, record, medals, resources, settings | Partial (R32) |
| Case 2: one section open (App Settings: chat push, Units, Change password, Sign out, Delete account) | Settings: chat push, Change password, Delete account, Sign out | Partial (R35) |
| Case 3: several sections open (Resource Balance: current gold, total gold used) | Resources → Wallet with 4 resources | Partial (R33) |
| Statistics section | — | Missing (R34) |
| Case 4: Edit Profile | Avatar EDIT / ADD only | Missing (R36) |

### Additional screens

| Figma screen | App today | Status |
|---|---|---|
| Leaderboard: All option by default, Territories / Distance, SOLO / ALLIANCE, podium, Your position (4 variants) | POWER / TERRITORY / BATTLES, PLAYERS / ALLIANCES, own row highlighted in the list | Partial (R37) |
| Log "History": claimed / attack / defend icons, territory, date | ActivityLog feed | Built |
| Chat: GLOBAL / ALLIANCE ("Direct API from discord") | Chat: CITY / ALLIANCE, in-app | Partial |
| Events tab | — | Missing (R38) |

---

## In Figma's loop but not designed yet

The MVP Gameplay Loop and Resources Sink diagrams describe systems that have no screens on the Final page. Neither the app nor the backend has them.

- **Seasons:** a season starts, the map can load a new version ("S1B1, S1B2…") when no territories are left, and the map is cleaned out and reset at the end of every season.
- **Tournaments:** players take part in tournaments solo or with their alliance.
- **Season rewards:** awarded to the solo player or alliance holding the most territories at season end.
- **Daily login rewards:** listed as a Gold source in Resources Sink, with the Day 1 screen drawn in the core loop. No schedule beyond Day 1 is drawn.

The loop also confirms rules the app already has: alliances unlock at player level 3 (backend `MIN_LEVEL_TO_JOIN_ALLIANCE = 3`), and challenge wins award XP as well as Gold.

## App screens Figma doesn't have

These stay in the code behind Remote Config flags, off by default (see Key decisions).

- Map: Sitrep card, first-claim objective banner and free first claims, battle chips, home-base pennants, the multi-resource banner.
- Territory sheet: Develop and development levels, Abandon, Legacy, Hall of Holders, walk-length stepper, streak and influence rows.
- Onboarding: permissions step and home-pin placement. Location and step permissions stay as platform necessities.
- Activity: Attack Day card, streak track, Health Connect cards (kept as a platform necessity on Android).
- Alliance: War Room, Command Post, top contributors, roster management, 3-step create with an HQ territory.
- Profile: power and rank ladder, record grid, honour medals, Wallet and Donate Morale.
- Results: ClaimSuccessScreen celebration, the four-variant ContestResultScreen, the Stone option on DefenderAccept.

## Changes in Figma since the 8 Nov comparison

- Missions became "Your Missions": refresh countdown, LOCK action, locked and rewards-ready states, and Alliance Missions moved onto this screen.
- The alliance list gained search, tags and territory counts. The alliance detail became a pop-up with description, Location, Territories and Type ("Invite only").
- Profile gained a Statistics section.
- New sections: MVP Gameplay Loop, Resources Sink MVP, Missions Screen Explanation.

---

## Key decisions

- **Figma is the source of truth.** Only features on Figma ship.
- **App-only features are hidden, not deleted.** Each sits behind its own Firebase Remote Config flag, default off.
- **Gold is the only currency.** Resources Sink lists the sources (missions, daily login, claiming empty or enemy territory, defence wins) and the sinks (claiming empty territory, claiming enemy territory, defending).
- **Player level and XP stay.** The Figma loop uses them for the level-3 alliance gate and challenge rewards. This replaces the 8 Nov note that XP leaves the product.
- **Figma decides content and flow; `DESIGN.md` decides the look.** The high-fidelity frames (challenge map, Victory / Defeat, Daily Rewards) are matched closely.
- **Platform necessities stay minimal:** OS location and step permissions, Health Connect on Android, and email verification when Clerk requires it.

## Scope boundaries

- This document covers features, screens and flows. Spacing, type sizes and colours were not measured.
- The Research and Updations pages and the design comments are not covered.
- Seasons, tournaments and season rewards are recorded above but not listed as missing screens, because Figma has no screens for them.

## Outstanding questions

- **Defending costs Gold in Resources Sink.** The amount isn't drawn, and the app currently offers an optional Stone spend. Ask design for the price.
- **Alliance "Type".** The detail pop-up shows "Invite only", but the create form has no type picker. Ask design whether alliances can be open or invite-only, and how an invite works.
- **Statistics content.** The section header is drawn, but its contents aren't. The old missions stats table (Today / This week / Best × Distance, Active minutes, Total steps) is the likely content. Confirm with design.
- **Global chat.** Figma labels the tab GLOBAL and notes a Discord API. The app has city chat.
- **Tab label.** Some Figma frames label the second tab "Activity" and others "Missions". This document assumes "Missions", as in the Missions Screen Explanation.

## Assumptions

- Copy was read at 9–17% zoom, so small text may be slightly off.
- The app inventory comes from code on `main` at `fd5a76e`, not from running the app.
