/**
 * Du « moment où ça décroche » déclaré à l'accueil vers une HEURE.
 *
 * C'est ce qui sépare « pense à armer un blocage » de « ton heure difficile
 * approche ». Le premier est un rappel générique de plus ; le second reprend
 * quelque chose que l'utilisateur a lui-même écrit, à l'instant où ça compte.
 *
 * Fonction pure sur des chaînes : aucune dépendance au module d'accueil, donc
 * aucun couplage entre deux domaines qui n'ont pas à se connaître.
 */

/** Identifiants du questionnaire d'accueil → heure locale (minutes). */
const MOMENT_HOURS: Record<string, number> = {
  bed: 22 * 60,
  wake: 7 * 60 + 30,
  work: 10 * 60,
  break: 15 * 60,
  transport: 8 * 60 + 30,
  meals: 12 * 60 + 30,
  weekend: 15 * 60,
  // « Un peu tout le temps » ne désigne aucune heure. On vise la soirée, le
  // moment le plus commun, plutôt que de renoncer au message.
  always: 21 * 60,
}

/**
 * L'heure à risque retenue.
 *
 * Plusieurs réponses sont possibles — personne n'a un seul moment de faiblesse.
 * On prend la PLUS TARDIVE de la journée : c'est celle où la fatigue rend le
 * geste le plus dur, et celle où un blocage armé couvre encore ce qui suit.
 */
export function riskHourFromMoments(moments: readonly string[]): number | null {
  const hours = moments
    .map(moment => MOMENT_HOURS[moment])
    .filter((minutes): minutes is number => typeof minutes === 'number')
  return hours.length > 0 ? Math.max(...hours) : null
}
