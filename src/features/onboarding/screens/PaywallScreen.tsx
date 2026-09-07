import React, { useCallback, useEffect, useRef, useState } from 'react'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'
import { PaywallFlow } from '@/features/onboarding/components/paywall/PaywallFlow'
import {
  PREVIEW_OFFER,
  PREVIEW_PLANS,
} from '@/features/onboarding/components/paywall/paywall-preview'
import { SceneAuth } from '@/features/onboarding/scenes-auth'
import { saveOnboardingAnswers } from '@/features/onboarding/services/onboarding-answers.service'
import { readOnboardingCheckpoint } from '@/features/onboarding/services/onboarding-checkpoint'
import { countPaywallView } from '@/features/onboarding/services/paywall-views'
import {
  isRevenueCatEnabled,
  loadPaywallCatalog,
  paywallPurchaseWithRevenueCat,
  restoreRevenueCatPurchases,
} from '@/features/onboarding/services/revenuecat'
import { OB } from '@/features/onboarding/tokens'
import type {
  PaywallCatalog,
  PaywallPurchase,
} from '@/features/onboarding/types/paywall'
import { useT } from '@/i18n/useT'
import { syncEntitlement, unlockAfterPurchase } from '@/session/bootstrap'
import { useSocialSignIn } from '@/session/useSocialSignIn'
import { useAppGateStore } from '@/shared/stores/app-gate.store'
import { fonts } from '@/shared/theme/tokens/fonts'
import { showErrorToast, showToast } from '@/shared/utils/toast'

/**
 * Le paywall — une ROUTE, pas une étape du parcours.
 *
 * C'est la conséquence directe de la porte dure : l'abonnement n'est pas un
 * moment du récit qu'on franchit une fois, c'est un ÉTAT qu'on réévalue à
 * chaque démarrage. `app/_layout.tsx` monte cet écran dès que
 * `surveyDone && !entitled`, ce qui couvre d'un seul coup trois situations
 * qu'un « je reprends à l'étape 17 » ne saurait pas distinguer :
 *
 *   — fermeture de l'app sur le paywall, retour trois semaines plus tard ;
 *   — réinstallation, changement d'appareil ;
 *   — abonnement EXPIRÉ chez un utilisateur qui avait fini tout le parcours.
 *
 * Ce qui se joue avant lui (le plan personnalisé, le rituel du sceau) ne se
 * rejoue jamais. Le pitch, lui, appartient au paywall : c'est son PREMIER
 * écran, à chaque présentation. Le chemin ne varie pas —
 * pitch → tarifs → offre unique — et refuser l'offre y ramène.
 */

/**
 * Adaptateur d'aperçu (dev sans clés RevenueCat). Il ne facture rien et se
 * comporte comme une feuille de paiement refermée. `storeSheetPresented:
 * false` est essentiel : c'est ce qui empêche l'offre de rattrapage à −50 %
 * de s'ouvrir, puisqu'elle ne doit JAMAIS suivre autre chose qu'une
 * annulation réelle.
 */
const previewPurchase: PaywallPurchase = async () => ({
  status: 'cancelled',
  storeSheetPresented: false,
})

type Phase = 'loading' | 'paywall' | 'unavailable' | 'auth'

export default function PaywallScreen() {
  const t = useT()
  const hasNativeBilling = isRevenueCatEnabled()
  const [phase, setPhase] = useState<Phase>('loading')
  const [catalog, setCatalog] = useState<PaywallCatalog | null>(null)
  const mounted = useRef(true)
  const run = useRef(0)
  // Le rang de CETTE présentation, compté une fois au montage. C'est une
  // mesure (combien de vues pour convertir), pas un aiguillage : l'écran
  // d'entrée ne varie plus, c'est toujours le pitch.
  useState(countPaywallView)

  const {
    signInWithApple,
    signInWithGoogle,
    pending: authPending,
  } = useSocialSignIn()

  const load = useCallback(async () => {
    const id = ++run.current
    const stale = () => !mounted.current || run.current !== id
    setPhase('loading')
    // Une build sans facturation ne peut rien encaisser : elle ne doit rien
    // bloquer non plus. En production, `checkRelockProEntitlement` a déjà
    // ouvert la porte et cet écran n'est pas monté ; en dev on affiche les
    // décors pour pouvoir travailler les quatre écrans sans clés.
    if (!hasNativeBilling) {
      if (!stale()) setPhase('paywall')
      return
    }

    // Un abonnement pris ailleurs (autre appareil, Réglages iOS, restauration
    // sur un autre compte) doit ouvrir la porte sans qu'on repropose un prix.
    await syncEntitlement()
    if (stale() || useAppGateStore.getState().entitled) return

    const storeCatalog = await loadPaywallCatalog()
    if (stale()) return
    setCatalog(storeCatalog)
    // Pas de catalogue = pas de tarif affichable. On ne bricole aucun prix et
    // on ne laisse pas passer : on demande de réessayer. Un ABONNÉ, lui,
    // n'arrive jamais ici — son abonnement en cache lui ouvre la porte avant
    // même le réseau (voir `app-gate.store.ts`).
    setPhase(storeCatalog ? 'paywall' : 'unavailable')
  }, [hasNativeBilling])

  useEffect(() => {
    mounted.current = true
    void load()
    return () => {
      mounted.current = false
    }
  }, [load])

  const restore = useCallback(async () => {
    const result = await restoreRevenueCatPurchases()
    // On n'ouvre la porte que sur `restored`. `none` et `failed` sont deux
    // messages, pas deux déblocages — et un test de véracité sur la valeur
    // brute les aurait tous deux laissés passer, la chaîne étant vraie.
    if (result === 'restored') unlockAfterPurchase()
    return result
  }, [])

  /**
   * « J'ai déjà un compte ».
   *
   * Sans lui, la porte dure enferme ses propres clients : la connexion arrive
   * APRÈS le paywall dans le parcours, donc un abonné qui réinstalle n'a que
   * « Restaurer » — qui ne marche que sur le MÊME compte Apple. Changement
   * d'Apple ID, compte familial, migration Android : abonné, et dehors.
   * Ici il se connecte, `useSocialSignIn` rattache ses achats à son compte
   * RevenueCat, et l'abonnement le retrouve.
   */
  const signIn = useCallback(
    async (provider: typeof signInWithApple) => {
      const result = await provider()
      if (!result.ok) {
        if (!result.canceled) showErrorToast(result.error)
        return
      }
      // Les réponses du questionnaire n'avaient jusqu'ici aucun compte où
      // vivre : on les pousse dès qu'il en existe un.
      const answers = readOnboardingCheckpoint()?.answers
      if (answers) void saveOnboardingAnswers(answers)

      await syncEntitlement()
      if (useAppGateStore.getState().entitled) return
      // Compte valide, aucun abonnement dessus : on le ramène aux tarifs en
      // le disant, plutôt que de le laisser croire à un échec de connexion.
      showToast(t('paywall.no_subscription_found'))
      setPhase('paywall')
    },
    [t],
  )

  const handleApple = useCallback(() => {
    void signIn(signInWithApple)
  }, [signIn, signInWithApple])
  const handleGoogle = useCallback(() => {
    void signIn(signInWithGoogle)
  }, [signIn, signInWithGoogle])

  // D'où l'on vient quand on ouvre « J'ai déjà un compte » — c'est là qu'on
  // revient si l'utilisateur referme la feuille Apple/Google. Sans ce retour,
  // la porte dure enfermait pour de bon : plus de tarif, plus de restauration,
  // plus rien, jusqu'à tuer l'app.
  const backPhase = useRef<Exclude<Phase, 'auth'>>('paywall')
  const openSignIn = useCallback(() => {
    setPhase(current => {
      if (current !== 'auth') backPhase.current = current
      return 'auth'
    })
  }, [])
  const closeSignIn = useCallback(() => setPhase(backPhase.current), [])
  /**
   * DEV uniquement : ouvre la porte dure sans passer par le store, pour
   * travailler l'app sans racheter un abonnement à chaque réinstallation.
   * `unlockAfterPurchase` écrit l'abonnement en cache et remplace la route —
   * exactement le chemin d'un achat réel, sans facturation. Un prochain
   * `syncEntitlement` refermera la porte si RevenueCat dit non : c'est un
   * raccourci de travail, pas une fraude durable.
   *
   * `__DEV__` est une constante remplacée par `false` en release : ni ce
   * callback ni le bouton qui l'appelle n'existent dans le binaire livré.
   */
  const devSkip = useCallback(() => {
    if (__DEV__) unlockAfterPurchase()
  }, [])
  const retry = useCallback(() => {
    void load()
  }, [load])

  if (phase === 'auth') {
    return (
      <View style={styles.screen}>
        <SceneAuth
          onApple={handleApple}
          onGoogle={handleGoogle}
          busy={authPending}
          onBack={closeSignIn}
        />
      </View>
    )
  }

  if (phase === 'loading') {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>{t('common.loading')}</Text>
      </View>
    )
  }

  if (phase === 'unavailable') {
    return (
      <View style={styles.screen}>
        <PaywallFlow
          plans={[]}
          offer={null}
          onSkip={retry}
          onSignIn={openSignIn}
          onRestore={restore}
          escapable={false}
        />
      </View>
    )
  }

  return (
    <View style={styles.screen}>
      <PaywallFlow
        plans={catalog?.plans ?? (__DEV__ ? PREVIEW_PLANS : [])}
        offer={catalog?.offer ?? (__DEV__ ? PREVIEW_OFFER : null)}
        purchase={catalog ? paywallPurchaseWithRevenueCat : previewPurchase}
        // Sans catalogue, seul le développement affiche quelque chose : c'est
        // l'adaptateur d'aperçu qui répond, et il ne facture rien. En
        // production on n'arrive jamais ici sans tarifs (phase `unavailable`).
        allowPurchases={Boolean(catalog) || __DEV__}
        onPurchaseSuccess={unlockAfterPurchase}
        onRestore={restore}
        onSignIn={openSignIn}
        // La porte dure : « Passer » ne sort plus de l'écran, il ramène à
        // l'offre puis au pitch. Seuls un achat ou une restauration ouvrent.
        escapable={false}
        onSkip={retry}
        onDevSkip={__DEV__ ? devSkip : undefined}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: OB.bg },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    backgroundColor: OB.bg,
  },
  loadingText: { ...fonts.regular, fontSize: 15, color: OB.ink55 },
})
