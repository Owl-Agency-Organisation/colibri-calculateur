# 🏗️ Architecture - Colibri Calculateur

## Vue d'ensemble

Application standalone Next.js 15 avec intégration native Shopify pour le calcul automatique de peinture (projets de rénovation).

---

## Stack technique

### Frontend

- **Framework** : Next.js 15 (App Router)
- **Language** : TypeScript 5.7
- **Styling** : Tailwind CSS 3.4
- **UI Components** : Custom components (Button, Input, Card, etc.)
- **State Management** : React hooks + LocalStorage (persistance)

### Backend

- **API Routes** : Next.js API Routes (serverless)
- **Shopify Integration** :
  - Storefront API (lecture produits/collections)
  - Admin API (création Draft Orders, clients)
- **Client Shopify** : `@shopify/storefront-api-client`

### Hosting

- **Platform** : Vercel
- **CDN** : Vercel Edge Network
- **SSL** : Automatique (Let's Encrypt)

---

## Architecture de données

### Entités principales

```typescript
// 1. CLIENT (Client Shopify)
interface Client {
  civilite: "M" | "Mme"
  nom: string
  prenom: string
  email: string        // OBLIGATOIRE
  telephone: string    // OBLIGATOIRE
  adresse: string
  codePostal: string
  ville: string

}

// 2. PIÈCE (multi-pièces possible)
interface Piece {
  id: string
  type: TypePiece     // "piece-de-vie", "chambre", etc.
  plafond: Surface | null
  murs: Surface[]     // Max 4 murs
}

// 3. SURFACE (plafond ou mur)
interface Surface {
  id: string
  type: "plafond" | "mur"
  superficie: number  // En m²
  couleur: Couleur
  finition: Finition  // "mat", "velours", "satin"
  gamme: Gamme        // "biosourcee", "biosourcee-depolluante"
}

// 4. COULEUR (produit Shopify)
interface Couleur {
  productId: string
  productHandle: string
  titre: string
  collection: string
  base: "Blanc" | "BLC" | "B" | "C"
  codeHex: string
  imageUrl: string
}
```

---

## Flux de données

```
┌─────────────────────────────────────────────┐
│  UTILISATEUR (Client particulier)                │
│  Interface web moderne et intuitive         │
└──────────────────┬──────────────────────────┘
                   │
                   ↓
┌─────────────────────────────────────────────┐
│  FRONTEND (Next.js Client Side)             │
│  - Formulaires React                        │
│  - Validation temps réel                    │
│  - LocalStorage (persistance)               │
│  - Appels API côté client                   │
└──────────────────┬──────────────────────────┘
                   │
                   ↓
┌─────────────────────────────────────────────┐
│  API ROUTES (Next.js Server Side)           │
│  - /api/shopify/collections                 │
│  - /api/shopify/products                    │
│  - /api/calcul/optimiser                    │
│  - /api/shopify/draft-order                 │
└──────────────────┬──────────────────────────┘
                   │
                   ↓
┌─────────────────────────────────────────────┐
│  SHOPIFY API                                │
│  - Storefront API (public)                  │
│  - Admin API (privé)                        │
└─────────────────────────────────────────────┘
```

---

## Algorithme de calcul

### Étape 1 : Cumul des surfaces identiques

```typescript
const surfacesParProduit = {}

pieces.forEach(piece => {
  // Créer clé unique : productId + finition + gamme
  const key = `${couleur.productId}-${finition}-${gamme}`
  
  if (!surfacesParProduit[key]) {
    surfacesParProduit[key] = {
      productId,
      finition,
      gamme,
      surfaceTotale: 0
    }
  }
  
  surfacesParProduit[key].surfaceTotale += superficie
})
```

### Étape 2 : Calcul litres

```typescript
const RENDEMENT_PEINTURE = 10 // m² par litre (2 couches)
const MARGE_SECURITE = 1.05 // +5%

const quantiteLitres = Math.ceil(((surfaceTotale * 2) / RENDEMENT_PEINTURE) * MARGE_SECURITE)
```

### Étape 2.1 : Calcul du coût au m² (Formule Colibri)

Le coût au m² est calculé pour l'ensemble du projet (peintures + sous-couches) sur la base de 3 couches (1 sous-couche + 2 couches de finition).

```typescript
Coût au m² = (Total Prix Peintures + Total Prix Sous-couches) / (Surface Totale × 3)
```

### Étape 3 : Optimisation contenants

```typescript
const CONTENANCES = [
  { taille: 12 },
  { taille: 3 },
  { taille: 1 }
]

function optimiserContenants(quantiteLitres) {
  const contenants = []
  let restant = quantiteLitres

  // Algorithme glouton (greedy) basé sur les variants réels Shopify
  for (const contenance of CONTENANCES) {
    const nbPots = Math.floor(restant / contenance.taille)
    if (nbPots > 0) {
      contenants.push({
        contenance: `${contenance.taille}L`,
        quantite: nbPots
      })
      restant -= nbPots * contenance.taille
    }
  }

  // Combler le reste avec le plus petit contenant adapté
  if (restant > 0) {
    contenants.push({
      contenance: "1L",
      quantite: 1
    })
  }

  return contenants
}
```

### Étape 4 : Sous-couches (séparées grise/blanche)

La détermination de la sous-couche se base sur le champ meta `base` du produit :

- **Sous-couche Blanche** : si `base` est `blanc`, `BLC` ou `B`
- **Sous-couche Grise** : si `base` est `C`

```typescript
const RENDEMENT_SOUS_COUCHE = 10 // m² par litre (1 couche)

// Calculer quantités avec marge de 5%
const quantiteLitres = Math.ceil((totalSurface / RENDEMENT_SOUS_COUCHE) * MARGE_SECURITE)
```

### Étape 5 : Sélection kit matériel

Le kit matériel est déterminé automatiquement selon la surface totale et composé de **composants individuels** ajoutés séparément au panier (personnalisables par l'utilisateur).

```typescript
import { determinerKit, KITS_CONFIG } from '@/lib/kits-config'

const surfaceTotale = Object.values(surfacesParProduit)
  .reduce((sum, produit) => sum + produit.surfaceTotale, 0)

// Seuil : 30 m²
const kitType = determinerKit(surfaceTotale) // 'petite_surface' ou 'grande_surface'
const kitConfig = KITS_CONFIG[kitType]

// Kit petite surface (≤ 30 m²) :
// - Bac à peindre plat
// - Rouleau anti-gouttes 180mm
// - Monture rouleau 180mm
// - Pinceau à réchampir T0
// - Ruban de masquage 38mm x 50m

// Kit grande surface (> 30 m²) :
// - Bac à peindre plat
// - Rouleau anti-gouttes 250mm
// - Monture rouleau 250mm
// - Pinceau à réchampir T0
// - Ruban de masquage 50mm x 50m

// Notification toast si changement de kit
if (kitActuel !== kitPrecedent) {
  toast('🔄 Votre kit a été mis à jour', { icon: '🔄', style: { background: '#10b981' } })
}
```

**Synchronisation bidirectionnelle** : Les suppressions de composants dans le panier (étape 6) sont répercutées dans l'étape 5 (Options), et vice-versa, via `localStorage` (`colibri-projet-options`).

---

## Intégration Shopify

### Storefront API (public)

**Utilisé pour** :
- Lecture produits et collections
- Lecture variants et metafields
- Recherche de produits

### Admin API (privé)

**Utilisé pour** :
- Création clients avec tags
- Création Draft Orders
- Application automatique de la remise de 15% (DISCOUNT_FACTOR = 0.85)
- Envoi emails automatiques

### Affichage des prix et structure du panier

L'application affiche systématiquement le prix barré (prix public) et le prix remisé (prix assuré) pour :
- Le total du panier
- Le coût au m² (calculé sur 3 couches : 1 sous-couche + 2 couches de finition)

Le panier est organisé en **4 sections thématiques** pour une meilleure lisibilité :
1. **Peintures de finition** : Regroupe tous les pots de peinture par couleur et contenance.
2. **Sous-couches** : Affiche les sous-couches (blanches ou grises) calculées.
3. **Kit matériel** : Affiche les **composants individuels** du kit avec :
   - Badge "✓ Kit complet" si tous les composants sont présents
   - Titre dynamique selon le type de kit (petite/grande surface)
   - Sous-total matériel avec prix barrés
   - Possibilité de supprimer des composants individuellement
4. **Préparation des surfaces** : Affiche les produits de rénovation si l'option a été cochée.


### Interface de l'étape 5 (Options)

L'interface a été harmonisée pour offrir une expérience cohérente :

- **Tuiles identiques** pour "Kit matériel" et "Préparation des surfaces" (question + phrase explicative + checkbox)
- **Affichage type panier** avec vignettes produits (images Shopify)
- **Suppression individuelle** des composants/produits avec bouton `[×]`
- **Boutons "Réinitialiser"** (outline) pour restaurer les listes complètes
- **Synchronisation bidirectionnelle** avec l'étape 6 : les suppressions sont répercutées dans les deux sens via `localStorage`

---

## Sécurité

### Variables d'environnement

```env
# ✅ PUBLIQUES (peuvent être exposées)
NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN
NEXT_PUBLIC_SHOPIFY_STOREFRONT_ACCESS_TOKEN

# ❌ PRIVÉES (JAMAIS exposées côté client)
SHOPIFY_ADMIN_ACCESS_TOKEN
DISCOUNT_CODE
```

---

## Performance

### Optimisations

- **Code splitting** : Lazy loading des composants
- **Image optimization** : Next.js Image avec CDN Shopify
- **Cache API** : Réduction des appels Shopify (collections, produits)
- **Compression** : Gzip/Brotli automatique (Vercel)

---

## Déploiement

### CI/CD (Vercel)

- **Production** : `main` branch → (projet Vercel colibri-calculateur)
- **Staging** : `develop` branch → (preview Vercel)
- **Preview** : Pull Requests → URL unique par PR

---

## Évolutions futures (Phase 2+)

- ✅ Export PDF des devis
- ✅ Espace client avec historique
- ✅ Envoi SMS (notifications)
- ✅ Support multi-langues (i18n)
- ✅ Tests E2E (Playwright)
