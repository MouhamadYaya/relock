import type { Preset } from '@/features/blocking/presets'

export interface PlanAnswers {
  name: string
  apps: string[]
  moment: string | null
  trigger: string | null
  feelings: string[]
  hours: number
}

export interface PersonalizedPlan {
  recap: string
  feeling: string | null
  intention: string
  rules: Preset[]
  hours: number
  recoverableDays: number
}
