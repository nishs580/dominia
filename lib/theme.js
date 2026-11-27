// lib/theme.js
// Dominia design tokens — single source of truth for all UI

// ─── COLOURS ───────────────────────────────────────────────────────────────

export const colors = {
  // ── Brand palette (2026-11-28 Dominia-Temp; Figma "Page 2", node 43:327) ──
  obsidian: '#000000',  // app background (pure black)
  surface:  '#0E0E10',  // cards, sheets, tab bar
  raised:   '#1A1A1D',  // tracks, active segments, further elevation
  surfaceLine: '#2A2A2A', // card and field borders
  white:    '#FDFDFD',  // all primary text
  white2:   'rgba(253,253,253,0.85)', // secondary foreground
  muted:    'rgba(253,253,253,0.30)', // placeholders, inactive
  muted2:   'rgba(253,253,253,0.62)', // labels, descriptions, metadata

  // Actions and accents
  action:        '#0731D1', // Dominia blue: primary buttons, selection
  actionPressed: '#041E82',
  actionDeep:    '#03145A', // dark stop of the blue gradients
  lime:          '#84FF44', // Links and accents (active tab, progress,
                            // rewards, recenter, player dot). At most one
                            // lime-filled button per screen.
  limeSoft:      'rgba(132,255,68,0.14)',
  onLime:        '#000000', // text/icons on a lime fill

  // Map territory triad — meanings locked
  self:     '#84FF44', // green: territories you own
  alliance: '#5B7BF5', // blue: your alliance's territories
  enemy:    '#E34234', // red: other players' territories; also danger actions
  selfSoft:     'rgba(132,255,68,0.14)',
  allianceSoft: 'rgba(91,123,245,0.14)',
  enemySoft:    'rgba(227,66,52,0.14)',
  danger:   '#E34234',

  // Caution — warning/paused/expiring states only, at most one per screen.
  caution: '#D49A2B',

  // Hairlines
  hairline:       'rgba(253,253,253,0.08)',
  hairlineStrong: 'rgba(253,253,253,0.18)',

  // ── Legacy aliases (pre-refinement names; prefer the names above) ──
  ink:    '#000000',
  ink2:   '#0E0E10',
  ink3:   '#1A1A1D',
  bone:   '#FDFDFD',
  bone2:  'rgba(253,253,253,0.85)',
  slate:  'rgba(253,253,253,0.30)',
  slate2: 'rgba(253,253,253,0.62)',
  claim:       '#84FF44',  // = self
  claimButton: '#0731D1',  // = action
  claimSoft:   'rgba(132,255,68,0.14)',
};

// ─── TYPOGRAPHY ────────────────────────────────────────────────────────────

export const fonts = {
  // Archivo Black Italic — screen titles, place names, alliance names,
  // section and card titles, large map labels, moment words (VICTORY / DEFEAT).
  // ALWAYS uppercase. A true italic, not a skewed Archivo Black, so glyphs
  // don't clip and hit areas stay rectangular.
  display:       'Archivo_900Black_Italic', // screen titles, hero, moment words
  displayBold:   'Archivo_900Black_Italic', // section titles, alliance names, map labels
  displayMedium: 'Archivo_900Black_Italic', // card titles

  // IBM Plex Sans — UI chrome, data, labels (the old mono roles)
  mono:          'IBMPlexSans_700Bold',     // uppercase labels, chrome
  monoMedium:    'IBMPlexSans_600SemiBold', // data, emphasis, active states
  monoLight:     'IBMPlexSans_500Medium',   // large numeric display

  // IBM Plex Sans — readable sentences and prose
  body:          'IBMPlexSans_500Medium',   // body copy, descriptions, chat
  bodyMedium:    'IBMPlexSans_600SemiBold', // territory names, titles, emphasis

  // IBM Plex Sans Condensed Bold Italic — buttons and links
  action:        'IBMPlexSansCondensed_700Bold_Italic',
};

// Font size scale
// 11 is the floor (Apple HIG Caption 2): nothing renders smaller. xs and sm
// were 8 and 9; they now sit at the floor, and small labels are told apart
// from metadata by case, tracking and colour rather than by size.
export const fontSize = {
  xs:   11,  // section labels, resource pill text, streak label
  sm:   11,  // small labels, pill glyphs
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
  tight:  -0.03,  // large mono readouts
  normal:  0,
  wide:    0.12,  // Plex label tracking (minimum)
  wider:   0.16,  // Plex label tracking (standard)
  widest:  0.18,  // Plex deterrent labels
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
    color: 'rgba(253,253,253,0.08)',
  },
  hairlineStrong: {
    width: 1,
    color: 'rgba(253,253,253,0.18)',
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
  // Section label — IBM Plex Sans Bold, uppercase, muted2, tracked
  sectionLabel: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.muted2,
    textTransform: 'uppercase',
    letterSpacing: 0.16,
  },

  // Mono default — IBM Plex Sans Bold, white
  mono: {
    fontFamily: fonts.mono,
    color: colors.white,
  },

  // Mono medium — IBM Plex Sans SemiBold, white
  monoMedium: {
    fontFamily: fonts.monoMedium,
    color: colors.white,
  },

  // Body — IBM Plex Sans Medium, white
  body: {
    fontFamily: fonts.body,
    color: colors.white,
  },

  // Body medium — IBM Plex Sans SemiBold, white
  bodyMedium: {
    fontFamily: fonts.bodyMedium,
    color: colors.white,
  },

  // Display — Archivo Black Italic, white, uppercase
  display: {
    fontFamily: fonts.display,
    color: colors.white,
    textTransform: 'uppercase',
  },

  // Milestone — Archivo Black Italic, white, uppercase
  milestone: {
    fontFamily: fonts.display,
    color: colors.white,
    textTransform: 'uppercase',
  },

  // Action — IBM Plex Sans Condensed Bold Italic, uppercase: buttons, links
  action: {
    fontFamily: fonts.action,
    color: colors.white,
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
