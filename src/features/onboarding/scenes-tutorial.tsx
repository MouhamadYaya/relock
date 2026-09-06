/**
 * Acte 6 · Tutoriel — les six écrans qui suivent le paywall.
 *
 * Ce n'est pas de la pédagogie décorative : les trois derniers écrans
 * PRODUISENT l'état de départ de l'app. L'utilisateur choisit ses apps dans
 * le vrai sélecteur d'Apple, choisit une règle parmi les préréglages réels,
 * et arrive dans l'app avec ce blocage déjà armé (voir `useActivateFirstRule`).
 *
 * Les démonstrations sont des vidéos en boucle plutôt que des captures
 * fixes : montrer le rituel de respiration et le sélecteur système en
 * mouvement dit en trois secondes ce qu'un paragraphe explique mal.
 *
 * Textes FR en dur, comme le reste de l'onboarding (exception i18n assumée
 * de cet espace narratif). Les cartes de règles font exception : elles
 * réutilisent telles quelles les 12 fiches de `rule-templates.ts`, donc leur
 * copie passe par `t()` — une seule définition de « ce que propose Travail ».
 */
import { IconName } from '@assets/icons'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  useWindowDimensions,
  View,
} from 'react-native'
import Animated, {
  Easing,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, { Circle, Defs, LinearGradient, Rect, Stop } from 'react-native-svg'
import { NEW_RULE_PRESET_IDS } from '@/features/blocking/presets'
import {
  buildRuleTemplates,
  type RuleTemplateCard as RuleTemplate,
} from '@/features/blocking/rule-templates'
import { prioritizePlanTemplates } from '@/features/onboarding/services/personalizedPlan'
import { useT } from '@/i18n/useT'
import { IconSvg } from '@/shared/components/ui/IconSvg'
import { ScreenTime } from '@/shared/native/screen-time'
import { fonts } from '@/shared/theme/tokens/fonts'
import { spacing } from '@/shared/theme/tokens/spacing'
import { showErrorToast } from '@/shared/utils/toast'
import { Footnote, GhostLink, Moon, Pill, RedAlert } from './bits'
import { LockAnimation } from './LockAnimation'
import { Reveal } from './motion'
import { OnboardingRuleCard } from './OnboardingRuleCard'
import { PickerAnimation } from './PickerAnimation'
import { haptic, OB } from './tokens'

/** Hauteur prise par le titre, le CTA et les marges sûres de l'écran verrouillage. */
const LOCK_SCENE_CHROME = 300
/**
 * Attente imposée sur l'écran de démonstration du sélecteur — calée sur la
 * fin de la seconde coche dans `PickerAnimation`. À ré-ajuster si sa
 * chronologie change.
 */
const PICKER_UNLOCK_MS = 4400

/** Proportion de l'appareil dessiné par `LockAnimation` (partiel, bas effacé). */
const LOCK_PHONE_RATIO = 1.42

/** Nombre de préréglages proposés à la fin — assez pour choisir, pas pour hésiter. */
const RULES_SHOWN = 8

/**
 * Deux règles cochées d'entrée : un écran qui n'attend qu'un geste laisse
 * croire qu'il n'y a rien à faire, et un onboarding qui se termine sur zéro
 * protection a échoué. Ce sont les deux premières du carrousel — il n'a rien
 * à chercher pour comprendre ce que « sélectionné » veut dire.
 */
export const DEFAULT_RULE_PRESET_IDS: string[] = [
  NEW_RULE_PRESET_IDS.work,
  NEW_RULE_PRESET_IDS.focus,
]

// ─── Gabarits partagés ───────────────────────────────────────────────────

/**
 * Gabarit des écrans du tutoriel : titre centré, sous-titre, une scène
 * visuelle qui prend toute la place restante, un CTA en bas. C'est le rythme
 * des six écrans — la constance vaut mieux que six mises en page.
 */
function TutorialScene({
  title,
  sub,
  badge,
  children,
  footer,
}: {
  title: string
  sub?: string
  badge?: string
  children: React.ReactNode
  footer: React.ReactNode
}) {
  return (
    <View style={styles.scene}>
      <View style={styles.header}>
        {badge ? (
          <Reveal index={0}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{badge}</Text>
            </View>
          </Reveal>
        ) : null}
        <Reveal index={badge ? 1 : 0}>
          <Text style={styles.title}>{title}</Text>
        </Reveal>
        {sub ? (
          <Reveal index={badge ? 2 : 1}>
            <Text style={styles.sub}>{sub}</Text>
          </Reveal>
        ) : null}
      </View>
      <View style={styles.stage}>{children}</View>
      <Reveal index={3} style={styles.footer}>
        {footer}
      </Reveal>
    </View>
  )
}

/**
 * Cadre de téléphone : la vidéo de démo doit se lire comme « un écran de
 * l'app », pas comme une image collée dans la page. Le ratio suit celui des
 * captures (2.17), et la vidéo est rognée dedans plutôt qu'étirée.
 */
function PhoneFrame({
  width,
  children,
}: {
  width: number
  children: React.ReactNode
}) {
  return (
    <View
      style={[
        styles.phone,
        {
          width,
          height: width * PHONE_RATIO,
          borderRadius: width * 0.155,
        },
      ]}
    >
      <View
        style={[styles.phoneScreen, { borderRadius: width * 0.155 - 4 }]}
        // Purement illustratif : rien n'est cliquable dans le cadre.
        pointerEvents="none"
      >
        {children}
      </View>
    </View>
  )
}

const PHONE_RATIO = 2.17

/** Largeur du cadre téléphone : la scène disponible commande, jamais l'inverse. */
function usePhoneWidth(maxHeightRatio = 1) {
  const { width, height } = useWindowDimensions()
  return useMemo(() => {
    const byWidth = width * 0.62
    const byHeight = (height * 0.46 * maxHeightRatio) / PHONE_RATIO
    return Math.round(Math.min(byWidth, byHeight))
  }, [width, height, maxHeightRatio])
}

// ─── 1 · Les règles de base ──────────────────────────────────────────────

/** Respiration entre le paywall et le tutoriel : la lune, une phrase, rien d'autre. */
export function SceneGroundRules({ onNext }: { onNext: () => void }) {
  // `OnboardingFlow` pose la scène dans un conteneur à `paddingTop`. Sans ce
  // débord, le dégradé démarrerait SOUS la status bar : couture nette entre le
  // noir uni du haut et le violet du ciel (même piège que `HaloBackdrop`).
  const insets = useSafeAreaInsets()
  const overscan = insets.top + 6
  const stars = useMemo(
    () =>
      Array.from({ length: 40 }, (_, i) => ({
        key: `t${i}`,
        x: (i * 137.5) % 100,
        y: ((i * 61.8) % 92) + 3,
        r: 0.6 + ((i * 7) % 10) / 9,
        o: 0.2 + ((i * 13) % 10) / 24,
      })),
    [],
  )

  return (
    <View style={styles.ground}>
      <Svg
        style={[StyleSheet.absoluteFill, { top: -overscan }]}
        width="100%"
        height="100%"
      >
        <Defs>
          <LinearGradient id="tutoSky" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor="#0E0B1E" />
            <Stop offset="100%" stopColor="#050507" />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#tutoSky)" />
        {stars.map(s => (
          <Circle
            key={s.key}
            cx={`${s.x}%`}
            cy={`${s.y}%`}
            r={s.r}
            fill="#FFFFFF"
            opacity={s.o}
          />
        ))}
      </Svg>
      <View style={styles.groundContent}>
        <View style={styles.groundCenter}>
          <Reveal index={0}>
            <Moon size={168} glow />
          </Reveal>
          <Reveal index={2}>
            <Text style={styles.groundTitle}>
              Super. Maintenant, fixons{`\n`}quelques règles de base.
            </Text>
          </Reveal>
        </View>
        <Reveal index={3} style={styles.footer}>
          <Pill label="Continuer" onPress={onNext} />
        </Reveal>
      </View>
    </View>
  )
}

// ─── 2 · Ce que fait une règle ───────────────────────────────────────────

/**
 * La démonstration du blocage programmé, dessinée et animée en JS — pas une
 * vidéo : une capture pèse des mégaoctets, met du temps à s'amorcer, et fige
 * un rendu qui ne suivra jamais un futur changement de palette.
 */
export function SceneLockDemo({ onNext }: { onNext: () => void }) {
  // Cet appareil-là n'est pas rogné au ratio d'un vrai iPhone : on n'en montre
  // que le haut (le bas s'efface), donc `usePhoneWidth` — calibré sur 2.17 —
  // le rapetissait de moitié. On dimensionne sur la hauteur réellement libre.
  const { width: screenW, height: screenH } = useWindowDimensions()
  const width = Math.round(
    Math.min(screenW * 0.74, (screenH - LOCK_SCENE_CHROME) / LOCK_PHONE_RATIO),
  )

  return (
    <TutorialScene
      title={'Les règles bloquent les Apps\nà des heures précises.'}
      footer={<Pill label="Continuer" onPress={onNext} />}
    >
      <Reveal index={2}>
        <LockAnimation width={width} />
      </Reveal>
    </TutorialScene>
  )
}

// ─── 3 · Le Hard Mode ────────────────────────────────────────────────────

/**
 * Le seul écran du tutoriel où l'on demande un engagement. Le bouton n'est
 * PAS une maquette : sa valeur part dans `config.strict` de la règle créée à
 * la fin (voir `useActivateFirstRule`) — un écran qui promet un choix et n'en
 * applique aucun est un mensonge poli.
 */
export function SceneHardMode({
  value,
  onChange,
  onNext,
}: {
  value: boolean
  onChange: (v: boolean) => void
  onNext: () => void
}) {
  const width = usePhoneWidth()

  return (
    <TutorialScene
      title="Prêt à t'engager à fond ?"
      sub="Avec le Hard Mode, tu ne peux ni débloquer temporairement une app, ni arrêter la règle avant la fin."
      footer={
        <>
          <Pill label="Continuer" onPress={onNext} />
          <Footnote
            text={
              value
                ? 'Hard Mode activé sur ta première règle. Tu pourras le retirer sur les suivantes.'
                : 'Tu pourras l’activer plus tard, règle par règle.'
            }
          />
        </>
      }
    >
      <Reveal index={2}>
        <View style={{ width, height: width * PHONE_RATIO }}>
          <PhoneFrame width={width}>
            <View style={styles.mockList}>
              {[1, 0.72, 0.5, 0.32].map(o => (
                <View
                  key={`row-${o}`}
                  style={[styles.mockRow, { opacity: o }]}
                />
              ))}
            </View>
          </PhoneFrame>
          {/* Posée par-dessus le cadre, à cheval sur ses bords : c'est le
              geste qui compte, pas le décor derrière. */}
          <View style={styles.hardModeBar}>
            <Text style={styles.hardModeLabel}>Hard Mode</Text>
            <Switch
              value={value}
              onValueChange={v => {
                haptic.select()
                onChange(v)
              }}
              accessibilityLabel="Hard Mode"
              trackColor={{ false: 'rgba(120,120,128,0.32)', true: OB.accent }}
              thumbColor="#FFFFFF"
              ios_backgroundColor="rgba(120,120,128,0.32)"
            />
          </View>
        </View>
      </Reveal>
    </TutorialScene>
  )
}

// ─── 4 · La démo du sélecteur ────────────────────────────────────────────

/**
 * Aide facultative depuis la sélection, sans étape supplémentaire du parcours.
 * La démonstration ne modifie jamais la sélection enregistrée par Apple.
 */
export function ScenePickerDemo({ onNext }: { onNext: () => void }) {
  const { width } = useWindowDimensions()
  const reduceMotion = useReducedMotion()
  const [ready, setReady] = useState(false)
  const gate = useSharedValue(0)

  // Passage OBLIGÉ : sans ce verrou, l'écran se saute en une demi-seconde et
  // l'utilisateur ouvre le vrai sélecteur d'Apple sans avoir vu qu'il faut
  // déplier une catégorie — c'est précisément là qu'il se bloque.
  //
  // On déverrouille dès la seconde coche : le repli qui suit n'apprend plus
  // rien, et chaque seconde d'attente en plus se paie en abandons.
  useEffect(() => {
    if (reduceMotion) {
      // Illustration figée : rien à regarder, donc rien à imposer.
      gate.value = 1
      setReady(true)
      return
    }
    gate.value = withTiming(1, {
      duration: PICKER_UNLOCK_MS,
      easing: Easing.linear,
    })
    const timer = setTimeout(() => setReady(true), PICKER_UNLOCK_MS)
    return () => clearTimeout(timer)
  }, [gate, reduceMotion])

  return (
    <TutorialScene
      title="Choisis tes plus grandes distractions"
      sub="Les apps sont rangées par catégorie."
      footer={
        <Pill
          label={ready ? 'J’ai compris' : 'Regarde la démonstration'}
          onPress={onNext}
          disabled={!ready}
          progress={gate}
        />
      }
    >
      <Reveal index={2}>
        <PickerAnimation width={Math.min(width - 40, 380)} />
      </Reveal>
    </TutorialScene>
  )
}

// ─── 5 · Le vrai sélecteur ───────────────────────────────────────────────

/**
 * Le seul passage obligé du tutoriel. Sans sélection, il n'y a rien à
 * bloquer : on refuse d'avancer, et on renvoie vers la démo plutôt que de
 * répéter la même consigne — s'il n'a rien choisi, c'est souvent qu'il n'a
 * pas compris l'écran système, pas qu'il a changé d'avis.
 */
export function ScenePickApps({
  count,
  onCount,
  onNext,
}: {
  count: number
  onCount: (n: number) => void
  onNext: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [emptyTry, setEmptyTry] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const pickerOpen = useRef(false)

  const pick = useCallback(async () => {
    if (pickerOpen.current) return
    pickerOpen.current = true
    setBusy(true)
    try {
      if (!ScreenTime.isAvailable) {
        // Android / build sans le module : il n'y a pas de sélecteur système,
        // donc rien à exiger. Bloquer ici enfermerait dans l'onboarding pour
        // une étape que la plateforme ne peut pas rendre.
        onNext()
        return
      }
      const { count: picked } = await ScreenTime.presentPicker()
      onCount(picked)
      if (picked > 0) {
        haptic.success()
        setEmptyTry(false)
      } else {
        setEmptyTry(true)
      }
    } catch (e) {
      showErrorToast(e)
    } finally {
      pickerOpen.current = false
      setBusy(false)
    }
  }, [onCount, onNext])

  const picked = count > 0

  if (showHelp) {
    return <ScenePickerDemo onNext={() => setShowHelp(false)} />
  }

  return (
    <TutorialScene
      title="Choisis tes distractions"
      sub="Déplie une catégorie dans le sélecteur Apple, puis coche les apps à bloquer."
      footer={
        <>
          <Pill
            label={picked ? 'Continuer' : 'Ouvrir le sélecteur'}
            onPress={picked ? onNext : pick}
            disabled={busy}
          />
          <View style={{ paddingVertical: spacing.sm }}>
            <GhostLink
              label="Voir comment faire"
              onPress={() => {
                if (!pickerOpen.current) setShowHelp(true)
              }}
              accent
            />
          </View>
        </>
      }
    >
      <View style={styles.pickStage}>
        <Reveal index={2}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              picked
                ? `${count} élément${count > 1 ? 's' : ''} sélectionné${count > 1 ? 's' : ''}. Modifier la sélection.`
                : 'Ouvrir le sélecteur d’apps'
            }
            onPress={pick}
            disabled={busy}
            style={[styles.pickCard, picked && styles.pickCardDone]}
          >
            {busy ? (
              <ActivityIndicator color={OB.accent} />
            ) : (
              <>
                <View style={[styles.pickIcon, picked && styles.pickIconDone]}>
                  <IconSvg
                    name={picked ? IconName.CHECK : IconName.PLUS}
                    size={26}
                    color={picked ? OB.onAccent : OB.ink}
                  />
                </View>
                <Text style={styles.pickCount}>
                  {picked
                    ? `${count} élément${count > 1 ? 's' : ''} sélectionné${count > 1 ? 's' : ''}`
                    : 'Aucune app sélectionnée'}
                </Text>
                <Text style={styles.pickHint}>
                  {picked
                    ? 'Touche pour modifier'
                    : 'Touche pour ouvrir le sélecteur d’Apple'}
                </Text>
              </>
            )}
          </Pressable>
        </Reveal>
        {emptyTry && !picked ? (
          <View style={styles.pickAlert}>
            <RedAlert text="Relock n’a rien à bloquer tant que tu n’as choisi aucune app. Choisis-en au moins une pour continuer." />
          </View>
        ) : null}
      </View>
    </TutorialScene>
  )
}

// ─── 6 · Les règles proposées ────────────────────────────────────────────

/**
 * Les VRAIES fiches de préréglages de l'app (`rule-templates.ts`), pas des
 * illustrations : ce qu'il choisit ici est exactement ce qu'il retrouvera
 * dans l'onglet Blocages une minute plus tard.
 */
export function SceneRules({
  name,
  recommendedIds,
  selectedIds,
  onToggle,
  busy,
  onActivate,
}: {
  name: string
  recommendedIds: string[]
  selectedIds: string[]
  onToggle: (template: RuleTemplate) => void
  busy: boolean
  onActivate: () => void
}) {
  const t = useT()
  const { width } = useWindowDimensions()
  const templates = useMemo(
    () =>
      prioritizePlanTemplates(
        buildRuleTemplates(t),
        recommendedIds,
        RULES_SHOWN,
      ),
    [t, recommendedIds],
  )

  // Carte volontairement plus large que haute : en `cover`, une carte étroite
  // et haute ne montrait qu'une bande verticale centrale de photos en 3:2 —
  // « tronquées ». À 298×255 le recadrage ne mange plus que les bords.
  const cardWidth = Math.round(width * 0.76)
  const gap = 14
  const sidePad = Math.round((width - cardWidth) / 2)
  const count = selectedIds.length
  // Le CTA compte ce qui est coché : promettre « ces règles » quand une seule
  // est choisie ferait douter de ce qui va réellement s'allumer.
  const plural = count > 1

  return (
    <TutorialScene
      title={
        name
          ? `${name}, voici les règles que je te propose`
          : 'Voici les règles que je te propose'
      }
      sub="Garde celles qui te parlent, décoche les autres. Tu en ajouteras d’autres quand tu voudras."
      footer={
        <>
          <Pill
            label={
              busy
                ? 'Activation…'
                : plural
                  ? `Activer ces ${count} règles`
                  : 'Activer cette règle'
            }
            onPress={onActivate}
            disabled={count === 0 || busy}
          />
          <Footnote
            text={
              plural
                ? 'Elles seront actives dès ton entrée dans l’app.'
                : 'Elle sera active dès ton entrée dans l’app.'
            }
          />
        </>
      }
    >
      <View style={styles.railStage}>
        <ScrollView
          horizontal
          decelerationRate="fast"
          snapToInterval={cardWidth + gap}
          snapToAlignment="start"
          disableIntervalMomentum
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: sidePad, gap }}
        >
          {templates.map(template => (
            <View
              key={template.id}
              style={[styles.railSlot, { width: cardWidth }]}
            >
              <OnboardingRuleCard
                image={template.image}
                kind={template.kind}
                time={template.time}
                title={template.title}
                description={template.description}
                selected={selectedIds.includes(template.presetId)}
                onToggle={() => {
                  haptic.select()
                  onToggle(template)
                }}
              />
            </View>
          ))}
        </ScrollView>
      </View>
    </TutorialScene>
  )
}

// ─── Styles ──────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scene: { flex: 1, paddingHorizontal: 20 },
  header: { paddingTop: 18, alignItems: 'center' },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  footer: { gap: 10, paddingBottom: 10 },

  title: {
    ...fonts.bold,
    fontSize: 27,
    lineHeight: 33,
    letterSpacing: -0.6,
    color: OB.ink,
    textAlign: 'center',
  },
  sub: {
    ...fonts.regular,
    fontSize: 15,
    lineHeight: 21,
    color: OB.ink55,
    textAlign: 'center',
    marginTop: 10,
    paddingHorizontal: 6,
  },
  badge: {
    alignSelf: 'center',
    borderWidth: 1.2,
    borderColor: OB.accent,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginBottom: 14,
  },
  badgeText: {
    ...fonts.bold,
    fontSize: 11,
    letterSpacing: 1.1,
    color: OB.accent,
  },

  phone: {
    borderWidth: 4,
    borderColor: '#1B1B1F',
    backgroundColor: '#000000',
    overflow: 'hidden',
  },
  phoneScreen: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: '#0A0A0C',
  },

  // Pas de padding ici : le ciel est un enfant `absoluteFill` direct de
  // `ground` — en RN un padding sur ce parent resserre l'enfant absolu, ce qui
  // laissait une bande noire à droite. Le padding vit dans `groundContent`.
  ground: { flex: 1 },
  groundContent: { flex: 1, paddingHorizontal: 20 },
  groundCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  groundTitle: {
    ...fonts.bold,
    fontSize: 27,
    lineHeight: 34,
    letterSpacing: -0.6,
    color: OB.ink,
    textAlign: 'center',
    marginTop: 40,
  },

  mockList: { flex: 1, padding: 14, gap: 12, justifyContent: 'center' },
  mockRow: {
    height: 64,
    borderRadius: 18,
    backgroundColor: 'rgba(164,154,254,0.22)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  hardModeBar: {
    position: 'absolute',
    left: -18,
    right: -18,
    top: '52%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 999,
    backgroundColor: 'rgba(28,28,32,0.94)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  hardModeLabel: { ...fonts.semiBold, fontSize: 18, color: OB.ink },

  pickStage: { alignItems: 'center', gap: 18, alignSelf: 'stretch' },
  pickCard: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 34,
    paddingHorizontal: 28,
    borderRadius: 26,
    backgroundColor: OB.card,
    borderWidth: 1.4,
    borderColor: OB.hairline,
    minWidth: 260,
  },
  pickCardDone: { borderColor: OB.accent, backgroundColor: '#191721' },
  pickIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: OB.accentDim,
    marginBottom: 6,
  },
  pickIconDone: { backgroundColor: OB.accent },
  pickCount: { ...fonts.semiBold, fontSize: 16, color: OB.ink },
  pickHint: {
    ...fonts.regular,
    fontSize: 13,
    color: OB.ink55,
    textAlign: 'center',
  },
  pickAlert: { alignSelf: 'stretch' },

  railStage: { alignSelf: 'stretch', marginHorizontal: -20 },
  railSlot: { height: 255 },
})
