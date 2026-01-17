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
  sousCouche: "grise" | "blanche"
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

const quantiteLitres = (surfaceTotale * 2) / RENDEMENT_PEINTURE
```

### Étape 3 : Optimisation contenants

```typescript
const CONTENANCES = [
  { taille: 12, prix: 265 },
  { taille: 3, prix: 79.90 },
  { taille: 1, prix: 28.50 }
]

function optimiserContenants(quantiteLitres) {
  const contenants = []
  let restant = quantiteLitres

  // Algorithme glouton (greedy)
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
    const contenant = CONTENANCES.find(c => c.taille >= restant) || CONTENANCES[CONTENANCES.length - 1]
    contenants.push({
      contenance: `${contenant.taille}L`,
      quantite: 1
    })
  }

  return contenants
}
```

### Étape 4 : Sous-couches (séparées grise/blanche)

```typescript
// Grouper par type de sous-couche
let totalSousCoucheGrise = 0
let totalSousCoucheBlanche = 0

Object.values(surfacesParProduit).forEach(produit => {
  // Récupérer type via complementary_products
  const sousCouche = getComplementaryProduct(produit.productId)
  
  if (sousCouche.titre.includes('grise')) {
    totalSousCoucheGrise += produit.surfaceTotale
  } else {
    totalSousCoucheBlanche += produit.surfaceTotale
  }
})

// Calculer quantités
const RENDEMENT_SOUS_COUCHE = 10 // m² par litre (1 couche)

const sousCouches = []

if (totalSousCoucheGrise > 0) {
  const quantiteLitres = totalSousCoucheGrise / RENDEMENT_SOUS_COUCHE
  sousCouches.push({
    type: 'grise',
    quantiteLitres,
    contenants: optimiserContenants(quantiteLitres)
  })
}

if (totalSousCoucheBlanche > 0) {
  const quantiteLitres = totalSousCoucheBlanche / RENDEMENT_SOUS_COUCHE
  sousCouches.push({
    type: 'blanche',
    quantiteLitres,
    contenants: optimiserContenants(quantiteLitres)
  })
}
```

### Étape 5 : Sélection kit matériel

```typescript
const surfaceTotale = Object.values(surfacesParProduit)
  .reduce((sum, produit) => sum + produit.surfaceTotale, 0)

// Seuil : 30m²
const kit = surfaceTotale < 30 
  ? { 
      productHandle: 'kit-materiel-de-peinture-petite-surface',
      titre: 'Kit matériel de peinture - Petite surface',
      prix: 29.90
    }
  : { 
      productHandle: 'kit-materiel-de-peinture-moyenne-et-grande-surface',
      titre: 'Kit matériel de peinture - Moyenne et grande surface',
      prix: 40.90
    }
```

---

## Intégration Shopify

### Storefront API (public)

**Utilisé pour** :
- Lecture produits et collections
- Lecture variants et metafields
- Recherche de produits

**Endpoints** :
```typescript
// Récupération collections
GET /api/shopify/collections

// Récupération produits d'une collection
GET /api/shopify/products?collectionHandle=les-blancs

// Détails d'un produit
GET /api/shopify/product?handle=schmidt-navy
```

### Admin API (privé)

**Utilisé pour** :
- Création clients avec tags
- Création Draft Orders
- Application codes réduction
- Envoi emails automatiques

**Endpoints** :
```typescript
// Création Draft Order
POST /api/shopify/draft-order
{
  assure: Assure,
  lineItems: Array<{ variantId, quantity }>,
  tags: ["Covea", "Sinistre"]
}
```

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

### Validation

- **Frontend** : Validation temps réel (email, téléphone, etc.)
- **Backend** : Re-validation côté serveur avant appels API
- **Shopify** : Tokens sécurisés, pas de données sensibles exposées

---

## Performance

### Optimisations

- **Code splitting** : Lazy loading des composants
- **Image optimization** : Next.js Image avec CDN Shopify
- **Cache API** : Réduction des appels Shopify (collections, produits)
- **Compression** : Gzip/Brotli automatique (Vercel)

### Métriques cibles

- **Time to First Byte** : < 200ms
- **First Contentful Paint** : < 1s
- **Lighthouse Score** : > 90/100

---

## Déploiement

### CI/CD (Vercel)

```
Git push → Vercel détecte
         ↓
      Build automatique (npm run build)
         ↓
      Tests (npm run type-check)
         ↓
      Déploiement (Edge Network)
         ↓
      URL disponible (< 2 min)
```

### Environnements

- **Production** : `main` branch → https://sinistre.colibri.fr
- **Staging** : `develop` branch → https://colibri-assurances-staging.vercel.app
- **Preview** : Pull Requests → URL unique par PR

---

## Monitoring (optionnel)

### Sentry (erreurs)

- Tracking des erreurs JavaScript
- Stack traces complètes
- Alertes en temps réel

### Vercel Analytics (performance)

- Core Web Vitals
- Page views
- Conversion tracking

---

## Évolutions futures (Phase 2+)

- ✅ Export PDF des devis
- ✅ Espace client avec historique
- ✅ Envoi SMS (notifications)
- ✅ Support multi-langues (i18n)
- ✅ Analytics avancés (Mixpanel, Amplitude)
- ✅ Tests E2E (Playwright)
- ✅ A/B testing (Optimizely)