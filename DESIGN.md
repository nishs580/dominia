---
name: Dominia
description: A city-scale strategy game played on foot — walk, claim, conquer, defend.
colors:
  obsidian: "#101010"
  surface: "#1A1A1A"
  raised: "#242424"
  white: "#F5F4EF"
  white-2: "#E4E3DE"
  muted: "#6C6C69"
  muted-2: "#A3A29F"
  electric-blue: "#3155FF"
  signal-lime: "#C8FF3D"
  smash-green: "#22D65E"
  vermillion: "#E8432B"
  caution-amber: "#D49A2B"
  self-soft: "#22D65E24"
  alliance-soft: "#3155FF24"
  enemy-soft: "#E8432B24"
  lime-soft: "#C8FF3D24"
  hairline: "#F5F4EF14"
  hairline-strong: "#F5F4EF2E"
typography:
  display:
    fontFamily: "Sofia Sans Extra Condensed"
    fontSize: "56px"
    fontWeight: 800
    textTransform: "uppercase"
  title:
    fontFamily: "Sofia Sans Extra Condensed"
    fontSize: "32px"
    fontWeight: 800
    textTransform: "uppercase"
  section:
    fontFamily: "Sofia Sans Extra Condensed"
    fontSize: "22px"
    fontWeight: 700
    textTransform: "uppercase"
  body:
    fontFamily: "Instrument Sans"
    fontSize: "15px"
    fontWeight: 400
  body-emphasis:
    fontFamily: "Instrument Sans"
    fontSize: "15px"
    fontWeight: 500
  label:
    fontFamily: "Geist Mono"
    fontSize: "11px"
    fontWeight: 500
    letterSpacing: "0.12em"
  data:
    fontFamily: "Geist Mono"
    fontSize: "13px"
    fontWeight: 400
  numeral-xl:
    fontFamily: "Geist Mono"
    fontSize: "56px"
    fontWeight: 300
rounded:
  none: "0px"
  pill: "4px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  xl2: "32px"
  xl3: "48px"
  xl4: "64px"
components:
  button-primary:
    backgroundColor: "{colors.electric-blue}"
    textColor: "{colors.white}"
    typography: "{typography.data}"
    rounded: "{rounded.none}"
    padding: "12px 24px"
  button-accent:
    backgroundColor: "{colors.signal-lime}"
    textColor: "{colors.obsidian}"
    typography: "{typography.data}"
    rounded: "{rounded.none}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.white}"
    typography: "{typography.data}"
    rounded: "{rounded.none}"
    padding: "12px 24px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.white}"
    rounded: "{rounded.none}"
    padding: "16px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.white}"
    typography: "{typography.data}"
    rounded: "{rounded.none}"
    padding: "12px"
  section-label:
    textColor: "{colors.muted-2}"
    typography: "{typography.label}"
---

# Design System: Dominia

## 1. Overview

**Creative North Star: "The Commander's Field Desk"**

A campaign map under a single lamp: dark surface, precise instruments, every mark earned. The entire interface is chrome around a sacred map — three obsidian steps for depth, warm white for text, and three territory colours whose meanings are locked. Nothing decorates; every element is an instrument with a job, labelled in mono, set square. Titles and place names stand tall in condensed capitals; Signal Lime marks the one thing on screen that is live right now.

The visual system was refined in November 2026; the reference wireframes and component library live in the Figma file "Dominia refined wireframes" (`x4d6znyf2aMOv1UBUMT7G8`). Figma decides content and flow; this document and `lib/theme.js` decide the look.

The system explicitly rejects what PRODUCT.md rejects: no fitness-tracker cheerfulness, no casual-game gloss (CG renders, loot boxes, neon), no wellness softness (pastels, rounded corners, encouraging-friend voice), and no military hardware imagery. It also rejects the default Material 3 vocabulary — Dominia themes Android's OS guarantees (Back gesture, insets, 48dp targets) through its own instruments, not through Material components.

**Key Characteristics:**
- Dark, flat, and square: 0px radius, no shadows, no gradients, no blur, anywhere.
- Three typefaces, three jobs: Geist Mono for chrome and data, Instrument Sans for sentences, Sofia Sans Extra Condensed (always uppercase) for titles and names.
- Electric Blue for buttons, Signal Lime for accents, Obsidian background, warm White text; map colours locked to self / alliance / enemy.
- Depth by tonal ink steps and 0.5px hairlines, never by elevation effects.
- Motion limited to three durations (120 / 280 / 2000ms) on one curve; type is never animated.

## 2. Colors

A dark low-chroma field: Obsidian ground, warm White text, one blue for action, one lime for accent, and three territory colours whose meanings are locked.

### Brand
- **Electric Blue** (#3155FF): buttons. The primary action on a screen is an Electric Blue fill with a White Geist Mono label (~5.3:1). Also the alliance colour on the map.
- **Signal Lime** (#C8FF3D): accents. The active tab indicator and icon, the selected-territory outline, the player dot, progress fills, rewards ready to claim, the recenter control, the active segment of a small switch. Text on lime is Obsidian. At most one lime-filled button per screen. Soft fill `#C8FF3D24` for highlighted rows (your leaderboard position).
- **Obsidian** (#101010): background. Never pure black.
- **White** (#F5F4EF): all primary text. Warm off-white, never #FFFFFF.

### Map (territory triad)
- **Smash Green** (#22D65E): yours — territories you own, your result moments (TAKEN, HELD). Soft fill `#22D65E24`.
- **Electric Blue** (#3155FF): ours — your alliance's territories, defending states. Soft fill `#3155FF24`.
- **Vermillion** (#E8432B): theirs — other players' territories. Also the danger colour: errors, destructive actions (cancel attack/defence, leave, delete), LOST, your ground under attack. Soft fill `#E8432B24`.
- **Caution Amber** (#D49A2B): warning, paused and expiring states only; never on CTAs, never on the map, at most one per screen.

### Neutral
- **Surface** (#1A1A1A): cards, sheets, tab bar.
- **Raised** (#242424): tracks, active segments, nested panels, pressed states.
- **White 2** (#E4E3DE): secondary foreground.
- **Muted** (#6C6C69, White at 40%): placeholders, inactive tabs, disabled labels.
- **Muted 2** (#A3A29F, White at 64%): descriptions, metadata, section labels.
- **Hairline** (White at 8%) / **Hairline Strong** (at 18%): the only borders — 0.5px and 1px.

In code (`lib/theme.js`): `obsidian`, `surface`, `raised`, `white`, `muted`, `muted2`, `action`, `lime`, `onLime`, `self`, `alliance`, `enemy`, `danger`. The pre-refinement names (`ink*`, `bone*`, `slate*`, `claim`, `claimButton`) remain as aliases with the new values; prefer the new names in new code.

### Named Rules
**The Lime Rule.** Signal Lime means "live / selected / ready" and nothing else. One lime-filled button per screen; lime never stands in for a territory colour.

**The Locked Meaning Rule.** Smash Green / Electric Blue / Vermillion mean yours / ours / theirs on the map. Off the map, Electric Blue is also the button colour and Vermillion also means danger; Smash Green is never used for generic success.

## 3. Typography

**Display Font:** Sofia Sans Extra Condensed (800 / 700 / 600), always uppercase
**Body Font:** Instrument Sans (400 / 500)
**Label/Mono Font:** Geist Mono (300 / 400 / 500)

**Character:** Instrumental and exact. Mono carries the chrome and the numbers, Instrument Sans carries the sentences, Sofia Sans Extra Condensed carries the names — and the three never trade jobs. When in doubt, Geist Mono.

### Hierarchy
- **Display** (Sofia 800, 48–80px, uppercase): moment words (TAKEN, LOST, HELD), the wordmark, hero place names.
- **Title** (Sofia 800, 32–36px, uppercase): screen titles.
- **Section** (Sofia 700, 22–24px, uppercase): section titles, alliance names, large map labels.
- **Card** (Sofia 600–700, 18–20px, uppercase): card titles, place names in lists.
- **Body** (Instrument Sans 400, 13–15px; emphasis 500): descriptions, chat, instructions, notifications. Sentence case only; emphasis by weight.
- **Numerals** (Geist Mono 300 for very large numbers only, 32px and up; 400 below): stats, timers, balances, countdowns.
- **Data** (Geist Mono 400, 11–16px): measurements, units, counts. Real-world case preserved: "km", "9:41".
- **Label** (Geist Mono 400–500, 10–11px, uppercase, tracked): section kickers, tags, tab labels, buttons.

### Named Rules
**The Controlling Rule.** A number, unit, label, tag, timer, tab or button → Geist Mono. A sentence someone reads → Instrument Sans. A title or a name of a place or alliance → Sofia Sans Extra Condensed, uppercase. When in doubt → Geist Mono.

**The Floor Rule.** Nothing renders below 11px except Figma-specified 10px tags and tab labels. Where a figure will not fit, change the format (e.g. `15.2k`), never the size.

**The Still Type Rule.** Type is never animated. Numbers may count up; glyphs never slide, fade, or bounce.

## 4. Elevation

Flat by doctrine. There are no shadows, glows, blurs, or gradients anywhere in the product — depth is conveyed exclusively by the three-step obsidian ramp (Obsidian → Surface → Raised) and by hairline borders (0.5px at 8% white, 1px at 18% for emphasis). A sheet sitting over the map is Surface with a hairline-strong top edge, nothing more.

### Named Rules
**The Flat Doctrine.** If a surface needs to read as "above", it gets the next obsidian step and a hairline — never a shadow. This rule has no exceptions in UI chrome and survives all future features.

**The Map-Layer Exception.** Mapbox data-layer styling (fills, line layers, camera moves) is game-board rendering, not UI chrome. Two named exceptions are sanctioned there and only there: the selected-territory outline (Signal Lime line with a soft lime `lineBlur` glow — the selection affordance on a dark map), and Mapbox camera flight durations (tuned per move; the three-duration vocabulary governs UI motion, not camera physics). The basemap is night-preset at all hours by decision — daytime sunlight legibility is solved through text and label contrast, never by lightening the map.

## 5. Components

Instrumental and exact: every control feels like an instrument on a console — square, labelled in mono, zero decoration. No Material or Cupertino components; the brand's own vocabulary is the component library.

### Buttons
- **Shape:** hard square (0px radius), full-width in sheets, 48dp minimum touch height.
- **Primary:** Electric Blue (#3155FF) background, White Geist Mono uppercase label (~5.3:1).
- **Accent:** Signal Lime fill, Obsidian label — rewards and claim moments only, one per screen.
- **Danger:** transparent with a Vermillion border and label — cancel attack/defence, leave, delete.
- **Pressed:** state change in 120ms on cubic-bezier(0.2, 0, 0, 1); no scale bounce, no ripple tinting beyond an obsidian step.
- **Secondary:** Surface with hairline-strong border, White mono label. Disabled: Muted label, hairline border.

### Cards / Containers
- **Corner Style:** 0px, always.
- **Background:** Surface; nested panels step to Raised (true nesting is avoided — restructure before stacking cards).
- **Border:** 0.5px hairline; 1px hairline-strong when the card must separate from a busy background.
- **Internal Padding:** 16px standard, 12px dense.

### Inputs / Fields
- **Style:** Surface fill, hairline-strong border, 0px radius, Geist Mono text.
- **Focus:** border turns Signal Lime — no glow.
- **Error:** Vermillion border and an Instrument Sans message below the field.

### Navigation
- Bottom tab bar on Surface with a hairline top edge; icon over a Geist Mono uppercase label. Active tab: 2px Signal Lime top indicator, lime icon, White label at mono 500; inactive: Muted. System Back gesture always honoured.

### Resource Pills (signature)
- The single rounded exception: 4px radius pills in the map bar showing resource counts in mono. Surface fill, hairline border.

### Ceremonial Takeovers (signature)
- Full-screen Obsidian moments (milestones, medal earns, TAKEN / LOST / HELD): Sofia Sans Extra Condensed 800 uppercase moment word, a Geist Mono count-up numeral, one hairline rule. The 2000ms ambient duration lives here and in map pulses only.

## 6. Do's and Don'ts

### Do:
- **Do** keep Signal Lime to accents, with at most one lime-filled button per screen.
- **Do** set every label, number and readout in Geist Mono; every readable sentence in Instrument Sans; titles and names in uppercase Sofia Sans Extra Condensed.
- **Do** convey depth with obsidian steps and hairlines only (0.5px at 8%, 1px at 18%).
- **Do** use only the three motion durations — 120ms / 280ms / 2000ms — on cubic-bezier(0.2, 0, 0, 1).
- **Do** honour Android OS guarantees inside the brand skin: system Back, edge-to-edge insets, 48dp touch targets, sp-scaled text.
- **Do** write British English, sentence-case Instrument Sans, no exclamation marks, no emoji.

### Don't:
- **Don't** use gradients, glows, drop shadows, or blur — anywhere, ever.
- **Don't** use pure white (#FFFFFF) or pure black (#000000).
- **Don't** round corners except the app icon and 4px map resource pills.
- **Don't** add colours beyond this palette, or use Smash Green for generic success.
- **Don't** animate type.
- **Don't** design like a fitness tracker, a casual gamified-exercise app, a glossy conventional mobile game, or a cute wellness brand — and never reach for weapons or armed-forces imagery.
- **Don't** let copy imply travelling to a territory; the walk counts from anywhere.
