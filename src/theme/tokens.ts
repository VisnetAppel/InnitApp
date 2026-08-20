/**
 * Design tokens, extracted verbatim from `Innit - Final Reference.dc.html` and its README.
 *
 * Every colour below is the OKLCH value the design actually specifies, converted to
 * sRGB by `oklch()` rather than transcribed as hex. If you need to check a value
 * against the design, compare the OKLCH triple — that is the thing both documents
 * talk about.
 *
 * Names follow the README's own vocabulary ("accent", "confirmation green",
 * "digit tile", "divider") so the design and the code stay talkable-about.
 *
 * NOTHING outside this directory should contain a colour literal, a font size,
 * a radius, or a spacing number.
 */

import { black, oklch, white } from './oklch';

/**
 * The design's mock frame. Per the README this is NOT a device size — layouts scale
 * proportionally from it, preserving the ~50/50 split and the button's aspect ratio.
 */
export const REFERENCE_FRAME = { width: 320, height: 660 } as const;

/** The design's widget mock is a 132px square; both platforms' art is drawn at that scale. */
export const REFERENCE_WIDGET = { size: 132 } as const;

/* ------------------------------------------------------------------ *
 * Colour
 * ------------------------------------------------------------------ */

/**
 * Accent (ink blue) and the confirmation green. These are the only chromatic
 * colours in the product.
 */
const accent = {
  light: oklch({ l: 52, c: 0.1, h: 250 }),
  lightShadow: oklch({ l: 40, c: 0.09, h: 250 }),
  dark: oklch({ l: 60, c: 0.12, h: 250 }),
  darkShadow: oklch({ l: 45, c: 0.11, h: 250 }),
} as const;

const confirm = {
  fill: oklch({ l: 70, c: 0.1, h: 150 }),
  shadow: oklch({ l: 55, c: 0.09, h: 150 }),
  label: oklch({ l: 99, c: 0.005, h: 150 }),
  /** The Android widget's tap ripple — a soft radial highlight behind the header. */
  ripple: oklch({ l: 70, c: 0.1, h: 150, alpha: 0.35 }),
} as const;

export const lightColors = {
  backgroundTop: oklch({ l: 96, c: 0.012, h: 250 }),
  backgroundBottom: oklch({ l: 90, c: 0.025, h: 250 }),

  digitTile: oklch({ l: 99, c: 0.005, h: 250 }),
  digitTileText: oklch({ l: 30, c: 0.03, h: 250 }),
  digitTileBevel: oklch({ l: 87, c: 0.02, h: 250 }),

  divider: oklch({ l: 80, c: 0.03, h: 250, alpha: 0.5 }),

  /** Status line — the highest-emphasis body text on the screen. */
  textPrimary: oklch({ l: 38, c: 0.03, h: 250, alpha: 0.85 }),
  /** "DAYS, UNBROKEN" label. */
  textSecondary: oklch({ l: 45, c: 0.03, h: 250, alpha: 0.8 }),
  /** "with Jordan" — lowest-emphasis caption. */
  textCaption: oklch({ l: 45, c: 0.03, h: 250, alpha: 0.6 }),

  buttonFill: accent.light,
  buttonBevel: accent.lightShadow,
  buttonLabel: oklch({ l: 98, c: 0.005, h: 250 }),

  /** The 3-dot overflow glyph, top-right. */
  overflowDot: oklch({ l: 35, c: 0.03, h: 250, alpha: 0.7 }),

  confirmFill: confirm.fill,
  confirmBevel: confirm.shadow,
  confirmLabel: confirm.label,
  confirmRipple: confirm.ripple,
} as const;

export const darkColors: typeof lightColors = {
  backgroundTop: oklch({ l: 20, c: 0.02, h: 250 }),
  backgroundBottom: oklch({ l: 12, c: 0.015, h: 250 }),

  digitTile: oklch({ l: 27, c: 0.02, h: 250 }),
  digitTileText: oklch({ l: 90, c: 0.01, h: 250 }),
  digitTileBevel: oklch({ l: 14, c: 0.012, h: 250 }),

  divider: oklch({ l: 35, c: 0.02, h: 250 }),

  textPrimary: oklch({ l: 70, c: 0.015, h: 250, alpha: 0.75 }),
  textSecondary: oklch({ l: 65, c: 0.02, h: 250, alpha: 0.75 }),
  textCaption: oklch({ l: 65, c: 0.02, h: 250, alpha: 0.5 }),

  buttonFill: accent.dark,
  buttonBevel: accent.darkShadow,
  buttonLabel: oklch({ l: 99, c: 0.005, h: 250 }),

  overflowDot: oklch({ l: 85, c: 0.02, h: 250, alpha: 0.7 }),

  confirmFill: confirm.fill,
  confirmBevel: confirm.shadow,
  confirmLabel: confirm.label,
  confirmRipple: confirm.ripple,
};

/**
 * Dark-mode digit tiles carry a second inset highlight along the top edge that the
 * light tiles don't have; it's what gives them the etched look against the dark
 * background. Kept separate because it has no light-mode counterpart.
 */
export const darkDigitTileHighlight = oklch({ l: 35, c: 0.02, h: 250 });

/* ------------------------------------------------------------------ *
 * Widget colour — the widgets are their own visual context, not the app's.
 * ------------------------------------------------------------------ */

/**
 * The iOS widget is a dark navy gradient card regardless of wallpaper or system
 * appearance, so it has one palette rather than a light/dark pair.
 */
export const iosWidgetColors = {
  cardTop: oklch({ l: 30, c: 0.03, h: 250 }),
  cardBottom: oklch({ l: 16, c: 0.02, h: 255 }),
  streak: oklch({ l: 85, c: 0.02, h: 250 }),
  buttonFill: accent.dark,
  buttonBevel: accent.darkShadow,
  buttonLabel: oklch({ l: 99, c: 0.005, h: 250 }),
  confirmFill: confirm.fill,
  confirmBevel: confirm.shadow,
  confirmLabel: confirm.label,
} as const;

/** The Android widget is an opaque Material surface and does follow light/dark. */
export const androidWidgetColors = {
  light: {
    card: oklch({ l: 97, c: 0.008, h: 250 }),
    streak: oklch({ l: 28, c: 0.03, h: 250 }),
    label: oklch({ l: 50, c: 0.03, h: 250, alpha: 0.7 }),
    buttonFill: accent.light,
    buttonLabel: oklch({ l: 99, c: 0.005, h: 250 }),
    confirmFill: confirm.fill,
    confirmLabel: confirm.label,
    confirmRipple: confirm.ripple,
  },
  dark: {
    card: oklch({ l: 24, c: 0.015, h: 250 }),
    streak: oklch({ l: 92, c: 0.01, h: 250 }),
    label: oklch({ l: 75, c: 0.02, h: 250, alpha: 0.6 }),
    buttonFill: accent.dark,
    buttonLabel: oklch({ l: 99, c: 0.005, h: 250 }),
    confirmFill: confirm.fill,
    confirmLabel: confirm.label,
    confirmRipple: confirm.ripple,
  },
} as const;

/* ------------------------------------------------------------------ *
 * Typography
 * ------------------------------------------------------------------ */

export const fontFamily = {
  /** UI text: San Francisco on iOS, Roboto on Android. Resolved per-platform. */
  system: undefined as string | undefined,
  /** Numerals and the "innit" wordmark. Bundled; see docs/design-audit.md on widgets. */
  mono: 'JetBrainsMono-Bold',
} as const;

/** Sizes at reference scale, named for what they label in the design. */
export const fontSize = {
  streakDigit: 44,
  buttonLabel: 22,
  statusLine: 13,
  streakLabel: 11,
  pairedName: 11.5,

  widgetButtonLabel: 14,
  widgetConfirmLabel: 13,
  widgetStreakIos: 15,
  widgetStreakAndroid: 20,
  widgetLabelAndroid: 8.5,
} as const;

export const fontWeight = {
  regular: '400',
  semibold: '600',
  bold: '700',
} as const;

/** Tracking, as authored. The design uses em units; RN wants points at a given size. */
export const letterSpacingEm = {
  streakLabel: 0.14,
  buttonLabel: 0.02,
  widgetLabelAndroid: 0.06,
} as const;

/** Convert the design's em tracking to the point value RN's `letterSpacing` expects. */
export const tracking = (em: number, size: number) => em * size;

/* ------------------------------------------------------------------ *
 * Spacing, radii, geometry
 * ------------------------------------------------------------------ */

export const spacing = {
  xxs: 3,
  xs: 6,
  sm: 8,
  md: 10,
  lg: 12,
  xl: 14,
  xxl: 16,
  xxxl: 22,
  /** Side inset of the hairline divider. */
  dividerInset: 28,
} as const;

export const radius = {
  digitTile: 8,
  androidWidgetButton: 12,
  iosWidgetButton: 14,
  /** The main button, and the Android widget card. */
  button: 16,
  androidWidgetCard: 16,
  /** Matches the system continuous-curve widget mask. */
  iosWidgetCard: 26,
} as const;

export const geometry = {
  /** Reference button size; real size derives from these ratios. See `layout.ts`. */
  button: { width: 190, height: 88 },
  digitTile: { width: 40, verticalPadding: 8, gap: spacing.xs },
  overflowDot: { size: 4, gap: spacing.xxs },
  hairline: 1,

  iosWidget: { padding: spacing.xl, button: { width: 88, height: 56 } },
  androidWidget: { padding: spacing.lg, buttonHeight: 52 },
} as const;

/* ------------------------------------------------------------------ *
 * Elevation
 *
 * The README is emphatic that the button's depth is a three-layer stack, and that
 * reproducing it as a single shadow loses the physical-key read:
 *   1. a flat, hard-edged offset band in a darker shade of the same hue (the bevel)
 *   2. a soft ambient shadow beneath that
 *   3. a subtle inset highlight near the top
 * Layer 1 is rendered as a real view so the press animation can collapse it.
 * ------------------------------------------------------------------ */

export const elevation = {
  /** Depth of the flat bevel band under the button, in points. */
  buttonBevelDepth: 6,
  /** Depth of the flat bevel under a widget button. */
  widgetButtonBevelDepth: 4,
  /** Inset bevel under a digit tile. */
  digitTileBevelDepth: 3,

  ambient: {
    light: { offsetY: 12, blur: 20, color: black(0.22) },
    dark: { offsetY: 14, blur: 24, color: black(0.5) },
    digitTileLight: { offsetY: 1, blur: 2, color: black(0.06) },
    iosWidgetLight: { offsetY: 10, blur: 22, color: black(0.35) },
    iosWidgetDark: { offsetY: 10, blur: 22, color: black(0.5) },
    androidWidgetLight: { offsetY: 6, blur: 14, color: black(0.25) },
    androidWidgetDark: { offsetY: 6, blur: 14, color: black(0.4) },
  },

  /** The top highlight, as authored: `inset 0 2px 3px rgba(255,255,255,0.25)`. */
  topHighlight: {
    button: { light: white(0.25), dark: white(0.2), offsetY: 2, blur: 3 },
    widgetButton: { color: white(0.2), confirmColor: white(0.25), offsetY: 1.5, blur: 2 },
  },
} as const;

/* ------------------------------------------------------------------ *
 * Motion
 *
 * The design supplies no motion spec (README: "not yet fully specified motion-wise").
 * These are PROPOSALS, flagged in docs/design-audit.md and pending sign-off — they
 * live here so there is exactly one place to change them once they're settled.
 * ------------------------------------------------------------------ */

export const motion = {
  /** Button travels down by the bevel depth and the band collapses. */
  buttonPress: { travel: elevation.buttonBevelDepth, durationIn: 60, durationOut: 220 },
  /** How long the widget shows "sent" before reverting to the button. */
  widgetConfirmHold: 4000,
} as const;
