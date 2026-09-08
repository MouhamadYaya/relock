#!/usr/bin/env node
/**
 * Les secrets `APPLE_*` de Supabase sont-ils JUSTES ?
 *
 * POURQUOI CE SCRIPT EXISTE
 * `supabase secrets list` dit qu'un secret EXISTE, jamais qu'il est bon : les
 * valeurs y sont hachées. Or `delete-account` ne bloque jamais une suppression
 * parce qu'Apple a mal répondu — une suppression de compte est une obligation
 * légale (5.1.1(v)) et passe avant la révocation. Une clé `.p8` mal poussée ne
 * se manifeste donc NULLE PART : Apple continue de lister Relock dans les
 * réglages de gens ayant supprimé leur compte, et la seule trace est une ligne
 * de journal écrite sur un compte qui n'existe plus.
 *
 * Ce script appelle l'Edge Function `apple-config-check`, qui forge un vrai
 * client secret et le présente à Apple avec un jeton délibérément faux. Rien
 * n'est révoqué ; on lit seulement si Apple accepte notre identité.
 *
 * Il lit ensuite le compteur `public.apple_revocation_audit`, que
 * `delete-account` incrémente à chaque tentative. La sonde dit si la
 * configuration est bonne MAINTENANT ; le compteur dit ce qui s'est passé
 * pendant qu'on ne regardait pas — c'est-à-dire la seule chose qu'aucune sonde
 * ne pourra jamais rattraper après coup.
 *
 * À RELANCER après toute rotation de clé `.p8`, tout changement de Team ID, et
 * avant chaque soumission. `npm run ios:release` le fait pour toi : un build de
 * publication ne part plus sans que la révocation ait été vérifiée.
 *
 * USAGE
 *   npm run check:apple
 *   SUPABASE_SERVICE_ROLE_KEY=… npm run check:apple   # sans la CLI Supabase
 *
 * Sortie 0 = Apple accepte la configuration. Sortie 1 = la révocation est morte.
 * Un échec PASSÉ au compteur s'affiche mais ne bloque pas : il décrit un état
 * révolu, et refuser un build pour ça empêcherait justement de publier le
 * correctif.
 */
const { execFileSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

const root = path.join(__dirname, '..')
const envFile = process.env.ENVFILE || '.env'

function readEnv(file) {
  const full = path.join(root, file)
  if (!fs.existsSync(full)) return {}
  const out = {}
  for (const raw of fs.readFileSync(full, 'utf8').split(/\r?\n/)) {
    const line = raw.trim()
    if (line === '' || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq !== -1) out[line.slice(0, eq).trim()] = line.slice(eq + 1).trim()
  }
  return out
}

const env = readEnv(envFile)
const url = (env.SUPABASE_URL || '').replace(/\/+$/, '')
if (!url) {
  console.log(`[check-apple-config] SUPABASE_URL absente de ${envFile}.`)
  process.exit(0)
}

/**
 * La clé service_role, jamais écrite sur disque.
 *
 * Priorité à la variable d'environnement (CI), repli sur la CLI Supabase, qui
 * la lit du compte déjà authentifié. On ne la stocke nulle part : c'est la clé
 * qui contourne toutes les RLS.
 */
function serviceRoleKey() {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return process.env.SUPABASE_SERVICE_ROLE_KEY
  }
  const ref = url.match(/https:\/\/([^.]+)\./)?.[1]
  if (!ref) return null
  try {
    const raw = execFileSync(
      'supabase',
      ['projects', 'api-keys', '--project-ref', ref, '-o', 'json'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    )
    const keys = JSON.parse(raw)
    return keys.find(k => String(k.id) === 'service_role')?.api_key ?? null
  } catch {
    return null
  }
}

/**
 * Les issues de révocation des trente derniers jours, ou `null` si le compteur
 * n'existe pas encore sur cette base.
 *
 * On passe par PostgREST plutôt que par une connexion Postgres : la clé
 * service_role est déjà là, elle contourne RLS, et ça évite de demander en
 * plus le mot de passe de la base.
 */
async function revocationHistory(url, key) {
  const since = new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10)
  const query = `select=day,outcome,count,last_detail&day=gte.${since}&order=day.desc`
  try {
    const res = await fetch(`${url}/rest/v1/apple_revocation_audit?${query}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    })
    // 404 / PGRST205 : la table n'a pas encore été appliquée en ligne.
    if (!res.ok) return null
    const rows = await res.json()
    return Array.isArray(rows) ? rows : null
  } catch {
    return null
  }
}

/** Les deux seules issues qui ne sont PAS un problème. */
const BENIGN_OUTCOMES = new Set(['revoked', 'no_token'])

function reportHistory(rows) {
  if (rows === null) {
    console.log(
      '\n[check-apple-config] compteur absent de cette base.\n' +
        '  Appliquer supabase/apple-revocation-audit-2026-09-08.sql, puis\n' +
        '  `supabase functions deploy delete-account`. Sans lui, un échec de\n' +
        '  révocation ne laisse aucune trace consultable.',
    )
    return
  }

  const failures = rows.filter(row => !BENIGN_OUTCOMES.has(row.outcome))
  if (failures.length === 0) {
    const revoked = rows
      .filter(row => row.outcome === 'revoked')
      .reduce((total, row) => total + row.count, 0)
    console.log(
      `  30 derniers jours : aucun échec de révocation (${revoked} révoqué(s)).`,
    )
    return
  }

  console.log(
    '\n[check-apple-config] ⚠️  des comptes sont partis SANS révocation :\n',
  )
  for (const row of failures) {
    console.log(
      `  ${row.day}  ${row.outcome.padEnd(16)} ×${row.count}` +
        (row.last_detail ? `  — ${row.last_detail}` : ''),
    )
  }
  console.log(
    '\n  Ces personnes voient toujours Relock dans « Connexion avec Apple »\n' +
      "  alors qu'elles n'ont plus de compte. C'est ce que 5.1.1(v) interdit.\n" +
      "  La configuration testée ci-dessus étant bonne, il s'agit d'un état\n" +
      '  révolu — mais il a existé, et ces comptes-là ne se rattrapent pas :\n' +
      '  le jeton a disparu avec la ligne supprimée.',
  )
}

async function main() {
  const key = serviceRoleKey()
  if (!key) {
    console.error(
      '[check-apple-config] clé service_role introuvable.\n' +
        '  • soit `supabase login` puis relancer,\n' +
        '  • soit SUPABASE_SERVICE_ROLE_KEY=… npm run check:apple\n' +
        '    (Dashboard → Project Settings → API → service_role).',
    )
    process.exit(1)
  }

  const res = await fetch(`${url}/functions/v1/apple-config-check`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}` },
  })
  const body = await res.json().catch(() => null)

  if (res.status === 404) {
    console.error(
      "[check-apple-config] ⛔️ la fonction n'est pas déployée.\n" +
        '  supabase functions deploy apple-config-check',
    )
    process.exit(1)
  }

  if (body?.ok) {
    console.log(`[check-apple-config] Apple accepte la configuration. ✅`)
    console.log(`  ${body.detail}`)
    reportHistory(await revocationHistory(url, key))
    process.exit(0)
  }

  console.error(
    `\n[check-apple-config] ⛔️ la révocation Sign in with Apple NE MARCHE PAS.\n`,
  )
  console.error(`  cause : ${body?.reason ?? `HTTP ${res.status}`}`)
  console.error(`  ${body?.detail ?? ''}\n`)
  console.error(
    `Conséquence : les comptes supprimés resteront listés dans les réglages\n` +
      `Apple des utilisateurs — c'est un motif de rejet 5.1.1(v).\n`,
  )
  reportHistory(await revocationHistory(url, key))
  process.exit(1)
}

main().catch(error => {
  console.error(`[check-apple-config] échec : ${error.message}`)
  process.exit(1)
})
