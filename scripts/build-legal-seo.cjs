/**
 * Génère les métadonnées SEO / GEO du site public getrelock.com (`src/legal/`).
 *
 * POURQUOI CE SCRIPT
 * Le site est du HTML statique écrit à la main, et c'est sa force : tout le contenu
 * est dans la source, sans JavaScript, donc parfaitement lisible par les crawlers
 * d'IA. Mais huit pages écrites à la main, c'est aussi huit `<head>` qui divergent.
 * L'audit `seo/AUDIT-2026-09-07.md` a trouvé zéro canonical, zéro hreflang, zéro
 * Open Graph et zéro JSON-LD sur les huit.
 *
 * Plutôt que de recopier trente lignes de balises dans chaque fichier, ce script
 * les possède : il réécrit le bloc délimité par `<!-- seo:start -->` /
 * `<!-- seo:end -->` dans chaque `<head>`, et produit les fichiers racine qui vont
 * avec (sitemap, llms.txt, llms-full.txt, manifeste).
 *
 * Il ne réécrit JAMAIS le contenu : les titres, descriptions et FAQ sont LUS dans
 * les pages. La page reste la source de vérité, le script n'en est que la
 * projection en métadonnées. Une FAQ retirée d'une page disparaît du JSON-LD au
 * build suivant, ce qui garantit la règle Google la plus importante : le balisage
 * ne décrit que du contenu visible.
 *
 * Usage : node scripts/build-legal-seo.cjs [--check]
 *   --check  n'écrit rien, sort en 1 si une sortie est absente ou périmée (CI)
 */
const crypto = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')

const root = path.join(__dirname, '..')
const LEGAL = path.join(root, 'src', 'legal')
const LASTMOD_STATE = path.join(LEGAL, '.seo-lastmod.json')

const SITE = 'https://getrelock.com'
const OG_IMAGE = `${SITE}/og-cover.png`

const CHECK = process.argv.slice(2).includes('--check')

/**
 * Définition d'entité, mot pour mot identique dans le JSON-LD, dans `llms.txt` et
 * dans le manifeste. Une IA construit sa représentation d'un produit en croisant
 * ses sources : une définition qui varie d'une source à l'autre dilue l'entité.
 * Chaque affirmation ici est déjà écrite sur la landing ou dans le centre d'aide.
 */
const ENTITY = {
  en:
    'Relock is an iPhone and iPad app that puts one intentional pause between you and the apps you ' +
    'open on autopilot. It uses Apple Family Controls and Screen Time to block, delay or limit the ' +
    'apps you choose, following rules you set yourself.',
  fr:
    'Relock est une application iPhone et iPad qui place une pause intentionnelle entre vous et ' +
    'les applications que vous ouvrez par réflexe. Elle s’appuie sur Family Controls et le Temps ' +
    'd’écran d’Apple pour bloquer, retarder ou limiter les applications que vous choisissez, ' +
    'selon des règles que vous définissez vous-même.',
}

const ORG = {
  name: 'YATECH',
  legalName: 'YATECH',
  email: 'contact@getrelock.com',
  street: '1187C rue Jogues',
  city: 'Drummondville',
  region: 'QC',
  postalCode: 'J2B 4X8',
  country: 'CA',
}

/** Le libellé du fil d'Ariane et le nom court, par page et par langue. */
const PAGES = [
  {
    url: '/',
    file: 'index.html',
    lang: 'en',
    pair: '/fr/',
    kind: 'landing',
    name: 'Relock',
  },
  {
    url: '/help/',
    file: 'help/index.html',
    lang: 'en',
    pair: '/fr/help/',
    kind: 'help',
    name: 'Help centre',
  },
  {
    url: '/privacy/',
    file: 'privacy/index.html',
    lang: 'en',
    pair: '/fr/privacy/',
    kind: 'legal',
    name: 'Privacy Policy',
  },
  {
    url: '/terms/',
    file: 'terms/index.html',
    lang: 'en',
    pair: '/fr/terms/',
    kind: 'legal',
    name: 'Terms of Service',
  },
  {
    url: '/fr/',
    file: 'fr/index.html',
    lang: 'fr',
    pair: '/',
    kind: 'landing',
    name: 'Relock',
  },
  {
    url: '/fr/help/',
    file: 'fr/help/index.html',
    lang: 'fr',
    pair: '/help/',
    kind: 'help',
    name: 'Centre d’aide',
  },
  {
    url: '/fr/privacy/',
    file: 'fr/privacy/index.html',
    lang: 'fr',
    pair: '/privacy/',
    kind: 'legal',
    name: 'Politique de confidentialité',
  },
  {
    url: '/fr/terms/',
    file: 'fr/terms/index.html',
    lang: 'fr',
    pair: '/terms/',
    kind: 'legal',
    name: 'Conditions d’utilisation',
  },
  {
    url: '/blog/',
    file: 'blog/index.html',
    lang: 'en',
    pair: '/fr/blog/',
    kind: 'blog',
    name: 'Blog',
  },
  {
    url: '/fr/blog/',
    file: 'fr/blog/index.html',
    lang: 'fr',
    pair: '/blog/',
    kind: 'blog',
    name: 'Blog',
  },
]

/**
 * Les articles ne sont pas listés ici : ils sont découverts sur le disque.
 *
 * Un blog vit par ajouts successifs. Une liste tenue à la main dans ce fichier
 * finirait par diverger du contenu réel, et c'est exactement comme ça qu'un
 * sitemap se met à déclarer des 404. Un dossier `blog/<slug>/index.html` suffit
 * donc à publier ; le reste (sitemap, flux, llms.txt, JSON-LD) suit tout seul.
 *
 * Chaque article déclare sa version dans l'autre langue avec
 * `<meta name="rl-alt" content="/fr/blog/<slug>/" />`. Les slugs sont traduits
 * (`how-to-block-apps-on-iphone` / `bloquer-une-application-sur-iphone`) : un
 * slug anglais sur une page française perd le mot-clé dans la langue cible.
 */
function discoverArticles() {
  const found = []
  for (const [lang, dir] of [
    ['en', 'blog'],
    ['fr', 'fr/blog'],
  ]) {
    const root = path.join(LEGAL, dir)
    if (!fs.existsSync(root)) continue
    for (const slug of fs.readdirSync(root).sort()) {
      const file = path.join(dir, slug, 'index.html')
      if (!fs.existsSync(path.join(LEGAL, file))) continue
      found.push({ url: `/${dir}/${slug}/`, file, lang, kind: 'article' })
    }
  }
  return found
}

/** Priorité du sitemap : la landing d'abord, l'aide ensuite, le légal en dernier. */
const SITEMAP_PRIORITY = {
  landing: '1.0',
  help: '0.8',
  blog: '0.7',
  article: '0.7',
  legal: '0.5',
}
const SITEMAP_FREQ = {
  landing: 'monthly',
  help: 'monthly',
  blog: 'weekly',
  article: 'monthly',
  legal: 'yearly',
}

const LOCALE = { en: 'en_CA', fr: 'fr_CA' }
const HOME_LABEL = { en: 'Home', fr: 'Accueil' }
const BLOG_LABEL = { en: 'Blog', fr: 'Blog' }
const BLOG_TITLE = {
  en: 'The Relock blog',
  fr: 'Le blog Relock',
}
const BLOG_INTRO = {
  en: 'Guides on blocking apps, Apple Screen Time and attention, written from what we actually had to build.',
  fr: 'Des guides sur le blocage d’applications, le Temps d’écran d’Apple et l’attention, écrits à partir de ce qu’il a fallu construire.',
}
const FEED_URL = { en: `${SITE}/feed.xml`, fr: `${SITE}/fr/feed.xml` }
const READ_MORE = { en: 'Read the guide', fr: 'Lire le guide' }

// ---------------------------------------------------------------- utilitaires

const ENTITIES = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&nbsp;': ' ',
  '&mdash;': '—',
  '&ndash;': '–',
  '&hellip;': '…',
}

const decode = value =>
  value.replace(
    /&(amp|lt|gt|quot|#39|nbsp|mdash|ndash|hellip);/g,
    m => ENTITIES[m] ?? m,
  )

/**
 * HTML → texte brut.
 *
 * Les balises en ligne disparaissent sans laisser d'espace, les balises de bloc en
 * laissent un. Remplacer les deux par un espace produisait « iPhone only . » dans
 * les réponses du `FAQPage`, à cause du `<strong>` collé au point. Un nettoyage de
 * ponctuation après coup ne marcherait pas : en français, l'espace avant `?` et `:`
 * est correct et doit rester.
 */
const INLINE_TAGS =
  'a|abbr|b|cite|code|del|em|i|ins|kbd|mark|q|s|samp|small|span|strong|sub|sup|time|u|var'

const toText = html =>
  decode(
    html
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(new RegExp(`</?(?:${INLINE_TAGS})(?:\\s[^>]*)?>`, 'gi'), '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' '),
  ).trim()

const attr = value =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

/** `</script>` dans une chaîne JSON refermerait la balise : on échappe le `<`. */
const jsonLd = value => JSON.stringify(value, null, 2).replace(/</g, '\\u003c')

const escapeHtml = value =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const escapeXml = value => escapeHtml(value).replace(/"/g, '&quot;')

/** `2026-09-08` → `8 September 2026` / `8 septembre 2026`. */
const formatDate = (day, lang) =>
  new Date(`${day}T12:00:00Z`).toLocaleDateString(
    lang === 'fr' ? 'fr-CA' : 'en-CA',
    { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' },
  )

const sha256 = value => crypto.createHash('sha256').update(value).digest('hex')

const abs = url => `${SITE}${url}`

// ------------------------------------------------------------------- lecture

const BLOCK_START = '<!-- seo:start'
const BLOCK_END = '<!-- seo:end -->'

/** Retire le bloc généré : ce qui reste est le contenu écrit à la main. */
function withoutBlock(html) {
  const start = html.indexOf(BLOCK_START)
  if (start === -1) return html
  const end = html.indexOf(BLOCK_END, start)
  if (end === -1) return html
  const lineStart = html.lastIndexOf('\n', start) + 1
  return html.slice(0, lineStart) + html.slice(end + BLOCK_END.length + 1)
}

function readPage(page) {
  const html = fs.readFileSync(path.join(LEGAL, page.file), 'utf8')
  const source = withoutBlock(html)

  const title = decode(
    (source.match(/<title>([\s\S]*?)<\/title>/) ?? [])[1] ?? '',
  ).trim()
  const description = decode(
    (source.match(/<meta\s+name="description"\s+content="([\s\S]*?)"/) ??
      [])[1] ?? '',
  )
    .replace(/\s+/g, ' ')
    .trim()
  const h1 = toText((source.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) ?? [])[1] ?? '')

  if (!title) throw new Error(`${page.file} : <title> introuvable`)
  if (!description)
    throw new Error(`${page.file} : <meta name="description"> introuvable`)

  const extra = {}

  if (page.kind === 'article') {
    // Le lien vers l'autre langue est écrit à la main dans l'article, une seule
    // fois : c'est la seule information qu'on ne peut pas déduire du disque.
    extra.pair = (source.match(/<meta\s+name="rl-alt"\s+content="([^"]+)"/) ??
      [])[1]
    if (!extra.pair)
      throw new Error(
        `${page.file} : <meta name="rl-alt"> manquant (URL de la version dans l'autre langue)`,
      )

    // Les dates sont lues sur les `<time datetime>` VISIBLES de l'article. Un
    // `datePublished` de JSON-LD qui ne correspond à aucune date affichée est
    // exactement le genre de balisage que Google traite comme trompeur.
    const times = [
      ...source.matchAll(/<time[^>]*datetime="([^"]+)"[^>]*>/g),
    ].map(m => m[1])
    if (times.length === 0)
      throw new Error(`${page.file} : aucune <time datetime="…"> visible`)
    extra.published = times[0]
    extra.updated = times[times.length - 1]

    // Le fil d'Ariane et les cartes du blog affichent le titre de l'article,
    // pas le `<title>` de l'onglet qui porte le suffixe « | Relock ».
    extra.name = h1 || title
  }

  return { ...page, html, source, title, description, h1, ...extra }
}

/**
 * Paires question / réponse réellement affichées sur la page.
 *
 * Deux formes existent dans ce site et une seule règle les gouverne : ne renvoyer
 * que ce qu'un visiteur voit, pour que le `FAQPage` ne décrive jamais du contenu
 * absent (règle Google, et condition pour être repris par un moteur génératif).
 */
function extractFaq(page) {
  if (page.kind === 'landing') {
    const block =
      (page.source.match(/<div class="p-faq">([\s\S]*?)<\/div>/) ?? [])[1] ?? ''
    return [
      ...block.matchAll(
        /<details>\s*<summary>([\s\S]*?)<\/summary>([\s\S]*?)<\/details>/g,
      ),
    ]
      .map(m => ({ question: toText(m[1]), answer: toText(m[2]) }))
      .filter(qa => qa.question && qa.answer)
  }

  if (page.kind === 'help') {
    return [
      ...page.source.matchAll(/<section id="([^"]+)">([\s\S]*?)<\/section>/g),
    ]
      .map(([, id, body]) => {
        const question = toText(
          (body.match(/<h2[^>]*>([\s\S]*?)<\/h2>/) ?? [])[1] ?? '',
        )
        // Les deux premiers paragraphes de premier niveau suffisent à répondre :
        // au-delà, on embarquerait des tableaux et des encadrés qui ne se lisent
        // pas hors de leur mise en page.
        const answer = [...body.matchAll(/<p>([\s\S]*?)<\/p>/g)]
          .slice(0, 2)
          .map(m => toText(m[1]))
          .filter(Boolean)
          .join(' ')
        return { id, question, answer }
      })
      .filter(qa => qa.question.includes('?') && qa.answer.length > 40)
  }

  if (page.kind === 'article') {
    // Dans un article, la FAQ est en H3 + paragraphe, jamais en accordéon : un
    // `<details>` fermé cache la réponse au lecteur, et la checklist d'audit
    // compte le contenu replié comme du contenu non extractible.
    const block =
      (page.source.match(
        /<section[^>]*class="post-faq"[^>]*>([\s\S]*?)<\/section>/,
      ) ?? [])[1] ?? ''
    return [
      ...block.matchAll(/<h3[^>]*>([\s\S]*?)<\/h3>\s*<p>([\s\S]*?)<\/p>/g),
    ]
      .map(m => ({ question: toText(m[1]), answer: toText(m[2]) }))
      .filter(qa => qa.question.includes('?') && qa.answer.length > 20)
  }

  return []
}

// ------------------------------------------------------------------ lastmod

/**
 * `lastmod` doit refléter une vraie modification de contenu, pas la date du build.
 *
 * L'empreinte porte sur le contenu écrit à la main, bloc généré exclu : régénérer
 * les métadonnées ne rajeunit donc pas la page. La date n'avance que si un humain
 * a touché au texte.
 */
function resolveLastmod(pages) {
  let state = {}
  try {
    state = JSON.parse(fs.readFileSync(LASTMOD_STATE, 'utf8'))
  } catch {
    state = {}
  }
  const today = new Date().toISOString().slice(0, 10)
  const next = {}

  for (const page of pages) {
    const digest = sha256(page.source)
    const known = state[page.url]
    next[page.url] =
      known && known.hash === digest ? known : { hash: digest, date: today }
  }
  return { map: next, changed: JSON.stringify(next) !== JSON.stringify(state) }
}

// ------------------------------------------------------------------- JSON-LD

function graphFor(page, faq, pages) {
  const organization = {
    '@type': 'Organization',
    '@id': `${SITE}/#organization`,
    name: ORG.name,
    legalName: ORG.legalName,
    url: `${SITE}/`,
    email: ORG.email,
    logo: {
      '@type': 'ImageObject',
      '@id': `${SITE}/#logo`,
      url: `${SITE}/icon-512.png`,
      width: 512,
      height: 512,
      caption: 'Relock',
    },
    address: {
      '@type': 'PostalAddress',
      streetAddress: ORG.street,
      addressLocality: ORG.city,
      addressRegion: ORG.region,
      postalCode: ORG.postalCode,
      addressCountry: ORG.country,
    },
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer support',
      email: ORG.email,
      availableLanguage: ['en', 'fr'],
    },
  }

  const website = {
    '@type': 'WebSite',
    '@id': `${SITE}/#website`,
    url: `${SITE}/`,
    name: 'Relock',
    description: ENTITY[page.lang],
    publisher: { '@id': `${SITE}/#organization` },
    inLanguage: ['en-CA', 'fr-CA'],
  }

  const application = {
    '@type': 'MobileApplication',
    '@id': `${SITE}/#app`,
    name: 'Relock',
    applicationCategory: 'LifestyleApplication',
    applicationSubCategory: 'Digital wellbeing',
    operatingSystem: 'iOS, iPadOS',
    description: ENTITY[page.lang],
    url: `${SITE}/`,
    image: OG_IMAGE,
    inLanguage: ['en-CA', 'fr-CA'],
    publisher: { '@id': `${SITE}/#organization` },
    // Ni `offers`, ni `aggregateRating` : l'app n'est pas encore publiée sur
    // l'App Store et n'a aucun avis. Déclarer un prix ou une note inexistants
    // serait du balisage trompeur, sanctionné, et sans retour possible.
    featureList:
      page.lang === 'fr'
        ? [
            'Sélection des applications et catégories via Apple Family Controls',
            'Règles de blocage par horaire, durée ou limite',
            'Pause intentionnelle avant l’ouverture d’une application',
            'Mode strict et déverrouillage d’urgence',
            'Statistiques agrégées d’interventions et de temps regagné',
          ]
        : [
            'App and category selection through Apple Family Controls',
            'Blocking rules by schedule, duration or limit',
            'An intentional pause before a restricted app opens',
            'Strict mode and emergency unlock',
            'Aggregate stats on interventions and time reclaimed',
          ],
  }

  const lang = page.lang
  const inLanguage = lang === 'fr' ? 'fr-CA' : 'en-CA'
  const homeUrl = lang === 'fr' ? '/fr/' : '/'
  const blogUrl = lang === 'fr' ? '/fr/blog/' : '/blog/'
  const questions = faq.map(qa => ({
    '@type': 'Question',
    name: qa.question,
    ...(qa.id ? { url: `${abs(page.url)}#${qa.id}` } : {}),
    acceptedAnswer: { '@type': 'Answer', text: qa.answer },
  }))

  /** Résumé d'article utilisé dans `blogPost` de l'index, et rien d'autre. */
  const postStub = article => ({
    '@type': 'BlogPosting',
    '@id': `${abs(article.url)}#article`,
    url: abs(article.url),
    headline: article.name,
    description: article.description,
    datePublished: article.published,
    dateModified: article.updated,
    author: { '@id': `${SITE}/#organization` },
  })

  let webPage

  if (page.kind === 'article') {
    webPage = {
      '@type': 'BlogPosting',
      '@id': `${abs(page.url)}#article`,
      mainEntityOfPage: abs(page.url),
      url: abs(page.url),
      headline: page.name,
      name: page.title,
      description: page.description,
      inLanguage,
      datePublished: page.published,
      dateModified: page.updated,
      // L'auteur est l'organisation, pas une personne : inventer un nom et une
      // bio pour cocher la case E-E-A-T serait une fausse signature.
      author: { '@id': `${SITE}/#organization` },
      publisher: { '@id': `${SITE}/#organization` },
      image: OG_IMAGE,
      isPartOf: { '@id': `${abs(blogUrl)}#blog` },
      about: { '@id': `${SITE}/#app` },
    }
  } else if (page.kind === 'blog') {
    webPage = {
      '@type': 'Blog',
      '@id': `${abs(page.url)}#blog`,
      url: abs(page.url),
      name: BLOG_TITLE[lang],
      description: page.description,
      inLanguage,
      isPartOf: { '@id': `${SITE}/#website` },
      publisher: { '@id': `${SITE}/#organization` },
      about: { '@id': `${SITE}/#app` },
      blogPost: pages
        .filter(p => p.kind === 'article' && p.lang === lang)
        .sort((a, b) => b.published.localeCompare(a.published))
        .map(postStub),
    }
  } else {
    webPage = {
      '@type': questions.length > 0 ? 'FAQPage' : 'WebPage',
      '@id': `${abs(page.url)}#webpage`,
      url: abs(page.url),
      name: page.title,
      description: page.description,
      inLanguage,
      isPartOf: { '@id': `${SITE}/#website` },
      about: { '@id': `${SITE}/#app` },
      primaryImageOfPage: { '@type': 'ImageObject', url: OG_IMAGE },
      dateModified: page.lastmod,
    }
    if (questions.length > 0) webPage.mainEntity = questions
  }

  const graph = [organization, website, application, webPage]

  // Sur un article, la FAQ est un second nœud : `BlogPosting` et `FAQPage` sont
  // deux types de page, on ne peut pas les fusionner en un seul.
  if (page.kind === 'article' && questions.length > 0) {
    graph.push({
      '@type': 'FAQPage',
      '@id': `${abs(page.url)}#faq`,
      url: abs(page.url),
      inLanguage,
      mainEntity: questions,
    })
  }

  if (page.url !== homeUrl) {
    const trail = [{ name: HOME_LABEL[lang], url: homeUrl }]
    if (page.kind === 'article')
      trail.push({ name: BLOG_LABEL[lang], url: blogUrl })
    trail.push({ name: page.name, url: page.url })

    webPage.breadcrumb = { '@id': `${abs(page.url)}#breadcrumb` }
    graph.push({
      '@type': 'BreadcrumbList',
      '@id': `${abs(page.url)}#breadcrumb`,
      itemListElement: trail.map((step, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: step.name,
        item: abs(step.url),
      })),
    })
  }

  return { '@context': 'https://schema.org', '@graph': graph }
}

// --------------------------------------------------------------- bloc `<head>`

function seoBlock(page, faq, pages) {
  const en = page.lang === 'en' ? page.url : page.altPage.url
  const fr = page.lang === 'fr' ? page.url : page.altPage.url
  const i = '    '
  const isArticle = page.kind === 'article'

  const lines = [
    `${BLOCK_START} — généré par scripts/build-legal-seo.cjs, ne pas éditer à la main -->`,
    `<link rel="canonical" href="${abs(page.url)}" />`,
    `<link rel="alternate" hreflang="en" href="${abs(en)}" />`,
    `<link rel="alternate" hreflang="fr" href="${abs(fr)}" />`,
    `<link rel="alternate" hreflang="x-default" href="${abs(en)}" />`,
    `<link rel="apple-touch-icon" href="${SITE}/apple-touch-icon.png" />`,
    `<link rel="manifest" href="${SITE}/manifest.webmanifest" />`,
    `<link rel="alternate" type="application/rss+xml" title="${attr(BLOG_TITLE[page.lang])}" href="${FEED_URL[page.lang]}" />`,
    '<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1" />',
    `<meta name="author" content="${attr(ORG.name)}" />`,
    `<meta property="og:type" content="${isArticle ? 'article' : 'website'}" />`,
    ...(isArticle
      ? [
          `<meta property="article:published_time" content="${page.published}" />`,
          `<meta property="article:modified_time" content="${page.updated}" />`,
          `<meta property="article:author" content="${attr(ORG.name)}" />`,
        ]
      : []),
    '<meta property="og:site_name" content="Relock" />',
    `<meta property="og:locale" content="${LOCALE[page.lang]}" />`,
    `<meta property="og:locale:alternate" content="${LOCALE[page.lang === 'en' ? 'fr' : 'en']}" />`,
    `<meta property="og:url" content="${abs(page.url)}" />`,
    `<meta property="og:title" content="${attr(page.title)}" />`,
    `<meta property="og:description" content="${attr(page.description)}" />`,
    `<meta property="og:image" content="${OG_IMAGE}" />`,
    '<meta property="og:image:width" content="1200" />',
    '<meta property="og:image:height" content="630" />',
    `<meta property="og:image:alt" content="${attr(
      page.lang === 'fr'
        ? 'Relock, l’écran d’activité de l’app iPhone à côté de l’accroche « Stop opening apps on autopilot »'
        : 'Relock, the iPhone activity screen next to the line “Stop opening apps on autopilot”',
    )}" />`,
    '<meta name="twitter:card" content="summary_large_image" />',
    `<meta name="twitter:title" content="${attr(page.title)}" />`,
    `<meta name="twitter:description" content="${attr(page.description)}" />`,
    `<meta name="twitter:image" content="${OG_IMAGE}" />`,
    '<script type="application/ld+json">',
    ...jsonLd(graphFor(page, faq, pages)).split('\n'),
    '</script>',
    BLOCK_END,
  ]

  return lines.map(line => (line === '' ? line : i + line)).join('\n')
}

/** Insère ou remplace le bloc, juste avant `</head>`. */
function applyBlock(page, block) {
  const cleaned = withoutBlock(page.html)
  const marker = cleaned.indexOf('</head>')
  if (marker === -1) throw new Error(`${page.file} : </head> introuvable`)
  const lineStart = cleaned.lastIndexOf('\n', marker) + 1
  return `${cleaned.slice(0, lineStart)}${block}\n${cleaned.slice(lineStart)}`
}

// ------------------------------------------------------------ fichiers racine

function buildSitemap(pages) {
  const entries = pages
    .map(page => {
      const en = page.lang === 'en' ? page : page.altPage
      const fr = page.lang === 'fr' ? page : page.altPage
      return [
        '  <url>',
        `    <loc>${abs(page.url)}</loc>`,
        `    <lastmod>${page.lastmod}</lastmod>`,
        `    <changefreq>${SITEMAP_FREQ[page.kind]}</changefreq>`,
        `    <priority>${SITEMAP_PRIORITY[page.kind]}</priority>`,
        `    <xhtml:link rel="alternate" hreflang="en" href="${abs(en.url)}" />`,
        `    <xhtml:link rel="alternate" hreflang="fr" href="${abs(fr.url)}" />`,
        `    <xhtml:link rel="alternate" hreflang="x-default" href="${abs(en.url)}" />`,
        '  </url>',
      ].join('\n')
    })
    .join('\n')

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!-- Généré par scripts/build-legal-seo.cjs, ne pas éditer à la main. -->',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
    '        xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    entries,
    '</urlset>',
    '',
  ].join('\n')
}

function buildLlms(pages) {
  const byUrl = Object.fromEntries(pages.map(p => [p.url, p]))
  const line = url =>
    `- [${byUrl[url].name}](${abs(url)}) : ${byUrl[url].description}`

  /**
   * Les guides sont listés avec leur date : un modèle qui hésite entre deux
   * sources préfère la plus récente, et il n'a aucun autre moyen de la connaître
   * dans un fichier texte.
   */
  const guides = lang => {
    const rows = pages
      .filter(p => p.kind === 'article' && p.lang === lang)
      .sort((a, b) => b.published.localeCompare(a.published))
      .map(
        p => `- [${p.name}](${abs(p.url)}) (${p.published}) : ${p.description}`,
      )
    return rows.length > 0 ? rows.join('\n') : null
  }
  const guidesEn = guides('en')
  const guidesFr = guides('fr')

  return `# Relock

> ${ENTITY.en}

Relock is published by ${ORG.name}, a sole proprietorship registered in Quebec, Canada.
The app is built on Apple Family Controls, so it runs on iPhone and iPad only; there is no
Android version and no browser extension. It is in pre-launch: the site collects early access
requests by email and there is no App Store listing yet.

What Relock does not do: it does not read messages, photos, page contents or keystrokes
inside the apps it restricts. Apple hands the app opaque selection tokens that stay on the
device for enforcement.

## English
${line('/')}
${line('/help/')}
${line('/blog/')}
${line('/privacy/')}
${line('/terms/')}
${guidesEn ? `\n### Guides\n${guidesEn}\n` : ''}
## Français

> ${ENTITY.fr}

${line('/fr/')}
${line('/fr/help/')}
${line('/fr/blog/')}
${line('/fr/privacy/')}
${line('/fr/terms/')}
${guidesFr ? `\n### Guides\n${guidesFr}\n` : ''}
## Contact
- ${ORG.email}
- ${ORG.name}, ${ORG.street}, ${ORG.city}, Quebec ${ORG.postalCode}, Canada

## Full text
- [llms-full.txt](${SITE}/llms-full.txt) : every page above, concatenated as plain text
`
}

/**
 * Rendu texte d'une page pour `llms-full.txt` : on ne garde que `<main>`, sans la
 * navigation ni le pied de page, qui se répètent huit fois et n'apportent rien.
 */
function pageToMarkdown(page) {
  const main =
    (page.source.match(/<main[^>]*>([\s\S]*?)<\/main>/) ?? [])[1] ?? page.source
  const out = []

  const blocks = main.match(
    /<h1[^>]*>[\s\S]*?<\/h1>|<h2[^>]*>[\s\S]*?<\/h2>|<h3[^>]*>[\s\S]*?<\/h3>|<summary[^>]*>[\s\S]*?<\/summary>|<li[^>]*>[\s\S]*?<\/li>|<p[^>]*>[\s\S]*?<\/p>/g,
  )
  for (const block of blocks ?? []) {
    const text = toText(block)
    if (!text) continue
    if (block.startsWith('<h1')) out.push(`# ${text}`)
    else if (block.startsWith('<h2')) out.push(`## ${text}`)
    else if (block.startsWith('<h3')) out.push(`### ${text}`)
    else if (block.startsWith('<summary')) out.push(`### ${text}`)
    else if (block.startsWith('<li')) out.push(`- ${text}`)
    else out.push(text)
  }

  return `# ${page.title}\nURL: ${abs(page.url)}\nLanguage: ${page.lang}\nUpdated: ${
    page.lastmod
  }\n\n${out.join('\n\n')}\n`
}

const buildLlmsFull = pages =>
  `${[
    '# Relock, full text',
    '',
    `> ${ENTITY.en}`,
    '',
    'Every public page of getrelock.com, navigation and footer removed.',
    `Generated from the site sources. Canonical index: ${SITE}/llms.txt`,
    '',
    pages.map(pageToMarkdown).join('\n---\n\n'),
  ].join('\n')}`

/**
 * Flux RSS par langue.
 *
 * Un flux n'est plus un canal de masse, mais il reste lu par les agrégateurs et
 * par plusieurs pipelines d'ingestion, et il coûte dix lignes quand les articles
 * sont déjà décrits. `lastBuildDate` suit la date du dernier article, pas celle
 * du build : un flux qui change d'empreinte à chaque déploiement force des
 * re-téléchargements pour rien.
 */
function buildFeed(pages, lang) {
  const articles = pages
    .filter(p => p.kind === 'article' && p.lang === lang)
    .sort((a, b) => b.published.localeCompare(a.published))
  const rfc822 = day => new Date(`${day}T12:00:00Z`).toUTCString()
  const self = FEED_URL[lang]
  const home = lang === 'fr' ? '/fr/blog/' : '/blog/'
  const latest = articles[0]?.updated ?? articles[0]?.published

  return `${[
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!-- Généré par scripts/build-legal-seo.cjs, ne pas éditer à la main. -->',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    '  <channel>',
    `    <title>${escapeXml(BLOG_TITLE[lang])}</title>`,
    `    <link>${abs(home)}</link>`,
    `    <description>${escapeXml(BLOG_INTRO[lang])}</description>`,
    `    <language>${lang === 'fr' ? 'fr-ca' : 'en-ca'}</language>`,
    `    <atom:link href="${self}" rel="self" type="application/rss+xml" />`,
    ...(latest ? [`    <lastBuildDate>${rfc822(latest)}</lastBuildDate>`] : []),
    ...articles.flatMap(article => [
      '    <item>',
      `      <title>${escapeXml(article.name)}</title>`,
      `      <link>${abs(article.url)}</link>`,
      `      <guid isPermaLink="true">${abs(article.url)}</guid>`,
      `      <pubDate>${rfc822(article.published)}</pubDate>`,
      `      <description>${escapeXml(article.description)}</description>`,
      '    </item>',
    ]),
    '  </channel>',
    '</rss>',
  ].join('\n')}\n`
}

const LIST_START = '<!-- blog:list:start'
const LIST_END = '<!-- blog:list:end -->'

/**
 * Cartes d'articles de l'index de blog.
 *
 * C'est la seule projection du générateur qui produit du contenu visible, et
 * c'est assumé : un index tenu à la main oublie un article tôt ou tard, et une
 * page orpheline n'est atteignable par personne.
 */
function blogList(pages, lang) {
  const articles = pages
    .filter(p => p.kind === 'article' && p.lang === lang)
    .sort((a, b) => b.published.localeCompare(a.published))

  const empty =
    lang === 'fr'
      ? '<p class="blog-empty">Aucun guide publié pour le moment.</p>'
      : '<p class="blog-empty">No guide published yet.</p>'

  const cards = articles.map(article =>
    [
      '          <article class="blog-card">',
      `            <time datetime="${article.published}">${formatDate(article.published, lang)}</time>`,
      // Liens racine-relatifs : la même page doit être navigable sur le serveur
      // local et en production. Le sitemap et le JSON-LD, eux, restent absolus.
      `            <h2><a href="${article.url}">${escapeHtml(article.name)}</a></h2>`,
      `            <p>${escapeHtml(article.description)}</p>`,
      `            <a class="blog-card__more" href="${article.url}">${READ_MORE[lang]}</a>`,
      '          </article>',
    ].join('\n'),
  )

  return [
    `        ${LIST_START} — généré par scripts/build-legal-seo.cjs -->`,
    ...(cards.length > 0 ? cards : [`          ${empty}`]),
    `        ${LIST_END}`,
  ].join('\n')
}

/** Remplace le bloc de cartes dans l'index de blog. */
function applyBlogList(html, list, file) {
  const start = html.indexOf(LIST_START)
  const end = html.indexOf(LIST_END)
  if (start === -1 || end === -1)
    throw new Error(`${file} : marqueurs blog:list absents`)
  const lineStart = html.lastIndexOf('\n', start) + 1
  return html.slice(0, lineStart) + list + html.slice(end + LIST_END.length)
}

const buildManifest = () =>
  `${JSON.stringify(
    {
      name: 'Relock',
      short_name: 'Relock',
      description: ENTITY.en,
      start_url: '/',
      scope: '/',
      display: 'standalone',
      background_color: '#05060b',
      theme_color: '#05060b',
      lang: 'en-CA',
      dir: 'ltr',
      icons: [
        {
          src: '/icon-192.png',
          sizes: '192x192',
          type: 'image/png',
          purpose: 'any',
        },
        {
          src: '/icon-512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'any',
        },
        {
          src: '/apple-touch-icon.png',
          sizes: '180x180',
          type: 'image/png',
          purpose: 'maskable',
        },
      ],
    },
    null,
    2,
  )}\n`

// ---------------------------------------------------------------------- main

function main() {
  const pages = [...PAGES, ...discoverArticles()].map(readPage)

  // Réciprocité `hreflang`, vérifiée au build : Google ignore silencieusement
  // une paire non réciproque, sans erreur nulle part. Un article publié avec un
  // `rl-alt` qui pointe une URL inexistante doit casser ici, pas en production.
  const byUrl = Object.fromEntries(pages.map(p => [p.url, p]))
  for (const page of pages) {
    const alt = byUrl[page.pair]
    if (!alt)
      throw new Error(
        `${page.file} : la page jumelle ${page.pair} n'existe pas`,
      )
    if (alt.pair !== page.url)
      throw new Error(
        `hreflang non réciproque : ${page.url} pointe ${page.pair}, qui pointe ${alt.pair}`,
      )
    if (alt.lang === page.lang)
      throw new Error(`${page.url} et ${page.pair} sont dans la même langue`)
    page.altPage = alt
  }

  const { map: lastmod } = resolveLastmod(pages)
  for (const page of pages) page.lastmod = lastmod[page.url].date

  const stale = []
  const write = (rel, content) => {
    const file = path.join(LEGAL, rel)
    const current = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null
    if (current === content) return
    if (CHECK) {
      stale.push(current === null ? `manquant : ${rel}` : `périmé : ${rel}`)
      return
    }
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, content)
    console.log(`  écrit  ${rel}`)
  }

  for (const page of pages) {
    const faq = extractFaq(page)
    page.faqCount = faq.length
    let html = applyBlock(page, seoBlock(page, faq, pages))
    if (page.kind === 'blog')
      html = applyBlogList(html, blogList(pages, page.lang), page.file)
    write(page.file, html)
  }

  write('sitemap.xml', buildSitemap(pages))
  write('llms.txt', buildLlms(pages))
  write('llms-full.txt', buildLlmsFull(pages))
  write('manifest.webmanifest', buildManifest())
  write('feed.xml', buildFeed(pages, 'en'))
  write('fr/feed.xml', buildFeed(pages, 'fr'))

  // RFC 9116 : un `security.txt` expiré ne vaut rien, et rien ne le rappelle
  // jamais. La vérification vit ici parce que c'est elle qui tourne en CI.
  const securityTxt = path.join(LEGAL, '.well-known', 'security.txt')
  if (fs.existsSync(securityTxt)) {
    const expires = (fs
      .readFileSync(securityTxt, 'utf8')
      .match(/^Expires:\s*(.+)$/m) ?? [])[1]
    const at = expires ? new Date(expires.trim()) : null
    if (!at || Number.isNaN(at.getTime())) {
      stale.push('.well-known/security.txt : champ Expires absent ou illisible')
    } else if (at.getTime() < Date.now()) {
      stale.push(
        `.well-known/security.txt : Expires dépassé (${expires.trim()})`,
      )
    }
  }

  if (CHECK) {
    if (stale.length > 0) {
      console.error('Métadonnées SEO du site legal périmées :')
      for (const line of stale) console.error(`  - ${line}`)
      console.error('\nLance `npm run legal:seo` puis commite le résultat.')
      process.exit(1)
    }
    console.log('Métadonnées SEO du site legal à jour.')
    return
  }

  // Hors --check, `stale` ne peut contenir que l'avertissement security.txt :
  // les écritures, elles, ont déjà eu lieu.
  for (const line of stale) console.warn(`  ⚠︎  ${line}`)

  fs.writeFileSync(LASTMOD_STATE, `${JSON.stringify(lastmod, null, 2)}\n`)
  const faqTotal = pages.reduce((sum, p) => sum + p.faqCount, 0)
  const articles = pages.filter(p => p.kind === 'article').length
  console.log(
    `Métadonnées SEO générées : ${pages.length} pages dont ${articles} articles, ${faqTotal} questions balisées.`,
  )
}

main()
