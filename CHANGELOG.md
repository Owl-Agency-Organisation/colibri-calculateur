# Changelog

Toutes les modifications notables de ce projet seront documentées dans ce fichier.

Le format est basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/),
et ce projet adhère au [Semantic Versioning](https://semver.org/lang/fr/).

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
