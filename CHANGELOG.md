# Changelog

Toutes les modifications notables de ce projet seront documentées dans ce fichier.

Le format est basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/),
et ce projet adhère au [Semantic Versioning](https://semver.org/lang/fr/).

## [Non publié]

### Ajouté
- Fonctionnalité multi-murs : possibilité d'ajouter jusqu'à 4 murs avec des couleurs distinctes par pièce
- Migration automatique des données localStorage de l'ancien format vers le nouveau format
- Affichage détaillé de chaque mur dans le récapitulatif et le PDF
- Agrégation automatique des surfaces par couleur dans l'algorithme de calcul

### Modifié
- Interface `Piece` : remplacement de `surfaceMurs` et `couleurMurs` par un tableau `murs: Mur[]`
- Page de saisie des surfaces (`app/sinistre/surfaces/page.tsx`) : refonte complète pour gérer les murs multiples
- Algorithme de calcul (`lib/calcul/index.ts`) : adaptation pour agréger les surfaces par couleur
- Page récapitulatif : affichage de tous les murs individuellement avec leur numéro, surface et couleur
- Génération PDF : affichage de tous les murs de chaque pièce

### Technique
- Ajout de l'interface `Mur` dans `lib/types.ts`
- Fonction de migration `migratePieceToNewFormat` dans `lib/store/sinistreStore.ts`
- Héritage automatique de la couleur du mur précédent lors de l'ajout d'un nouveau mur
- Validation individuelle pour chaque mur (surface + couleur)

## [1.0.0] - 2025-01-21

### Ajouté
- MVP complet de l'application de déclaration de sinistre Colibri x Covea
- Formulaire d'identification de l'assuré en 7 étapes
- Sélection des pièces à peindre avec types prédéfinis
- Saisie des surfaces (murs, plafond, boiseries) avec sélection de couleurs
- Intégration Shopify API pour récupérer les produits et variants en temps réel
- Algorithme de calcul v2.0 avec formule : (Surface × 2 / 10) + 5% pour peinture, (Surface × 1 / 10) + 5% pour sous-couche
- Optimisation dynamique des contenants (1L, 3L, 12L) basée sur les variants Shopify disponibles
- Sélection automatique des sous-couches (blanche pour base B/BLC, grise pour base C)
- Kits matériels : Petit (≤30m²) à 29,90€, Grand (>30m²) à 40,90€
- Produits de rénovation : pâte à rénover, couteau de peintre, papier à poncer, cale à poncer
- Génération de PDF récapitulatif avec toutes les informations du sinistre
- Déploiement automatique sur Vercel (production et develop)
- Gestion multi-pièces avec possibilité d'ajouter, éditer et supprimer des pièces
- Persistance des données dans localStorage

### Technique
- Stack : Next.js 15 (App Router), TypeScript, Tailwind CSS
- Intégration Shopify Storefront API
- Architecture modulaire avec séparation des responsabilités
- Store localStorage pour la persistance des données
- Composants UI réutilisables (Button, Card, Input, Modal)
- Validation des formulaires avec gestion des erreurs
- Responsive design pour mobile et desktop
