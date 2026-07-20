# Critique ignore list

Findings adjudicated as deliberate decisions — do not re-report:

- **Selected-territory glow** (MapScreen `selectedGlowStyle`: `lineBlur`, `#FFFFFF` line colour): sanctioned Map-Layer Exception in DESIGN.md — the selection affordance on the dark map. Owner decision 2026-07-19.
- **Night-only basemap** (`lightPreset: 'night'`): deliberate brand look at all hours; sunlight legibility is addressed via text/label contrast, not by lightening the map. Owner decision 2026-07-19.
- **Mapbox camera `animationDuration` values**: camera flight physics, exempt from the 120/280/2000 UI motion vocabulary (documented in DESIGN.md Map-Layer Exception).
- **Archivo 700 on large readouts** (spine hero distance, influence/day): sanctioned by Brand Guidelines v1.1 ("Archivo 700 — large readouts: contest screen, streak counter") and DESIGN.md's Title role. Not ceremony creep.
- **Conquest-first onboarding copy** ("Attack enemy ground…"): tone confirmed deliberate by the owner 2026-07-19.
- **MapSideRail glyphs beside labels**: documented decision in the component header; labelled custom glyphs, not icon-only navigation. Revisit only if the owner asks.
- **Sheet top border in the territory's ownership colour** (MapScreen TerritorySheet `borderTopColor`): semantic yours/ours/theirs signal carried from the map into the sheet — the Locked Meaning Rule working as intended, not a red accent. Exempt from the One Claim count.
- **Objective banner border + kicker both Claim Red**: border and kicker of one cohesive instrument (the first-claim objective banner), not two competing accents. Waived as a single element.
- **Claimed-territory silhouette in Claim Red** (ClaimSuccessScreen): semantic ownership rendering — the territory just became yours; identity, not accent. Exempt from the One Claim count (codified in DESIGN.md's One Claim Rule).
- **Caution Amber #D49A2B**: no longer a violation — formally adopted 2026-07-20 as `colors.caution` (DESIGN.md Colors + theme.js) for warning/paused/expiring states only.
