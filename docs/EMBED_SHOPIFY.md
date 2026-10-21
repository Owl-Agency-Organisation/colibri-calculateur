# Intégration Shopify — script hébergé `/embed/colibri.js`

Aucune logique n'est écrite dans le thème Shopify. Toute la logique des pages
Shopify vit dans un script servi par l'app :

```
https://calculateur.colibripeinture.com/embed/colibri.js
```

- Source versionnée : `embed/colibri.js` (sans dépendance, logique pure testée
  par `embed/colibri.test.ts`), servie par `app/embed/colibri.js/route.ts`.
- Cache court (`max-age=300`) : un correctif déployé est pris par les
  navigateurs en 5 minutes au plus.
- Configuration injectée au moment de servir :
  - **origine de l'app = origine du script** : le script servi par un preview
    Vercel pilote ce preview ;
  - **token Wizart** = `NEXT_PUBLIC_WIZART_TOKEN` (variable Vercel, lue au build :
    un ajout ou un changement exige un redéploiement). Absent : pas de
    simulateur (aucune entrée dans l'app, pas de bouton sur les fiches teintes et papier peint,
    message « momentanément indisponible » sur la page Simulateur).
- Chaque page appelle le script en deux lignes : un élément hôte + la balise
  `<script>` avec l'attribut `data-colibri` qui fixe le mode.
- Le simulateur Wizart (Deployment Kit) n'est chargé que sur la page Simulateur
  et à l'ouverture de la surimpression depuis le configurateur.
- Tout le rendu du script (page Simulateur, surimpression et barre, bouton des
  fiches produit) est isolé dans un **Shadow DOM** : les styles du thème ne
  l'atteignent pas ; seule la police est héritée du site.

### Simulateur : Wizart visualise, Colibri retient les teintes

La surimpression (plein écran, au-dessus du site) contient deux parties :

- en haut, la zone Wizart (DepKit v1.1.3 en `FILL_PARENT`, `locale: 'fr'`,
  `showBackToWebsiteButton: false`, ouverture dans un intérieur du type de
  pièce avec `openInRoom`, sur une teinte avec `openWithProduct`) ;
- en bas, la **barre Colibri**, toujours visible : « Teintes essayées »
  (pastilles), « Fermer » et « Utiliser cette teinte → » /
  « Utiliser ces teintes (n) → » (« Utiliser mes teintes → », désactivé, tant
  qu'aucune teinte n'est appliquée).

Chaque teinte appliquée sur un mur (`PRODUCT_APPLY`, handle = `article_sku`, à
défaut `article_custom_sku`) est retenue dans l'ordre d'application ; une
teinte réappliquée passe en dernier, la dernière est donc toujours la plus
récente. Nettoyer une surface ne retire rien ; la liste repart de zéro à chaque
ouverture. La sortie ne passe que par la barre : le panier Wizart
(`OPEN_IN_STORE`) n'est plus écouté ; `BACK_BUTTON_CLICK` ferme comme
« Fermer » (sécurité, le bouton est masqué).

Couleur des pastilles : `GET /api/embed/teintes?handles=r1,r2` →
`[{ handle, nom, hex, type, image, lien }]` (CORS limité à
`https://www.colibripeinture.com` et à l'origine de l'app ; cache 5 min ;
jamais de prix). Chaque référence est d'abord cherchée comme handle de teinte,
puis comme SKU de variante papier peint (côté serveur) :

| Référence | `type` | `nom` | `hex` | `image` | `lien` |
|---|---|---|---|---|---|
| Teinte (`deguesde-peinture-…`) | `peinture` | nom court (« Deguesde ») | metafield `custom.code_hexadecimal` | `null` | `null` |
| Papier peint (`pp-montg-terracotta-le`) | `papier-peint` | « {Motif} {Coloris} » (« Montgolfières Terracotta », « Rayures bleues ») | `null` | image de la variante | fiche `…/products/{handle}?variant={id}` |
| Inconnue | — absente de la réponse | | | | |

La pastille d'une teinte montre un rond de couleur, celle d'un papier peint
une vignette ronde de l'image (https seulement), puis le nom. Si rien
n'arrive, la pastille affiche le nom seul : la barre ne bloque jamais la
sortie. Un échec (réseau, erreur serveur) n'est pas mémorisé : la couleur est
redemandée au prochain rendu de la barre. Admin API indisponible : les teintes
sont renvoyées sans les papiers peints (réponse non mise en cache).

### Papiers peints dans le simulateur

Décision du 21/10/2026 : les papiers peints Colibri sont dans le catalogue
Wizart (même surface « murs » que la peinture). **Référence Wizart d'un
papier peint = SKU de sa variante « Lé »** (`unique_sku_id`, donc
`article_sku` dans `PRODUCT_APPLY`), par exemple `pp-montg-terracotta-le` :
unique, stable, et elle respecte le motif des handles. Le handle produit seul
ne dirait pas le coloris. Le script ne distingue jamais une teinte d'un papier
peint : l'app le fait côté serveur (Admin API, la Storefront API ne cherchant
pas par SKU). Le contrat de messages `colibri:simulateur:*` est inchangé : les
SKU passent dans `teintes` tels quels.

Un papier peint **ne se calcule pas** : l'app l'affiche avec « Voir la fiche »
(écran d'arrivée, popup couleur, récapitulatif) et le client le commande
depuis sa fiche. À l'arrivée, le mur créé reçoit la dernière **peinture**
appliquée ; avec des papiers peints seuls, le mur reste sans couleur.

### Intérieur d'exemple selon le type de pièce

Le type de pièce est toujours connu (carte de la page Simulateur, ou `piece`
du message `colibri:simulateur:ouvrir` envoyé par l'app). Wizart s'ouvre
directement dans un intérieur d'exemple de ce type (`sceneData.openInRoom`,
transmis à Wizart en `room_uuid`), combiné avec `openWithProduct` quand une
teinte est demandée. Le client garde « Changer l'intérieur » (en haut à gauche
dans Wizart) pour revenir à la galerie et à « Télécharger votre photo ». La
galerie Wizart ne se filtre pas par type de pièce : aucun réglage du DepKit ne
le permet.

Correspondance (table `INTERIEURS_WIZART` de `embed/colibri.js`, relevée le
16/10/2026 sur le compte Colibri) :

| Type Colibri | Intérieur Wizart | `room_uuid` |
|---|---|---|
| `piece-de-vie` | Wizart_012, salon, 3 murs | `0ccc39c1-6379-4070-934d-f7459ce15247` |
| `chambre` | Wizart_017, chambre adulte, 2 murs | `1103ea18-8a07-4f59-a1d3-86d08b406755` |
| `cuisine` | Wizart_018, cuisine avec mur dégagé | `fe9bfc03-6fe5-403d-a6a1-5feb5c71c10c` |
| `salle-de-bain` | Wizart GO-6041 2, salle de bain avec WC | `00bb8d0e-5dcc-4893-93bc-d4b1b79ae60f` |
| `toilettes` | le même (seul intérieur avec WC) | `00bb8d0e-5dcc-4893-93bc-d4b1b79ae60f` |
| `entree` | aucun intérieur adapté | — (galerie) |
| `couloir` | aucun intérieur adapté | — (galerie) |

**Retrouver les UUID** : ouvrir le simulateur, laisser la galerie s'afficher,
puis dans l'onglet Réseau des outils du navigateur, lire la réponse de
`rni.wizart.ai/api/rooms` : chaque intérieur y figure avec son `uuid` et son
type (`room_type_title`). Mettre à jour la table et son test
(`embed/colibri.test.ts`).

**UUID inconnu** (intérieur supprimé ou renommé côté Wizart) : sans risque,
Wizart s'ouvre sur la galerie, comme pour l'entrée et le couloir, sans erreur
visible. Le labo `/labo/pont` affiche l'intérieur demandé par le script
(« Intérieur : chambre (1103ea18…) » ou « Galerie »).

Contrat de messages entre la page et l'iframe : `lib/embed-messages.ts`.

---

## 1. Bloc configurateur — page `/pages/configurateur`

Bloc **HTML personnalisé** (remplace intégralement le code actuel) :

```html
<div id="colibri-configurator"></div>
<script src="https://calculateur.colibripeinture.com/embed/colibri.js" data-colibri="configurateur"></script>
```

Ce que fait le script :

- reprend à l'identique le comportement actuel : création de l'iframe, hauteur
  de secours 900 px, `colibri:resize`, `colibri:scrollTop` (retour en haut
  instantané), `colibri:redirect`, contrôle d'origine des messages ;
- entrée depuis le simulateur : si l'URL porte `?piece=…&teintes=…` (retour de
  la page Simulateur), ou les paramètres Wizart `vendorCode[]` (redirection du
  PIM) avec la pièce mémorisée dans la session, l'iframe ouvre l'écran
  « Votre sélection du simulateur » ; les paramètres sont ensuite retirés de
  l'URL de la page. Un seul mur est créé, avec la dernière teinte appliquée
  (la plus récente) ; toutes les teintes rejoignent « Vos teintes essayées »
  (12 au plus, la plus récente en tête). Wizart n'expose pas l'état de la
  scène (nombre de murs, teinte de chaque mur) : seul l'ordre d'application
  est connu ;
- annonce `colibri:parent:pret` à l'app à chaque chargement de l'iframe (avec
  la capacité `simulateur` seulement si le token Wizart est configuré) ;
- à la demande de l'app (popup couleur d'un mur), ouvre le simulateur en
  surimpression plein écran au-dessus de la page, sur la teinte demandée le cas
  échéant. « Utiliser… » renvoie à l'app les teintes appliquées
  (`colibri:simulateur:selection`, ordre d'application) : la dernière est
  posée sur le mur de la popup, toutes rejoignent « Vos teintes essayées ».
  « Fermer » envoie `colibri:simulateur:ferme`. La saisie en cours dans l'app
  n'est jamais perdue.

## 2. Bloc simulateur — page `/pages/simulateur`

Créer une page Shopify `simulateur` (gabarit page standard) avec un bloc
**HTML personnalisé** :

```html
<div id="colibri-simulateur" data-visuel="https://cdn.shopify.com/s/files/…/visuel-simulateur.jpg"></div>
<script src="https://calculateur.colibripeinture.com/embed/colibri.js" data-colibri="simulateur"></script>
```

- `data-visuel` (facultatif) : URL de l'image de l'en-tête (à déposer dans
  Shopify, Contenu → Fichiers). Sans attribut, l'en-tête tient sur une colonne.

Ce que fait le script : en-tête (« Essayez nos teintes chez vous, avant
d'acheter »), « Quelle pièce voulez-vous transformer ? » (7 cartes, mêmes
images et libellés que l'étape « Pièce » du configurateur), trois étapes,
conseil photo ; `?teinte={handle}` ouvre le simulateur sur ce produit. Le clic
sur une pièce ouvre le simulateur (surimpression et barre Colibri).
« Utiliser… » : navigation vers
`/pages/configurateur?piece={type}&teintes={h1},{h2}` (ordre d'application ;
la dernière est posée sur le Mur 1, toutes rejoignent « Vos teintes
essayées »). « Fermer » : retour à la question.

- `data-configurateur` (facultatif, **pages de test uniquement**, sur la
  balise `<script>`) : chemin du configurateur vers lequel sortir, à la place
  de `/pages/configurateur`. Valeur attendue : un chemin absolu du site
  commençant par `/` (ex. `/pages/test-configurateur`). Toute autre valeur
  (URL complète, chemin relatif, vide…) est ignorée avec un avertissement en
  console, et le chemin par défaut s'applique. Seul le mode `simulateur` le
  lit. Ne jamais le mettre sur la vraie page `/pages/simulateur`.

## 3. Blocs fiches produit — gabarit produit

### Fiche teinte

Bloc **Liquid personnalisé** dans le gabarit produit, affiché seulement pour les
teintes (produits portant le metafield `custom.code_hexadecimal`) :

```liquid
{% if product.metafields.custom.code_hexadecimal != blank %}
  <div id="colibri-bouton-teinte" data-teinte="{{ product.handle | escape }}"></div>
  <script src="https://calculateur.colibripeinture.com/embed/colibri.js" data-colibri="bouton"></script>
{% endif %}
```

Ce que fait le script : bouton « Voir dans ma pièce » vers
`/pages/simulateur?teinte={handle}`. Sans token Wizart, rien n'est affiché.

### Fiche papier peint

Bloc **Liquid personnalisé** dans le même gabarit, affiché seulement pour les
papiers peints. `data-teinte` = SKU de la première variante « Lé » ;
`data-variantes` = table `{ "{id variante}": "{sku}" }` des seules variantes
« Lé » (les échantillons A4 ne sont pas dans Wizart) :

```liquid
{% if product.type == 'Papier peint' %}
  {%- liquid
    assign premier_le = ''
    assign entrees = ''
    for variante in product.variants
      if variante.title contains 'Lé :' and variante.sku != blank
        if premier_le == ''
          assign premier_le = variante.sku
        else
          assign entrees = entrees | append: ','
        endif
        assign cle = variante.id | append: '' | json
        assign valeur = variante.sku | json
        assign entrees = entrees | append: cle | append: ':' | append: valeur
      endif
    endfor
    assign variantes = '{' | append: entrees | append: '}'
  -%}
  {%- if premier_le != '' -%}
    <div id="colibri-bouton-teinte" data-teinte="{{ premier_le | escape }}" data-variantes="{{ variantes | escape }}"></div>
    <script src="https://calculateur.colibripeinture.com/embed/colibri.js" data-colibri="bouton"></script>
  {%- endif -%}
{% endif %}
```

Ce que fait le script : au clic sur « Voir dans ma pièce », si l'URL de la
fiche porte `?variant={id}` (coloris choisi) et que `data-variantes` connaît
cette variante, le bouton ouvre `/pages/simulateur?teinte={sku}` avec son SKU ;
sinon il envoie `data-teinte`. L'URL est relue au clic : le thème change
`?variant=` sans recharger la page. Le SKU est transmis tel quel à Wizart
(`openWithProduct`). `data-variantes` est facultatif : absent, rien ne change
(fiches teintes) ; JSON illisible : ignoré avec un avertissement en console ;
entrées invalides (id non numérique, SKU hors motif) écartées.

---

## Tester avant la bascule

1. Créer une page Shopify **masquée** (ex. `/pages/test-configurateur`, non
   publiée dans la navigation) contenant le bloc configurateur ci-dessus.
2. Vérifier : hauteur de l'iframe (aucun scroll interne), retour en haut à
   chaque changement d'étape, « Régler ma commande » (checkout pré-rempli) et
   « Continuer mes achats » (panier boutique).
3. Tant que le token Wizart n'est pas configuré en Production, aucune entrée
   vers le simulateur ne s'affiche : le parcours est strictement celui
   d'aujourd'hui.

Le pont complet (avec un faux simulateur) se teste sur la page `/labo/pont` de
chaque preview Vercel (404 en production).

### Pages de test avec le vrai simulateur

Les pages de test chargent le script d'un **preview Vercel** : leur iframe est
l'app de ce preview, alors que la vraie page `/pages/configurateur` charge
l'app de production (deux stockages de projet différents). Pour qu'un parcours
qui passe par la page Simulateur de test reste sur l'app du preview, la page
`/pages/test-simulateur` sort vers `/pages/test-configurateur` grâce à
`data-configurateur`.

Bloc **HTML personnalisé** de `/pages/test-simulateur` (remplacer l'adresse
du preview par celle du preview testé) :

```html
<div id="colibri-simulateur"></div>
<script src="https://ADRESSE-DU-PREVIEW.vercel.app/embed/colibri.js" data-colibri="simulateur" data-configurateur="/pages/test-configurateur"></script>
```

Bloc de `/pages/test-configurateur` : le bloc configurateur (section 1) avec
la même adresse de preview.

## Bascule

Remplacer le contenu du bloc HTML personnalisé de `/pages/configurateur` par le
bloc configurateur (section 1). Effet immédiat, aucun déploiement de l'app.

## Retour arrière

Recoller dans le bloc HTML personnalisé de `/pages/configurateur` le code
d'origine ci-dessous (relevé le 15/10). L'app continue de fonctionner avec
l'ancienne page : sans annonce `colibri:parent:pret`, elle n'affiche aucune
entrée vers le simulateur.

```html
<div id="colibri-configurator"></div>
<script>
(function () {
  // Sous-domaine technique qui sert l'app — NE PAS RENOMMER tant que le lot
  // « calculateur → configurateur » du backlog n'est pas traité (DNS compris).
  var APP_ORIGIN = 'https://calculateur.colibripeinture.com';

  var host = document.getElementById('colibri-configurator');
  var iframe = document.createElement('iframe');

  iframe.src = APP_ORIGIN;
  iframe.title = 'Configurateur de peinture Colibri';
  iframe.style.width = '100%';
  iframe.style.border = 'none';
  iframe.style.display = 'block';
  // Hauteur de secours tant que l'app n'a pas envoyé sa vraie hauteur
  iframe.style.minHeight = '900px';

  window.addEventListener('message', function (event) {
    // Sécurité : on n'accepte que les messages venant de notre app
    if (event.origin !== APP_ORIGIN) return;
    var data = event.data || {};

    // L'app annonce sa hauteur → l'iframe s'ajuste (pas de scroll interne)
    if (data.type === 'colibri:resize' && typeof data.height === 'number') {
      iframe.style.height = data.height + 'px';
      iframe.style.minHeight = '0px';
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
    if (data.type === 'colibri:redirect' && typeof data.url === 'string') {
      window.location.href = data.url;
    }
  });

  host.appendChild(iframe);
})();
</script>
```

Pour la page Simulateur et les fiches teintes et papier peint : supprimer les blocs (ou
dépublier la page). Retirer `NEXT_PUBLIC_WIZART_TOKEN` de Vercel puis
redéployer suffit aussi à masquer toutes les entrées vers le simulateur.

## Après la signature Wizart

1. Ajouter `NEXT_PUBLIC_WIZART_TOKEN` dans Vercel (environnement Production),
   puis redéployer.
2. Créer la page `/pages/simulateur` (section 2) et les blocs fiche teinte
   et fiche papier peint (section 3).
3. Côté Wizart : la référence produit des teintes est le handle Shopify,
   celle des papiers peints le SKU de la variante « Lé »
   (`pnpm wizart:export-papiers-peints`, voir `scripts/wizart/README.md`).
   **Désactiver le panier Wizart dans le PIM** : Configuration → Web →
   « Shopping cart » désactivé. La sortie se fait uniquement par la barre
   Colibri ; sans cette désactivation, les boutons « Acheter » et le panier
   Wizart restent visibles dans le simulateur. (Tant qu'il est actif, une
   redirection PIM vers `/pages/configurateur` avec `vendorCode[]` reste prise
   en charge par le script.)
4. Tester avec le vrai simulateur : popup d'un mur (une teinte, plusieurs
   teintes, réapplication, fermeture), page Simulateur (ordinateur et mobile),
   bouton d'une fiche teinte. Papiers peints (une fois les 12 références
   importées dans le PIM) : vignette dans la barre, arrivée avec teintes et
   papier peint, popup d'un mur avec un papier peint seul, bouton d'une fiche
   papier peint sur un coloris choisi (`?variant=`).
