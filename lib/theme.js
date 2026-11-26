// lib/theme.js
// Dominia design tokens — single source of truth for all UI

// ─── COLOURS ───────────────────────────────────────────────────────────────

export const colors = {
  // ── Brand palette (2026-11 refinement; Figma "Dominia / Color") ──
  obsidian: '#101010',  // app background
  surface:  '#1A1A1A',  // cards, sheets, tab bar
  raised:   '#242424',  // tracks, active segments, further elevation
  white:    '#F5F4EF',  // all primary text (warm off-white, never #FFFFFF)
  white2:   '#E4E3DE',  // secondary foreground
  muted:    '#6C6C69',  // white at 40% on obsidian: placeholders, inactive
  muted2:   '#A3A29F',  // white at 64% on obsidian: descriptions, metadata

  // Actions and accents
  action:        '#3155FF', // Electric blue: primary buttons
  actionPressed: '#2443D6',
  lime:          '#C8FF3D', // Signal lime: accents only (active tab, selection,
                            // progress, rewards, recenter, player dot). At most
                            // one lime-filled button per screen.
  limeSoft:      'rgba(200,255,61,0.14)',
  onLime:        '#101010', // text/icons on a lime fill

  // Map territory triad — meanings locked
  self:     '#22D65E', // Smash green: territories you own
  alliance: '#3155FF', // Electric blue: your alliance's territories
  enemy:    '#E8432B', // Vermillion: other players' territories; also danger actions
  selfSoft:     'rgba(34,214,94,0.14)',
  allianceSoft: 'rgba(49,85,255,0.14)',
  enemySoft:    'rgba(232,67,43,0.14)',
  danger:   '#E8432B',

  // Caution — warning/paused/expiring states only, at most one per screen.
  caution: '#D49A2B',

  // Hairlines
  hairline:       'rgba(245,244,239,0.08)',
  hairlineStrong: 'rgba(245,244,239,0.18)',

  // ── Legacy aliases (pre-refinement names; prefer the names above) ──
  ink:    '#101010',
  ink2:   '#1A1A1A',
  ink3:   '#242424',
  bone:   '#F5F4EF',
  bone2:  '#E4E3DE',
  slate:  '#6C6C69',
  slate2: '#A3A29F',
  claim:       '#22D65E',  // = self
  claimButton: '#3155FF',  // = action
  claimSoft:   'rgba(34,214,94,0.14)',
};

// ─── TYPOGRAPHY ────────────────────────────────────────────────────────────

export const fonts = {
  // Sofia Sans Extra Condensed — screen titles, place names, alliance names,
  // section and card titles, large map labels, moment words (TAKEN / LOST).
  // ALWAYS uppercase.
  display:       'SofiaSansExtraCondensed_800ExtraBold', // screen titles, hero, moment words
  displayBold:   'SofiaSansExtraCondensed_700Bold',      // section titles, alliance names, map labels
  displayMedium: 'SofiaSansExtraCondensed_600SemiBold',  // card titles

  // Geist Mono — all UI chrome, data, labels
  mono:          'GeistMono_400Regular',   // default — all labels, measurements, chrome
  monoMedium:    'GeistMono_500Medium',    // emphasis within mono, active states
  monoLight:     'GeistMono_300Light',     // reserved for very large numeric display only

  // Instrument Sans — readable sentences and prose
  body:          'InstrumentSans_400Regular',       // body copy, challenge descriptions, chat
  bodyMedium:    'InstrumentSans_500Medium',        // territory names, challenge titles, emphasis
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
    color: 'rgba(245,244,239,0.08)',
  },
  hairlineStrong: {
    width: 1,
    color: 'rgba(245,244,239,0.18)',
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
    fontSize: 11,
    color: '#A3A29F',
    textTransform: 'uppercase',
    letterSpacing: 0.16,
  },

  // Mono default — Geist Mono 400, bone
  mono: {
    fontFamily: 'GeistMono_400Regular',
    color: '#F5F4EF',
  },

  // Mono medium — Geist Mono 500, bone
  monoMedium: {
    fontFamily: 'GeistMono_500Medium',
    color: '#F5F4EF',
  },

  // Body — Instrument Sans 400, bone
  body: {
    fontFamily: 'InstrumentSans_400Regular',
    color: '#F5F4EF',
  },

  // Body medium — Instrument Sans 500, bone
  bodyMedium: {
    fontFamily: 'InstrumentSans_500Medium',
    color: '#F5F4EF',
  },

  // Display — Sofia Sans Extra Condensed 800, white, uppercase
  display: {
    fontFamily: 'SofiaSansExtraCondensed_800ExtraBold',
    color: '#F5F4EF',
    textTransform: 'uppercase',
  },

  // Milestone — Sofia Sans Extra Condensed 800, white, uppercase
  milestone: {
    fontFamily: 'SofiaSansExtraCondensed_800ExtraBold',
    color: '#F5F4EF',
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
