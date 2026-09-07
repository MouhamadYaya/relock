# Site public getrelock.com

Le site vitrine et légal de Relock vit dans `src/legal/` et se déploie sur Cloudflare
Workers en assets statiques (`wrangler.jsonc`). Douze pages, deux langues, aucun
framework, aucun build côté client.

| Sujet | Fichier |
|---|---|
| Contenu des pages | `src/legal/**/index.html` (écrit à la main) |
| Articles de blog | `src/legal/blog/<slug>/index.html` et `src/legal/fr/blog/<slug>/index.html` |
| Styles | `src/legal/{styles,pages,landing,legal,blog}.css` |
| En-têtes HTTP (sécurité + cache) | `src/legal/_headers` |
| Fichiers non déployés | `src/legal/.assetsignore` |
| Déploiement | `wrangler.jsonc` |
| Audit SEO / GEO de référence | `seo/AUDIT-2026-09-07.md` |

## Commandes

```bash
npm run legal:assets   # images : WebP des captures, carte sociale, icônes
npm run legal:seo      # métadonnées : canonical, hreflang, OG, JSON-LD, sitemap, llms.txt
npm run legal:build    # les deux
npm run legal:check    # vérifie que tout est à jour (pre-commit + CI)
npm run legal:dev      # build puis serveur local wrangler
npm run legal:deploy   # build puis déploiement production
```

`legal:check` tourne dans le hook `pre-commit` et dans `.github/workflows/ci.yml`.
Il échoue si une page a changé sans que les métadonnées aient été régénérées, ou si
le `Expires:` de `.well-known/security.txt` est dépassé.

## Ce qui est écrit à la main, ce qui est généré

**Écrit à la main, jamais touché par un script :** le contenu des pages, leur
`<title>`, leur `<meta name="description">`, leurs titres, leur FAQ, leurs styles.

**Généré, à ne pas éditer :**

| Sortie | Produite par |
|---|---|
| Le bloc `<!-- seo:start -->` … `<!-- seo:end -->` de chaque `<head>` | `scripts/build-legal-seo.cjs` |
| `sitemap.xml`, `llms.txt`, `llms-full.txt`, `manifest.webmanifest` | `scripts/build-legal-seo.cjs` |
| `feed.xml`, `fr/feed.xml` | `scripts/build-legal-seo.cjs` |
| Les cartes d'articles entre `<!-- blog:list:start -->` et `<!-- blog:list:end -->` | `scripts/build-legal-seo.cjs` |
| `relock-*.webp`, `og-cover.png`, `apple-touch-icon.png`, `icon-*.png` | `scripts/build-legal-assets.cjs` |

Le générateur SEO **lit** les pages, il ne les réécrit pas : le `<title>` de la page
devient l'`og:title`, la FAQ visible devient le `FAQPage`. Retirer une question de la
page la retire du JSON-LD au build suivant. C'est la garantie que le balisage ne
décrit jamais autre chose que du contenu visible, la règle la plus stricte de Google
sur les données structurées.

### Ajouter une page

1. Créer `src/legal/<chemin>/index.html` (ou `src/legal/fr/<chemin>/index.html`), avec
   son `<title>` et sa `<meta name="description">`.
2. Ajouter l'entrée correspondante dans `PAGES`, en tête de
   `scripts/build-legal-seo.cjs` : `url`, `file`, `lang`, `pair` (la page de l'autre
   langue), `kind` (`landing` / `help` / `blog` / `legal` ; `article` est réservé aux pages
   découvertes automatiquement), `name` (libellé du fil d'Ariane).
   Les deux langues doivent se pointer mutuellement, sinon le `hreflang` est ignoré
   par Google.
3. `npm run legal:build`, puis commiter le HTML et les fichiers racine régénérés.

### Publier un article de blog

Un article est un dossier. Il n'y a rien à déclarer dans le générateur : `discoverArticles()`
balaie `src/legal/blog/` et `src/legal/fr/blog/` à chaque build.

1. Créer `src/legal/blog/<slug-anglais>/index.html` et
   `src/legal/fr/blog/<slug-français>/index.html`. Les slugs sont **traduits** : un slug anglais
   sur une page française perd le mot-clé dans la langue de la requête. Le plus simple est de
   partir d'un article existant, dont la structure est déjà celle attendue.
2. Chaque fichier doit contenir, dans le contenu écrit à la main :
   - un `<title>` et une `<meta name="description">` ;
   - `<meta name="rl-alt" content="/fr/blog/<slug>/" />`, l'URL de la version dans l'autre langue.
     Le build échoue si elle n'existe pas ou ne pointe pas en retour ;
   - au moins une `<time datetime="AAAA-MM-JJ">` **visible**, qui devient le `datePublished`. Une
     seconde `<time>` plus loin, s'il y en a une, devient le `dateModified` ;
   - un `<h1>`, qui sert de titre dans le fil d'Ariane, la carte de l'index et le flux ;
   - si l'article a une FAQ, une `<section class="post-faq">` en `<h3>` question + `<p>` réponse.
     Jamais un `<details>` : une réponse repliée n'est pas extractible.
3. `npm run legal:build`, puis commiter. Le sitemap, les deux flux, `llms.txt`, `llms-full.txt`,
   les cartes des index et le JSON-LD (`BlogPosting`, `FAQPage`, `BreadcrumbList`) sont régénérés.

La forme d'un article qui se classe et se fait citer est décrite dans le playbook du plugin
`seo-geo-kit` (`/seo-blog`) : une intention par article, la réponse dans les 80 premiers mots,
des H2 formulés comme la requête, des données en tableaux, aucun chiffre sans source.

### Ajouter une image

Déposer la source dans `src/legal/`, l'ajouter à `SCREENSHOTS` dans
`scripts/build-legal-assets.cjs`, ajouter la source à `.assetsignore` (seule la sortie
WebP est servie), et lui donner sa ligne `Cache-Control` dans `_headers` — la syntaxe
Cloudflare ne reconnaît pas les motifs du type `/*.webp`.

## Stratégie GEO

Le site est du HTML statique servi sans JavaScript de rendu : c'est son principal
atout pour être lu par les crawlers d'IA, qui n'exécutent généralement pas le JS.
**Toute refonte qui passerait le contenu derrière du rendu client annulerait tout le
reste.**

Le reste tient en trois pièces :

- `robots.txt` autorise explicitement GPTBot, ClaudeBot, PerplexityBot,
  Google-Extended, Applebot-Extended et les autres. Choix assumé, documenté en
  commentaire dans le fichier.
- `llms.txt` porte la définition d'entité, mot pour mot identique à celle du JSON-LD
  et du manifeste (constante `ENTITY` du générateur). Une définition qui varie d'une
  source à l'autre dilue l'entité auprès des modèles.
- Les H2 du centre d'aide et des articles sont formulés comme les questions que l'utilisateur
  tape, et la réponse arrive dans le premier paragraphe. Les libellés du sommaire restent
  courts : ils servent la navigation, pas l'extraction.
- Le blog est le seul endroit du site qui vise des requêtes non-marque. C'est aussi le seul
  levier restant : la technique est faite, le contenu ne l'est pas.

## Réglages Cloudflare, hors dépôt

Deux réglages de zone conditionnent tout le reste et ne peuvent pas être posés par un
commit. Les deux ont été appliqués le 2026-09-07 ; ils sont notés ici parce qu'un
changement de plan ou une remise à zéro de la zone les ferait disparaître sans bruit.

1. **AI Crawl Control → robots.txt géré : désactivé.** Activé, Cloudflare réinjecte ses
   `Disallow: /` pour GPTBot, ClaudeBot, Google-Extended et CCBot par-dessus le
   `robots.txt` du dépôt, ce qui rend le site invisible aux moteurs génératifs.
   Vérification : `curl -s https://getrelock.com/robots.txt | grep -c Disallow` doit
   renvoyer `0`.
2. **SSL/TLS → Edge Certificates → Always Use HTTPS : activé.** Sans lui, le site répond
   200 en clair sur `http://`, ce qui duplique chaque page et sert la politique de
   confidentialité non chiffrée au premier contact.
   Vérification : `curl -sSI http://getrelock.com/ | head -1` doit renvoyer un `301`.

## Reste à faire

- Vérifier la propriété dans **Google Search Console** et dans **Bing Webmaster Tools**
  (l'index Bing alimente une partie de la recherche ChatGPT), puis y soumettre
  `https://getrelock.com/sitemap.xml`.
- Convertir les polices en **WOFF2** : les quatre fichiers Inter pèsent 411 à 420 Ko en
  TTF, soit 1,6 Mo. Demande `brew install woff2`, donc un outil hors dépôt.
- **Baseline GEO** : poser à ChatGPT, Claude et Perplexity les questions de la cible,
  noter qui est cité, refaire la mesure chaque mois. C'est le seul indicateur fiable du
  GEO, et il n'a de sens qu'après l'indexation du site corrigé.
