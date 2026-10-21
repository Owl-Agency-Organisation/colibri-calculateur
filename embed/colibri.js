/*
 * Colibri — script d'intégration des pages Shopify.
 *
 * Servi par l'app sous `/embed/colibri.js` (app/embed/colibri.js/route.ts) avec
 * sa configuration injectée (origine de l'app = origine du script, token
 * Wizart). Aucune logique dans le thème Shopify : chaque page appelle ce script
 * en deux lignes (docs/EMBED_SHOPIFY.md). Mode lu sur `data-colibri` :
 *
 * - `configurateur` : iframe de l'app (hauteur, retour en haut, redirections —
 *   comportement historique inchangé), entrée depuis le simulateur, annonce des
 *   capacités, simulateur Wizart en surimpression à la demande de l'app ;
 * - `simulateur` : page Simulateur (en-tête, « Quelle pièce ? », étapes,
 *   conseil photo, simulateur plein écran, retour vers le configurateur) ;
 * - `bouton` : bouton « Voir dans ma pièce » d'une fiche teinte.
 *
 * Wizart ne sert qu'à visualiser : les teintes appliquées sur les murs
 * (`PRODUCT_APPLY`) sont retenues par la barre Colibri, seule sortie du
 * simulateur (« Fermer » / « Utiliser… »). Le panier Wizart n'est pas utilisé.
 *
 * Tout le rendu est isolé dans un Shadow DOM : les styles du thème ne
 * l'atteignent pas (la police reste héritée du site).
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

  // Pièce choisie sur la page Simulateur, relue au retour du PIM Wizart
  // (redirection vers le configurateur avec `vendorCode[]`)
  var CLE_SESSION_PIECE = 'colibri-simulateur-piece';

  var CHEMIN_CONFIGURATEUR = '/pages/configurateur';
  // Chemin absolu du site : `/` suivi de caractères d'URL sûrs (jamais `//`)
  var MOTIF_CHEMIN_SITE = /^\/(?!\/)[A-Za-z0-9\-._~\/]*$/;
  var CHEMIN_SIMULATEUR = '/pages/simulateur';
  var CHEMIN_ARRIVEE_APP = '/calculateur/simulateur';
  var CHEMIN_API_TEINTES = '/api/embed/teintes';
  var CHEMIN_LOGO = '/logo-colibri.png';

  // Version unique du DepKit : s'il ne charge pas, le simulateur se ferme
  var SCRIPT_DEPKIT = 'https://d18jpdcj6p6zg6.cloudfront.net/wizart-deployment-kit-v1.1.3.min.js';
  var DELAI_SCRIPT_MS = 15000;

  // Événements Wizart écoutés : application d'une teinte, retour (sécurité)
  var EVENEMENT_APPLICATION = 'PRODUCT_APPLY';
  var EVENEMENT_RETOUR = 'BACK_BUTTON_CLICK';

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
      default:
        return null;
    }
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

  /** Libellé du bouton principal de la barre (désactivé à 0 teinte). */
  function libelleUtiliser(nombre) {
    if (nombre === 0) return 'Utiliser mes teintes →';
    return nombre > 1
      ? 'Utiliser ces teintes (' + nombre + ') →'
      : 'Utiliser cette teinte →';
  }

  /** Annonce du nombre de teintes (lecteurs d'écran). */
  function annonceTeintes(nombre) {
    if (nombre === 0) return 'Aucune teinte retenue';
    return nombre === 1 ? '1 teinte retenue' : nombre + ' teintes retenues';
  }

  /** Couleur d'une pastille : code hexadécimal valide, sinon null (nom seul). */
  function lireHex(valeur) {
    return typeof valeur === 'string' && MOTIF_HEX.test(valeur.trim()) ? valeur.trim() : null;
  }

  /** URL de l'endpoint des couleurs de teintes de l'app. */
  function urlTeintes(origineApp, handles) {
    return origineApp + CHEMIN_API_TEINTES + '?handles=' + handles.map(encodeURIComponent).join(',');
  }

  /**
   * Valeurs Wizart écoutées : application d'une teinte (retenue par la barre)
   * et bouton retour (ferme comme « Fermer », par sécurité : il est masqué).
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

  /** UUID de l'intérieur Wizart d'un type de pièce, ou null (galerie). */
  function interieurWizart(piece) {
    return estTypePiece(piece) ? INTERIEURS_WIZART[piece] || null : null;
  }

  /**
   * Réglages du DepKit : Wizart remplit la zone au-dessus de la barre
   * (`FILL_PARENT` — `FULL_SCREEN` la recouvrirait), en français, sans bouton
   * « Retour au site », ouvert dans l'intérieur du type de pièce s'il en a un
   * et sur la teinte demandée le cas échéant (les deux se combinent).
   */
  function reglagesVisualiseur(kit, token, cible, teinte, piece) {
    var reglages = {
      token: token,
      layoutSettings: { targetElement: cible, layout: kit.LAYOUTS && kit.LAYOUTS.FILL_PARENT },
      integrationSettings: { locale: 'fr', showBackToWebsiteButton: false },
    };
    var scene = {};
    var interieur = interieurWizart(piece);
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
    // Barre Colibri (valeurs de la maquette)
    '.barre{flex:0 0 auto;display:flex;align-items:center;gap:12px;padding:14px 20px;padding-bottom:calc(14px + env(safe-area-inset-bottom, 0px));background:#13302a;color:#fff;line-height:1.3;}',
    '.haut{display:flex;align-items:center;gap:12px;min-width:0;}',
    '.actions{display:contents;}',
    '.logo{flex:0 0 auto;display:inline-flex;align-items:center;background:#fff;padding:3px 6px;border-radius:4px;}',
    '.logo img{display:block;height:22px;width:auto;}',
    '.libelle{flex:0 0 auto;font-size:13px;color:#cfe3dc;white-space:nowrap;}',
    '.teintes{display:flex;align-items:center;gap:8px;min-width:0;overflow-x:auto;scrollbar-width:none;margin:0;padding:0;list-style:none;}',
    '.teintes::-webkit-scrollbar{display:none;}',
    '.pastille{flex:0 0 auto;display:inline-flex;align-items:center;gap:8px;background:rgba(255,255,255,0.12);border-radius:999px;padding:4px 14px 4px 4px;font-size:14px;white-space:nowrap;}',
    '.pastille.sans-couleur{padding:4px 14px;min-height:36px;}',
    '.rond{flex:0 0 auto;width:24px;height:24px;box-sizing:content-box;border:2px solid #fff;border-radius:50%;}',
    '.vide{font-size:13px;color:#cfe3dc;}',
    '.fermer{margin-left:auto;flex:0 0 auto;background:transparent;color:#fff;border:1px solid rgba(255,255,255,0.6);border-radius:6px;padding:11px 16px;font-size:14px;line-height:1.2;cursor:pointer;}',
    '.fermer:hover{background:rgba(255,255,255,0.08);}',
    '.utiliser{flex:0 0 auto;background:#fff;color:#13302a;border:0;border-radius:6px;padding:12px 20px;font-size:15px;font-weight:600;line-height:1.2;cursor:pointer;white-space:nowrap;}',
    '.utiliser:disabled{opacity:0.45;cursor:not-allowed;}',
    '.fermer:focus-visible,.utiliser:focus-visible{outline:2px solid #2fae94;outline-offset:2px;}',
    '@media (max-width:639px){',
    '.barre{flex-direction:column;align-items:stretch;}',
    '.haut{width:100%;}',
    // Ligne du haut réservée au libellé et aux pastilles (maquette mobile)
    '.logo{display:none;}',
    '.actions{display:flex;gap:12px;}',
    '.fermer{margin-left:0;min-height:44px;}',
    '.utiliser{flex:1 1 auto;min-height:44px;}',
    '}',
  ].join('');

  /**
   * Couleurs des teintes, demandées à l'app par lots (`requete(url)` → Promise
   * d'une réponse fetch). Seules les réponses obtenues sont mémorisées : une
   * teinte absente de la réponse (inconnue du catalogue) reste sans couleur ;
   * un échec (réseau, HTTP, réponse illisible) n'est pas retenu, les handles
   * sont redemandés au prochain rendu de la barre. Les pastilles restent
   * sans rond de couleur en attendant : la sortie n'est jamais bloquée.
   */
  function creerCouleursTeintes(requete) {
    var connues = {};
    var enCours = {};

    function hex(handle) {
      return Object.prototype.hasOwnProperty.call(connues, handle) ? connues[handle] : null;
    }

    /** Retourne la Promise de la requête lancée, ou null s'il n'y avait rien à demander. */
    function chargerCouleurs(origineApp, handles, rappel) {
      var aDemander = handles.filter(function (h) {
        return !Object.prototype.hasOwnProperty.call(connues, h) && !enCours[h];
      });
      if (aDemander.length === 0) return null;
      aDemander.forEach(function (h) { enCours[h] = true; });
      function liberer() { aDemander.forEach(function (h) { delete enCours[h]; }); }

      return Promise.resolve()
        .then(function () { return requete(urlTeintes(origineApp, aDemander)); })
        .then(function (reponse) {
          if (!reponse || !reponse.ok) throw new Error('HTTP ' + (reponse && reponse.status));
          return reponse.json();
        })
        .then(function (liste) {
          if (!Array.isArray(liste)) throw new Error('réponse illisible');
          var recues = {};
          liste.forEach(function (t) {
            if (estObjet(t) && aDemander.indexOf(t.handle) !== -1) recues[t.handle] = lireHex(t.hex);
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
    }

    return { hex: hex, chargerCouleurs: chargerCouleurs };
  }

  // Couleurs des teintes pour la page (une seule instance)
  var couleursTeintes = creerCouleursTeintes(function (url) {
    return fetch(url, { credentials: 'omit' });
  });

  /**
   * Barre Colibri : teintes essayées, « Fermer » et « Utiliser… ».
   * options : { origineApp, surFermer(), surUtiliser() }.
   */
  function creerBarre(options) {
    var barre = creer('div', { class: 'barre', role: 'region', 'aria-label': 'Teintes essayées' });
    var logo = creer('span', { class: 'logo' }, [
      creer('img', { src: options.origineApp + CHEMIN_LOGO, alt: 'Colibri', height: '22' }),
    ]);
    var liste = creer('ul', { class: 'teintes' });
    var annonce = creer('span', { class: 'colibri-masque', 'aria-live': 'polite' });
    var fermer = creer('button', { type: 'button', class: 'fermer', texte: 'Fermer' });
    var utiliser = creer('button', { type: 'button', class: 'utiliser' });

    barre.appendChild(creer('div', { class: 'haut' }, [
      logo,
      creer('span', { class: 'libelle', texte: 'Teintes essayées' }),
      liste,
      annonce,
    ]));
    barre.appendChild(creer('div', { class: 'actions' }, [fermer, utiliser]));

    fermer.addEventListener('click', function () { options.surFermer(); });
    utiliser.addEventListener('click', function () { options.surUtiliser(); });

    var teintes = [];

    function rendre() {
      liste.textContent = '';
      if (teintes.length === 0) {
        liste.appendChild(creer('li', { class: 'vide', texte: 'Appliquez une teinte sur un mur pour la retenir' }));
      }
      teintes.forEach(function (teinte) {
        var hex = couleursTeintes.hex(teinte.handle);
        var pastille = creer('li', { class: hex ? 'pastille' : 'pastille sans-couleur' });
        if (hex) {
          var rond = creer('span', { class: 'rond', 'aria-hidden': 'true' });
          rond.style.backgroundColor = hex;
          pastille.appendChild(rond);
        }
        pastille.appendChild(creer('span', { texte: teinte.nom }));
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
   * options : { origineApp, token, piece, teinte, surSelection(handles), surFermeture() }.
   * Un seul simulateur à la fois ; toute issue appelle exactement un rappel.
   * Les teintes retenues repartent de zéro à chaque ouverture.
   */
  var simulateurOuvert = null;

  function ouvrirSimulateur(options) {
    if (simulateurOuvert) simulateurOuvert.fermer(false);

    var racine = document.documentElement;
    var debordementInitial = racine.style.overflow;
    racine.style.overflow = 'hidden';

    // Hôte dans la page (styles en ligne : le thème ne peut pas le déplacer)
    var hote = creer('div', { 'data-colibri': 'surimpression' });
    hote.style.cssText = 'position:fixed;inset:0;z-index:2147483000;display:block;margin:0;padding:0;border:0;';
    var ombre = racineIsolee(hote, STYLES_SURIMPRESSION);

    // Zone Wizart : élément de la page projeté dans la surimpression (slot),
    // pour que le DepKit y travaille comme dans un document ordinaire
    var cible = creer('div', { slot: 'wizart' });
    cible.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;margin:0;padding:0;border:0;';

    var boutonAttente = creer('button', { type: 'button', class: 'lien', texte: 'Fermer' });
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
      surFermer: function () { session.fermer(); },
      surUtiliser: function () {
        selectionner(teintes.map(function (t) { return t.handle; }));
      },
    });

    ombre.appendChild(creer('div', {
      class: 'surimpression', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Simulateur de teintes',
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

    function selectionner(handles) {
      if (termine || handles.length === 0) return;
      termine = true;
      nettoyer();
      options.surSelection(handles);
    }

    // Chaque application d'une teinte sur un mur la retient (nettoyer la
    // surface ne retire rien)
    function appliquer(donnees) {
      if (termine) return;
      var appliquees = lireApplication(donnees);
      if (appliquees.length === 0) return;
      appliquees.forEach(function (teinte) { teintes = retenirTeinte(teintes, teinte); });
      barre.definir(teintes);
    }

    boutonAttente.addEventListener('click', function () { session.fermer(); });
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
        abonnements.push(kit.EventBus.subscribe(function () { session.fermer(); }, valeur, null));
      });

      visualiseur = new kit.Visualizer(reglagesVisualiseur(kit, options.token, cible, options.teinte, options.piece));
      return Promise.resolve(visualiseur.load()).then(function () {
        return visualiseur.show();
      }).then(function () {
        if (!termine && attente.parentNode) attente.parentNode.removeChild(attente);
      });
    }).catch(function (erreur) {
      // Simulateur indisponible : retour à l'état d'avant, sans blocage
      console.warn('[Colibri] Simulateur indisponible', erreur);
      session.fermer();
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
    ['Choisissez votre pièce', 'Votre photo, ou une pièce d’exemple du même type.'],
    ['Essayez les teintes', 'Une teinte par mur, comparaison avant/après, réglage de la lumière.'],
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
      creer('p', { class: 'surtitre', texte: 'Simulateur de peinture' }),
      creer('h1', { class: 'titre', texte: 'Essayez nos teintes chez vous, avant d’acheter' }),
      creer('p', {
        class: 'intro',
        texte: 'Prenez votre pièce en photo ou choisissez une pièce d’exemple, appliquez nos teintes mur par mur, '
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

    // 2. Choix de la pièce
    var grille = creer('div', { class: 'pieces' });
    PIECES.forEach(function (piece) {
      var bouton = creer('button', { type: 'button', class: 'piece' }, [
        creer('img', { src: piece[2], alt: '', loading: 'lazy', referrerpolicy: 'no-referrer' }),
        creer('span', { texte: piece[1] }),
      ]);
      bouton.addEventListener('click', function () { essayer(piece[0]); });
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

    function essayer(piece) {
      // Relue en cas de redirection du PIM Wizart (vendorCode[]) vers le configurateur
      ecrireSession(CLE_SESSION_PIECE, piece);
      ouvrirSimulateur({
        origineApp: config.origineApp,
        token: config.tokenWizart,
        piece: piece,
        teinte: teinte,
        surSelection: function (handles) {
          ecrireSession(CLE_SESSION_PIECE, null);
          window.location.href = urlConfigurateur(window.location.origin, piece, handles, configurateur);
        },
        surFermeture: function () {
          // Retour à la question « Quelle pièce ? »
        },
      });
    }
  }

  // ===================== Mode bouton (fiche teinte) =====================

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
    racineIsolee(hote, STYLES_BOUTON)
      .appendChild(creer('a', { class: 'bouton', href: urlSimulateurTeinte(handle), texte: 'Voir dans ma pièce' }));
  }

  // ===================== Démarrage =====================

  function demarrer(racine, config) {
    var script = document.currentScript;
    var mode = script ? script.getAttribute('data-colibri') : null;
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
    urlTeintes: urlTeintes,
    creerCouleursTeintes: creerCouleursTeintes,
    evenementsEcoutes: evenementsEcoutes,
    interieurWizart: interieurWizart,
    reglagesVisualiseur: reglagesVisualiseur,
    demarrer: demarrer,
  };
});
