import React, { useEffect, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import {
  BlockedAppIcons,
  isBlockedAppIconsAvailable,
} from '@/shared/native/BlockedAppIcons'
import { ScreenTime } from '@/shared/native/screen-time'
import { relockMaterial } from '@/shared/theme'
import { fonts } from '@/shared/theme/tokens/fonts'
import { spacing } from '@/shared/theme/tokens/spacing'

const { colors, typography } = relockMaterial

/** Jamais plus de deux vignettes : au-delà on compte, on n'entasse pas. */
const MAX_VISIBLE = 2

/**
 * Les apps d'une règle, en VRAIES icônes : jusqu'à deux vignettes, puis « +N ».
 *
 * Le nombre vient du NATIF (`selectionInfo`), jamais de la ligne DB : c'est la
 * seule source qui sait combien de jetons `applicationToken` la règle porte, et
 * c'est ce même rang qui sert à dessiner chaque icône. Compter d'un côté et
 * dessiner de l'autre produisait des vignettes vides.
 */
export function RuleAppIcons({
  ruleId,
  size = spacing.xl,
}: {
  ruleId: string
  size?: number
}) {
  const [keys, setKeys] = useState<string[]>([])
  const [others, setOthers] = useState(0)

  useEffect(() => {
    let cancelled = false
    if (!ScreenTime.isAvailable) return
    Promise.all([ScreenTime.appKeys(ruleId), ScreenTime.selectionInfo(ruleId)])
      .then(([appKeys, info]) => {
        if (cancelled) return
        setKeys(appKeys)
        // Catégories et domaines n'ont pas de vignette dédiée ici : ils
        // gonflent le « +N » pour que le total reste honnête.
        setOthers(info.categories + info.webDomains)
      })
      .catch(() => {
        // Sélection illisible : on n'invente aucune icône.
      })
    return () => {
      cancelled = true
    }
  }, [ruleId])

  const shown = keys.slice(0, MAX_VISIBLE)
  const visible = shown.length
  const extra = keys.length - visible + others
  if (visible === 0 && extra === 0) return null

  const tile = { width: size, height: size, borderRadius: size * 0.24 }
  return (
    <View style={styles.row}>
      {shown.map(key => (
        <View key={key} style={[styles.tile, tile]}>
          {isBlockedAppIconsAvailable ? (
            <BlockedAppIcons tokenKey={key} style={StyleSheet.absoluteFill} />
          ) : null}
        </View>
      ))}
      {extra > 0 ? (
        <View
          style={[styles.extra, { height: size, borderRadius: size * 0.24 }]}
        >
          <Text style={styles.extraText}>+{extra}</Text>
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  tile: {
    overflow: 'hidden',
    backgroundColor: colors.blockingSurfaceRaised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.blockingBorder,
  },
  extra: {
    minWidth: spacing.xxxl,
    paddingHorizontal: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.blockingPill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.blockingBorder,
  },
  extraText: {
    ...fonts.medium,
    color: colors.textPrimary,
    fontSize: typography.blockingMetaSize,
    lineHeight: typography.blockingMetaLineHeight,
    fontVariant: ['tabular-nums'],
  },
})
