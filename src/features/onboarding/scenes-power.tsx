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
import { GhostLink, GuideCard, RedAlert } from './bits'
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
export function ScenePermission({
  onNext,
  onSkip,
}: {
  onNext: () => void
  /**
   * La porte de sortie, ouverte seulement après DEUX refus.
   *
   * Elle n'existe pas par gentillesse : sans elle, cet écran est un cul-de-sac
   * (le seul bouton renvoie aux Réglages, en boucle), et on y arrive APRÈS le
   * paiement. Un reviewer Apple qui refuse la permission — ce que beaucoup
   * font exprès pour éprouver les chemins d'erreur — se retrouve enfermé dans
   * une app qu'il vient d'acheter : c'est un rejet 2.1 (« the app got stuck »),
   * et pour un vrai utilisateur un remboursement.
   *
   * Elle saute les étapes qui EXIGENT l'autorisation (choix des apps, première
   * règle) et mène droit à l'app, où le blocage reste inerte tant que la
   * permission n'est pas accordée — un état que l'app sait déjà tenir, c'est
   * celui d'une autorisation révoquée en cours de route.
   */
  onSkip?: () => void
}) {
  const t = useT()
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
      ? t('home.permission_open_settings')
      : denied === 1
        ? t('common.retry')
        : t('paywall.continue')

  return (
    <View style={styles.guideScene}>
      <Reveal index={0} style={styles.guideHeroWrap}>
        <Text style={styles.heroTitle}>
          {t('onboarding_power.screen_time.hero')}
        </Text>
      </Reveal>
      <View style={styles.guideMiddle}>
        <Reveal index={1}>
          <GuideCard
            title={t('onboarding_power.screen_time.card_title')}
            body={t('onboarding_power.screen_time.card_body')}
            leftLabel={continueLabel}
            rightLabel={t('onboarding_power.dont_allow')}
            activeSide="left"
            onActivePress={cardAction}
            activeBusy={busy}
            dimmed={dimmed}
          />
        </Reveal>
        {denied > 0 ? (
          <View style={{ marginTop: 18 }}>
            {/*
              Deux messages, pas un. Au premier refus on insiste, parce que
              c'est souvent un réflexe et que le dialogue iOS repassera. Au
              second, iOS ne le représentera plus : répéter « Relock ne peut
              pas fonctionner sans » devient un reproche adressé à quelqu'un
              qu'on retient de force. On dit alors ce qui va se passer.
            */}
            <RedAlert
              text={
                denied >= 2 && onSkip
                  ? t('onboarding_power.screen_time.denied_final')
                  : t('onboarding_power.screen_time.denied')
              }
            />
            {denied >= 2 && onSkip ? (
              <View style={styles.escapeWrap}>
                <GhostLink
                  label={t('onboarding_power.screen_time.continue_without')}
                  onPress={onSkip}
                  dim
                  underline
                />
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
      <Reveal index={2} style={styles.guideBottom}>
        <View style={styles.privacyWrap}>
          <Text style={styles.privacyText}>
            {t('onboarding_power.screen_time.privacy')}
          </Text>
          <GhostLink
            label={t('onboarding_power.learn_more')}
            onPress={learnMore}
            accent
          />
        </View>
      </Reveal>
    </View>
  )
}

// ─── Acte 4 · Notifications (refusables) ────────────────────────────────

/**
 * Même grammaire que Temps d'écran : « Autoriser » DANS la carte est le
 * seul bouton, et c'est lui qui ouvre la fenêtre système. Il y avait ici
 * un « Continuer » sous la carte pendant que la flèche pointait
 * « Autoriser » — deux cibles pour une seule action, donc une hésitation.
 * Le refus reste possible (dans la fenêtre iOS, pas ici) : les rappels
 * sont un plus, jamais une condition, et on avance dans les deux cas.
 */
export function SceneNotifs({ onNext }: { onNext: () => void }) {
  const t = useT()
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
          {t('onboarding_power.notifs.hero')}
        </Text>
      </Reveal>
      <View style={styles.guideMiddle}>
        <Reveal index={1}>
          <GuideCard
            title={t('onboarding_power.notifs.card_title')}
            body={t('onboarding_power.notifs.card_body')}
            leftLabel={t('onboarding_power.dont_allow')}
            rightLabel={t('activity.state.allow')}
            activeSide="right"
            onActivePress={request}
            activeBusy={busy}
            dimmed={dimmed}
            frameVariant="notifications"
          />
        </Reveal>
      </View>
    </View>
  )
}

/*
 * L'offre a quitté ce fichier : elle vit maintenant dans
 * `src/features/onboarding/screens/PaywallScreen.tsx`, derrière sa propre
 * route. Ce n'est plus une étape du récit mais un état réévalué à chaque
 * démarrage — voir l'en-tête d'`OnboardingFlow.tsx`.
 */

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
  /**
   * La sortie de secours, sous l'alerte rouge. Volontairement discrète et
   * détachée du bloc d'alerte : c'est un recours, pas une alternative qu'on
   * met sur le même plan que l'autorisation.
   */
  escapeWrap: { alignItems: 'center', paddingTop: 14 },
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
