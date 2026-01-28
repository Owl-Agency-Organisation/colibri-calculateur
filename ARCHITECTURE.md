# 🏗️ Architecture - Colibri Assurances

## Vue d'ensemble

Application standalone Next.js 15 avec intégration native Shopify pour le calcul automatique de peinture pour sinistres.

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
// 1. ASSURÉ (Client Shopify)
interface Assure {
  civilite: "M" | "Mme"
  nom: string
  prenom: string
  email: string        // OBLIGATOIRE
  telephone: string    // OBLIGATOIRE
  adresse: string
  codePostal: string
  ville: string
  assureur: string     // MAAF, MMA, GMF, BPCE, Karma, ALLIANZ
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
│  UTILISATEUR (Assuré Covea)                │
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

```typescript
const surfaceTotale = Object.values(surfacesParProduit)
  .reduce((sum, produit) => sum + produit.surfaceTotale, 0)

// Seuil : 30m²
const kit = surfaceTotale < 30 
  ? { 
      productHandle: 'kit-peinture-petite-surface',
      titre: 'Kit matériel de peinture - Petite surface'
    }
  : { 
      productHandle: 'kit-materiel-de-peinture-moyenne-et-grande-surface-1',
      titre: 'Kit matériel de peinture - Moyenne et grande surface'
    }
```

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

### Affichage des prix

L'application affiche systématiquement le prix barré (prix public) et le prix remisé (prix assuré) pour :
- Le total du panier
- Le coût au m² (calculé sur 3 couches)

---

## Sécurité

### Variables d'environnement

```env
# ✅ PUBLIQUES (peuvent être exposées)
NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN
NEXT_PUBLIC_SHOPIFY_STOREFRONT_ACCESS_TOKEN

# ❌ PRIVÉES (JAMAIS exposées côté client)
SHOPIFY_ADMIN_ACCESS_TOKEN
COVEA_DISCOUNT_CODE
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

- **Production** : `main` branch → https://sinistre.colibri.fr
- **Staging** : `develop` branch → https://colibri-assurances-staging.vercel.app
- **Preview** : Pull Requests → URL unique par PR

---

## Évolutions futures (Phase 2+)

- ✅ Export PDF des devis
- ✅ Espace client avec historique
- ✅ Envoi SMS (notifications)
- ✅ Support multi-langues (i18n)
- ✅ Tests E2E (Playwright)
