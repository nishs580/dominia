---
date: 2026-11-08
topic: figma-vs-app-gap
status: decided — ready for planning
figma: https://www.figma.com/design/gcZD0MW7gKKW1vAGDeNW0p/Dominia?node-id=387-352 (page "Final")
---

# Figma "Final" page vs. current app — differences

## How this was compared

- **Figma:** the "Final" page, read visually from the public view-only file in a browser. The Figma connector's account (Sowmya Gupta) has no access to the file, so no layer data, tokens or exact specs were pulled. Sections read: Sign-up / sign-in flows, Core Loop Explanation, Main Screen Explanation, Alliance Screen Explanation, Challenge Flow, Finalized Screens (Main, Alliance, Challenge, Missions, Profile, Additional), and the Pending Tasks / Edge Cases / Revision lists.
- **App:** read from code on `main` (`fd5a76e`), not by running it. Mainly `App.js`, `screens/*`, `components/*` and `locales/en.json`.
- **Fidelity caveat:** most Figma frames are grey-box wireframes. A few are high fidelity: Daily Rewards, the dark-map challenge screens, and the Victory / Defeat cards. The app follows a locked visual system (`DESIGN.md`, "Commander's Field Desk"). Visual differences are therefore listed separately from structural and feature differences.

## Headline differences

1. **Economy model.** Figma has a single currency, **Gold**. It drives the Economy Panel, daily rewards, mission rewards, and the claim cost ("10 Gold"). The app runs **Iron · Stone · Gold · Morale**, plus XP and Influence. Claims are priced in Iron, gold is committed when the walk starts, and defence can be paid in Stone.
2. **Bottom navigation.** Figma: **Map · Missions · Alliance · Events**, with Profile behind an avatar at the top-left of the map. App: **Map · Activity · Alliance · Profile** (`App.js:102-130`). Figma itself marks Events "Not for MVP".
3. **Map chrome.** Figma has an avatar, an Economy Panel, a **search bar**, and a five-icon side rail. The app has a full-width resource banner, a Sitrep card, and a first-claim banner. Its side rail is text-only (CHAT · BOARDS · LOG), Locate me and Key sit bottom-left, and there is no search.
4. **Onboarding.** Figma: name → **age** → **Daily Rewards** → Bangalore intro → Welcome → a five-card tutorial → a coach-marked first claim. App: intro → sign-in → name → permissions → **place home pin** → "Enter the map", followed by first-tap coach marks. Age, daily rewards and the tutorial carousel do not exist in the app.
5. **Territory tap.** Figma shows a compact card: name, owner, distance, time limit, cost, one CTA. The app shows a full **TerritorySheet** that adds streak, generation, development levels, legacy, Hall of Holders, a walk stepper, Develop and Abandon.
6. **Defence.** In Figma, a **map pop-up** ("Under attack by Mr ABC · DEFEND TERRITORY") is shown to the owner and to alliance members. In the app, `DefenderAccept` opens **only from a push notification** and offers a choice between match pace and spending Stone.
7. **Results.** In Figma, Victory and Defeat are overlays on the challenge screen, and a successful claim shows "Securing the claim…" before returning to the map. The app has a dedicated `ClaimSuccessScreen` (XP, gold, stats, "claim another") and a four-variant `ContestResultScreen`.

## Area-by-area

Legend: ✅ matches · 🟡 partly matches · ❌ in Figma, not in app · ➕ in app, not in Figma

### Auth (sign-up / sign-in / forgot password)

| Figma | App | |
|---|---|---|
| Splash with DOMINIA logo, then a landing page with "Continue with Google" / "Continue with Email" and "Already playing? Sign in" | `WelcomeScreen` has a two-step intro ("How it works": 3 rows), then "Get started" or "Sign in" | 🟡 |
| Tagline "Walk . Claim . Conquer" | "Walk. Claim. Conquer. Defend." | 🟡 copy |
| Separate sign-in screen: email, password, Forgot password, SIGN BACK IN, "Sign in with Google", "Haven't started yet? Sign up" | One `SignInScreen` toggles between Sign In and Create Account | 🟡 |
| Google account chooser, then consent | Google sign-in | ✅ |
| No email verification step shown | 6-digit email verification sub-view on sign-up | ➕ |
| Forgot password: "LOCKED OUT?" → email → SEND RESET LINK → "GET BACK IN" (verification code + new password) → CREATE NEW PASSWORD → map | "Reset password" → Send Code → reset code + new password → Reset Password → back to sign in | 🟡 copy and the final destination differ |
| Wrong-password and wrong-code error states drawn | Error handling exists (states not compared in detail) | 🟡 |

### Onboarding / core loop

| Figma | App | |
|---|---|---|
| "Choose your name" with taken / invalid-character error states | `UsernameScreen` with live "Checking availability…" / "Available ✓" | ✅ |
| "Select your Age" slider | — | ❌ |
| "Daily Rewards — Day 1: 60 — Tap to Collect" (gold bar) | — (no login reward system) | ❌ |
| "Bangalore Map — Let's start your journey from Bangalore" | City falls back to Bengaluru or Saint Petersburg by locale; no explicit city screen | ❌ |
| "Welcome to Dominia — tap to continue" | Welcome intro | 🟡 |
| Tutorial cards with Skip / Next: What are territories? · How to start? · Claiming territory · Attack or defend · End goal | "How it works" (3 rows) + `walkthrough.*` first-tap coach marks | 🟡 much lighter |
| — | Permissions step (Location + Step counter) | ➕ |
| — | "Set your base" home-pin placement | ➕ |
| — | First claims are free ("Two more claims are free") | ➕ |
| Main-screen coach marks: side-rail callouts, "tap the territory", "Start claiming" | First-tap tips + pulsing objective ring on the map | 🟡 |

### Main (Map) screen

| Figma | App | |
|---|---|---|
| Avatar at top-left opens Profile | Profile is a tab | ❌ / moved |
| "Economy Panel" at top-right (gold) | Full-width resource banner: Iron · Stone · Gold · Morale | 🟡 different model |
| **Search bar** (full width) | — | ❌ |
| Side rail: 5 icons (Territories colouring/key · Locate me · Leaderboard · Log · Chat) | Rail: CHAT · BOARDS · LOG (text, bottom-right). Locate me + Key are separate bottom-left buttons | 🟡 |
| Key: Your / Alliance / Enemy territory | Key: Yours / Alliance / Theirs / Unclaimed / Under siege | ➕ |
| Territory card: silhouette, name, "Unclaimed" or "Mr. ABC territory", distance, time limit 30 min, "10 [gold] START CLAIMING" / "CONTEST TERRITORY", close ✕ | TerritorySheet (see headline 5); claims priced in Iron, with a walk-length stepper | 🟡 |
| — | Sitrep card (streak, today's challenge, Attack Day) | ➕ |
| — | First-claim objective banner | ➕ |
| — | Battle chips on the map ("UNDER SIEGE", "FELL 3H AGO"), alliance emblems, home-base pennants | ➕ |
| Defend pop-up on the map, for solo and alliance players | Push notification → `DefenderAccept` screen | 🟡 different entry point |
| Light street basemap in the wireframes | Mapbox Standard style (`MapScreen.js:2904`) | 🟡 visual |

### Challenge (claim / attack / defend) flow

| Figma | App | |
|---|---|---|
| START CLAIMING → "PROCESSING…" on the card | Claim → confirm cost step | 🟡 |
| "57 Seconds to start · Walk 5m to claim it · you get 10 minutes · 10 Gold is used once you start · START WALK / NOT YET" | Arm phase with the same structure: seconds to start, "Walk {m} m to take it", gold committed, START WALK / NOT YET | ✅ |
| Active: live dark map, **territory polygon fills** with %, "0/5m", TIME LEFT, STEPS WALKED, CANCEL CLAIM | Active: SVG **progress ring**, TIME LEFT, STEPS WALKED, plus STRIDE, PACE and status banners (vehicle, paused, GPS weak, 50%, 90%) | 🟡 progress metaphor differs |
| Header variants: CLAIMING / ATTACKING / DEFENDING + "In Progress"; CANCEL ATTACK / CANCEL DEFENSE | CLAIMING / CONTESTING + "In Progress" | 🟡 no distinct defending header seen |
| Recenter control when the map has been panned | — (no live map on this screen) | ❌ |
| Cancel confirm: "Are you sure…? Continue challenge / Cancel claim" → "Cancelling the claim…" | Cancel confirm block with free / paid / contest copy | ✅ |
| Success: "Securing the claim…" → map with the territory coloured | `ClaimSuccessScreen`: securing state, then a celebration (silhouette, XP, gold, distance, perimeter, "claim another") | ➕ richer |
| DEFEAT / VICTORY overlays with shield art ("Defend lost… now belongs to Mr.ABC" / "Defend won, territory is saved") | `ContestResultScreen` with 4 variants (taken / failed / held / lost), metres walked vs opponent, resource line | 🟡 |
| — | "Step tracking unavailable" blocked state, lapsed "CLAIM RELEASED" | ➕ |

### Missions (Figma tab) vs. Activity (app tab)

| Figma "Daily Missions" | App Activity "Daily Challenges" | |
|---|---|---|
| "0 / 3 Secured" | "{n} / 3 SECURED" | ✅ |
| MARCH / RANGE toggle | Axes March / Range / Drill / Tempo, Locked or Armed | 🟡 |
| Easy 5k / Medium 10k / Hard 15k steps → 10 / 20 / 40 Gold | 3 tiers, rewards in XP / Stone / Iron / Gold / Morale | 🟡 currency |
| Per-tier "Claim 10 Gold" button once complete | "COMPLETE" button; states SECURED / LOCKED / NO DATA | 🟡 |
| Stats table: Today / This week / Best × Distance / Active minutes / Total steps | RECORDS: Today vs Best × Distance / Active minutes, plus a WEEKLY STEPS bar chart | 🟡 no "This week" column |
| — | Week streak track, Attack Day card, Health Connect cards, XP / level header | ➕ |

### Alliance

| Figma | App | |
|---|---|---|
| "CURRENT ALLIANCE · NO ALLIANCE · Join or create…" | "ALLIANCE · NO ALLIANCE · You are unaffiliated" | ✅ |
| "Alliances in Bangalore" + **Search** | "Alliances in {city}" list, no search | 🟡 ❌ search |
| Tap an alliance → **detail page**: Join, territories held, member count, members table (Defence won, Territories held), **Alliance Rules** | Tap → "Join {name}?" modal (no preview page) | ❌ |
| "Create your own Alliance" pinned at the bottom | "Or create your own alliance →" | ✅ |
| Create (single page): full name 3–24 chars, short name 3 letters, 10-logo grid, **Alliance Rules**, CREATE ALLIANCE, validation errors | `CreateAllianceScreen`, 3 steps: name + tag + emblem → **HQ territory** → confirm | 🟡 ❌ rules, ➕ HQ |
| Member view: Alliance Missions ("The Long March" progress), Alliance Messages (Live, "No transmissions", Chat), members table, Leave Alliance | Weekly collective mission, Wire messages (LIVE, "NO TRANSMISSIONS"), roster, Leave | ✅ |
| — | Top contributors, roster management (kick / transfer), **War Room**, **Command Post** | ➕ |
| Tutorial cards: What are alliances? / Join or create | — | ❌ |

### Profile

| Figma | App | |
|---|---|---|
| Accordion: Your Territories · Activity · Resource Balance · App Settings | Long scroll: power, rank, territories, record grid, honour medals, resources → Wallet, settings | 🟡 structure |
| Resource Balance: current gold balance, total gold used | Wallet: 4 resources, Donate Morale | 🟡 |
| Settings: Alliance chat push, **Units and Measurements (Kilometres)**, Change password, Sign out, Delete account | Chat push, Change password, Delete account, Sign out | ❌ units |
| Edit Profile: photo change / remove, name | Avatar EDIT / ADD | 🟡 name editing not confirmed |

### Additional screens

| Figma | App | |
|---|---|---|
| Leaderboards: Territories / Distance dropdown, SOLO / ALLIANCE, **podium top 3**, list, **"Your position" pinned** | POWER / TERRITORY / BATTLES strip, PLAYERS / ALLIANCES, list | 🟡 ❌ podium, your position, distance board |
| Log "History": icon (claimed / attack / defend), territory, date | `ActivityLogScreen` event feed | ✅ |
| Chat: **GLOBAL** / ALLIANCE ("Direct API from discord") | Chat: **CITY** / ALLIANCE, in-app | 🟡 scope + backend note |
| Events tab (not MVP) | — | ❌ (by design) |

## Visual language

- Figma's grey boxes use rounded pill buttons and light-grey panels. The app's tokens (`DESIGN.md`) specify **0px radius**, ink surfaces, hairline borders, and Geist Mono uppercase labels.
- The few high-fidelity Figma frames match the app in places: the dark map, the green "fill" for claim progress, and white heavy display type. They diverge elsewhere: Figma uses gold-bar and shield illustrations, the app has none.
- Territory colours agree in meaning: yours = red, alliance = green, enemy = blue.
- Treat Figma as the source for **flow and content**, and `DESIGN.md` as the source for **look**, unless the team decides otherwise.

## Figma's own open items (from the board)

- Pending: Edit Profile page · defend pop-ups · leaderboard mock-up · Events (not MVP).
- Edge cases to mock up: claiming a mission reward · defender fails / succeeds · attacker wins / loses · **lost internet during a challenge** · **searching for a territory** · **alliance member defending your territory**.
- Revision queued: Daily Missions screen, Alliance screen.

## Decision (2026-11-08)

**Figma is the source of truth. The app ships only the features that appear in Figma.**

This settles the earlier open questions in Figma's favour:

1. **Economy:** Gold only. Iron, Stone, Morale, XP and Influence leave the product.
2. **Navigation:** Map · Missions · Alliance · Events tabs, with Profile behind the map avatar. Events opens a simple "coming soon" placeholder until it is designed.
3. **Onboarding:** follow the Figma core loop: name → age → daily reward → city intro → welcome → five tutorial cards → coached first claim.
4. **Defence:** the in-map "Under attack" pop-up, for the owner and for alliance members.
5. **Map:** add territory search and the five-icon side rail. The territory card is the compact Figma card.
6. **Alliance:** add search, the detail preview with Rules, and single-page create with Rules.
7. **Profile:** accordion layout and a units setting.
8. **Leaderboards:** Territories / Distance boards, podium, and pinned "your position".
9. **Challenge:** a territory polygon filling on a live map, Victory/Defeat overlays, and "Securing the claim…" before returning to the map.

Everything marked ➕ above is out of scope for the product and is hidden. This includes the Sitrep card, Attack Day, War Room, Command Post, the Develop / Abandon / legacy territory features, Wallet / Donate Morale, the honour medals, the power/rank system, the claim-success celebration, free first claims and home-pin placement.

**Platform necessities stay.** Some steps aren't in Figma but the app can't work without them: OS location and step-counter permissions, Health Connect setup on Android, and email verification on sign-up. They are not "extra features". Each is kept minimal and placed where Figma's flow first needs it, e.g. location just before the city map and step access just before the first claim.

**Hidden, not deleted.** App-only features stay in the codebase and are gated behind flags controlled from Firebase Remote Config. No code, backend logic, schema or data is deleted. The app already uses `@react-native-firebase/app` and `messaging` (`package.json:19-20`). Remote Config is not installed or used yet.

- **One flag per app-only feature.** Examples: multi-resource economy, War Room, Command Post, Attack Day, territory development, Wallet, honour medals, power/rank.
- **Default OFF.** If Remote Config can't be fetched, the app behaves as Figma.
- **A flag that is on swaps the screen back to the app version.** For example, the multi-resource economy flag puts Iron pricing in place of Gold, and the full territory sheet in place of the compact card. Planning has to define what each flag swaps.

**Look.** Figma decides what is on each screen and how flows connect. `DESIGN.md` decides how it looks. The grey-box styling (rounded pills, light panels) is not copied. The high-fidelity Figma frames are matched closely: the dark-map challenge screens, Victory / Defeat, and Daily Rewards.

## Success criteria

- With every flag off, a new player can complete every Figma flow without meeting a screen, control or currency that Figma lacks. The only exceptions are the platform necessities above.
- Each app-only feature can be switched back on from Remote Config without an app release.

## Outstanding questions for planning

- Where Figma shows only a name, planning must define the rules: the age options and what age is used for, the daily-reward schedule after Day 1, mission reward amounts, and what Gold buys.
- Gold-only pricing needs a server-side counterpart. The app currently prices claims in Iron (TerritorySheet). Confirm whether the backend computes cost, and how it switches pricing per flag.
- Figma's own pending items (Edit Profile, defend pop-up, leaderboard, edge cases) are only partly drawn. Build from the drawn cases and log the gaps back to design.

## Assumptions / limits

- The Figma content was read visually at 8–15% zoom. Small copy may be slightly off, and nothing was measured (spacing, type sizes, colours).
- The app was read from code, not run. Runtime-only states (exact error text, animations) were not compared.
- "Node 387-352" opened the whole "Final" page. If a narrower frame was meant, this comparison is wider than intended.
