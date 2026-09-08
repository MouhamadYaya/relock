# Audit SEO — getrelock.com

**Date :** 7 septembre 2026 · **Périmètre :** `src/legal/` (site public Cloudflare Workers)
**Branche :** `feat/imagekit-avatars-and-settings-v2` · **Outillage :** [`seo-relock/`](README.md)

---

## Résumé

Le site était **invisible pour un moteur de recherche au-delà de sa page
d'accueil**, et l'accueil lui-même ne disait pas de quelle catégorie de produit
il parlait.

Aucune des huit pages n'avait de balise `canonical`, de `hreflang`, d'Open Graph
ni de données structurées. Il n'y avait ni `robots.txt`, ni `sitemap.xml`, ni
page 404. Le titre de l'accueil — *« Relock | Make your attention yours again »* —
ne contenait ni « app blocker », ni « screen time », ni « iPhone » : rien qui
permette à Google de comprendre qu'il s'agit d'un bloqueur d'applications.
Et deux versions linguistiques coexistaient sans le moindre lien déclaré entre
elles, donc sans aucune chance d'être servies au bon public.

Techniquement, la page d'accueil pesait **environ 3,4 Mo** avant le premier
rendu : 1,6 Mo de polices TTF complètes et une capture d'écran PNG de 1,78 Mo
comme élément LCP.

Après ce chantier :

| | Avant | Après |
|---|---|---|
| Pages indexables | 8 | **14** (7 paires EN/FR) |
| `canonical` | 0 | 14 |
| `hreflang` réciproques | 0 | 14 (+ `x-default`) |
| Open Graph / Twitter | 0 | 14 |
| JSON-LD | 0 | 14 |
| `robots.txt` / `sitemap.xml` | absents | présents, sitemap généré |
| Page 404 | erreur Cloudflare brute | 2 pages localisées, vrai statut 404 |
| Chemin critique de l'accueil | ~3 400 Ko | **~201 Ko** (−94 %) |
| Élément LCP | PNG 1 778 Ko | AVIF 18 Ko à 720 px |
| Polices | 4 TTF, 1 629 Ko | 4 WOFF2 sous-ensemblés, 172 Ko (−89 %) |
| Contenu éditorial | 0 mot | ~12 000 mots, EN + FR |

Tests de non-régression : `npx tsc --noEmit` propre, `npm test` → **711 tests,
93 suites, tout passe**, `biome check .` → 20 avertissements, **identiques à la
référence avant travaux**. Le site a été servi localement (`wrangler dev`) et
chaque route vérifiée.

---

## 1. Incohérences produit corrigées

C'était la première chose à traiter : optimiser le référencement d'une
information fausse ne fait que la diffuser plus vite.

### iPad — contradiction franche, tranchée par le code

| Source | Ce qu'elle disait |
|---|---|
| Accueil EN/FR | « Coming to the App Store for iPhone **and iPad** » |
| Conditions EN/FR | « Relock is offered on iPhone **and iPad** » |
| Centre d'aide EN/FR | « Relock runs on **iPhone only** » |

Le code tranche sans ambiguïté : `app.json` déclare `ios.supportsTablet: false`,
`PRODUCT.md` donne `Platform: ios` avec une cible d'individus en auto-régulation,
et `docs/NATIVE-FAMILY-CONTROLS.md` documente un module iPhone. **iPhone
uniquement** a donc été appliqué partout, y compris dans la phrase des
Conditions — c'est un fait de disponibilité, pas une clause juridique, mais
**cette modification touche un document contractuel et mérite une relecture du
propriétaire** (voir « Risques »).

### Version minimale d'iOS — jamais affichée nulle part

Family Controls est du **iOS 16+** : `BlocusScreenTime.swift` garde chaque
appel derrière `@available(iOS 16.0, *)`, et les cinq extensions ciblent 16.0
(16.2 pour les widgets). Le site n'en disait rien, alors que c'est précisément
la question que se pose quelqu'un avec un iPhone plus ancien. Ajouté à l'accueil,
au centre d'aide, dans les nouvelles pages et dans le `SoftwareApplication`.

### Quota du déblocage d'urgence — fonctionnalité réelle, absente de l'aide

`src/features/blocking/services/emergency-quota.ts` impose
`EMERGENCY_COOLDOWN_MS = 7 jours`, et `settings.emergency_quota` l'annonce dans
l'app : *« You get one emergency unlock per week. »* Le centre d'aide décrivait
la sortie de secours sans mentionner la limite. Corrigé dans les deux langues.

### Types de règles — vérifiés, aucune correction nécessaire

`BlockRuleType = 'progressive_delay' | 'schedule' | 'daily_limit'`
(`database.types.ts`) et la section `blockType` des traductions confirment mot
pour mot les trois mécanismes décrits par le centre d'aide. Tout le contenu créé
s'appuie sur cette liste, jamais sur une supposition.

---

## 2. Ce qui a été implémenté

### Priorité 0 — indexabilité

- **`robots.txt`** — ouvert à tous les robots, aucune exclusion (rien à cacher,
  et bloquer CSS ou JS empêcherait Google de rendre les pages). Déclare le
  sitemap.
- **`sitemap.xml`** — 14 URL canoniques, générées depuis `pages.json`. Chaque
  entrée porte ses alternates `hreflang`. `lastmod` vient de la date du dernier
  commit touchant le fichier, pas de la date du déploiement.
- **`canonical` auto-référente** sur les 14 pages indexables.
- **`hreflang` réciproques** `en` ↔ `fr` + `x-default` pointant l'anglais.
  Chaque variante se cite elle-même, sans quoi Google ignore le groupe entier.
- **Pages 404 localisées** (`404.html`, `fr/404.html`) avec `noindex, follow`,
  plus `not_found_handling: "404-page"` dans `wrangler.jsonc` : une adresse
  morte renvoie un **vrai statut HTTP 404** avec une page qui propose des liens
  utiles, au lieu de l'erreur brute de Cloudflare. Cloudflare remonte
  l'arborescence, donc une URL morte sous `/fr/` reçoit la page française.
- **Aucune redirection automatique des 404 vers l'accueil** — ce serait un
  *soft 404*, que Google traite comme une erreur de qualité.

### Priorité 1 — page d'accueil

- **Title** : `Relock — iPhone App Blocker to Reduce Screen Time`. La marque
  d'abord, la catégorie ensuite, l'intention derrière.
- **Eyebrow** : « iPhone app blocker, built on Apple Screen Time ». Le H1
  poétique — *« Stop opening apps on autopilot. »* — est conservé tel quel : il
  est fort, et le contexte catégoriel est apporté par l'eyebrow et le title,
  exactement comme le suggérait le brief.
- **Chapeau réécrit** : « Relock is an iPhone app blocker that puts one
  intentional pause between you and the scroll… reduce screen time without
  deleting anything you still want in your life. » Les expressions cibles
  apparaissent dans une phrase écrite pour un humain.
- **H2 rendus descriptifs, phrase de marque conservée en sous-texte.** Par
  exemple : H2 *« The pause that interrupts an automatic app opening »*, puis
  *« Give the reflex somewhere to stop »* en ouverture de paragraphe. Le H2
  *« Less policing. More agency. »* est devenu *« What makes Relock different
  from a strict app blocker »*, la formule d'origine passant en chapeau.
- **FAQ portée de 5 à 10 questions**, toutes fondées sur des fonctionnalités
  vérifiées : appareils, iOS 16, Temps d'écran, ce que Relock ne voit pas,
  programmation, limites d'ouvertures, déblocage d'urgence hebdomadaire,
  disponibilité Canada/États-Unis.
- **Section « Read before you decide »** menant aux trois pages de fond, avec
  des ancres descriptives.
- **Le hero n'a pas bougé** : même mise en page, mêmes deux boutons, même
  visuel. Le texte SEO est réparti plus bas et sur les pages dédiées.

### Priorité 2 — pages existantes

- Title et meta description uniques et descriptifs sur les 8 pages d'origine.
- Centre d'aide : iOS 16 ajouté, quota hebdomadaire ajouté, lien vers la page
  pilier, navigation enrichie. Les explications techniques n'ont pas été
  édulcorées — c'est justement leur précision qui fait leur valeur.
- Pages légales : **aucune clause réécrite**. Seuls les titres, descriptions,
  canonical, hreflang, données structurées et le pied de page ont changé, plus
  la correction factuelle « iPhone et iPad » → « iPhone ».
- Colonne « Learn » / « Comprendre » ajoutée au pied de page de toutes les
  pages : chaque page du site mène désormais aux trois pages de fond.

### Priorité 3 — contenu

Six pages créées, **trois intentions de recherche, deux langues** — pas une page
par variante de mot-clé. « app blocker », « iphone app blocker », « best app
blocker » et « app blocker iphone » relèvent de la même intention et partagent
donc la page pilier. Détail en section 4.

### Priorité 4 — performance

- **Images** : les trois captures PNG (3,6 Mo) sont sorties du dossier publié
  vers `seo-relock/sources/` et régénérées en **AVIF + WebP à cinq largeurs**
  (480 → 1920) plus un PNG de repli, avec des noms de fichier descriptifs
  (`relock-home-and-activity-screens-720.avif` plutôt que
  `ecranAcceuilETActivite.png`). Le hero passe de **1 778 Ko à 18 Ko** à la
  largeur réellement affichée.
- **`<picture>` + `srcset`/`sizes`** partout : le navigateur ne télécharge que
  la largeur dont il a besoin. `width`/`height` conservés sur chaque `<img>`,
  donc aucun décalage de mise en page (CLS).
- **Préchargement du LCP** : `<link rel="preload" as="image" type="image/avif"
  imagesrcset>` sur les deux accueils, pour que l'image parte avant même la fin
  de lecture du CSS.
- **Polices** : les quatre TTF Inter complets (1 629 Ko) sont devenus des
  **WOFF2 sous-ensemblés latin** (172 Ko), avec `unicode-range` déclarée et les
  deux graisses critiques préchargées. Le script de génération **refuse de
  produire un sous-ensemble qui perdrait un caractère présent sur le site** : il
  lit toutes les pages, en extrait les codepoints et vérifie chacun. Les 112
  caractères réellement utilisés sont couverts.
- **Cache** : `_headers` déclare un an immuable sur `/img/*` et
  `/assets/fonts/*`, une heure avec revalidation sur les CSS (qui n'ont pas
  d'empreinte dans leur nom, un cache long les figerait après déploiement).
  Vérifié en local : les en-têtes sortent bien.
- **Ce qui n'a pas été fait, volontairement** : `styles.css` contient environ
  19 Ko de règles mortes (l'ancien design, dont plus aucune classe n'est
  utilisée). Les élaguer aurait un gain réel de quelques kilo-octets après
  Brotli, mais quatre sélecteurs y chevauchent `legal.css` avec des
  spécificités qui se croisent — le risque de déplacer une page légale dépasse
  le bénéfice. Noté comme amélioration séparée, à faire avec une comparaison
  visuelle avant/après.

### Priorité 5 — données structurées et Bing

- **`WebSite`** et **`Organization`** sur les deux accueils. `Organization`
  porte la raison sociale réelle (YATECH), l'adresse de Drummondville et
  l'adresse de contact, tirées des Conditions.
- **`MobileApplication`** sur les accueils et les pages piliers :
  `applicationCategory: ProductivityApplication`, `operatingSystem: iOS 16.0 or
  later`, `availableOnDevice: iPhone`, `featureList` reprenant les sept
  fonctionnalités vérifiées. **Aucun `aggregateRating`, aucun `review`, aucun
  `offers`** — Relock n'a pas de fiche App Store publique, donc pas de note,
  pas d'avis et pas de prix à déclarer. Sans ces propriétés il n'y aura pas de
  *rich result*, et c'est le bon arbitrage : mieux vaut pas de résultat enrichi
  qu'un balisage mensonger.
- **`BreadcrumbList`** sur les pages internes, **`Article`** sur les guides,
  **`FAQPage`** partout où une FAQ est visible.
- **`FAQPage` extrait du HTML visible**, jamais rédigé à part : `sync-head.mjs`
  lit les `<summary>` de la page. Une réponse modifiée dans le texte met le
  balisage à jour ; en inventer une est impossible par construction.
- **IndexNow** : clé auto-émise servie à la racine
  (`65ab299678f3a17df2afceb195b24a5f.txt`) et script de soumission
  (`npm run seo:indexnow`, à lancer **après** déploiement). Aucune
  infrastructure ajoutée, aucun compte requis — IndexNow prouve la propriété par
  le fichier de clé.
- **`site.webmanifest`** + `apple-touch-icon` générés depuis l'icône iOS réelle
  du dépôt.
- **Image Open Graph** 1200 × 630, une par langue, composée uniquement d'assets
  existants (icône iOS, lettrage Relock, grain de fond, couleurs de marque). Ni
  chiffre, ni note, ni récompense, ni logo tiers.

---

## 3. Tableau SEO interne

Toutes les pages sont indexables et leur canonical est auto-référente.

| URL | Langue | Intention | Requête principale | Title | H1 |
|---|---|---|---|---|---|
| `/` | en | commerciale | iphone app blocker | Relock — iPhone App Blocker to Reduce Screen Time | Stop opening apps on autopilot. |
| `/fr/` | fr | commerciale | bloqueur d'applications iphone | Relock — Bloqueur d'applications iPhone pour réduire le temps d'écran | N'ouvrez plus vos apps en pilote automatique. |
| `/iphone-app-blocker/` | en | informationnelle + commerciale | app blocker for iphone | iPhone App Blocker: How Relock Blocks Distracting Apps | How an app blocker actually blocks apps on iPhone |
| `/fr/bloqueur-dapplications-iphone/` | fr | informationnelle + commerciale | bloqueur d'applications iphone | Bloqueur d'applications iPhone : comment Relock bloque les apps distrayantes | Comment un bloqueur d'applications bloque vraiment sur iPhone |
| `/reduce-screen-time/` | en | informationnelle | how to reduce screen time on iphone | How to Reduce Screen Time on iPhone (Without Relying on Willpower) | How to reduce screen time on iPhone |
| `/fr/reduire-son-temps-decran/` | fr | informationnelle | réduire son temps d'écran iphone | Comment réduire son temps d'écran sur iPhone (sans compter sur la volonté) | Comment réduire son temps d'écran sur iPhone |
| `/stop-doomscrolling/` | en | informationnelle | how to stop doomscrolling | How to Stop Doomscrolling on Your iPhone | How to stop doomscrolling on your iPhone |
| `/fr/arreter-le-doomscrolling/` | fr | informationnelle | arrêter le doomscrolling | Comment arrêter le doomscrolling sur iPhone | Comment arrêter le doomscrolling sur iPhone |
| `/help/` | en | support / navigationnelle | relock screen time access | Relock Help Centre — Screen Time Access, Rules and Troubleshooting | Help centre |
| `/fr/help/` | fr | support / navigationnelle | relock centre d'aide | Centre d'aide Relock — Temps d'écran, règles et dépannage | Centre d'aide |
| `/privacy/` | en | confiance | relock privacy policy | Privacy Policy \| Relock | Privacy Policy |
| `/fr/privacy/` | fr | confiance | relock confidentialité | Politique de confidentialité \| Relock | Politique de confidentialité |
| `/terms/` | en | confiance | relock terms | Terms of Service \| Relock | Terms of Service |
| `/fr/terms/` | fr | confiance | relock conditions | Conditions d'utilisation \| Relock | Conditions d'utilisation |

Pages **non indexables** : `404.html` et `fr/404.html` (`noindex, follow`,
absentes du sitemap).

---

## 4. Mots-clés couverts, et regroupement

Trois pages, pas douze. Les requêtes qui expriment la même intention partagent
une page.

| Page | Requête principale | Requêtes secondaires regroupées |
|---|---|---|
| `/iphone-app-blocker/` | app blocker for iPhone | iphone app blocker · best app blocker · block apps on iphone · block distracting apps · screen time blocker · social media blocker · app blocker for studying / for work / for deep work · schedule app blocking on iphone · strict mode · progressive delay |
| `/reduce-screen-time/` | how to reduce screen time on iPhone | reduce screen time · limit screen time · screen time management · screen time limits for iphone · how to stop checking your phone · intentional phone use · phone habit app |
| `/stop-doomscrolling/` | how to stop doomscrolling | stop mindless scrolling · reduce scrolling · how to stop scrolling social media · block social media during work · limit social media on iphone |
| `/` (accueil) | iphone app blocker (transactionnelle) | focus app for iphone · distraction blocker · digital wellbeing app |

Aucune densité de mot-clé n'a été visée, aucun texte caché n'a été ajouté,
aucune balise `meta keywords` n'existe (le contrôle échoue si l'une apparaît).

---

## 5. Les nouvelles pages, et pourquoi elles existent

### `/iphone-app-blocker/` · `/fr/bloqueur-dapplications-iphone/` — ~2 500 mots

La page pilier. Elle explique ce qu'aucun concurrent n'explique correctement :
**la fondation Apple commune à tous les bloqueurs iOS**, et ce qu'elle interdit.
Le tableau « accordé / refusé » de Family Controls, le fait que la sélection
d'apps revienne en **jetons opaques** (le bloqueur connaît le nombre d'apps, pas
leurs noms), pourquoi le délai grandit au lieu d'être fixe, pourquoi la limite
compte des **ouvertures** et non des minutes là où Apple compte des minutes.
Puis les limites honnêtes qu'un argumentaire commercial tait : une catégorie
n'est pas une liste, le web est une autre porte, l'autorisation est par appareil,
le bouclier peut traîner à l'écran, rien de tout cela n'est un dispositif
critique.

### `/reduce-screen-time/` · `/fr/reduire-son-temps-decran/` — ~1 800 mots

Un guide qui **présente honnêtement plusieurs solutions**, dont celles qui ne
passent pas par Relock : lire ses données réelles avant de fixer un objectif,
couper les notifications, vider le premier écran d'accueil, charger le téléphone
hors de la chambre, configurer Temps d'arrêt et les limites d'Apple. Relock
n'apparaît qu'en section 6, sur un échec précis et vérifiable : la limite qu'on
balaie sans la lire. Le guide reste utile à quelqu'un qui n'installera jamais
l'app — c'est ce qui le rend crédible.

### `/stop-doomscrolling/` · `/fr/arreter-le-doomscrolling/` — ~1 700 mots

Prudent par construction. Le mot est présenté comme une **description de
comportement, pas un diagnostic**, avec une mention explicite qu'aucun
diagnostic ne porte ce nom et que la page n'est pas un avis médical. La section
finale dit la seule chose honnête possible : si l'humeur, l'anxiété ou le
sommeil sont durablement atteints, cela relève d'un professionnel, et Relock ne
traite ni ne diagnostique rien.

**Aucune étude inventée, aucune statistique, aucun chiffre d'utilisateurs,
aucun témoignage, aucune mention presse** n'apparaît sur ces six pages. Les
seuls chiffres cités sont des paramètres du produit (une fois par semaine,
22 h – 8 h, iOS 16).

---

## 6. SEO technique — état

| Élément | État |
|---|---|
| `canonical` | 14/14, auto-référentes, en HTTPS sans `www` |
| `hreflang` | réciproques `en`/`fr` + `x-default`, vérifiés automatiquement |
| `robots.txt` | présent, permissif, déclare le sitemap |
| `sitemap.xml` | 14 URL, généré, `lastmod` réels, alternates inclus |
| Données structurées | `WebSite`, `Organization`, `MobileApplication`, `BreadcrumbList`, `Article`, `FAQPage` — tous factuels |
| 404 | vrai statut 404, localisé, avec liens de sortie |
| Slash final | `html_handling: auto-trailing-slash` → `/privacy` redirige en 307 vers `/privacy/`, une seule forme canonique |
| Liens internes | 0 lien mort (contrôle automatique sur `href`, `src`, `srcset`, `imagesrcset` et ancres `#`) |
| Images | 100 % avec `alt`, `width`, `height` ; alt descriptifs et non bourrés |
| Mobile | 0 débordement horizontal à 390 px sur les 15 pages ; 0 cible tactile autonome sous 44 px |
| HTML sémantique | `header`/`nav`/`main`/`section`/`article`/`footer` déjà en place, conservés ; `aria-labelledby` ajouté sur les sections de l'accueil |
| Accessibilité | `lang` sur `<html>`, lien d'évitement fonctionnel, hiérarchie de titres sans saut (vérifiée), `aria-current` sur la page active |
| `www` vs apex | **non résolu au niveau HTTP** — voir étapes manuelles |

---

## 7. Étapes manuelles restantes

Ce qui ne peut pas être fait depuis le dépôt.

### 1. Redirection `www` → apex (la seule vraie lacune technique)

`wrangler.jsonc` sert la même chose sur `getrelock.com/*` et
`www.getrelock.com/*`. **La documentation Cloudflare confirme que le fichier
`_redirects` des Workers Static Assets ne gère pas les redirections de domaine**
— seuls des chemins, pas des noms d'hôtes. Il faut donc une **règle de
redirection** dans le tableau de bord Cloudflare :

> Rules → Redirect Rules → Create → *When incoming requests match*
> `http.host eq "www.getrelock.com"` → *Then* Dynamic redirect,
> `concat("https://getrelock.com", http.request.uri.path)`, statut **301**,
> « Preserve query string » coché.

En attendant, les `canonical` posées sur les 14 pages désignent sans ambiguïté
la version apex : Google ne devrait pas indexer les deux. La redirection reste
la solution propre.

### 2. Google Search Console

1. Ajouter la propriété **domaine** `getrelock.com` (couvre apex, `www`, HTTP et
   HTTPS d'un coup) sur [search.google.com/search-console](https://search.google.com/search-console).
2. Vérifier par **enregistrement DNS TXT** — le DNS est déjà chez Cloudflare, ce
   qui rend cette voie la plus rapide. *Aucun jeton de vérification n'a été
   inventé ni ajouté au dépôt.*
3. Soumettre `https://getrelock.com/sitemap.xml`.
4. Inspecter l'accueil avec l'outil d'inspection d'URL, puis « Demander une
   indexation ». Répéter pour les trois pages de fond anglaises.
5. Suivre ensuite : impressions, clics, CTR, position moyenne, pages indexées,
   requêtes, clics par page de destination.

### 3. Bing Webmaster Tools

Ajouter le site sur [bing.com/webmasters](https://www.bing.com/webmasters),
puis **importer depuis Google Search Console** (le plus simple une fois l'étape 2
faite), et soumettre le même sitemap. La clé IndexNow est déjà servie : après
chaque déploiement, `npm run seo:indexnow` signale les URL modifiées.

### 4. Captures d'écran en anglais

**C'est le point le plus rentable qui reste, et il n'est pas technique.** Les
trois captures affichent l'interface **en français** (« Temps d'écran
aujourd'hui », « Score global », « Blocages », « Activité ») — y compris sur les
pages anglaises, alors que les États-Unis et le Canada anglophone sont le marché
prioritaire. Refaire les trois captures avec l'app en anglais, les déposer dans
`seo-relock/sources/` sous les noms d'origine, puis `npm run seo:images` : tout
le reste (largeurs, formats, `srcset`) se régénère seul. Un jeu de captures par
langue demanderait une petite évolution du script, à faire si le besoin se
confirme.

### 5. Au lancement App Store

Quand l'app sera publiée : remplacer les CTA `mailto:` par le lien App Store,
retirer les mentions « coming to the App Store » / « pas encore publiée » des
huit endroits concernés, renseigner `appStoreId` dans `src/config/app-config.ts`,
et ajouter `installUrl` au `MobileApplication`. **Ne pas ajouter
`aggregateRating` avant d'avoir de vrais avis** — c'est explicitement contraire
aux règles de Google sur les données structurées, et le risque de sanction
manuelle est réel.

### 6. Optionnel

- Élaguer les ~19 Ko de CSS mort de `styles.css` (voir Priorité 4).
- Brancher `npm run seo:build` en CI (`sync-head.mjs --check` échoue au lieu
  d'écrire — c'est fait pour).
- Backlinks : rien dans le dépôt n'y contribue. Les trois pages de fond sont
  écrites pour être citables ; c'est le travail suivant.

---

## 8. Risques et incertitudes

**À faire relire.** La phrase des Conditions d'utilisation « offered on iPhone
and iPad » a été corrigée en « offered on iPhone » (EN et FR). Le code ne laisse
aucun doute sur le fait qu'iPad était faux, mais **c'est un document contractuel
et la modification mérite une validation explicite**.

**Signalé, non corrigé.** Les Conditions mentionnent « Apple App Store **or
Google Play**, as applicable » et « Where an Android version is offered… ». Il
n'existe aucune version Android. La formulation conditionnelle rend la clause
inoffensive et la réécrire relève d'une décision juridique, pas SEO — laissé en
l'état, signalé ici.

**Non vérifiable depuis le dépôt.** Le prix de Relock Pro et la date de sortie.
Rien dans le site ni les données structurées n'en parle, et rien ne doit en
parler tant que ce n'est pas décidé.

**Choix assumé.** Une seule page anglaise sert les États-Unis et le Canada
anglophone, sans `/en-us/` ni `/en-ca/`. Deux pages au contenu identique
seraient une duplication artificielle sans bénéfice ; `hreflang="en"` couvre les
deux marchés.

**Hors périmètre, mais visible.** L'ancienne feuille `styles.css` impose
`text-align: center` à `.legal-hero`, ce qui centre le titre des pages
Aide/Confidentialité/Conditions tout en laissant leur ligne de méta alignée à
gauche. Les pages éditoriales créées ici corrigent l'alignement pour
elles-mêmes ; les pages existantes n'ont pas été déplacées, cela sortait du
mandat.

**Marque.** Le produit s'écrit **Relock** partout dans le code, les
traductions et les pages — jamais « ReLock ». Toutes les données structurées et
`og:site_name` utilisent « Relock ».

---

## 9. Reproduire les contrôles

```bash
npm run legal:dev        # sert le site sur :8788
npm run seo:build        # tête HTML + sitemap + contrôles
npm run seo:mobile       # débordement et cibles tactiles à 390 px
npm test && npx tsc --noEmit && npm run lint
```

`npm run seo:verify` sort en 1 dès qu'un canonical, un hreflang, un lien
interne, une image, un titre, une description, un JSON-LD ou une entrée de
sitemap est incohérent. Son utilité a été démontrée en cassant volontairement un
lien, un niveau de titre et un attribut `alt` : les trois ont été détectés.
