# CLAUDE.md — Colibri Calculateur

## Contexte

Cette application était le tunnel "Colibri Assurances" (calcul de peinture pour sinistrés Covea).
Elle est en cours de transformation en **calculateur de peinture public** pour la boutique
[colibripeinture.com](https://www.colibripeinture.com) (Shopify).

Le plan de transformation complet est dans **`PLAN.md`** (source de vérité du chantier,
miroir de la page Notion "Colibri Calculateur"). Travailler phase par phase, dans l'ordre.
Cocher les cases de `PLAN.md` au fur et à mesure et le committer avec les changements.

## Stack & commandes

- Next.js 15 (App Router) · React 19 · TypeScript strict · Tailwind 3 · pnpm
- `pnpm dev` — serveur local
- `pnpm type-check` — `tsc --noEmit` (OBLIGATOIRE avant chaque commit)
- `pnpm build` — build de prod (OBLIGATOIRE avant chaque PR)
- `pnpm lint` — ESLint

## Architecture

- `app/calculateur/*` — tunnel (nommé `app/sinistre/*` avant la Phase 1)
- `app/api/*` — routes serveur (seules à utiliser l'Admin API)
- `lib/calcul/index.ts` — algorithme de calcul (cœur métier, NE PAS modifier sans tests)
- `lib/shopify.ts` — Storefront API (catalogue, prix) · `lib/shopify-cart.ts` — panier Storefront
- `lib/shopify-admin.ts` / `-customers.ts` / `-draft-orders.ts` — Admin API (serveur uniquement)
- `lib/store/sinistreStore.ts` — state localStorage (pas de lib de state, helpers maison)
- `lib/kits-config.ts` — config kits matériel (prix hardcodés → à supprimer en Phase 3)

## Règles impératives

1. **Prix : la boutique Shopify est la SEULE source de vérité.** Interdiction absolue
   d'introduire ou de conserver un prix codé en dur (produits, kits, fallbacks PDF).
   Tout prix affiché provient de la Storefront API.
2. **Remise 15%** : jamais de remise "cosmétique" (calculs type `prix / 0.85` sans code réellement appliqué). La remise est
   réelle : `discountCodes` dans `cartCreate` (flux direct) et `appliedDiscount`
   PERCENTAGE 15 dans `draftOrderCreate` (flux estimation). Le code promo vient d'une
   variable d'environnement, jamais en dur.
3. **Secrets** : le token Admin API ne transite JAMAIS côté client. Toute mutation Admin
   passe par une route `app/api/*`. Ne jamais committer de `.env*`.
4. **TypeScript strict** : pas de `any`, pas de `@ts-ignore`. Si le typage bloque,
   corriger le type, pas le contourner.
5. **Rebranding** : aucune occurrence de `covea`, `assureur`, `assurance`, `sinistre`
   ne doit subsister dans `app/`, `components/`, `lib/`, `hooks/` à la fin de la Phase 1
   (CHANGELOG.md et docs/ historiques exclus). Vérifier par grep avant de conclure.
6. **Textes UI en français**, ton grand public rénovation (jamais de vocabulaire
   assurance/sinistre).
7. **Ne pas ajouter de dépendances** sans justification écrite dans la PR. Pas de lib de
   state, pas d'ORM, pas de framework UI supplémentaire.
8. **Périmètre** : la landing page marketing est HORS périmètre (gérée séparément).
   La page d'accueil de l'app (`app/page.tsx`, "Bienvenue" + Démarrer/Reprendre)
   est conservée et rebrandée — pas de refonte au-delà de PLAN.md.
9. **Sorties du panier** (Phase 4) : checkout pré-rempli, cart permalink
   "Continuer mes achats" (`?discount={CODE}&storefront=true`), estimation par
   email. Le code promo n'est jamais affiché à l'écran — seule la mention
   "-15% appliqués automatiquement" apparaît.

## Workflow git

- Une branche par phase : `feat/phase-1-rebranding`, `feat/phase-2-remise`, etc.
- Commits petits et atomiques, messages en français, préfixés `feat:`, `fix:`,
  `refactor:`, `test:`, `chore:`.
- Avant chaque commit : `pnpm type-check`. Avant chaque PR : `pnpm build` + `pnpm lint`.
- Ne jamais pousser directement sur `main`. Chaque PR est validée via le preview
  deployment Vercel avant merge.
- Mettre à jour `CHANGELOG.md` (format Keep a Changelog, en français) à chaque PR.

## Pièges connus (hérités du code)

- **Mapping variantes** : `lib/calcul` a historiquement sélectionné les variantes par
  contenance ("3L") sans filtrer la finition (Mat/Velours/Satin ont des prix
  différents). Toute modification dans cette zone exige un test couvrant
  "même contenance, finitions différentes → prix différents".
- **Handles kits** : les vrais handles boutique sont `kit-peinture-petite-surface`
  (24,90 €) et `kit-materiel-de-peinture-moyenne-et-grande-surface-1` (49,90 €).
  Les handles dans `KIT_HANDLES` sont obsolètes (404).
- **`DISCOUNT_FACTOR = 0.85`** dans `app/sinistre/panier/page.tsx` : remise fictive à
  supprimer intégralement en Phase 2 (plusieurs occurrences : total, coût/m², lignes).
- **Draft orders** : `appliedDiscount` est déjà supporté par `createDraftOrder` mais
  jamais transmis par `app/api/sinistre/checkout/route.ts`.
- **localStorage** : clés `colibri-sinistre-*` + `CUSTOMER_ID` + `USER_DATA` +
  `SHOPIFY_CART_*`. Le renommage des clés (Phase 1) fait perdre les brouillons en
  cours : accepté, ne pas écrire de migration.
- **Réduction automatique Shopify ≠ code promo** : ne jamais proposer une "automatic
  discount" Shopify pour la remise calculateur (elle s'appliquerait à toute la boutique).

## Définition de "terminé" (chaque PR)

- [ ] `pnpm type-check`, `pnpm build`, `pnpm lint` passent
- [ ] Cases correspondantes cochées dans `PLAN.md`
- [ ] `CHANGELOG.md` mis à jour
- [ ] Aucun prix en dur introduit, aucun secret exposé
- [ ] Parcours complet testable sur le preview Vercel (indiquer les scénarios à
      vérifier dans la description de PR)
