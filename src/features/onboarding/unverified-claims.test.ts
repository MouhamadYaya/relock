import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Aucune ALLÉGATION INVÉRIFIABLE ne doit s'afficher, nulle part.
 *
 * POURQUOI CE FICHIER EXISTE, ET POURQUOI IL EST À PART
 * Les écrans d'acquisition (intro, paywall) portent des maquettes de preuve
 * sociale : note en étoiles, volume d'utilisateurs, témoignages signés, logos
 * universitaires. Ces éléments sont écrits par nous, sur une app qui n'a
 * jamais été publiée — ils sont donc FAUX tant qu'ils ne viennent pas d'App
 * Store Connect.
 *
 * Les publier n'est pas une question de goût :
 *   - App Store 2.3.1 (métadonnées trompeuses) — motif de rejet à la revue ;
 *   - directive 2005/29/CE et art. L.121-2 du code de la consommation — un
 *     faux avis signé d'un nom est une pratique trompeuse, pas une figure de
 *     style publicitaire ;
 *   - les marques universitaires ajoutent une contrefaçon de marque et une
 *     affiliation imaginaire.
 *
 * LE GARDE-FOU EST UN SEUL INTERRUPTEUR
 * `featureFlags.showUnverifiedSocialProof`, à `false`. Il a remplacé des `__DEV__`
 * éparpillés sur quatre fichiers, pour deux raisons : `__DEV__` laissait la
 * maquette visible en développement (donc sur les captures et les démos), et
 * quatre gardes indépendants se rallument un par un sans que personne ne voie
 * l'ensemble. Un flag unique porte la marche à suivre complète et se bascule
 * d'une ligne.
 *
 * Ce test inspecte la SOURCE, pas le rendu : l'invariant n'est pas « ça
 * s'affiche bien » (couvert par les tests de composants) mais « rien de tout
 * cela ne peut sortir sans qu'on l'ait décidé ». C'est une propriété du texte
 * des fichiers, elle se vérifie sur le texte des fichiers.
 *
 * Il vit à part des tests de composants pour la raison qui a motivé
 * `privacy-commitments.test.ts` : une réécriture de `PaywallPlans.test.tsx`
 * emporterait un test qui y serait rangé. Ici, non.
 *
 * SI CE TEST ÉCHOUE : ce n'est pas le test qu'il faut changer. Soit les preuves
 * sont devenues RÉELLES — auquel cas on suit la procédure écrite sur le flag,
 * dans l'ordre, et on met CE fichier à jour en dernier — soit elles ne le sont
 * pas, et elles retournent derrière le flag.
 */

const ROOT = join(__dirname, '..', '..', '..')
const read = (...parts: string[]) => readFileSync(join(ROOT, ...parts), 'utf8')

const featureFlags = read('src', 'config', 'feature-flags.ts')
const scenesIntro = read('src', 'features', 'onboarding', 'scenes-intro.tsx')
const paywallPlans = read(
  'src',
  'features',
  'onboarding',
  'components',
  'paywall',
  'PaywallPlans.tsx',
)
const paywallBenefits = read(
  'src',
  'features',
  'onboarding',
  'components',
  'paywall',
  'PaywallBenefits.tsx',
)

const FLAG = 'featureFlags.showUnverifiedSocialProof'

/**
 * Le fichier privé de ses commentaires.
 *
 * Indispensable ici : les commentaires de ces fichiers CITENT les allégations
 * masquées, pour expliquer pourquoi elles le sont. Les scanner reviendrait à
 * interdire d'écrire la raison du garde-fou — le test se mordrait la queue.
 */
function code(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ')
}

/**
 * Vrai si `marker` est à l'intérieur d'un `{FLAG ? ( … ) : null}`.
 *
 * On remonte du marqueur vers l'ouverture la plus proche plutôt que de
 * découper le fichier : les blocs sont imbriqués et une simple recherche
 * « avant/après » se ferait piéger par le premier garde du fichier.
 */
function isFlagGated(source: string, marker: string): boolean {
  const at = source.indexOf(marker)
  if (at === -1) return false
  const opened = source.lastIndexOf(`{${FLAG} ?`, at)
  if (opened === -1) return false
  const closed = source.indexOf(') : null}', opened)
  return closed === -1 || closed > at
}

describe('allégations invérifiables', () => {
  describe('l’interrupteur', () => {
    it('est à false', () => {
      expect(featureFlags).toMatch(/showUnverifiedSocialProof:\s*false/)
    })

    it('porte la marche à suivre pour le rallumer', () => {
      // Sans elle, le prochain qui le bascule ne saura pas qu'il faut d'abord
      // remplacer les textes, ni que les blasons ne sont pas couverts.
      expect(featureFlags).toMatch(/POUR RÉACTIVER/)
    })
  })

  describe('écran d’intro (preuve sociale)', () => {
    it('ne montre les chiffres d’audience que derrière l’interrupteur', () => {
      // Masqué, `StudyLine` reprend la place avec un chiffre public qui ne
      // parle pas de Relock.
      expect(code(scenesIntro)).toMatch(
        /const SOCIAL_PROOF[^=]*=\s*featureFlags\.showUnverifiedSocialProof/,
      )
    })

    it('ne laisse aucun chiffre d’audience hors de l’interrupteur', () => {
      // Attrape « 12K+ avis », « 300K d'utilisateurs », « 250 000+ personnes ».
      // Sur le code seul : les commentaires citent ces chaînes à dessein.
      const withoutGuarded = code(scenesIntro).replace(
        /featureFlags\.showUnverifiedSocialProof[\s\S]*?:\s*null/,
        ' ',
      )
      expect(withoutGuarded).not.toMatch(
        /\d[\d\s]*[KM]?\+?\s*(avis|utilisateurs|téléchargements)/i,
      )
    })
  })

  describe('paywall', () => {
    it('ne montre le témoignage signé que derrière l’interrupteur', () => {
      expect(isFlagGated(paywallPlans, "paywall_reference.testimonial'")).toBe(
        true,
      )
    })

    it('ne montre les témoignages secondaires que derrière l’interrupteur', () => {
      expect(isFlagGated(paywallPlans, 'paywall_reference.testimonial_')).toBe(
        true,
      )
    })

    it('ne montre le compteur d’avis et d’utilisateurs que derrière l’interrupteur', () => {
      expect(isFlagGated(paywallBenefits, 'paywall_reference.reviews')).toBe(
        true,
      )
      expect(isFlagGated(paywallBenefits, 'paywall_reference.users')).toBe(true)
    })

    it('ne montre les marques universitaires que derrière l’interrupteur', () => {
      // Oxford / Harvard / Cambridge : contrefaçon de marque ET affiliation
      // imaginaire. Le rendu vit dans PaywallArtwork, l'appel ici.
      expect(isFlagGated(paywallBenefits, '<PaywallTrustLogos')).toBe(true)
    })
  })

  describe('régression : retour à __DEV__', () => {
    it('ne regarde plus __DEV__ pour ces blocs', () => {
      // `__DEV__` rendrait la maquette de nouveau visible en développement —
      // donc sur les captures d'écran et les démos. C'est précisément ce que
      // l'interrupteur unique a remplacé.
      for (const source of [paywallPlans, paywallBenefits]) {
        expect(code(source)).not.toMatch(/\{__DEV__ \?/)
      }
    })
  })
})
