/**
 * Runtime design-token resolver.
 *
 * Canvas/WebGL surfaces (sigma graphs) and values that travel over the wire
 * (presence colors) can't consume Tailwind classes — they need concrete CSS
 * color strings. Instead of hardcoding hex values, these helpers read the
 * HSL channel triples declared on :root in src/styles/index.css (e.g.
 * `--primary: 243 75% 59%`) at call time, so the resolved palette always
 * follows the active theme.
 */

export interface HslChannels {
  h: number;
  s: number;
  l: number;
}

/** Neutral zinc fallback for environments without computed styles (jsdom). */
const FALLBACK: HslChannels = { h: 240, s: 5, l: 65 };

const toHsl = ({ h, s, l }: HslChannels): string => `hsl(${h} ${s}% ${l}%)`;

/** Read a token's raw HSL channels from the document root. */
export function tokenChannels(token: string): HslChannels {
  if (typeof document === 'undefined' || typeof getComputedStyle !== 'function') {
    return FALLBACK;
  }
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue(`--${token}`)
    .trim();
  const match = raw.match(/^([\d.]+)(?:deg)?[,\s]+([\d.]+)%[,\s]+([\d.]+)%$/);
  if (!match) return FALLBACK;
  return { h: Number(match[1]), s: Number(match[2]), l: Number(match[3]) };
}

/** Resolve a design token (e.g. 'primary', 'surface') to a CSS hsl() string. */
export function tokenColor(token: string): string {
  return toHsl(tokenChannels(token));
}

/** Resolve a token, rotated `degrees` around the hue wheel (for derived accents). */
export function rotatedTokenColor(token: string, degrees: number): string {
  const { h, s, l } = tokenChannels(token);
  return toHsl({ h: (((h + degrees) % 360) + 360) % 360, s, l });
}

/**
 * Named accent tokens used as the head of every categorical palette.
 * primary-hover is the lighter indigo, which reads better on dark canvases.
 */
const ACCENT_TOKENS = ['primary-hover', 'info', 'success', 'warning', 'destructive'] as const;

/**
 * Categorical palette entry `index` (communities, presence avatars, …).
 * The first five entries are the semantic accent tokens; beyond that the
 * palette continues with golden-angle hue rotations of the primary accent so
 * an arbitrary number of categories stays visually distinct while remaining
 * derived from the theme.
 */
export function accentColor(index: number): string {
  const i = Math.abs(Math.trunc(index));
  if (i < ACCENT_TOKENS.length) {
    return tokenColor(ACCENT_TOKENS[i]);
  }
  const { h, s, l } = tokenChannels('primary-hover');
  const hue = (h + 137.508 * (i - ACCENT_TOKENS.length + 1)) % 360;
  return toHsl({ h: hue, s, l });
}
