# ADR 003 : Produits offerts avec peinture - Draft Orders vs Discounts automatiques

**Date** : 1er février 2026  
**Statut** : ✅ Accepté  
**Auteurs** : Philippe Billard, @shopify-product-engineer  
**Contexte** : Partenariat Covea - Offrir ouvre-pot + 2 rouleaux aux clients Colibri Assurances

---

## 🎯 Contexte

Dans le cadre du partenariat avec Covea, nous voulons offrir automatiquement un kit de démarrage (1× ouvre-pot + 2× rouleaux) aux clients assurés qui commandent ≥1 peinture via l'application Colibri Assurances.

**Produits offerts** :
- 1× Ouvre pot Colibri (7,00€)
- 2× Rouleau peinture anti gouttes 180mm (2×8,40€ = 16,80€)
- **Total remise** : -23,80€ par commande

**Critères d'éligibilité** :
- Client taggué "covea" (passage par l'app Colibri Assurances)
- Commande contient ≥1 peinture (collection "Peinture intérieure")
- Maximum 1 remise par commande

---

## ❓ Problème

L'application Colibri Assurances propose **2 parcours utilisateur** :

1. **"Commander maintenant"** → Redirige vers le checkout Shopify natif
2. **"Recevoir mon estimation"** → Crée un draft order et envoie un email

**Contrainte identifiée** :
- Les **discounts automatiques Shopify** (Buy X Get Y) fonctionnent UNIQUEMENT au checkout storefront
- Les discounts automatiques **NE fonctionnent PAS** dans les draft orders créés via l'Admin API

**Question** : Comment offrir les produits de manière cohérente sur les 2 parcours ?

---

## 🔍 Options Considérées

### Option 1 : Discounts automatiques uniquement ❌

**Approche** : Utiliser uniquement les discounts automatiques Shopify (Buy X Get Y)

**Avantages** :
- ✅ Simple : Pas de code, juste configuration Shopify
- ✅ Automatique au checkout
- ✅ Pas de maintenance

**Inconvénients** :
- ❌ **Ne fonctionne PAS pour les draft orders** → Produits pas offerts pour "Recevoir estimation"
- ❌ Expérience incohérente selon le parcours
- ❌ Perte de valeur pour le partenariat Covea

**Décision** : ❌ Rejetée (incohérence entre les 2 parcours)

---

### Option 2 : Draft orders uniquement (pas de checkout natif) ❌

**Approche** : Supprimer "Commander maintenant", uniquement "Recevoir estimation" (draft orders) avec remises manuelles

**Avantages** :
- ✅ Cohérence : 1 seul parcours, 1 seule méthode
- ✅ Contrôle total des remises
- ✅ Simple à implémenter

**Inconvénients** :
- ❌ **Perte du checkout natif Shopify** → Moins bonne UX
- ❌ Pas de paiement immédiat ("Commander maintenant" supprimé)
- ❌ Dépendance totale aux draft orders et emails

**Décision** : ❌ Rejetée (dégradation UX)

---

### Option 3 : Codes discount uniques par session ⚠️

**Approche** : Générer un code discount unique par session et l'appliquer automatiquement au panier

**Avantages** :
- ✅ Contrôle total : Seuls les clients de l'app ont le code
- ✅ Fonctionne au checkout natif
- ✅ Pas de fuite possible

**Inconvénients** :
- ⚠️ Dev nécessaire : Générer + appliquer le code automatiquement
- ⚠️ Limitation Shopify : 1 seul discount code à la fois
- ⚠️ Complexité : Gestion des codes, expiration, etc.
- ⚠️ Ne résout PAS le problème des draft orders

**Décision** : ⚠️ Non retenue (trop complexe, ne résout pas draft orders)

---

### Option 4 : Approche hybride (2 méthodes selon le parcours) ✅

**Approche** : Utiliser 2 méthodes différentes selon le parcours utilisateur

#### Parcours 1 : "Commander maintenant" (Checkout storefront)
- Méthode : **Discounts automatiques Shopify** (Buy X Get Y)
- Les produits offerts sont ajoutés au panier aux prix normaux
- Au checkout, Shopify applique automatiquement les 2 discounts

#### Parcours 2 : "Recevoir estimation" (Draft order)
- Méthode : **Remises manuelles** (appliedDiscount dans le draft order)
- Les produits offerts sont ajoutés avec une remise de 100% directement dans le draft order
- Le client voit les produits offerts dans l'email

**Avantages** :
- ✅ **Cohérence utilisateur** : Produits offerts sur les 2 parcours
- ✅ **UX optimale** : Checkout natif pour "Commander maintenant"
- ✅ **Contrôle total** : Remises manuelles pour draft orders
- ✅ **Transparence** : Produits offerts visibles partout (panier, checkout, email)
- ✅ **Pas de coût** : Pas d'app tierce
- ✅ **Sécurité** : Tag "covea" limite l'accès aux clients de l'app

**Inconvénients** :
- ⚠️ **2 logiques à maintenir** : Discounts auto + remises manuelles
- ⚠️ **Complexité légèrement accrue** : Code spécifique pour chaque parcours
- ⚠️ **Documentation nécessaire** : Expliquer pourquoi 2 approches

**Décision** : ✅ **RETENUE** (meilleur compromis qualité/complexité)

---

## ✅ Décision

**Nous adoptons l'Option 4 : Approche hybride (2 méthodes selon le parcours)**

### Architecture retenue

#### **Parcours "Commander maintenant"** (Checkout storefront)

**Configuration Shopify** :
- 2 discounts automatiques créés (Buy X Get Y) :
  - Discount A : Buy ≥1 peinture → Get 1× ouvre-pot gratuit
  - Discount B : Buy ≥1 peinture → Get 2× rouleaux gratuits
- Admissibilité : Segment "Clients tagués covea"
- Combinaisons : "Réductions sur les produits" coché (pour cumul)

**Code application** :
```typescript
// 1. Tagger le client "covea" (si pas déjà fait)
await tagCustomerCovea(customerId);

// 2. Créer le panier avec produits aux prix normaux
const cart = await createCart({
  lineItems: [
    ...peintures,
    { variantId: OUVRE_POT_VARIANT_ID, quantity: 1 },
    { variantId: ROULEAU_VARIANT_ID, quantity: 2 }
  ]
});

// 3. Rediriger vers le checkout
window.location.href = cart.checkoutUrl;

// 4. Shopify applique automatiquement les discounts
```

#### **Parcours "Recevoir estimation"** (Draft order)

**Code application** :
```typescript
// 1. Tagger le client "covea" (si pas déjà fait)
await tagCustomerCovea(customerId);

// 2. Appliquer remises manuelles si peinture dans le panier
const lineItemsWithDiscounts = lineItems.map(item => {
  const isOuvrePot = item.variantId === OUVRE_POT_VARIANT_ID;
  const isRouleau = item.variantId === ROULEAU_VARIANT_ID;
  const hasPeinture = lineItems.some(i => i.productType === 'Peinture');
  
  if ((isOuvrePot || isRouleau) && hasPeinture) {
    return {
      ...item,
      appliedDiscount: {
        description: "Offert avec peinture / Colibri Assurances",
        value: 100,
        valueType: "PERCENTAGE"
      }
    };
  }
  
  return item;
});

// 3. Créer le draft order
const draftOrder = await createDraftOrder({
  lineItems: lineItemsWithDiscounts,
  customer: { id: customerId }
});

// 4. Shopify envoie l'email avec produits offerts visibles
```

---

## 📊 Conséquences

### Positives ✅

1. **Expérience utilisateur cohérente** : Les produits offerts sont visibles et appliqués sur les 2 parcours
2. **UX optimale** : Le checkout natif Shopify est préservé pour "Commander maintenant"
3. **Transparence** : Les clients voient clairement les produits offerts (badge "🎁 OFFERT" dans l'app, lignes de remise au checkout/email)
4. **Sécurité** : Seuls les clients taggés "covea" (passage par l'app) reçoivent les produits offerts
5. **Pas de coût supplémentaire** : Pas d'app tierce nécessaire
6. **Fidélisation** : Les clients taggés "covea" gardent l'avantage à vie (stratégie de fidélisation acceptée)

### Négatives ⚠️

1. **Maintenance de 2 logiques** :
   - Discounts automatiques Shopify (configuration à maintenir)
   - Remises manuelles dans le code (fonction `applyFreeProductDiscounts`)
   
2. **Complexité légèrement accrue** :
   - Nécessite de bien comprendre les 2 approches
   - Documentation obligatoire pour les futurs développeurs
   
3. **Tests à doubler** :
   - Tester les 2 parcours séparément
   - Vérifier que les remises s'appliquent correctement dans les 2 cas

4. **Tag permanent** :
   - Une fois taggé "covea", le client aura les produits offerts à VIE
   - Acceptable pour Philippe (stratégie de fidélisation)
   - Alternative : Tag temporaire (retrait après 1ère commande) → Plus complexe, non nécessaire

---

## 🔧 Implémentation

### Configuration Shopify (DÉJÀ FAIT ✅)

**Discounts automatiques** :
- Discount 1 : "Ouvre pot offert avec peinture / Colibri Assurances"
- Discount 2 : "Rouleaux 180 mm offerts avec peinture / Colibri Assurances"
- Segment : "Clients tagués covea"

**Date de création** : 1er février 2026

### Développement (À FAIRE)

**Fichiers à créer/modifier** :

1. `/lib/shopify-customers.ts` :
   - Nouvelle fonction `tagCustomerCovea(customerId: string)`
   
2. `/app/api/sinistre/checkout/route.ts` :
   - Fonction `applyFreeProductDiscounts(lineItems)`
   - Appliquer remises avant création draft order
   
3. `/app/sinistre/options/page.tsx` :
   - Afficher badge "🎁 OFFERT" pour ouvre-pot et rouleaux
   
4. `/app/sinistre/panier/page.tsx` :
   - Afficher badge "🎁 OFFERT" pour ouvre-pot et rouleaux

**Estimation** : 3 heures

---

## 📝 Documentation

- [x] ADR créé : `003-produits-offerts-draft-orders-vs-discounts.md`
- [ ] Guide technique : `docs/features/produits-offerts.md` (à créer lors du dev)
- [ ] Inline code comments avec références à l'ADR
- [ ] Mise à jour README.md avec lien vers l'ADR

---

## 🔗 Références

- GitHub Issue #22 : Produits offerts avec peinture (Partenariat Covea)
- BACKLOG.md : Entrée à créer
- Shopify Admin : Discounts → "Ouvre pot offert..." et "Rouleaux 180mm offerts..."
- Shopify Admin : Clients → Segments → "Clients tagués covea"

---

## 📅 Historique

| Date | Événement |
|------|-----------|
| 2026-02-01 | **Création de l'ADR** - Décision d'adopter l'approche hybride |
| 2026-02-01 | **Configuration Shopify** - Création des 2 discounts automatiques et du segment "covea" |
| À venir | **Développement** - Implémentation du tagging et des remises manuelles |

---

## 💬 Notes

**Citation de Philippe** (1er février 2026) :
> "C'est un risque limité car des clients qui reviennent n'auront plus la réduction, donc c'est acceptable pour le moment."

→ Le tag "covea" est permanent. Un client qui passe 1× par l'app aura les produits offerts à VIE sur toutes ses commandes futures (même hors app). C'est une stratégie de fidélisation acceptée par Philippe.

**Alternative discutée mais non retenue** :
- Tag temporaire (retrait automatique après 1ère commande via webhook)
- Raison du rejet : Plus complexe, pas nécessaire pour le moment
- À reconsidérer si abus constatés

---

**Auteurs** : Philippe Billard (Owl Agency), @shopify-product-engineer  
**Statut** : ✅ Accepté  
**Version** : 1.0
