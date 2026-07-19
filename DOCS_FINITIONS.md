# Documentation Technique : Gestion des Finitions Shopify

Ce document récapitule les modifications structurelles apportées le 22 janvier 2026 pour assurer une gestion rigoureuse des finitions (Mat, Velours, Satin) sur l'ensemble du parcours utilisateur.

## 1. Source de Vérité Unique
L'information de finition ne doit plus être extraite des metafields globaux (souvent absents) mais de l'**Option de Variante** nommée "Finition" sur Shopify.

- **API Collections** : La route `/api/shopify/collections/[handle]` inspecte désormais jusqu'à 20 variants par produit pour extraire un tableau `finitions` contenant toutes les options disponibles.
- **API Produit** : La route `/api/shopify/product/[handle]` renvoie la finition spécifique via `selectedOptions`.

## 2. Filtrage dans la Modale (`CouleurModal.tsx`)
Le filtrage est désormais **strict**. L'application compare la `targetFinition` (imposée par la pièce) avec le tableau `finitions` du produit.
- Si aucune correspondance n'est trouvée, le produit est masqué.
- Cela garantit que l'utilisateur ne peut choisir qu'une couleur réellement disponible dans la finition technique requise.

## 3. Algorithme de Calcul (`lib/calcul/index.ts`)
L'agrégation des surfaces a été modifiée pour éviter la fusion incorrecte de teintes identiques ayant des finitions différentes.
- **Ancienne logique** : Regroupement par `productHandle`.
- **Nouvelle logique** : Regroupement par `productHandle + finition`.
- **Résultat** : "Tanin Velours" et "Tanin Satin" apparaissent désormais comme deux lignes distinctes dans le panier avec leurs propres litrages.

## 4. Persistance des Données
La propriété `finition` est maintenant une partie intégrante de l'interface `Couleur` (voir `lib/types.ts`). Elle est extraite dynamiquement lors de la sélection et persiste dans le `localStorage` via le `projetStore`.

## Points de Vigilance pour DUST
- **Casse et Normalisation** : Toujours utiliser `.toLowerCase()` lors des comparaisons de finitions pour éviter les bugs entre "Mat" et "mat".
- **Fallback** : Les fallbacks basés sur le titre ont été supprimés au profit de la donnée réelle des variants. Ne pas les réintroduire sans validation.
