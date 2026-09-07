/**
 * FILE: credentials.ts
 * LAYER: infra/storage
 * ---------------------------------------------------------------------
 * Les deux jetons porteurs de la couche HTTP (`auth.token`, `auth.refreshToken`),
 * rangés dans le trousseau matériel plutôt que sur MMKV.
 *
 * POURQUOI CE FICHIER EXISTE
 * `AuthService.persist()` recopiait l'`access_token` ET le `refresh_token`
 * Supabase en clair dans MMKV pour que `auth.interceptor` puisse en faire un
 * en-tête `Authorization`. C'était une SECONDE copie en clair des identifiants,
 * indépendante de la session Supabase elle-même : sécuriser l'une sans l'autre
 * n'aurait rien changé au risque, puisque le refresh token — celui qui se rejoue
 * indéfiniment — se trouvait dans les deux.
 *
 * Passer par ici plutôt que par `kvStorage` est donc la règle pour tout ce qui
 * est un identifiant. Le reste (préférences, drapeaux, caches) reste sur MMKV :
 * chaque lecture du trousseau est un appel système synchrone, et il n'y a rien
 * à protéger dans un booléen d'onboarding.
 * ---------------------------------------------------------------------
 */
import { constants } from '@/config/constants'
import { kvStorage } from '@/shared/services/storage/mmkv'
import {
  secureGetItem,
  secureRemoveItem,
  secureSetItem,
} from '@/shared/services/storage/secure-store'

/** Les seules clés qui transitent par le trousseau côté HTTP. */
const CREDENTIAL_KEYS = [constants.AUTH_TOKEN, constants.REFRESH_TOKEN] as const

/**
 * Lit un identifiant, en reprenant au passage la valeur laissée en clair par
 * une version antérieure de l'app.
 *
 * L'effacement de la copie MMKV n'a lieu QUE si le trousseau a accepté la
 * reprise : échouer des deux côtés déconnecterait l'utilisateur au lieu de le
 * protéger.
 */
function readCredential(key: string): string | null {
  const stored = secureGetItem(key)
  if (stored !== null) return stored

  const legacy = kvStorage.getString(key)
  if (legacy === null) return null

  if (secureSetItem(key, legacy)) kvStorage.delete(key)
  return legacy
}

function writeCredential(key: string, value: string): void {
  secureSetItem(key, value)
  // Filet : si une version antérieure avait laissé la même clé sur MMKV, la
  // nouvelle écriture ne l'aurait pas recouverte.
  kvStorage.delete(key)
}

export function getAuthToken(): string | null {
  return readCredential(constants.AUTH_TOKEN)
}

export function setAuthToken(token: string): void {
  writeCredential(constants.AUTH_TOKEN, token)
}

export function getRefreshToken(): string | null {
  return readCredential(constants.REFRESH_TOKEN)
}

export function setRefreshToken(token: string): void {
  writeCredential(constants.REFRESH_TOKEN, token)
}

/** Efface les identifiants des DEUX emplacements. Appelé à la déconnexion. */
export function clearCredentials(): void {
  for (const key of CREDENTIAL_KEYS) {
    secureRemoveItem(key)
    kvStorage.delete(key)
  }
}
