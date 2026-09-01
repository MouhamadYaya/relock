/**
 * Formats de temps partagés par les écrans de blocage.
 *
 * Ils vivaient en double dans `BlocagesScreen` et `BlockDetailScreen` : deux
 * copies qui pouvaient diverger alors qu'un même blocage doit se lire
 * exactement pareil sur la carte, dans la fiche et dans les feuilles.
 */

/** « 20 h » ou « 20 h 47 » — l'heure telle qu'on la dit à voix haute. */
export const hhmm = (d: Date) =>
  d.getMinutes()
    ? `${d.getHours()} h ${String(d.getMinutes()).padStart(2, '0')}`
    : `${d.getHours()} h`

/** « 45 min », « 1 h », « 1 h 30 » à partir d'une durée en millisecondes. */
export function durationLabel(ms: number): string {
  const m = Math.max(0, Math.round(ms / 60_000))
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  const r = m % 60
  return r === 0 ? `${h} h` : `${h} h ${String(r).padStart(2, '0')}`
}

/** Même échelle, exprimée en minutes (config d'une règle). */
export const durationLabelFromMinutes = (min: number) =>
  durationLabel(min * 60_000)
