# Fonctionnalité Multi-Murs

## Vue d'ensemble

La fonctionnalité multi-murs permet aux utilisateurs d'ajouter jusqu'à **4 murs distincts** avec des surfaces et couleurs individuelles pour chaque pièce. Cette fonctionnalité améliore considérablement la précision des estimations de peinture en permettant de gérer des configurations complexes où différents murs d'une même pièce peuvent avoir des couleurs différentes.

## Motivation

Dans la version précédente, chaque pièce ne pouvait avoir qu'une seule surface de murs avec une seule couleur. Cette limitation ne reflétait pas la réalité des projets de rénovation où il est fréquent de peindre différents murs d'une même pièce avec des couleurs distinctes (mur d'accent, séparation visuelle, etc.).

## Architecture

### Modèle de données

#### Nouvelle interface `Mur`

```typescript
export interface Mur {
  id: string;
  surface: number;
  couleur: Couleur;
}
```

#### Interface `Piece` mise à jour

**Avant :**
```typescript
export interface Piece {
  id: string;
  typePiece: TypePiece;
  nom: string;
  surfaceMurs: number;           // ❌ Une seule surface
  couleurMurs: Couleur;           // ❌ Une seule couleur
  surfacePlafond?: number;
  surfaceBoiseries?: number;
  couleurPlafond?: Couleur;
  couleurBoiseries?: Couleur;
}
```

**Après :**
```typescript
export interface Piece {
  id: string;
  typePiece: TypePiece;
  nom: string;
  murs: Mur[];                    // ✅ Tableau de murs
  surfacePlafond?: number;
  surfaceBoiseries?: number;
  couleurPlafond?: Couleur;
  couleurBoiseries?: Couleur;
}
```

### Interface utilisateur

La page de saisie des surfaces (`app/sinistre/surfaces/page.tsx`) a été complètement refactorisée pour supporter la gestion dynamique des murs.

#### Fonctionnalités UI

**Ajout de murs :**
- Bouton "Ajouter un mur" visible tant que le nombre de murs est inférieur à 4
- Héritage automatique de la couleur du mur précédent pour faciliter la saisie
- Chaque nouveau mur reçoit un ID unique basé sur `Date.now()`

**Suppression de murs :**
- Le premier mur est obligatoire et ne peut pas être supprimé
- Les murs 2, 3 et 4 peuvent être supprimés via une icône 🗑️
- La suppression d'un mur met à jour automatiquement la numérotation affichée

**Validation :**
- Chaque mur doit avoir une surface valide (> 0)
- Chaque mur doit avoir une couleur sélectionnée
- Les erreurs sont affichées individuellement pour chaque mur avec des clés uniques (`mur_${mur.id}_surface`, `mur_${mur.id}_couleur`)

**Design :**
- Chaque mur est affiché dans une carte distincte avec fond blanc
- Titre "Mur 1", "Mur 2", etc. pour une identification claire
- Interface compacte avec espacement cohérent
- Responsive design pour mobile et desktop

### Algorithme de calcul

L'algorithme de calcul (`lib/calcul/index.ts`) a été adapté pour agréger automatiquement les surfaces par couleur avant l'optimisation des contenants.

#### Fonction `agregerSurfacesParCouleur`

**Avant :**
```typescript
function agregerSurfacesParCouleur(pieces: Piece[]): SurfaceParCouleur[] {
  const map = new Map<string, SurfaceParCouleur>();
  
  for (const piece of pieces) {
    // Traiter surfaceMurs comme une seule surface
    if (piece.surfaceMurs && piece.couleurMurs) {
      const key = piece.couleurMurs.productHandle;
      // ...
    }
  }
  
  return Array.from(map.values());
}
```

**Après :**
```typescript
function agregerSurfacesParCouleur(pieces: Piece[]): SurfaceParCouleur[] {
  const map = new Map<string, SurfaceParCouleur>();

  for (const piece of pieces) {
    // Traiter chaque mur individuellement
    piece.murs.forEach((mur, index) => {
      const key = mur.couleur.productHandle;
      if (!map.has(key)) {
        map.set(key, { couleur: mur.couleur, surfaceTotale: 0, details: [] });
      }
      const entry = map.get(key)!;
      entry.surfaceTotale += mur.surface;
      entry.details.push({ 
        pieceNom: piece.nom, 
        type: 'murs', 
        surface: mur.surface 
      });
    });
    
    // Traiter plafond et boiseries (inchangé)
    // ...
  }

  return Array.from(map.values());
}
```

#### Exemple d'agrégation

**Scénario :** Une pièce avec 4 murs de couleurs différentes

```
Salon :
  - Mur 1 : 15m² - Bleu Nuit
  - Mur 2 : 20m² - Bleu Nuit
  - Mur 3 : 10m² - Blanc Cassé
  - Mur 4 : 12m² - Blanc Cassé
```

**Résultat de l'agrégation :**
```
Bleu Nuit : 35m² (15 + 20)
Blanc Cassé : 22m² (10 + 12)
```

**Optimisation des contenants :**
- Bleu Nuit (35m²) : 2 couches → 74L nécessaires → 6×12L + 1×3L (75L commandés)
- Blanc Cassé (22m²) : 2 couches → 47L nécessaires → 3×12L + 3×3L + 1×1L (46L commandés)

### Migration automatique des données

Pour assurer une transition transparente, une fonction de migration automatique a été implémentée dans le store (`lib/store/sinistreStore.ts`).

#### Fonctionnement

**Détection :** La fonction `getStoredPieces()` détecte automatiquement si les données sont dans l'ancien format en vérifiant la présence de `surfaceMurs` et l'absence de `murs`.

**Conversion :** L'ancien format est converti vers le nouveau format en créant un tableau `murs` avec un seul élément contenant la surface et la couleur d'origine.

**Sauvegarde :** Les données migrées sont automatiquement sauvegardées dans localStorage pour éviter de refaire la migration à chaque chargement.

```typescript
function migratePieceToNewFormat(oldPiece: OldPiece): Piece {
  // Si déjà au nouveau format, retourner tel quel
  if (oldPiece.murs && Array.isArray(oldPiece.murs)) {
    return oldPiece as Piece;
  }

  // Convertir l'ancien format
  const murs = [];
  if (oldPiece.surfaceMurs && oldPiece.couleurMurs) {
    murs.push({
      id: '1',
      surface: oldPiece.surfaceMurs,
      couleur: oldPiece.couleurMurs,
    });
  }

  return {
    id: oldPiece.id,
    typePiece: oldPiece.typePiece as any,
    nom: oldPiece.nom,
    murs,
    surfacePlafond: oldPiece.surfacePlafond,
    surfaceBoiseries: oldPiece.surfaceBoiseries,
    couleurPlafond: oldPiece.couleurPlafond,
    couleurBoiseries: oldPiece.couleurBoiseries,
  };
}
```

### Affichage dans le récapitulatif

La page récapitulatif (`app/sinistre/recapitulatif/page.tsx`) affiche maintenant tous les murs individuellement avec leur numéro, surface et couleur.

**Avant :**
```
Murs : 45m²
Bleu Nuit
```

**Après :**
```
Mur 1 : 15m²
Bleu Nuit

Mur 2 : 20m²
Bleu Nuit

Mur 3 : 10m²
Blanc Cassé

Mur 4 : 12m²
Blanc Cassé
```

### Génération PDF

Le PDF généré (`app/api/generate-pdf/route.ts`) affiche également tous les murs individuellement pour une traçabilité complète.

## Fichiers modifiés

### Fichiers principaux

| Fichier | Type de modification | Description |
|---------|---------------------|-------------|
| `lib/types.ts` | Ajout + Modification | Ajout interface `Mur`, modification interface `Piece` |
| `app/sinistre/surfaces/page.tsx` | Refonte complète | Nouvelle UI pour gérer les murs multiples |
| `lib/calcul/index.ts` | Modification | Adaptation de l'agrégation et des calculs |
| `app/sinistre/recapitulatif/page.tsx` | Modification | Affichage de tous les murs |
| `app/api/generate-pdf/route.ts` | Modification | PDF avec tous les murs |
| `lib/store/sinistreStore.ts` | Ajout | Migration automatique des données |

### Commits

**Commit 1 :** `feat: Implémentation de la fonctionnalité multi-murs (jusqu'à 4 murs avec couleurs distinctes)`
- SHA: `09117e9`
- Fichiers : `lib/types.ts`, `app/sinistre/surfaces/page.tsx`, `lib/calcul/index.ts`

**Commit 2 :** `fix: Correction du PDF et ajout de la migration automatique des données`
- SHA: `d5de7cd`
- Fichiers : `app/api/generate-pdf/route.ts`, `lib/store/sinistreStore.ts`

**Commit 3 :** `fix: Correction de la page récapitulatif pour le nouveau modèle multi-murs`
- SHA: `d4403e3`
- Fichiers : `app/sinistre/recapitulatif/page.tsx`

## Tests et validation

### Tests manuels effectués

**Scénario 1 : Ajout de plusieurs murs**
- ✅ Ajout de 4 murs avec des couleurs différentes
- ✅ Validation de la surface pour chaque mur
- ✅ Validation de la couleur pour chaque mur
- ✅ Héritage de la couleur du mur précédent

**Scénario 2 : Suppression de murs**
- ✅ Impossibilité de supprimer le mur 1
- ✅ Suppression des murs 2, 3, 4
- ✅ Mise à jour de la numérotation après suppression

**Scénario 3 : Migration des données**
- ✅ Chargement d'anciennes données avec `surfaceMurs`
- ✅ Conversion automatique vers le nouveau format
- ✅ Sauvegarde des données migrées

**Scénario 4 : Agrégation des surfaces**
- ✅ Agrégation correcte des murs avec la même couleur
- ✅ Calcul correct des contenants optimisés
- ✅ Affichage correct dans le récapitulatif et le PDF

**Scénario 5 : Build et déploiement**
- ✅ Build TypeScript réussi sans erreurs
- ✅ Déploiement Vercel réussi sur la branche develop
- ✅ Application fonctionnelle en production

## Améliorations futures possibles

**Drag & drop :** Permettre de réorganiser l'ordre des murs par glisser-déposer.

**Duplication de murs :** Ajouter un bouton pour dupliquer un mur existant avec ses propriétés.

**Calcul automatique de surface :** Intégrer un calculateur de surface basé sur les dimensions (longueur × hauteur).

**Visualisation 3D :** Afficher une représentation visuelle de la pièce avec les murs colorés.

**Export des données :** Permettre l'export des données en JSON ou CSV pour analyse.

## Support et maintenance

Pour toute question ou problème lié à cette fonctionnalité, veuillez consulter :
- Le code source dans le repository GitHub
- Les commits associés pour l'historique des modifications
- La documentation technique dans `/docs`

---

**Date de mise en œuvre :** 21 janvier 2025  
**Version :** 1.1.0 (non publiée)  
**Auteur :** Équipe de développement Colibri x Covea
