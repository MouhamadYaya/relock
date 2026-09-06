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
  PaywallWordmark,
} from '@/features/onboarding/components/paywall/PaywallPrimitives'
import { PW } from '@/features/onboarding/components/paywall/paywall-theme'
import { shouldShowCancellationOffer } from '@/features/onboarding/services/paywall-flow'
import type {
  PaywallPlan,
  PaywallPurchase,
  PaywallPurchaseSource,
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
  /** Renvoie `false` quand le store n'a rendu aucun abonnement actif. */
  onRestore?: () => boolean | Promise<boolean>
}) {
  const t = useT()
  const insets = useSafeAreaInsets()
  const reduceMotion = useReducedMotion()
  const [screen, setScreen] = useState<'benefits' | 'plans' | 'exit-offer'>(
    'benefits',
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
  const finished = useRef(false)
  const purchasing = useRef(false)
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
    if (finished.current || purchasing.current) return
    finished.current = true
    onSkip()
  }, [onSkip])
  const dismissSheet = useCallback(() => {
    if (!purchasing.current) setSheetVisible(false)
  }, [])
  const close = useCallback(() => {
    if (purchasing.current) return
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
    finish()
  }, [dismissSheet, finish, offer, screen, sheetVisible])

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      close()
      return true
    })
    return () => sub.remove()
  }, [close])

  const alert = (message: string) =>
    Alert.alert(t('paywall.preview_title'), message, [
      { text: t('paywall.understood') },
    ])
  const canPurchase = allowPurchases ?? __DEV__
  const buy = async (source: PaywallPurchaseSource) => {
    if (purchasing.current || finished.current || !canPurchase) return
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
      else if (result.status === 'cancelled')
        alert(t('paywall_reference.payment_failed'))
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
          {t('paywall.coming_soon_body')}
        </Text>
        <PaywallTextButton label={t('paywall.continue')} onPress={finish} />
      </View>
    )

  // Le repère barré des deux écrans de remise : la formule annuelle au plein
  // tarif. À défaut (offering sans annuel), la formule sélectionnée.
  const annual = plans.find(plan => plan.period === 'year') ?? selected

  const handleRestore = async () => {
    if (purchasing.current || finished.current) return
    if (!onRestore) {
      alert(t('paywall.restore_unavailable'))
      return
    }

    purchasing.current = true
    setBusy(true)
    try {
      const restored = await onRestore()
      if (!restored && mounted.current && !finished.current)
        alert(t('paywall.restore_none'))
    } catch {
      if (mounted.current && !finished.current)
        alert(t('paywall_reference.payment_failed'))
    } finally {
      purchasing.current = false
      if (mounted.current) setBusy(false)
    }
  }

  return (
    <View style={styles.canvas} testID="relock-paywall">
      {screen === 'exit-offer' ? <PaywallField /> : <PaywallBackdrop />}
      <View
        style={[
          styles.frame,
          {
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
          <View style={styles.toolbar}>
            <PaywallWordmark />
            {sheetVisible ? (
              <View style={styles.toolbarAction} />
            ) : (
              <PaywallTextButton
                label={t('paywall_reference.skip')}
                onPress={close}
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
            onClose={finish}
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
              if (!purchasing.current) setSelected(plan)
            }}
            onPurchase={() => {
              return buy('plans')
            }}
            onRestore={handleRestore}
            busy={busy}
            onWindow={
              offer
                ? () => {
                    if (!purchasing.current) setSheetVisible(true)
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
    paddingHorizontal: PW.layout.page,
  },
  bareToolbar: { justifyContent: 'flex-end' },
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
