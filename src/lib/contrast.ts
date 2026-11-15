/**
 * WCAG 2.1 contrast, computed from the token hexes themselves.
 *
 * This exists so a later tweak to a colour in src/app/globals.css cannot quietly
 * drop a text pair below AA. The token values are duplicated in
 * src/lib/tokens.ts and the test walks every pair that renders text.
 */

/** An sRGB colour, 0-255 per channel, with straight alpha. */
export interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

const HEX = /^#(?:([\da-f]{3})|([\da-f]{6}))$/i;
const RGBA = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+))?\s*\)$/i;
const TRIPLE = /^(\d+)\s+(\d+)\s+(\d+)$/;

/** Parses `#rgb`, `#rrggbb`, `rgb(...)`, `rgba(...)` or a bare `r g b` triple. */
export function parseColor(value: string): Rgba {
  const text = value.trim();

  const hex = HEX.exec(text);
  if (hex) {
    const digits = hex[1] ? [...hex[1]].map((d) => d + d).join("") : (hex[2] as string);
    return {
      r: Number.parseInt(digits.slice(0, 2), 16),
      g: Number.parseInt(digits.slice(2, 4), 16),
      b: Number.parseInt(digits.slice(4, 6), 16),
      a: 1,
    };
  }

  const rgba = RGBA.exec(text);
  if (rgba) {
    return {
      r: Number(rgba[1]),
      g: Number(rgba[2]),
      b: Number(rgba[3]),
      a: rgba[4] === undefined ? 1 : Number(rgba[4]),
    };
  }

  const triple = TRIPLE.exec(text);
  if (triple) {
    return { r: Number(triple[1]), g: Number(triple[2]), b: Number(triple[3]), a: 1 };
  }

  throw new RangeError(`Cannot parse colour "${value}".`);
}

/** Composites a translucent colour over an opaque one ("simple alpha compositing"). */
export function flatten(top: string | Rgba, bottom: string | Rgba): Rgba {
  const over = typeof top === "string" ? parseColor(top) : top;
  const under = typeof bottom === "string" ? parseColor(bottom) : bottom;

  const mix = (a: number, b: number) => a * over.a + b * (1 - over.a);
  return { r: mix(over.r, under.r), g: mix(over.g, under.g), b: mix(over.b, under.b), a: 1 };
}

/** WCAG relative luminance. */
export function relativeLuminance(color: string | Rgba): number {
  const { r, g, b } = typeof color === "string" ? parseColor(color) : color;

  const channel = (value: number) => {
    const scaled = value / 255;
    return scaled <= 0.04045 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
  };

  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/**
 * Contrast ratio, 1 to 21. A translucent foreground is flattened over the
 * background first, which is what the browser paints.
 */
export function contrastRatio(foreground: string | Rgba, background: string | Rgba): number {
  const back = typeof background === "string" ? parseColor(background) : background;
  const front = flatten(foreground, back);

  const lighter = Math.max(relativeLuminance(front), relativeLuminance(back));
  const darker = Math.min(relativeLuminance(front), relativeLuminance(back));

  return (lighter + 0.05) / (darker + 0.05);
}
