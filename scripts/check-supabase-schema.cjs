#!/usr/bin/env node
/**
 * Vérifie que la base Supabase DÉPLOYÉE porte bien tout ce que le code attend.
 *
 * POURQUOI CE SCRIPT EXISTE
 * `supabase/schema.sql` est le schéma voulu ; il n'est le schéma RÉEL que si
 * quelqu'un l'a exécuté. Rien ne signale l'écart : l'app compile, les tests
 * passent, et la panne n'apparaît qu'à l'exécution, sur un appareil, dans une
 * feature précise. Deux cas vécus le 2026-09-08 sur ce projet :
 *
 *   • `upload_grants` / `claim_upload_grant` absents  → `imagekit-auth` renvoie
 *     503 à chaque appel, donc AUCUNE photo de profil ne s'envoie ;
 *   • `profiles.birth_date` absente → enregistrer une date de naissance échoue.
 *
 * Les deux se voient en une requête. D'où ce script : à lancer avant toute
 * soumission, et après chaque édition de `schema.sql`.
 *
 * USAGE
 *   node scripts/check-supabase-schema.cjs              # lit .env
 *   ENVFILE=.env.production node scripts/…              # une autre cible
 *
 * Sortie 0 = la base est à jour. Sortie 1 = du SQL reste à appliquer.
 */
const fs = require('node:fs')
const path = require('node:path')

const root = path.join(__dirname, '..')
const envFile = process.env.ENVFILE || '.env'

/** `.env` en objet, commentaires et lignes vides écartés. */
function readEnv(file) {
  const full = path.join(root, file)
  if (!fs.existsSync(full)) return {}
  const out = {}
  for (const raw of fs.readFileSync(full, 'utf8').split(/\r?\n/)) {
    const line = raw.trim()
    if (line === '' || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq === -1) continue
    out[line.slice(0, eq).trim()] = line.slice(eq + 1).trim()
  }
  return out
}

const env = readEnv(envFile)
const url = (env.SUPABASE_URL || '').replace(/\/+$/, '')
const key = env.SUPABASE_ANON_KEY || ''

if (!url || !key) {
  console.log(
    `[check-supabase-schema] SUPABASE_URL/ANON_KEY absents de ${envFile} — rien à vérifier.`,
  )
  process.exit(0)
}

const headers = { apikey: key, Authorization: `Bearer ${key}` }

/**
 * Une colonne existe-t-elle ?
 *
 * On la demande à PostgREST : la clé anon ne lira jamais de LIGNE (RLS), mais
 * une colonne inconnue répond `42703` avant même que RLS n'entre en jeu. Le
 * test ne dépend donc d'aucune donnée et ne fuit rien.
 */
async function column(table, name) {
  const res = await fetch(`${url}/rest/v1/${table}?select=${name}&limit=1`, {
    headers,
  })
  const body = await res.json().catch(() => null)
  if (Array.isArray(body)) return null
  if (body?.code === '42703') return `colonne ${table}.${name} absente`
  if (body?.code === 'PGRST205') return `table ${table} absente`
  return `${table}.${name} : ${body?.message ?? `HTTP ${res.status}`}`
}

/**
 * Une fonction RPC existe-t-elle ?
 *
 * `claim_upload_grant` est révoquée pour `anon` : une base à jour répond donc
 * 401/403 (« tu n'as pas le droit »), une base incomplète 404 (« ça n'existe
 * pas »). C'est cette distinction qu'on lit — et un 404 est le seul échec.
 */
async function rpc(name, args) {
  const res = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  })
  if (res.status === 404) return `fonction ${name}() absente`
  return null
}

async function main() {
  const problems = (
    await Promise.all([
      column('profiles', 'birth_date'),
      column('upload_grants', 'user_id'),
      column('apple_refresh_tokens', 'user_id'),
      rpc('claim_upload_grant', {
        p_user_id: '00000000-0000-0000-0000-000000000000',
        p_max_grants: 1,
        p_window_seconds: 60,
      }),
    ])
  ).filter(Boolean)

  if (problems.length === 0) {
    console.log(
      `[check-supabase-schema] ${url.replace(/https:\/\/([^.]+).*/, '$1')} : schéma à jour. ✅`,
    )
    process.exit(0)
  }

  console.error(
    `\n[check-supabase-schema] ⛔️ ${problems.length} manque(s) sur la base déployée :\n`,
  )
  for (const p of problems) console.error(`  • ${p}`)
  console.error(
    `\nCorrectif : ouvrir le SQL Editor du projet Supabase et exécuter la partie\n` +
      `de supabase/schema.sql qui n'a pas été appliquée (tout y est idempotent).\n`,
  )
  process.exit(1)
}

main().catch(error => {
  console.error(`[check-supabase-schema] échec réseau : ${error.message}`)
  process.exit(1)
})
