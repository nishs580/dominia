// lib/theme.js
// Dominia design tokens — single source of truth for all UI

// ─── COLOURS ───────────────────────────────────────────────────────────────

export const colors = {
  // Base surfaces
  ink:    '#0E1014',   // primary background
  ink2:   '#1A1D24',   // card / elevated surface
  ink3:   '#252932',   // further elevated surface
  bone:   '#F2EEE6',   // primary text on dark
  bone2:  '#E8E3D8',   // secondary foreground, dividers on light
  slate:  '#5C6068',   // secondary labels, inactive states
  slate2: '#8B8F98',   // subdued metadata and captions

  // Territory / signal colours
  claim:   '#D64525',  // your territories, active contests, primary CTA
  alliance: '#3F8F4E', // alliance-held territories, shields, defensive states
  enemy:   '#4A6B8A',  // other players' territories — never use for buttons
  // unclaimed = no fill, slate hairline only

  // Soft fills (territory colours at low opacity)
  claimSoft:    'rgba(214,69,37,0.14)',
  allianceSoft: 'rgba(63,143,78,0.14)',
  enemySoft:    'rgba(74,107,138,0.14)',

  // Hairlines
  hairline:      'rgba(242,238,230,0.08)',
  hairlineStrong: 'rgba(242,238,230,0.16)',
};

// ─── TYPOGRAPHY ────────────────────────────────────────────────────────────

export const fonts = {
  // Archivo — display / ceremonial
  display:       'Archivo_900Black',       // wordmark, hero headlines, Legacy Titles
  displayBold:   'Archivo_800ExtraBold',   // milestone takeovers, alliance names
  displayMedium: 'Archivo_700Bold',        // large readouts — contest screen, streak counter
  // Note: Archivo_700BoldItalic for milestone subtitle only

  // Geist Mono — all UI chrome, data, labels
  mono:          'GeistMono_400Regular',   // default — all labels, measurements, chrome
  monoMedium:    'GeistMono_500Medium',    // emphasis within mono, active states
  monoLight:     'GeistMono_300Light',     // reserved for very large numeric display only

  // Inter — readable sentences and prose
  body:          'Inter_400Regular',       // body copy, challenge descriptions, chat
  bodyMedium:    'Inter_500Medium',        // territory names, challenge titles, emphasis
};

// Font size scale
export const fontSize = {
  xs:   8,   // section labels, resource pill text, streak label
  sm:   9,   // small labels, pill glyphs
  md:   11,  // metadata, war chest rows, body small
  base: 13,  // commander name in HUD, standard body
  lg:   16,  // primary CTA text, standard readable size
  xl:   20,  // territory name in inspect sheet, war chest values
  xl2:  22,  // territory name large
  xl3:  26,  // streak counter
  xl4:  32,  // large readouts
  hero: 48,  // milestone takeover numbers
};

// Letter spacing
export const letterSpacing = {
  tight:  -0.03,  // Archivo large readouts
  normal:  0,
  wide:    0.12,  // Geist Mono section labels (minimum)
  wider:   0.16,  // Geist Mono section labels (standard)
  widest:  0.18,  // Geist Mono deterrent labels
};

// ─── SPACING ───────────────────────────────────────────────────────────────

export const spacing = {
  xs:  4,
  sm:  8,
  md:  12,
  lg:  16,
  xl:  24,
  xl2: 32,
  xl3: 48,
  xl4: 64,
};

// ─── BORDER RADIUS ─────────────────────────────────────────────────────────

export const radius = {
  none: 0,   // default — all buttons, cards, modals, inputs, badges, tooltips
  pill: 4,   // resource pills in map bar only
  // device frames in mockups = 24 (not used in product)
};

// ─── BORDERS ───────────────────────────────────────────────────────────────

export const borders = {
  hairline: {
    width: 0.5,
    color: 'rgba(242,238,230,0.08)',
  },
  hairlineStrong: {
    width: 1,
    color: 'rgba(242,238,230,0.16)',
  },
};

// ─── MOTION ────────────────────────────────────────────────────────────────

export const duration = {
  micro:   120,   // button state changes, tap feedback
  normal:  280,   // sheet open, screen change
  ambient: 2000,  // contested territory pulse, countdown signal
};

// ─── COMPONENT SHORTCUTS ───────────────────────────────────────────────────
// Pre-composed style fragments used repeatedly across screens.
// Import and spread into StyleSheet definitions.

export const text = {
  // Section label — Geist Mono, uppercase, slate2, with standard letter spacing
  sectionLabel: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 10,
    color: '#8B8F98',
    textTransform: 'uppercase',
    letterSpacing: 0.16,
  },

  // Mono default — Geist Mono 400, bone
  mono: {
    fontFamily: 'GeistMono_400Regular',
    color: '#F2EEE6',
  },

  // Mono medium — Geist Mono 500, bone
  monoMedium: {
    fontFamily: 'GeistMono_500Medium',
    color: '#F2EEE6',
  },

  // Body — Inter 400, bone
  body: {
    fontFamily: 'Inter_400Regular',
    color: '#F2EEE6',
  },

  // Body medium — Inter 500, bone
  bodyMedium: {
    fontFamily: 'Inter_500Medium',
    color: '#F2EEE6',
  },

  // Display — Archivo 900, bone, uppercase
  display: {
    fontFamily: 'Archivo_900Black',
    color: '#F2EEE6',
    textTransform: 'uppercase',
  },

  // Milestone — Archivo 800, bone, uppercase
  milestone: {
    fontFamily: 'Archivo_800ExtraBold',
    color: '#F2EEE6',
    textTransform: 'uppercase',
  },
};

// ─── DEFAULT EXPORT ────────────────────────────────────────────────────────

export default {
  colors,
  fonts,
  fontSize,
  letterSpacing,
  spacing,
  radius,
  borders,
  duration,
  text,
};
