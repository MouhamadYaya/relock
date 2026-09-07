/**
 * FILE: imagekit.url.ts
 * LAYER: shared/services/imagekit
 * ---------------------------------------------------------------------
 * Construit les URLs ImageKit avec transformation à la volée.
 *
 * Principe : une seule image est stockée ; chaque variante (taille, qualité,
 * format) est demandée par paramètre d'URL et rendue par le CDN. On n'upload
 * donc jamais de vignette, et un écran ne télécharge jamais un original de
 * 4 000 px pour l'afficher dans 40 points.
 *
 *   buildImageKitUrl('avatars/u_42.jpg', { width: 48, height: 48, focus: 'face' })
 *   → https://ik.imagekit.io/<id>/avatars/u_42.jpg?tr=w-144,h-144,fo-face,q-80,f-auto
 *     (144 = 48 pt × dpr 3 — on demande des PIXELS, pas des points)
 *
 * Dégradation : sans `IMAGEKIT_URL_ENDPOINT`, et pour toute URL absolue
 * étrangère au compte, l'entrée est renvoyée telle quelle. L'app fonctionne
 * donc identiquement avec l'intégration désactivée.
 * ---------------------------------------------------------------------
 */

import { PixelRatio } from 'react-native'
import { env } from '@/config/env'

/** Mode de recadrage ImageKit (`c-` / `cm-`). */
export type ImageKitCrop =
  | 'maintain_ratio'
  | 'pad_resize'
  | 'force'
  | 'at_max'
  | 'at_least'

/** Point d'intérêt conservé quand l'image est recadrée (`fo-`). */
export type ImageKitFocus =
  | 'auto'
  | 'face'
  | 'center'
  | 'top'
  | 'bottom'
  | 'left'
  | 'right'

export type ImageKitTransform = {
  /** Largeur d'affichage en POINTS (unité RN). Convertie en pixels via `dpr`. */
  width?: number
  /** Hauteur d'affichage en POINTS. */
  height?: number
  crop?: ImageKitCrop
  focus?: ImageKitFocus
  /** 1–100. Défaut 80 : seuil où la perte cesse d'être perceptible. */
  quality?: number
  /** `auto` laisse ImageKit servir AVIF/WebP selon le navigateur/OS. */
  format?: 'auto' | 'webp' | 'jpg' | 'png'
  /** Rayon d'arrondi, ou `max` pour un cercle parfait. */
  radius?: number | 'max'
  blur?: number
  /**
   * Densité de l'écran. Défaut : celle de l'appareil. Un iPhone en @3x reçoit
   * ainsi une image 3× plus définie qu'un écran @1x, sans changer le layout.
   */
  dpr?: number
}

const DEFAULT_QUALITY = 80
/** Au-delà, le poids explose sans gain visible ; sécurise aussi un dpr aberrant. */
const MAX_DPR = 3

/** True quand l'endpoint ImageKit est renseigné dans `.env`. */
export function isImageKitConfigured(): boolean {
  return env.IMAGEKIT_URL_ENDPOINT.length > 0
}

function resolveDpr(dpr?: number): number {
  const raw = dpr ?? PixelRatio.get()
  if (!Number.isFinite(raw) || raw <= 0) {
    return 1
  }
  return Math.min(Math.ceil(raw), MAX_DPR)
}

/** Sérialise les options en chaîne `tr=` ImageKit. Vide si rien à appliquer. */
export function buildTransformString(transform: ImageKitTransform): string {
  const parts: string[] = []
  const dpr = resolveDpr(transform.dpr)

  if (transform.width != null) {
    parts.push(`w-${Math.round(transform.width * dpr)}`)
  }
  if (transform.height != null) {
    parts.push(`h-${Math.round(transform.height * dpr)}`)
  }
  if (transform.crop != null) {
    // `maintain_ratio` et `pad_resize` sont des modes (cm-), les autres des crops (c-).
    const prefix =
      transform.crop === 'maintain_ratio' || transform.crop === 'pad_resize'
        ? 'cm'
        : 'c'
    parts.push(`${prefix}-${transform.crop}`)
  }
  if (transform.focus != null) {
    parts.push(`fo-${transform.focus}`)
  }
  if (transform.radius != null) {
    parts.push(`r-${transform.radius}`)
  }
  if (transform.blur != null) {
    parts.push(`bl-${transform.blur}`)
  }

  if (parts.length === 0) {
    return ''
  }

  // Qualité et format ne sont ajoutés que si l'image est déjà transformée :
  // sinon on paierait une recompression pour rien.
  parts.push(`q-${transform.quality ?? DEFAULT_QUALITY}`)
  parts.push(`f-${transform.format ?? 'auto'}`)
  return parts.join(',')
}

/**
 * URL absolue vers une image ImageKit, transformations appliquées.
 *
 * @param source Chemin dans la médiathèque (`avatars/u_42.jpg`) OU URL absolue
 *   déjà servie par le compte. Toute autre URL absolue est renvoyée intacte.
 * @returns L'URL transformée, ou `source` si ImageKit n'est pas configuré.
 */
export function buildImageKitUrl(
  source: string,
  transform: ImageKitTransform = {},
): string {
  const trimmed = source.trim()
  const endpoint = env.IMAGEKIT_URL_ENDPOINT

  if (trimmed.length === 0 || endpoint.length === 0) {
    return trimmed
  }

  let filePath: string
  if (/^https?:\/\//i.test(trimmed)) {
    if (!trimmed.startsWith(`${endpoint}/`)) {
      // Image hébergée ailleurs (Google, Apple…) : on ne la réécrit pas.
      return trimmed
    }
    // On repart du chemin nu pour ne pas empiler deux jeux de transformations.
    filePath = trimmed.slice(endpoint.length + 1).split('?')[0]
  } else {
    filePath = trimmed.replace(/^\/+/, '')
  }

  const tr = buildTransformString(transform)
  const base = `${endpoint}/${filePath}`
  return tr.length > 0 ? `${base}?tr=${tr}` : base
}

/** Réglage prêt à l'emploi pour une photo de profil ronde. */
export function buildAvatarUrl(source: string, sizeInPoints: number): string {
  return buildImageKitUrl(source, {
    width: sizeInPoints,
    height: sizeInPoints,
    crop: 'force',
    // `face` recadre sur le visage : un portrait mal cadré reste utilisable.
    focus: 'face',
  })
}
