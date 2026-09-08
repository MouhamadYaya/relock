/**
 * Génère src/legal/sitemap.xml depuis seo-relock/pages.json.
 *
 * POURQUOI LE GÉNÉRER
 * Un sitemap écrit à la main dérive : on ajoute une page et on oublie de l'y
 * mettre, ou on y laisse une URL supprimée. Ici la liste vient du même fichier
 * que les balises <head>, donc les deux ne peuvent pas diverger.
 *
 * CE QU'IL CONTIENT, ET RIEN D'AUTRE
 * Uniquement des URL canoniques, indexables et existantes. Pas de 404, pas de
 * redirections, pas de pages `noindex` (les deux pages 404 sont exclues), pas
 * de paramètres.
 *
 * `lastmod` reflète une VRAIE modification : la date du dernier commit qui a
 * touché le fichier, ou aujourd'hui si le fichier a des changements non
 * validés. Un `lastmod` mis à jour à chaque déploiement sans que rien n'ait
 * changé est un signal que Google apprend à ignorer.
 *
 * Chaque entrée déclare aussi ses alternates hreflang, comme le recommande la
 * documentation Google sur les versions localisées.
 *
 *   node src/legal/seo-relock/tools/build-sitemap.mjs
 */
import { execFileSync } from 'node:child_process'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const SEO = path.resolve(here, '..')
const SITE = path.resolve(SEO, '..')
const REPO = path.resolve(SITE, '../..')

const config = JSON.parse(await readFile(path.join(SEO, 'pages.json'), 'utf8'))
const { origin } = config

const today = new Date().toISOString().slice(0, 10)

function lastModified(relFile) {
  const repoPath = path.relative(REPO, path.join(SITE, relFile))
  const git = (args) => execFileSync('git', args, { cwd: REPO, encoding: 'utf8' }).trim()
  try {
    // Modifications non validées → la page change aujourd'hui, pas à la date
    // du dernier commit.
    if (git(['status', '--porcelain', '--', repoPath])) return today
    const committed = git(['log', '-1', '--format=%cs', '--', repoPath])
    return committed || today
  } catch {
    return today
  }
}

const rows = []
for (const pair of config.pages) {
  const alternates = [
    { code: 'en', href: `${origin}${pair.en.path}` },
    { code: 'fr', href: `${origin}${pair.fr.path}` },
    { code: 'x-default', href: `${origin}${pair.en.path}` },
  ]
  for (const lang of ['en', 'fr']) {
    const entry = pair[lang]
    rows.push({
      loc: `${origin}${entry.path}`,
      lastmod: lastModified(entry.file),
      priority: entry.priority,
      alternates,
    })
  }
}

const xml = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<!--',
  '  Généré par seo-relock/tools/build-sitemap.mjs depuis seo-relock/pages.json.',
  '  Ne pas éditer à la main : ajouter la page dans pages.json et relancer.',
  '-->',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
  '        xmlns:xhtml="http://www.w3.org/1999/xhtml">',
  ...rows.flatMap((row) => [
    '  <url>',
    `    <loc>${row.loc}</loc>`,
    `    <lastmod>${row.lastmod}</lastmod>`,
    `    <priority>${row.priority}</priority>`,
    ...row.alternates.map(
      (a) => `    <xhtml:link rel="alternate" hreflang="${a.code}" href="${a.href}" />`,
    ),
    '  </url>',
  ]),
  '</urlset>',
  '',
].join('\n')

const out = path.join(SITE, 'sitemap.xml')
await writeFile(out, xml)
console.log(`${rows.length} URL → ${path.relative(REPO, out)}`)
