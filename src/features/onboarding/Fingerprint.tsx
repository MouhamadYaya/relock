/**
 * L'empreinte du sceau — le visuel fourni par le design, repeint par le
 * rituel.
 *
 * L'image d'origine est un dessin noir sur fond blanc. Elle est stockée
 * ici détourée ET inversée (traits BLANCS sur fond NOIR) : sous cette
 * forme, elle sert de **masque de luminance** SVG. Ce n'est pas un détour
 * gratuit — c'est ce qui permet de PEINDRE l'empreinte au lieu de
 * l'afficher :
 *
 * - le blanc du masque laisse passer la peinture, le noir la bloque ;
 * - on peint donc un rectangle plein à travers, et ce rectangle peut être
 *   un aplat (empreinte éteinte) comme le dégradé signature (empreinte
 *   scellée), sans jamais retoucher l'image.
 *
 * Un `<Image>` teinté n'aurait donné qu'une couleur unie : le dégradé
 * lavande → bleu glacier ne passe que par ce masque.
 */
import React from 'react'
import Svg, {
  Defs,
  LinearGradient,
  Mask,
  Rect,
  Stop,
  Image as SvgImage,
} from 'react-native-svg'
import { OB } from './tokens'

/** Le masque, aux trois densités. Traits blancs sur noir : voir l'en-tête. */
const FP_MASK = require('../../../assets/fingerprint-mask.png')

/**
 * Hauteur / largeur du dessin détouré (615 × 788 px), pour dimensionner la
 * marque à partir de sa seule largeur.
 */
export const FP_ASPECT = 788 / 615

type Tone = 'ghost' | 'live'

/**
 * La marque.
 *
 * - `ghost` : l'empreinte au repos, à peine posée sur le noir — elle
 *   invite sans éclairer.
 * - `live` : l'empreinte allumée, remplie du dégradé signature.
 *
 * Les deux se superposent dans le rituel, la seconde révélée par le bas.
 * Les identifiants SVG sont suffixés par le ton : deux racines `<Svg>` qui
 * déclarent le même `id` se marchent dessus.
 */
export function FingerprintMark({
  width,
  tone,
}: {
  width: number
  tone: Tone
}) {
  const height = width * FP_ASPECT
  const live = tone === 'live'
  const maskId = `fpMask-${tone}`
  const inkId = `fpInk-${tone}`

  return (
    <Svg width={width} height={height}>
      <Defs>
        <LinearGradient id={inkId} x1="50%" y1="100%" x2="50%" y2="0%">
          {/* Bleu glacier en bas, lavande au cœur : la lumière « refroidit »
              en montant, ce qui donne sa direction au remplissage. */}
          <Stop offset="0%" stopColor={OB.grad[2]} />
          <Stop offset="52%" stopColor={OB.grad[1]} />
          <Stop offset="100%" stopColor={OB.grad[0]} />
        </LinearGradient>
        <Mask id={maskId} maskUnits="userSpaceOnUse">
          <SvgImage
            href={FP_MASK}
            x={0}
            y={0}
            width={width}
            height={height}
            preserveAspectRatio="xMidYMid meet"
          />
        </Mask>
      </Defs>
      <Rect
        x={0}
        y={0}
        width={width}
        height={height}
        fill={live ? `url(#${inkId})` : OB.ink}
        fillOpacity={live ? 1 : 0.3}
        mask={`url(#${maskId})`}
      />
    </Svg>
  )
}
