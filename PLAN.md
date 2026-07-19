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

- [ ] Créer le tag `v1.7.5-assurances` et la branche `archive/assurances` depuis `main`
- [ ] `.env.local.example` : retirer `COVEA_DISCOUNT_CODE`, ajouter `DISCOUNT_CODE`
      (code promo -15% `PROMO-APP-CALCULATEUR`, lu côté serveur et injecté dans `cartCreate` et le permalink)
- [ ] Vérifier `pnpm install`, `pnpm type-check`, `pnpm build` passent
- [x] (Humain) ✅ Repo renommé `colibri-calculateur` + projet Vercel renommé,
      intégration Git vérifiée (19/07). Repo repassé en privé.
- [x] (Humain) ✅ Code promo -15% `PROMO-APP-CALCULATEUR` créé dans Shopify
      (non cumulable) + variable `DISCOUNT_CODE` posée dans Vercel
      (Production + Preview + Development) — fait le 19/07

## Phase 1 — Rebranding (branche : `feat/phase-1-rebranding`)

Renommages structurels :
- [ ] `app/sinistre/*` → `app/calculateur/*` ; `app/api/sinistre/checkout` →
      `app/api/calculateur/checkout` ; mettre à jour tous les `router.push` et `Link`
- [ ] `lib/store/sinistreStore.ts` → `projetStore.ts` ; type `Assure` → `Client` ;
      clés localStorage `colibri-sinistre-*` → `colibri-projet-*` (pas de migration,
      perte des brouillons acceptée)
- [ ] `SINISTRE_STEPS` → `CALCULATEUR_STEPS` (`StepIndicator.tsx`, `useStepperNavigation.ts`)

Contenus :
- [ ] Page d'accueil : conserver la structure (Bienvenue + Démarrer/Reprendre),
      purger textes assurance (dont l'ancienne mention de remise assureur)
- [ ] `app/layout.tsx` : metadata title/description sans mention assurance
- [ ] Identification : supprimer champ `assureur`, `ASSUREUR_OPTIONS`, validation,
      message "Grâce à [assureur]..." (la refonte du flux vient en Phase 4)
- [ ] `lib/types.ts` : retirer `assureur?`
- [ ] Tags Shopify `['covea']` → `['calculateur']` : `lib/shopify-customers.ts`,
      `app/api/shopify/customer/route.ts`, route checkout (conserver `projet-sauvegarde`)
- [ ] `app/api/generate-pdf/route.ts` : textes/branding sans mention assurance
- [ ] Header : remplacer la baseline "Partenaire de votre assureur" (proposer 2-3
      options avant d'implémenter) ; conserver "Besoin d'aide ? 05 62 14 16 46"
- [ ] Reformuler tous les textes évoquant le sinistre dans le tunnel
- [ ] Nettoyer `landing.css` / classes orphelines
- [ ] Doc du repo : purger le README des mentions assurance (réécriture complète
      en Phase 5) ; supprimer de `main` les docs obsolètes du contexte assurance
      (`ANALYSE_PRIX.md`, `docs/TODO_CLIENT_FEEDBACK.md`, autres docs/ sans objet —
      elles restent dans `archive/assurances`) ; conserver les ADR encore
      pertinentes en les reformulant
- [ ] Vérification finale : `grep -rni "covea\|assureur\|assurance\|sinistre"
      app/ components/ lib/ hooks/` → 0 résultat (coller la preuve dans la PR)

## Phase 2 — Remise réelle 15% + prix boutique (branche : `feat/phase-2-remise`)

- [ ] `lib/shopify-cart.ts` : `discountCodes: [process.env.DISCOUNT_CODE]` dans
      l'input de `cartCreate` (et lors des recréations de panier)
- [ ] Route checkout, mode `save` : transmettre
      `appliedDiscount: { description: 'Remise calculateur', value: 15, valueType: 'PERCENTAGE' }`
- [ ] Panier : supprimer TOUTES les occurrences de `DISCOUNT_FACTOR` ; prix barré =
      prix catalogue réel, prix remisé = catalogue × 0,85 ; mention
      "-15% appliqués automatiquement" + montant économisé (jamais le code affiché)
- [ ] `app/api/generate-pdf/route.ts` : supprimer le fallback `PRIX_PAR_CONTENANT`
- [ ] `lib/shopify.ts` : `revalidate` 3600 → 900
- [ ] Contrôle documenté dans la PR : total panier app = total checkout au centime près

## Phase 3 — Kits tout-ou-rien dynamiques (branche : `feat/phase-3-kits`)

- [ ] `KIT_HANDLES` → `kit-peinture-petite-surface` et
      `kit-materiel-de-peinture-moyenne-et-grande-surface-1`
- [ ] `lib/kits-config.ts` : supprimer prix et contenu hardcodés ; prix + contenu
      chargés via Storefront API (description produit)
- [ ] UI : case unique cocher/décocher ; contenu informatif non modifiable ;
      supprimer la personnalisation par élément et le bouton "Réinitialiser le kit"
- [ ] Seuils conservés : petite surface ≤ 30 m², moyenne/grande > 30 m²

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
- [ ] Ajouter `pnpm test` au CI (`.github/workflows/ci.yml`)
- [ ] Fournir la matrice de recette manuelle (checklist) :
      {1 pièce, multi-pièces, multi-murs, ±kit, ±rénovation} ×
      {commande directe, continuer achats, estimation email}
- [ ] Domaine (après confirmation, proposition `calculateur.colibripeinture.com`) :
      metadata/OG mises à jour
- [ ] `README.md` réécrit (calculateur public, plus de mention assurance)
