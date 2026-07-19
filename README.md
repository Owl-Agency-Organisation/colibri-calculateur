# 🎨 Colibri Calculateur

Calculateur de peinture en ligne pour la boutique [colibripeinture.com](https://www.colibripeinture.com)

## 📋 Description

Application Next.js 15 permettant de calculer automatiquement les besoins en peinture d'un projet de rénovation, avec optimisation des contenants et génération de commandes Shopify.

## 🚀 Technologies

- **Framework** : Next.js 15 (App Router)
- **Language** : TypeScript
- **Styling** : Tailwind CSS
- **API** : Shopify Storefront API + Admin API
- **Hosting** : Vercel
- **Store** : Shopify (vztmja-iy.myshopify.com)

## 📁 Structure du projet

```
/colibri-calculateur
├── /app                     # Next.js App Router
│   ├── layout.tsx           # Layout global
│   ├── page.tsx             # Page d'accueil
│   └── globals.css          # Styles globaux
├── /components              # Composants réutilisables
│   └── /ui                  # Composants UI de base
│       ├── Button.tsx
│       ├── Input.tsx
│       └── Card.tsx
├── /lib                     # Utilitaires
│   ├── shopify.ts           # Client Shopify API
│   ├── types.ts             # Types TypeScript
│   └── utils.ts             # Fonctions utilitaires
├── /public                  # Assets statiques
├── .env.local.example       # Template variables env
└── README.md
```

## 🔧 Installation

### Prérequis

- Node.js 18+ et npm/yarn/pnpm
- Compte Shopify avec accès API
- Compte Vercel (pour déploiement)

### Étapes

1. **Cloner le repository**

```bash
git clone https://github.com/Owl-Agency-Organisation/colibri-calculateur.git
cd colibri-calculateur
```

2. **Installer les dépendances**

```bash
npm install
# ou
yarn install
# ou
pnpm install
```

3. **Configurer les variables d'environnement**

Copier `.env.local.example` vers `.env.local` et remplir les valeurs :

```bash
cp .env.local.example .env.local
```

Éditer `.env.local` :

```env
# Shopify Storefront API (public)
NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN=vztmja-iy.myshopify.com
NEXT_PUBLIC_SHOPIFY_STOREFRONT_ACCESS_TOKEN=your_token_here

# Shopify Admin API (privé)
SHOPIFY_ADMIN_ACCESS_TOKEN=shpat_your_admin_token_here
SHOPIFY_API_VERSION=2025-01

# Code promo -15% du calculateur (lu côté serveur)
DISCOUNT_CODE=PROMO-APP-CALCULATEUR
```

4. **Lancer le serveur de développement**

```bash
npm run dev
# ou
yarn dev
# ou
pnpm dev
```

Ouvrir [http://localhost:3000](http://localhost:3000) dans votre navigateur.

## 🏗️ Architecture

Voir [ARCHITECTURE.md](./ARCHITECTURE.md) pour la documentation complète de l'architecture.

### Flux utilisateur (7 étapes)

1. **Identification** : Capture des coordonnées du client
2. **Sélection pièce** : Choix type de pièce (7 types disponibles)
3. **Saisie surfaces** : Plafond + murs (jusqu'à 4 murs avec couleurs distinctes) + boiseries
4. **Multi-pièces** : Ajout/modification/suppression de pièces
5. **Options** : Interface harmonisée avec tuiles identiques pour Kit matériel et Préparation des surfaces. Affichage type panier avec vignettes produits (images Shopify), possibilité de supprimer des composants individuellement et boutons "Réinitialiser". La sous-couche est **obligatoire** et n'est plus affichée à cette étape.
6. **Récapitulatif** : Panier organisé en 4 sections (Peintures, Sous-couches, Kit, Rénovation) avec quantités optimisées, **remise de 15% appliquée**, prix barrés, coût au m² et badge "✓ Kit complet" si applicable. **Synchronisation bidirectionnelle** avec l'étape 5 : les suppressions sont répercutées dans les deux sens.
7. **Confirmation** : Création Draft Order Shopify + email automatique

### Algorithme de calcul

1. **Cumul des surfaces** identiques (même couleur + finition + gamme)
2. **Calcul litres** : (surface × 2 couches / 10) + 5% de marge, arrondi au litre supérieur
3. **Optimisation contenants** : algorithme glouton basé sur les variants réels Shopify (12L, 3L, 1L)
4. **Sous-couches** : Déterminées par le champ meta `base` du produit :
   - Si `base` est `blanc`, `BLC` ou `B` → **Sous-couche blanche**
   - Si `base` est `C` → **Sous-couche grise**
5. **Kit matériel** : Détection automatique du type de kit selon surface totale :
   - **Petite surface** (≤ 30 m²) : 5 composants (bac, rouleau 180mm, monture, pinceau, ruban 38mm)
   - **Grande surface** (> 30 m²) : 5 composants (bac, rouleau 250mm, monture, pinceau, ruban 50mm)
   - Notification toast automatique en cas de changement de kit
   - Composants ajoutés individuellement au panier (personnalisables par l'utilisateur)

## 🔑 Variables d'environnement

### Publiques (exposées côté client)

- `NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN` : Domaine du store Shopify
- `NEXT_PUBLIC_SHOPIFY_STOREFRONT_ACCESS_TOKEN` : Token Storefront API
- `NEXT_PUBLIC_APP_URL` : URL de l'application

### Privées (côté serveur uniquement)

- `SHOPIFY_ADMIN_ACCESS_TOKEN` : Token Admin API (pour Draft Orders)
- `SHOPIFY_API_VERSION` : Version de l'API Shopify (ex: 2025-01)
- `DISCOUNT_CODE` : Code promo -15% appliqué par le calculateur

## 📦 Scripts disponibles

```bash
# Développement
npm run dev

# Build production
npm run build

# Lancer en production
npm start

# Linter
npm run lint

# Vérification types TypeScript
npm run type-check
```

## 🚢 Déploiement

### Vercel (recommandé)

1. **Connecter le repository GitHub à Vercel**
2. **Configurer les variables d'environnement** (Settings > Environment Variables)
3. **Déploiement automatique** : chaque push sur `main` déclenche un déploiement

### Environnements

- **Production** : branch `main` (projet Vercel `colibri-calculateur`)
- **Preview** : chaque Pull Request (deployment Vercel dédié)

## 🧪 Tests

### Cas de test

**Micheline (référence)** :
- Pièce de vie : 129m² (plafond 45m², murs 84m²)
- Chambre : 54m² (plafond 12m², murs 42m²)
- Couleurs : Blanc mat (plafonds), Blanc velours (murs)
- Résultat attendu :
  - Sous-couche blanche : 18.3L → 1×12L + 2×3L + 1×1L
  - Peinture Blanc Mat : 11.4L → 1×12L
  - Peinture Blanc Velours : 25.2L → 2×12L + 1×3L
  - Kit 2 (surface ≥ 30m²)

## 📝 Documentation

- [ARCHITECTURE.md](./ARCHITECTURE.md) : Architecture technique complète
- [CHANGELOG.md](./CHANGELOG.md) : Historique des versions et modifications
- [docs/MULTI_MURS_FEATURE.md](./docs/MULTI_MURS_FEATURE.md) : Documentation de la fonctionnalité multi-murs
- [.env.local.example](./.env.local.example) : Template variables d'environnement

## 👥 Équipe

- **Développement** : Owl Agency
- **Client** : Colibri Peinture

## 📄 License

Private - Owl Agency © 2026
