# Changelog

Toutes les modifications notables de ce projet seront documentées dans ce fichier.

Le format est basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/),
et ce projet adhère au [Semantic Versioning](https://semver.org/lang/fr/).

## [Non publié]

### Phase 4 — Tunnel réordonné + triple sortie

#### Ajouté
- **Route serveur `POST /api/calculateur/permalink`** ("Continuer mes achats") :
  construit le cart permalink boutique
  `https://www.colibripeinture.com/cart/{id}:{qté},...?discount={CODE}&storefront=true`
  à partir des lignes du panier. Extraction stricte de l'identifiant numérique de
  variante depuis le GID Storefront (suffixe de contexte `@inContext` toléré),
  fail-closed : une ligne invalide refuse tout le permalink (jamais de panier
  partiel silencieux). Le code promo est lu côté serveur, jamais dans le bundle
  client. ⚠️ Le permalink remplace le panier boutique existant et la remise
  s'applique à tout le panier boutique (comportement Shopify, accepté).
- **Route serveur `POST /api/calculateur/estimation`** ("Recevoir mon estimation") :
  enchaîne recherche/création du client Shopify (tag `calculateur`) → draft order
  remisé 15% (`appliedDiscount` PERCENTAGE, mécanisme Phase 2) → e-mail invoice.
  Revalidation serveur des entrées (e-mail, téléphone, lignes) et **rate limiting
  par IP** (5 requêtes / 10 min, fenêtre glissante en mémoire, best-effort par
  instance serverless) : la route crée de vraies ressources Shopify sur une app
  publique.
- **`components/modals/EstimationModal.tsx`** : modale légère (e-mail requis ;
  prénom, nom, téléphone optionnels ; case de consentement marketing décochée par
  défaut avec lien vers la politique de confidentialité). Validation
  e-mail/téléphone réutilisée de `lib/utils`. L'estimation part même sans
  consentement ; si la case est cochée, le consentement single opt-in est posé
  (`emailMarketingConsent` à la création, mutation
  `customerEmailMarketingConsentUpdate` pour un client existant).
- **`components/ui/InfoTooltip.tsx`** : infobulle informative (survol, focus,
  clic mobile) posée sur les badges de finition (Surfaces, Récapitulatif) :
  règle factuelle des finitions automatiques + renvoi au 05 62 14 16 46, sans
  promesse de personnalisation.

#### Modifié
- **Le tunnel démarre au choix des pièces** : étape Identification supprimée,
  stepper renuméroté (6 étapes), garde-fous sans condition d'identification,
  boutons de l'accueil → `/calculateur/piece`.
- **"🛒 Régler ma commande"** : plus aucune dépendance à `CUSTOMER_ID` ;
  redirection directe vers `cart.checkoutUrl`. `buyerIdentity` optionnel : posé à
  la création du panier uniquement si des coordonnées (estimation précédente)
  existent, sinon le checkout Shopify collecte les coordonnées.
- **Type `Client` allégé** (e-mail + prénom/nom/téléphone optionnels) : ne sert
  plus qu'à pré-remplir la modale d'estimation et le checkout.
- **Page Confirmation réécrite** : confirme l'envoi de l'estimation par e-mail
  (l'ancien contenu "PDF téléchargé" correspondait à un flux mort).
- `clearProjetData()` purge aussi les clés techniques du panier
  (`SHOPIFY_CART_ID`, `SHOPIFY_CART_DATA_HASH`, `KIT_TYPE`) et les clés héritées
  (`CUSTOMER_ID`, `USER_DATA`).

#### Supprimé
- `app/calculateur/identification/` (étape et formulaire), clés localStorage
  `CUSTOMER_ID` / `USER_DATA` (plus écrites, purgées au reset, pas de migration).
- `app/api/calculateur/checkout/route.ts` : le mode `direct` ne faisait que
  renvoyer l'URL reçue ; le mode `save` est remplacé par la route estimation.
- `app/api/shopify/customer/route.ts` (seul appelant : l'identification).
- `app/api/generate-pdf/route.ts` : flux PDF sans aucun appelant (mort depuis la
  refonte), supprimé plutôt que maintenu.
- `updateCartBuyerIdentity` / `UserData` dans `lib/shopify-cart.ts` (sans appelant).

### Phase 3 — Kits tout-ou-rien dynamiques

#### Modifié
- **Kit matériel traité comme un produit Shopify unique** : `lib/cart-mapper.ts`
  (`mapKitToCartLines`) ajoute désormais **une seule ligne de panier** au prix bundle
  du produit Shopify (`kit-peinture-petite-surface` ou
  `kit-materiel-de-peinture-moyenne-et-grande-surface-1`), au lieu d'ajouter chaque
  composant individuellement. Le prix bundle étant inférieur à la somme des
  composants, sommer les composants aurait affiché un total supérieur au prix
  réellement facturé au checkout.
- **`lib/kits-config.ts`** : suppression de tous les prix et contenus (composants)
  codés en dur. Ne reste que la référence locale handle/titre/seuil ; le prix vient
  de la Storefront API (déjà le cas via `lib/calcul/index.ts`), le contenu affiché
  vient de la description du produit Shopify.
- **`app/api/shopify/products/variants/route.ts`** : expose désormais le champ
  `description` du produit (déjà récupéré par `lib/shopify.ts`) pour permettre
  l'affichage du contenu du kit à titre informatif.
- **UI tout-ou-rien (`app/calculateur/options/page.tsx`)** : une seule case à cocher
  pour inclure le kit. Le contenu (issu de la description Shopify) est affiché à
  titre informatif, non modifiable. Suppression de la personnalisation par élément
  (croix par ligne) et du bouton « Réinitialiser le kit ».
- **`app/calculateur/panier/page.tsx`** : le titre et le sous-total du kit
  proviennent directement de `resultat.kit` (calcul métier) plutôt que d'une
  reconstruction à partir des composants présents dans le panier.

#### Supprimé
- Code mort lié à la personnalisation du kit par composant : état `composantsKit`,
  handlers `supprimerComposantKit` / `reinitialiserKit`, type `ComposantKit`,
  fonction `findVariantByFilter` (`lib/cart-mapper.ts`), `calculerPrixKit`
  (`lib/kits-config.ts`).

#### Notes
- Seuils de recommandation inchangés : kit petite surface ≤ 30 m², kit moyenne et
  grande surface > 30 m² (`determinerKit`).
- La remise -15% s'applique au kit comme au reste du panier (ligne Shopify standard,
  soumise au même code promo que les autres lignes).

### Phase 2 — Remise réelle 15% + prix boutique

#### Ajouté
- **Route serveur `POST /api/calculateur/cart`** : crée le panier Shopify côté serveur
  afin d'injecter le code promo -15% (`process.env.DISCOUNT_CODE`) dans `cartCreate`
  sans jamais l'exposer au client (le code n'est ni saisi, ni affiché, ni envoyé au
  navigateur). La remise est ainsi réellement appliquée par Shopify et se répercute
  automatiquement sur le checkout du panier.
- **Mention panier** : badge « -15% appliqués automatiquement · vous économisez X € »
  (montant économisé affiché, jamais le code).

#### Modifié
- **`lib/shopify-cart.ts`** : `discountCodes: [DISCOUNT_CODE]` ajouté à l'input de
  `cartCreate` ; le fragment GraphQL récupère désormais `cost.subtotalAmount`
  (catalogue) et `cost.totalAmount` (après remise) par ligne.
- **`app/api/calculateur/checkout/route.ts`** (mode `save`) : le draft order de
  l'estimation par e-mail applique `appliedDiscount` PERCENTAGE 15 (« Remise
  calculateur ») — même remise réelle que le flux direct.
- **`app/calculateur/panier/page.tsx`** : suppression totale de `DISCOUNT_FACTOR`
  (ancienne remise fictive). Le prix barré = prix catalogue réel Shopify, le prix
  affiché = montant remisé calculé par Shopify (`cost.totalAmount`). Total, coût/m²,
  lignes produit et sous-total kit alignés sur ces montants réels ; la création du
  panier passe par la route serveur.
- **`lib/shopify.ts`** : cache Storefront `revalidate` abaissé de 3600 s à 900 s
  (15 min) pour refléter plus vite les changements de prix boutique.

#### Corrigé
- **Affichage de la remise au panier** : le prix barré, le badge « −15 % » et le
  montant économisé ne s'affichaient pas. Cause : un code promo « montant sur la
  commande » n'inscrit pas la remise dans `cost.totalAmount` des lignes (elle vit
  dans `discountAllocations`), donc `totalAmount == subtotalAmount` et l'app se
  croyait sans remise. Le fragment lit désormais `discountAllocations`
  (niveau ligne **et** panier) et `discountCodes { applicable }` ; l'économie est la
  somme exacte des allocations Shopify. Nouveau bloc de synthèse en miroir du
  checkout : **Sous-total → Remise −15 % → Total**, les trois montants venant de
  Shopify (le total n'est jamais une somme d'arrondis locaux). Garde-fou serveur :
  log d'erreur explicite si un code soumis revient `applicable: false` (le code
  n'est jamais loggé ni exposé).
- **Verrou de gamme (fidélité des prix)** : un coloris Colibri expose deux gammes
  partageant contenance ET finition (« Biosourcée » standard et « Biosourcée
  dépolluante »). La sélection de variant reposait sur `.find(contenance + finition)`
  qui retenait la **première** correspondance selon l'ordre de l'API — non
  déterministe (ex. Schmidt Blanc 3L Mate : 92,68 € Biosourcée vs 107,65 €
  Dépolluante). `lib/calcul/index.ts` et `lib/cart-mapper.ts` verrouillent désormais
  explicitement la **gamme standard (Biosourcée)** via `selectionnerVariantGammeStandard`
  (exclusion de la Dépolluante, quel que soit le libellé) ; les produits mono-gamme
  restent intacts. Prix affiché et prix envoyé à Shopify utilisent le **même** verrou,
  donc ne divergent jamais.

#### Notes
- **Aucun prix codé en dur** : le fallback `PRIX_PAR_CONTENANT` (jadis dans
  `ANALYSE_PRIX.md`, supprimé en Phase 1) n'existe plus ; le PDF ne source que des
  prix Shopify.
- **Égalité au centime près** garantie par construction : panier de l'app et checkout
  consomment le même panier Shopify, et le montant remisé affiché EST le montant
  calculé par Shopify (pas de recalcul `× 0,85` en JS susceptible de dériver à
  l'arrondi).

### Phase 1 — Rebranding (Colibri Assurances → Colibri Calculateur)

#### Modifié
- **Routes** : `/sinistre/*` → `/calculateur/*` ; `/api/sinistre/checkout` →
  `/api/calculateur/checkout` ; `/calculateur` redirige vers `/`.
- **Page d'accueil** : la page "Bienvenue" (Démarrer / Reprendre mon projet) devient
  `app/page.tsx` ; header (baseline "Votre calculateur de peinture" + téléphone) et
  footer mutualisés dans le layout racine ; metadata sans mention assurance.
- **Store** : `lib/store/sinistreStore.ts` → `projetStore.ts` ; type `Assure` →
  `Client` (champ `assureur` supprimé) ; clés localStorage `colibri-sinistre-*` →
  `colibri-projet-*` (les brouillons en cours sont perdus, assumé).
- `SINISTRE_STEPS` → `CALCULATEUR_STEPS`.
- **Identification** : champ/validation "Assureur" et message de remise assureur
  supprimés ; titre "Vos coordonnées".
- **Tags Shopify** : clients créés avec le tag `calculateur` (au lieu de `covea`) ;
  draft orders tagués `projet-sauvegarde, calculateur`.
- **Textes du tunnel** : toutes les formulations sinistre/assureur reformulées grand
  public (pièce, panier, confirmation, PDF).
- **Docs** : README purgé des mentions assurance ; `ARCHITECTURE.md`,
  `DOCS_FINITIONS.md`, `docs/MULTI_MURS_FEATURE.md` reformulés ;
  `package.json` renommé `colibri-calculateur`.

#### Supprimé
- Ancienne landing marketing assurance (`app/page.tsx` + `landing.css` +
  `public/images-reassurance/`) — la landing publique est gérée hors app.
- Bannière "Votre assureur X vous a fait économiser…" du panier (la mention de la
  remise réelle revient en Phase 2).
- Docs obsolètes du contexte assurance : `ANALYSE_PRIX.md`, `BACKLOG.md`,
  `ROLLBACK.md`, `docs/TODO_CLIENT_FEEDBACK.md`, ADR 003 (produits offerts Covea)
  — conservées dans la branche `archive/assurances`.

#### Connu / à suivre
- 7 images CDN Shopify du choix de pièce gardent leur nom historique
  `ColibriAssurances_P0x_*.png` (renommage côté boutique à planifier).

### Ajouté
- **Phase 0 — Préparation du chantier "Colibri Calculateur"** (voir `PLAN.md`) :
  - Branche d'archive `archive/assurances` créée depuis `main` (état final du tunnel
    assurances, tag `v1.7.5-assurances` associé).
  - Configuration ESLint minimale (`.eslintrc.json`, `next/core-web-vitals`) pour
    rendre `pnpm lint` opérationnel.

### Corrigé
- **CI GitHub Actions** : le workflow utilisait `npm ci` avec un `package-lock.json`
  obsolète (échec systématique depuis l'ajout de `@vercel/analytics` et
  `react-hot-toast`). Passage à pnpm (standard du projet), suppression du
  `package-lock.json` périmé, build CI alimenté par les placeholders de
  `.env.local.example`.

### Modifié
- **`.env.local.example`** : `COVEA_DISCOUNT_CODE` remplacé par `DISCOUNT_CODE`
  (code promo -15% du calculateur, lu côté serveur uniquement).
- Échappement des apostrophes JSX (`&apos;`) dans 5 pages pour satisfaire
  `react/no-unescaped-entities` (aucun changement de texte visible).

## [1.7.5] - 2026-02-01

### Modifié
- **Affichage mobile du panier (étape 6)** : Optimisation du layout pour les petits écrans en empilant verticalement la quantité et le bouton de suppression.
  - **Mobile (<640px)** : Quantité et bouton corbeille affichés verticalement sous le prix pour éviter le débordement horizontal.
  - **Desktop (≥640px)** : Layout horizontal conservé (image | info | prix | quantité | corbeille).
  - Aucune troncature de texte : noms de produits complets et lisibles.
  - Aucune réduction d'image : images conservent leur taille (16×16 pixels).
  - Meilleure utilisation de l'espace vertical sur mobile.

### Interface (UI)
**Avant (mobile)** :
```
[Img] Titre du produit              Prix  ×1  🗑️
      Sous-titre                     (déborde →)
```
❌ Débordement horizontal sur petits écrans, éléments coupés

**Après (mobile)** :
```
[Img] Titre du produit              Prix
      Sous-titre                     ×1
                                     🗑️
```
✅ Tout rentre dans l'écran, lisibilité parfaite

**Desktop (inchangé)** :
```
[Img] Titre du produit              ×1    Prix    🗑️
      Sous-titre
```
✅ Layout horizontal conservé

### Technique
- Modification de `/app/sinistre/panier/page.tsx` :
  - Container principal (ligne 479) : Ajout de `flex-wrap` et `items-start` pour permettre le retour à la ligne sur mobile.
  - Bloc Prix + Quantité + Corbeille (lignes 520-549) : Restructuration responsive avec `flex-col sm:flex-row`.
- Classes Tailwind responsive :
  - `flex-wrap` : Permet le retour à la ligne sur mobile.
  - `flex-col sm:flex-row` : Empilage vertical sur mobile, horizontal sur desktop.
  - `items-start` : Alignement en haut pour meilleur rendu visuel.
  - `self-center` : Centrage du bouton de suppression.
- Aucun impact sur la logique métier.
- Modification isolée et à faible risque.

## [1.7.4] - 2026-02-01

### Modifié
- **Affichage du panier (étape 6)** : Masquage du sous-titre "Default Title" pour les produits sans variant nommé.
  - "Default Title" apparaît dans Shopify pour les produits ayant un seul variant sans options (Taille, Couleur, etc.).
  - Ce sous-titre est maintenant masqué pour améliorer la lisibilité du panier.
  - Les variants avec des titres significatifs (ex: "Taille 0", "12L Brillant") continuent d'être affichés normalement.

### Interface (UI)
- **Avant** : Tous les produits affichaient leur titre de variant, même "Default Title" (inutile et confusant).
- **Après** : Seuls les variants avec des titres significatifs sont affichés.

### Exemple
**Produit sans variant** :
- Avant : "Ouvre pot" + "Default Title" ❌
- Après : "Ouvre pot" (pas de sous-titre) ✅

**Produit avec variant** :
- Avant : "Pinceau à réchampir - taille 0" + "Taille 0" ✅
- Après : "Pinceau à réchampir - taille 0" + "Taille 0" ✅ (inchangé)

### Technique
- Modification de `/app/sinistre/panier/page.tsx` (lignes 506-510).
- Ajout d'une condition d'affichage : `{node.merchandise.title !== 'Default Title' && (...)}`
- Aucun impact sur la logique métier ou les attributes du panier.
- Modification isolée et à faible risque.

## [1.7.3] - 2026-02-01

### Supprimé
- **Toast de notification de changement de kit** : Suppression du toast vert "Votre surface a changé. Le kit X a été remplacé par Y".
  - Le toast était confusant et sans valeur pour l'utilisateur.
  - Le kit change toujours automatiquement selon la surface, mais sans notification.
  - Le panier est toujours recréé automatiquement si nécessaire.

### Ajouté
- **Guided Tour dans le BACKLOG** : Ajout de l'implémentation d'un guided tour (onboarding) pour les nouveaux utilisateurs dans le backlog pour une version future.
  - Tour guidé étape par étape avec `react-joyride`.
  - 7 steps expliquant le workflow complet.
  - Affichage uniquement à la première visite (localStorage).
  - Estimation : 4-6 heures (Sprint 3).

### Technique
- Suppression du bloc `toast.success()` dans `/app/sinistre/options/page.tsx` (lignes 117-131).
- Ajout de l'entrée #11 dans `/BACKLOG.md` (section UX et Interface).
- Conservation de la logique de détection de changement de kit et de recréation du panier.
- BACKLOG mis à jour en version 1.2 (17 améliorations, 54-71 heures).

## [1.7.2] - 2026-01-31

### Modifié
- **Kit matériel coché par défaut à l'étape 5 (Options)** : Le kit matériel est maintenant coché et visible par défaut dès le premier chargement.
  - Checkbox "Souhaitez-vous inclure le kit matériel ?" cochée automatiquement.
  - Liste complète des 6 composants affichée immédiatement (images, noms, boutons de suppression).
  - Cohérence parfaite avec l'étape 6 (Panier) où le kit est ajouté automatiquement.
  - Initialisation automatique des composants du kit dans `composantsKit` state.
  - Sauvegarde immédiate des options par défaut dans localStorage.

### Corrigé
- **Incohérence étape 5 ↔ étape 6** : Avant, le kit était décoché à l'étape 5 mais ajouté au panier à l'étape 6, ce qui surprenait l'utilisateur.

### Technique
- Modification de `/app/sinistre/options/page.tsx` :
  - `useState(true)` pour `optionKit` (ligne 39).
  - Default `true` si options sauvegardées non définies (ligne 143).
  - Initialisation automatique avec tous les composants du kit au premier chargement (lignes 159-165).
  - Fonction `saveOptions()` appelée immédiatement pour persister l'état par défaut.

## [1.7.1] - 2026-01-31

### Supprimé
- **Tuile "Boiseries" dans le récapitulatif** : Suppression de la section "Boiseries" de la page récapitulatif (étape 4).
  - Les boiseries continuent d'être gérées techniquement et apparaissent dans le panier.
  - Simplification de l'interface utilisateur pour éviter la surcharge visuelle.
  - Cohérence avec la suppression de la tuile "Sous-couche" (déjà effectuée en v1.6.0).

### Technique
- Suppression du bloc conditionnel `{totalBoiseries > 0 && ...}` dans `/app/sinistre/recapitulatif/page.tsx`.
- Conservation de la logique de calcul des boiseries dans `lib/calcul/index.ts`.
- Les boiseries restent affichées dans le panier et le PDF final.

## [1.7.0] - 2026-01-31

### Ajouté
- **Checkout direct Shopify** : Possibilité de commander immédiatement via le checkout Shopify avec pré-remplissage automatique des coordonnées client.
  - Bouton "Valider le panier" avec expédition sous 1 jour ouvré.
  - Pré-remplissage du checkout avec email, téléphone, nom, prénom et adresse complète.
  - Utilisation de `cartBuyerIdentityUpdate` avec `deliveryAddressPreferences` selon les best practices Shopify.
- **Draft Orders** : Possibilité de recevoir une estimation par e-mail pour commander plus tard.
  - Bouton "Recevoir mon estimation par e-mail" avec envoi automatique d'un lien de paiement.
  - Création automatique d'un Draft Order dans Shopify avec toutes les informations client.
  - Envoi d'un email invoice via l'API Shopify avec lien de paiement sécurisé.
- **API Admin Shopify** : Intégration de l'API Admin Shopify avec authentification OAuth Client Credentials Grant.
  - Génération automatique de tokens d'accès frais (valides 24h).
  - Gestion des customers (création, recherche par email).
  - Gestion des draft orders (création, envoi d'invoices).
- **Normalisation des téléphones** : Normalisation automatique des numéros de téléphone français au format E.164 pour Shopify.
  - Support des formats : `0612345678`, `06 12 34 56 78`, `+33612345678`, `33612345678`.
  - Validation avec regex et nettoyage automatique.

### Modifié
- **Panier** : Refonte complète des boutons d'action avec nouvelle mise en forme.
  - Bouton 1 : "Valider le panier" (fond vert, texte blanc) avec "⚡ Expédition 1 jour ouvré après commande".
  - Bouton 2 : "Recevoir mon estimation par e-mail" (fond blanc, bordure) avec "⏳ Je peux commander plus tard".
  - Suppression complète de la notion de téléchargement PDF.
- **Calcul du total** : Le total du panier est maintenant calculé manuellement (somme des produits) au lieu d'utiliser `cart.cost.totalAmount`.
  - Les frais de port ne sont plus inclus dans le total affiché au panier.
  - Les frais de port seront calculés uniquement au checkout Shopify.
- **Draft Orders** : Retrait de la réduction `appliedDiscount` car les prix sont déjà réduits de 15% dans les line items.
  - La ligne "Réduction sur la commande" n'apparaît plus dans l'email invoice.

### Technique
- Création de `/lib/shopify-admin.ts` : Client pour l'API Admin Shopify avec OAuth.
- Création de `/lib/shopify-customers.ts` : Gestion des customers Shopify.
- Création de `/lib/shopify-draft-orders.ts` : Gestion des draft orders et invoices.
- Création de `/lib/utils/phone.ts` : Normalisation des téléphones au format E.164.
- Création de `/app/api/sinistre/checkout/route.ts` : Route API pour gérer le checkout (2 modes : direct + draft order).
- Modification de `/lib/shopify-cart.ts` : Ajout de `updateCartBuyerIdentity()` pour pré-remplir le checkout.
- Modification de `/app/sinistre/panier/page.tsx` : Intégration des nouveaux boutons et appel à `updateCartBuyerIdentity()` avant redirection.
- Refactor de `/app/api/shopify/customer/route.ts` : Séparation client/serveur avec utilisation de `lib/shopify-customers.ts`.

### Sécurité
- ✅ Aucun secret hardcodé dans le code.
- ✅ Tous les secrets stockés dans les variables d'environnement.
- ✅ Tokens OAuth générés à la demande (valides 24h).
- ✅ Validation des données utilisateur avant envoi à Shopify.
- ✅ Gestion des erreurs avec messages génériques pour l'utilisateur.

## [1.6.0] - 2026-01-28

### Ajouté
- **Gestion des kits personnalisables** : Les kits matériel sont maintenant composés de **composants individuels** au lieu d'un bundle unique, permettant à l'utilisateur de personnaliser sa sélection.
  - Détection automatique du type de kit (petite surface ≤ 30 m² / grande surface > 30 m²).
  - Notification toast élégante lors du changement automatique de kit.
  - Badge "✓ Kit complet" affiché dans le panier si tous les composants sont présents.
  - Sous-total matériel avec prix barrés dans le panier.
  - Configuration centralisée dans `/lib/kits-config.ts`.
- **Synchronisation bidirectionnelle Étape 5 ↔ Étape 6** : Les suppressions de composants/produits dans le panier sont maintenant répercutées dans l'étape Options, et vice-versa.
  - Décochage automatique des options si tous les produits sont supprimés.
  - Source de vérité unique via `localStorage` (`colibri-sinistre-options`).
- **React Hot Toast** : Intégration de la bibliothèque `react-hot-toast` pour des notifications utilisateur professionnelles et élégantes.
- **Images Shopify** : Affichage des images des produits (composants kit et produits rénovation) dans l'étape 5 (Options).

### Modifié
- **Harmonisation de l'étape 5 (Options)** : Refonte complète de l'interface pour une cohérence visuelle et fonctionnelle.
  - Suppression de la tuile "Sous-couche" (obligatoire, affichée uniquement dans le panier).
  - Structure identique pour les tuiles "Kit matériel" et "Préparation des surfaces" (question + phrase explicative + checkbox).
  - Affichage type panier avec vignettes produits (images Shopify).
  - Possibilité de supprimer des composants/produits individuellement avec bouton `[×]`.
  - Boutons "Réinitialiser" (outline) pour restaurer les listes complètes.
  - Suppression de la tuile "Coût matériel estimé" en bas de page.
- **API Shopify** : Modification de `/api/shopify/products/variants/route.ts` pour inclure `id`, `handle`, `title` et `featuredImage` dans la réponse JSON.
- **Attributs de panier** : Les produits de rénovation stockent maintenant le `handle` (au lieu du titre) dans l'attribut `produit` pour faciliter l'identification.

### Technique
- Création de `/lib/kits-config.ts` avec configuration des kits (petite/grande surface) et fonction `determinerKit()`.
- Fonction `findVariantByFilter()` générique dans `cart-mapper.ts` pour filtrer les variants Shopify par `selectedOptions`.
- Fonction `mapKitToCartLines()` pour ajouter les composants individuels avec attributs (`type`, `kit_type`, `composant`, `composant_nom`).
- Fonction `mapRenovationToCartLines()` pour filtrer les produits de rénovation selon la sélection utilisateur.
- Modification de `handleRemoveLine()` dans `panier/page.tsx` pour synchroniser avec `localStorage` (`colibri-sinistre-options`).

## [1.5.0] - 2026-01-28

### Ajouté
- **Assureurs** : Ajout de **ALLIANZ** à la liste des assureurs partenaires dans le formulaire d'identification.
- **Interface (UI)** : Affichage du coût global au m² dans le récapitulatif du panier, calculé selon la formule Colibri (Peintures + Sous-couches / Surface × 3).
- **Interface (UI)** : Affichage des prix barrés (original vs remisé) pour chaque article, pour le total et pour le coût au m².
- **Interface (UI)** : Réorganisation complète du panier en **4 sections** (Peintures, Sous-couches, Kit, Préparation) avec compteurs de produits pour une meilleure clarté.
- **Interface (UI)** : Ajout d'une **bannière d'économies assureur** valorisant le montant total économisé grâce au partenariat.

### Modifié
- **Logique métier** : Mise à jour de la règle de détermination des sous-couches basée sur le champ meta `base` :
  - `blanc`, `BLC`, `B` → Sous-couche blanche.
  - `C` → Sous-couche grise.
- **Expérience (UX)** : La sélection de la sous-couche à l'étape 5 est désormais obligatoire et non désélectionnable.
- **Documentation** : Mise à jour complète du `README.md` et de `ARCHITECTURE.md` pour refléter les dernières règles métier et fonctionnalités.
- **Interface (UI)** : Simplification de l'étape 5 (Options) par la suppression de l'accordéon "Peintures de finition" et de la tuile "Résumé projet" pour une expérience plus fluide.

### Technique
- Optimisation de l'algorithme de calcul pour intégrer les nouvelles règles de sous-couche.
- Amélioration de l'affichage des prix dans le panier pour gérer les remises de 15% de manière plus transparente.

## [1.4.0] - 2026-01-22

### Ajouté
- **Identité Visuelle Premium** : Application complète de la charte graphique de la nouvelle landing page à l'ensemble du tunnel d'assurance.
- **Typographie** : Intégration de **Playfair Display** (Serif) pour les titres et **Inter** (Sans-serif) pour le corps de texte via Google Fonts.
- **Palette de Couleurs** : Adoption du **Vert Foncé Premium (`#1e3a34`)** et du fond **Blanc Cassé (`#f9fbfb`)**.

### Modifié
- **Interface (UI)** : Refonte des composants `Card`, `Button` et `StepIndicator` pour un aspect plus haut de gamme et épuré.
- **Header & Footer** : Mise en place d'un header "sticky" avec effet de flou (`backdrop-blur`) et d'un footer institutionnel avec logo en filigrane.
- **Accueil** : Transformation de la Hero section avec une typographie Serif imposante et un branding plus sobre ("Assurances").
- **Expérience (UX)** : Harmonisation des info-boxes et des états de sélection avec la nouvelle palette de couleurs.

### Technique
- Mise à jour de `tailwind.config.ts` avec les nouvelles variables de thème.
- Injection des polices Google Fonts dans `app/layout.tsx` avec support des variables CSS.
- Optimisation des transitions et des ombres portées sur l'ensemble des composants UI.

## [1.3.1] - 2026-01-21

### Corrigé
- **Intégration Shopify** : Simplification de l'API route `/api/shopify/products/variants` pour utiliser `lib/shopify.ts` (GraphQL Storefront API) au lieu de `execSync` avec le MCP CLI.
- **Performance** : Amélioration de la rapidité et de la fiabilité des appels API Shopify.
- **Cache** : Intégration du cache Next.js (1 heure) pour réduire la latence et les appels API.

### Technique
- Remplacement de `execSync` par `getProduct()` de `lib/shopify.ts` dans l'API route.
- Suppression du parsing de texte + JSON pour un mapping TypeScript propre.
- Meilleure gestion d'erreur avec retour 404 si produit introuvable.

## [1.2.0] - 2026-01-21

### Ajouté
- **Identité Visuelle** : Intégration du logo officiel Colibri sur l'ensemble de l'application.
- **Expérience Utilisateur (UX)** : Refonte de l'étape de sélection des pièces avec des visuels professionnels (images Shopify) à la place des émojis.
- **Parcours Client** : Introduction de deux sorties claires dans le panier : "Commander sous 72h" (Urgence) ou "Sauvegarder l'estimation PDF" (Attente d'indemnisation).
- **Interface (UI)** : Ajout d'effets de survol (zoom, checkmark) sur les cartes de sélection des pièces.
- **Optimisation** : Transformation de la section Peintures en accordéon rétractable dans l'étape Options pour alléger la lecture.

### Modifié
- **Branding** : Remplacement de la mention "Partenaire Covea" par "**Partenaire de votre assureur**" pour une meilleure neutralité.
- **Header** : Épure du header avec suppression du texte "Colibri" pour mettre en avant le logo et la mention partenaire.
- **Accueil** : Simplification du titre en "Assurances" pour éviter les répétitions avec le logo.
- **Nettoyage** : Suppression des liens externes vers la boutique dans l'écran de confirmation pour maximiser la rétention.

### Technique
- Optimisation du chargement des images avec `loading="eager"` et `referrerPolicy="no-referrer"`.
- Mise en place d'un système de fallback visuel pour les images de pièces en cas d'erreur réseau.
- Amélioration de la hiérarchie visuelle des CTA (Call to Action) avec distinction primaire/secondaire.

## [1.1.0] - 2026-01-21

### Ajouté
- **Fonctionnalité multi-murs** : possibilité d'ajouter jusqu'à 4 murs avec des couleurs distinctes par pièce.
- **Migration automatique** des données localStorage de l'ancien format vers le nouveau format.
- **Affichage détaillé** de chaque mur dans le récapitulatif et le PDF.
- **Agrégation automatique** des surfaces par couleur dans l'algorithme de calcul.

### Modifié
- Interface `Piece` : remplacement de `surfaceMurs` et `couleurMurs` par un tableau `murs: Mur[]`.
- Page de saisie des surfaces (`app/sinistre/surfaces/page.tsx`) : refonte complète pour gérer les murs multiples.
- Algorithme de calcul (`lib/calcul/index.ts`) : adaptation pour agréger les surfaces par couleur.
- Page récapitulatif : affichage de tous les murs individuellement avec leur numéro, surface et couleur.
- Génération PDF : affichage de tous les murs de chaque pièce.

### Technique
- Ajout de l'interface `Mur` dans `lib/types.ts`.
- Fonction de migration `migratePieceToNewFormat` dans `lib/store/sinistreStore.ts`.
- Héritage automatique de la couleur du mur précédent lors de l'ajout d'un nouveau mur.
- Validation individuelle pour chaque mur (surface + couleur).

## [1.0.0] - 2026-01-21

### Ajouté
- MVP complet de l'application de déclaration de sinistre Colibri x Covea.
- Formulaire d'identification de l'assuré en 7 étapes.
- Sélection des pièces à peindre avec types prédéfinis.
- Saisie des surfaces (murs, plafond, boiseries) avec sélection de couleurs.
- Intégration Shopify API pour récupérer les produits et variants en temps réel.
- Algorithme de calcul v2.0 avec formule optimisée.
- Optimisation dynamique des contenants (1L, 3L, 12L).
- Sélection automatique des sous-couches.
- Kits matériels et produits de rénovation.
- Génération de PDF récapitulatif.
- Persistance des données dans localStorage.
