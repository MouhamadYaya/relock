// Types & libellés du feature Blocage (UI ↔ Supabase).

import type { AppId } from '@/shared/components/ui/AppLogo'
import type { BlockRuleType } from '@/shared/services/supabase/database.types'

/** Règle de blocage prête pour l'affichage. */
export interface BlockRuleView {
  id: string
  type: BlockRuleType
  appIds: AppId[]
  isActive: boolean
}

/** Entrée de création d'une règle depuis l'écran Ajout. */
export interface CreateRuleInput {
  type: BlockRuleType
  appIds: AppId[]
}

/** Libellé FR d'un type de règle. */
export const RULE_TYPE_LABEL: Record<BlockRuleType, string> = {
  progressive_delay: 'Délai progressif',
  schedule: 'Plages horaires',
  daily_limit: "Limite d'ouvertures / jour",
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

/** Sous-titre « TikTok, Instagram +1 » à partir des apps d'une règle. */
export function appsSubtitle(appIds: string[]): string {
  if (appIds.length === 0) return 'Aucune app'
  const shown = appIds.slice(0, 2).map(id => APP_LABEL[id] ?? id)
  const extra = appIds.length - shown.length
  return extra > 0 ? `${shown.join(', ')} +${extra}` : shown.join(', ')
}
