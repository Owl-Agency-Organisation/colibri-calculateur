# 🎨 Colibri Calculateur

Calculateur de peinture en ligne de la boutique [colibripeinture.com](https://www.colibripeinture.com) : l'utilisateur décrit ses pièces et surfaces, l'application calcule les quantités de peinture et sous-couche nécessaires, propose le kit matériel adapté et débouche sur une commande Shopify remisée de 15 %.

**Production** : [calculateur.colibripeinture.com](https://calculateur.colibripeinture.com)

## Principes

- **La boutique Shopify est la seule source de vérité tarifaire.** Aucun prix n'est codé en dur : tout montant affiché provient de la Storefront API, et les totaux remisés sont ceux calculés par Shopify (égalité au centime près avec le checkout).
- **Remise −15 % réelle** : code promo injecté côté serveur dans `cartCreate` (flux direct) et `appliedDiscount` PERCENTAGE 15 sur les draft orders (estimation). Le code n'est jamais affiché ni exposé au client.
- **Secrets côté serveur uniquement** : Admin API et clé Klaviyo ne transitent jamais dans le bundle client ; toute mutation passe par une route `app/api/*`.

## Stack

- **Next.js 15** (App Router) · **React 19** · **TypeScript strict** · **Tailwind CSS 3**
- **Shopify** : Storefront API (catalogue, prix, panier, bundles) + Admin API (clients, draft orders)
- **Klaviyo** : événement `Estimation calculateur demandée` (relances e-mail)
- **Vercel** : hébergement, previews par PR, Analytics (événements de parcours anonymes)
- **Vitest** : tests unitaires de l'algorithme de calcul
- Gestionnaire de paquets : **pnpm**

## Parcours utilisateur (6 étapes)

1. **Pièce** — choix du type de pièce (7 types, finitions automatiques selon la pièce)
2. **Surfaces** — murs (jusqu'à 4, couleurs distinctes), plafond, boiseries
3. **Récapitulatif** — multi-pièces : ajout, modification, suppression
4. **Options** — kit matériel (bundle Shopify tout-ou-rien, recommandé selon la surface : ≤ 30 m² petite surface, > 30 m² moyenne/grande) et produits de préparation des surfaces
5. **Panier** — prix boutique, remise −15 % appliquée par Shopify, triple sortie :
   - 🛒 **Régler ma commande** → checkout Shopify du panier
   - 🛍️ **Continuer mes achats** → cart permalink vers la boutique (remise conservée)
   - ✉️ **Recevoir mon estimation** → draft order remisé + e-mail invoice Shopify
6. **Confirmation** — confirmation d'envoi de l'estimation

## Algorithme de calcul (`lib/calcul`)

1. **Agrégation des surfaces** par couleur + finition (clé stricte : deux finitions d'un même produit ne sont jamais fusionnées, leurs prix diffèrent)
2. **Litrage** : surface × couches (2 pour la peinture, 1 pour la sous-couche) / rendement 10 m²/L, + 5 % de marge, arrondi au litre le plus proche
3. **Optimisation des contenants** : glouton sur les contenances réellement disponibles chez Shopify (12L → 3L → 1L)
4. **Sous-couche** : grise si la base couleur est `C`, blanche sinon
5. **Sélection de variante durcie** : filtre contenance + finition, puis verrou de gamme (Biosourcée standard retenue face à la Dépolluante, quel que soit l'ordre de l'API) ; les kits sont des bundles à variant unique (verrou loggé si la boutique en ajoutait un)

Ce module est couvert par des tests unitaires (`pnpm test`) — ne pas le modifier sans les faire évoluer.

## Structure du projet

```
/colibri-calculateur
├── /app
│   ├── page.tsx                  # Accueil (Démarrer / Reprendre)
│   ├── layout.tsx                # Layout global, metadata, Analytics
│   ├── /calculateur              # Tunnel : piece, surfaces, recapitulatif,
│   │                             #   options, panier, confirmation
│   └── /api
│       ├── /calculateur
│       │   ├── /cart             # Création du panier Shopify (code promo serveur)
│       │   ├── /permalink        # Cart permalink boutique (code promo serveur)
│       │   └── /estimation       # Client + draft order remisé + invoice + Klaviyo
│       └── /shopify              # Lectures Storefront (collections, produits, variants)
├── /components
│   ├── /ui                       # Button, Card, Input, Select, StepIndicator, InfoTooltip
│   └── /modals                   # CouleurModal, ConfirmModal, EstimationModal
├── /lib
│   ├── /calcul                   # Algorithme de calcul (cœur métier, testé)
│   ├── cart-mapper.ts            # ResultatCalcul → lignes de panier Shopify
│   ├── shopify.ts                # Client Storefront API (catalogue, bundles)
│   ├── shopify-cart.ts           # Panier Storefront (création côté serveur)
│   ├── shopify-admin.ts          # Admin API (client credentials, serveur uniquement)
│   ├── shopify-customers.ts      # Clients + consentement marketing
│   ├── shopify-draft-orders.ts   # Draft orders + invoices
│   ├── klaviyo.ts                # Événements Klaviyo (serveur uniquement)
│   ├── kits-config.ts            # Handles et seuil des kits matériel
│   └── /store                    # État localStorage (helpers maison, pas de lib)
└── .env.local.example            # Modèle des variables d'environnement
```

## Installation

Prérequis : Node.js 18.18+ et pnpm.

```bash
git clone https://github.com/Owl-Agency-Organisation/colibri-calculateur.git
cd colibri-calculateur
pnpm install
cp .env.local.example .env.local   # puis remplir les valeurs
pnpm dev                           # http://localhost:3000
```

## Variables d'environnement

### Publiques (exposées côté client)

| Variable | Rôle |
|---|---|
| `NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN` | Domaine myshopify de la boutique |
| `NEXT_PUBLIC_SHOPIFY_STOREFRONT_ACCESS_TOKEN` | Token Storefront API (lecture catalogue) |

### Privées (serveur uniquement — jamais `NEXT_PUBLIC_`)

| Variable | Rôle |
|---|---|
| `SHOPIFY_API_VERSION` | Version des API Shopify (ex. `2025-01`) |
| `SHOPIFY_ADMIN_CLIENT_ID` / `SHOPIFY_ADMIN_CLIENT_SECRET` | Admin API en client credentials grant (clients, draft orders, invoices) |
| `DISCOUNT_CODE` | Code promo −15 % injecté dans `cartCreate` et le cart permalink — jamais affiché à l'écran |
| `KLAVIYO_PRIVATE_API_KEY` | Clé privée Klaviyo pour l'événement `Estimation calculateur demandée`. Absente : envoi ignoré avec warning, l'estimation aboutit quand même (previews sans clé fonctionnels) |

## Commandes

```bash
pnpm dev          # serveur de développement
pnpm build        # build de production
pnpm start        # serveur de production
pnpm lint         # ESLint
pnpm type-check   # tsc --noEmit
pnpm test         # tests unitaires Vitest (lib/calcul, cart-mapper)
```

CI GitHub Actions (`.github/workflows/ci.yml`) : lint + type-check + tests + build sur chaque PR.

## Déploiement

Projet Vercel `colibri-calculateur` :
- **Production** : branche `main`, domaine `calculateur.colibripeinture.com`
- **Preview** : un déploiement par Pull Request

Configurer les variables d'environnement dans Vercel (Production + Preview). Chaque PR est validée sur son preview avant merge (`main` n'est jamais poussée directement).

## Analytics de parcours

Événements Vercel Analytics anonymes (aucune donnée personnelle) : `calcul_demarre`, `piece_validee`, `surfaces_saisies`, `options_validees`, `panier_atteint`, `sortie_choisie` (`checkout` / `permalink` / `estimation`). Ils mesurent où les utilisateurs décrochent dans le tunnel.

## Documentation

- [ARCHITECTURE.md](./ARCHITECTURE.md) — architecture technique
- [PLAN.md](./PLAN.md) — plan de transformation (historique du chantier)
- [CHANGELOG.md](./CHANGELOG.md) — historique des modifications
- [docs/MULTI_MURS_FEATURE.md](./docs/MULTI_MURS_FEATURE.md) — fonctionnalité multi-murs

## Équipe

- **Développement** : [Owl Agency](https://owl-agency.io)
- **Client** : Colibri Peinture

## Licence

Privé — Owl Agency © 2026
