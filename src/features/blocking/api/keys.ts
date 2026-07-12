// Clés React Query du feature Blocage + map tag→clés pour invalidations ciblées.

import { qk } from '@/shared/services/api/query/keys/factory'
import type { TagMap } from '@/shared/services/api/query/tags'

const rules = () => qk('blocking', 'rules')

const prefixes = {
  all: () => qk('blocking'),
} as const

const tagMap = {
  'blocking:rules': [rules],
  'blocking:all': [prefixes.all],
} as const satisfies TagMap

export const blockingKeys = {
  rules,
  prefixes,
  tagMap,
} as const

export type BlockingTag = keyof typeof tagMap

export const BLOCKING_TAGS = [
  'blocking:rules',
] as const satisfies readonly BlockingTag[]
