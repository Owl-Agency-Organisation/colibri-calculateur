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
 * - `simulateur` : page Simulateur (question « Quelle pièce ? », consignes
 *   photo, simulateur plein écran, retour vers le configurateur) ;
 * - `bouton` : bouton « Voir dans ma pièce » d'une fiche teinte.
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

  // Même liste, mêmes libellés que l'app (lib/pieces.ts — vérifié par test)
  var PIECES = [
    ['piece-de-vie', 'Pièce de vie'],
    ['chambre', 'Chambre'],
    ['cuisine', 'Cuisine'],
    ['salle-de-bain', 'Salle de bain'],
    ['toilettes', 'Toilettes'],
    ['entree', 'Entrée'],
    ['couloir', 'Couloir'],
  ];

  var CAPACITE_SIMULATEUR = 'simulateur';
  var MAX_TEINTES = 50;
  var MAX_LONGUEUR_HANDLE = 255;
  var MOTIF_HANDLE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

  // Pièce choisie sur la page Simulateur, relue au retour du PIM Wizart
  // (redirection vers le configurateur avec `vendorCode[]`)
  var CLE_SESSION_PIECE = 'colibri-simulateur-piece';

  var CHEMIN_CONFIGURATEUR = '/pages/configurateur';
  var CHEMIN_SIMULATEUR = '/pages/simulateur';
  var CHEMIN_ARRIVEE_APP = '/calculateur/simulateur';

  // Version unique du DepKit : s'il ne charge pas, le simulateur se ferme
  var SCRIPT_DEPKIT = 'https://d18jpdcj6p6zg6.cloudfront.net/wizart-deployment-kit-v1.1.3.min.js';
  var DELAI_SCRIPT_MS = 15000;

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

  /** URL de retour vers le configurateur à la sortie du panier (page Simulateur). */
  function urlConfigurateur(origineBoutique, piece, teintes) {
    return origineBoutique + CHEMIN_CONFIGURATEUR
      + '?piece=' + encodeURIComponent(piece)
      + '&teintes=' + teintes.map(encodeURIComponent).join(',');
  }

  /** Lien du bouton « Voir dans ma pièce » d'une fiche teinte. */
  function urlSimulateurTeinte(handle) {
    return CHEMIN_SIMULATEUR + '?teinte=' + encodeURIComponent(handle);
  }

  /** Teinte demandée à l'ouverture de la page Simulateur (`?teinte=`). */
  function lireTeinteDemandee(recherche) {
    var teinte = (new URLSearchParams(recherche || '').get('teinte') || '').trim().toLowerCase();
    return estHandle(teinte) ? teinte : null;
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

  /**
   * Handles des produits du panier Wizart (référence produit = handle Shopify).
   * Forme réelle (DepKit v1.1.3, `OPEN_IN_STORE.data`) : tableaux parallèles,
   * `article_sku` (= `vendor_code` du PIM = handle), à défaut
   * `article_custom_sku`. Formes historiques encore acceptées : Array, ou objet
   * portant `products` / `items` / `cart`. Ordre du panier, sans doublon.
   */
  function extraireHandles(valeur) {
    var liste = [];
    if (Array.isArray(valeur)) {
      liste = valeur;
    } else if (estObjet(valeur)) {
      var cles = ['article_sku', 'article_custom_sku', 'products', 'items', 'cart'];
      for (var i = 0; i < cles.length; i++) {
        if (Array.isArray(valeur[cles[i]])) {
          liste = valeur[cles[i]];
          break;
        }
      }
    }
    var codes = liste.map(function (element) {
      if (typeof element === 'string') return element;
      if (estObjet(element)) {
        return element.vendor_code || element.vendorCode || element.sku || element.handle;
      }
      return null;
    });
    return normaliserTeintes(codes);
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

  var STYLES = [
    '.colibri-surimpression{position:fixed;inset:0;z-index:2147483000;background:#fff;}',
    '.colibri-attente{position:fixed;inset:0;z-index:2147483001;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;background:#fff;font-family:inherit;font-size:16px;line-height:1.4;color:#1e3a34;text-align:center;padding:24px;}',
    '.colibri-attente-rond{width:32px;height:32px;border-radius:50%;border:3px solid #d2f0ee;border-top-color:#1e3a34;animation:colibri-tourne 1s linear infinite;}',
    '@keyframes colibri-tourne{to{transform:rotate(360deg)}}',
    '.colibri-lien{background:none;border:0;padding:4px;color:#1e3a34;text-decoration:underline;cursor:pointer;font:inherit;}',
    '.colibri-simulateur{max-width:880px;margin:0 auto;padding:24px 16px;color:#1e3a34;}',
    '.colibri-simulateur h2{font-size:1.5rem;margin:0 0 8px;}',
    '.colibri-simulateur p{margin:0 0 16px;color:#4b5563;}',
    '.colibri-pieces{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px;margin:0 0 24px;}',
    '.colibri-piece{padding:14px 12px;border:2px solid #e5e7eb;border-radius:12px;background:#fff;color:#1e3a34;font-family:inherit;font-size:15px;font-weight:600;line-height:1.3;cursor:pointer;}',
    '.colibri-piece:hover,.colibri-piece:focus-visible{border-color:#007c7a;background:#f0f9f8;}',
    '.colibri-consignes{background:#f0f9f8;border-radius:12px;padding:16px 20px;}',
    '.colibri-consignes h3{font-size:1rem;margin:0 0 8px;}',
    '.colibri-consignes ul{margin:0;padding-left:20px;color:#4b5563;}',
    '.colibri-consignes li{margin:4px 0;}',
    '.colibri-message{padding:12px 16px;border-radius:12px;background:#fef3c7;color:#92400e;margin:0 0 16px;}',
    '.colibri-bouton{display:inline-flex;align-items:center;gap:8px;padding:10px 18px;border:2px solid #1e3a34;border-radius:8px;color:#1e3a34;background:#fff;font-weight:600;text-decoration:none;}',
    '.colibri-bouton:hover{background:#f0f9f8;}',
  ].join('');

  function injecterStyles() {
    if (document.getElementById('colibri-styles')) return;
    document.head.appendChild(creer('style', { id: 'colibri-styles', texte: STYLES }));
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
   * Ouvre le simulateur en surimpression plein écran.
   * options : { token, teinte, surSelection(handles), surFermeture() }.
   * Un seul simulateur à la fois ; toute issue appelle exactement un rappel.
   */
  var simulateurOuvert = null;

  function ouvrirSimulateur(options) {
    if (simulateurOuvert) simulateurOuvert.fermer(false);

    injecterStyles();
    var racine = document.documentElement;
    var debordementInitial = racine.style.overflow;
    racine.style.overflow = 'hidden';

    var conteneur = creer('div', { class: 'colibri-surimpression', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Simulateur de teintes' });
    var cible = creer('div');
    var boutonFermer = creer('button', { type: 'button', class: 'colibri-lien', texte: 'Fermer' });
    var attente = creer('div', { class: 'colibri-attente', role: 'status' }, [
      creer('div', { class: 'colibri-attente-rond' }),
      creer('p', { texte: 'Chargement du simulateur…' }),
      boutonFermer,
    ]);
    conteneur.appendChild(cible);
    conteneur.appendChild(attente);
    document.body.appendChild(conteneur);

    var visualiseur = null;
    var abonnements = [];
    var termine = false;
    var session = {};

    function nettoyer() {
      var kit = kitPresent();
      abonnements.forEach(function (id) {
        try { if (kit) kit.EventBus.unsubscribe(id); } catch (e) { /* déjà désabonné */ }
      });
      abonnements = [];
      try { if (visualiseur) visualiseur.destroy(); } catch (e) { /* déjà détruit par le DepKit */ }
      visualiseur = null;
      if (conteneur.parentNode) conteneur.parentNode.removeChild(conteneur);
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
      if (termine) return;
      if (handles.length === 0) {
        session.fermer();
        return;
      }
      termine = true;
      nettoyer();
      options.surSelection(handles);
    }

    // Sortie du panier : teintes lues dans l'événement, fermeture immédiate
    // (getShoppingCartState() ne répond pas en v1.1.3)
    function sortiePanier(donneesEvenement) {
      selectionner(extraireHandles(donneesEvenement));
    }

    boutonFermer.addEventListener('click', function () { session.fermer(); });
    simulateurOuvert = session;

    chargerKit().then(function (kit) {
      if (termine) return;
      var evenements = kit.VISUALIZER_EVENTS || {};
      Object.keys(evenements).forEach(function (cle) {
        var valeur = evenements[cle];
        // OPEN_IN_STORE est émis en premier au clic sur « Calculer mes
        // quantités » : la sortie ferme le simulateur avant que le menu de
        // choix Wizart (CHECKOUT_OPTIONS_OPEN) s'affiche
        var sortie = cle === 'OPEN_IN_STORE' || valeur === 'open_in_store';
        var retour = cle === 'BACK_BUTTON_CLICK';
        if (!sortie && !retour) return;
        abonnements.push(kit.EventBus.subscribe(function (evenement) {
          if (sortie) sortiePanier(evenement && evenement.data);
          // Le DepKit détruit lui-même le visualiseur sur le bouton retour
          else session.fermer();
        }, valeur, null));
      });

      var reglages = {
        token: options.token,
        layoutSettings: { targetElement: cible, layout: kit.LAYOUTS && kit.LAYOUTS.FULL_SCREEN },
        integrationSettings: { locale: 'fr' },
      };
      if (options.teinte) reglages.sceneData = { openWithProduct: options.teinte };
      visualiseur = new kit.Visualizer(reglages);
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
        // Si le PIM redirige malgré tout vers le configurateur, la pièce est connue
        ecrireSession(CLE_SESSION_PIECE, data.piece);
        ouvrirSimulateur({
          token: config.tokenWizart,
          teinte: data.teinte,
          surSelection: function (handles) {
            ecrireSession(CLE_SESSION_PIECE, null);
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

  // ===================== Mode simulateur =====================

  var CONSIGNES_PHOTO = [
    'Photographiez la pièce de face, à hauteur d’yeux, en cadrant les murs à peindre.',
    'Privilégiez la lumière du jour et évitez le contre-jour.',
    'Dégagez si possible les murs (meubles, cadres) pour un rendu plus fidèle.',
    'Vous pouvez aussi partir d’une pièce d’exemple de la galerie.',
  ];

  function demarrerSimulateur(config, script) {
    var hote = trouverHote(script, 'colibri-simulateur');
    var teinte = lireTeinteDemandee(window.location.search);
    injecterStyles();

    var bloc = creer('div', { class: 'colibri-simulateur' });
    bloc.appendChild(creer('h2', { texte: 'Quelle pièce voulez-vous repeindre ?' }));

    if (!simulateurDisponible(config, kitPresent())) {
      bloc.appendChild(creer('p', { class: 'colibri-message', texte: 'Le simulateur est momentanément indisponible.' }));
      bloc.appendChild(creer('a', { class: 'colibri-bouton', href: CHEMIN_CONFIGURATEUR, texte: 'Calculer mes quantités de peinture' }));
      hote.appendChild(bloc);
      return;
    }

    bloc.appendChild(creer('p', { texte: 'Choisissez la pièce, puis essayez nos teintes sur une photo de votre intérieur.' }));
    var grille = creer('div', { class: 'colibri-pieces' });
    PIECES.forEach(function (piece) {
      var bouton = creer('button', { type: 'button', class: 'colibri-piece', texte: piece[1] });
      bouton.addEventListener('click', function () { essayer(piece[0]); });
      grille.appendChild(bouton);
    });
    bloc.appendChild(grille);

    var consignes = creer('div', { class: 'colibri-consignes' }, [
      creer('h3', { texte: 'Pour une photo réussie' }),
      creer('ul', {}, CONSIGNES_PHOTO.map(function (texte) { return creer('li', { texte: texte }); })),
    ]);
    bloc.appendChild(consignes);
    hote.appendChild(bloc);

    function essayer(piece) {
      // Relue au retour du PIM Wizart (vendorCode[]) sur le configurateur
      ecrireSession(CLE_SESSION_PIECE, piece);
      ouvrirSimulateur({
        token: config.tokenWizart,
        teinte: teinte,
        surSelection: function (handles) {
          ecrireSession(CLE_SESSION_PIECE, null);
          window.location.href = urlConfigurateur(window.location.origin, piece, handles);
        },
        surFermeture: function () {
          // Retour à la question « Quelle pièce ? »
        },
      });
    }
  }

  // ===================== Mode bouton (fiche teinte) =====================

  function demarrerBouton(config, script) {
    var hote = trouverHote(script, 'colibri-bouton-teinte');
    var handle = (hote.getAttribute('data-teinte') || '').trim().toLowerCase();
    // Sans simulateur configuré ou sans teinte valide : aucun bouton
    if (!simulateurDisponible(config, kitPresent()) || !estHandle(handle)) return;
    injecterStyles();
    hote.appendChild(creer('a', { class: 'colibri-bouton', href: urlSimulateurTeinte(handle), texte: 'Voir dans ma pièce' }));
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
    CAPACITE_SIMULATEUR: CAPACITE_SIMULATEUR,
    SCRIPT_DEPKIT: SCRIPT_DEPKIT,
    estTypePiece: estTypePiece,
    estHandle: estHandle,
    normaliserTeintes: normaliserTeintes,
    lireEntreeConfigurateur: lireEntreeConfigurateur,
    cheminIframe: cheminIframe,
    rechercheSansEntree: rechercheSansEntree,
    urlConfigurateur: urlConfigurateur,
    urlSimulateurTeinte: urlSimulateurTeinte,
    lireTeinteDemandee: lireTeinteDemandee,
    lireMessageApp: lireMessageApp,
    simulateurDisponible: simulateurDisponible,
    capacites: capacites,
    extraireHandles: extraireHandles,
    demarrer: demarrer,
  };
});
