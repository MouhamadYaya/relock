/** The same three promises appear during preparation and on the final plan. */
export const ANTI_SCROLL_PLAN = [
  {
    id: 'block',
    title: 'Bloque les distractions',
    detail: 'Les apps qui te font perdre le fil.',
    preparing: 'Préparation de tes blocages…',
  },
  {
    id: 'pause',
    title: 'Casse le réflexe',
    detail: 'Une pause avant de replonger.',
    preparing: 'Mise en place des pauses…',
  },
  {
    id: 'progress',
    title: 'Vois tes progrès',
    detail: 'Ton temps d’écran, jour après jour.',
    preparing: 'Préparation du suivi quotidien…',
  },
] as const
