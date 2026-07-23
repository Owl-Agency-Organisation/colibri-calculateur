# PLAN.md — Transformation Colibri Assurances → Colibri Calculateur

> Source de vérité du chantier (miroir de la page Notion "📏 Colibri Calculateur").
> Une branche par phase. Cocher les cases au fil de l'eau et committer ce fichier.
> Les règles de travail sont dans `CLAUDE.md`. Décisions finalisées le 19/07/2026.

## Décisions actées (toutes tranchées — ne pas rouvrir)

- Landing page marketing : HORS périmètre (gérée séparément).
- Routes publiques : `/calculateur/*` (remplace `/sinistre/*`).
- Page d'accueil de l'app : CONSERVÉE (structure "Bienvenue dans votre espace dédié"
  + boutons "Démarrer" / "Reprendre mon projet"), textes rebrandés sans assurance.
- Remise : 15% fixe, réelle, appliquée automatiquement par l'app (code promo injecté,
  jamais saisi ni affiché comme code). NON cumulable avec le code newsletter -10%.
- Prix : boutique Shopify = seule source de vérité, zéro prix hardcodé.
- Kit matériel : TOUT-OU-RIEN — produit Shopify unique au prix bundle, contenu
  affiché à titre informatif non modifiable, personnalisation par élément supprimée.
- Sortie du tunnel : TRIPLE issue depuis le panier —
  1. "🛒 Régler ma commande" → cart Storefront → checkout Shopify pré-rempli
  2. "🛍️ Continuer mes achats" → cart permalink boutique
     `https://www.colibripeinture.com/cart/{variantId}:{qté},...?discount={CODE}&storefront=true`
  3. "✉️ Recevoir mon estimation par e-mail" → modale → client + draft order remisé
- Formulaire d'identification : supprimé du début de tunnel, réutilisé en modale
  pour l'estimation uniquement. Klaviyo relance via tag client `calculateur`.
- Options rénovation conservées, textes reformulés hors contexte sinistre.
- Repo : RENOMMAGE `colibri-assurances` → `colibri-calculateur` (archivage préalable
  par tag + branche). Pas de nouveau repo.

---

## Phase 0 — Préparation (branche : `chore/phase-0-setup`)

- [x] Créer le tag `v1.7.5-assurances` et la branche `archive/assurances` depuis `main`
      — branche poussée le 19/07 ; ⚠️ tag créé localement mais push de tags bloqué
      par l'environnement distant : exécuter `git push origin v1.7.5-assurances`
      depuis un poste local (ou créer une release GitHub sur ce nom depuis `main`)
- [x] `.env.local.example` : retirer `COVEA_DISCOUNT_CODE`, ajouter `DISCOUNT_CODE`
      (code promo -15% `PROMO-APP-CALCULATEUR`, lu côté serveur et injecté dans `cartCreate` et le permalink)
- [x] Vérifier `pnpm install`, `pnpm type-check`, `pnpm build` passent — OK le 19/07
      (config ESLint minimale ajoutée au passage, `pnpm lint` passe aussi)
- [x] (Humain) ✅ Repo renommé `colibri-calculateur` + projet Vercel renommé,
      intégration Git vérifiée (19/07). Repo repassé en privé.
- [x] (Humain) ✅ Code promo -15% `PROMO-APP-CALCULATEUR` créé dans Shopify
      (non cumulable) + variable `DISCOUNT_CODE` posée dans Vercel
      (Production + Preview + Development) — fait le 19/07

## Phase 1 — Rebranding (branche : `feat/phase-1-rebranding`)

Renommages structurels :
- [x] `app/sinistre/*` → `app/calculateur/*` ; `app/api/sinistre/checkout` →
      `app/api/calculateur/checkout` ; mettre à jour tous les `router.push` et `Link`
- [x] `lib/store/sinistreStore.ts` → `projetStore.ts` ; type `Assure` → `Client` ;
      clés localStorage `colibri-sinistre-*` → `colibri-projet-*` (pas de migration,
      perte des brouillons acceptée)
- [x] `SINISTRE_STEPS` → `CALCULATEUR_STEPS` (`StepIndicator.tsx`, `useStepperNavigation.ts`)

Contenus :
- [x] Page d'accueil : conserver la structure (Bienvenue + Démarrer/Reprendre),
      purger textes assurance (dont l'ancienne mention de remise assureur)
      — la page "Bienvenue" (ex-`/sinistre`) devient `app/page.tsx` ; l'ancienne
      landing marketing assurance (hors périmètre) et `landing.css` sont supprimées ;
      header/footer mutualisés dans le layout racine ; `/calculateur` redirige vers `/`
- [x] `app/layout.tsx` : metadata title/description sans mention assurance
- [x] Identification : supprimer champ `assureur`, `ASSUREUR_OPTIONS`, validation,
      message "Grâce à [assureur]..." (la refonte du flux vient en Phase 4)
- [x] `lib/types.ts` : retirer `assureur?`
- [x] Tags Shopify `['covea']` → `['calculateur']` : `lib/shopify-customers.ts`,
      `app/api/shopify/customer/route.ts`, route checkout (conserver `projet-sauvegarde`)
- [x] `app/api/generate-pdf/route.ts` : textes/branding sans mention assurance
- [x] Header : baseline "Votre calculateur de peinture" (option validée le 19/07
      parmi 3 propositions) ; "Besoin d'aide ? 05 62 14 16 46" conservé
- [x] Reformuler tous les textes évoquant le sinistre dans le tunnel
- [x] Nettoyer `landing.css` / classes orphelines (supprimés avec la landing)
- [x] Doc du repo : README purgé (réécriture complète en Phase 5) ; supprimés de
      `main` : `ANALYSE_PRIX.md`, `BACKLOG.md`, `ROLLBACK.md`,
      `docs/TODO_CLIENT_FEEDBACK.md`, ADR 003 (produits offerts Covea, sans objet) —
      tout reste dans `archive/assurances` ; `ARCHITECTURE.md`, `DOCS_FINITIONS.md`
      et `docs/MULTI_MURS_FEATURE.md` conservés et reformulés
- [x] Vérification finale : `grep -rni "covea\|assureur\|assurance\|sinistre"
      app/ components/ lib/ hooks/` → 0 résultat (preuve dans la PR)
      ⚠️ Exception documentée : 7 URLs d'images CDN Shopify `ColibriAssurances_P0x_*.png`
      (choix de pièce) conservées telles quelles — décision du 19/07, renommage côté
      boutique à faire plus tard (connecteur Shopify branché sur une autre boutique)

## Phase 2 — Remise réelle 15% + prix boutique (branche : `feat/phase-2-remise`)

- [x] `lib/shopify-cart.ts` : `discountCodes: [process.env.DISCOUNT_CODE]` dans
      l'input de `cartCreate` (et lors des recréations de panier)
      — ⚠️ `createCart` était appelée **côté client** : `process.env.DISCOUNT_CODE`
      (serveur-only, pas `NEXT_PUBLIC_`) y valait `undefined`. Création du panier
      déplacée derrière la route serveur `app/api/calculateur/cart` qui appelle
      `createCart` ; le code promo est ainsi lu et injecté côté serveur, jamais exposé.
- [x] Route checkout, mode `save` : transmettre
      `appliedDiscount: { description: 'Remise calculateur', value: 15, valueType: 'PERCENTAGE' }`
- [x] Panier : supprimer TOUTES les occurrences de `DISCOUNT_FACTOR` ; prix barré =
      prix catalogue réel, prix remisé = catalogue × 0,85 ; mention
      "-15% appliqués automatiquement" + montant économisé (jamais le code affiché)
      — les montants remisés affichés proviennent de Shopify (`cost.totalAmount` par
      ligne, remise réellement appliquée), pas d'un `× 0,85` recalculé en JS, pour
      garantir l'égalité au centime près avec le checkout du même panier.
- [x] `app/api/generate-pdf/route.ts` : supprimer le fallback `PRIX_PAR_CONTENANT`
      — déjà absent : cette table de prix vivait dans `ANALYSE_PRIX.md` (supprimé en
      Phase 1). Le PDF ne source que des prix Shopify (`resultat`/`lignesPanier`) et
      n'est plus branché à aucun appelant. Aucun prix codé en dur.
- [x] `lib/shopify.ts` : `revalidate` 3600 → 900
- [x] Contrôle documenté dans la PR : total panier app = total checkout au centime près

## Phase 3 — Kits tout-ou-rien dynamiques (branche : `feat/phase-3-kits`)

- [x] `KIT_HANDLES` → `kit-peinture-petite-surface` et
      `kit-materiel-de-peinture-moyenne-et-grande-surface-1`
      — déjà corrects dans `lib/calcul/index.ts` ; vérifiés et conservés
- [x] `lib/kits-config.ts` : supprimé prix et contenu (composants) hardcodés ; le kit
      est désormais ajouté au panier comme une ligne Shopify unique au prix bundle
      (`lib/cart-mapper.ts`, `mapKitToCartLines`) ; le contenu informatif provient de
      la description du produit Shopify (`app/api/shopify/products/variants/route.ts`
      expose désormais `description`)
- [x] UI : case unique cocher/décocher (`app/calculateur/options/page.tsx`) ; contenu
      informatif non modifiable ; personnalisation par élément et bouton
      "Réinitialiser le kit" supprimés
- [x] Seuils conservés : petite surface ≤ 30 m², moyenne/grande > 30 m²
      (`determinerKit` dans `lib/kits-config.ts`)

## Phase 4 — Tunnel réordonné + triple sortie (branche : `feat/phase-4-tunnel`)

- [ ] Supprimer l'étape Identification du stepper ; le tunnel démarre au choix des
      pièces ; adapter navigation et garde-fous
- [ ] "🛒 Régler ma commande" : supprimer la dépendance à `CUSTOMER_ID` ;
      `buyerIdentity` optionnel ; redirection `checkoutUrl`
- [ ] "🛍️ Continuer mes achats" : construire le cart permalink
      `https://www.colibripeinture.com/cart/{variantId}:{qté},...?discount={CODE}&storefront=true`
      depuis les lignes du panier ; tester réellement la redirection vers `/cart`
      avec remise conservée et documenter le comportement dans la PR
- [ ] "✉️ Recevoir mon estimation" : modale légère (email requis ; prénom, nom,
      téléphone optionnels ; case consentement marketing + lien politique de
      confidentialité) → création client tag `calculateur` → draft order remisé →
      email invoice → écran de confirmation
- [ ] Réutiliser la validation email/téléphone existante (`lib/utils`)
- [ ] Supprimer le code mort de l'ancienne étape identification

## Phase 5 — Qualité & mise en prod (branche : `test/phase-5-qualite`)

- [ ] Installer Vitest (seule dépendance autorisée de cette phase) + script `pnpm test`
- [ ] Tests `lib/calcul` : `calculerLitresNecessaires` (2 couches),
      `optimiserContenants`, `determinerTypeSousCouche`, `calculerPrixTotal` —
      dont le cas "même contenance, finitions différentes → prix différents"
      ET le cas "produit disposant des deux gammes (Biosourcée + Dépolluante,
      même contenance+finition) → la variante retenue est Biosourcée, prix conforme"
      (`selectionnerVariantGammeStandard`, verrou ajouté en Phase 2)
- [ ] Ajouter `pnpm test` au CI (`.github/workflows/ci.yml`)
- [ ] Fournir la matrice de recette manuelle (checklist) :
      {1 pièce, multi-pièces, multi-murs, ±kit, ±rénovation} ×
      {commande directe, continuer achats, estimation email}
- [ ] Domaine (après confirmation, proposition `calculateur.colibripeinture.com`) :
      metadata/OG mises à jour
- [ ] `README.md` réécrit (calculateur public, plus de mention assurance)
