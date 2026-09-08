/**
 * Soumission IndexNow — prévient Bing (et les moteurs partenaires) qu'une URL
 * a changé, sans attendre le prochain passage du robot.
 *
 * POURQUOI C'EST SÛR ICI
 * IndexNow n'exige aucun compte : la propriété du domaine se prouve en servant
 * un fichier `<clé>.txt` contenant la clé, à la racine du site. Ce fichier est
 * publié avec le reste des assets ; ce script se contente de le lire, il ne
 * fabrique aucun jeton et n'invente aucune vérification.
 *
 * Ce n'est PAS un remplacement du sitemap, seulement un raccourci de
 * fraîcheur. Google n'utilise pas IndexNow : pour Google, c'est la Search
 * Console qui sert (voir SEO-AUDIT.md, étapes manuelles).
 *
 *   node src/legal/seo-relock/tools/indexnow.mjs            # toutes les pages
 *   node src/legal/seo-relock/tools/indexnow.mjs --dry-run  # montre l'envoi
 *
 * À lancer APRÈS un déploiement : soumettre une URL qui n'est pas encore en
 * ligne fait échouer la vérification côté moteur.
 */
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const SEO = path.resolve(here, '..')
const SITE = path.resolve(SEO, '..')

const config = JSON.parse(await readFile(path.join(SEO, 'pages.json'), 'utf8'))
const host = new URL(config.origin).host

const keyFile = (await readdir(SITE)).find((f) => /^[0-9a-f]{32}\.txt$/.test(f))
if (!keyFile) {
  console.error(
    'Aucun fichier de clé IndexNow à la racine du site.\n' +
      'En créer un : node -e "const k=require(\'crypto\').randomBytes(16).toString(\'hex\');' +
      'require(\'fs\').writeFileSync(`src/legal/${k}.txt`,k)"',
  )
  process.exit(1)
}
const key = (await readFile(path.join(SITE, keyFile), 'utf8')).trim()
if (key !== path.basename(keyFile, '.txt')) {
  console.error(`${keyFile} doit contenir exactement la clé, et rien d'autre.`)
  process.exit(1)
}

const urlList = config.pages.flatMap((p) => [
  `${config.origin}${p.en.path}`,
  `${config.origin}${p.fr.path}`,
])

const body = { host, key, keyLocation: `${config.origin}/${keyFile}`, urlList }

if (process.argv.includes('--dry-run')) {
  console.log(JSON.stringify(body, null, 2))
  process.exit(0)
}

const res = await fetch('https://api.indexnow.org/IndexNow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify(body),
})
// 200 = accepté, 202 = accepté, clé en cours de validation.
console.log(`${res.status} ${res.statusText} — ${urlList.length} URL soumises`)
process.exit(res.ok ? 0 : 1)
