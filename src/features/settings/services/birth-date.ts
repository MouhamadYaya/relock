/**
 * La date de naissance, entre la base et l'écran.
 *
 * Une date de naissance est une date CIVILE : « 14 mars 1998 » ne désigne pas
 * un instant, et n'a donc pas de fuseau. Tout le fichier tient à cette règle —
 * on ne construit jamais un `Date` depuis `new Date('1998-03-14')`, qui
 * interprète la chaîne en UTC et rend le 13 mars pour tout l'hémisphère ouest.
 * On passe systématiquement par les composantes locales.
 */

/** Personne née avant ça : la saisie serait une faute de frappe. */
const MIN_YEAR = 1900

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/

/** `YYYY-MM-DD` → `Date` locale à midi, ou `null` si la chaîne ne dit rien. */
export function parseBirthDate(value: string | null): Date | null {
  if (!value) return null
  const match = ISO_DATE.exec(value)
  if (!match) return null
  const [, year, month, day] = match
  // Midi et non minuit : un décalage d'horaire d'été appliqué à minuit fait
  // reculer la date d'un jour, jamais à midi.
  const date = new Date(Number(year), Number(month) - 1, Number(day), 12)
  return Number.isNaN(date.getTime()) ? null : date
}

/** `Date` → `YYYY-MM-DD`, lu sur les composantes LOCALES. */
export function toIsoDate(date: Date): string {
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

/**
 * Où poser les molettes du sélecteur quand aucune date n'est encore choisie.
 *
 * Volontairement PAS « aujourd'hui » : personne n'est né ce matin, et faire
 * défiler quarante ans de molette pour atteindre une année plausible est un
 * travail qu'on peut épargner. Ce n'est jamais AFFICHÉ comme une valeur — le
 * champ reste vide tant que rien n'a été choisi ; ce n'est que le point de
 * départ du sélecteur, après un appui explicite.
 */
const DEFAULT_ANCHOR_YEARS_AGO = 25

export function birthDateAnchor(now: Date = new Date()): Date {
  return new Date(
    now.getFullYear() - DEFAULT_ANCHOR_YEARS_AGO,
    now.getMonth(),
    now.getDate(),
    12,
  )
}

/**
 * Âge minimum acceptable.
 *
 * Ce n'est pas un choix de produit, c'est une contrainte réglementaire :
 * collecter une donnée personnelle (nom, e-mail, date de naissance) auprès
 * d'un enfant fait tomber l'app sous la guideline 5.1.4 d'Apple et sous le
 * RGPD/COPPA, qui exigent alors un consentement parental vérifiable et une
 * note d'âge dédiée. Relock n'a rien de tout ça — donc la borne haute du
 * sélecteur s'arrête au 13e anniversaire, et la question ne se pose plus.
 *
 * À tenir cohérent avec la note d'âge déclarée dans App Store Connect
 * (nouveau questionnaire 4+/9+/13+/16+/18+).
 */
export const MIN_AGE_YEARS = 13

/**
 * Bornes du sélecteur : de 1900 au 13e anniversaire. Ni naissance future, ni
 * date qui ferait de l'utilisateur un enfant (voir `MIN_AGE_YEARS`).
 */
export function birthDateBounds(now: Date = new Date()): {
  min: Date
  max: Date
} {
  const max = new Date(
    now.getFullYear() - MIN_AGE_YEARS,
    now.getMonth(),
    now.getDate(),
    12,
  )
  return { min: new Date(MIN_YEAR, 0, 1, 12), max }
}

/**
 * Date lisible dans la langue de l'app.
 *
 * `toLocaleDateString` retombe sur un format ISO quand l'ICU embarqué ne
 * connaît pas la locale — d'où le repli explicite en jour/mois/année, qui
 * reste juste partout où l'app est traduite.
 */
export function formatBirthDate(
  value: string | null,
  locale: string,
): string | null {
  const date = parseBirthDate(value)
  if (!date) return null
  try {
    return date.toLocaleDateString(locale, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  } catch {
    return `${`${date.getDate()}`.padStart(2, '0')}/${`${
      date.getMonth() + 1
    }`.padStart(2, '0')}/${date.getFullYear()}`
  }
}

/** Mois + année de création du compte — « Membre depuis mars 2026 ». */
export function formatMemberSince(
  isoTimestamp: string | null,
  locale: string,
): string | null {
  if (!isoTimestamp) return null
  const date = new Date(isoTimestamp)
  if (Number.isNaN(date.getTime())) return null
  try {
    return date.toLocaleDateString(locale, { month: 'long', year: 'numeric' })
  } catch {
    return `${date.getMonth() + 1}/${date.getFullYear()}`
  }
}
