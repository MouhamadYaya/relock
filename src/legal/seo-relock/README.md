# seo-relock — atelier SEO du site getrelock.com

Tout l'outillage SEO du site public vit ici. **Rien dans ce dossier n'est
publié** : `src/legal/.assetsignore` en exclut la totalité du déploiement
Cloudflare, ce qui est vérifiable après un `npm run legal:dev` — toute URL sous
`/seo-relock/` répond 404.

```
seo-relock/
  pages.json     ← source de vérité : URL, titres, descriptions, paires de langue
  SEO-AUDIT.md   ← l'audit et le rapport de ce chantier
  tools/         ← les scripts
  sources/       ← captures d'écran et polices d'origine (jamais servies telles quelles)
  vendor/        ← fontTools + brotli (non versionné, voir plus bas)
```

## Le fichier qui compte : `pages.json`

Il décrit chaque page indexable une seule fois — chemin, fichier, titre,
description, blocs JSON-LD, page jumelle dans l'autre langue. Trois outils le
lisent. Ajouter une page ailleurs qu'ici, c'est se garantir un hreflang
asymétrique et une absence du sitemap : `verify.mjs` refuse d'ailleurs toute
page HTML publiée qui n'y figure pas.

## Les commandes

| Commande | Ce qu'elle fait |
|---|---|
| `npm run seo:build` | tête HTML + sitemap + contrôles — **la commande à lancer après toute modification du site** |
| `npm run seo:head` | réécrit le bloc `<!-- seo:start -->…<!-- seo:end -->` de chaque page |
| `npm run seo:sitemap` | régénère `sitemap.xml` |
| `npm run seo:verify` | canonical, hreflang, liens morts, images, titres, JSON-LD, sitemap |
| `npm run seo:mobile` | débordement horizontal et cibles tactiles à 390 px (serveur local requis) |
| `npm run seo:images` | régénère `src/legal/img/` depuis `sources/` |
| `npm run seo:fonts` | régénère les WOFF2 depuis `sources/fonts/` |
| `npm run seo:indexnow` | signale les URL à IndexNow — **après** déploiement seulement |

`seo:head` et `seo:sitemap` sont idempotents : les relancer sans changement ne
touche aucun fichier. `sync-head.mjs --check` échoue au lieu d'écrire, ce qui en
fait une étape de CI utilisable telle quelle.

## Ajouter une page

1. Écrire `src/legal/<chemin>/index.html` (et sa jumelle française).
   Partir d'un guide existant : même en-tête, même pied de page, même
   `<div class="p-faq">` pour la FAQ.
2. Déclarer la paire dans `pages.json`.
3. `npm run seo:build`.
4. La lier depuis au moins une page existante — `verify.mjs` ne détecte pas
   encore l'orphelinat de maillage, seulement l'orphelinat de configuration.

## Rétablir `vendor/`

`build-fonts.py` a besoin de fontTools et de Brotli. Ils ne sont pas versionnés :
le paquet embarque un `.so` compilé pour cette machine. Une ligne suffit :

```bash
pip3 install --target src/legal/seo-relock/vendor "fonttools[woff]"
```

Le script les charge depuis ce dossier, jamais depuis l'environnement Python
global — il n'y a rien à activer ni à désactiver.

## Ce que les outils refusent de faire

`sync-head.mjs` construit le balisage `FAQPage` en **lisant les `<summary>`
réellement affichés** sur la page, jamais depuis `pages.json`. Écrire une
question dans les données structurées qui n'existe pas dans le texte visible est
donc impossible par construction — c'est exactement ce que les règles de Google
sur les données structurées interdisent, et la façon la plus simple de ne jamais
l'enfreindre par accident.

Dans le même esprit, aucun outil ici ne génère `aggregateRating`, `review` ni
`offers` : Relock n'a pas encore de fiche App Store publique, donc pas de note,
pas d'avis et pas de prix à déclarer.
