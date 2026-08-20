/**
 * The single entry point for design values. Import from here, never from `tokens`
 * directly, so that light/dark selection stays in one place.
 */

import {
  darkColors,
  elevation,
  fontFamily,
  fontSize,
  fontWeight,
  geometry,
  letterSpacingEm,
  lightColors,
  motion,
  radius,
  REFERENCE_FRAME,
  spacing,
  tracking,
} from './tokens';

export type ColorScheme = 'light' | 'dark';
export type Colors = typeof lightColors;

/** A soft blurred shadow beneath the flat bevel band. */
export type AmbientShadow = { offsetY: number; blur: number; color: string };

export type Theme = {
  scheme: ColorScheme;
  colors: Colors;
  /** The ambient shadow for this scheme's main button. */
  buttonAmbient: AmbientShadow;
  buttonHighlight: string;
};

export const themes: Record<ColorScheme, Theme> = {
  light: {
    scheme: 'light',
    colors: lightColors,
    buttonAmbient: elevation.ambient.light,
    buttonHighlight: elevation.topHighlight.button.light,
  },
  dark: {
    scheme: 'dark',
    colors: darkColors,
    buttonAmbient: elevation.ambient.dark,
    buttonHighlight: elevation.topHighlight.button.dark,
  },
};

/**
 * The design's mock is a 320x660 frame, which is not a device size. Layouts scale
 * from it on the horizontal axis, which preserves the button's 190:88 aspect ratio
 * and its proportion of the screen width. The 50/50 vertical split is expressed as
 * flex rather than as a scaled height, so it survives any screen aspect.
 */
export const scale = (referenceValue: number, screenWidth: number) =>
  (referenceValue / REFERENCE_FRAME.width) * screenWidth;

export {
  darkColors,
  elevation,
  fontFamily,
  fontSize,
  fontWeight,
  geometry,
  letterSpacingEm,
  lightColors,
  motion,
  radius,
  REFERENCE_FRAME,
  spacing,
  tracking,
};
export { androidWidgetColors, iosWidgetColors, REFERENCE_WIDGET, darkDigitTileHighlight } from './tokens';
export { oklch, black, white, isOutOfGamut } from './oklch';
export type { Oklch } from './oklch';
