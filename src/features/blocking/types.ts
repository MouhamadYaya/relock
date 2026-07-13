// Types & libellés du feature Blocage (UI ↔ Supabase).

import type { AppId } from '@/shared/components/ui/AppLogo'
import type { BlockRuleType } from '@/shared/services/supabase/database.types'

/** Règle de blocage prête pour l'affichage. */
export interface BlockRuleView {
  id: string
  type: BlockRuleType
  appIds: AppId[]
  isActive: boolean
  /** Nombre d'apps réellement choisies via le sélecteur Apple (jeton opaque). */
  count?: number
  /** Paramètres du type (durée/plage/limite) pour ré-armer la mécanique. */
  config?: Record<string, unknown>
}

/** Entrée de création d'une règle depuis l'écran Ajout. */
export interface CreateRuleInput {
  type: BlockRuleType
  appIds: AppId[]
  /** Renseigné quand la sélection vient du sélecteur système Family Controls. */
  count?: number
  /** Paramètres du type (durée, plage, limite…) stockés dans `config`. */
  config?: Record<string, unknown>
}

/**
 * Libellé FR d'un type de règle.
 * NB : on réutilise les valeurs d'enum existantes avec de nouveaux sens
 * (aucune migration DB) — `progressive_delay` = « Bloquer maintenant »,
 * `daily_limit` = « Limite de temps/jour ».
 */
export const RULE_TYPE_LABEL: Record<BlockRuleType, string> = {
  progressive_delay: 'Bloquer maintenant',
  schedule: 'Plage horaire',
  daily_limit: 'Limite de temps / jour',
}

/** Libellé FR d'une app bloquable. */
export const APP_LABEL: Record<string, string> = {
  tiktok: 'TikTok',
  instagram: 'Instagram',
  youtube: 'YouTube',
  snapchat: 'Snapchat',
  reddit: 'Reddit',
  x: 'X',
}

/**
 * Sous-titre d'une règle. Pour une sélection système (Family Controls), on ne
 * connaît que le nombre d'apps (jeton opaque) → « X apps bloquées ». Sinon on
 * liste les apps du préréglage : « TikTok, Instagram +1 ».
 */
export function appsSubtitle(appIds: string[], count?: number): string {
  if (typeof count === 'number' && count > 0) {
    return count === 1 ? '1 app bloquée' : `${count} apps bloquées`
  }
  if (appIds.length === 0) return 'Aucune app'
  const shown = appIds.slice(0, 2).map(id => APP_LABEL[id] ?? id)
  const extra = appIds.length - shown.length
  return extra > 0 ? `${shown.join(', ')} +${extra}` : shown.join(', ')
}
