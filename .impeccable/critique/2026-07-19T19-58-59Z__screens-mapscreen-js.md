---
target: MapScreen
total_score: 21
p0_count: 0
p1_count: 2
timestamp: 2026-07-19T19-58-59Z
slug: screens-mapscreen-js
---
Method: dual-agent (A: Explore design review · B: Explore deterministic scan)

# Critique: MapScreen.js (Dominia core play surface) — 21/40

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | Loading pill exists, but territory-fetch errors return silently; offline = blank dark map |
| 2 | Match System / Real World | 2 | "Influence", "Legacy R3", "Hall of Holders", tier gates — no inline meaning for non-gamers |
| 3 | User Control and Freedom | 3 | Every sheet step has Cancel/Back; Abandon behind a confirm |
| 4 | Consistency and Standards | 2 | Enemy-blue/orange contest CTA, double red, Archivo-as-data, off-spec motion fracture the system |
| 5 | Error Prevention | 3 | Confirm shows cost + balance-after; level/resource pre-checks — genuinely good |
| 6 | Recognition Rather Than Recall | 1 | Four fill colours, streak bands, dev badges, emblems, chips — taught once, no persistent legend |
| 7 | Flexibility and Efficiency | 1 | No quick-claim, no shortcuts, no batch; every claim is a 4–5 step flow |
| 8 | Aesthetic and Minimalist Design | 2 | Resource bar + SitrepCard + objective banner + top banner + pulse + rail can co-occur |
| 9 | Error Recovery | 2 | Sheet errors specific and actionable; map-level fetch failure has zero recovery UI |
| 10 | Help and Documentation | 3 | First-tap tips, walkthrough, first-claim spine — a real strength |
| **Total** | | **21/40** | **Acceptable — significant improvements needed** |

## Anti-Patterns Verdict

**LLM assessment:** not generic slop — bespoke, register-correct, with real engineering care (trailing-edge viewport fetches, spine persistence). But brand compliance has confident-to-spec breaks: a contest CTA coloured with Enemy blue / an off-palette orange (#EA580C, L3052 — the sixth colour the brand forbids), Develop + Abandon both Claim Red in the owned-territory sheet (L737/756/3035), Archivo used for measurements (L2639–2644, 2963–2967), pure white + lineBlur "glow" on the selected outline (L2281–2298), and a motion vocabulary scattered across 600/650/700/1100/1200/1600/2600/3200ms. MapSideRail renders icon glyphs beside navigation labels (MapSideRail.js L60–80) against the no-icons-in-navigation rule.

**Deterministic scan:** detector font warnings all false positives again. Native scan: chrome radius/shadows clean; **#EA580C confirmed as a chrome violation** (sixth colour); **Develop+Abandon double-red co-render confirmed**; pulse loop at 1100ms/quad easing off-token (L1086); `sheetClose` glyph and locate icon fall back to system font (L3028, 2816); **no hitSlop anywhere** — sheetClose 32dp, sheetToggle ~28dp, locateButton ~29dp, sheetAction ~43dp, sheetCancel ~41dp all under 48dp; neither file imports lib/theme (systemic). "Walk to claim/contest" copy flagged as possible travel-implication — adjudicated acceptable (it is the literal mechanic), but "Walk {{distance}} around it" phrasing is the safer template. #FFFFFF at L2298 is map-layer but still pure white.

**Visual overlays:** not applicable — native surface.

## Overall Impression

The bones are excellent — the first-claim spine, progressive disclosure, and cost-transparent confirms are the best-designed moments in the app. But the screen has drifted from its own constitution (colours, motion, ceremony), fails silently exactly where a Bengaluru beta tester on flaky data will hit it, and leans on recall for a symbol vocabulary it teaches only once. The single biggest opportunity: an error/offline/recovery layer and a legend, before any visual polish.

## What's Working

1. **Progressive disclosure in the info sheet** (L660–714): 10 data rows behind one text-only More/Less toggle.
2. **Error prevention at confirm** (L809–931): cost + balance-after + an insufficient-funds fork that routes to Activity to earn.
3. **Non-blocking map data** (L1509–1563): trailing-edge viewport fetch with pending-fetch replay — the map rarely blanks mid-gesture.

## Priority Issues

**[P1] Contest/Abandon CTAs break the colour constitution** (L793, 3052, 737/756/3035)
- The contest button uses Enemy blue / off-palette orange (a sixth colour); Develop + Abandon stack two Claim Reds; red-on-Abandon teaches "red = danger", eroding "red = yours".
- Fix: Contest and Abandon → Ink-2 secondary with hairline-strong border; one red maximum, reserved for the constructive primary.
- Suggested command: /impeccable polish

**[P1] Silent failure — no offline, error, or empty state on the map** (L1600–1604, 2416–2423)
- Fetch errors settle silently; offline is a blank dark map; SitrepCard fails to nothing. Beta testers on mobile data will read it as broken.
- Fix: error/offline banner with Retry; empty-region line; SitrepCard failure state.
- Suggested command: /impeccable harden

**[P2] Sub-48dp touch targets across the HUD and sheet** (L3019, 3005, 2802, 3033, 3134; no hitSlop in either file)
- Close ×, More/Less, locate, and even the primary sheet actions are 28–43dp.
- Fix: hitSlop/padding pass to ≥48dp everywhere.
- Suggested command: /impeccable adapt

**[P2] Motion abandons the three-duration vocabulary** (L85–86, 1086, 1301–1304, 2326, 2357, 1429, 3200 at L1433)
- Nearly every animation is off-token; the pulse runs 1100ms/quad.
- Fix: snap UI timings to 120/280/2000 on the brand curve; document camera flight durations as the one sanctioned exception.
- Suggested command: /impeccable animate

**[P2] Recall-heavy symbol vocabulary + jargon with no inline meaning** (L652–690, walkthrough-only teaching)
- Colour meanings, streak bands, dev badges, tier gates and "Influence/Legacy/Hall of Holders" must be remembered from one walkthrough.
- Fix: persistent lightweight legend affordance + one-line inline glosses in the sheet.
- Suggested command: /impeccable clarify

## Persona Red Flags

**Alex (power user):** every claim is a 4–5 step flow; no quick-claim, no re-claim from the "FELL" chip; locate button and rail collide with the sheet zone.
**Casey (one-handed):** sheet close is a 32dp × at the top-right — the worst reach; top banners at StatusBar+48 are undismissable by thumb; long titles shrink to 70% mid-glance.
**Priya (Bengaluru, sunlight, mid-range Android):** Slate-2 at 9–11px unreadable in sun; resource glyphs 12px and unlabelled; night-only basemap (lightPreset 'night', L2434) is the maximum-contrast-loss choice for daytime outdoor play; the "three territories nearby" promise visibly shrinks to one pulse on arrival.

## Minor Observations

- Production console.logs in the fetch path (L1511, 1538, 1581, 1595, 1601, 1697).
- AMSTERDAM_CENTER (L78, 2436) still the camera mount point — can flash Amsterdam before the home-pin fly; same class of issue just fixed in onboarding.
- Influence is headline data in the sheet but absent from the resource bar.
- ⌖ and × are ad-hoc unicode glyphs on system font in a system that otherwise draws its own.
- Whole-polygon enemy-blue flood on capture-lost reads punitive; "precision, not praise" might argue for quieter loss.

## Questions to Consider

1. Onboarding promises three territories; the map spotlights one. Does the funnel undercut "your city is the game board" at its peak moment?
2. Should Claim Red ever touch Abandon? Each time, red = danger gains and red = yours loses.
3. Is a night-only basemap defensible for a product whose primary act is walking in Bengaluru sunlight?
