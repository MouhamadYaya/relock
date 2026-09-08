---
name: i18n-sync
description:
  Traduit et synchronise les textes de Relock en français, anglais et espagnol.
  À utiliser DÈS QU'UN TEXTE AFFICHÉ EST AJOUTÉ OU MODIFIÉ dans src/ ou app/ —
  un écran, un libellé, un bouton, une alerte, une notification, un message
  d'erreur — et quand `npm run check:i18n` échoue, quand l'utilisateur lance
  `/i18n`, ou quand il parle de localisation, de traduction, de langue, de
  fr/en/es, de clés manquantes ou de texte en dur.
---

# Localisation Relock — fr / en / es

Relock **s'écrit en français** et **se livre en trois langues**. Le français est
la source ; l'anglais et l'espagnol se déduisent de lui.

Un texte ajouté sans traduction ne casse rien : l'app démarre, l'écran
s'affiche, les tests passent. Ça ne se voit qu'en changeant la langue de l'app
et en rouvrant l'écran exact — c'est-à-dire jamais. **C'est pourquoi la
traduction se fait dans le même passage que l'ajout du texte, pas plus tard.**

## Règle de travail

Quand tu ajoutes ou modifies un texte affiché :

1. écris-le en français dans `src/i18n/locales/fr.json` ;
2. appelle-le par `t('section.cle')` (composant) ou `translate('section.cle')`
   (service, module de calcul, hors React) ;
3. **traduis-le en anglais et en espagnol dans le même passage** ;
4. termine par `npm run check:i18n`.

Ne laisse jamais une clé française seule dans `en.json` ou `es.json`. Ne
recopie jamais le français pour « faire passer » le garde.

## Procédure

```bash
npm run check:i18n        # ce qui manque, et pourquoi
npm run i18n:missing      # le français à traduire, clé par clé
```

Traduis, puis réinjecte — un fichier par langue, plat ou imbriqué :

```bash
node scripts/i18n-missing.cjs --out /tmp/i18n   # gabarits en.todo.json / es.todo.json
# … tu remplaces les valeurs françaises par les traductions …
npm run i18n:merge -- en /tmp/i18n/en.todo.json
npm run i18n:merge -- es /tmp/i18n/es.todo.json
npm run i18n:types                              # types littéraux de t()
npm run check:i18n                              # doit finir sur [OK]
```

`i18n-merge` refuse le lot entier si une clé est absente du français, vide, ou
si les `{{variables}}` ne correspondent plus — rien n'est écrit à moitié.

## Comment traduire

Ce n'est pas de la traduction littérale : c'est **la même voix, dans une autre
langue**.

- **Ton** — Relock tutoie en français, s'adresse directement en anglais
  (« you ») et tutoie en espagnol (« tú »). Jamais de vouvoiement, jamais de
  « usted ».
- **Registre** — parlé, direct, court. Pas de jargon produit, pas de
  marketing. Si la phrase française tient en six mots, la traduction aussi.
- **Ce qui ne se traduit pas** — les noms de marques (Relock, TikTok,
  Instagram…), les horaires (`09:00 – 17:00`), les gabarits sans mot
  (`{{hours}} h {{minutes}}`).
- **Les `{{variables}}`** se recopient à l'identique. Une variable perdue
  laisse un trou dans la phrase (« Essayer  jours gratuitement ») sans jamais
  lever d'erreur.
- **Les pluriels** i18next vont par paires `_one` / `_other`, et les deux
  doivent exister dans les trois langues.
- **L'espagnol** : `y` devient `e` devant un mot commençant par le son /i/
  (« sueño e insomnio ») ; `¿` et `¡` ouvrants sont obligatoires.
- **La longueur compte** : l'anglais raccourcit, l'espagnol rallonge d'environ
  20 %. Sur une ligne de réglage ou un bouton, préfère la formule courte —
  `SettingsScreen.i18n.test.tsx` vérifie que chaque ligne tient sur une ligne.

## Texte en dur

Si `check:i18n` signale un texte en dur, la réponse par défaut est de le
sortir dans les fichiers de langue. L'échappatoire `// i18n-ignore` (la ligne
et la suivante) n'existe que pour ce qui **ne part pas dans le binaire** — une
commande de développement derrière `__DEV__`. Elle ne sert jamais à faire
taire un vrai oubli.

Les fichiers entièrement de développement sont déjà exclus dans
`NOT_SHIPPED` (`scripts/i18n-lib.cjs`).

## Images contenant du texte

Une illustration dont le texte est **dans les pixels** ne se traduit pas par
`t()` : il faut un fichier par langue, servi par `localizedImage()`
(`src/i18n/localized-image.ts`). Signale-le à l'utilisateur — c'est un rendu à
produire, pas une ligne de code à écrire.

## Natif iOS

Les cinq extensions Family Controls ne lisent pas les fichiers JSON. Leurs
textes vivent en Swift, choisis par `RelockLanguage.pick(fr:en:es:)`
(`ios/Shared/RelockLanguage.swift`), qui suit la langue publiée par l'app.
Un texte ajouté dans une extension se traduit là, dans les trois langues, au
même moment.

## Ajouter une quatrième langue

`TARGETS` dans `scripts/i18n-lib.cjs`, `SUPPORTED_LANGUAGES` + `resources`
dans `src/i18n/i18n.ts`, la liste de `LanguagePickerModal.tsx`, le `switch` de
`RelockLanguage.swift`, et `knownRegions` + un `.lproj` dans le projet Xcode.
