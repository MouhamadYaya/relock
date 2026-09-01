// Types & libellés du feature Blocage (UI ↔ Supabase).

import type { AppId } from '@/shared/components/ui/AppLogo'
import type { BlockRuleType } from '@/shared/services/supabase/database.types'

export const BLOCKING_EDITOR_TYPES = [
  'block_now',
  'schedule',
  'daily_limit',
] as const

export type BlockingEditorType = (typeof BLOCKING_EDITOR_TYPES)[number]

export function isBlockingEditorType(
  value: unknown,
): value is BlockingEditorType {
  return (
    typeof value === 'string' &&
    BLOCKING_EDITOR_TYPES.some(editorType => editorType === value)
  )
}

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
  /** Date de création ISO (= début du blocage pour « Bloquer maintenant »). */
  createdAt?: string
}

/** Entrée de création d'une règle depuis l'écran Ajout. */
export interface CreateRuleInput {
  /**
   * Id fourni par le CLIENT (UUID v4) : la mécanique native (activité
   * DeviceActivity + sélection App Group) est liée à cet id avant l'insert.
   */
  id?: string
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

const num = (v: unknown, d = 0): number => (typeof v === 'number' ? v : d)

/** Un blocage « Bloquer maintenant » en mode strict est verrouillé. */
export function isStrict(rule: BlockRuleView): boolean {
  return rule.type === 'progressive_delay' && rule.config?.strict === true
}

/** Fin d'un blocage « Bloquer maintenant » (début + durée), sinon null. */
export function blockEndDate(rule: BlockRuleView): Date | null {
  if (rule.type !== 'progressive_delay' || !rule.createdAt) return null
  const durationMin = num(rule.config?.duration_min, 30)
  return new Date(new Date(rule.createdAt).getTime() + durationMin * 60_000)
}

/** Un blocage strict encore en cours ne peut pas être arrêté. */
export function isLocked(rule: BlockRuleView): boolean {
  if (!isStrict(rule)) return false
  const end = blockEndDate(rule)
  return end ? end.getTime() > Date.now() : true
}

/** « HH:MM » — heure de déverrouillage d'un blocage strict. */
export function unlockTimeLabel(rule: BlockRuleView): string {
  const end = blockEndDate(rule)
  if (!end) return ''
  return `${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`
}

/** Ligne de statut affichée sur la carte (temps restant / plage / limite). */
export function blockStatusLine(rule: BlockRuleView): string {
  const apps = appsSubtitle(rule.appIds, rule.count)
  if (rule.type === 'schedule') {
    const s = timeToLabel(
      num(rule.config?.start_hour, 22),
      num(rule.config?.start_minute),
    )
    const e = timeToLabel(
      num(rule.config?.end_hour, 8),
      num(rule.config?.end_minute),
    )
    return `${apps} · chaque jour ${s} → ${e}`
  }
  if (rule.type === 'daily_limit') {
    return `${apps} · limite ${durationLabel(num(rule.config?.limit_min, 60))} / jour`
  }
  // Bloquer maintenant
  const end = blockEndDate(rule)
  if (!end) return apps
  const remainingMin = Math.round((end.getTime() - Date.now()) / 60_000)
  if (remainingMin <= 0) return `${apps} · terminé`
  return `${apps} · encore ${durationLabel(remainingMin)}`
}

function timeToLabel(h: number, m: number): string {
  return m ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`
}

// ── Zonage Accueil : « En ce moment » (live) vs « Mes règles » (persistant) ──

/** Une plage horaire est-elle active à cet instant (gère le passage minuit) ? */
export function scheduleActive(rule: BlockRuleView, now = new Date()): boolean {
  if (rule.type !== 'schedule') return false
  const start =
    num(rule.config?.start_hour, 22) * 60 + num(rule.config?.start_minute)
  const end = num(rule.config?.end_hour, 8) * 60 + num(rule.config?.end_minute)
  const t = now.getHours() * 60 + now.getMinutes()
  return start <= end ? t >= start && t < end : t >= start || t < end
}

/** Un blocage minuté est-il encore en cours ? */
export function timedRunning(rule: BlockRuleView, now = new Date()): boolean {
  const end = blockEndDate(rule)
  return !!end && end.getTime() > now.getTime()
}

/** « En ce moment » = ça bloque réellement à cet instant. */
export function isLiveNow(rule: BlockRuleView, now = new Date()): boolean {
  if (!rule.isActive) return false
  if (rule.type === 'progressive_delay') return timedRunning(rule, now)
  if (rule.type === 'schedule') return scheduleActive(rule, now)
  return false // les limites vivent dans « Mes règles »
}

export type RingInfo = { fraction: number; color: 'accent' | 'amber' }

/**
 * Anneau de la carte, dont le SENS s'adapte au type :
 * minuté/plage → temps restant (violet) ; limite → quota (ambre).
 */
export function ringInfo(rule: BlockRuleView, now = new Date()): RingInfo {
  if (rule.type === 'daily_limit') return { fraction: 1, color: 'amber' }
  if (rule.type === 'schedule') {
    const start =
      num(rule.config?.start_hour, 22) * 60 + num(rule.config?.start_minute)
    const end =
      num(rule.config?.end_hour, 8) * 60 + num(rule.config?.end_minute)
    const len = (end - start + 1440) % 1440 || 1440
    const t = now.getHours() * 60 + now.getMinutes()
    const elapsed = (t - start + 1440) % 1440
    return {
      fraction: Math.max(0, Math.min(1, 1 - elapsed / len)),
      color: 'accent',
    }
  }
  const end = blockEndDate(rule)
  const total = num(rule.config?.duration_min, 30)
  if (!end || total <= 0) return { fraction: 0, color: 'accent' }
  const remaining = (end.getTime() - now.getTime()) / 60_000
  return {
    fraction: Math.max(0, Math.min(1, remaining / total)),
    color: 'accent',
  }
}

/** Libellé court au centre de l'anneau (« 1h14 », « 24 min », « 22h→8h »). */
export function ringLabel(rule: BlockRuleView, now = new Date()): string {
  if (rule.type === 'daily_limit') {
    const lim = num(rule.config?.limit_min, 60)
    return lim >= 60
      ? `${Math.floor(lim / 60)}h${lim % 60 ? String(lim % 60).padStart(2, '0') : ''}`
      : `${lim}m`
  }
  if (rule.type === 'schedule') {
    const end = num(rule.config?.end_hour, 8)
    return `${end}h`
  }
  const end = blockEndDate(rule)
  if (!end) return ''
  const rem = Math.max(0, Math.round((end.getTime() - now.getTime()) / 60_000))
  if (rem >= 60)
    return `${Math.floor(rem / 60)}h${String(rem % 60).padStart(2, '0')}`
  return `${rem}m`
}

function durationLabel(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h === 0) return `${m} min`
  if (m === 0) return `${h} h`
  return `${h} h ${String(m).padStart(2, '0')}`
}
