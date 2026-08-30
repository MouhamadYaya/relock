// Carte héro Accueil — nouvel utilisateur (aucun blocage). Maquette
// « HomePourNewUser » : titre + pitch, lune décorative, CTA plein.
//
// La colonne de texte est en `flex: 1` et la lune vit dans une zone réservée
// de largeur FIXE (pas en position absolue par-dessus le texte) : sur un
// écran plus étroit (iPhone 17 Pro vs Max), le texte ne peut donc jamais
// glisser sous la lune — la mise en page reste sûre par construction, pas
// par un réglage de taille qui casse sur un autre device.
import { router } from 'expo-router'
import React from 'react'
import { Image, Pressable, StyleSheet, Text, View } from 'react-native'
import { fonts } from '@/shared/theme/tokens/fonts'

const C = {
  card: '#0E0D16',
  cardBorder: 'rgba(148,158,181,0.16)',
  ink: '#F5F5F7',
  ink65: 'rgba(224,224,235,0.62)',
  accent: '#8B7CF6',
  onAccent: '#161226',
}

const FW = { 400: fonts.regular, 700: fonts.bold, 800: fonts.bold } as const
const f = (w: keyof typeof FW) => FW[w]

export function EmptyProtectionCard() {
  return (
    <View style={s.shadowWrap}>
      <View style={s.card}>
        <View style={s.top}>
          <View style={s.textCol}>
            <Text style={[f(800), s.title]}>
              Ton attention{'\n'}n'est pas encore{'\n'}protégée
            </Text>
            <Text style={[f(400), s.sub]}>
              Crée ta première protection{'\n'}pour commencer à reprendre{'\n'}
              le contrôle.
            </Text>
          </View>
          <View style={s.moonZone}>
            <Image
              source={require('@assets/home-demilune2.png')}
              style={s.moon}
              resizeMode="contain"
            />
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Créer ma première protection"
          onPress={() => router.push('/add-block')}
          style={s.cta}
        >
          <Text style={[f(700), s.ctaTxt]}>Créer ma première protection</Text>
        </Pressable>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  shadowWrap: {
    marginTop: 20,
    borderRadius: 24,
    shadowColor: '#000000',
    shadowOpacity: 0.4,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  card: {
    backgroundColor: C.card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: C.cardBorder,
    padding: 22,
    overflow: 'hidden',
  },
  top: { flexDirection: 'row', alignItems: 'flex-start' },
  textCol: { flex: 1, minWidth: 0 },
  title: { fontSize: 24, color: C.ink, letterSpacing: -0.5, lineHeight: 29 },
  sub: {
    fontSize: 14,
    color: C.ink65,
    lineHeight: 20,
    marginTop: 10,
  },
  moonZone: {
    width: 118,
    height: 175,
    marginLeft: -8,
  },
  moon: {
    position: 'absolute',
    right: -34,
    top: -8,
    width: 175,
    height: 175,
  },
  cta: {
    marginTop: 20,
    height: 54,
    borderRadius: 27,
    backgroundColor: C.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: C.accent,
    shadowOpacity: 0.5,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  ctaTxt: { fontSize: 16, color: C.onAccent, letterSpacing: -0.1 },
})
