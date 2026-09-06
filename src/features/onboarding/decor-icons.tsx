/**
 * Figurants de maquette du tutoriel : marques et pictogrammes système qu'on
 * dessine nous-mêmes.
 *
 * Ils vivent ICI et pas dans `AppLogo` à dessein : `AppLogo` est le registre
 * des marques que l'app sait réellement cibler. Y ajouter Facebook ou une
 * catégorie Temps d'écran laisserait croire qu'on peut les bloquer nommément
 * — or Apple ne rend qu'un jeton opaque, jamais une identité d'app.
 */
import React from 'react'
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Path,
  Rect,
  Stop,
} from 'react-native-svg'

export function FacebookIcon({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Rect width={48} height={48} rx={12} fill="#1877F2" />
      <Path
        d="M30.2 25.6l.8-5.2h-5v-3.4c0-1.4.7-2.8 3-2.8h2.3V9.8s-2.1-.4-4.1-.4c-4.2 0-6.9 2.5-6.9 7.1v4h-4.6v5.2h4.6V38h5.7V25.6h4.2z"
        fill="#FFFFFF"
      />
    </Svg>
  )
}

export function PhoneIcon({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Defs>
        <LinearGradient id="tutoPhone" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#5DF07B" />
          <Stop offset="1" stopColor="#12CB4A" />
        </LinearGradient>
      </Defs>
      <Rect width={48} height={48} rx={12} fill="url(#tutoPhone)" />
      <Path
        d="M18.4 12.5c-.9-.9-2.3-.9-3.1 0l-2.1 2.1c-1.1 1.1-1.3 2.8-.5 4.1 4 6.6 9.5 12.1 16.1 16.1 1.3.8 3 .6 4.1-.5l2.1-2.1c.9-.9.9-2.3 0-3.1l-3.7-3.7c-.9-.9-2.3-.9-3.1 0l-1.5 1.5c-2.6-1.7-4.8-3.9-6.5-6.5l1.5-1.5c.9-.9.9-2.3 0-3.1l-3.3-3.3z"
        fill="#FFFFFF"
      />
    </Svg>
  )
}

export function CalculatorIcon({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Rect width={48} height={48} rx={12} fill="#1C1C1E" />
      <Rect x={8} y={7} width={32} height={8} rx={2} fill="#3A3A3C" />
      {[0, 1, 2].map(col =>
        [0, 1, 2].map(row => (
          <Circle
            key={`k${col}-${row}`}
            cx={12 + col * 8.5}
            cy={22 + row * 7.5}
            r={2.7}
            fill="#5A5A5E"
          />
        )),
      )}
      <Rect x={31} y={19} width={6} height={21} rx={3} fill="#FF9500" />
    </Svg>
  )
}

/**
 * « Toutes apps et catégories » : les trois plaques empilées d'Apple. Seul
 * pictogramme de la feuille qui ne soit pas un emoji — d'où ce tracé.
 */
export function AllAppsGlyph({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32">
      <Path d="M16 4 29 11l-13 7L3 11 16 4z" fill="#4DA3F5" />
      <Path
        d="M16 17.4 26.4 12 29 13.4l-13 7-13-7L5.6 12 16 17.4z"
        fill="#E8543F"
      />
      <Path
        d="M16 22.9 26.4 17.5 29 18.9l-13 7-13-7 2.6-1.4L16 22.9z"
        fill="#F2B33D"
      />
    </Svg>
  )
}

/** « Social » : la bulle rose au cœur, doublée de la petite bulle bleue. */
export function SocialGlyph({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32">
      <Path
        d="M22.5 20.5c3-1.4 5-4 5-7C27.5 8.8 22.6 5 16.5 5S5.5 8.8 5.5 13.5c0 4.7 4.9 8.5 11 8.5.9 0 1.8-.1 2.6-.2l4.6 2.6-1.2-3.9z"
        fill="#F0417E"
      />
      <Path
        d="M14.7 11.8c-.7-.7-1.9-.7-2.6 0-.7.7-.7 1.9 0 2.6l4.4 4.4 4.4-4.4c.7-.7.7-1.9 0-2.6-.7-.7-1.9-.7-2.6 0l-1.8 1.8-1.8-1.8z"
        fill="#FFFFFF"
      />
      <Path
        d="M24.8 21.4c2.3 0 4.2 1.6 4.2 3.5 0 1.2-.7 2.2-1.8 2.8l.5 1.9-2.4-1.3h-.5c-2.3 0-4.2-1.6-4.2-3.4s1.9-3.5 4.2-3.5z"
        fill="#3DA5F4"
      />
    </Svg>
  )
}
