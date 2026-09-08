/**
 * FILE: imagekit.upload.ts
 * LAYER: shared/services/imagekit
 * ---------------------------------------------------------------------
 * Upload d'un fichier local vers ImageKit, en deux temps :
 *
 *   1. `imagekit-auth` (Edge Function Supabase) → { token, expire, signature }
 *      La PRIVATE KEY qui produit cette signature ne quitte jamais le serveur.
 *   2. POST multipart vers upload.imagekit.io avec ce triplet.
 *
 * Instance HTTP dédiée, jamais `httpClient` : ce dernier porte l'intercepteur
 * d'authentification de l'app, qui enverrait nos jetons de session à un tiers.
 * L'erreur est en revanche normalisée comme partout ailleurs.
 * ---------------------------------------------------------------------
 */

import { create } from 'apisauce'
import { translate } from '@/i18n/translate'
import { supabase } from '@/shared/services/supabase/client'
import { normalizeError } from '@/shared/utils/normalize-error'

const UPLOAD_URL = 'https://upload.imagekit.io/api/v1/files'
/** Un upload d'image sur réseau mobile dépasse largement le délai REST usuel. */
const UPLOAD_TIMEOUT_MS = 60_000

const uploadClient = create({
  baseURL: UPLOAD_URL,
  timeout: UPLOAD_TIMEOUT_MS,
  headers: { Accept: 'application/json' },
})

/** Autorisation d'upload à usage unique, délivrée par l'Edge Function. */
type UploadGrant = {
  token: string
  expire: number
  signature: string
  publicKey: string
  folder: string
}

export type ImageKitUploadInput = {
  /** URI locale du fichier (`file://…`), telle que fournie par le sélecteur. */
  uri: string
  /** Nom de base, extension comprise (`photo.jpg`). */
  fileName: string
  /** Défaut `image/jpeg`. */
  mimeType?: string
}

export type ImageKitUploadResult = {
  /** Chemin dans la médiathèque — c'est LUI qu'on persiste, pas l'URL. */
  filePath: string
  /** URL absolue non transformée. */
  url: string
  fileId: string
}

/** Réponse d'upload ImageKit, réduite aux champs que l'on consomme. */
type ImageKitUploadResponse = {
  filePath?: string
  url?: string
  fileId?: string
}

async function requestGrant(): Promise<UploadGrant> {
  const { data, error } = await supabase.functions.invoke<UploadGrant>(
    'imagekit-auth',
    { method: 'POST' },
  )
  if (error || !data?.signature) {
    throw normalizeError(error ?? new Error(translate('errors.upload_denied')))
  }
  return data
}

/**
 * Envoie un fichier local et renvoie son emplacement définitif.
 * @throws NormalizedError si l'autorisation ou l'upload échoue.
 */
export async function uploadToImageKit(
  input: ImageKitUploadInput,
): Promise<ImageKitUploadResult> {
  const grant = await requestGrant()

  const form = new FormData()
  // React Native sérialise cet objet en pièce jointe multipart.
  form.append('file', {
    uri: input.uri,
    name: input.fileName,
    type: input.mimeType ?? 'image/jpeg',
  } as unknown as Blob)
  form.append('fileName', input.fileName)
  form.append('folder', grant.folder)
  form.append('publicKey', grant.publicKey)
  form.append('signature', grant.signature)
  form.append('expire', String(grant.expire))
  form.append('token', grant.token)
  /**
   * Nom unique par upload, à dessein. Écraser un chemin fixe laisserait les
   * caches CDN servir l'ancienne image pendant des heures — le nouvel avatar
   * semblerait ne pas s'être enregistré. Le prix est une accumulation lente
   * dans `avatars/<uid>/`, à purger côté serveur si elle devient gênante.
   */
  form.append('useUniqueFileName', 'true')

  const res = await uploadClient.post<ImageKitUploadResponse>('/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })

  if (!res.ok || !res.data?.filePath || !res.data.url) {
    throw normalizeError(
      res.originalError ?? new Error(translate('errors.upload_failed')),
    )
  }

  return {
    filePath: res.data.filePath,
    url: res.data.url,
    fileId: res.data.fileId ?? '',
  }
}
