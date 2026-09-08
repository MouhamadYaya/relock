import React from 'react'
import { Image, StyleSheet } from 'react-native'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { AppIconPreview } from '@/shared/components/ui/AppIconPreview'
import type { AppLogo } from '@/shared/constants/app-logo'

// Le registre de modules rend le MÊME objet au test qu'au composant : la
// comparaison porte donc sur l'asset réellement embarqué, pas sur un chemin.
const CLASSIC = require('@assets/logo-classic.png')
const ORB = require('@assets/logo-orb.png')
const PHASES = require('@assets/logo-phases.png')

const SIZE = 34

let mounted: ReactTestRenderer | null = null

function render(logo: AppLogo) {
  act(() => {
    mounted = create(<AppIconPreview logo={logo} size={SIZE} />)
  })
  const image = (mounted as unknown as ReactTestRenderer).root.findByType(Image)
  return {
    source: image.props.source,
    accessible: image.props.accessible,
    style: StyleSheet.flatten(image.props.style) as {
      width: number
      height: number
      borderRadius: number
    },
  }
}

describe('AppIconPreview', () => {
  afterEach(() => {
    act(() => mounted?.unmount())
    mounted = null
  })

  it.each([
    ['classic', CLASSIC],
    ['orb', ORB],
    ['phases', PHASES],
  ] as const)('dessine la marque « %s »', (logo, expected) => {
    const { source, style } = render(logo)

    expect(source).toBe(expected)
    // Carrée et arrondie : la ligne montre une ICÔNE, pas une image.
    expect(style.width).toBe(SIZE)
    expect(style.height).toBe(SIZE)
    expect(style.borderRadius).toBeGreaterThan(0)
  })

  it('retombe sur l’icône d’origine pour une variante inconnue', () => {
    // Une préférence écrite par une version plus récente, puis rétrogradée.
    expect(render('supernova' as AppLogo).source).toBe(CLASSIC)
  })

  it('reste décoratif tant qu’aucun libellé n’est fourni', () => {
    // La rangée qui l'accueille porte déjà le nom de l'icône : un second
    // élément accessible ferait répéter la même chose à VoiceOver.
    expect(render('orb').accessible).toBe(false)
  })
})
