# Système de Calcul de Peinture Colibri - Version 2.0.0

**Auteur** : Owl Agency  
**Projet** : Colibri Assurances  
**Date** : 21 janvier 2026

---

## 📋 Table des matières

1. [Vue d'ensemble](#vue-densemble)
2. [Algorithme de calcul](#algorithme-de-calcul)
3. [Architecture](#architecture)
4. [Utilisation](#utilisation)
5. [Changelog](#changelog)

---

## 🎯 Vue d'ensemble

Le système de calcul de peinture Colibri permet de :

- ✅ **Calculer précisément** les quantités de peinture nécessaires
- ✅ **Optimiser** la répartition des contenants (12L, 3L, 1L)
- ✅ **Interroger dynamiquement** l'API Shopify pour les variants disponibles
- ✅ **Calculer les prix** par produit et total
- ✅ **Gérer** les sous-couches (blanche ou grise selon couleur Schmidt)

### Spécifications techniques

- **Rendement** : 10 m²/L/couche (norme Colibri)
- **Marge de sécurité** : 5% (pertes, retouches)
- **Arrondi** : Règle x,5 (< 0,5 → arrondir inf, >= 0,5 → arrondir sup)
- **Contenants** : 12L, 3L, 1L (interrogation dynamique Shopify)
- **Couches** : 1 pour sous-couche, 2 pour finition

---

## 🧮 Algorithme de calcul

### Étape 1 : Calcul brut

```
litresBruts = (surface en m² / rendement en m²/L/couche) × nombre de couches
```

**Exemple** : 55 m² avec 2 couches
```
litresBruts = (55 / 10) × 2 = 11 L
```

### Étape 2 : Marge de sécurité 5%

```
litresAvecMarge = litresBruts × (1 + 0,05)
```

**Exemple** :
```
litresAvecMarge = 11 × 1,05 = 11,55 L
```

### Étape 3 : Arrondi selon règle x,5

```
decimale = litresAvecMarge - floor(litresAvecMarge)

Si decimale < 0,5 :
  litresArrondis = floor(litresAvecMarge)
Sinon :
  litresArrondis = ceil(litresAvecMarge)
```

**Exemple** :
```
11,55 L → decimale = 0,55 >= 0,5 → arrondir à 12 L ✅
```

**Autres exemples** :
- 11,34 L → 0,34 < 0,5 → 11 L
- 11,50 L → 0,50 >= 0,5 → 12 L
- 11,70 L → 0,70 >= 0,5 → 12 L

### Étape 4 : Optimisation des contenants (algorithme glouton)

```
1. Remplir avec pots de 12L tant que possible
2. Remplir avec pots de 3L tant que possible
3. Compléter avec pots de 1L
```

**Exemple** : 12 L nécessaires
```
12 / 12 = 1 pot de 12L ✅
Reste 0L → terminé
Résultat : 1×12L
```

**Exemple** : 11 L nécessaires
```
11 / 12 = 0 pot de 12L
11 / 3 = 3 pots de 3L (9L)
Reste 2L → 2 pots de 1L
Résultat : 3×3L + 2×1L
```

---

## 🏗️ Architecture

### Structure des fichiers

```
lib/calcul/
├── index.ts          # Logique principale de calcul
├── types.ts          # Types et interfaces TypeScript
├── constants.ts      # Constantes (rendement, marge, etc.)
└── README.md         # Documentation (ce fichier)
```

---

## 💻 Utilisation

### Import

```typescript
import { calculerQuantitesPeinture } from '@/lib/calcul';
import type { Piece } from '@/lib/calcul/types';
```

### Exemple complet

```typescript
const pieces: Piece[] = [
  {
    type: 'chambre',
    nom: 'Chambre parentale',
    surfaces: [
      {
        type: 'plafond',
        surface: 20,
        productHandle: 'blanc-vrai-peinture-biosourcee-murs-et-plafonds',
        couleurTitre: 'Blanc vrai',
        gamme: 'Biosourcée',
        finition: 'Mat',
      },
    ],
  },
];

const resultat = await calculerQuantitesPeinture(pieces);

console.log('Prix total:', resultat.prixTotal, '€');
```

---

## 📝 Changelog

### Version 2.0.0 (21 janvier 2026)

**🔴 CORRECTIFS CRITIQUES**
- **Rendement corrigé** : 10 m²/L/COUCHE (au lieu de 10 m²/L pour 2 couches)
- **Arrondi corrigé** : Règle x,5 au lieu d'arrondi au dixième
- **Marge ajoutée** : 5% de sécurité appliquée avant arrondi

**🆕 NOUVELLES FONCTIONNALITÉS**
- Interrogation dynamique des variants Shopify
- Sélection automatique du variant (gamme + finition + contenance)
- Calcul des prix par variant et prix total
- Gestion de la disponibilité en stock

**📚 DOCUMENTATION**
- Documentation complète (ce fichier)
- Commentaires exhaustifs dans le code
- Types TypeScript complets

### Version 1.0.0 (15 janvier 2026)

- Version initiale avec contenants fixes
- ❌ Rendement incorrect (10 m² pour 2 couches)
- ❌ Pas de marge de sécurité
- ❌ Arrondi au dixième au lieu du litre entier

---

**© 2026 Owl Agency - Tous droits réservés**
