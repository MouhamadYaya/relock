import {
  findPreset,
  NEW_RULE_PRESET_IDS,
  NEW_RULE_PRESETS,
} from '@/features/blocking/presets'
import { isBlockingEditorType } from '@/features/blocking/types'

const configOf = (key: keyof typeof NEW_RULE_PRESET_IDS) => {
  const preset = findPreset(NEW_RULE_PRESET_IDS[key])
  if (!preset) throw new Error(`Preset missing: ${key}`)
  return preset
}

test('les trois types visuels ouvrent uniquement des types de configurateur valides', () => {
  expect(isBlockingEditorType('block_now')).toBe(true)
  expect(isBlockingEditorType('schedule')).toBe(true)
  expect(isBlockingEditorType('daily_limit')).toBe(true)
  expect(isBlockingEditorType('focus')).toBe(false)
  expect(isBlockingEditorType(undefined)).toBe(false)
})

test('les 12 cartes Nouvelle règle ont un preset unique et résolvable', () => {
  const ids = Object.values(NEW_RULE_PRESET_IDS)
  expect(ids).toHaveLength(12)
  expect(new Set(ids).size).toBe(12)
  expect(NEW_RULE_PRESETS).toHaveLength(12)
  for (const id of ids) expect(findPreset(id)?.id).toBe(id)
})

test('les horaires affichés par les cartes sont ceux réellement créés', () => {
  expect(configOf('work')).toMatchObject({
    type: 'schedule',
    config: { start_hour: 9, start_minute: 0, end_hour: 17, end_minute: 0 },
  })
  expect(configOf('focus')).toMatchObject({
    type: 'schedule',
    config: { start_hour: 14, start_minute: 0, end_hour: 15, end_minute: 0 },
  })
  expect(configOf('evening')).toMatchObject({
    type: 'schedule',
    config: { start_hour: 19, start_minute: 30, end_hour: 22, end_minute: 0 },
  })
  expect(configOf('family')).toMatchObject({
    type: 'schedule',
    config: { start_hour: 18, start_minute: 30, end_hour: 21, end_minute: 0 },
  })
  expect(configOf('doomscroll')).toMatchObject({
    type: 'daily_limit',
    config: { limit_min: 20 },
  })
})

test('les modèles semaine et week-end conservent leurs jours', () => {
  expect(configOf('work').config.days).toEqual([1, 2, 3, 4, 5])
  expect(configOf('study').config.days).toEqual([1, 2, 3, 4, 5])
  expect(configOf('weekend').config.days).toEqual([0, 6])
})

test('les nouveaux identifiants ne remplacent pas les presets historiques', () => {
  expect(findPreset('focus')).toMatchObject({
    type: 'progressive_delay',
    config: { duration_min: 25 },
  })
  expect(findPreset('weekend')).toMatchObject({
    type: 'schedule',
    config: { start_hour: 10, end_hour: 18 },
  })
})
