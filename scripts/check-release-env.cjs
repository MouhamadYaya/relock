#!/usr/bin/env node
/**
 * Refuse un build de publication si `.env` contient des valeurs qui n'ont rien
 * à faire dans un binaire distribué.
 *
 * POURQUOI CE SCRIPT EXISTE
 * `react-native-config` ne fait aucun tri : chaque ligne de `.env` est recopiée
 * dans l'app (en-tête généré + `Info.plist` côté iOS, `BuildConfig` côté
 * Android). Un `.ipa` se dézippe en quelques secondes, et `strings` fait le
 * reste — un mot de passe posé là est un mot de passe publié, même si aucun
 * code de release ne le lit. Le garde-fou `__DEV__` de `src/config/env.ts`
 * empêche l'USAGE ; lui seul n'empêche pas la PRÉSENCE. D'où cette vérification,
 * qui est la seule des deux à pouvoir dire non.
 *
 * USAGE
 *   node scripts/check-release-env.cjs            # vérifie ./.env
 *   ENVFILE=.env.production node scripts/…        # vérifie un autre fichier
 *
 * Sortie 0 = rien à signaler. Sortie 1 = ne pas publier ce binaire.
 */
const fs = require('node:fs')
const path = require('node:path')

const root = path.join(__dirname, '..')
const envFile = process.env.ENVFILE || '.env'
const envPath = path.join(root, envFile)

/**
 * Clés qui ne doivent jamais avoir de valeur dans un build distribué.
 *
 * Ce sont des IDENTIFIANTS, pas des réglages : leur fuite donne accès à un
 * compte réel. Tout le reste de `.env` est publiable par construction (URL
 * Supabase, clé anon, clé publique ImageKit, DSN Sentry, clés SDK RevenueCat) —
 * ces valeurs-là sont conçues pour vivre côté client et ne sont pas listées ici.
 */
const FORBIDDEN_IN_RELEASE = [
  'DEV_LOGIN_PASSWORD',
  'DEV_LOGIN_EMAIL',
  'DEV_SKIP_AUTH',
  // Filet large : rien de « privé » ni de « secret » ne s'embarque, quel que
  // soit le fournisseur qu'on branchera plus tard.
  'IMAGEKIT_PRIVATE_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SERVICE_ROLE_KEY',
  // Clés de fournisseurs d'IA. Elles arrivent dans `.env` par les outils de
  // développement (assistants, générateurs de contenu), jamais par l'app —
  // Relock n'appelle aucun modèle. Une `GEMINI_API_KEY` s'est déjà retrouvée
  // dans `.env.production` par ce chemin : recopiée dans le binaire par
  // react-native-config, elle se lit avec `unzip` + `strings` sur l'ipa, et
  // c'est une facture à l'usage qui part avec.
  'GEMINI_API_KEY',
  'GOOGLE_API_KEY',
  'OPENAI_API_KEY',
  'ANTHROPIC_API_KEY',
  'CLAUDE_API_KEY',
  'PERPLEXITY_API_KEY',
]

/** Motifs de valeurs qui trahissent un secret, quel que soit le nom de la clé. */
const SECRET_VALUE_PATTERNS = [
  { re: /^sk_(live|test)_/, why: 'clé secrète Stripe' },
  { re: /^private_[A-Za-z0-9]{10,}/, why: 'clé privée ImageKit' },
  { re: /^AKIA[0-9A-Z]{16}$/, why: 'clé AWS' },
  // `AIza…` = clé d'API Google (Gemini, Maps, …). À ne pas confondre avec les
  // OAuth client IDs `…apps.googleusercontent.com` de Sign in with Google,
  // eux publics par conception et nécessaires dans le binaire.
  { re: /^AIza[0-9A-Za-z_-]{30,}$/, why: "clé d'API Google" },
  { re: /^sk-(proj-)?[A-Za-z0-9_-]{20,}$/, why: 'clé OpenAI' },
  { re: /^sk-ant-[A-Za-z0-9_-]{20,}$/, why: 'clé Anthropic' },
  { re: /^gh[pousr]_[A-Za-z0-9]{20,}/, why: 'jeton GitHub' },
  { re: /^-----BEGIN [A-Z ]*PRIVATE KEY-----/, why: 'clé privée PEM' },
  // JWT dont la charge utile annonce le rôle service_role (clé Supabase admin).
  { re: /^eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/, why: 'JWT' },
]

if (!fs.existsSync(envPath)) {
  console.log(`[check-release-env] ${envFile} absent — rien à vérifier.`)
  process.exit(0)
}

/** `.env` en paires clé/valeur, commentaires et lignes vides écartés. */
function parseEnv(text) {
  const entries = []
  for (const [index, raw] of text.split(/\r?\n/).entries()) {
    const line = raw.trim()
    if (line === '' || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq === -1) continue
    entries.push({
      key: line.slice(0, eq).trim(),
      value: line.slice(eq + 1).trim(),
      line: index + 1,
    })
  }
  return entries
}

const problems = []

for (const { key, value, line } of parseEnv(fs.readFileSync(envPath, 'utf8'))) {
  // Une clé listée mais VIDE est acceptable : la ligne documente la variable
  // sans rien embarquer. C'est la valeur qui pose problème, jamais le nom.
  if (value === '') continue

  if (FORBIDDEN_IN_RELEASE.includes(key)) {
    problems.push(
      `${envFile}:${line} — ${key} est renseignée. Cette variable est réservée au développement et ne doit pas entrer dans un binaire distribué.`,
    )
    continue
  }

  for (const { re, why } of SECRET_VALUE_PATTERNS) {
    if (re.test(value)) {
      problems.push(
        `${envFile}:${line} — ${key} ressemble à un secret (${why}). Les secrets vivent côté serveur (secrets Supabase), jamais dans .env.`,
      )
      break
    }
  }
}

if (problems.length === 0) {
  console.log(
    `[check-release-env] ${envFile} : aucun identifiant de développement ni secret détecté. ✅`,
  )
  process.exit(0)
}

console.error(
  `\n[check-release-env] ⛔️ ${problems.length} problème(s) — NE PAS PUBLIER ce binaire :\n`,
)
for (const p of problems) console.error(`  • ${p}`)
console.error(
  `\nPour publier : construire avec un fichier d'environnement dédié, par exemple\n` +
    `  ENVFILE=.env.production npm run ios:raw\n` +
    `en y omettant les lignes ci-dessus (react-native-config lit ENVFILE).\n`,
)
process.exit(1)
