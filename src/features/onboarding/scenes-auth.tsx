import * as AppleAuthentication from 'expo-apple-authentication'
import React, { useEffect, useMemo, useState } from 'react'
import { Image, StyleSheet, Text, View } from 'react-native'
import Svg, {
  Circle,
  ClipPath,
  Defs,
  G,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg'
import { fonts } from '@/shared/theme/tokens/fonts'
import { GradientLine, Pill } from './bits'
import { Reveal } from './motion'
import { OB } from './tokens'

// ─── Acte 5 · Compte (Apple / Google, avant le paywall) ─────────────────

const MOON = require('@assets/moon.png')

/**
 * Sphère de l'écran de compte : reprend l'image de `Moon` (bits.tsx) mais
 * avec un hémisphère droit repeint plus bleu/saturé et un liseré lumineux
 * — l'asset partagé seul rendait ce côté trop terne face à la maquette.
 */
function AuthOrb({ size }: { size: number }) {
  const g = size * 2.3
  const r = size / 2
  return (
    <View style={{ width: size, height: size }} pointerEvents="none">
      <Svg
        width={g}
        height={g}
        style={{
          position: 'absolute',
          left: (size - g) / 2,
          top: (size - g) / 2,
        }}
      >
        <Defs>
          <RadialGradient id="authOrbGlow" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor="#5B8CFF" stopOpacity={0.5} />
            <Stop offset="45%" stopColor={OB.accent} stopOpacity={0.22} />
            <Stop offset="100%" stopColor={OB.accent} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={g / 2} cy={g / 2} r={g / 2} fill="url(#authOrbGlow)" />
      </Svg>
      <Image
        source={MOON}
        style={{ width: size, height: size }}
        resizeMode="contain"
      />
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Defs>
          <ClipPath id="authOrbClip">
            <Circle cx={r} cy={r} r={r - 1} />
          </ClipPath>
          <LinearGradient id="authRightTint" x1="0%" y1="0%" x2="100%" y2="0%">
            <Stop offset="0%" stopColor="#2F6BFF" stopOpacity={0} />
            <Stop offset="100%" stopColor="#2F6BFF" stopOpacity={0.5} />
          </LinearGradient>
          <LinearGradient id="authRim" x1="0%" y1="0%" x2="100%" y2="0%">
            <Stop offset="0%" stopColor="#C9BFFF" />
            <Stop offset="55%" stopColor="#8FD4EC" />
            <Stop offset="100%" stopColor="#3B82F6" />
          </LinearGradient>
        </Defs>
        <G clipPath="url(#authOrbClip)">
          <Rect
            x={r}
            y={0}
            width={r}
            height={size}
            fill="url(#authRightTint)"
          />
        </G>
        <Circle
          cx={r}
          cy={r}
          r={r - 1.1}
          stroke="url(#authRim)"
          strokeWidth={2.2}
          fill="none"
          opacity={0.9}
        />
      </Svg>
    </View>
  )
}

/** Fond étoilé + halo ambré autour de la sphère — repris de l'artefact final. */
function AuthBackdrop() {
  const stars = useMemo(
    () =>
      Array.from({ length: 22 }, (_, i) => ({
        key: `s${i}`,
        x: (i * 97.3) % 100,
        y: ((i * 53.7) % 92) + 2,
        r: 0.6 + ((i * 7) % 10) / 10,
        o: 0.2 + ((i * 13) % 10) / 20,
      })),
    [],
  )
  return (
    <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
      <Defs>
        <LinearGradient id="authSky" x1="0%" y1="0%" x2="0%" y2="100%">
          <Stop offset="0%" stopColor="#161233" />
          <Stop offset="100%" stopColor={OB.bg} />
        </LinearGradient>
        <RadialGradient id="authHalo" cx="50%" cy="32%" r="68%">
          <Stop offset="0%" stopColor={OB.halo} stopOpacity={0.95} />
          <Stop offset="55%" stopColor={OB.halo} stopOpacity={0.4} />
          <Stop offset="100%" stopColor={OB.bg} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#authSky)" />
      <Rect width="100%" height="100%" fill="url(#authHalo)" />
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
  )
}

/** Glyphe Apple, dessiné (pas d'asset) — cohérent avec les icônes de `bits.tsx`. */
function AppleGlyph() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24">
      <Path
        fill="#0B0B10"
        d="M16.365 1.43c0 1.14-.462 2.163-1.213 2.926-.822.84-2.107 1.49-3.166 1.404-.14-1.1.44-2.253 1.19-3.02.83-.85 2.24-1.48 3.19-1.31zM20.6 17.24c-.42.97-.62 1.4-1.16 2.26-.75 1.19-1.81 2.67-3.12 2.68-1.16.01-1.46-.75-3.03-.74-1.57.01-1.9.76-3.06.75-1.31-.01-2.31-1.34-3.06-2.53-2.1-3.33-2.32-7.24-1.02-9.32.92-1.47 2.38-2.33 3.75-2.33 1.4 0 2.28.77 3.44.77 1.12 0 1.8-.77 3.42-.77 1.22 0 2.51.66 3.43 1.81-3.02 1.66-2.53 5.98.4 7.43z"
      />
    </Svg>
  )
}

/** Logo Google officiel (4 couleurs) — path public, réutilisé sans dépendance. */
function GoogleGlyph() {
  return (
    <Svg width={19} height={19} viewBox="0 0 18 18">
      <Path
        fill="#4285F4"
        d="M17.64 9.2045c0-.6381-.0573-1.2518-.1636-1.8409H9v3.4814h4.8436c-.2086 1.125-.8427 2.0782-1.7959 2.7164v2.2581h2.9087c1.7018-1.5668 2.6836-3.8741 2.6836-6.615z"
      />
      <Path
        fill="#34A853"
        d="M9 18c2.43 0 4.4673-.8059 5.9564-2.1805l-2.9087-2.2581c-.8059.54-1.8368.8591-3.0477.8591-2.3436 0-4.3282-1.5831-5.0359-3.7104H.9573v2.3318C2.4382 15.9832 5.4818 18 9 18z"
      />
      <Path
        fill="#FBBC05"
        d="M3.9641 10.71c-.18-.54-.2822-1.1168-.2822-1.71s.1023-1.17.2822-1.71V4.9582H.9573C.3477 6.1732 0 7.5477 0 9s.3477 2.8268.9573 4.0418L3.9641 10.71z"
      />
      <Path
        fill="#EA4335"
        d="M9 3.5795c1.3214 0 2.5077.4541 3.4405 1.346l2.5814-2.5814C13.4632.8918 11.4259 0 9 0 5.4818 0 2.4382 2.0168.9573 4.9582L3.9641 7.29C4.6718 5.1627 6.6564 3.5795 9 3.5795z"
      />
    </Svg>
  )
}

/** Petit cadenas — réassurance de confidentialité en pied d'écran. */
function LockGlyph() {
  return (
    <Svg width={12} height={12} viewBox="0 0 24 24">
      <Path
        fill={OB.ink28}
        d="M12 1a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2h-1V6a5 5 0 0 0-5-5zm0 2a3 3 0 0 1 3 3v3H9V6a3 3 0 0 1 3-3z"
      />
    </Svg>
  )
}

/**
 * Écran de compte, juste avant le paywall : la sphère lumineuse de
 * l'artefact réapparaît ici pour ancrer « sauvegarder » à « élévation ».
 * Sign in with Apple / Google — pas de mot de passe, pas de formulaire.
 */
export function SceneAuth({
  onApple,
  onGoogle,
  busy = false,
}: {
  onApple: () => void
  onGoogle: () => void
  busy?: boolean
}) {
  const [appleAvailable, setAppleAvailable] = useState(false)

  useEffect(() => {
    let mounted = true
    AppleAuthentication.isAvailableAsync().then(available => {
      if (mounted) setAppleAvailable(available)
    })
    return () => {
      mounted = false
    }
  }, [])

  return (
    <View style={styles.scene}>
      <AuthBackdrop />
      <View style={styles.top}>
        <Reveal index={0}>
          <AuthOrb size={168} />
        </Reveal>
        <Reveal index={1} style={styles.title}>
          <GradientLine text="Sauvegarde ta" size={35} />
          <GradientLine text="progression." size={35} />
        </Reveal>
        <Reveal index={2}>
          <Text style={styles.sub}>
            Retrouve tes habitudes, tes blocages{'\n'}
            et tes statistiques, synchronisés{'\n'}
            en toute sécurité sur tous tes appareils.
          </Text>
        </Reveal>
      </View>
      <Reveal index={3} style={styles.bottom}>
        {appleAvailable && (
          <Pill
            label="Continuer avec Apple"
            icon={<AppleGlyph />}
            onPress={onApple}
            disabled={busy}
            glow
          />
        )}
        <Pill
          label="Continuer avec Google"
          icon={<GoogleGlyph />}
          onPress={onGoogle}
          disabled={busy}
          kind="ghost"
        />
        <View style={styles.footnoteRow}>
          <LockGlyph />
          <Text style={styles.footnoteText}>
            Tes données d'activité restent privées.
          </Text>
        </View>
      </Reveal>
    </View>
  )
}

// ─── Styles ──────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scene: { flex: 1, paddingHorizontal: 20 },
  top: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { marginTop: 26, alignSelf: 'stretch' },
  sub: {
    ...fonts.regular,
    fontSize: 15.5,
    lineHeight: 22,
    color: OB.ink55,
    textAlign: 'center',
    marginTop: 14,
  },
  bottom: { gap: 10, paddingBottom: 10 },
  footnoteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 40,
  },
  footnoteText: {
    ...fonts.regular,
    fontSize: 12.5,
    color: OB.ink28,
  },
})
