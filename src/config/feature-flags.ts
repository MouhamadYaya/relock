/**
 * Interrupteurs produit. Booléens simples, sans dépendance à l'environnement
 * (le `.env` et `__DEV__` se règlent ailleurs — voir `env.ts` et `constants.ts`).
 */
export const featureFlags = {
  enableNewOnboarding: false,
  enableExperimentalUI: false,
  enableOffline: true,
  /**
   * Affiche la PREUVE SOCIALE des écrans d'acquisition : témoignages signés,
   * note en étoiles, compteurs d'avis et d'utilisateurs, logos universitaires.
   *
   * ⚠️ À `false`, et ce n'est pas un réglage de confort.
   *
   * Ces contenus existent (maquettes rédigées en interne, textes conservés dans
   * `src/i18n/locales/*.json` sous `paywall_reference.*`), mais ils sont FAUX :
   * Relock n'est pas publié, il n'y a ni avis, ni utilisateurs, ni « Alex R. »,
   * ni partenariat avec Oxford, Harvard ou Cambridge. Les afficher, c'est :
   *   - App Store 2.3.1 (métadonnées trompeuses) — motif de rejet ;
   *   - directive 2005/29/CE et art. L.121-2 du code de la consommation — un
   *     faux avis signé est une pratique commerciale trompeuse, pas une figure
   *     de style publicitaire ;
   *   - pour les blasons universitaires, une contrefaçon de marque doublée
   *     d'une affiliation imaginaire.
   *
   * POUR RÉACTIVER — l'ordre compte :
   *   1. Remplacer les textes de `paywall_reference.testimonial*` /
   *      `author*` / `reviews` / `users` par de VRAIS avis (App Store Connect,
   *      avec le pseudo réel de leur auteur), dans les 4 locales.
   *   2. Remplacer `SOCIAL_PROOF` dans `src/features/onboarding/scenes-intro.tsx`
   *      par les chiffres réels de la fiche App Store.
   *   3. Pour les logos universitaires : ne les rallumer QUE si une
   *      autorisation écrite existe. Sinon, retirer `PaywallTrustLogos` de
   *      `PaywallBenefits.tsx` — ce point-là ne dépend pas du flag.
   *   4. Passer ce booléen à `true`.
   *   5. Mettre à jour `src/features/onboarding/unverified-claims.test.ts`,
   *      qui verrouille tout ce qui précède et échouera sinon.
   *
   * Les points d'affichage sont tous les quatre dans `src/features/onboarding/` :
   * `scenes-intro.tsx`, `components/paywall/PaywallPlans.tsx` (×2),
   * `components/paywall/PaywallBenefits.tsx`.
   */
  showUnverifiedSocialProof: false,
}
