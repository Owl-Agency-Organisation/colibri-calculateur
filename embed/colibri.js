/*
 * Colibri — script d'intégration des pages Shopify.
 *
 * Servi par l'app sous `/embed/colibri.js` (app/embed/colibri.js/route.ts) avec
 * sa configuration injectée (origine de l'app = origine du script, token
 * Wizart, ID GA4). Aucune logique dans le thème Shopify : chaque page appelle ce script
 * en deux lignes (docs/EMBED_SHOPIFY.md). Mode lu sur `data-colibri` :
 *
 * - `configurateur` : iframe de l'app (hauteur, retour en haut, redirections —
 *   comportement historique inchangé), entrée depuis le simulateur, annonce des
 *   capacités, simulateur Wizart en surimpression à la demande de l'app ;
 * - `simulateur` : page Simulateur (en-tête, « Quelle pièce ? », étapes,
 *   conseil photo, simulateur plein écran, retour vers le configurateur) ;
 * - `bouton` : bouton « Voir dans ma pièce » d'une fiche teinte ou papier peint.
 *
 * Wizart ne sert qu'à visualiser : les produits appliqués sur les murs
 * (`PRODUCT_APPLY`) sont retenus par la barre Colibri, seule sortie du
 * simulateur avec le bouton retour de Wizart (« ← Retour à la boutique » /
 * « ← Retour au calculateur », « Utiliser… »). Le panier Wizart n'est pas
 * utilisé.
 * Une référence est un handle de teinte ou le SKU d'une variante papier peint
 * (`pp-montg-terracotta-le`) : le script ne les distingue pas, l'app le fait
 * (`/api/embed/teintes` renvoie le type de chaque référence).
 *
 * Tout le rendu est isolé dans un Shadow DOM : les styles du thème ne
 * l'atteignent pas (la police reste héritée du site).
 *
 * Mesure GA4 : le script envoie les événements du simulateur et relaie ceux
 * du calculateur (`colibri:mesure`) avec le `gtag` déjà chargé par la page,
 * vers l'ID GA4 de la configuration (`creerMesure`). Il ne charge rien et ne
 * touche jamais au consentement (Consent Mode de la boutique). Aucune donnée
 * personnelle : valeurs d'une liste fermée, références produit et nombres.
 *
 * Contrat de messages : lib/embed-messages.ts. Sans dépendance ; la logique
 * pure est exportée pour les tests (embed/colibri.test.ts) quand le fichier est
 * chargé comme module CommonJS.
 */
(function (racine, fabrique) {
  'use strict';
  var colibri = fabrique();
  if (typeof module === 'object' && module && module.exports) {
    module.exports = colibri;
    return;
  }
  // Remplacé par la configuration au moment de servir le script
  colibri.demarrer(racine, __COLIBRI_CONFIG__);
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  // ===================== Constantes =====================

  // Mêmes types, libellés et images que l'app (lib/pieces.ts — vérifié par test)
  var CDN_PIECES = 'https://cdn.shopify.com/s/files/1/0971/0436/3865/files/';
  var PIECES = [
    ['piece-de-vie', 'Pièce de vie', CDN_PIECES + 'ColibriAssurances_P01_vie.png?v=1769015678'],
    ['chambre', 'Chambre', CDN_PIECES + 'ColibriAssurances_P02_chambre.png?v=1769015679'],
    ['cuisine', 'Cuisine', CDN_PIECES + 'ColibriAssurances_P03_cuisine.png?v=1769015679'],
    ['salle-de-bain', 'Salle de bain', CDN_PIECES + 'ColibriAssurances_P04_salledebain.png?v=1769015678'],
    ['toilettes', 'Toilettes', CDN_PIECES + 'ColibriAssurances_P05_toilettes.png?v=1769015679'],
    ['entree', 'Entrée', CDN_PIECES + 'ColibriAssurances_P06_entree.png?v=1769015680'],
    ['couloir', 'Couloir', CDN_PIECES + 'ColibriAssurances_P07_couloir.png?v=1769015679'],
  ];

  /**
   * Intérieur d'exemple Wizart ouvert pour chaque type de pièce
   * (`sceneData.openInRoom`, transmis à Wizart en `room_uuid`) : le client
   * arrive directement dans une pièce du bon type et garde « Changer
   * l'intérieur » pour revenir à la galerie et à sa propre photo. La galerie
   * Wizart ne se filtre pas par type de pièce : c'est le seul moyen.
   * UUID relevés le 16/10/2026 sur le compte Colibri, dans la réponse de
   * `rni.wizart.ai/api/rooms` (champs `uuid`, `room_type_title`). Si un
   * intérieur disparaît ou change d'UUID, Wizart s'ouvre simplement sur la
   * galerie, sans erreur. `null` : aucun intérieur adapté → galerie.
   * Toutes les clés de PIECES, et seulement elles (vérifié par test).
   */
  var INTERIEURS_WIZART = {
    'piece-de-vie': '0ccc39c1-6379-4070-934d-f7459ce15247', // Wizart_012, salon, 3 murs
    'chambre': '1103ea18-8a07-4f59-a1d3-86d08b406755', // Wizart_017, chambre adulte, 2 murs
    'cuisine': 'fe9bfc03-6fe5-403d-a6a1-5feb5c71c10c', // Wizart_018, cuisine avec mur dégagé
    'salle-de-bain': '00bb8d0e-5dcc-4893-93bc-d4b1b79ae60f', // Wizart GO-6041 2, salle de bain avec WC
    'toilettes': '00bb8d0e-5dcc-4893-93bc-d4b1b79ae60f', // le même : seul intérieur avec WC
    'entree': null,
    'couloir': null,
  };

  var CAPACITE_SIMULATEUR = 'simulateur';
  var MAX_TEINTES = 50;
  var MAX_LONGUEUR_HANDLE = 255;
  var MOTIF_HANDLE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  var MOTIF_HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
  // Identifiant numérique d'une variante Shopify (`?variant=` des fiches)
  var MOTIF_ID_VARIANTE = /^[0-9]{1,20}$/;
  var TYPE_PAPIER_PEINT = 'papier-peint';

  // Pièce choisie sur la page Simulateur, relue au retour du PIM Wizart
  // (redirection vers le configurateur avec `vendorCode[]`)
  var CLE_SESSION_PIECE = 'colibri-simulateur-piece';

  var CHEMIN_CONFIGURATEUR = '/pages/configurateur';
  // Chemin absolu du site : `/` suivi de caractères d'URL sûrs (jamais `//`)
  var MOTIF_CHEMIN_SITE = /^\/(?!\/)[A-Za-z0-9\-._~\/]*$/;
  var CHEMIN_SIMULATEUR = '/pages/simulateur';
  var CHEMIN_ARRIVEE_APP = '/calculateur/simulateur';
  var CHEMIN_API_TEINTES = '/api/embed/teintes';
  // Logo du site, sans fond (PNG transparent 610 × 150 px, servi à 244 px de
  // large par le CDN Shopify), affiché tel quel sur le fond clair de la barre
  var LOGO_COLIBRI = 'https://cdn.shopify.com/s/files/1/0971/0436/3865/files/'
    + 'logo-colibri-lettre-ligne-gris_c069846e-2280-4484-94fa-c0a82abf361a.png?v=1773400972&width=244';

  // Ouverture de Wizart. Page Simulateur : sur sa galerie (ESSAI_PHOTO), où
  // « Télécharger votre photo » vient en premier, les pièces d'exemple à côté.
  // Popup couleur du calculateur : dans la pièce d'exemple du type de pièce
  // (ESSAI_EXEMPLE), galerie s'il n'y en a pas.
  var ESSAI_PHOTO = 'photo';
  var ESSAI_EXEMPLE = 'exemple';

  // Destination du bouton de retour de la barre, selon la page d'origine
  var RETOUR_BOUTIQUE = 'boutique';
  var RETOUR_CALCULATEUR = 'calculateur';

  // Version unique du DepKit : s'il ne charge pas, le simulateur se ferme
  var SCRIPT_DEPKIT = 'https://d18jpdcj6p6zg6.cloudfront.net/wizart-deployment-kit-v1.1.3.min.js';
  var DELAI_SCRIPT_MS = 15000;

  // Événements Wizart écoutés : application d'une teinte, retour (sécurité)
  var EVENEMENT_APPLICATION = 'PRODUCT_APPLY';
  var EVENEMENT_RETOUR = 'BACK_BUTTON_CLICK';
  // … et pour la mesure GA4 seulement : photo importée, pièce d'exemple choisie
  // (clés de `VISUALIZER_EVENTS` du DepKit v1.1.3, relevées dans son code)
  var EVENEMENT_PHOTO = 'CUSTOM_INTERIOR_UPLOAD';
  var EVENEMENT_EXEMPLE = 'PREDEFINED_INTERIOR_SELECT';

  // ----- Mesure GA4 (événements envoyés avec le `gtag` de la page) -----

  var MOTIF_ID_GA4 = /^G-[A-Z0-9]{4,20}$/;
  // Simulateur ouvert pendant la session de navigation, mode debug mémorisé
  var CLE_SESSION_SIMULATEUR_OUVERT = 'colibri-mesure-simulateur';
  var CLE_SESSION_DEBUG = 'colibri-mesure-debug';
  // Pages Shopify de test : trafic interne (filtre de trafic interne de GA4)
  var PREFIXE_PAGES_TEST = '/pages/test-';
  // Limite GA4 de la valeur d'un paramètre
  var MAX_LONGUEUR_PARAMETRE = 100;
  // Une référence dont le type n'arrive pas à temps part sans `type_produit`
  var DELAI_TYPE_PRODUIT_MS = 4000;

  // Origine de l'ouverture du simulateur
  var ORIGINE_PAGE_SIMULATEUR = 'page_simulateur';
  var ORIGINE_CALCULATEUR = 'calculateur';
  var ORIGINE_FICHE_PRODUIT = 'fiche_produit';

  // Fermeture sans choix : bouton de la barre, bouton retour de Wizart, écran
  // de chargement (ou simulateur impossible à charger)
  var SORTIE_BARRE = 'barre';
  var SORTIE_WIZART = 'wizart';
  var SORTIE_CHARGEMENT = 'chargement';

  /**
   * Événements du calculateur relayés depuis l'app (`colibri:mesure`) : liste
   * blanche des noms, des clés et du type de chaque paramètre. Même table que
   * `SCHEMA_MESURES` de lib/embed-messages.ts (vérifié par test).
   */
  var MESURES_CALCULATEUR = {
    configurateur_demarre: { arrivee: 'chaine' },
    configurateur_selection_simulateur: { nb_teintes: 'nombre' },
    configurateur_piece_validee: { type_piece: 'chaine' },
    configurateur_surfaces_saisies: { nombre_murs: 'nombre' },
    configurateur_options_validees: { kit: 'chaine', renovation: 'chaine' },
    configurateur_panier_atteint: {},
    configurateur_sortie: { sortie: 'chaine' },
  };

  // ===================== Logique pure (testée) =====================

  function estObjet(valeur) {
    return typeof valeur === 'object' && valeur !== null;
  }

  function estTypePiece(valeur) {
    if (typeof valeur !== 'string') return false;
    for (var i = 0; i < PIECES.length; i++) {
      if (PIECES[i][0] === valeur) return true;
    }
    return false;
  }

  function estHandle(valeur) {
    return typeof valeur === 'string'
      && valeur.length <= MAX_LONGUEUR_HANDLE
      && MOTIF_HANDLE.test(valeur);
  }

  /** Handle normalisé (casse, espaces) ou null s'il est invalide. */
  function lireHandle(valeur) {
    var handle = typeof valeur === 'string' ? valeur.trim().toLowerCase() : null;
    return estHandle(handle) ? handle : null;
  }

  /** Handles valides, dans l'ordre, sans doublon. */
  function normaliserTeintes(valeurs) {
    var teintes = [];
    if (!Array.isArray(valeurs)) return teintes;
    for (var i = 0; i < valeurs.length && teintes.length < MAX_TEINTES; i++) {
      var v = typeof valeurs[i] === 'string' ? valeurs[i].trim().toLowerCase() : valeurs[i];
      if (estHandle(v) && teintes.indexOf(v) === -1) teintes.push(v);
    }
    return teintes;
  }

  /**
   * Entrée du configurateur depuis le simulateur. Deux formes :
   * - `?piece={type}&teintes={h1},{h2}` (page Simulateur) ;
   * - `?vendorCode[]={h1}&vendorCode[]={h2}` (redirection du PIM Wizart), la
   *   pièce étant celle mémorisée en sessionStorage.
   * Retourne null si l'entrée est absente ou invalide.
   */
  function lireEntreeConfigurateur(recherche, pieceSession) {
    var params = new URLSearchParams(recherche || '');
    var piece = params.get('piece');
    if (estTypePiece(piece) && params.has('teintes')) {
      var teintes = normaliserTeintes((params.get('teintes') || '').split(','));
      return teintes.length > 0 ? { piece: piece, teintes: teintes } : null;
    }
    var codes = params.getAll('vendorCode[]').concat(params.getAll('vendorCode'));
    if (codes.length > 0 && estTypePiece(pieceSession)) {
      var depuisPim = normaliserTeintes(codes);
      return depuisPim.length > 0 ? { piece: pieceSession, teintes: depuisPim } : null;
    }
    return null;
  }

  /** Chemin chargé par l'iframe : racine de l'app, ou écran d'arrivée. */
  function cheminIframe(entree) {
    if (!entree) return '/';
    return CHEMIN_ARRIVEE_APP
      + '?piece=' + encodeURIComponent(entree.piece)
      + '&teintes=' + entree.teintes.map(encodeURIComponent).join(',');
  }

  /** Recherche de l'URL sans les paramètres d'entrée (déjà consommés). */
  function rechercheSansEntree(recherche) {
    var params = new URLSearchParams(recherche || '');
    ['piece', 'teintes', 'vendorCode[]', 'vendorCode'].forEach(function (cle) { params.delete(cle); });
    var reste = params.toString();
    return reste ? '?' + reste : '';
  }

  /**
   * Chemin du configurateur de la page Simulateur : attribut
   * `data-configurateur` de la balise du script (pages de test Shopify, pour
   * rester sur l'app du même preview), sinon `/pages/configurateur`. Seul un
   * chemin absolu du site est accepté ; toute autre valeur est signalée
   * (`avertir`) et le chemin par défaut s'applique.
   */
  function cheminConfigurateur(valeur, avertir) {
    if (valeur === null || valeur === undefined) return CHEMIN_CONFIGURATEUR;
    if (typeof valeur === 'string' && MOTIF_CHEMIN_SITE.test(valeur)) return valeur;
    if (avertir) {
      avertir('[Colibri] data-configurateur ignoré (chemin absolu du site attendu, ex. /pages/test-configurateur) :', valeur);
    }
    return CHEMIN_CONFIGURATEUR;
  }

  /**
   * URL du configurateur à la sortie de la page Simulateur : teintes dans
   * l'ordre d'application (la dernière est la plus récente).
   */
  function urlConfigurateur(origineBoutique, piece, teintes, chemin) {
    return origineBoutique + (chemin || CHEMIN_CONFIGURATEUR)
      + '?piece=' + encodeURIComponent(piece)
      + '&teintes=' + teintes.map(encodeURIComponent).join(',');
  }

  /** Lien du bouton « Voir dans ma pièce » d'une fiche teinte. */
  function urlSimulateurTeinte(handle) {
    return CHEMIN_SIMULATEUR + '?teinte=' + encodeURIComponent(handle);
  }

  /**
   * Table `data-variantes` d'une fiche papier peint, rendue par Liquid :
   * JSON `{ "{id variante}": "{sku}" }` (variantes « Lé » seulement). Entrées
   * invalides ignorées ; attribut absent : table vide ; JSON illisible : table
   * vide, signalé (`avertir`).
   */
  function lireVariantes(valeur, avertir) {
    var table = {};
    if (valeur === null || valeur === undefined) return table;
    var donnees = null;
    try {
      donnees = JSON.parse(valeur);
    } catch (e) {
      donnees = null;
    }
    if (!estObjet(donnees) || Array.isArray(donnees)) {
      if (avertir) avertir('[Colibri] data-variantes ignoré (JSON { "id de variante": "sku" } attendu) :', valeur);
      return table;
    }
    Object.keys(donnees).forEach(function (id) {
      var sku = lireHandle(donnees[id]);
      if (MOTIF_ID_VARIANTE.test(id) && sku) table[id] = sku;
    });
    return table;
  }

  /**
   * Référence envoyée par le bouton d'une fiche : le SKU de la variante de
   * l'URL (`?variant={id}`) si la table la connaît, sinon `data-teinte`.
   */
  function referenceBouton(parDefaut, variantes, recherche) {
    var id = new URLSearchParams(recherche || '').get('variant');
    return id && Object.prototype.hasOwnProperty.call(variantes, id) ? variantes[id] : parDefaut;
  }

  /** Teinte demandée à l'ouverture de la page Simulateur (`?teinte=`). */
  function lireTeinteDemandee(recherche) {
    return lireHandle(new URLSearchParams(recherche || '').get('teinte'));
  }

  /** Visuel de l'en-tête de la page Simulateur (`data-visuel`) : URL http(s) seulement. */
  function lireVisuel(valeur) {
    if (typeof valeur !== 'string' || !valeur.trim()) return null;
    try {
      var url = new URL(valeur.trim());
      return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
    } catch (e) {
      return null;
    }
  }

  /**
   * Message reçu de l'app (origine vérifiée par l'appelant). Retourne null
   * pour tout message inconnu ou mal formé.
   */
  function lireMessageApp(donnees) {
    if (!estObjet(donnees) || typeof donnees.type !== 'string') return null;
    switch (donnees.type) {
      case 'colibri:resize':
        return typeof donnees.height === 'number' && isFinite(donnees.height)
          ? { type: donnees.type, height: donnees.height }
          : null;
      case 'colibri:scrollTop':
        return { type: donnees.type };
      case 'colibri:redirect':
        return typeof donnees.url === 'string' ? { type: donnees.type, url: donnees.url } : null;
      case 'colibri:simulateur:ouvrir':
        if (!estTypePiece(donnees.piece)) return null;
        return estHandle(donnees.teinte)
          ? { type: donnees.type, piece: donnees.piece, teinte: donnees.teinte }
          : { type: donnees.type, piece: donnees.piece };
      case 'colibri:mesure':
        return lireMesure(donnees);
      default:
        return null;
    }
  }

  function aPropre(objet, cle) {
    return Object.prototype.hasOwnProperty.call(objet, cle);
  }

  /** Valeur d'un paramètre de la liste blanche, ou undefined si son type ne convient pas. */
  function lireValeurMesure(valeur, type) {
    if (type === 'chaine') {
      return typeof valeur === 'string' && valeur.length <= MAX_LONGUEUR_PARAMETRE ? valeur : undefined;
    }
    if (type === 'nombre') return typeof valeur === 'number' && isFinite(valeur) ? valeur : undefined;
    return undefined;
  }

  /**
   * `colibri:mesure` de l'app : nom hors de MESURES_CALCULATEUR → null ; seules
   * les clés de la liste blanche, avec le bon type, sont gardées (toute autre
   * clé ou valeur est ignorée, sans erreur).
   */
  function lireMesure(donnees) {
    var nom = donnees.evenement;
    if (typeof nom !== 'string' || !aPropre(MESURES_CALCULATEUR, nom)) return null;
    var schema = MESURES_CALCULATEUR[nom];
    var recus = estObjet(donnees.parametres) ? donnees.parametres : {};
    var parametres = {};
    Object.keys(schema).forEach(function (cle) {
      if (!aPropre(recus, cle)) return;
      var valeur = lireValeurMesure(recus[cle], schema[cle]);
      if (valeur !== undefined) parametres[cle] = valeur;
    });
    return { type: 'colibri:mesure', evenement: nom, parametres: parametres };
  }

  /** ID GA4 de la configuration (`G-…`), ou '' : aucun événement. */
  function lireIdGa4(valeur) {
    var id = typeof valeur === 'string' ? valeur.trim() : '';
    return MOTIF_ID_GA4.test(id) ? id : '';
  }

  /**
   * Mode debug : `colibri_debug=1` dans l'URL l'active pour la session,
   * `colibri_debug=0` l'arrête ; sinon, l'état mémorisé.
   */
  function lireDebug(recherche, memorise) {
    var valeur = new URLSearchParams(recherche || '').get('colibri_debug');
    if (valeur === '1') return true;
    if (valeur === '0') return false;
    return memorise === true;
  }

  /**
   * Paramètres ajoutés à chaque événement : `parcours_simulateur`, et
   * seulement s'ils s'appliquent `traffic_type: 'internal'` (pages
   * `/pages/test-…`) et `debug_mode: true` (GA4 passe en debug dès que le
   * paramètre est présent, quelle que soit sa valeur).
   */
  function parametresCommuns(contexte) {
    var communs = { parcours_simulateur: contexte.simulateurOuvert ? 'oui' : 'non' };
    if (typeof contexte.chemin === 'string' && contexte.chemin.indexOf(PREFIXE_PAGES_TEST) === 0) {
      communs.traffic_type = 'internal';
    }
    if (contexte.debug) communs.debug_mode = true;
    return communs;
  }

  /** `type_produit` GA4 d'une référence renvoyée par l'app, ou null (inconnue). */
  function typeProduit(reference) {
    if (!estObjet(reference)) return null;
    if (reference.type === TYPE_PAPIER_PEINT) return 'papier_peint';
    return reference.type === 'peinture' ? 'peinture' : null;
  }

  /** Origine d'une ouverture depuis la page Simulateur : `?teinte=` vient du bouton d'une fiche produit. */
  function origineSimulateur(teinteDemandee) {
    return teinteDemandee ? ORIGINE_FICHE_PRODUIT : ORIGINE_PAGE_SIMULATEUR;
  }

  /**
   * Simulateur utilisable : token Wizart configuré. Un kit déjà présent sur la
   * page (faux simulateur de /labo/pont) n'en tient lieu qu'en mode labo
   * (`config.labo`, jamais en production).
   */
  function simulateurDisponible(config, kitDejaPresent) {
    return !!config.tokenWizart || (config.labo === true && !!kitDejaPresent);
  }

  /** Capacités annoncées à l'app dans `colibri:parent:pret`. */
  function capacites(config, kitDejaPresent) {
    return simulateurDisponible(config, kitDejaPresent) ? [CAPACITE_SIMULATEUR] : [];
  }

  /** Nom court d'une teinte : partie de `article_name` avant « - ». */
  function nomCourt(nom) {
    if (typeof nom !== 'string') return '';
    return nom.split(/\s+[-–—]\s+/)[0].trim();
  }

  /**
   * Teintes d'un événement `PRODUCT_APPLY` (DepKit v1.1.3, `evenement.data`) :
   * `products` = liste d'objets indexés `{collection}_{article}` ; handle
   * Shopify = `article_sku`, à défaut `article_custom_sku`. Aucun autre champ
   * n'est lu. Retourne [{ handle, nom }] sans doublon (vide si rien de lisible).
   */
  function lireApplication(donnees) {
    var teintes = [];
    if (!estObjet(donnees) || !estObjet(donnees.products)) return teintes;
    var entrees = Array.isArray(donnees.products) ? donnees.products : [donnees.products];
    entrees.forEach(function (entree) {
      if (!estObjet(entree)) return;
      Object.keys(entree).forEach(function (cle) {
        var produit = entree[cle];
        if (!estObjet(produit)) return;
        var handle = lireHandle(produit.article_sku) || lireHandle(produit.article_custom_sku);
        if (!handle) return;
        for (var i = 0; i < teintes.length; i++) {
          if (teintes[i].handle === handle) return;
        }
        teintes.push({ handle: handle, nom: nomCourt(produit.article_name) || handle });
      });
    });
    return teintes;
  }

  /**
   * Teintes retenues pendant la session, dans l'ordre d'application : une
   * teinte appliquée à nouveau passe en dernière position (la dernière est
   * toujours la plus récente). Au-delà de MAX_TEINTES, les plus anciennes
   * sont oubliées. Retourne une nouvelle liste.
   */
  function retenirTeinte(liste, teinte) {
    var suivante = liste.filter(function (t) { return t.handle !== teinte.handle; });
    suivante.push(teinte);
    return suivante.length > MAX_TEINTES ? suivante.slice(suivante.length - MAX_TEINTES) : suivante;
  }

  /**
   * Libellé du bouton principal de la barre (désactivé à 0). La barre retient
   * teintes et papiers peints : les libellés parlent de choix, pas de teintes.
   */
  function libelleUtiliser(nombre) {
    return nombre > 1 ? 'Utiliser mes choix (' + nombre + ') →' : 'Utiliser mon choix →';
  }

  /**
   * Libellé du bouton de retour de la barre et de l'écran d'attente (sans la
   * flèche, affichée à part) : vers la boutique depuis la page Simulateur,
   * vers le calculateur depuis la popup couleur.
   */
  function libelleRetour(destination) {
    return destination === RETOUR_CALCULATEUR ? 'Retour au calculateur' : 'Retour à la boutique';
  }

  /** Annonce du nombre d'essais retenus (lecteurs d'écran). */
  function annonceTeintes(nombre) {
    if (nombre === 0) return 'Aucun essai retenu';
    return nombre === 1 ? '1 essai retenu' : nombre + ' essais retenus';
  }

  /** Couleur d'une pastille : code hexadécimal valide, sinon null (nom seul). */
  function lireHex(valeur) {
    return typeof valeur === 'string' && MOTIF_HEX.test(valeur.trim()) ? valeur.trim() : null;
  }

  /** Image d'une pastille (papier peint) : URL https seulement, sinon null. */
  function lireImage(valeur) {
    if (typeof valeur !== 'string' || !valeur.trim()) return null;
    try {
      var url = new URL(valeur.trim());
      return url.protocol === 'https:' ? url.href : null;
    } catch (e) {
      return null;
    }
  }

  /**
   * Ce que l'app a renvoyé pour une référence, réduit à ce que la barre
   * affiche : `{ type, hex, image, nom }`. Type `papier-peint` : vignette de
   * l'image et nom « {Motif} {Coloris} » ; sinon `peinture` (rond de couleur).
   */
  function lireReference(t) {
    var papierPeint = t.type === TYPE_PAPIER_PEINT;
    return {
      type: papierPeint ? TYPE_PAPIER_PEINT : 'peinture',
      hex: papierPeint ? null : lireHex(t.hex),
      image: papierPeint ? lireImage(t.image) : null,
      nom: typeof t.nom === 'string' && t.nom.trim() ? t.nom.trim() : null,
    };
  }

  /** URL de l'endpoint des couleurs de teintes de l'app. */
  function urlTeintes(origineApp, handles) {
    return origineApp + CHEMIN_API_TEINTES + '?handles=' + handles.map(encodeURIComponent).join(',');
  }

  /**
   * Valeurs Wizart écoutées : application d'une teinte (retenue par la barre)
   * et bouton retour de Wizart (ferme comme le bouton de retour de la barre).
   * Le panier (`OPEN_IN_STORE`) n'est plus une sortie.
   */
  function evenementsEcoutes(evenementsKit) {
    var resultat = { application: [], retour: [] };
    Object.keys(evenementsKit || {}).forEach(function (cle) {
      if (cle === EVENEMENT_APPLICATION) resultat.application.push(evenementsKit[cle]);
      else if (cle === EVENEMENT_RETOUR) resultat.retour.push(evenementsKit[cle]);
    });
    return resultat;
  }

  /**
   * Valeurs Wizart écoutées pour la mesure seulement : photo importée
   * (`CUSTOM_INTERIOR_UPLOAD`) et pièce d'exemple choisie
   * (`PREDEFINED_INTERIOR_SELECT`). Aucun effet sur le simulateur.
   */
  function evenementsMesures(evenementsKit) {
    var resultat = { photo: [], exemple: [] };
    Object.keys(evenementsKit || {}).forEach(function (cle) {
      if (cle === EVENEMENT_PHOTO) resultat.photo.push(evenementsKit[cle]);
      else if (cle === EVENEMENT_EXEMPLE) resultat.exemple.push(evenementsKit[cle]);
    });
    return resultat;
  }

  /** UUID de l'intérieur Wizart d'un type de pièce, ou null (galerie). */
  function interieurWizart(piece) {
    return estTypePiece(piece) ? INTERIEURS_WIZART[piece] || null : null;
  }

  /**
   * Réglages du DepKit : Wizart remplit la zone au-dessus de la barre
   * (`FILL_PARENT` — `FULL_SCREEN` la recouvrirait), en français, avec son
   * bouton retour (visible à toutes les étapes : galerie, téléversement,
   * scène ; il émet `BACK_BUTTON_CLICK`, qui ferme la surimpression), et sur
   * la teinte demandée le cas échéant. ESSAI_EXEMPLE (par défaut, popup
   * couleur) : ouvert dans l'intérieur du type de pièce s'il en a un.
   * ESSAI_PHOTO (page Simulateur) : jamais d'intérieur, Wizart s'ouvre sur sa
   * galerie (téléversement de photo et pièces d'exemple). `uploadPhoto` n'est
   * jamais passé : la valeur par défaut du DepKit (téléversement autorisé)
   * s'applique.
   */
  function reglagesVisualiseur(kit, token, cible, teinte, piece, essai) {
    var reglages = {
      token: token,
      layoutSettings: { targetElement: cible, layout: kit.LAYOUTS && kit.LAYOUTS.FILL_PARENT },
      integrationSettings: { locale: 'fr', showBackToWebsiteButton: true },
    };
    var scene = {};
    var interieur = essai === ESSAI_PHOTO ? null : interieurWizart(piece);
    if (interieur) scene.openInRoom = interieur;
    if (teinte) scene.openWithProduct = teinte;
    if (interieur || teinte) reglages.sceneData = scene;
    return reglages;
  }

  // ===================== Utilitaires navigateur =====================

  function lireSession(cle) {
    try {
      return window.sessionStorage.getItem(cle);
    } catch (e) {
      return null;
    }
  }

  function ecrireSession(cle, valeur) {
    try {
      if (valeur === null) window.sessionStorage.removeItem(cle);
      else window.sessionStorage.setItem(cle, valeur);
    } catch (e) {
      // sessionStorage indisponible (navigation privée stricte) : sans incidence
    }
  }

  function creer(balise, attributs, enfants) {
    var element = document.createElement(balise);
    Object.keys(attributs || {}).forEach(function (cle) {
      if (cle === 'texte') element.textContent = attributs[cle];
      else element.setAttribute(cle, attributs[cle]);
    });
    (enfants || []).forEach(function (enfant) { element.appendChild(enfant); });
    return element;
  }

  function trouverHote(script, id) {
    var hote = document.getElementById(id);
    if (!hote) {
      // Hôte absent : créé juste avant la balise du script
      hote = creer('div', { id: id });
      if (script && script.parentNode) script.parentNode.insertBefore(hote, script);
      else document.body.appendChild(hote);
    }
    return hote;
  }

  /**
   * Racine de rendu isolée (Shadow DOM) avec ses styles. Navigateur sans
   * Shadow DOM : rendu dans l'hôte lui-même (styles du thème non isolés).
   */
  function racineIsolee(hote, styles) {
    var ombre = hote.shadowRoot || (typeof hote.attachShadow === 'function' ? hote.attachShadow({ mode: 'open' }) : hote);
    ombre.appendChild(creer('style', { texte: styles }));
    return ombre;
  }

  // Base commune : police héritée du site, aucun style du thème
  var STYLES_BASE = [
    ':host{display:block;font-family:inherit;}',
    '*,*::before,*::after{box-sizing:border-box;}',
    'button{font-family:inherit;}',
    '.colibri-masque{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0;}',
  ].join('');

  // ===================== Mesure GA4 =====================

  function estPromesse(valeur) {
    return estObjet(valeur) && typeof valeur.then === 'function';
  }

  /** Valeur de la Promise, ou `parDefaut` si elle n'arrive pas à temps ou rejette. */
  function avantDelai(promesse, delaiMs, parDefaut) {
    return new Promise(function (resolve) {
      var minuteur = setTimeout(function () { resolve(parDefaut); }, delaiMs);
      Promise.resolve(promesse).then(function (valeur) {
        clearTimeout(minuteur);
        resolve(valeur);
      }, function () {
        clearTimeout(minuteur);
        resolve(parDefaut);
      });
    });
  }

  /**
   * Fonction unique d'envoi des événements GA4, avec le `gtag` déjà chargé par
   * la page Shopify : `gtag('event', nom, { …parametres, …communs, send_to })`.
   * Rien n'est chargé ici (ni gtag.js, ni `dataLayer`) et le consentement
   * n'est jamais touché : le Consent Mode de la boutique met les événements en
   * attente et l'applique lui-même. Sans ID GA4 valide ou sans `gtag` : aucun
   * envoi. Paramètres communs : parametresCommuns. En mode debug, chaque
   * événement est aussi écrit dans la console.
   * Les paramètres peuvent être une Promise (type d'une référence demandé à
   * l'app) : les événements partent toujours dans l'ordre des actions.
   * environnement : { idGa4, fenetre (window), session: { lire(cle), ecrire(cle, valeur) } }.
   */
  function creerMesure(environnement) {
    var idGa4 = lireIdGa4(environnement.idGa4);
    var fenetre = environnement.fenetre;
    var session = environnement.session;
    var debug = lireDebug(fenetre.location && fenetre.location.search, session.lire(CLE_SESSION_DEBUG) === '1');
    session.ecrire(CLE_SESSION_DEBUG, debug ? '1' : null);
    if (debug && !idGa4 && fenetre.console) {
      fenetre.console.info('[Colibri] GA4 : aucun ID configuré (NEXT_PUBLIC_GA4_ID), aucun événement envoyé');
    }
    // Dernier envoi en attente (paramètres en Promise), null si aucun
    var file = null;

    function emettre(nom, parametres) {
      var evenement = {};
      Object.keys(parametres || {}).forEach(function (cle) {
        if (parametres[cle] !== null && parametres[cle] !== undefined) evenement[cle] = parametres[cle];
      });
      var communs = parametresCommuns({
        simulateurOuvert: session.lire(CLE_SESSION_SIMULATEUR_OUVERT) === '1',
        chemin: fenetre.location && fenetre.location.pathname,
        debug: debug,
      });
      Object.keys(communs).forEach(function (cle) { evenement[cle] = communs[cle]; });
      evenement.send_to = idGa4;
      var gtag = fenetre.gtag;
      var disponible = typeof gtag === 'function';
      if (disponible) gtag('event', nom, evenement);
      if (debug && fenetre.console) {
        fenetre.console.info('[Colibri] GA4' + (disponible ? '' : ' (non envoyé : gtag absent)'), nom, evenement);
      }
    }

    function envoyer(nom, parametres) {
      if (!idGa4) return;
      if (!file && !estPromesse(parametres)) {
        try { emettre(nom, parametres); } catch (e) { /* gtag de la page en erreur : sans incidence */ }
        return;
      }
      var suivante = (file || Promise.resolve())
        .then(function () { return parametres; })
        .then(function (valeurs) { emettre(nom, valeurs); })
        .catch(function () { /* paramètres indisponibles ou gtag en erreur : événement abandonné, la file continue */ });
      file = suivante;
      suivante.then(function () { if (file === suivante) file = null; });
    }

    /** Le simulateur s'ouvre : `parcours_simulateur: 'oui'` pour le reste de la session. */
    function marquerSimulateur() {
      session.ecrire(CLE_SESSION_SIMULATEUR_OUVERT, '1');
    }

    return { envoyer: envoyer, marquerSimulateur: marquerSimulateur };
  }

  // Mesure de la page, créée au démarrage (inactive avant : tests)
  var mesure = { envoyer: function () {}, marquerSimulateur: function () {} };

  // ===================== Surimpression + barre Colibri =====================

  var STYLES_SURIMPRESSION = STYLES_BASE + [
    '.surimpression{position:absolute;inset:0;display:flex;flex-direction:column;background:#fff;}',
    '.zone{position:relative;flex:1 1 auto;min-height:0;overflow:hidden;}',
    '::slotted(*){position:absolute;inset:0;width:100%;height:100%;}',
    '.attente{position:absolute;inset:0;z-index:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;background:#fff;font-size:16px;line-height:1.4;color:#13302a;text-align:center;padding:24px;}',
    '.attente p{margin:0;}',
    '.attente-rond{width:32px;height:32px;border-radius:50%;border:3px solid #e2f3ee;border-top-color:#13302a;animation:colibri-tourne 1s linear infinite;}',
    '@keyframes colibri-tourne{to{transform:rotate(360deg)}}',
    '.lien{background:none;border:0;padding:12px;color:#13302a;text-decoration:underline;cursor:pointer;font-size:15px;}',
    // Barre Colibri, aux couleurs du site (retours Colibri du 23/10/2026) :
    // fond clair, texte #13302a, contrastes AA (texte secondaire #45453f)
    '.barre{flex:0 0 auto;display:flex;align-items:center;gap:12px;padding:14px 20px;padding-bottom:calc(14px + env(safe-area-inset-bottom, 0px));background:#F5F5F5;color:#13302a;border-top:1px solid #e3e2dc;line-height:1.3;}',
    '.haut{display:flex;align-items:center;gap:12px;min-width:0;}',
    '.actions{display:contents;}',
    '.logo{flex:0 0 auto;display:inline-flex;align-items:center;}',
    '.logo img{display:block;height:24px;width:auto;}',
    '.libelle{flex:0 0 auto;font-size:13px;color:#45453f;white-space:nowrap;}',
    '.teintes{display:flex;align-items:center;gap:8px;min-width:0;overflow-x:auto;scrollbar-width:none;margin:0;padding:0;list-style:none;}',
    '.teintes::-webkit-scrollbar{display:none;}',
    '.pastille{flex:0 0 auto;display:inline-flex;align-items:center;gap:8px;background:#fff;border:1px solid #e3e2dc;border-radius:999px;padding:3px 13px 3px 3px;font-size:14px;color:#13302a;white-space:nowrap;}',
    '.pastille.sans-couleur{padding:3px 13px;min-height:36px;}',
    // Rond cerclé : une teinte très claire reste visible sur la pastille blanche
    '.rond{flex:0 0 auto;width:24px;height:24px;box-sizing:content-box;border:2px solid #fff;box-shadow:0 0 0 1px #e3e2dc;border-radius:50%;}',
    // Images de variante = mises en situation (fauteuil, sol en bas) : cadrage sur le mur
    '.vignette{display:block;object-fit:cover;object-position:50% 20%;background:#fff;}',
    '.vide{font-size:13px;color:#45453f;}',
    '.retour{margin-left:auto;flex:0 0 auto;background:transparent;color:#13302a;border:1px solid #13302a;border-radius:6px;padding:11px 16px;font-size:14px;line-height:1.2;cursor:pointer;white-space:nowrap;}',
    '.retour:hover{background:rgba(19,48,42,0.06);}',
    '.utiliser{flex:0 0 auto;background:#13302a;color:#fff;border:0;border-radius:6px;padding:12px 20px;font-size:15px;font-weight:600;line-height:1.2;cursor:pointer;white-space:nowrap;}',
    '.utiliser:disabled{opacity:0.45;cursor:not-allowed;}',
    // Contour de focus foncé : contraste suffisant sur le fond clair
    '.retour:focus-visible,.utiliser:focus-visible,.lien:focus-visible{outline:2px solid #13302a;outline-offset:2px;}',
    '@media (max-width:639px){',
    '.barre{flex-direction:column;align-items:stretch;}',
    '.haut{width:100%;}',
    // Ligne du haut réservée au libellé et aux pastilles (maquette mobile)
    '.logo{display:none;}',
    '.actions{display:flex;gap:12px;}',
    // Les deux boutons se partagent la largeur ; le libellé passe sur deux
    // lignes si besoin (en nowrap, ils sortaient de l'écran : test du 26/10)
    '.retour,.utiliser{flex:1 1 0;min-width:0;white-space:normal;text-align:center;min-height:44px;}',
    '.retour{margin-left:0;}',
    '}',
  ].join('');

  /**
   * Couleurs des teintes (et vignettes des papiers peints), demandées à l'app
   * par lots (`requete(url)` → Promise d'une réponse fetch). Par référence,
   * ce que l'API a renvoyé est mémorisé (`lireReference`) : une référence
   * absente de la réponse (inconnue du catalogue) reste sans couleur ; un
   * échec (réseau, HTTP, réponse illisible) n'est pas retenu, les références
   * sont redemandées au prochain rendu de la barre. Les pastilles restent
   * sans rond de couleur en attendant : la sortie n'est jamais bloquée.
   */
  function creerCouleursTeintes(requete) {
    var connues = {};
    var enCours = {};

    /** Ce que l'API a renvoyé pour la référence, ou null (inconnue, pas encore reçue). */
    function reference(handle) {
      return Object.prototype.hasOwnProperty.call(connues, handle) ? connues[handle] : null;
    }

    function hex(handle) {
      var connue = reference(handle);
      return connue ? connue.hex : null;
    }

    /** Retourne la Promise de la requête lancée, ou null s'il n'y avait rien à demander. */
    function chargerCouleurs(origineApp, handles, rappel) {
      var aDemander = handles.filter(function (h) {
        return !Object.prototype.hasOwnProperty.call(connues, h) && !enCours[h];
      });
      if (aDemander.length === 0) return null;
      function liberer() { aDemander.forEach(function (h) { delete enCours[h]; }); }

      var promesse = Promise.resolve()
        .then(function () { return requete(urlTeintes(origineApp, aDemander)); })
        .then(function (reponse) {
          if (!reponse || !reponse.ok) throw new Error('HTTP ' + (reponse && reponse.status));
          return reponse.json();
        })
        .then(function (liste) {
          if (!Array.isArray(liste)) throw new Error('réponse illisible');
          var recues = {};
          liste.forEach(function (t) {
            if (estObjet(t) && aDemander.indexOf(t.handle) !== -1) recues[t.handle] = lireReference(t);
          });
          aDemander.forEach(function (h) { connues[h] = recues[h] || null; });
          liberer();
          rappel();
        })
        .catch(function (erreur) {
          // Échec non mémorisé : redemandé au prochain rendu
          liberer();
          console.warn('[Colibri] Couleurs des teintes indisponibles', erreur);
        });
      // Requête en cours, par référence : attendue par `quandConnue`
      aDemander.forEach(function (h) { enCours[h] = promesse; });
      return promesse;
    }

    /**
     * Promise de ce que l'API a renvoyé pour la référence, une fois la requête
     * terminée (en cours, ou lancée ici) ; null si elle est inconnue ou si la
     * requête a échoué. Ne rejette jamais.
     */
    function quandConnue(origineApp, handle) {
      var attente = Object.prototype.hasOwnProperty.call(connues, handle)
        ? null
        : enCours[handle] || chargerCouleurs(origineApp, [handle], function () {});
      return Promise.resolve(attente).then(function () { return reference(handle); });
    }

    return { hex: hex, reference: reference, chargerCouleurs: chargerCouleurs, quandConnue: quandConnue };
  }

  // Couleurs des teintes pour la page (une seule instance)
  var couleursTeintes = creerCouleursTeintes(function (url) {
    return fetch(url, { credentials: 'omit' });
  });

  /**
   * Bouton de retour (barre, écran d'attente) : « ← Retour à la boutique » ou
   * « ← Retour au calculateur ». La flèche est décorative (masquée aux
   * lecteurs d'écran).
   */
  function creerBoutonRetour(classe, destination) {
    return creer('button', { type: 'button', class: classe }, [
      creer('span', { 'aria-hidden': 'true', texte: '← ' }),
      document.createTextNode(libelleRetour(destination)),
    ]);
  }

  /**
   * Barre Colibri, aux couleurs du site : logo, « Vos essais » (teintes et
   * papiers peints), bouton de retour et « Utiliser… ».
   * options : { origineApp, retour, surFermer(), surUtiliser() }.
   */
  function creerBarre(options) {
    var barre = creer('div', { class: 'barre', role: 'region', 'aria-label': 'Vos essais' });
    var logo = creer('span', { class: 'logo' }, [
      creer('img', { src: LOGO_COLIBRI, alt: 'Colibri', height: '24' }),
    ]);
    var liste = creer('ul', { class: 'teintes' });
    var annonce = creer('span', { class: 'colibri-masque', 'aria-live': 'polite' });
    var retour = creerBoutonRetour('retour', options.retour);
    var utiliser = creer('button', { type: 'button', class: 'utiliser' });

    barre.appendChild(creer('div', { class: 'haut' }, [
      logo,
      creer('span', { class: 'libelle', texte: 'Vos essais' }),
      liste,
      annonce,
    ]));
    barre.appendChild(creer('div', { class: 'actions' }, [retour, utiliser]));

    retour.addEventListener('click', function () { options.surFermer(); });
    utiliser.addEventListener('click', function () { options.surUtiliser(); });

    var teintes = [];

    function rendre() {
      liste.textContent = '';
      if (teintes.length === 0) {
        liste.appendChild(creer('li', { class: 'vide', texte: 'Appliquez une teinte ou un papier peint sur un mur pour le retenir' }));
      }
      teintes.forEach(function (teinte) {
        var connue = couleursTeintes.reference(teinte.handle);
        var papierPeint = !!connue && connue.type === TYPE_PAPIER_PEINT;
        var hex = connue ? connue.hex : null;
        var image = papierPeint ? connue.image : null;
        var pastille = creer('li', { class: hex || image ? 'pastille' : 'pastille sans-couleur' });
        if (image) {
          // Papier peint : vignette ronde de l'image de la variante
          pastille.appendChild(creer('img', { class: 'rond vignette', src: image, alt: '', 'aria-hidden': 'true' }));
        } else if (hex) {
          var rond = creer('span', { class: 'rond', 'aria-hidden': 'true' });
          rond.style.backgroundColor = hex;
          pastille.appendChild(rond);
        }
        pastille.appendChild(creer('span', { texte: papierPeint && connue.nom ? connue.nom : teinte.nom }));
        liste.appendChild(pastille);
      });
      utiliser.textContent = libelleUtiliser(teintes.length);
      utiliser.disabled = teintes.length === 0;
      annonce.textContent = annonceTeintes(teintes.length);
      // La plus récente reste visible quand les pastilles débordent
      liste.scrollLeft = liste.scrollWidth;
    }

    rendre();

    return {
      element: barre,
      definir: function (suivantes) {
        teintes = suivantes;
        rendre();
        couleursTeintes.chargerCouleurs(options.origineApp, teintes.map(function (t) { return t.handle; }), rendre);
      },
    };
  }

  // ===================== Simulateur Wizart (DepKit) =====================

  var promesseKit = null;

  function kitPresent() {
    return window.WizartDeploymentKit || null;
  }

  function chargerScript(url) {
    return new Promise(function (resolve, reject) {
      var script = creer('script', { src: url, async: '' });
      var minuteur = setTimeout(function () { reject(new Error('délai dépassé : ' + url)); }, DELAI_SCRIPT_MS);
      script.onload = function () { clearTimeout(minuteur); resolve(); };
      script.onerror = function () { clearTimeout(minuteur); reject(new Error('échec : ' + url)); };
      document.head.appendChild(script);
    });
  }

  /** DepKit chargé à la demande, une seule fois. */
  function chargerKit() {
    if (kitPresent()) return Promise.resolve(kitPresent());
    if (promesseKit) return promesseKit;
    promesseKit = chargerScript(SCRIPT_DEPKIT).then(function () {
      if (!kitPresent()) throw new Error('WizartDeploymentKit absent après ' + SCRIPT_DEPKIT);
      return kitPresent();
    }).catch(function (erreur) {
      promesseKit = null;
      throw erreur;
    });
    return promesseKit;
  }

  /**
   * Ouvre le simulateur en surimpression plein écran : zone Wizart en haut,
   * barre Colibri en bas, toujours visible.
   * options : { origineApp, token, piece, teinte, essai, retour, origine, surSelection(handles), surFermeture() }
   * (`essai` : ESSAI_PHOTO, galerie, ou ESSAI_EXEMPLE, pièce d'exemple, par défaut ;
   * `retour` : RETOUR_BOUTIQUE ou RETOUR_CALCULATEUR, libellé du retour ;
   * `origine` : ORIGINE_*, paramètre des événements GA4 `simulateur_*`).
   * Un seul simulateur à la fois ; toute issue appelle exactement un rappel.
   * Les teintes retenues repartent de zéro à chaque ouverture.
   * Mesure GA4 : ouverture, photo importée, pièce d'exemple, chaque
   * application (une teinte réappliquée compte à nouveau), « Utiliser… » et
   * fermeture sans choix (`sortie` : barre, Wizart ou chargement).
   */
  var simulateurOuvert = null;

  function ouvrirSimulateur(options) {
    if (simulateurOuvert) simulateurOuvert.fermer(false);

    var racine = document.documentElement;
    var debordementInitial = racine.style.overflow;
    racine.style.overflow = 'hidden';

    var origine = options.origine;
    mesure.marquerSimulateur();
    mesure.envoyer('simulateur_ouvert', estTypePiece(options.piece)
      ? { origine: origine, piece: options.piece }
      : { origine: origine });

    // Hôte dans la page (styles en ligne : le thème ne peut pas le déplacer)
    var hote = creer('div', { 'data-colibri': 'surimpression' });
    hote.style.cssText = 'position:fixed;inset:0;z-index:2147483000;display:block;margin:0;padding:0;border:0;';
    var ombre = racineIsolee(hote, STYLES_SURIMPRESSION);

    // Zone Wizart : élément de la page projeté dans la surimpression (slot),
    // pour que le DepKit y travaille comme dans un document ordinaire
    var cible = creer('div', { slot: 'wizart' });
    cible.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;margin:0;padding:0;border:0;';

    var boutonAttente = creerBoutonRetour('lien', options.retour);
    var attente = creer('div', { class: 'attente', role: 'status' }, [
      creer('div', { class: 'attente-rond' }),
      creer('p', { texte: 'Chargement du simulateur…' }),
      boutonAttente,
    ]);
    var zone = creer('div', { class: 'zone' });
    if (ombre === hote) zone.appendChild(cible);
    else {
      zone.appendChild(creer('slot', { name: 'wizart' }));
      hote.appendChild(cible);
    }
    zone.appendChild(attente);

    var session = {};
    var teintes = [];
    var barre = creerBarre({
      origineApp: options.origineApp,
      retour: options.retour,
      surFermer: function () { fermerPar(SORTIE_BARRE); },
      surUtiliser: function () {
        selectionner(teintes.map(function (t) { return t.handle; }));
      },
    });

    ombre.appendChild(creer('div', {
      class: 'surimpression', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Simulateur Colibri',
    }, [zone, barre.element]));
    document.body.appendChild(hote);

    var visualiseur = null;
    var abonnements = [];
    var termine = false;

    function nettoyer() {
      var kit = kitPresent();
      abonnements.forEach(function (id) {
        try { if (kit) kit.EventBus.unsubscribe(id); } catch (e) { /* déjà désabonné */ }
      });
      abonnements = [];
      try { if (visualiseur) visualiseur.destroy(); } catch (e) { /* déjà détruit par le DepKit */ }
      visualiseur = null;
      if (hote.parentNode) hote.parentNode.removeChild(hote);
      racine.style.overflow = debordementInitial;
      if (simulateurOuvert === session) simulateurOuvert = null;
    }

    // avecRappel = false : fermeture forcée par une nouvelle ouverture
    session.fermer = function (avecRappel) {
      if (termine) return;
      termine = true;
      nettoyer();
      if (avecRappel !== false) options.surFermeture();
    };

    // Fermeture sans choix par le client (mesurée), puis comme session.fermer()
    function fermerPar(sortie) {
      if (termine) return;
      mesure.envoyer('simulateur_ferme', { origine: origine, sortie: sortie, nb_essais: teintes.length });
      session.fermer();
    }

    function selectionner(handles) {
      if (termine || handles.length === 0) return;
      // Avant le rappel : la page Simulateur navigue vers le configurateur
      mesure.envoyer('simulateur_choix_utilise', { origine: origine, nb_essais: handles.length });
      termine = true;
      nettoyer();
      options.surSelection(handles);
    }

    // Application mesurée : type de la référence renvoyé par l'app (le même
    // appel que la pastille), place dans « Vos essais » au moment de l'action
    function mesurerApplication(teinte, rang) {
      var parametres = {
        origine: origine,
        produit: teinte.handle.slice(0, MAX_LONGUEUR_PARAMETRE),
        rang_essai: rang,
      };
      mesure.envoyer('simulateur_produit_applique', avantDelai(
        couleursTeintes.quandConnue(options.origineApp, teinte.handle), DELAI_TYPE_PRODUIT_MS, null
      ).then(function (reference) {
        parametres.type_produit = typeProduit(reference);
        return parametres;
      }));
    }

    // Chaque application d'une teinte sur un mur la retient (nettoyer la
    // surface ne retire rien)
    function appliquer(donnees) {
      if (termine) return;
      var appliquees = lireApplication(donnees);
      if (appliquees.length === 0) return;
      var rangs = [];
      appliquees.forEach(function (teinte) {
        teintes = retenirTeinte(teintes, teinte);
        rangs.push(teintes.length);
      });
      barre.definir(teintes);
      appliquees.forEach(function (teinte, index) { mesurerApplication(teinte, rangs[index]); });
    }

    boutonAttente.addEventListener('click', function () { fermerPar(SORTIE_CHARGEMENT); });
    simulateurOuvert = session;

    chargerKit().then(function (kit) {
      if (termine) return;
      var ecoutes = evenementsEcoutes(kit.VISUALIZER_EVENTS);
      ecoutes.application.forEach(function (valeur) {
        abonnements.push(kit.EventBus.subscribe(function (evenement) {
          appliquer(evenement && evenement.data);
        }, valeur, null));
      });
      ecoutes.retour.forEach(function (valeur) {
        // Le DepKit détruit lui-même le visualiseur sur le bouton retour
        abonnements.push(kit.EventBus.subscribe(function () { fermerPar(SORTIE_WIZART); }, valeur, null));
      });
      var mesures = evenementsMesures(kit.VISUALIZER_EVENTS);
      mesures.photo.forEach(function (valeur) {
        abonnements.push(kit.EventBus.subscribe(function () {
          if (!termine) mesure.envoyer('simulateur_photo_importee', { origine: origine });
        }, valeur, null));
      });
      mesures.exemple.forEach(function (valeur) {
        abonnements.push(kit.EventBus.subscribe(function () {
          if (!termine) mesure.envoyer('simulateur_piece_exemple', { origine: origine });
        }, valeur, null));
      });

      visualiseur = new kit.Visualizer(
        reglagesVisualiseur(kit, options.token, cible, options.teinte, options.piece, options.essai)
      );
      return Promise.resolve(visualiseur.load()).then(function () {
        return visualiseur.show();
      }).then(function () {
        if (!termine && attente.parentNode) attente.parentNode.removeChild(attente);
      });
    }).catch(function (erreur) {
      // Simulateur indisponible : retour à l'état d'avant, sans blocage
      console.warn('[Colibri] Simulateur indisponible', erreur);
      fermerPar(SORTIE_CHARGEMENT);
    });

    return session;
  }

  // ===================== Mode configurateur =====================

  function demarrerConfigurateur(config, script) {
    var APP_ORIGIN = config.origineApp;
    var hote = trouverHote(script, 'colibri-configurator');
    var iframe = document.createElement('iframe');
    var kitInitial = !!kitPresent();

    // Entrée depuis le simulateur (paramètres consommés puis retirés de l'URL)
    var entree = lireEntreeConfigurateur(window.location.search, lireSession(CLE_SESSION_PIECE));
    if (entree) {
      ecrireSession(CLE_SESSION_PIECE, null);
      try {
        window.history.replaceState(window.history.state, '',
          window.location.pathname + rechercheSansEntree(window.location.search) + window.location.hash);
      } catch (e) {
        // URL laissée telle quelle : sans incidence
      }
    }

    function journal(sens, message) {
      // Observation (page /labo/pont) : aucun effet sur le fonctionnement
      try {
        hote.dispatchEvent(new CustomEvent('colibri:message', { detail: { sens: sens, message: message } }));
      } catch (e) { /* navigateur sans CustomEvent */ }
    }

    function envoyer(message) {
      if (!iframe.contentWindow) return;
      iframe.contentWindow.postMessage(message, APP_ORIGIN);
      journal('page→app', message);
    }

    iframe.src = APP_ORIGIN + cheminIframe(entree);
    iframe.title = 'Configurateur de peinture Colibri';
    iframe.style.width = '100%';
    iframe.style.border = 'none';
    iframe.style.display = 'block';
    // Hauteur de secours tant que l'app n'a pas envoyé sa vraie hauteur
    iframe.style.minHeight = '900px';

    // Annonce des capacités à chaque chargement de l'iframe, renvoyée à la
    // première hauteur reçue : l'app peut ne pas encore écouter au `load`.
    var pretRenvoye = false;
    function annoncer() {
      envoyer({ type: 'colibri:parent:pret', capacites: capacites(config, kitInitial) });
    }
    iframe.addEventListener('load', function () {
      pretRenvoye = false;
      annoncer();
    });

    window.addEventListener('message', function (event) {
      // Sécurité : on n'accepte que les messages venant de notre app
      if (event.origin !== APP_ORIGIN || event.source !== iframe.contentWindow) return;
      var data = lireMessageApp(event.data);
      if (!data) return;
      journal('app→page', data);

      // L'app annonce sa hauteur → l'iframe s'ajuste (pas de scroll interne)
      if (data.type === 'colibri:resize') {
        iframe.style.height = data.height + 'px';
        iframe.style.minHeight = '0px';
        if (!pretRenvoye) {
          pretRenvoye = true;
          annoncer();
        }
      }

      // Changement d'étape → remonter tout en haut de la page.
      // Pas de scroll partiel avec offset : le header auto-masquant du thème
      // se repositionnait de façon erratique sur un scroll programmatique en
      // cours de page. À scrollY = 0, il est dans son état naturel, docké —
      // aucun calcul d'animation possible. Scroll instantané pour la même
      // raison. (À revoir si du contenu est un jour ajouté au-dessus de
      // l'iframe : l'utilisateur le reverrait à chaque étape.)
      if (data.type === 'colibri:scrollTop') {
        window.scrollTo({ top: 0, behavior: 'auto' });
      }

      // Sortie de tunnel (checkout, panier boutique) relayée par l'app
      if (data.type === 'colibri:redirect') {
        window.location.href = data.url;
      }

      // Événement GA4 du calculateur (liste blanche appliquée par lireMesure)
      if (data.type === 'colibri:mesure') {
        mesure.envoyer(data.evenement, data.parametres);
      }

      // Popup couleur → simulateur en surimpression, retour des teintes
      if (data.type === 'colibri:simulateur:ouvrir') {
        if (!simulateurDisponible(config, kitInitial)) {
          envoyer({ type: 'colibri:simulateur:ferme' });
          return;
        }
        // Tant que le panier Wizart n'est pas désactivé dans le PIM, une
        // redirection PIM vers le configurateur retrouve la pièce
        ecrireSession(CLE_SESSION_PIECE, data.piece);
        ouvrirSimulateur({
          origineApp: APP_ORIGIN,
          token: config.tokenWizart,
          piece: data.piece,
          teinte: data.teinte,
          // Pièce d'exemple du type de la pièce (galerie s'il n'y en a pas)
          essai: ESSAI_EXEMPLE,
          retour: RETOUR_CALCULATEUR,
          origine: ORIGINE_CALCULATEUR,
          surSelection: function (handles) {
            ecrireSession(CLE_SESSION_PIECE, null);
            // Ordre d'application : la dernière est la plus récente
            envoyer({ type: 'colibri:simulateur:selection', teintes: handles });
          },
          surFermeture: function () {
            ecrireSession(CLE_SESSION_PIECE, null);
            envoyer({ type: 'colibri:simulateur:ferme' });
          },
        });
      }
    });

    hote.appendChild(iframe);
  }

  // ===================== Mode simulateur (page Simulateur) =====================

  var STYLES_PAGE = STYLES_BASE + [
    '.page{max-width:1120px;margin:0 auto;padding:56px 24px 72px;display:flex;flex-direction:column;gap:44px;}',
    'h1,h2,h3,p{margin:0;}',
    '.entete{display:grid;grid-template-columns:1fr;gap:40px;align-items:center;}',
    '.entete.avec-visuel{grid-template-columns:1fr 1fr;}',
    '.surtitre{font-size:12px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:#17644f;margin-bottom:12px;}',
    '.titre{font-size:40px;font-weight:400;line-height:1.15;margin-bottom:16px;}',
    '.intro{font-size:16px;line-height:1.6;color:#45453f;}',
    '.visuel{display:block;width:100%;height:300px;object-fit:cover;border-radius:12px;}',
    '.question{font-size:24px;font-weight:500;line-height:1.3;margin-bottom:6px;}',
    '.sous-titre{font-size:14px;line-height:1.5;color:#55554f;margin-bottom:20px;}',
    '.pieces{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px;}',
    '.piece{display:flex;flex-direction:column;padding:0;margin:0;background:#fff;border:1px solid #e3e2dc;border-radius:10px;overflow:hidden;cursor:pointer;color:inherit;text-align:center;}',
    // Bordure 2 px au survol / focus sans décaler la grille
    '.piece:hover,.piece:focus-visible{border-color:#2fae94;box-shadow:0 0 0 1px #2fae94;outline:none;}',
    '.piece img{display:block;width:100%;height:170px;object-fit:cover;background:#f3f2ee;}',
    '.piece span{display:block;font-size:15px;line-height:1.3;padding:13px;}',
    '.etapes{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;margin:0;padding:0;list-style:none;}',
    '.etape{background:#fff;border:1px solid #e3e2dc;border-radius:10px;padding:20px;}',
    '.numero{display:flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:50%;background:#e2f3ee;color:#17644f;font-size:15px;font-weight:600;margin-bottom:12px;}',
    '.etape h3{font-size:16px;font-weight:600;line-height:1.3;margin-bottom:6px;}',
    '.etape p{font-size:14px;line-height:1.5;color:#55554f;}',
    '.conseil{display:flex;align-items:center;gap:14px;background:#fff;border:1px solid #e3e2dc;border-radius:10px;padding:18px 22px;font-size:14px;line-height:1.5;color:#45453f;}',
    '.conseil svg{flex:0 0 auto;display:block;}',
    '.conseil strong{color:#17644f;font-weight:600;}',
    '.message{padding:12px 16px;border-radius:10px;background:#fef3c7;color:#92400e;margin-bottom:16px;}',
    '.bouton{display:inline-flex;align-items:center;gap:8px;padding:12px 20px;border-radius:6px;background:#13302a;color:#fff;font-size:15px;font-weight:600;text-decoration:none;}',
    '@media (max-width:639px){',
    '.entete.avec-visuel{grid-template-columns:1fr;}',
    '.titre{font-size:32px;}',
    '.pieces{grid-template-columns:repeat(2,minmax(0,1fr));}',
    '.etapes{grid-template-columns:1fr;}',
    '}',
  ].join('');

  var ETAPES = [
    ['Choisissez votre pièce', 'Votre photo, ou l’une de nos pièces d’exemple.'],
    ['Essayez teintes et papiers peints', 'Un essai par mur, et la comparaison avant/après.'],
    ['Calculez vos quantités', 'Le calculateur reprend vos teintes et compose la commande, −15 % inclus.'],
  ];

  var SVG_APPAREIL = '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#17644f" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">'
    + '<path d="M14.5 4h-5L7.5 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3.5z"/>'
    + '<circle cx="12" cy="13" r="3.5"/></svg>';

  function demarrerSimulateur(config, script) {
    var hote = trouverHote(script, 'colibri-simulateur');
    var configurateur = cheminConfigurateur(
      script ? script.getAttribute('data-configurateur') : null,
      function () { console.warn.apply(console, arguments); }
    );
    var teinte = lireTeinteDemandee(window.location.search);
    var visuel = lireVisuel(hote.getAttribute('data-visuel'));
    var ombre = racineIsolee(hote, STYLES_PAGE);
    var page = creer('div', { class: 'page' });

    // 1. En-tête (deux colonnes avec le visuel, une sans)
    var texte = creer('div', {}, [
      creer('p', { class: 'surtitre', texte: 'Simulateur Colibri' }),
      creer('h1', { class: 'titre', texte: 'Essayez nos teintes et nos papiers peints chez vous, avant d’acheter' }),
      creer('p', {
        class: 'intro',
        texte: 'Prenez votre pièce en photo ou choisissez une pièce d’exemple, essayez nos teintes et nos papiers peints mur par mur, '
          + 'puis calculez les quantités exactes avec −15 % sur votre commande.',
      }),
    ]);
    var entete = creer('header', { class: visuel ? 'entete avec-visuel' : 'entete' }, [texte]);
    if (visuel) entete.appendChild(creer('img', { class: 'visuel', src: visuel, alt: '', loading: 'eager' }));
    page.appendChild(entete);

    if (!simulateurDisponible(config, kitPresent())) {
      page.appendChild(creer('section', {}, [
        creer('p', { class: 'message', texte: 'Le simulateur est momentanément indisponible.' }),
        creer('a', { class: 'bouton', href: configurateur, texte: 'Calculer mes quantités de peinture' }),
      ]));
      ombre.appendChild(page);
      return;
    }

    // 2. Choix de la pièce : le clic ouvre directement le simulateur
    var grille = creer('div', { class: 'pieces' });
    PIECES.forEach(function (piece) {
      var bouton = creer('button', { type: 'button', class: 'piece' }, [
        creer('img', { src: piece[2], alt: '', loading: 'lazy', referrerpolicy: 'no-referrer' }),
        creer('span', { texte: piece[1] }),
      ]);
      bouton.addEventListener('click', function () { essayer(piece[0], bouton); });
      grille.appendChild(bouton);
    });
    page.appendChild(creer('section', { 'aria-labelledby': 'colibri-question' }, [
      creer('h2', { class: 'question', id: 'colibri-question', texte: 'Quelle pièce voulez-vous transformer ?' }),
      creer('p', {
        class: 'sous-titre',
        texte: 'Ce sont les pièces du calculateur : vos quantités seront calculées pour la même pièce.',
      }),
      grille,
    ]));

    // 3. Étapes
    page.appendChild(creer('ol', { class: 'etapes' }, ETAPES.map(function (etape, index) {
      return creer('li', { class: 'etape' }, [
        creer('span', { class: 'numero', 'aria-hidden': 'true', texte: String(index + 1) }),
        creer('h3', { texte: etape[0] }),
        creer('p', { texte: etape[1] }),
      ]);
    })));

    // 4. Conseil photo
    var icone = creer('span');
    icone.innerHTML = SVG_APPAREIL;
    page.appendChild(creer('aside', { class: 'conseil' }, [
      icone,
      creer('p', {}, [
        creer('strong', { texte: 'Pour un rendu réaliste :' }),
        document.createTextNode(' photographiez la pièce de face, en lumière du jour, avec les murs les plus dégagés possible.'),
      ]),
    ]));

    ombre.appendChild(page);

    // Galerie Wizart, pour toutes les pièces : « Télécharger votre photo » en
    // premier, les pièces d'exemple à côté (décision du 26/10). La pièce reste
    // transmise au calculateur.
    function essayer(piece, bouton) {
      mesure.envoyer('simulateur_piece_choisie', { piece: piece });
      // Relue en cas de redirection du PIM Wizart (vendorCode[]) vers le configurateur
      ecrireSession(CLE_SESSION_PIECE, piece);
      ouvrirSimulateur({
        origineApp: config.origineApp,
        token: config.tokenWizart,
        piece: piece,
        teinte: teinte,
        essai: ESSAI_PHOTO,
        retour: RETOUR_BOUTIQUE,
        // Arrivée par le bouton « Voir dans ma pièce » d'une fiche (`?teinte=`)
        origine: origineSimulateur(teinte),
        surSelection: function (handles) {
          ecrireSession(CLE_SESSION_PIECE, null);
          window.location.href = urlConfigurateur(window.location.origin, piece, handles, configurateur);
        },
        surFermeture: function () {
          // Focus rendu à la pièce cliquée
          bouton.focus();
        },
      });
    }
  }

  // ===================== Mode bouton (fiche teinte ou papier peint) =====================

  var STYLES_BOUTON = STYLES_BASE + [
    ':host{display:inline-block;}',
    '.bouton{display:inline-flex;align-items:center;gap:8px;padding:10px 18px;border:2px solid #13302a;border-radius:8px;color:#13302a;background:#fff;font-size:15px;font-weight:600;line-height:1.3;text-decoration:none;}',
    '.bouton:hover{background:#e2f3ee;}',
  ].join('');

  function demarrerBouton(config, script) {
    var hote = trouverHote(script, 'colibri-bouton-teinte');
    var handle = lireHandle(hote.getAttribute('data-teinte'));
    // Sans simulateur configuré ou sans teinte valide : aucun bouton
    if (!simulateurDisponible(config, kitPresent()) || !handle) return;
    // Fiche papier peint : SKU de la variante choisie (data-variantes, facultatif)
    var variantes = lireVariantes(hote.getAttribute('data-variantes'), function () {
      console.warn.apply(console, arguments);
    });
    function cible() {
      return urlSimulateurTeinte(referenceBouton(handle, variantes, window.location.search));
    }
    var lien = creer('a', { class: 'bouton', href: cible(), texte: 'Voir dans ma pièce' });
    // Le thème change `?variant=` sans recharger la page : lien relu au clic
    lien.addEventListener('click', function () { lien.setAttribute('href', cible()); });
    racineIsolee(hote, STYLES_BOUTON).appendChild(lien);
  }

  // ===================== Démarrage =====================

  function demarrer(racine, config) {
    var script = document.currentScript;
    var mode = script ? script.getAttribute('data-colibri') : null;
    mesure = creerMesure({
      idGa4: config.idGa4,
      fenetre: racine,
      session: { lire: lireSession, ecrire: ecrireSession },
    });
    var lancer = function () {
      if (mode === 'configurateur') demarrerConfigurateur(config, script);
      else if (mode === 'simulateur') demarrerSimulateur(config, script);
      else if (mode === 'bouton') demarrerBouton(config, script);
      else console.warn('[Colibri] Attribut data-colibri manquant ou inconnu :', mode);
    };
    if (document.body) lancer();
    else document.addEventListener('DOMContentLoaded', lancer);
  }

  return {
    PIECES: PIECES,
    INTERIEURS_WIZART: INTERIEURS_WIZART,
    CAPACITE_SIMULATEUR: CAPACITE_SIMULATEUR,
    SCRIPT_DEPKIT: SCRIPT_DEPKIT,
    MAX_TEINTES: MAX_TEINTES,
    estTypePiece: estTypePiece,
    estHandle: estHandle,
    normaliserTeintes: normaliserTeintes,
    lireEntreeConfigurateur: lireEntreeConfigurateur,
    cheminIframe: cheminIframe,
    rechercheSansEntree: rechercheSansEntree,
    cheminConfigurateur: cheminConfigurateur,
    urlConfigurateur: urlConfigurateur,
    urlSimulateurTeinte: urlSimulateurTeinte,
    lireTeinteDemandee: lireTeinteDemandee,
    lireVariantes: lireVariantes,
    referenceBouton: referenceBouton,
    lireVisuel: lireVisuel,
    lireMessageApp: lireMessageApp,
    simulateurDisponible: simulateurDisponible,
    capacites: capacites,
    nomCourt: nomCourt,
    lireApplication: lireApplication,
    retenirTeinte: retenirTeinte,
    libelleUtiliser: libelleUtiliser,
    annonceTeintes: annonceTeintes,
    lireHex: lireHex,
    lireImage: lireImage,
    lireReference: lireReference,
    urlTeintes: urlTeintes,
    creerCouleursTeintes: creerCouleursTeintes,
    evenementsEcoutes: evenementsEcoutes,
    evenementsMesures: evenementsMesures,
    MESURES_CALCULATEUR: MESURES_CALCULATEUR,
    lireMesure: lireMesure,
    lireIdGa4: lireIdGa4,
    lireDebug: lireDebug,
    parametresCommuns: parametresCommuns,
    typeProduit: typeProduit,
    origineSimulateur: origineSimulateur,
    avantDelai: avantDelai,
    creerMesure: creerMesure,
    ORIGINE_PAGE_SIMULATEUR: ORIGINE_PAGE_SIMULATEUR,
    ORIGINE_CALCULATEUR: ORIGINE_CALCULATEUR,
    ORIGINE_FICHE_PRODUIT: ORIGINE_FICHE_PRODUIT,
    interieurWizart: interieurWizart,
    reglagesVisualiseur: reglagesVisualiseur,
    ESSAI_PHOTO: ESSAI_PHOTO,
    ESSAI_EXEMPLE: ESSAI_EXEMPLE,
    RETOUR_BOUTIQUE: RETOUR_BOUTIQUE,
    RETOUR_CALCULATEUR: RETOUR_CALCULATEUR,
    LOGO_COLIBRI: LOGO_COLIBRI,
    libelleRetour: libelleRetour,
    demarrer: demarrer,
  };
});
