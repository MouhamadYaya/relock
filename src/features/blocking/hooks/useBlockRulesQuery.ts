import { useQuery } from '@tanstack/react-query'
import { blockingKeys } from '@/features/blocking/api/keys'
import { devFixturesEnabled } from '@/features/blocking/dev-fixtures'
import { BlockRulesService } from '@/features/blocking/services/block-rules/block-rules.service'
import type { BlockRuleView } from '@/features/blocking/types'
import { useSessionUserId } from '@/session/useSessionUser'
import { Freshness } from '@/shared/services/api/query/policy/freshness'

export function useBlockRulesQuery() {
  const userId = useSessionUserId()
  const query = useQuery<BlockRuleView[]>({
    // Clé portée par l'utilisateur (le cache est persisté sur MMKV : sans ça,
    // les règles d'un compte peuvent réapparaître sous un autre).
    queryKey: [...blockingKeys.rules(), userId ?? 'anon'],
    // Réinstallation : le wipe n'est pas fait ici mais au lancement
    // (useFreshInstallReset) — cette requête ne fait que lire.
    queryFn: () => BlockRulesService.list(),
    // Sans session, RLS renvoie une liste VIDE sans erreur : sans ce garde,
    // l'Accueil affiche « Aucun blocage » et met ce vide en cache. Le jeu de
    // test du simulateur, lui, ne dépend d'aucune session — l'exiger le
    // rendrait inutilisable hors ligne, c'est-à-dire là où il sert.
    enabled: !!userId || devFixturesEnabled(),
    staleTime: Freshness.nearRealtime.staleTime,
    gcTime: Freshness.nearRealtime.gcTime,
  })

  return {
    rules: query.data ?? [],
    /** Aucune donnée encore disponible — à distinguer d'une liste vide. */
    isPending: !query.data,
    isError: query.isError,
    isRefetching: query.isRefetching,
    refetch: query.refetch,
  }
}
