import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Les contrôles que la POLITIQUE DE CONFIDENTIALITÉ PUBLIÉE promet à
 * l'utilisateur doivent exister dans l'app.
 *
 * POURQUOI CE FICHIER EXISTE, ET POURQUOI IL EST SÉPARÉ
 * Le site de `src/legal/` est déployé publiquement (`npm run legal:deploy`) et
 * l'écran Réglages y renvoie. Une promesse qui y figure est un engagement :
 * App Store 5.1.1, et RGPD pour l'opt-out de télémétrie.
 *
 * L'interrupteur « rapports d'anomalie » a déjà disparu DEUX FOIS de refontes
 * successives de l'écran, sans que rien ne le signale — ni `tsc`, ni biome
 * (`noUnusedImports` n'est pas activé, l'import devenu mort passait), ni les
 * tests de l'écran, réécrits en même temps que lui.
 *
 * D'où ce fichier À PART : il ne vit pas à côté de `SettingsScreen`, donc une
 * réécriture de `SettingsScreen.test.tsx` ne l'emporte pas.
 *
 * Il inspecte la SOURCE plutôt que le rendu, à dessein. L'invariant tenu ici
 * n'est pas « l'interrupteur fonctionne » — c'est le comportement, couvert par
 * `SettingsScreen.test.tsx` — mais « l'app n'affirme rien qu'elle n'offre
 * pas ». C'est une question de cohérence entre deux fichiers, et elle se
 * vérifie sur les deux fichiers.
 *
 * SI CE TEST ÉCHOUE : ce n'est pas le test qu'il faut changer. Soit on remet
 * le contrôle, soit on retire la promesse de `src/legal/` ET on redéploie le
 * site — auquel cas il faut aussi mettre à jour ce test.
 */

const ROOT = join(__dirname, '..', '..', '..')
const read = (...parts: string[]) => readFileSync(join(ROOT, ...parts), 'utf8')

const privacyPolicy = read('src', 'legal', 'privacy', 'index.html')
const settingsScreen = read(
  'src',
  'features',
  'settings',
  'screens',
  'SettingsScreen.tsx',
)

describe('engagements de la politique de confidentialité', () => {
  describe('opt-out des rapports d’anomalie', () => {
    /** La promesse, telle qu'elle est servie aux utilisateurs. */
    const PROMISE = 'crash reporting in Settings'

    it('la politique publiée promet bien un réglage', () => {
      // Si cette ligne casse, la promesse a été reformulée ou retirée :
      // vérifier alors que les attentes ci-dessous ont toujours un sens.
      expect(privacyPolicy).toContain(PROMISE)
    })

    it('l’écran Réglages offre l’interrupteur promis', () => {
      expect(settingsScreen).toContain("t('settings.crash_reports')")
    })

    it('l’interrupteur coupe le SDK, pas seulement nos appels', () => {
      // `setPreference` seul ne ferait taire que les appels de notre code :
      // crashs natifs, sessions, traces et replay partiraient encore.
      expect(settingsScreen).toContain('applyCrashReportsPreference(')
    })

    it('le libellé existe dans toutes les locales', () => {
      for (const locale of ['en', 'de', 'fr', 'ru']) {
        const messages = JSON.parse(
          read('src', 'i18n', 'locales', `${locale}.json`),
        )
        expect(messages.settings.crash_reports).toBeTruthy()
        expect(messages.settings.crash_reports_hint).toBeTruthy()
      }
    })
  })
})
