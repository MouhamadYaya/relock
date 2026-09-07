import type { OnboardingAnswers } from '@/features/onboarding/services/onboarding-checkpoint'
import { supabase } from '@/shared/services/supabase/client'

/**
 * Les réponses du questionnaire, rattachées au compte.
 *
 * Elles ne vivaient jusqu'ici qu'en MMKV : une réinstallation les effaçait, et
 * avec elles le plan personnalisé (« Léa, tu scrolles sur TikTok dès le
 * réveil ») qu'elles alimentent. Stockées côté compte, elles suivent
 * l'utilisateur d'un appareil à l'autre et redeviennent exploitables au-delà
 * de l'app.
 *
 * Écriture de confort, jamais bloquante : le parcours ne s'arrête pas parce
 * qu'une ligne n'a pas pu être écrite. Appelée dès qu'un compte existe,
 * c'est-à-dire après la connexion — pas avant, la table étant protégée par
 * RLS (`auth.uid() = user_id`).
 *
 * Nécessite la table `public.onboarding_answers` de `supabase/schema.sql`.
 */
export async function saveOnboardingAnswers(
  answers: OnboardingAnswers,
): Promise<void> {
  try {
    const { data } = await supabase.auth.getUser()
    const userId = data.user?.id
    if (!userId) return

    await supabase.from('onboarding_answers').upsert({
      user_id: userId,
      answers,
      updated_at: new Date().toISOString(),
    })
  } catch {
    // Confort : une réponse non sauvegardée ne doit jamais couper le parcours.
  }
}
