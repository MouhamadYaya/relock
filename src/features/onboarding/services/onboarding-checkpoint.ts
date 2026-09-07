import { z } from 'zod'
import { constants } from '@/config/constants'
import { kvStorage } from '@/shared/services/storage/mmkv'

/**
 * Reprise de l'onboarding après une fermeture de l'app.
 *
 * On mémorise l'étape atteinte ET les réponses données, pour que le retour se
 * fasse là où le parcours s'est arrêté — le plan personnalisé se reconstruit
 * avec les mêmes réponses, pas avec des valeurs par défaut.
 *
 * ⚠️ Ce n'est PAS ce qui décide de la page d'accueil de l'app. Cette
 * décision-là appartient aux trois portes (`resolveAppRoot`), parce qu'une
 * position mémorisée ne survit ni à une réinstallation, ni à un changement
 * d'appareil, ni à une expiration d'abonnement, ni à un remaniement du
 * parcours. Le point de reprise n'affine QUE l'intérieur du parcours ;
 * `OnboardingFlow.resumeIndex` lui applique d'ailleurs une règle qui prime
 * sur lui : un abonné ne repasse jamais par le récit.
 *
 * Le marqueur est effacé par `completeSetup()` — au-delà, l'utilisateur ne
 * revoit plus jamais l'onboarding.
 */

/**
 * ⚠️ Tout champ AJOUTÉ ici doit rester tolérant à son absence (`.catch([])`).
 * Une sauvegarde écrite par une version antérieure ne connaît pas les
 * nouvelles questions : sans ce filet, le `safeParse` échouerait et tous les
 * onboardings en cours repartiraient de zéro à la mise à jour.
 */
/**
 * Une réponse à choix multiple, tolérante aux sauvegardes d'AVANT le passage
 * au choix multiple : `trigger` et `moment` y valaient une chaîne (ou `null`)
 * plutôt qu'une liste. Sans cette conversion, tout onboarding en cours au
 * moment de la mise à jour repartirait de zéro.
 */
const multiPick = z
  .union([z.array(z.string()), z.string(), z.null()])
  .transform(value => (Array.isArray(value) ? value : value ? [value] : []))
  .catch([])

const answersSchema = z.object({
  name: z.string(),
  trigger: multiPick,
  apps: z.array(z.string()),
  moment: multiPick,
  feelings: z.array(z.string()),
  stolen: z.array(z.string()).catch([]),
  attempts: z.array(z.string()).catch([]),
  aspirations: z.array(z.string()).catch([]),
  screenTime: z.string().nullable(),
  hours: z.number(),
  appCount: z.number(),
  rulePresetIds: z.array(z.string()),
})

const checkpointSchema = z.object({
  step: z.string(),
  answers: answersSchema,
})

export type OnboardingAnswers = z.infer<typeof answersSchema>
export type OnboardingCheckpoint = z.infer<typeof checkpointSchema>

/**
 * Dernière étape atteinte, ou `null` si rien de valide n'est enregistré.
 * Un contenu corrompu (JSON illisible, forme obsolète après une refonte du
 * parcours) équivaut à une absence de reprise : on repart du début plutôt
 * que de faire crasher l'écran d'accueil de l'app.
 */
export function readOnboardingCheckpoint(): OnboardingCheckpoint | null {
  const raw = kvStorage.getString(constants.ONBOARDING_CHECKPOINT)
  if (!raw) return null
  try {
    const parsed = checkpointSchema.safeParse(JSON.parse(raw))
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

export function saveOnboardingCheckpoint(
  checkpoint: OnboardingCheckpoint,
): void {
  try {
    kvStorage.setString(
      constants.ONBOARDING_CHECKPOINT,
      JSON.stringify(checkpoint),
    )
  } catch {
    // Une sauvegarde perdue ne doit jamais interrompre le parcours en cours.
  }
}

export function clearOnboardingCheckpoint(): void {
  kvStorage.delete(constants.ONBOARDING_CHECKPOINT)
}
