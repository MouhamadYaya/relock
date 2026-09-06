import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  AppState,
  Linking,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { NotificationService } from '@/features/notifications/notification.service'
import { PaywallFlow } from '@/features/onboarding/components/paywall/PaywallFlow'
import {
  PREVIEW_OFFER,
  PREVIEW_PLANS,
} from '@/features/onboarding/components/paywall/paywall-preview'
import type {
  PaywallCatalog,
  PaywallPurchase,
} from '@/features/onboarding/types/paywall'
import { useT } from '@/i18n/useT'
import { ScreenTime } from '@/shared/native/screen-time'
import { fonts } from '@/shared/theme/tokens/fonts'
import { GhostLink, GuideCard, Pill, RedAlert } from './bits'
import { Reveal } from './motion'
import {
  hasRelockProEntitlement,
  isRevenueCatEnabled,
  loadPaywallCatalog,
  paywallPurchaseWithRevenueCat,
  restoreRevenueCatPurchases,
} from './services/revenuecat'
import { GUIDE_BOTTOM_PADDING, GUIDE_SCENE_PADDING, haptic, OB } from './tokens'

// ─── Acte 4 · Temps d'écran (blocage DUR) ───────────────────────────────

/**
 * LA permission qui fait exister le produit. Amorcée façon Opal : réplique
 * du dialogue iOS, choix « autoriser » lumineux, l'autre éteint. Refus →
 * alerte rouge minimaliste intégrée, et on ne passe PAS. Après un second
 * refus, iOS ne re-présente plus le dialogue : on envoie vers Réglages, et
 * on avance tout seul dès que l'autorisation apparaît.
 */
export function ScenePermission({ onNext }: { onNext: () => void }) {
  const [denied, setDenied] = useState(0)
  const [busy, setBusy] = useState(false)
  const [dimmed, setDimmed] = useState(false)
  const advanced = useRef(false)

  const advance = () => {
    if (!advanced.current) {
      advanced.current = true
      haptic.success()
      onNext()
    }
  }

  // Retour de Réglages : si l'autorisation a été accordée là-bas, on
  // continue sans exiger un tap de plus.
  // biome-ignore lint/correctness/useExhaustiveDependencies: abonnement au montage uniquement (advance protégé par ref)
  useEffect(() => {
    if (!ScreenTime.isAvailable) return
    const sub = AppState.addEventListener('change', s => {
      if (s !== 'active') return
      ScreenTime.authorizationStatus()
        .then(st => {
          if (st === 'approved') advance()
        })
        .catch(() => {})
    })
    return () => sub.remove()
  }, [])

  const request = async () => {
    if (!ScreenTime.isAvailable) {
      advance()
      return
    }
    setBusy(true)
    // La vraie fenêtre iOS va apparaître par-dessus cet écran : on efface
    // notre carte-guide plutôt que de risquer un chevauchement mal aligné
    // (ni sa taille ni sa position exactes ne sont prévisibles côté app).
    setDimmed(true)
    try {
      const s = await ScreenTime.requestAuthorization()
      if (s === 'approved') {
        advance()
        return
      }
      setDenied(d => d + 1)
    } catch {
      setDenied(d => d + 1)
    } finally {
      setBusy(false)
      setDimmed(false)
    }
  }

  const openSettings = () => {
    Linking.openSettings().catch(() => {})
  }

  const learnMore = () => {
    Linking.openURL('https://www.apple.com/privacy/').catch(() => {})
  }

  const cardAction = denied >= 2 ? openSettings : request
  const continueLabel =
    denied >= 2
      ? 'Ouvrir les Réglages'
      : denied === 1
        ? 'Réessayer'
        : 'Continuer'

  return (
    <View style={styles.guideScene}>
      <Reveal index={0} style={styles.guideHeroWrap}>
        <Text style={styles.heroTitle}>
          Donnons à Relock l'accès à{`\n`}Temps d'écran. En toute confiance.
        </Text>
      </Reveal>
      <View style={styles.guideMiddle}>
        <Reveal index={1}>
          <GuideCard
            title="« Relock » souhaite accéder à Temps d'écran"
            body="L'accès à Temps d'écran permet à Relock de limiter les apps choisies et de t'aider à rester concentré. Tes données restent sur ton appareil."
            leftLabel={continueLabel}
            rightLabel="Ne pas autoriser"
            activeSide="left"
            onActivePress={cardAction}
            activeBusy={busy}
            dimmed={dimmed}
          />
        </Reveal>
        {denied > 0 ? (
          <View style={{ marginTop: 18 }}>
            <RedAlert text="Relock ne peut pas fonctionner sans cette autorisation. Rien ne quitte ton téléphone, rien ne nous est transmis." />
          </View>
        ) : null}
      </View>
      <Reveal index={2} style={styles.guideBottom}>
        <View style={styles.privacyWrap}>
          <Text style={styles.privacyText}>
            Tes informations restent protégées par Apple et stockées uniquement
            sur ton téléphone.
          </Text>
          <GhostLink label="En savoir plus" onPress={learnMore} accent />
        </View>
        {__DEV__ ? (
          // Échappatoire DEV uniquement : le simulateur a le module mais ne
          // peut pas finir le parcours d'autorisation (code de l'appareil).
          // En production, le blocage est absolu.
          <GhostLink label="Passer (dev)" onPress={advance} dim />
        ) : null}
      </Reveal>
    </View>
  )
}

// ─── Acte 4 · Notifications (refusables) ────────────────────────────────

export function SceneNotifs({ onNext }: { onNext: () => void }) {
  const [busy, setBusy] = useState(false)
  const [dimmed, setDimmed] = useState(false)

  const request = async () => {
    setBusy(true)
    // Même logique que Temps d'écran : on efface la carte-guide avant que
    // la vraie fenêtre système n'apparaisse par-dessus.
    setDimmed(true)
    try {
      await NotificationService.ensurePermission()
    } catch {
      // Refus accepté : les rappels sont un plus, pas une condition.
    } finally {
      setBusy(false)
      onNext()
    }
  }

  return (
    <View style={styles.guideScene}>
      <Reveal index={0} style={styles.guideHeroWrap}>
        <Text style={styles.heroTitle}>
          Reçois tes bilans Relock{`\n`}et célèbre chaque progrès.
        </Text>
      </Reveal>
      <View style={styles.guideMiddle}>
        <Reveal index={1}>
          <GuideCard
            title="« Relock » souhaite t'envoyer des notifications"
            body="Les notifications peuvent inclure des alertes, des sons et des pastilles. Tu peux les configurer dans Réglages."
            leftLabel="Ne pas autoriser"
            rightLabel="Autoriser"
            activeSide="right"
            interactive={false}
            dimmed={dimmed}
            frameVariant="notifications"
          />
        </Reveal>
      </View>
      <Reveal index={2} style={styles.guideBottom}>
        <Pill
          label="Continuer"
          kind="ghost"
          onPress={request}
          disabled={busy}
          glow
        />
      </Reveal>
    </View>
  )
}

/**
 * Adaptateur d'aperçu, développement uniquement.
 *
 * Il ne facture rien et se comporte comme une feuille de paiement que
 * l'utilisateur aurait refermée. `storeSheetPresented: false` est essentiel :
 * c'est ce qui empêche l'offre de rattrapage à −50 % de s'ouvrir, puisqu'elle
 * ne doit JAMAIS suivre autre chose qu'une annulation réelle.
 */
const previewPurchase: PaywallPurchase = async () => ({
  status: 'cancelled',
  storeSheetPresented: false,
})

// Le paywall est isolé des écrans de permission et de notifications.
export function ScenePaywall({ onNext }: { onNext: () => void }) {
  const t = useT()
  const hasNativeBilling = isRevenueCatEnabled()
  const [loading, setLoading] = useState(hasNativeBilling)
  const [catalog, setCatalog] = useState<PaywallCatalog | null>(null)

  useEffect(() => {
    if (!hasNativeBilling) {
      setLoading(false)
      return
    }

    let cancelled = false
    void (async () => {
      // Déjà abonné : on ne repropose rien, on laisse entrer.
      const hasEntitlement = await hasRelockProEntitlement()
      if (cancelled) return
      if (hasEntitlement) {
        onNext()
        return
      }
      // Les tarifs viennent du store à chaque affichage — jamais du bundle.
      const storeCatalog = await loadPaywallCatalog()
      if (cancelled) return
      setCatalog(storeCatalog)
      setLoading(false)
    })()

    return () => {
      cancelled = true
    }
  }, [hasNativeBilling, onNext])

  const restore = useCallback(async () => {
    const result = await restoreRevenueCatPurchases()
    if (result === 'restored') {
      onNext()
    }
    return result
  }, [onNext])

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>{t('common.loading')}</Text>
      </View>
    )
  }

  if (!hasNativeBilling || !catalog) {
    // Sans clés RevenueCat — ou si le store n'a rien renvoyé — `PaywallFlow`
    // refuse d'afficher le moindre tarif (garde `!purchase`) : on ne montre pas
    // un prix qu'on ne peut pas encaisser. En développement seulement, on
    // branche des décors et un adaptateur qui ne facture rien, pour pouvoir
    // travailler les quatre écrans sans store.
    return (
      <PaywallFlow
        plans={__DEV__ ? PREVIEW_PLANS : []}
        offer={__DEV__ ? PREVIEW_OFFER : null}
        onSkip={onNext}
        purchase={__DEV__ ? previewPurchase : undefined}
      />
    )
  }

  return (
    <PaywallFlow
      plans={catalog.plans}
      offer={catalog.offer}
      onSkip={onNext}
      purchase={paywallPurchaseWithRevenueCat}
      onPurchaseSuccess={onNext}
      onRestore={restore}
      allowPurchases
    />
  )
}

// ─── Styles ──────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  guideScene: { flex: 1 },
  guideHeroWrap: {
    paddingTop: 72,
    paddingHorizontal: GUIDE_SCENE_PADDING,
  },
  heroTitle: {
    ...fonts.bold,
    fontSize: 20,
    lineHeight: 25,
    letterSpacing: -0.4,
    color: OB.ink,
    textAlign: 'center',
  },
  guideMiddle: {
    flex: 1,
    paddingTop: 100,
    paddingHorizontal: GUIDE_SCENE_PADDING,
  },
  guideBottom: {
    gap: 8,
    paddingBottom: 25,
    paddingHorizontal: GUIDE_BOTTOM_PADDING,
  },
  privacyWrap: { alignItems: 'center', gap: 10, paddingBottom: 6 },
  privacyText: {
    ...fonts.regular,
    fontSize: 13,
    lineHeight: 19,
    color: OB.ink40,
    textAlign: 'center',
    paddingHorizontal: 25,
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    paddingBottom: 20,
  },
  loadingText: {
    ...fonts.regular,
    color: OB.ink40,
  },
})
