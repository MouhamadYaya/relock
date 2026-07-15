/**
 * Textes des notifications — ton BIENVEILLANT & SOBRE : calme, encourageant,
 * adulte, jamais culpabilisant. Les notifs « bilan » restent génériques et
 * renvoient vers l'app (les vrais chiffres sont calculés à l'ouverture, jamais
 * figés dans une notif planifiée à l'avance).
 */
export const NotifContent = {
  streakRisk: (streak: number) => ({
    title: 'Ta série tient à un geste',
    body:
      streak > 1
        ? `${streak} jours de suite. Arme un blocage ce soir pour ne pas la casser.`
        : 'Arme un blocage ce soir pour lancer ta série.',
  }),
  weekly: () => ({
    title: 'Ton bilan de la semaine est prêt',
    body: 'Ouvre Relock pour voir le temps que tu as regagné cette semaine.',
  }),
  winback: () => ({
    title: 'On reprend le contrôle ?',
    body: 'Tes apps peuvent attendre. Un blocage rapide, et tu retrouves ton temps.',
  }),
}
