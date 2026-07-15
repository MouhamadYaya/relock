/**
 * UUID v4 généré côté client (sans dépendance native).
 * Sert d'id de règle AVANT l'insert Supabase, pour lier la mécanique
 * native (activité DeviceActivity, sélection App Group) à la ligne DB.
 * L'aléa de Math.random suffit ici : unicité par utilisateur, pas de crypto.
 */
export function genUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.floor(Math.random() * 16)
    const v = c === 'x' ? r : 8 + (r % 4) // y ∈ {8, 9, a, b} (variante RFC 4122)
    return v.toString(16)
  })
}
