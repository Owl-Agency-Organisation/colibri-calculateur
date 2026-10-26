# PLAN.md — Transformation Colibri Assurances → Colibri Calculateur

> Source de vérité du chantier (miroir de la page Notion "📏 Colibri Calculateur").
> Une branche par phase. Cocher les cases au fil de l'eau et committer ce fichier.
> Les règles de travail sont dans `CLAUDE.md`. Décisions finalisées le 19/07/2026.

## Décisions actées (toutes tranchées — ne pas rouvrir)

- Landing page marketing : HORS périmètre (gérée séparément).
- Routes publiques : `/calculateur/*` (remplace `/sinistre/*`).
- Page d'accueil de l'app : CONSERVÉE (structure "Bienvenue dans votre espace dédié"
  + boutons "Démarrer" / "Reprendre mon projet"), textes rebrandés sans assurance.
- Remise : 15% fixe, réelle, appliquée automatiquement par l'app (code promo injecté,
  jamais saisi ni affiché comme code). NON cumulable avec le code newsletter -10%.
- Prix : boutique Shopify = seule source de vérité, zéro prix hardcodé.
- Kit matériel : TOUT-OU-RIEN — produit Shopify unique au prix bundle, contenu
  affiché à titre informatif non modifiable, personnalisation par élément supprimée.
- Sortie du tunnel : TRIPLE issue depuis le panier —
  1. "🛒 Régler ma commande" → cart Storefront → checkout Shopify pré-rempli
  2. "🛍️ Continuer mes achats" → cart permalink boutique
     `https://www.colibripeinture.com/cart/{variantId}:{qté},...?discount={CODE}&storefront=true`
  3. "✉️ Recevoir mon estimation par e-mail" → modale → client + draft order remisé
- Formulaire d'identification : supprimé du début de tunnel, réutilisé en modale
  pour l'estimation uniquement. Klaviyo relance via tag client `calculateur`.
- Options rénovation conservées, textes reformulés hors contexte sinistre.
- Repo : RENOMMAGE `colibri-assurances` → `colibri-calculateur` (archivage préalable
  par tag + branche). Pas de nouveau repo.

---

## Phase 0 — Préparation (branche : `chore/phase-0-setup`)

- [x] Créer le tag `v1.7.5-assurances` et la branche `archive/assurances` depuis `main`
      — branche poussée le 19/07 ; ⚠️ tag créé localement mais push de tags bloqué
      par l'environnement distant : exécuter `git push origin v1.7.5-assurances`
      depuis un poste local (ou créer une release GitHub sur ce nom depuis `main`)
- [x] `.env.local.example` : retirer `COVEA_DISCOUNT_CODE`, ajouter `DISCOUNT_CODE`
      (code promo -15% `PROMO-APP-CALCULATEUR`, lu côté serveur et injecté dans `cartCreate` et le permalink)
- [x] Vérifier `pnpm install`, `pnpm type-check`, `pnpm build` passent — OK le 19/07
      (config ESLint minimale ajoutée au passage, `pnpm lint` passe aussi)
- [x] (Humain) ✅ Repo renommé `colibri-calculateur` + projet Vercel renommé,
      intégration Git vérifiée (19/07). Repo repassé en privé.
- [x] (Humain) ✅ Code promo -15% `PROMO-APP-CALCULATEUR` créé dans Shopify
      (non cumulable) + variable `DISCOUNT_CODE` posée dans Vercel
      (Production + Preview + Development) — fait le 19/07

## Phase 1 — Rebranding (branche : `feat/phase-1-rebranding`)

Renommages structurels :
- [x] `app/sinistre/*` → `app/calculateur/*` ; `app/api/sinistre/checkout` →
      `app/api/calculateur/checkout` ; mettre à jour tous les `router.push` et `Link`
- [x] `lib/store/sinistreStore.ts` → `projetStore.ts` ; type `Assure` → `Client` ;
      clés localStorage `colibri-sinistre-*` → `colibri-projet-*` (pas de migration,
      perte des brouillons acceptée)
- [x] `SINISTRE_STEPS` → `CALCULATEUR_STEPS` (`StepIndicator.tsx`, `useStepperNavigation.ts`)

Contenus :
- [x] Page d'accueil : conserver la structure (Bienvenue + Démarrer/Reprendre),
      purger textes assurance (dont l'ancienne mention de remise assureur)
      — la page "Bienvenue" (ex-`/sinistre`) devient `app/page.tsx` ; l'ancienne
      landing marketing assurance (hors périmètre) et `landing.css` sont supprimées ;
      header/footer mutualisés dans le layout racine ; `/calculateur` redirige vers `/`
- [x] `app/layout.tsx` : metadata title/description sans mention assurance
- [x] Identification : supprimer champ `assureur`, `ASSUREUR_OPTIONS`, validation,
      message "Grâce à [assureur]..." (la refonte du flux vient en Phase 4)
- [x] `lib/types.ts` : retirer `assureur?`
- [x] Tags Shopify `['covea']` → `['calculateur']` : `lib/shopify-customers.ts`,
      `app/api/shopify/customer/route.ts`, route checkout (conserver `projet-sauvegarde`)
- [x] `app/api/generate-pdf/route.ts` : textes/branding sans mention assurance
- [x] Header : baseline "Votre calculateur de peinture" (option validée le 19/07
      parmi 3 propositions) ; "Besoin d'aide ? 05 62 14 16 46" conservé
- [x] Reformuler tous les textes évoquant le sinistre dans le tunnel
- [x] Nettoyer `landing.css` / classes orphelines (supprimés avec la landing)
- [x] Doc du repo : README purgé (réécriture complète en Phase 5) ; supprimés de
      `main` : `ANALYSE_PRIX.md`, `BACKLOG.md`, `ROLLBACK.md`,
      `docs/TODO_CLIENT_FEEDBACK.md`, ADR 003 (produits offerts Covea, sans objet) —
      tout reste dans `archive/assurances` ; `ARCHITECTURE.md`, `DOCS_FINITIONS.md`
      et `docs/MULTI_MURS_FEATURE.md` conservés et reformulés
- [x] Vérification finale : `grep -rni "covea\|assureur\|assurance\|sinistre"
      app/ components/ lib/ hooks/` → 0 résultat (preuve dans la PR)
      ⚠️ Exception documentée : 7 URLs d'images CDN Shopify `ColibriAssurances_P0x_*.png`
      (choix de pièce) conservées telles quelles — décision du 19/07, renommage côté
      boutique à faire plus tard (connecteur Shopify branché sur une autre boutique)

## Phase 2 — Remise réelle 15% + prix boutique (branche : `feat/phase-2-remise`)

- [x] `lib/shopify-cart.ts` : `discountCodes: [process.env.DISCOUNT_CODE]` dans
      l'input de `cartCreate` (et lors des recréations de panier)
      — ⚠️ `createCart` était appelée **côté client** : `process.env.DISCOUNT_CODE`
      (serveur-only, pas `NEXT_PUBLIC_`) y valait `undefined`. Création du panier
      déplacée derrière la route serveur `app/api/calculateur/cart` qui appelle
      `createCart` ; le code promo est ainsi lu et injecté côté serveur, jamais exposé.
- [x] Route checkout, mode `save` : transmettre
      `appliedDiscount: { description: 'Remise calculateur', value: 15, valueType: 'PERCENTAGE' }`
- [x] Panier : supprimer TOUTES les occurrences de `DISCOUNT_FACTOR` ; prix barré =
      prix catalogue réel, prix remisé = catalogue × 0,85 ; mention
      "-15% appliqués automatiquement" + montant économisé (jamais le code affiché)
      — les montants remisés affichés proviennent de Shopify (`cost.totalAmount` par
      ligne, remise réellement appliquée), pas d'un `× 0,85` recalculé en JS, pour
      garantir l'égalité au centime près avec le checkout du même panier.
- [x] `app/api/generate-pdf/route.ts` : supprimer le fallback `PRIX_PAR_CONTENANT`
      — déjà absent : cette table de prix vivait dans `ANALYSE_PRIX.md` (supprimé en
      Phase 1). Le PDF ne source que des prix Shopify (`resultat`/`lignesPanier`) et
      n'est plus branché à aucun appelant. Aucun prix codé en dur.
- [x] `lib/shopify.ts` : `revalidate` 3600 → 900
- [x] Contrôle documenté dans la PR : total panier app = total checkout au centime près

## Phase 3 — Kits tout-ou-rien dynamiques (branche : `feat/phase-3-kits`)

- [x] `KIT_HANDLES` → `kit-peinture-petite-surface` et
      `kit-materiel-de-peinture-moyenne-et-grande-surface-1`
      — déjà corrects dans `lib/calcul/index.ts` ; vérifiés et conservés
- [x] `lib/kits-config.ts` : supprimé prix et contenu (composants) hardcodés ; le kit
      est désormais ajouté au panier comme une ligne Shopify unique au prix bundle
      (`lib/cart-mapper.ts`, `mapKitToCartLines`) ; le contenu informatif provient de
      la description du produit Shopify (`app/api/shopify/products/variants/route.ts`
      expose désormais `description`)
- [x] UI : case unique cocher/décocher (`app/calculateur/options/page.tsx`) ; contenu
      informatif non modifiable ; personnalisation par élément et bouton
      "Réinitialiser le kit" supprimés
- [x] Seuils conservés : petite surface ≤ 30 m², moyenne/grande > 30 m²
      (`determinerKit` dans `lib/kits-config.ts`)

## Phase 4 — Tunnel réordonné + triple sortie (branche : `feat/phase-4-tunnel`)

- [x] Supprimer l'étape Identification du stepper ; le tunnel démarre au choix des
      pièces ; adapter navigation et garde-fous — stepper renuméroté (6 étapes),
      guards sans `isIdentified`, accueil → `/calculateur/piece`, clés localStorage
      `CUSTOMER_ID`/`USER_DATA` supprimées (purgées via `clearProjetData`, pas de
      migration)
- [x] "🛒 Régler ma commande" : supprimer la dépendance à `CUSTOMER_ID` ;
      `buyerIdentity` optionnel (posé à la création du panier uniquement si des
      coordonnées d'estimation existent) ; redirection directe `checkoutUrl`
      (le mode `direct` de la route checkout, devenu inutile, est supprimé)
- [x] "🛍️ Continuer mes achats" : cart permalink construit par la route serveur
      `POST /api/calculateur/permalink` (extraction stricte de l'ID numérique de
      variante, fail-closed ; code promo lu côté serveur uniquement)
      — ⚠️ test réel de redirection impossible depuis l'environnement distant
      (politique réseau : colibripeinture.com bloqué) : à exécuter sur le preview,
      scénario détaillé dans la PR
- [x] "✉️ Recevoir mon estimation" : modale légère (email requis ; prénom, nom,
      téléphone optionnels ; case consentement marketing décochée par défaut +
      lien politique de confidentialité) → route serveur unique
      `POST /api/calculateur/estimation` (rate limitée par IP) : client tag
      `calculateur` (consentement single opt-in si coché) → draft order remisé
      15% → email invoice → écran de confirmation réécrit
- [x] Réutiliser la validation email/téléphone existante (`lib/utils`) — modale
      côté client ET revalidation serveur dans la route estimation
- [x] Supprimer le code mort de l'ancienne étape identification —
      `app/calculateur/identification/`, `app/api/shopify/customer/`,
      `app/api/calculateur/checkout/`, `updateCartBuyerIdentity`, et
      `app/api/generate-pdf/` (flux PDF sans appelant, confirmé mort)
- [x] (Ajout validé le 23/07) Tooltip finition informatif sur Surfaces et
      Récapitulatif : règle factuelle (velours pièces de vie/chambres, satin
      pièces d'eau, mat plafonds sauf salle de bains), renvoi au 05 62 14 16 46,
      aucune promesse de personnalisation
- [x] (Évolution 23/07, branche `feat/klaviyo-event`) Événement Klaviyo
      `Estimation calculateur demandée` envoyé par la route estimation après
      création du draft order : relances déclenchées sur événement (et non sur
      l'appartenance à une liste), `invoice_url` transportée comme lien de
      finalisation. Fail-soft absolu (timeout 5 s, log seul en cas d'échec),
      clé `KLAVIYO_PRIVATE_API_KEY` serveur uniquement, envoi ignoré avec
      warning si la clé est absente (previews sans clé fonctionnels)

## Phase 5 — Qualité & mise en prod (branche : `test/phase-5-qualite`)

- [x] Installer Vitest (seule dépendance autorisée de cette phase) + script `pnpm test`
- [x] Tests `lib/calcul` : `calculerLitresNecessaires` (2 couches),
      `optimiserContenants`, `determinerTypeSousCouche`, `calculerPrixTotal` —
      dont le cas "même contenance, finitions différentes → prix différents"
      ET le cas "produit disposant des deux gammes (Biosourcée + Dépolluante,
      même contenance+finition) → la variante retenue est Biosourcée, prix conforme"
      (`selectionnerVariantGammeStandard`, verrou ajouté en Phase 2)
      — 37 tests (`lib/calcul/index.test.ts`, `lib/cart-mapper.test.ts`), plus
      `agregerSurfacesParCouleur` (exportée pour test, invariant couleur+finition),
      verrou `selectionnerVariantKit` (kit à variant unique, anomalie loggée si la
      boutique en ajoutait un, partagé entre prix et panier), verrou de gamme côté
      panier (`mapCalculToCartLines`)
- [x] Ajouter `pnpm test` au CI (`.github/workflows/ci.yml`)
- [x] Fournir la matrice de recette manuelle (checklist) :
      {1 pièce, multi-pièces, multi-murs, ±kit, ±rénovation} ×
      {commande directe, continuer achats, estimation email} — dans la PR Phase 5
- [x] Domaine `calculateur.colibripeinture.com` (confirmé) : `metadataBase`,
      title/description, Open Graph et Twitter card posés ; aucune URL de preview
      en dur (vérifié par grep) — la bascule DNS + domaine Vercel reste à faire
      côté humain
- [x] `README.md` réécrit (calculateur public, plus aucune mention assurance)
- [x] (Ajout validé le 23/07) Événements analytics de parcours (Vercel Analytics,
      anonymes) : `calcul_demarre`, `piece_validee`, `surfaces_saisies`,
      `options_validees`, `panier_atteint`, `sortie_choisie`
      (checkout / permalink / estimation)
- [x] (Évolution 23/07, branche `feat/optimisation-contenants`) Optimisation des
      contenants par le prix : composition la moins chère couvrant le besoin
      (énumération exacte), garde-fou pots (plafond dur : 3 pots max du plus
      petit format disponible), justification à l'écran uniquement quand la
      composition retenue est réellement moins chère, repli glouton sans prix.
      Voie de sélection de variante unifiée (`selectionnerVariantContenance`)
      entre table de prix, prix affiché et ligne panier — zéro divergence
      possible. 25 tests ajoutés, les 37 existants inchangés

## Mode embed — iframe Shopify (branche : `claude/embed-mode-shopify-iframe-beafaz`)

> Décision (27/07) : l'app est intégrée en **iframe cross-origin** dans la page
> Shopify https://www.colibripeinture.com/pages/configurateur, qui devient l'**URL
> canonique** du calculateur (cible de tous les CTA — landing, e-mails Klaviyo).
> `calculateur.colibripeinture.com` n'est plus qu'un hôte technique servant
> l'iframe. Le listener postMessage (resize, scrollTop, redirect) est **déjà
> déployé** côté page Shopify : contrat de messages figé.

- [x] Chrome de l'app supprimé (`app/layout.tsx`) : header (logo, baseline, bloc
      téléphone) et footer (crédit) — le chrome est celui du site Shopify ;
      corrige le header `sticky` qui recouvrait le contenu au scroll dans
      l'iframe ; `min-h-screen` et paddings ajustés pour que la hauteur du
      document colle au contenu réel (pré-requis de l'auto-resize) ; la ligne
      d'assistance existante dans le contenu de l'app reste telle quelle
- [x] `SITE_URL` → `https://www.colibripeinture.com/pages/configurateur`
      (metadataBase + OpenGraph) ; `robots: { index: false, follow: true }`
- [x] Script inline bloquant dans le `<head>` : accès direct à
      `calculateur.colibripeinture.com` hors iframe → redirection vers la page
      canonique (garde sur hostname : les previews Vercel ne redirigent pas)
- [x] `lib/navigation.ts` — `redirectTop(url)` : navigation top-level
      (`window.top.location.href` sous user activation, secours postMessage
      `colibri:redirect` + repli local différé)
- [x] Sorties du tunnel (`panier`) : « 🛒 Régler ma commande » (checkout) et
      « 🛍️ Continuer mes achats » (permalink) passent par `redirectTop()` — le
      checkout Shopify refuse l'iframe (`frame-ancestors`) et le permalink
      chargeait le site entier imbriqué dans lui-même
- [x] `components/EmbedBridge.tsx`, monté dans le layout racine (retour de
      review : couvre toutes les routes, écran d'entrée compris — sinon un
      retour navigateur vers `/` démontait le bridge et figeait l'iframe à la
      dernière hauteur du tunnel) : `colibri:resize` (ResizeObserver du
      document, throttle rAF, seuil de variation 2 px anti-boucle, plancher
      300 px, première émission au montage) et `colibri:scrollTop` à chaque
      changement de route — le tout premier après montage est sauté, quel que
      soit le point d'entrée (pas de saut de la page Shopify sur l'iframe au
      chargement) — origine cible `https://www.colibripeinture.com`, jamais `*`
- [x] `EstimationModal` : lien politique de confidentialité déjà en
      `target="_blank" rel="noopener noreferrer"` (vérifié, aucun changement)

## Simulateur : pont (branche : `feat/simulateur-pont`)

> Décision (15/10) : le simulateur Wizart (Deployment Kit) est relié au
> configurateur dans les deux sens — page Simulateur du site → configurateur
> (pièce + teintes) et popup couleur → simulateur en surimpression (retour des
> teintes choisies). Wizart renvoie le handle Shopify de la teinte. Aucune
> logique dans le thème : script hébergé `/embed/colibri.js`, appelé en deux
> lignes par les pages Shopify. Merge sans effet visible : tant que la page
> n'annonce pas `colibri:parent:pret`, l'app n'affiche aucune entrée simulateur.

- [x] Contrat de messages typé et documenté (`lib/embed-messages.ts`) :
      `colibri:simulateur:ouvrir` (app → page), `colibri:simulateur:selection`,
      `colibri:simulateur:ferme`, `colibri:parent:pret` (page → app) ; contrat
      historique (`resize`, `scrollTop`, `redirect`) inchangé ; origines
      vérifiées dans les deux sens, jamais `*`
- [x] Tâche 1 — teintes essayées (`lib/store/teintesEssayees.ts`, clé
      `colibri-projet-teintes-essayees`, purgée par `clearProjetData`) ;
      construction d'une `Couleur` extraite de la popup (`lib/couleur.ts`),
      handle inconnu ignoré et signalé en console
- [x] Tâche 2 — écran d'arrivée `/calculateur/simulateur?piece=…&teintes=…`
      (sans projet / avec projet en cours / nouveau projet), page Surfaces
      pré-remplie (un mur par teinte, 4 max, finition de la pièce, bandeau
      « Teintes reprises du simulateur »)
- [x] Tâche 3 — popup couleur : bloc « Vos teintes essayées » (murs et
      plafond) ; murs + capacité `simulateur` : bandeau « Vous hésitez ? » et
      lien « Voir dans ma pièce », attente, une teinte posée directement,
      plusieurs teintes au choix, fermeture sans perte de saisie
- [x] Tâche 4 — récapitulatif : « Visualiser une autre pièce dans le
      simulateur » (capacité `simulateur` uniquement)
- [x] Tâche 5 — script hébergé `/embed/colibri.js` (modes `configurateur`,
      `simulateur`, `bouton`), logique pure testée, `docs/EMBED_SHOPIFY.md`
      (blocs, bascule, retour arrière)
- [x] Tâche 6 — page de test `/labo/pont` (preview uniquement, `noindex`) :
      vrai script, faux `WizartDeploymentKit`, liens d'entrée, journal
- [ ] Mise en ligne (Philippe) : page Shopify masquée de test, bascule du bloc
      de `/pages/configurateur`, puis après signature Wizart : token Vercel
      (Production), page Simulateur, bloc fiche teinte, tests réels
- [x] Vérifié au premier test avec le vrai simulateur (16/10, DepKit v1.1.3,
      catalogue réel de 41 teintes, token en Preview) — branche
      `fix/simulateur-sortie-panier` :
      - `CHECKOUT_OPTIONS_OPEN` ne ferme rien trop tôt : au clic sur
        « Calculer mes quantités », `OPEN_IN_STORE` (`open_in_store`) est
        toujours émis en premier et déclenche déjà la sortie ;
        `CHECKOUT_OPTIONS_OPEN` n'arrive qu'après (et seulement si au moins deux
        modes de checkout sont activés dans le PIM). Seul `OPEN_IN_STORE` est
        désormais écouté comme sortie
      - forme réelle du panier : tableaux parallèles dans `OPEN_IN_STORE.data`
        (`article_sku` = `vendor_code` du PIM = handle Shopify, à défaut
        `article_custom_sku`) ; `getShoppingCartState()` ne répond pas en
        v1.1.3 (délai de 5 s dépassé à chaque fois) : appel supprimé, teintes
        lues directement dans l'événement, fermeture sans attente. Charge réelle
        en fixture (`embed/fixtures/wizart-open-in-store.json`)
      - redirection PIM : avec un seul mode de checkout (« Website checkout »
        seul), Wizart ouvre un nouvel onglet vers le lien configuré en plus de
        notre sortie ; le PIM refuse de n'en activer aucun. Configuration
        retenue : deux modes activés (« Website checkout » et « Email
        checkout ») — Wizart affiche alors un menu de choix au lieu d'ouvrir un
        onglet, et le script ferme le simulateur dès `OPEN_IN_STORE`, avant que
        ce menu soit visible

## Simulateur : barre Colibri, sans panier Wizart (branche : `feat/simulateur-barre-colibri`)

> Décision (16/10, après le test utilisateur sur le vrai site) : Wizart ne sert
> plus qu'à visualiser. Les teintes appliquées sur les murs (`PRODUCT_APPLY`)
> sont retenues par une barre Colibri toujours visible en bas du simulateur,
> seule sortie (« Fermer » / « Utiliser… »). Le panier Wizart sera désactivé
> dans le PIM après le merge. Remplace la PR #45 (fermée sans merge).

- [x] Surimpression et page Simulateur : zone Wizart en `FILL_PARENT` au-dessus
      de la barre, `showBackToWebsiteButton: false`, `locale: 'fr'`,
      `openWithProduct` conservé ; un seul « Fermer » (barre), l'écran de
      chargement garde le sien
- [x] Teintes retenues via `PRODUCT_APPLY` (ordre d'application, réappliquée
      en dernier, liste vide à chaque ouverture, nettoyage sans effet) ;
      `OPEN_IN_STORE` n'est plus une sortie, `BACK_BUTTON_CLICK` ferme
- [x] Barre Colibri aux valeurs de la maquette (desktop et mobile < 640 px,
      accessibilité) ; couleurs des pastilles via `GET /api/embed/teintes`
      (CORS boutique + app, cache court, nom seul en cas d'échec)
- [x] Rendu du script isolé en Shadow DOM (page Simulateur, surimpression,
      barre, bouton de fiche teinte) ; la zone Wizart reste dans le document,
      projetée par `slot`
- [x] Page Simulateur fidèle à la maquette (en-tête + `data-visuel`, 7 cartes
      pièces, 3 étapes, conseil photo) ; images et libellés des pièces partagés
      avec l'étape « Pièce » (`lib/pieces.ts`, vérifié par test)
- [x] Popup couleur : la dernière teinte de la sélection est posée sur le mur,
      toutes rejoignent « Vos teintes essayées », bandeau de confirmation sur
      la page Surfaces ; contrat `colibri:simulateur:selection` mis à jour
      (ordre d'application, dernière = plus récente)
- [x] Labo `/labo/pont` : faux simulateur sans panier, émet `PRODUCT_APPLY`,
      affiché dans la vraie surimpression avec la vraie barre
- [x] Tests (PRODUCT_APPLY réel en fixture, ordre, libellés, dernière teinte,
      endpoint) et `docs/EMBED_SHOPIFY.md` (sortie, `data-visuel`, panier PIM)
- [ ] Mise en ligne (Philippe) : désactiver le panier Wizart dans le PIM
      (Configuration → Web → « Shopping cart »), renseigner `data-visuel` sur
      `/pages/simulateur`, test de bout en bout avec le vrai simulateur

## Simulateur : intérieur du type de pièce (branche : `feat/simulateur-interieur-piece`)

> Constat (16/10, vrai DepKit, compte Colibri) : la galerie Wizart (11
> intérieurs) ne se filtre pas par type de pièce ; `sceneData.openInRoom`
> (`room_uuid`) ouvre directement un intérieur, se combine avec
> `openWithProduct`, et un UUID inconnu retombe sur la galerie sans erreur.

- [x] Correspondance type de pièce → intérieur Wizart (`openInRoom`), prévue
      après la signature : vérifiée avec le vrai DepKit le 16/10 et appliquée
      (table `INTERIEURS_WIZART` de `embed/colibri.js`, testée)
- [x] Les deux entrées transmettent la pièce : carte de la page Simulateur et
      `colibri:simulateur:ouvrir` de l'app (contrat de messages inchangé)
- [x] Labo `/labo/pont` : intérieur demandé affiché, boutons d'ouverture par
      pièce comme la popup couleur
- [ ] Pas d'intérieur adapté pour **entrée** et **couloir** : galerie complète
      (à revoir si Wizart ajoute des intérieurs de ces types au compte)

## Simulateur : arrivée sur un mur (branche : `feat/simulateur-arrivee-un-mur`)

> Décision (Philippe, 21/10) : à l'arrivée depuis le simulateur, l'app crée
> **un seul mur, avec la dernière teinte appliquée** ; toutes les teintes de la
> session rejoignent « Vos teintes essayées » (12 au plus, la plus récente en
> tête), d'où le client les pose sur les murs qu'il ajoute — comme au retour
> depuis la popup couleur. Motif : au test du 21/10 (4 teintes essayées, 2
> gardées), l'app créait 4 murs. Wizart n'expose pas l'état de la scène :
> `PRODUCT_APPLY` ne porte que la teinte appliquée (aucun identifiant de mur),
> `CLEAR_SURFACE` arrive vide, `SURFACE_SELECT` ne dit que `surface: "wall"`.
> Question posée à Wizart le 21/10 (état de la scène exposable ?).

- [x] Arrivée : un mur avec la dernière teinte (`couleursMurArrivee`), toutes
      les teintes dans le bloc dans l'ordre d'application
      (`ajouterSelectionSimulateur`) ; `MAX_TEINTES_ARRIVEE` supprimé
- [x] Écran « Votre sélection du simulateur » : dernière teinte « Posée sur le
      mur 1 », autres sous « Vos teintes essayées » ; bandeau de la page
      Surfaces adapté (plusieurs teintes)
- [x] Script : `data-configurateur` (pages de test, mode `simulateur`) pour
      sortir vers `/pages/test-configurateur` et rester sur l'app du preview
- [x] Labo `/labo/pont` : scénarios d'arrivée avec résultat attendu
- [ ] Pages de test Shopify : ajouter `data-configurateur="/pages/test-configurateur"`
      au bloc de `/pages/test-simulateur`, puis test de bout en bout
- [ ] Réponse de Wizart sur l'état de la scène (si exposé : revoir la création
      des murs)

## Simulateur : papiers peints (branche : `claude/papiers-peints-simulateur-jxsk35`)

> Décision (Philippe, 21/10) : les **papiers peints Colibri** entrent dans le
> simulateur avant l'ouverture publique. Peinture et papier peint comptent pour
> une seule surface Wizart (les murs) : rien à changer côté abonnement. Colibri
> fabrique ses papiers peints et fournit les fichiers (motif raccordable,
> largeur du lé, raccord) ; Owl prépare les textures.
> **Identifiant** : référence Wizart d'un papier peint = **SKU de sa variante
> « Lé »** (`unique_sku_id` → `article_sku`), par ex. `pp-montg-terracotta-le`
> (12 références : 3 motifs × 4 coloris). Une référence reçue du simulateur est
> soit un handle de teinte, soit un SKU de papier peint ; la distinction se fait
> côté serveur de l'app (Admin API : la Storefront API ne cherche pas par SKU),
> jamais dans le script. Contrat `colibri:simulateur:*` inchangé.
> **Règle produit** : un papier peint **ne se calcule pas** (ni calcul, ni prix,
> ni remise, ni checkout, ni kit) ; il s'affiche avec un lien vers sa fiche
> boutique, où le client le commande.

- [x] Export WALLPAPER : une ligne par variante « Lé » (12), largeur du lé
      depuis l'option « Taille », raccord depuis `scripts/wizart/papiers-peints.json`,
      `--textures` ; `repeat_width` = largeur du motif importé (doc Wizart)
- [x] `/api/embed/teintes` : `{ handle, nom, hex, type, image, lien }` ; barre :
      vignette ronde de l'image pour un papier peint
- [x] App : résolution par SKU (`lib/papierPeint.ts`, `/api/shopify/papier-peint/{sku}`)
      dans le catalogue des papiers peints en cache serveur (une requête Admin,
      10 minutes ; aucun appel par référence reçue),
      tri des références, stockage `colibri-projet-papiers-peints-essayes` (12 au
      plus, purgé avec le projet)
- [x] Écran d'arrivée (bloc « Papier peint essayé »), mur avec la dernière
      **peinture** (sans couleur si papiers peints seuls, bandeau Surfaces),
      popup couleur (ligne « Papier peint essayé »), récapitulatif (« Papiers
      peints essayés dans le simulateur ») ; « Voir la fiche » en nouvel onglet
- [x] Bouton des fiches papier peint : `data-variantes` (SKU de la variante de
      `?variant=`), bloc Liquid documenté
- [x] Labo `/labo/pont` : deux papiers peints réels résolus par la vraie route
- [x] `scripts/wizart/papiers-peints.json` renseigné (fichiers Colibri du
      22/10 : motif utile 53 × 64 cm, raccord droit) ; textures préparées hors
      repo (3180 × 3840 px, `{sku}.png`)
- [x] Largeur des lés confirmée par Colibri le 22/10 : 53 cm pour les trois
      papiers peints, option « Taille » corrigée en boutique (« Lé : 53x280cm ») ;
      `product_width` reste lu dans cette option
- [x] Export aux 35 colonnes du mapping « default » Wallpaper (toutes
      présentes, même vides : `wallpaper_roll_length` depuis l'option
      « Taille », `reverse`/`mural` `no`, `product_layout` `vertical`,
      `application_surface` `wall`) ; 12 références importées dans le PIM le
      22/10 (12/12)
- [x] Test avec le vrai simulateur sur les pages de test Shopify (22/10) :
      rendu sur les murs, vignette, arrivée, « Voir la fiche », récapitulatif,
      popup avec un papier peint seul
- [x] Barre du simulateur : libellés pour teintes et papiers peints (« Vos
      essais », « Utiliser mon choix → » / « Utiliser mes choix (n) → »)
- [ ] Shopify : bloc Liquid des fiches papier peint
      (`docs/EMBED_SHOPIFY.md`, section 3)

## Simulateur : retours de Colibri du 23/10, lot v1 (branche : `feat/simulateur-retours-v1`)

> Test du simulateur par Colibri le 23/10/2026. Ce lot traite trois demandes :
> une barre aux couleurs du site, un retour à la boutique accessible à toutes
> les étapes (« Fermer » n'était pas compris) et l'accès direct au
> téléversement de photo dès le choix de la pièce. Le téléversement reste
> ouvert à tous (`uploadPhoto` jamais passé, valeur par défaut du DepKit).

- [x] Barre aux couleurs du site : fond `#F5F5F5`, texte `#13302a`, séparation
      `#e3e2dc`, logo du site sans fond (CDN Shopify), pastilles blanches,
      « Utiliser… » foncé, contrastes AA ; logo masqué sous 640 px
- [x] « Fermer » devient « ← Retour à la boutique » (page Simulateur) ou
      « ← Retour au calculateur » (popup couleur), écran d'attente compris ;
      bouton retour de Wizart affiché (`showBackToWebsiteButton: true`) ;
      surimpression « Simulateur Colibri »
- [x] Page Simulateur : étape « Comment voulez-vous essayer ? » (« Sur ma
      photo » : galerie Wizart ; « Dans une pièce d'exemple » : `openInRoom`) ;
      textes teintes et papiers peints, sans le réglage de la lumière (arrêté
      par Wizart le 1er novembre)
- [x] Labo `/labo/pont` : réglages reçus par le faux DepKit affichés
- [ ] Parcours avec le vrai simulateur sur les pages de test Shopify
      (ordinateur et mobile)

Retours du 23/10 hors de ce lot :

- [ ] **Chez Wizart** : catalogue séparé Peinture / Papier peint, navigation
      des couleurs, libellé de l'icône Historique
- [ ] **Version suivante** : connexion obligatoire pour utiliser sa photo,
      points de fidélité
