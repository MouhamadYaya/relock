import {
  compositeOver,
  contrastRatio,
  luminance,
  parseHex,
} from '@/features/settings/theme/contrast'
import { settingsTheme } from '@/shared/theme'

const { colors } = settingsTheme

/**
 * La couleur réellement vue par l'œil : le voile de la carte, composé sur le
 * fond de page. C'est sur elle que tous les seuils sont mesurés — pas sur le
 * `rgba` brut, qui ne correspond à aucune surface existante.
 */
const CARD = compositeOver(colors.card, colors.bg)

describe('contraste des Réglages', () => {
  it('compose correctement une carte translucide sur le fond', () => {
    expect(parseHex(CARD)).toBeDefined()
    // Une carte à 4,5 % de blanc éclaircit à peine : c'est le parti pris
    // Opal, sobre. Elle doit rester PLUS CLAIRE que le fond, sans quoi elle
    // n'est plus une carte.
    expect(luminance(CARD)).toBeGreaterThan(luminance(colors.bg))
    expect(compositeOver('rgba(255,255,255,1)', colors.bg)).toBe('#ffffff')
    expect(compositeOver('rgba(255,255,255,0)', colors.bg)).toBe(
      colors.bg.toLowerCase(),
    )
  })

  it('rend le texte principal parfaitement lisible sur la carte', () => {
    // AAA (7:1) pour l'intitulé d'une ligne : c'est le texte qu'on balaie.
    expect(contrastRatio(colors.textPrimary, CARD)).toBeGreaterThan(7)
    expect(contrastRatio(colors.textPrimary, colors.bg)).toBeGreaterThan(7)
  })

  it('garde le texte secondaire au-dessus du seuil AA', () => {
    // Sous-titres explicatifs et valeurs de droite.
    expect(contrastRatio(colors.textSecondary, CARD)).toBeGreaterThan(4.5)
  })

  it('rend les notes sous les cartes RÉELLEMENT lisibles', () => {
    // 4,5:1, le seuil du texte courant — et non les 3:1 d'un élément
    // décoratif. Ces notes portent des conditions (« la résiliation passe par
    // l'App Store ») : un texte qu'on ne lit pas parce qu'il est trop pâle
    // est un texte qui n'existe pas.
    expect(contrastRatio(colors.textTertiary, CARD)).toBeGreaterThan(4.5)
    expect(contrastRatio(colors.textTertiary, colors.bg)).toBeGreaterThan(4.5)
  })

  it('rend les icônes monochromes lisibles sur la carte', () => {
    expect(contrastRatio(colors.icon, CARD)).toBeGreaterThan(4.5)
  })

  it('rend chaque état lisible : accordé, refusé, destructeur', () => {
    for (const state of [colors.success, colors.danger]) {
      expect(contrastRatio(state, CARD)).toBeGreaterThan(3)
    }
  })

  it('rend le libellé d’un bouton lisible sur son remplissage', () => {
    expect(contrastRatio(colors.textPrimary, colors.accent)).toBeGreaterThan(3)
    expect(contrastRatio(colors.textPrimary, colors.danger)).toBeGreaterThan(3)
  })

  it('rend le badge PRO lisible sur son fond violet pâle', () => {
    expect(
      contrastRatio(colors.accent, compositeOver(colors.accentSoft, CARD)),
    ).toBeGreaterThan(3)
  })

  it('calcule un rapport de contraste conforme à WCAG', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 5)
    expect(contrastRatio('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 5)
    expect(luminance('#FFFFFF')).toBeCloseTo(1, 5)
    expect(luminance('#000000')).toBeCloseTo(0, 5)
  })
})
