import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  Alert,
  BackHandler,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useReducedMotion } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  PaywallBackdrop,
  PaywallField,
} from '@/features/onboarding/components/paywall/PaywallArtwork'
import { PaywallBenefits } from '@/features/onboarding/components/paywall/PaywallBenefits'
import { PaywallExitOffer } from '@/features/onboarding/components/paywall/PaywallExitOffer'
import { PaywallOffer } from '@/features/onboarding/components/paywall/PaywallOffer'
import { PaywallPlans } from '@/features/onboarding/components/paywall/PaywallPlans'
import {
  PaywallClose,
  PaywallTextButton,
} from '@/features/onboarding/components/paywall/PaywallPrimitives'
import { PW } from '@/features/onboarding/components/paywall/paywall-theme'
import { shouldShowCancellationOffer } from '@/features/onboarding/services/paywall-flow'
import type {
  PaywallPlan,
  PaywallPurchase,
  PaywallPurchaseSource,
  PaywallRestore,
} from '@/features/onboarding/types/paywall'
import { useT } from '@/i18n/useT'
import { fonts } from '@/shared/theme/tokens/fonts'

/**
 * Reference preview only. No fixtures, testimonials or unverified offer claims ship.
 * Future billing adapter resolves after the real store sheet has dismissed.
 * Never infer cancellation from AppState, modal dismissal or a generic error.
 */
export function PaywallFlow({
  plans,
  offer,
  onSkip,
  purchase,
  onPurchaseSuccess,
  allowPurchases,
  onRestore,
  initialScreen = 'benefits',
  escapable = true,
  onSignIn,
}: {
  /** Les formules du store, prix compris. Rien ne s'affiche sans elles. */
  plans: readonly PaywallPlan[]
  /**
   * Le produit remisé, ou `null` s'il n'existe pas côté store. `null` désactive
   * les DEUX écrans de rattrapage : on ne promet pas une remise qu'on ne
   * saurait pas facturer.
   */
  offer: PaywallPlan | null
  onSkip: () => void
  purchase?: PaywallPurchase
  onPurchaseSuccess?: () => void
  allowPurchases?: boolean
  /**
   * Écran d'entrée. `benefits` argumente avant d'annoncer un prix : c'est la
   * bonne première vue, et une friction à la deuxième. Les présentations
   * suivantes ouvrent donc sur `plans` (voir `PaywallScreen`).
   */
  initialScreen?: 'benefits' | 'plans'
  /**
   * Porte dure. À `false`, aucun geste de l'utilisateur ne sort de cet
   * écran : « Passer » et la croix mènent à l'offre de rattrapage, puis
   * ramènent au pitch. Seuls un achat, une restauration ou une connexion à un
   * compte abonné ouvrent la porte — et c'est le gate de `app/_layout.tsx`
   * qui la franchit, pas ce composant.
   */
  escapable?: boolean
  /** « J'ai déjà un compte » : la seule issue d'un abonné qui a réinstallé. */
  onSignIn?: () => void
  /**
   * Sépare les trois issues d'une restauration — `restored`, `none`,
   * `failed`. Un booléen ne le pouvait pas : « ce compte n'a aucun
   * abonnement » est un diagnostic définitif, une panne du store est
   * réessayable, et les confondre fait dire à un abonné hors ligne qu'il
   * n'a rien acheté.
   */
  onRestore?: PaywallRestore
}) {
  const t = useT()
  const insets = useSafeAreaInsets()
  const reduceMotion = useReducedMotion()
  const [screen, setScreen] = useState<'benefits' | 'plans' | 'exit-offer'>(
    initialScreen,
  )
  const [selected, setSelected] = useState<PaywallPlan | null>(plans[0] ?? null)
  useEffect(() => {
    // Le catalogue peut arriver après le premier rendu : on se cale dessus
    // sans jamais garder une formule qui n'existe plus côté store.
    setSelected(current => {
      const stillListed =
        current && plans.some(plan => plan.packageId === current.packageId)
      return stillListed ? current : (plans[0] ?? null)
    })
  }, [plans])
  // La feuille à −50 % n'apparaît JAMAIS d'elle-même : uniquement après une
  // annulation avérée de la feuille de paiement, ou depuis l'aperçu de dev.
  const [sheetVisible, setSheetVisible] = useState(false)
  const [busy, setBusy] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const finished = useRef(false)
  const purchasing = useRef(false)
  // Achat et restauration touchent le même compte : l'un exclut l'autre, et
  // le drapeau est une ref pour fermer la porte AVANT le prochain rendu.
  const restoringRef = useRef(false)
  const cancellationOfferShown = useRef(false)
  const exitOfferShown = useRef(false)
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const finish = useCallback(() => {
    if (finished.current || purchasing.current || restoringRef.current) return
    finished.current = true
    onSkip()
  }, [onSkip])
  const dismissSheet = useCallback(() => {
    if (!purchasing.current && !restoringRef.current) setSheetVisible(false)
  }, [])
  const close = useCallback(() => {
    if (purchasing.current || restoringRef.current) return
    if (sheetVisible) {
      dismissSheet()
      return
    }
    // « Passer » ou la croix depuis l'écran des formules : on tente l'offre
    // unique, une seule fois, et seulement si un produit remisé existe
    // vraiment côté store. Sinon on laisse partir — pas d'écran vide.
    if (screen === 'plans' && offer && !exitOfferShown.current) {
      exitOfferShown.current = true
      setScreen('exit-offer')
      return
    }
    // Refuser l'offre unique ferme l'offre, pas le paywall : on revient aux
    // formules. C'est le « Passer » suivant — l'offre ayant déjà été jouée,
    // elle ne se rejoue pas — qui laisse enfin sortir.
    if (screen === 'exit-offer') {
      setScreen('plans')
      return
    }
    // Porte dure : il n'y a pas de sortie. On repart du pitch, et l'offre de
    // rattrapage redevient disponible au tour suivant — « Passer » mène
    // toujours quelque part, jamais dehors.
    if (!escapable) {
      exitOfferShown.current = false
      setScreen('benefits')
      return
    }
    finish()
  }, [dismissSheet, escapable, finish, offer, screen, sheetVisible])

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      close()
      return true
    })
    return () => sub.remove()
  }, [close])

  // Le titre des alertes est la marque, jamais « Aperçu du paywall » : ces
  // alertes s'affichent AUSSI en production (restauration vide, paiement
  // refusé), et un intitulé de développement y était visible par les clients.
  const alert = (message: string) =>
    Alert.alert(t('paywall.notice_title'), message, [
      { text: t('paywall.understood') },
    ])
  const canPurchase = allowPurchases ?? __DEV__
  const buy = async (source: PaywallPurchaseSource) => {
    if (
      purchasing.current ||
      restoringRef.current ||
      finished.current ||
      !canPurchase
    )
      return
    if (!purchase) {
      alert(t('paywall.purchase_unavailable'))
      return
    }
    purchasing.current = true
    setBusy(true)
    try {
      // Chaque écran achète EXACTEMENT ce qu'il a affiché : la formule
      // sélectionnée, ou le produit remisé du store. Aucun montant fabriqué,
      // aucune substitution silencieuse d'un produit par un autre.
      const plan = source === 'plans' ? selected : offer
      if (!plan) {
        alert(t('paywall.purchase_unavailable'))
        return
      }
      const result = await purchase(plan, source)
      if (!mounted.current || finished.current) return
      if (result.status === 'purchased') {
        finished.current = true
        setSheetVisible(false)
        const continueOnboarding = onPurchaseSuccess ?? onSkip
        continueOnboarding()
      } else if (
        offer &&
        shouldShowCancellationOffer(
          result,
          source,
          cancellationOfferShown.current,
        )
      ) {
        cancellationOfferShown.current = true
        setSheetVisible(true)
      } else if (result.status === 'failed')
        alert(t('paywall_reference.payment_failed'))
      // Une annulation n'est pas un échec : l'utilisateur a fermé la feuille
      // Apple exprès. Lui répondre « Le paiement n'a pas abouti, tu peux
      // réessayer » le sermonne pour un geste délibéré. On le ramène au
      // paywall, sans un mot.
      else if (result.status === 'pending')
        alert(t('paywall_reference.payment_pending'))
    } catch {
      if (mounted.current && !finished.current)
        alert(t('paywall_reference.payment_failed'))
    } finally {
      purchasing.current = false
      if (mounted.current) setBusy(false)
    }
  }

  const handleRestore = async () => {
    if (purchasing.current || restoringRef.current || finished.current) return
    if (!onRestore) {
      alert(t('paywall.restore_unavailable'))
      return
    }

    restoringRef.current = true
    setRestoring(true)
    try {
      const result = await onRestore()
      if (result === 'restored' || !mounted.current || finished.current) return
      // « Aucun abonnement » est un diagnostic de compte : on ne le prononce
      // que si le store a vraiment répondu, jamais sur une panne réessayable,
      // qui elle invite à recommencer.
      alert(
        result === 'none'
          ? t('paywall.restore_none')
          : t('paywall_reference.payment_failed'),
      )
    } catch {
      if (mounted.current && !finished.current)
        alert(t('paywall_reference.payment_failed'))
    } finally {
      restoringRef.current = false
      if (mounted.current) setRestoring(false)
    }
  }

  // Sans catalogue exploitable (RevenueCat muet, offering vide, réseau coupé),
  // on ne bricole aucun tarif : on laisse passer plutôt que de mentir.
  if (!canPurchase || !purchase || !selected)
    return (
      <View
        style={[
          styles.canvas,
          styles.unavailable,
          { paddingTop: insets.top, paddingBottom: insets.bottom },
        ]}
        testID="paywall-unavailable"
      >
        <Text style={styles.unavailableTitle}>{t('paywall.coming_soon')}</Text>
        <Text style={styles.unavailableBody}>
          {escapable
            ? t('paywall.coming_soon_body')
            : t('paywall.unavailable_body')}
        </Text>
        <PaywallTextButton
          label={escapable ? t('paywall.continue') : t('paywall.retry')}
          onPress={escapable ? finish : onSkip}
        />
        {!escapable && onRestore ? (
          <PaywallTextButton
            label={
              restoring
                ? t('paywall_reference.processing')
                : t('paywall.restore')
            }
            onPress={handleRestore}
            disabled={restoring}
          />
        ) : null}
        {/*
          La porte de l'abonné qui a réinstallé. Elle ne vit QUE sur cet
          écran : c'est le seul cul-de-sac du parcours — sans catalogue, sans
          tarif et sans issue — alors que la barre du paywall porte déjà
          « Restaurer », qui couvre le même besoin. Deux liens côte à côte
          l'encombraient pour rien.
        */}
        {!escapable && onSignIn ? (
          <PaywallTextButton
            testID="paywall-sign-in"
            label={t('paywall.sign_in')}
            onPress={onSignIn}
          />
        ) : null}
      </View>
    )

  // Le repère barré des deux écrans de remise : la formule annuelle au plein
  // tarif. À défaut (offering sans annuel), la formule sélectionnée.
  const annual = plans.find(plan => plan.period === 'year') ?? selected

  return (
    <View style={styles.canvas} testID="relock-paywall">
      {screen === 'exit-offer' ? <PaywallField /> : <PaywallBackdrop />}
      <View
        style={[
          styles.frame,
          {
            // L'écran des formules laisse la barre d'état LIBRE (l'heure, le
            // wifi, la batterie ne doivent jamais être touchés par une carte)
            // mais la barre Restaurer / ✕ reste en surimpression de la
            // mosaïque : la remettre dans le flux coûterait 44 pt de plus aux
            // cartes et les rendrait plates.
            paddingTop: insets.top,
            paddingBottom: Math.max(insets.bottom, PW.space.xs),
          },
        ]}
        accessibilityElementsHidden={sheetVisible}
        importantForAccessibility={
          sheetVisible ? 'no-hide-descendants' : 'auto'
        }
      >
        {screen === 'plans' ? (
          /*
            Deux actions natives, posées PAR-DESSUS la mosaïque : la
            restauration à gauche, la sortie à droite. `pointerEvents="box-none"`
            laisse le reste de la bande inerte sans rien voler aux boutons.

            La restauration est une obligation de l'App Store, pas une option
            de développement : elle est visible en production, à portée de
            quiconque réinstalle Relock ou change d'appareil.

            Il n'y a PAS de lien « J'ai déjà un compte » ici : la
            restauration couvre déjà le cas de l'abonné qui réinstalle, et
            deux liens côte à côte encombraient la barre.
          */
          <View
            testID="paywall-restore"
            pointerEvents="box-none"
            style={[styles.floatingToolbar, { top: insets.top }]}
          >
            <PaywallTextButton
              label={
                restoring
                  ? t('paywall_reference.processing')
                  : t('paywall.restore')
              }
              onPress={handleRestore}
              disabled={busy || restoring}
              tone="bright"
            />
            {sheetVisible ? (
              <View style={styles.toolbarAction} />
            ) : (
              <PaywallClose
                testID="paywall-plans-close"
                onPress={close}
                tone="bright"
              />
            )}
          </View>
        ) : screen === 'exit-offer' ? (
          // L'offre unique se passe du logotype : rien ne doit concurrencer
          // la remise. Seule la croix reste, discrète, en haut à droite.
          <View style={[styles.toolbar, styles.bareToolbar]}>
            <PaywallClose onPress={close} />
          </View>
        ) : null}
        {screen === 'benefits' ? (
          <PaywallBenefits onNext={() => setScreen('plans')} />
        ) : screen === 'exit-offer' && offer ? (
          <PaywallExitOffer
            regular={annual}
            offer={offer}
            onClose={close}
            onPurchase={() => {
              return buy('exit-offer')
            }}
            busy={busy}
          />
        ) : (
          <PaywallPlans
            plans={plans}
            selected={selected}
            onSelect={plan => {
              if (!purchasing.current && !restoringRef.current)
                setSelected(plan)
            }}
            onPurchase={() => {
              return buy('plans')
            }}
            busy={busy || restoring}
            onWindow={
              offer
                ? () => {
                    if (!purchasing.current && !restoringRef.current)
                      setSheetVisible(true)
                  }
                : undefined
            }
          />
        )}
      </View>
      <Modal
        visible={sheetVisible && offer !== null}
        transparent
        animationType={reduceMotion ? 'none' : 'slide'}
        onRequestClose={dismissSheet}
        statusBarTranslucent
      >
        <View style={styles.overlay}>
          <Pressable
            testID="paywall-sheet-backdrop"
            style={StyleSheet.absoluteFill}
            onPress={dismissSheet}
            accessibilityRole="button"
            accessibilityLabel={t('paywall.close')}
          />
          <View style={[styles.modalClose, { top: insets.top }]}>
            <PaywallClose onPress={dismissSheet} />
          </View>
          {offer ? (
            <PaywallOffer
              regular={annual}
              offer={offer}
              onPurchase={() => {
                return buy('cancel-offer')
              }}
              busy={busy}
            />
          ) : null}
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  toolbarAction: { width: PW.layout.touch, height: PW.layout.touch },
  canvas: { flex: 1, backgroundColor: PW.color.canvas, overflow: 'hidden' },
  frame: {
    flex: 1,
    width: '100%',
    maxWidth: PW.layout.maxWidth,
    alignSelf: 'center',
  },
  toolbar: {
    minHeight: PW.layout.touch,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: PW.space.xs,
  },
  bareToolbar: { justifyContent: 'flex-end' },
  /**
   * Hors flux : la mosaïque occupe toute la largeur DERRIÈRE elle, encoche
   * comprise. `zIndex` la garde au-dessus du `ScrollView` de l'écran.
   */
  floatingToolbar: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 1,
    minHeight: PW.layout.touch,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: PW.space.xs,
  },
  unavailable: {
    justifyContent: 'center',
    paddingHorizontal: PW.space.xl,
    gap: PW.space.lg,
  },
  unavailableTitle: {
    ...fonts.bold,
    color: PW.color.ink,
    fontSize: PW.text.h1,
    lineHeight: PW.text.h1Line,
    letterSpacing: PW.text.tight,
    textAlign: 'center',
  },
  unavailableBody: {
    ...fonts.regular,
    color: PW.color.inkMuted,
    fontSize: PW.text.body,
    lineHeight: PW.text.bodyLine,
    textAlign: 'center',
  },
  // Voile franc : c'est lui qui détache la feuille claire de la page.
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: PW.color.scrim,
  },
  modalClose: { position: 'absolute', right: PW.space.xs },
})
