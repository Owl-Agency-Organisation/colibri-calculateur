# Changelog

Toutes les modifications notables de ce projet seront documentées dans ce fichier.

Le format est basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/),
et ce projet adhère au [Semantic Versioning](https://semver.org/lang/fr/).

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
