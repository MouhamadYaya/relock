/**
 * FILE: secure-store.ts
 * LAYER: infra/storage
 * ---------------------------------------------------------------------
 * Trousseau matériel (Keychain iOS / Keystore Android) pour les seules valeurs
 * qui sont des IDENTIFIANTS — aujourd'hui la session Supabase.
 *
 * POURQUOI CE FICHIER EXISTE
 * MMKV écrit un fichier mappé en mémoire dans le conteneur de l'app, sans
 * chiffrement tant qu'aucune `encryptionKey` ne lui est donnée — ce qui est le
 * cas ici. Un `strings` sur ce fichier rend ses valeurs telles quelles. Y
 * laisser la session Supabase revenait à poser le REFRESH TOKEN en clair sur le
 * disque : ce jeton-là ne périme pas comme l'access token, il se rejoue
 * indéfiniment (`autoRefreshToken: true`), et il ouvre l'intégralité du compte —
 * date de naissance, règles de blocage, réponses d'onboarding sur les
 * déclencheurs d'addiction. Une extraction forensique, une sauvegarde non
 * chiffrée ou un appareil jailbreaké suffisaient.
 *
 * `.claude/rules/security.md` le dit déjà : « Tokens and credentials: Keychain
 * (iOS) / Keystore (Android) only. » Ce module applique la règle.
 *
 * CE QU'IL NE FAIT PAS
 * Il ne remplace pas MMKV. Les préférences, les drapeaux d'onboarding et les
 * caches restent où ils sont : ce ne sont pas des identifiants, et les faire
 * transiter par le trousseau coûterait un appel système synchrone par lecture
 * au démarrage sans rien protéger de sensible.
 * ---------------------------------------------------------------------
 */
import * as SecureStore from 'expo-secure-store'

/**
 * Accessibilité de l'entrée, et ce choix mérite ses trois lignes.
 *
 * `AFTER_FIRST_UNLOCK` plutôt que `WHEN_UNLOCKED` : Supabase rafraîchit le
 * jeton en tâche de fond, y compris écran verrouillé. Avec `WHEN_UNLOCKED` cette
 * lecture échouerait et déconnecterait l'utilisateur.
 *
 * `THIS_DEVICE_ONLY` : l'entrée ne part ni dans le trousseau iCloud, ni dans une
 * sauvegarde restaurée sur un autre téléphone. Un jeton d'authentification n'a
 * aucune raison de voyager — et une sauvegarde chiffrée avec un mot de passe
 * faible redeviendrait le maillon faible qu'on vient justement de supprimer.
 */
const ACCESSIBLE = SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY
const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: ACCESSIBLE,
}

/**
 * Découpage en morceaux : le trousseau plafonne une valeur à 2048 OCTETS, et une
 * session Supabase (deux JWT + l'objet utilisateur) dépasse régulièrement ce
 * seuil. La taille est comptée en CARACTÈRES, pas en octets, et volontairement
 * basse : un caractère UTF-8 pèse jusqu'à 4 octets, donc 480 caractères tiennent
 * dans 1920 octets même dans le pire cas — un pseudo entièrement en emoji.
 * Découper sur les octets obligerait à recoller les paires de substitution à la
 * lecture ; découper sur les caractères l'évite entièrement.
 */
const CHUNK_CHARS = 480

/** Clé du morceau numéro `index`. Le trousseau accepte `.` dans les clés. */
function chunkKey(key: string, index: number): string {
  return `${key}.${index}`
}

/**
 * Efface une entrée sans bloquer.
 *
 * `expo-secure-store` n'expose PAS de suppression synchrone (`getItem` et
 * `setItem` en ont une, pas `deleteItemAsync`). Une suppression est donc
 * toujours différée — d'où le marqueur écrit, lui, de façon synchrone par
 * `secureRemoveItem` : la valeur cesse d'être lisible immédiatement, et le
 * ménage des entrées suit. L'échec est avalé volontairement : une entrée déjà
 * absente n'est pas une erreur, et rien d'utile ne peut se produire ici.
 */
function forget(key: string): void {
  SecureStore.deleteItemAsync(key, OPTIONS).catch(() => {})
}

/**
 * Nombre de morceaux écrits sous `key`, ou `null` si la clé est absente.
 * `NaN` signalerait une valeur écrite avant ce module (format non découpé).
 */
function readChunkCount(key: string): number | null {
  const head = SecureStore.getItem(key, OPTIONS)
  if (head === null) return null
  const count = Number.parseInt(head, 10)
  return Number.isInteger(count) && count >= 0 ? count : Number.NaN
}

/**
 * Lit une valeur, `null` si absente.
 *
 * Un morceau manquant fait renvoyer `null` plutôt qu'une chaîne tronquée : une
 * session à moitié lue produirait un JSON invalide, et donc une erreur opaque
 * loin d'ici. Mieux vaut « pas de session » — l'utilisateur se reconnecte.
 */
export function secureGetItem(key: string): string | null {
  try {
    const count = readChunkCount(key)
    if (count === null) return null

    // Valeur écrite hors de ce module (ou format hérité) : rendue telle quelle.
    if (Number.isNaN(count)) return SecureStore.getItem(key, OPTIONS)

    // Zéro morceau = marqueur posé par `secureRemoveItem`. La valeur est
    // supprimée du point de vue de l'appelant, même si le ménage des entrées
    // n'est pas encore terminé. Une valeur vide, elle, s'écrit sur UN morceau.
    if (count === 0) return null

    const parts: string[] = []
    for (let i = 0; i < count; i++) {
      const part = SecureStore.getItem(chunkKey(key, i), OPTIONS)
      if (part === null) return null
      parts.push(part)
    }
    return parts.join('')
  } catch (e) {
    console.error('[secure-store] lecture impossible:', e)
    return null
  }
}

/** Écrit une valeur, en la découpant. Renvoie `false` si le trousseau refuse. */
export function secureSetItem(key: string, value: string): boolean {
  try {
    // Les morceaux de l'ancienne valeur AVANT d'écrire la nouvelle : une valeur
    // plus courte laisserait sinon traîner la fin de la précédente, que la
    // relecture recollerait silencieusement.
    const previous = readChunkCount(key)

    const chunks: string[] = []
    for (let i = 0; i < value.length; i += CHUNK_CHARS) {
      chunks.push(value.slice(i, i + CHUNK_CHARS))
    }
    // Une chaîne vide reste une valeur présente : un seul morceau, vide.
    if (chunks.length === 0) chunks.push('')

    for (const [index, chunk] of chunks.entries()) {
      SecureStore.setItem(chunkKey(key, index), chunk, OPTIONS)
    }
    SecureStore.setItem(key, String(chunks.length), OPTIONS)

    if (previous !== null && !Number.isNaN(previous)) {
      for (let i = chunks.length; i < previous; i++) {
        forget(chunkKey(key, i))
      }
    }
    return true
  } catch (e) {
    console.error('[secure-store] écriture impossible:', e)
    return false
  }
}

/**
 * Supprime une valeur et tous ses morceaux.
 *
 * Le marqueur `'0'` est posé SYNCHRONIQUEMENT et en premier : c'est lui qui rend
 * la valeur illisible dès le retour de la fonction. Sans lui, une déconnexion
 * suivie d'un plantage immédiat laisserait la session relisible au redémarrage,
 * puisque les suppressions réelles, elles, sont forcément asynchrones.
 */
export function secureRemoveItem(key: string): void {
  try {
    const count = readChunkCount(key)
    if (count === null) return

    SecureStore.setItem(key, '0', OPTIONS)

    if (!Number.isNaN(count)) {
      for (let i = 0; i < count; i++) forget(chunkKey(key, i))
    }
    forget(key)
  } catch (e) {
    console.error('[secure-store] suppression impossible:', e)
  }
}
