/**
 * Destination d'ouverture quand le mur système a tapé « Ouvrir Relock ».
 *
 * Régression vécue : l'app démarrait à froid sur « / », et `app/index.tsx` y
 * rendait un `<Redirect>` vers l'accueil. Cette redirection — rejouée à chaque
 * changement de `onboardingDone` — écrasait la destination du mur, et
 * l'utilisateur atterrissait sur le menu de Relock au lieu de l'onglet
 * Blocages. La demande étant lue de façon DESTRUCTIVE côté natif, elle était
 * alors perdue sans recours.
 */
import React from 'react'
import { act, create } from 'react-test-renderer'

const redirects: string[] = []

jest.mock('expo-router', () => ({
  Redirect: ({ href }: { href: string }) => {
    redirects.push(href)
    return null
  },
}))

import { useAppGateStore } from '@/shared/stores/app-gate.store'
import { setShieldRequest } from '@/shared/stores/shield-request.store'
import Index from '../app/index'

const shieldRequest = {
  id: 'req-1',
  applicationKey: 'jeton-discord',
  applicationName: 'Discord',
  requestedAt: Date.now() / 1000,
}

// Chaque rendu est démonté aussitôt : un arbre laissé monté se re-rend au
// prochain changement de store et rejouerait sa redirection dans le relevé.
function renderIndex(): string[] {
  let tree: ReturnType<typeof create> | undefined
  act(() => {
    tree = create(<Index />)
  })
  act(() => {
    tree?.unmount()
  })
  return redirects
}

beforeEach(() => {
  redirects.length = 0
  setShieldRequest(null)
  useAppGateStore.setState({ onboardingDone: true })
})

describe('redirection racine', () => {
  it('vise l’onglet Blocages quand le mur a demandé Relock', () => {
    setShieldRequest(shieldRequest)
    expect(renderIndex()).toEqual(['/(tabs)/blocks'])
  })

  it('vise l’accueil quand aucune demande n’est en attente', () => {
    expect(renderIndex()).toEqual(['/(tabs)/home'])
  })

  it('l’onboarding reste prioritaire sur une demande du mur', () => {
    useAppGateStore.setState({ onboardingDone: false })
    setShieldRequest(shieldRequest)
    expect(renderIndex()).toEqual(['/onboarding'])
  })
})
