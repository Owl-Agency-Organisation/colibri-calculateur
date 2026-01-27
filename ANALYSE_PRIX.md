# Analyse approfondie de la gestion des prix - Colibri Assurances

## Date : 27 janvier 2026

---

## 1. Architecture actuelle du flux de données

### Fichiers impliqués dans la gestion des prix :

| Fichier | Rôle | Prix dynamiques | Prix hardcodés |
|---------|------|-----------------|----------------|
| `lib/shopify.ts` | Client API Shopify | ✅ Récupère les variants | - |
| `app/api/shopify/products/variants/route.ts` | Endpoint API interne | ✅ Expose les variants | - |
| `lib/calcul/index.ts` | Algorithme de calcul | ✅ Peintures & sous-couches | ❌ Kits (29.90€ / 40.90€) |
| `app/sinistre/options/page.tsx` | Page des options | ✅ Charge les prix Shopify | ❌ Produits rénovation |
| `app/sinistre/panier/page.tsx` | Page du panier | ✅ Utilise le calcul | ❌ Produits rénovation |
| `app/api/generate-pdf/route.ts` | Génération PDF | ❌ Fallback statique | ❌ TOUS les prix |

---

## 2. Vérification des prix réels sur Shopify (via MCP)

### Sous-couche blanche :
| Contenance | Prix Shopify | Prix hardcodé (PDF) | Écart |
|------------|--------------|---------------------|-------|
| 1L | **22.50 €** | 19.90 € | +2.60 € |
| 3L | **64.90 €** | 49.90 € | +15.00 € |
| 12L | **179.90 €** | 159.90 € | +20.00 € |

### Peinture Blanc pur (Mat) :
| Contenance | Prix Shopify | Prix hardcodé (PDF) | Écart |
|------------|--------------|---------------------|-------|
| 1L | **25.90 €** | 24.90 € | +1.00 € |
| 3L | **69.90 €** | 59.90 € | +10.00 € |
| 12L | **199.90 €** | 199.90 € | 0.00 € |

### Peinture Blanc pur (Velours) - Prix différents selon finition :
| Contenance | Prix Shopify | 
|------------|--------------|
| 1L | **28.50 €** |
| 3L | **79.90 €** |
| 12L | **219.90 €** |

### Produits de rénovation :
| Produit | Prix Shopify | Prix hardcodé | Écart |
|---------|--------------|---------------|-------|
| Pâte à rénover | **29.20 €** | 29.20 € | 0.00 € ✅ |

### Kits matériel :
| Produit | Prix Shopify | Prix hardcodé | Statut |
|---------|--------------|---------------|--------|
| Kit petite surface | **NON TROUVÉ** | 29.90 € | ⚠️ Produit inexistant |
| Kit grande surface | **NON TROUVÉ** | 40.90 € | ⚠️ Produit inexistant |

---

## 3. Problèmes identifiés

### 3.1 Problème critique : Sélection de variante par finition

**Code actuel (ligne 217 de `lib/calcul/index.ts`)** :
```typescript
const variant = variants.find(v => v.title.includes(c.contenance));
```

**Problème** : Ce code cherche uniquement la contenance (ex: "3L") mais **ignore la finition** (Mat/Velours/Satin).

**Exemple concret** :
- L'utilisateur choisit "Blanc pur - Velours - 3L" → Prix attendu : **79.90 €**
- Le code trouve le premier variant contenant "3L" → Peut retourner "Mat - 3L" → Prix : **69.90 €**
- **Écart potentiel : 10.00 € par pot**

### 3.2 Problème : Kits inexistants sur Shopify

Les handles utilisés dans le code ne correspondent à aucun produit :
- `kit-materiel-de-peinture-petite-surface` → **404 Not Found**
- `kit-materiel-de-peinture-moyenne-et-grande-surface` → **404 Not Found**

**Impact** : Les prix des kits sont 100% statiques et ne peuvent pas être synchronisés.

### 3.3 Problème : Fallback PDF avec prix obsolètes

Le fichier `app/api/generate-pdf/route.ts` contient un fallback complet avec des prix qui ne correspondent plus à Shopify :
- Sous-couche 1L : 19.90 € (réel : 22.50 €)
- Sous-couche 3L : 49.90 € (réel : 64.90 €)
- Peinture 3L : 59.90 € (réel : 69.90 € pour Mat, 79.90 € pour Velours)

### 3.4 Problème : Cache d'une heure

Dans `lib/shopify.ts` :
```typescript
next: { revalidate: 3600 }, // 1 heure
```
Les prix peuvent être désynchronisés pendant 60 minutes après une mise à jour sur Shopify.

---

## 4. Risques de la correction

### 4.1 Risques élevés
| Risque | Probabilité | Impact | Mitigation |
|--------|-------------|--------|------------|
| Mauvais mapping finition | Haute | Prix incorrect | Tests unitaires |
| Variable non mise à jour | Moyenne | Incohérence affichage | Typage strict |
| Produit kit introuvable | Certaine | Erreur API | Fallback obligatoire |

### 4.2 Risques modérés
| Risque | Probabilité | Impact | Mitigation |
|--------|-------------|--------|------------|
| Performance (trop d'appels API) | Moyenne | Lenteur | Batch requests |
| Cache périmé | Basse | Prix temporairement faux | Réduire TTL |

---

## 5. Plan de correction recommandé

### Phase 1 : Correction du mapping finition (Priorité haute)
- Modifier `calculerPrixTotal()` pour filtrer par finition ET contenance
- Ajouter la finition comme paramètre obligatoire

### Phase 2 : Dynamisation des produits annexes (Priorité moyenne)
- Charger les prix des produits de rénovation via API
- Gérer le cas des kits (créer les produits sur Shopify OU garder en statique avec avertissement)

### Phase 3 : Suppression des fallbacks obsolètes (Priorité basse)
- Supprimer `PRIX_PAR_CONTENANT` du fichier PDF
- Utiliser uniquement les prix transmis par le panier

### Phase 4 : Optimisation du cache (Optionnel)
- Réduire le TTL à 15 minutes
- Ajouter un mécanisme de revalidation forcée sur la page panier

---

## 6. Estimation de l'effort

| Phase | Complexité | Temps estimé | Risque de régression |
|-------|------------|--------------|----------------------|
| Phase 1 | Moyenne | 2-3 heures | Modéré |
| Phase 2 | Faible | 1-2 heures | Faible |
| Phase 3 | Faible | 30 min | Très faible |
| Phase 4 | Faible | 30 min | Très faible |

**Total estimé : 4-6 heures de développement**

---

## 7. Conclusion

L'analyse confirme les écarts signalés lors des tests. Le problème principal est le **mapping incomplet des variantes** qui ignore la finition choisie par l'utilisateur. Les prix hardcodés dans le PDF sont également obsolètes.

**Recommandation** : Procéder à la correction en commençant par la Phase 1 (mapping finition) car c'est la source principale des écarts de prix.
