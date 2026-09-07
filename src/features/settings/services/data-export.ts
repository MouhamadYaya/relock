/**
 * Export des données personnelles.
 *
 * Ce que l'app détient sur quelqu'un doit pouvoir lui être rendu, lisiblement
 * et sans démarche. C'est une obligation (RGPD, art. 20) et c'est surtout ce
 * qui rend crédible la promesse de confidentialité affichée juste au-dessus
 * dans les Réglages : une app qui dit « tes données t'appartiennent » et ne
 * sait pas te les donner ne dit rien du tout.
 *
 * LIMITE ASSUMÉE
 * L'export part par la feuille de partage du système, sous forme de texte —
 * l'app n'embarque pas de couche fichiers. Le volume s'y prête : quelques
 * règles et quelques centaines de lignes de statistiques quotidiennes, pas un
 * historique de navigation. Les mesures de Temps d'écran, elles, n'y sont pas
 * et ne peuvent pas y être : Apple ne les livre jamais à l'app (voir
 * `RelockActivityReport`), seul un score agrégé traverse.
 */

import { supabase } from '@/shared/services/supabase/client'
import { normalizeError } from '@/shared/utils/normalize-error'

/** Nombre de lignes d'historique au-delà duquel on tronque l'export. */
const MAX_ROWS = 400

export interface DataExport {
  exportedAt: string
  profile: Record<string, unknown> | null
  rules: Record<string, unknown>[]
  dailyStats: Record<string, unknown>[]
  events: Record<string, unknown>[]
  /** Vrai si l'historique a été tronqué à `MAX_ROWS` lignes. */
  truncated: boolean
}

/**
 * Rassemble tout ce que le compte contient.
 *
 * Une table qui échoue n'annule pas l'export : mieux vaut rendre trois
 * quarts des données avec une section vide qu'un message d'erreur et rien.
 */
export async function buildDataExport(): Promise<DataExport> {
  const { data: userData } = await supabase.auth.getUser()
  const uid = userData.user?.id
  if (!uid) throw normalizeError(new Error('Non connecté'))

  const [profile, rules, stats, events] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', uid).maybeSingle(),
    supabase.from('block_rules').select('*').eq('user_id', uid),
    supabase
      .from('daily_stats')
      .select('*')
      .eq('user_id', uid)
      .order('date', { ascending: false })
      .limit(MAX_ROWS),
    supabase
      .from('block_events')
      .select('*')
      .eq('user_id', uid)
      .order('occurred_at', { ascending: false })
      .limit(MAX_ROWS),
  ])

  const statRows = (stats.data ?? []) as Record<string, unknown>[]
  const eventRows = (events.data ?? []) as Record<string, unknown>[]

  return {
    exportedAt: new Date().toISOString(),
    profile: (profile.data as Record<string, unknown> | null) ?? null,
    rules: (rules.data ?? []) as Record<string, unknown>[],
    dailyStats: statRows,
    events: eventRows,
    truncated: statRows.length >= MAX_ROWS || eventRows.length >= MAX_ROWS,
  }
}

/** JSON indenté — il sera lu par un humain avant d'être lu par une machine. */
export function serializeDataExport(data: DataExport): string {
  return JSON.stringify(data, null, 2)
}
