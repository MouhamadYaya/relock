import React from 'react'
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Path,
  Rect,
  Stop,
} from 'react-native-svg'
import { OB } from '../tokens'

/**
 * Les trois vignettes de la feuille « Soutenu par la science ».
 *
 * Elles ne DÉCORENT pas les paragraphes, elles les remplacent : chacune dessine
 * le mécanisme dont il est question, et c'est ce qui a permis de ramener chaque
 * point à une seule phrase. Un dessin dit « le geste s'arrête avant le
 * contenu » plus vite que trois lignes.
 *
 * Dessinées ici plutôt que tirées d'`assets/icons.ts` pour la même raison que
 * les glyphes de `scenes-intro` : ce sont des schémas, pas des icônes
 * d'interface, et ils portent le dégradé signature.
 *
 * ⚠️ Les identifiants de dégradé SVG peuvent fuiter d'un `<Svg>` à l'autre
 * selon la plateforme — un `id="grad"` générique se ferait recouvrir par
 * celui d'un autre écran, sans erreur ni trace. D'où le préfixe `sci`. Que
 * les trois vignettes partagent ce même identifiant est en revanche voulu :
 * la définition est identique, se recouvrir entre elles est sans effet.
 */

const SIZE = 64

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <Svg width={SIZE} height={SIZE} viewBox="0 0 64 64">
      <Defs>
        <LinearGradient id="sciStroke" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor={OB.grad[0]} />
          <Stop offset="55%" stopColor={OB.grad[1]} />
          <Stop offset="100%" stopColor={OB.grad[2]} />
        </LinearGradient>
      </Defs>
      {children}
    </Svg>
  )
}

/** Le geste part, et s'arrête net avant le contenu. */
export function MarkDelay() {
  return (
    <Frame>
      {/* Le contenu convoité, en retrait derrière la barrière. */}
      <Rect
        x={41}
        y={15}
        width={17}
        height={34}
        rx={5.5}
        fill="rgba(164,154,254,0.12)"
        stroke="rgba(164,154,254,0.30)"
        strokeWidth={1.4}
      />
      {/* Le geste : une lancée qui s'interrompt. */}
      <Circle cx={9} cy={32} r={3} fill={OB.accent} />
      <Path
        d="M14 32 H27"
        stroke={OB.accent}
        strokeWidth={2.4}
        strokeLinecap="round"
      />
      <Path
        d="M23.5 27.5 L28.5 32 L23.5 36.5"
        stroke={OB.accent}
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* La pause. Elle ne bloque pas le contenu, elle précède le geste. */}
      <Rect x={33} y={9} width={4} height={46} rx={2} fill="url(#sciStroke)" />
    </Frame>
  )
}

/** Déclencheur → geste → récompense, et le maillon qui manque. */
export function MarkLoop() {
  return (
    <Frame>
      {/* L'anneau ouvert : 300°, la trouée là où la récompense n'arrive plus. */}
      <Path
        d="M49.5 22 A20 20 0 1 1 32 12"
        stroke="url(#sciStroke)"
        strokeWidth={3.4}
        strokeLinecap="round"
        fill="none"
      />
      {/* Les deux temps qui restent. */}
      <Circle cx={49.3} cy={41.3} r={3.6} fill={OB.grad[2]} />
      <Circle cx={14.7} cy={41.3} r={3.6} fill={OB.grad[0]} />
      {/* Le troisième, éteint : la récompense retirée. */}
      <Circle
        cx={41.5}
        cy={16.6}
        r={3.6}
        fill="none"
        stroke="rgba(235,235,245,0.30)"
        strokeWidth={1.6}
        strokeDasharray="2.6 2.6"
      />
    </Frame>
  )
}

/** Ce que la coupure semble coûter, et ce qu'elle coûte vraiment. */
export function MarkCost() {
  return (
    <Frame>
      {/* La coupure elle-même : courte, et c'est tout ce qu'on en voit. */}
      <Rect
        x={7}
        y={20}
        width={17}
        height={7}
        rx={3.5}
        fill="url(#sciStroke)"
      />
      {/* Sa facture : la même coupure, plus le temps de revenir. */}
      <Rect
        x={7}
        y={37}
        width={50}
        height={7}
        rx={3.5}
        fill="rgba(164,154,254,0.28)"
      />
      <Rect
        x={7}
        y={37}
        width={17}
        height={7}
        rx={3.5}
        fill="url(#sciStroke)"
      />
      {/* Le repère qui relie les deux : la partie invisible commence là. */}
      <Path
        d="M24.5 27 V37"
        stroke="rgba(235,235,245,0.42)"
        strokeWidth={1.4}
        strokeLinecap="round"
        strokeDasharray="2.4 2.6"
      />
    </Frame>
  )
}
