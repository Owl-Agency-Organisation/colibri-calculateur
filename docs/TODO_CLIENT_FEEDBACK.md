# Liste des tâches - Retours Client MVP

Cette liste récapitule les actions à mener basées sur les retours client du 21 janvier 2026.

## 🔴 Priorité Haute (Indispensable pour la V1)

### 1. Intégration Shopify Backend
- [ ] **Création client** : Implémenter la création automatique du client dans Shopify lors de la soumission du formulaire.
    - Ajouter le tag `Covea`.
    - Assurer le déclenchement du traitement Klaviyo.
- [ ] **Commandes brouillons** : Générer une "Draft Order" dans Shopify à la fin du tunnel.
- [ ] **Notifications** : Configurer l'envoi automatique de l'e-mail de confirmation via Shopify.

### 2. Algorithme et Contenu
- [ ] **Calcul Peinture** : Vérifier et corriger le calcul pour inclure systématiquement **2 couches** (Note: Déjà adressé dans la v2.0 de l'algorithme, à valider).
- [ ] **Landing Page** : Intégrer la landing page officielle du projet.

### 3. Infrastructure
- [ ] **Domaine** : Configurer le sous-domaine `votreassurance.colibripeinture.com` (Nécessite accès registrar).

---

## 🟠 Priorité Moyenne (Souhaitable pour la V1)

### 4. Améliorations Fonctionnelles
- [ ] **Détail Kit Matériel** : Afficher le détail des produits contenus dans le kit (nécessite la mise à jour des produits sur Shopify).
- [ ] **Gestion Panier** : Ajouter la possibilité de supprimer des articles directement dans le récapitulatif du panier.
- [ ] **Personnalisation Matériel** (Demande Cédric) : Afficher le contenu du matériel avant le panier et permettre de décocher individuellement chaque outil.

### 5. Design et UX
- [ ] **Vignettes Pièces** : Modifier les visuels/vignettes des types de pièces à l'étape 2.

---

## 🟢 Priorité Basse (Évolutions futures)

### 6. Fonctionnalités Avancées
- [ ] **Calcul Murs Détaillé** : Implémenter une fenêtre modale pour un calcul plus fin des surfaces murales (Note: La fonctionnalité multi-murs v1.1.0 répond partiellement à ce besoin).
- [ ] **Onboarding** : Ajouter des informations d'utilisation ou un guide de bienvenue.
- [ ] **Design** : Ajustements esthétiques globaux.

---

## 📝 Corrections Spécifiques (Demandes Cédric)

- [ ] **Tunnel de conversion** : Sur le récapitulatif panier, proposer deux options claires :
    1. Télécharger le PDF.
    2. Payer / Entrer dans le tunnel de paiement.
- [ ] **Nettoyage final** : Supprimer le lien d'accès à la boutique sur la dernière page de confirmation.

---

## ✅ Déjà réalisé / En cours (v1.1.0)
- [x] **Multi-murs** : Possibilité de rajouter un calcul des murs plus détaillé (réalisé via la gestion de 4 murs distincts).
- [x] **Calcul 2 couches** : L'algorithme v2.0 intègre déjà la marge de 5% et les 2 couches.
- [x] **Persistance des données** : Navigation fluide sans perte d'infos.
