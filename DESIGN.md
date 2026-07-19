---
name: Dominia
description: A city-scale strategy game played on foot — walk, claim, conquer, defend.
colors:
  ink: "#0E1014"
  ink-2: "#1A1D24"
  ink-3: "#252932"
  bone: "#F2EEE6"
  bone-2: "#E8E3D8"
  slate: "#5C6068"
  slate-2: "#8B8F98"
  claim-red: "#D64525"
  alliance-green: "#3F8F4E"
  enemy-slate-blue: "#4A6B8A"
  claim-soft: "#D6452524"
  alliance-soft: "#3F8F4E24"
  enemy-soft: "#4A6B8A24"
  hairline: "#F2EEE614"
  hairline-strong: "#F2EEE629"
typography:
  display:
    fontFamily: "Archivo"
    fontSize: "48px"
    fontWeight: 900
    letterSpacing: "-0.03em"
  headline:
    fontFamily: "Archivo"
    fontSize: "32px"
    fontWeight: 800
    letterSpacing: "-0.03em"
  title:
    fontFamily: "Archivo"
    fontSize: "26px"
    fontWeight: 700
  body:
    fontFamily: "Inter"
    fontSize: "13px"
    fontWeight: 400
  body-emphasis:
    fontFamily: "Inter"
    fontSize: "13px"
    fontWeight: 500
  label:
    fontFamily: "Geist Mono"
    fontSize: "10px"
    fontWeight: 400
    letterSpacing: "0.16em"
  data:
    fontFamily: "Geist Mono"
    fontSize: "13px"
    fontWeight: 400
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
    backgroundColor: "{colors.claim-red}"
    textColor: "{colors.bone}"
    typography: "{typography.data}"
    rounded: "{rounded.none}"
    padding: "12px 24px"
  button-secondary:
    backgroundColor: "{colors.ink-2}"
    textColor: "{colors.bone}"
    typography: "{typography.data}"
    rounded: "{rounded.none}"
    padding: "12px 24px"
  card:
    backgroundColor: "{colors.ink-2}"
    textColor: "{colors.bone}"
    rounded: "{rounded.none}"
    padding: "16px"
  input:
    backgroundColor: "{colors.ink-2}"
    textColor: "{colors.bone}"
    typography: "{typography.data}"
    rounded: "{rounded.none}"
    padding: "12px"
  section-label:
    textColor: "{colors.slate-2}"
    typography: "{typography.label}"
  resource-pill:
    backgroundColor: "{colors.ink-2}"
    textColor: "{colors.bone}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "4px 8px"
---

# Design System: Dominia

## 1. Overview

**Creative North Star: "The Commander's Field Desk"**

A campaign map under a single lamp: dark surface, precise instruments, every mark earned. The entire interface is chrome around a sacred map — three steps of ink for depth, bone for text, and three territory colours whose meanings are locked. Nothing decorates; every element is an instrument with a job, labelled in mono, set square. Ceremony is rationed: Archivo display type appears only at moments a Commander should remember (milestones, medals, Legacy Titles), which is precisely what makes those moments land.

The system explicitly rejects what PRODUCT.md rejects: no fitness-tracker cheerfulness, no casual-game gloss (CG renders, loot boxes, neon), no wellness softness (pastels, rounded corners, encouraging-friend voice), and no military hardware imagery. It also rejects the default Material 3 vocabulary — Dominia themes Android's OS guarantees (Back gesture, insets, 48dp targets) through its own instruments, not through Material components.

**Key Characteristics:**
- Dark, flat, and square: 0px radius, no shadows, no gradients, no blur, anywhere.
- Three typefaces, three jobs: Geist Mono for chrome and data, Inter for sentences, Archivo for ceremony.
- Five colours only, meanings locked; Claim Red on at most one element per screen outside the map.
- Depth by tonal ink steps and 0.5px hairlines, never by elevation effects.
- Motion limited to three durations (120 / 280 / 2000ms) on one curve; type is never animated.

## 2. Colors

A dark low-chroma field where the three territory colours are the only voices — their rarity is their authority.

### Primary
- **Claim Red** (#D64525): yours. Your territories on the map, active contests, and the single primary CTA. The most disciplined colour in the system: at most ONE element per screen outside the map. Soft fill `#D6452524` for territory fills.

### Secondary
- **Alliance Green** (#3F8F4E): ours. Alliance-held territories, shields, defensive states. Soft fill `#3F8F4E24`.
- **Enemy Slate-Blue** (#4A6B8A): theirs. Other players' territories only — never used for buttons or UI states. Soft fill `#4A6B8A24`.

### Neutral
- **Ink** (#0E1014): primary background. Never pure black.
- **Ink 2** (#1A1D24): cards, sheets, elevated surfaces.
- **Ink 3** (#252932): further elevated surfaces (nested panels, pressed states).
- **Bone** (#F2EEE6): primary text. Never pure white.
- **Bone 2** (#E8E3D8): secondary foreground.
- **Slate** (#5C6068): inactive states, disabled labels.
- **Slate 2** (#8B8F98): metadata, captions, section labels.
- **Hairline** (#F2EEE6 at 8%) / **Hairline Strong** (at 16%): the only borders — 0.5px and 1px.

### Named Rules
**The One Claim Rule.** Claim Red appears on at most one element per screen outside the map. A second red element is a bug, not an emphasis.

**The Locked Meaning Rule.** The three territory colours mean yours / ours / theirs and nothing else. They are never repurposed for generic success, error, or info states. There is no sixth colour.

## 3. Typography

**Display Font:** Archivo (900 / 800 / 700)
**Body Font:** Inter (400 / 500)
**Label/Mono Font:** Geist Mono (400 / 500 / 300)

**Character:** Instrumental and exact. Mono carries the chrome, Inter carries the sentences, Archivo carries the ceremony — and the three never trade jobs. When in doubt, Geist Mono.

### Hierarchy
- **Display** (Archivo 900, 48px, uppercase): hero numerals and wordmark moments — milestone takeovers, Legacy Titles. Always uppercase above 20pt.
- **Headline** (Archivo 800, 32px, uppercase): large readouts, alliance names, commander names.
- **Title** (Archivo 700, 26px): contest screens, streak counter. Italic 700 for milestone subtitles only — italic exists nowhere else.
- **Body** (Inter 400, 13px; emphasis Inter 500): anything a player actually reads — descriptions, chat, prose. Sentence case only; Inter is never uppercased. Emphasis by weight, never by caps or italic.
- **Data** (Geist Mono 400, 11–16px): measurements, timers, counts. Real-world case preserved: "km", "×2.50", "9:41".
- **Label** (Geist Mono 400, 8–10px, uppercase, 0.12–0.18em tracking): section labels and UI chrome. Slate 2 by default.

### Named Rules
**The Controlling Rule.** Measurement, state, label, or readout → Geist Mono. A sentence someone would actually read → Inter. A ceremonial moment the player should recall → Archivo. When in doubt → Geist Mono.

**The Still Type Rule.** Type is never animated. Numbers may count up; glyphs never slide, fade, or bounce.

## 4. Elevation

Flat by doctrine. There are no shadows, glows, blurs, or gradients anywhere in the product — depth is conveyed exclusively by the three-step ink ramp (Ink → Ink 2 → Ink 3) and by hairline borders (0.5px at 8% bone, 1px at 16% for emphasis). A sheet sitting over the map is Ink 2 with a hairline-strong top edge, nothing more.

### Named Rules
**The Flat Doctrine.** If a surface needs to read as "above", it gets the next ink step and a hairline — never a shadow. This rule has no exceptions and survives all future features.

## 5. Components

Instrumental and exact: every control feels like an instrument on a console — square, labelled in mono, zero decoration. No Material or Cupertino components; the brand's own vocabulary is the component library.

### Buttons
- **Shape:** hard square (0px radius), full-width in sheets, 48dp minimum touch height.
- **Primary:** Claim Red background, Bone Geist Mono uppercase label — this is usually the screen's single permitted red element.
- **Pressed:** state change in 120ms on cubic-bezier(0.2, 0, 0, 1); no scale bounce, no ripple tinting beyond an ink step.
- **Secondary:** Ink 2 with hairline-strong border, Bone mono label. Disabled: Slate label, hairline border.

### Cards / Containers
- **Corner Style:** 0px, always.
- **Background:** Ink 2; nested panels step to Ink 3 (true nesting is avoided — restructure before stacking cards).
- **Border:** 0.5px hairline; 1px hairline-strong when the card must separate from a busy background.
- **Internal Padding:** 16px standard, 12px dense.

### Inputs / Fields
- **Style:** Ink 2 fill, hairline border, 0px radius, Geist Mono text.
- **Focus:** border shifts to hairline-strong — no glow, no colour change.
- **Error:** message set in Inter below the field; the border never turns red (that would spend the screen's Claim Red).

### Navigation
- Bottom tab bar on Ink with hairline top edge; text-only Geist Mono uppercase labels — **no icons in navigation**, per brand. Active tab: Bone at mono 500; inactive: Slate. System Back gesture always honoured.

### Resource Pills (signature)
- The single rounded exception: 4px radius pills in the map bar showing resource counts in mono. Ink 2 fill, hairline border.

### Ceremonial Takeovers (signature)
- Full-screen Ink moments (milestones, medal earns, streak milestones): Archivo 800–900 uppercase display, a count-up numeral, one hairline rule. The 2000ms ambient duration lives here and in map pulses only.

## 6. Do's and Don'ts

### Do:
- **Do** keep Claim Red to one element per screen outside the map — its rarity is its authority.
- **Do** set every label, measurement, and readout in Geist Mono; every readable sentence in Inter; ceremony only in Archivo.
- **Do** convey depth with ink steps and hairlines only (0.5px at 8%, 1px at 16%).
- **Do** use only the three motion durations — 120ms / 280ms / 2000ms — on cubic-bezier(0.2, 0, 0, 1).
- **Do** honour Android OS guarantees inside the brand skin: system Back, edge-to-edge insets, 48dp touch targets, sp-scaled text.
- **Do** write British English, sentence-case Inter, no exclamation marks, no emoji.

### Don't:
- **Don't** use gradients, glows, drop shadows, or blur — anywhere, ever.
- **Don't** use pure white (#FFFFFF) or pure black (#000000).
- **Don't** round corners except the app icon and 4px map resource pills.
- **Don't** introduce a sixth colour, or repurpose Claim / Alliance / Enemy for generic UI states.
- **Don't** put icons in navigation, or animate type.
- **Don't** design like a fitness tracker, a casual gamified-exercise app, a glossy conventional mobile game, or a cute wellness brand — and never reach for weapons or armed-forces imagery.
- **Don't** let copy imply travelling to a territory; the walk counts from anywhere.
