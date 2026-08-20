/**
 * OKLCH -> sRGB conversion.
 *
 * The design reference specifies every colour in OKLCH. The README is explicit that
 * these must not be eyeball-converted to hex, because the dark-mode digit tile bevel
 * relies on small lightness deltas that a hand-picked hex would flatten.
 *
 * So OKLCH stays the source of truth in `tokens.ts`, and this module converts.
 * Conversion happens once at module load; the results are plain strings that React
 * Native's style system understands.
 *
 * Pipeline: OKLCH -> OKLab -> LMS' -> LMS -> linear sRGB -> gamma-encoded sRGB.
 * Matrices from Björn Ottosson's Oklab specification.
 */

/** A colour as authored in the design: lightness %, chroma, hue, optional alpha. */
export type Oklch = {
  /** Lightness, 0-100 (matching the `52%` form used in the design). */
  l: number;
  /** Chroma, typically 0-0.4. */
  c: number;
  /** Hue angle in degrees. */
  h: number;
  /** Alpha, 0-1. Defaults to 1. */
  alpha?: number;
};

const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);

/** Linear-light channel -> gamma-encoded sRGB. */
function gammaEncode(channel: number): number {
  return channel <= 0.0031308
    ? channel * 12.92
    : 1.055 * Math.pow(channel, 1 / 2.4) - 0.055;
}

function toHexPair(channel: number): string {
  return Math.round(clamp01(channel) * 255)
    .toString(16)
    .padStart(2, '0');
}

/**
 * Convert an OKLCH colour to an sRGB string.
 *
 * Out-of-gamut colours are clipped per-channel. None of the design's tokens are
 * out of gamut (see the pinned values in the test suite), so clipping is a
 * safety net rather than a rendering strategy.
 */
export function oklch({ l, c, h, alpha = 1 }: Oklch): string {
  const lightness = l / 100;
  const hRad = (h * Math.PI) / 180;
  const a = c * Math.cos(hRad);
  const b = c * Math.sin(hRad);

  // OKLab -> LMS' (cube roots of the cone responses)
  const lPrime = lightness + 0.3963377774 * a + 0.2158037573 * b;
  const mPrime = lightness - 0.1055613458 * a - 0.0638541728 * b;
  const sPrime = lightness - 0.0894841775 * a - 1.291485548 * b;

  const lms = lPrime * lPrime * lPrime;
  const mms = mPrime * mPrime * mPrime;
  const sms = sPrime * sPrime * sPrime;

  // LMS -> linear sRGB
  const rLinear = 4.0767416621 * lms - 3.3077115913 * mms + 0.2309699292 * sms;
  const gLinear = -1.2684380046 * lms + 2.6097574011 * mms - 0.3413193965 * sms;
  const bLinear = -0.0041960863 * lms - 0.7034186147 * mms + 1.707614701 * sms;

  const r = gammaEncode(rLinear);
  const g = gammaEncode(gLinear);
  const bl = gammaEncode(bLinear);

  const hex = `#${toHexPair(r)}${toHexPair(g)}${toHexPair(bl)}`;
  return alpha >= 1 ? hex : `${hex}${toHexPair(alpha)}`;
}

/**
 * The design's ambient shadows and top highlights are authored as plain
 * `rgba(0,0,0,a)` / `rgba(255,255,255,a)` rather than OKLCH. These keep them
 * readable as the design writes them instead of as pre-multiplied hex.
 */
export const black = (alpha: number) => `#000000${toHexPair(alpha)}`;
export const white = (alpha: number) => `#ffffff${toHexPair(alpha)}`;

/** True when the colour falls outside the sRGB gamut and would be clipped. */
export function isOutOfGamut(colour: Oklch): boolean {
  const hex = oklch({ ...colour, alpha: 1 });
  const roundTrip = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return roundTrip.some((channel) => channel === 0 || channel === 255);
}
