---
title: "feat: Updated UX review fixes (Figma page 09)"
type: feat
status: active
date: 2026-11-26
branch: feat/updated-ux-review-fixes
source: Figma x4d6znyf2aMOv1UBUMT7G8, page "09 · Prototype · Updated UX" (20:2), 11 review comments by the design reviewer
---

# feat: Updated UX review fixes

## Summary

Bring the app in line with the 11 review comments addressed on the Updated UX prototype. Five are already true in the app and only need verifying and pinning with tests. Six need changes: typed age input, first territory centred, redundant map tip removed, Processing state on Start, territory shown on the Start walk screen, and a lime first-claim tag. All visual changes apply in Figma mode (`legacy_tabs` off); legacy mode is untouched.

---

## Problem Frame

The reviewer tested the prototype flow (sign-up → FTUE → map → first territory → walk → Missions/Alliance) and flagged gaps. The prototype is fixed; the app must match it. The app's first claim is a real, free claim, so the Figma "DEMO CHALLENGE" wording is not adopted. The user chose to keep the real free claim and apply only the lime tag and emphasis to the existing "FIRST CLAIM · FREE" copy.

---

## Requirements

| # | Review comment | App status | Work |
|---|---|---|---|
| R1 | After sign-up go to FTUE | Done: `afterAuth` routes `needsUsername` to USERNAME | Pin with reducer test |
| R2 | Name screen opens without an error | Done: `UsernameScreen` starts with empty error, `status: 'idle'` | Verify only |
| R3 | Type your age as well as slide | Missing | U1 |
| R4 | First territory centred | Partial: Beat 1 flight frames home pin + objective bbox | U2 |
| R5 | "Tap a territory" hint redundant | The `walkthrough.map.card` first-tap tip repeats the objective coach line | U2 |
| R6 | Close on the territory pop-up | Done: `TerritoryCard` has a × that calls `onClose` | Verify only |
| R7 | Highlight the demo/first-claim message | Missing on `TerritoryCard` | U3 |
| R8 | Processing after Start | Partial: spinner only, no label | U3 |
| R9 | Selected territory on Start walk | Missing: arming phase has no map | U4 |
| R10 | Missions explainer on first visit | Done: `FeatureExplainer name=explainer:missionsType` | Verify only |
| R11 | Alliance explainer on first visit | Done: `FeatureExplainer name=explainer:allianceIntro` | Verify only |

---

## Key Technical Decisions

- **Keep the real free first claim.** The tag reads FIRST CLAIM · FREE (existing `firstClaim.kicker`), in lime, with the existing `firstClaim.sheetLine` in lime body text. No backend change. (User decision, 2026-11-26.)
- **Pure helpers for testable logic.** Typed-age parsing goes in `lib/onboardingFlow.js`; the centred-flight camera goes in a new `lib/mapFlight.js`. The jest suite is plain node, so screen code stays thin.
- **Figma-mode only.** Every visual change is gated on `!useFlag('legacy_tabs')`, following the existing `figmaChrome` pattern in `screens/MapScreen.js`.
- **Reuse `ChallengeMap` on the arm screen** with `progress` 0, rather than building a second map. It already draws the lime outline and the lime player dot.

---

## Implementation Units

### U1. Typed age input

**Goal:** An "Or type your age" field under the slider, kept in sync with it.
**Requirements:** R3
**Dependencies:** none
**Files:** `lib/onboardingFlow.js`, `screens/AgeScreen.js`, `locales/en.json`, `locales/ru.json`, `lib/__tests__/onboardingFlow.test.js`
**Approach:** Add a pure `parseTypedAge(text)`: digits only, and returns null for empty or non-numeric input. Values are clamped to the slider range (5–80). The field uses a numeric keyboard and Geist Mono. Typing a valid age moves the slider; moving the slider rewrites the field. While the field is empty or invalid, NEXT keeps the last valid age. Under 13 still routes to the blocked step through the existing `AGE_SUBMITTED` path.
**Test scenarios:**
- `parseTypedAge('25')` → 25; `'4'` → 5; `'120'` → 80.
- `''`, `'abc'`, `'-3'`, `'2.5'` → null (no partial parse of decimals).
- A typed age of 12 dispatched as `AGE_SUBMITTED` leads to the blocked step (existing reducer path, regression).
**Verification:** Typing and sliding stay in sync on device; under-13 is still blocked.

### U2. Centre the first territory and drop the redundant tip

**Goal:** The first-claim flight ends with the objective territory centred, and the "tap any territory" tip no longer fires in Figma mode.
**Requirements:** R4, R5
**Dependencies:** none
**Files:** `lib/mapFlight.js` (new), `screens/MapScreen.js`, `lib/__tests__/mapFlight.test.js` (new)
**Approach:** Move `flightBounds` into `lib/mapFlight.js` unchanged (used in legacy mode). Add `centredFlightCamera(target)`, which returns the objective's centre and zoom 15, falling back to null without a target. In Figma mode the Beat 1 flight uses the centred camera; legacy mode keeps the bbox. In Figma mode, drop the `card` entry from `mapTips`; the objective ring and sheet already say this.
**Test scenarios:**
- `centredFlightCamera` with a target returns its `[longitude, latitude]` as the centre.
- `centredFlightCamera(null)` and a non-finite lat/lng → null.
- `flightBounds` keeps its existing behaviour: home and target both inside the bounds.
**Verification:** On a fresh account in Figma mode, the flight settles with the objective in the middle of the map.

### U3. Territory card: first-claim tag and Processing state

**Goal:** On the first-claim objective, the card shows a lime FIRST CLAIM · FREE tag and the lime sheet line. Tapping the CTA shows "PROCESSING…" in a dimmed button until navigation.
**Requirements:** R7, R8 (R6 verified here)
**Dependencies:** none
**Files:** `components/TerritoryCard.js`, `screens/MapScreen.js`, `locales/en.json`, `locales/ru.json`, `lib/territoryCard.js`, `lib/__tests__/territoryCard.test.js`
**Approach:** New `firstClaim` prop, which MapScreen sets when `objectiveActive` and the selected id equals the objective id. The tag is Geist Mono on `colors.limeSoft` with lime text; the line is Instrument Sans 500 in lime. While `busy`, the CTA shows a spinner plus a "PROCESSING…" label at reduced opacity, and stays disabled. Add a pure `ctaBusyLabel` key to the `lib/territoryCard.js` model, so the label is test-covered.
**Test scenarios:**
- The model exposes the processing label key and `startClaiming` for unclaimed ground.
- An insufficient-gold card is still disabled, and the busy state never re-enables it.
- (Verify) the close × calls `onClose`; this is covered by inspection, since there is no RN render harness.
**Verification:** On the objective, the tag and line show in lime; tapping Start shows PROCESSING… until ActiveClaim opens; the × closes the card.

### U4. Territory map on the Start walk (arming) screen

**Goal:** The arming phase shows the selected territory outlined in lime with the player dot, above the rules and START WALK.
**Requirements:** R9
**Dependencies:** none
**Files:** `screens/ActiveClaimScreen.js`
**Approach:** In Figma mode, when `territoryGeojson` is present, render `ChallengeMap` (progress 0) in a fixed-height block, about 40% of the screen, between the header and `armBlock`. Without a geometry, skip the block and keep the screen as it is today. The map is display-only and needs no new state.
**Test expectation:** none, because this is layout only. The fill and frame logic is already covered by `challengeFill.test.js`.
**Verification:** On device, Start claim → arming screen shows the territory outline and the dot; START WALK and NOT YET still work.

### U5. Verify already-done items

**Goal:** Confirm R1, R2, R6, R10 and R11 in code, and pin R1 with a test.
**Requirements:** R1, R2, R6, R10, R11
**Dependencies:** none
**Files:** `lib/__tests__/onboardingFlow.test.js`
**Test scenarios:**
- `CODE_VERIFIED` and `GOOGLE_AUTH_SUCCESS` with `needsUsername: true` → step `username`; with false → `gate`.
**Verification:** The test passes; the remaining items are confirmed by reading the code (noted in the PR body).

---

## Scope Boundaries

- No demo (non-claiming) first challenge; that would be a backend and economy change.
- No changes to legacy mode (`legacy_tabs` on).
- No Figma prototype edits.

## Risks

- **The MapScreen flight is choreography-sensitive.** Only the final camera target changes, and only in Figma mode. Timings are unchanged.
- **A ChallengeMap on the arm screen adds a second Mapbox view during arming.** It unmounts when the walk starts and the map-mode screen mounts its own, so the two never coexist.
