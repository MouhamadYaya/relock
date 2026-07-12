// Types de la base Supabase — miroir de supabase/schema.sql.
// (À terme, régénérables via `supabase gen types typescript`.)

export type BlockRuleType = 'progressive_delay' | 'schedule' | 'daily_limit'
export type BlockEventType = 'intercepted' | 'opened_anyway' | 'delay_shown'

export interface Profile {
  id: string
  display_name: string | null
  avatar_url: string | null
  locale: string
  timezone: string | null
  created_at: string
  updated_at: string
}

export interface BlockRule {
  id: string
  user_id: string
  type: BlockRuleType
  app_selection: Record<string, unknown>
  config: Record<string, unknown>
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface BlockEvent {
  id: string
  user_id: string
  rule_id: string | null
  app_label: string | null
  type: BlockEventType
  occurred_at: string
  metadata: Record<string, unknown>
}

export interface DailyStats {
  id: string
  user_id: string
  date: string
  interceptions_count: number
  opens_stopped: number
  time_saved_minutes: number
  streak_respected: boolean
}

export interface Settings {
  user_id: string
  theme: string
  notifications_enabled: boolean
  reminder_time: string | null
  updated_at: string
}

type Row<T> = { Row: T; Insert: Partial<T>; Update: Partial<T> }

export interface Database {
  public: {
    Tables: {
      profiles: Row<Profile>
      block_rules: Row<BlockRule>
      block_events: Row<BlockEvent>
      daily_stats: Row<DailyStats>
      settings: Row<Settings>
    }
    Views: Record<string, never>
    Functions: Record<string, never>
  }
}
