/**
 * Contraste WCAG entre deux couleurs opaques.
 *
 * Sert à prouver, et non à espérer, qu'un texte se lit sur sa carte. La règle
 * n'est pas décorative : un écran de réglages est une longue liste lue en
 * diagonale, souvent en plein soleil. Une carte qui ne se détache pas de son
 * fond ne se voit pas — c'est exactement ainsi que cet écran est apparu
 * « vide » la première fois.
 */

/** `#RRGGBB` (ou `#RGB`) → composantes 0…255. */
export function parseHex(hex: string): { r: number; g: number; b: number } {
  const raw = hex.replace('#', '')
  const full =
    raw.length === 3
      ? raw
          .split('')
          .map(c => c + c)
          .join('')
      : raw
  if (!/^[0-9a-fA-F]{6}$/.test(full)) {
    throw new Error(`Couleur opaque attendue, reçu « ${hex} »`)
  }
  return {
    r: Number.parseInt(full.slice(0, 2), 16),
    g: Number.parseInt(full.slice(2, 4), 16),
    b: Number.parseInt(full.slice(4, 6), 16),
  }
}

/** Luminance relative (WCAG 2.1, §dfn-relative-luminance). */
export function luminance(hex: string): number {
  const { r, g, b } = parseHex(hex)
  const channel = (value: number) => {
    const c = value / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

/** Rapport de contraste, de 1 (identiques) à 21 (noir sur blanc). */
export function contrastRatio(a: string, b: string): number {
  const la = luminance(a)
  const lb = luminance(b)
  const [light, dark] = la > lb ? [la, lb] : [lb, la]
  return (light + 0.05) / (dark + 0.05)
}

/** `rgba(r,g,b,a)` → composantes + alpha. Rejette toute autre notation. */
export function parseRgba(value: string): {
  r: number
  g: number
  b: number
  a: number
} {
  const match =
    /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/.exec(
      value,
    )
  if (!match) throw new Error(`Couleur rgba attendue, reçu « ${value} »`)
  return {
    r: Number(match[1]),
    g: Number(match[2]),
    b: Number(match[3]),
    a: match[4] === undefined ? 1 : Number(match[4]),
  }
}

/**
 * La couleur RÉELLEMENT vue quand une surface translucide est posée sur un
 * fond opaque.
 *
 * Sans cette composition, mesurer le contraste d'un texte « sur la carte »
 * reviendrait à le mesurer sur du blanc à 4,5 % — un fond qui n'existe nulle
 * part. Ce qu'un œil voit, c'est le mélange.
 */
export function compositeOver(overlay: string, background: string): string {
  const { r, g, b, a } = parseRgba(overlay)
  const base = parseHex(background)
  const mix = (top: number, bottom: number) =>
    Math.round(top * a + bottom * (1 - a))
  const hex = (v: number) => v.toString(16).padStart(2, '0')
  return `#${hex(mix(r, base.r))}${hex(mix(g, base.g))}${hex(mix(b, base.b))}`
}
