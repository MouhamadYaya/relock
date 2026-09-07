import type { Preset } from '@/features/blocking/presets'

/**
 * Les réponses du diagnostic. Toutes multiples et sans plafond : le plan se
 * charge lui-même de n'en citer que deux par phrase (`MAX_QUOTED`), plutôt
 * que d'imposer une limite à ce que quelqu'un a le droit de reconnaître.
 */
export interface PlanAnswers {
  name: string
  apps: string[]
  /** Les moments où ça décroche — ils orientent les règles proposées. */
  moment: string[]
  /** Ce qui amène ici — il donne la phrase d'objectif. */
  trigger: string[]
  feelings: string[]
  /** Ce que le scroll a déjà volé. */
  stolen: string[]
  /** Ce qui a déjà été tenté pour arrêter. */
  attempts: string[]
  /** Ce qu'il ou elle ferait du temps récupéré. */
  aspirations: string[]
  hours: number
}

export interface PersonalizedPlan {
  recap: string
  feeling: string | null
  /** « Le scroll t'a déjà pris des nuits et ta concentration. » */
  loss: string | null
  /** Pourquoi les méthodes déjà tentées ont lâché, et ce que change ce plan. */
  defense: string | null
  intention: string
  rules: Preset[]
  hours: number
  recoverableDays: number
  /** Les mots d'objectif de l'utilisateur, pour le compteur du bon verdict. */
  aspirationWords: string[]
  /** « dormir, lire et voir tes proches » — la fin de la phrase d'objectif. */
  aspirationSummary: string | null
}
