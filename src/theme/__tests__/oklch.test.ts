import { describe, expect, it } from 'vitest';

import { isOutOfGamut, oklch } from '../oklch';
import { androidWidgetColors, darkColors, iosWidgetColors, lightColors } from '../tokens';

/**
 * These pin the OKLCH -> sRGB conversion. They are not aesthetic assertions — they
 * exist so that a change to the conversion maths can't silently shift every colour
 * in the app while the design stays where it was.
 *
 * Reference values were cross-checked against an independent implementation of
 * Björn Ottosson's Oklab specification, not read back from this module's output.
 */
describe('OKLCH conversion', () => {
  it('converts the accent blue', () => {
    expect(oklch({ l: 52, c: 0.1, h: 250 })).toBe('#386ca0');
    expect(oklch({ l: 60, c: 0.12, h: 250 })).toBe('#4284c5');
  });

  it('converts the confirmation green', () => {
    expect(oklch({ l: 70, c: 0.1, h: 150 })).toBe('#6fb07d');
    expect(oklch({ l: 55, c: 0.09, h: 150 })).toBe('#488055');
  });

  it('converts pure black and white', () => {
    expect(oklch({ l: 0, c: 0, h: 0 })).toBe('#000000');
    expect(oklch({ l: 100, c: 0, h: 0 })).toBe('#ffffff');
  });

  it('appends alpha only when the colour is translucent', () => {
    expect(oklch({ l: 52, c: 0.1, h: 250, alpha: 1 })).toBe('#386ca0');
    expect(oklch({ l: 52, c: 0.1, h: 250, alpha: 0.5 })).toBe('#386ca080');
  });

  it('preserves the small lightness deltas the dark digit tile bevel relies on', () => {
    // Tile face, bevel, and top highlight are 27%, 14% and 35% lightness. If the
    // conversion flattened them the etched look would disappear.
    const face = oklch({ l: 27, c: 0.02, h: 250 });
    const bevel = oklch({ l: 14, c: 0.012, h: 250 });
    const highlight = oklch({ l: 35, c: 0.02, h: 250 });

    const luma = (hex: string) => parseInt(hex.slice(1, 3), 16) + parseInt(hex.slice(3, 5), 16);

    expect(luma(bevel)).toBeLessThan(luma(face));
    expect(luma(face)).toBeLessThan(luma(highlight));
    expect(new Set([face, bevel, highlight]).size).toBe(3);
  });
});

describe('design tokens', () => {
  const everyColour = [
    ...Object.values(lightColors),
    ...Object.values(darkColors),
    ...Object.values(iosWidgetColors),
    ...Object.values(androidWidgetColors.light),
    ...Object.values(androidWidgetColors.dark),
  ].filter((value): value is string => typeof value === 'string' && value.startsWith('#'));

  it('resolves every token to a valid sRGB string', () => {
    expect(everyColour.length).toBeGreaterThan(30);
    for (const colour of everyColour) {
      expect(colour).toMatch(/^#[0-9a-f]{6}([0-9a-f]{2})?$/);
    }
  });

  it('keeps every design colour inside the sRGB gamut, so nothing is being clipped', () => {
    const designColours = [
      { l: 52, c: 0.1, h: 250 }, // accent, light
      { l: 40, c: 0.09, h: 250 }, // accent bevel, light
      { l: 60, c: 0.12, h: 250 }, // accent, dark
      { l: 45, c: 0.11, h: 250 }, // accent bevel, dark
      { l: 70, c: 0.1, h: 150 }, // confirmation green
      { l: 55, c: 0.09, h: 150 }, // confirmation bevel
      { l: 96, c: 0.012, h: 250 }, // light background top
      { l: 90, c: 0.025, h: 250 }, // light background bottom
      { l: 20, c: 0.02, h: 250 }, // dark background top
      { l: 12, c: 0.015, h: 250 }, // dark background bottom
    ];

    for (const colour of designColours) {
      expect(isOutOfGamut(colour), `${JSON.stringify(colour)} is clipped`).toBe(false);
    }
  });

  it('gives light and dark genuinely different surfaces', () => {
    expect(lightColors.backgroundTop).not.toBe(darkColors.backgroundTop);
    expect(lightColors.digitTile).not.toBe(darkColors.digitTile);
    expect(lightColors.buttonFill).not.toBe(darkColors.buttonFill);
  });

  it('shares one confirmation green across the app and both widgets', () => {
    expect(lightColors.confirmFill).toBe(darkColors.confirmFill);
    expect(lightColors.confirmFill).toBe(iosWidgetColors.confirmFill);
    expect(lightColors.confirmFill).toBe(androidWidgetColors.light.confirmFill);
    expect(lightColors.confirmFill).toBe(androidWidgetColors.dark.confirmFill);
  });
});
