---
date: 2026-11-27
topic: updated-ux-prototype-parity
figma: https://www.figma.com/design/x4d6znyf2aMOv1UBUMT7G8/Dominia-New-Design?node-id=20-2 (page "09 · Prototype · Updated UX")
builds-on: docs/plans/2026-11-26-001-feat-updated-ux-review-fixes-plan.md
---

# Updated UX prototype parity

## Summary

Make the app in Figma mode (`legacy_tabs` off) match every screen on the Updated UX prototype page. The work covers the bugs found on device, the copy and layout differences, the new screens and states the page adds, and the backend support some of them need. It ships as phased PRs.

## How this was compared

On 2026-11-27, all 70 frames were read with Figma screenshots and text layers, and compared against the app code on `feat/updated-ux-review-fixes`. The `figma-preview` build was also run on an Android emulator. The target build turns off every app-only flag except `first_claim_objective`. Placeholder names and numbers in Figma (Mr. ABC, Bangalore, 88 territories) are sample data and are not requirements.

## Key decisions

- **First claim:** it stays a real free claim (decided 2026-11-26). The prototype's "demo" screens map onto the real first claim, and "Demo complete" becomes the TAKEN result.
- **Moment words:** results say TAKEN / HELD / LOST, never VICTORY / DEFEAT, as the page's design note specifies.
- **Commander names:** new names may not contain symbols, including `.` and `_`. Existing names keep working unchanged.
- **Joining an alliance:** each alliance chooses Open (instant join) or Invite only (request, then leader approval). Figma shows the invite-only case.
- **Apple sign-in:** it is built in the app but works only once Apple is enabled in Clerk. Until then the button stays hidden.
- **Delivery:** ships as phased PRs, in the order of the groups below.

## Requirements

### R-A. Bugs (first)
- A1. The map's colour tip names the right colours: green for yours, blue for alliance, red for enemy.
- A2. The first-claim card's button does not show a Gold price when the claim is free.
- A3. A name that contains a symbol shows the Figma error live, with a red field border.
- A4. Win and lose screens use TAKEN / HELD / LOST (see R-C and R-D).
- A5. The Distance leaderboard loads instead of failing.

### R-B. Onboarding (A1–A13, A4b, A4c)
- B1. The splash screen has the lime bar and the "WALK · CLAIM · CONQUER" tagline.
- B2. The landing page:
  - shows a map backdrop with the Figma body line;
  - orders the buttons Apple, then Google, then Email, with Email as the blue primary;
  - shows the Figma terms line;
  - has a sign-in link in mono caps.
- B3. Email sign-up has a back arrow, a SIGN UP title, a subtitle, the Figma labels and placeholders, and an "8+ characters" helper.
- B4. The choose-name screen:
  - is top-aligned and labelled "COMMANDER NAME";
  - shows the "Names can't contain symbols." helper;
  - uses the Figma copy for "name taken" and "name has a symbol", each with a red border;
  - has a NEXT button.
- B5. The age screen:
  - has a back arrow;
  - shows a centred readout with YEARS;
  - runs from 1 to 100 with a default of 24;
  - uses the Figma subtitle;
  - still blocks players under 13.
- B6. The daily reward screen:
  - shows a DAILY REWARD eyebrow and a "DAY n" title, then the big amount and GOLD;
  - shows a 7-day strip with today highlighted;
  - shows the "Come back tomorrow" line;
  - has a full-width TAP TO COLLECT button;
  - uses amounts that rise by day (backend, R-G).
- B7. The city intro is a full-bleed map with a bottom panel, an eyebrow, the city as the title, and a CONTINUE button.
- B8. The welcome overlay has a two-line title, the Figma body, and a lime "tap to continue" chip.
- B9. The tutorial cards:
  - use the Final-page copy;
  - show a lime icon, progress dashes and an "01 / 05" counter on each card;
  - end with BACK and START PLAYING on the last card.

### R-C. Map, coach marks and challenges (B1–B9, C1–C10)
- C1. Three guided coach marks run once after the tutorial: the side panel, tapping a territory, and the territory card.
- C2. The side rail uses five separate square tiles. The key tile gets a lime border while the key is open.
- C3. The map key has a TERRITORY KEY header and the rows YOURS / ALLIANCE / ENEMY.
- C4. Search shows a magnifier icon, dims the map, and lists results with an ownership tag and the distance.
- C5. The territory card:
  - shows a tag row and a single mono meta row ("1,094 M · 30 MIN LIMIT");
  - its button reads "8 GOLD · CONTEST TERRITORY";
  - for enemy ground, adds the held-for line and an explainer;
  - for alliance ground, adds the owner title, an explainer and a VIEW ALLIANCE button.
- C6. A Relocate button jumps the map to one of the player's territories. It opens a sheet listing them, with an empty state when the player owns none.
- C7. The start-walk screen uses the Figma copy, a tag chip, rows with icons, and the countdown layout.
- C8. The challenge-in-progress screen:
  - has a coloured header with an icon and rule;
  - shows a big percentage and a progress bar;
  - shows TIME LEFT and STEPS tiles;
  - shows you-vs-opponent progress bars on attacks and defends.
- C9. Cancelling a challenge opens a confirm dialog. Confirming shows a "Cancelling…" screen.
- C10. "Securing the claim…" is a full-screen state.
- C11. Results show TAKEN, LOST or HELD in green or red, a stats row and a BACK TO MAP button. This includes Case 8 (the attack fails).

### R-D. Defend and missions (D1–D8, E1–E5)
- D1. Defend pop-ups:
  - use the Figma eyebrow, title and body;
  - show a TIME TO RESPOND countdown;
  - have a "5 GOLD · …" button and a LET IT GO / NOT NOW secondary;
  - start defending directly.
- D2. A connection-lost banner shows during any challenge while the device is offline.
- D3. When an ally starts defending your territory, a pop-up says so and shows when the defence ends.
- D4. "Defence already started" shows a disabled DEFENCE IN PROGRESS button.
- D5. Missions:
  - show a "MISSION TYPE FOR TODAY" label, toggles with subtitles, and the refresh line;
  - lock with a "LOCK MARCH FOR TODAY" button;
  - show a section label and Figma rows (formatted numbers, an IN PROGRESS chip);
  - mark locked and rewards-ready states;
  - include the alliance card and the no-alliance card.
- D6. The missions explainer uses the Figma body, MARCH and RANGE rows, the footer line, and a GOT IT button. One-page explainers end with GOT IT.

### R-E. Alliance (F1–F8)
- E1. The alliance explainer:
  - uses the Figma copy;
  - shows an "01 / 02" counter at the top right;
  - has a blue NEXT button and a GOT IT button on the last page.
- E2. The alliance list is titled ALLIANCES, with a city subheader, the unlock note, the Figma rows and a full-width CREATE ALLIANCE button.
- E3. The alliance detail:
  - shows the emblem with its tag;
  - shows a 2×2 grid with location, territories, type and members;
  - has a REQUEST TO JOIN or JOIN button, depending on the alliance's type;
  - shows member rows with a role and an avatar.
- E4. The member view:
  - shows a header with the description;
  - uses the Figma section labels;
  - has an OPEN CHAT button;
  - shows a red outlined LEAVE ALLIANCE button.
- E5. Alliance roles are Captain, Commander, Lieutenant and Troop.
- E6. Create alliance:
  - shows the "names are permanent" note;
  - uses the Figma labels, hints and placeholder;
  - shows inline field errors with red borders, using the Figma copy.
- E7. Leaving an alliance asks for confirmation in a modal. The modal uses the Figma copy, with STAY as the primary button.

### R-F. Profile, leaderboards, log, chat, events (G1–G11)
- F1. The profile:
  - has a pencil edit icon and a level chip;
  - shows the alliance as a chip;
  - shows TERRITORIES / GOLD / WALKED tiles;
  - shows the territory count.
- F2. The settings, resources, statistics and edit-profile sections use the Figma labels, tiles and copy.
- F3. Leaderboards:
  - switch between Territories and Distance with tabs;
  - show the city and season label;
  - use a numbered podium and rows;
  - pin a YOUR POSITION row.
- F4. History:
  - has a back arrow and a HISTORY title;
  - groups entries by day;
  - shows rows with an icon and the territory name;
  - uses the Final event types.
- F5. Chat:
  - has a back arrow, a CHAT title and an online subheader;
  - shows each sender's tag and role, or SOLO PLAYER;
  - colours your own name lime and allies' names blue;
  - uses a channel placeholder and a SEND button.
- F6. Events uses the Figma icon, headline and body.

### R-G. Backend support
- G1. The leaderboard returns the caller's own position and supports Distance.
- G2. Challenge progress exposes the opponent's percentage to both sides.
- G3. Alliance membership has the four Figma roles. Each alliance has a join type, and pending requests can be approved or declined.
- G4. Chat messages carry the sender's role.
- G5. Daily rewards follow a 7-day ladder that resets after day 7 or a missed day.
- G6. The active-attacks endpoint is deployed, so defend pop-ups work in production.
- G7. Apple sign-in is enabled through Clerk (setup by the owner).

## Scope boundaries

- Not designed yet, so not built: the separate Activity screen, the Statistics button page, Research.
- Legacy mode (`legacy_tabs` on) is unchanged.
- Sample data in Figma is not copied.

## Success criteria

- Each frame on the page has a matching screen or state in the `figma-preview` build, checked on the emulator.
- None of the bugs in R-A reproduce.
- Existing tests still pass; new pure logic (countdowns, reward ladder, grouping, role mapping) has tests.

## Outstanding questions

- What should existing alliances' roles map to? (FOUNDER → Captain is clear; the other ranks need confirming.)
- When the backend has no live opponent progress yet, should the bars show or hide?
