import { useQuery } from '@tanstack/react-query'
import { blockingKeys } from '@/features/blocking/api/keys'
import { BlockRulesService } from '@/features/blocking/services/block-rules/block-rules.service'
import { wipeCloudIfPending } from '@/features/blocking/services/reset.service'
import type { BlockRuleView } from '@/features/blocking/types'
import { Freshness } from '@/shared/services/api/query/policy/freshness'

export function useBlockRulesQuery() {
  const query = useQuery<BlockRuleView[]>({
    queryKey: blockingKeys.rules(),
    queryFn: async () => {
      // Install fraîche : efface l'historique cloud avant de lister.
      await wipeCloudIfPending().catch(() => {})
      return BlockRulesService.list()
    },
    staleTime: Freshness.nearRealtime.staleTime,
    gcTime: Freshness.nearRealtime.gcTime,
    placeholderData: prev => prev,
  })

  return {
    rules: query.data ?? [],
    isLoading: query.isLoading,
    isRefetching: query.isRefetching,
    refetch: query.refetch,
  }
}
