# Backlog des Améliorations

**Projet** : Colibri Assurances  
**Date de création** : 31 janvier 2026  
**Source** : Revue de code v1.7.0 (Checkout direct et Draft orders)

---

## 🎯 Vue d'ensemble

Ce document regroupe les améliorations identifiées lors de la revue de code qui ne sont **pas bloquantes** pour le merge sur `main`, mais qui devraient être implémentées pour améliorer la robustesse, la sécurité et la qualité du code.

**Priorités** :
- 🔴 **Haute** : Impacte la sécurité ou la stabilité
- 🟠 **Moyenne** : Améliore l'expérience utilisateur ou la maintenabilité
- 🟢 **Basse** : Optimisation ou amélioration mineure

---

## 🔒 Sécurité et Robustesse

### 1. Implémenter le rate limiting 🔴

**Problème** : Pas de rate limiting implémenté sur les routes API, risque de dépassement des quotas Shopify en cas de trafic élevé.

**Solution** :
- Ajouter un middleware de rate limiting sur les routes API critiques :
  - `/api/sinistre/checkout`
  - `/api/shopify/customer`
  - `/api/shopify/products/variants`
- Utiliser une bibliothèque comme `next-rate-limit` ou `upstash-ratelimit`
- Configurer des limites par IP et par utilisateur

**Estimation** : 2-3 heures

**Labels** : `security`, `enhancement`, `api`

---

### 2. Renforcer la validation des données 🟠

**Problème** : Validation partielle des données utilisateur avant envoi à Shopify.

**Améliorations à apporter** :
- Valider le format des emails (regex + vérification du domaine)
- Valider la longueur et les caractères spéciaux des adresses
- Sanitizer les inputs pour éviter les injections
- Ajouter une validation Zod ou Yup pour les schémas de données

**Fichiers concernés** :
- `/app/api/sinistre/checkout/route.ts`
- `/lib/shopify-customers.ts`
- `/lib/shopify-draft-orders.ts`

**Estimation** : 3-4 heures

**Labels** : `security`, `enhancement`, `validation`

---

### 3. Vérifier les doublons de customers 🟠

**Problème** : Pas de vérification des doublons lors de la création de customers dans Shopify.

**Solution** :
- Avant de créer un customer, vérifier s'il existe déjà par email
- Si existe, récupérer son ID au lieu de créer un doublon
- Ajouter une fonction `getOrCreateCustomer()` dans `/lib/shopify-customers.ts`

**Estimation** : 1-2 heures

**Labels** : `enhancement`, `shopify`, `customers`

---

### 4. Valider et gérer les Customer ID invalides 🟠

**Problème** : Si un customer est supprimé dans Shopify Admin mais que son ID reste dans localStorage, la création de Draft Order échoue avec "Record is invalid".

**Solution** :
- Vérifier que le customer existe avant de créer un Draft Order
- Si le customer n'existe plus, le re-créer automatiquement
- Nettoyer localStorage en cas d'erreur
- Logger les cas de customer invalide pour monitoring

**Implémentation** :
- Créer une fonction `findCustomerById()` dans `/lib/shopify-customers.ts`
- Dans `/app/api/sinistre/checkout/route.ts`, vérifier le customer avant la création du Draft Order
- Si customer invalide, appeler `findCustomerByEmail()` ou `createCustomer()` pour récupérer/créer un customer valide
- Côté frontend, nettoyer localStorage en cas d'erreur 500

**Fichiers concernés** :
- `/lib/shopify-customers.ts` (nouvelle fonction `findCustomerById()`)
- `/app/api/sinistre/checkout/route.ts` (validation + fallback)
- `/app/sinistre/panier/page.tsx` (cleanup localStorage)

**Estimation** : 2-3 heures

**Labels** : `bug`, `enhancement`, `shopify`, `customers`

---

## 🧪 Tests et Qualité

### 5. Ajouter des tests unitaires 🔴

**Problème** : Aucun test unitaire n'est présent dans le projet.

**Tests à ajouter** :
- Tests unitaires pour `/lib/utils/phone.ts` (normalisation des téléphones)
- Tests unitaires pour `/lib/shopify-admin.ts` (gestion des tokens OAuth)
- Tests unitaires pour `/lib/shopify-customers.ts` (création de customers)
- Tests unitaires pour `/lib/shopify-draft-orders.ts` (création de draft orders)
- Tests d'intégration pour `/app/api/sinistre/checkout/route.ts`

**Framework recommandé** : Jest + React Testing Library

**Estimation** : 8-10 heures

**Labels** : `testing`, `quality`, `high-priority`

---

### 6. Ajouter des tests end-to-end (E2E) 🟠

**Problème** : Aucun test E2E pour valider le parcours utilisateur complet.

**Scénarios à tester** :
- Parcours complet : Identification → Panier → Checkout direct
- Parcours complet : Identification → Panier → Draft order (email)
- Pré-remplissage du checkout Shopify
- Normalisation des téléphones

**Framework recommandé** : Playwright ou Cypress

**Estimation** : 6-8 heures

**Labels** : `testing`, `e2e`, `quality`

---

## 📊 Monitoring et Logging

### 7. Améliorer le logging 🟠

**Problème** : Les erreurs sont loggées avec `console.error`, mais pas de système de monitoring centralisé.

**Solution** :
- Intégrer un service de logging centralisé (Sentry, LogRocket, Datadog)
- Ajouter des logs structurés (niveau, timestamp, contexte)
- Logger les événements importants (création de customer, draft order, checkout)
- Ajouter des alertes pour les erreurs critiques

**Estimation** : 4-5 heures

**Labels** : `monitoring`, `logging`, `enhancement`

---

### 8. Ajouter des métriques de performance 🟢

**Problème** : Pas de métriques de performance pour suivre les temps de réponse des API.

**Solution** :
- Ajouter un middleware pour mesurer les temps de réponse
- Logger les temps de réponse des appels Shopify
- Ajouter des métriques sur les taux de succès/échec
- Intégrer avec un service de monitoring (Vercel Analytics, Datadog)

**Estimation** : 3-4 heures

**Labels** : `monitoring`, `performance`, `enhancement`

---

## 🎨 UX et Interface

### 9. Améliorer la gestion des erreurs côté client 🟠

**Problème** : Les erreurs sont affichées avec `alert()`, ce qui n'est pas professionnel.

**Solution** :
- Remplacer les `alert()` par des toasts ou des modales
- Utiliser `react-hot-toast` (déjà intégré) pour les notifications
- Ajouter des messages d'erreur contextuels et explicites
- Gérer les états de chargement avec des spinners

**Fichiers concernés** :
- `/app/sinistre/panier/page.tsx`

**Estimation** : 2-3 heures

**Labels** : `ux`, `enhancement`, `ui`

---

### 10. Ajouter un indicateur de chargement global 🟢

**Problème** : Pas d'indicateur de chargement global pendant les appels API.

**Solution** :
- Ajouter un spinner global en haut de page pendant les requêtes
- Utiliser un contexte React pour gérer l'état de chargement global
- Désactiver les boutons pendant les requêtes

**Estimation** : 2 heures

**Labels** : `ux`, `enhancement`, `ui`

---

## 🔧 Optimisations Techniques

### 11. Mettre en cache les tokens OAuth 🟠

**Problème** : Les tokens OAuth sont générés à chaque appel, ce qui est inefficace (valides 24h).

**Solution** :
- Mettre en cache les tokens OAuth avec une durée de vie de 23h
- Utiliser Redis ou un cache en mémoire (Next.js cache)
- Régénérer automatiquement le token avant expiration

**Fichier concerné** :
- `/lib/shopify-admin.ts`

**Estimation** : 2-3 heures

**Labels** : `performance`, `optimization`, `shopify`

---

### 12. Optimiser les requêtes GraphQL 🟢

**Problème** : Les requêtes GraphQL pourraient être optimisées pour réduire la latence.

**Améliorations** :
- Utiliser des fragments GraphQL pour réutiliser les champs
- Réduire le nombre de champs récupérés (ne récupérer que le nécessaire)
- Utiliser le batching pour regrouper les requêtes

**Fichiers concernés** :
- `/lib/shopify-cart.ts`
- `/lib/shopify-customers.ts`
- `/lib/shopify-draft-orders.ts`

**Estimation** : 3-4 heures

**Labels** : `performance`, `optimization`, `graphql`

---

## 📝 Documentation

### 13. Ajouter de la documentation technique 🟠

**Problème** : Manque de documentation technique sur les nouvelles fonctionnalités.

**Documentation à ajouter** :
- Documentation de l'API Admin Shopify (OAuth, tokens)
- Documentation des fonctions de normalisation des téléphones
- Documentation du workflow de checkout (2 modes)
- Diagrammes de séquence pour les flux principaux

**Estimation** : 4-5 heures

**Labels** : `documentation`, `enhancement`

---

### 14. Créer un ADR pour les décisions architecturales 🟢

**Problème** : Les décisions architecturales importantes ne sont pas documentées.

**ADR à créer** :
- ADR : Choix de l'API Admin Shopify vs Storefront API
- ADR : Choix de l'OAuth Client Credentials Grant
- ADR : Choix de la normalisation des téléphones au format E.164

**Estimation** : 2-3 heures

**Labels** : `documentation`, `architecture`, `adr`

---

## 🚀 Fonctionnalités Futures

### 15. Ajouter un système de retry automatique 🟢

**Problème** : Pas de retry automatique en cas d'échec temporaire des appels Shopify.

**Solution** :
- Ajouter un système de retry avec backoff exponentiel
- Utiliser une bibliothèque comme `axios-retry` ou `p-retry`
- Configurer le nombre de tentatives et les délais

**Estimation** : 2-3 heures

**Labels** : `enhancement`, `reliability`, `api`

---

### 16. Ajouter un webhook Shopify pour les draft orders 🟢

**Problème** : Pas de notification côté application quand un draft order est payé.

**Solution** :
- Créer un webhook Shopify pour écouter les événements `draft_orders/completed`
- Mettre à jour le statut de la commande dans l'application
- Envoyer une notification au client

**Estimation** : 4-5 heures

**Labels** : `enhancement`, `shopify`, `webhooks`

---

## 📊 Récapitulatif

| Priorité | Nombre d'améliorations | Estimation totale |
|----------|------------------------|-------------------|
| 🔴 Haute | 2 | 10-13 heures |
| 🟠 Moyenne | 9 | 27-35 heures |
| 🟢 Basse | 5 | 13-17 heures |
| **Total** | **16** | **50-65 heures** |

---

## 🎯 Roadmap suggérée

### Sprint 1 (Priorité Haute) - 10-13 heures
1. Implémenter le rate limiting
2. Ajouter des tests unitaires

### Sprint 2 (Sécurité et Qualité) - 14-18 heures
3. Renforcer la validation des données
4. Vérifier les doublons de customers
5. **Valider et gérer les Customer ID invalides** ⭐ **NOUVEAU**
6. Améliorer le logging
7. Ajouter des tests E2E

### Sprint 3 (UX et Optimisations) - 10-13 heures
8. Améliorer la gestion des erreurs côté client
9. Mettre en cache les tokens OAuth
10. Ajouter de la documentation technique
11. Ajouter un indicateur de chargement global

### Sprint 4 (Optimisations et Fonctionnalités) - 16-21 heures
12. Optimiser les requêtes GraphQL
13. Ajouter des métriques de performance
14. Créer un ADR pour les décisions architecturales
15. Ajouter un système de retry automatique
16. Ajouter un webhook Shopify pour les draft orders

---

**Dernière mise à jour** : 31 janvier 2026  
**Auteur** : Manus + @shopify-product-engineer  
**Version** : 1.1