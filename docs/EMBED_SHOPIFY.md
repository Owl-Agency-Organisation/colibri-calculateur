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
    simulateur (aucune entrée dans l'app, pas de bouton sur les fiches teintes,
    message « momentanément indisponible » sur la page Simulateur).
- Chaque page appelle le script en deux lignes : un élément hôte + la balise
  `<script>` avec l'attribut `data-colibri` qui fixe le mode.
- Le simulateur Wizart (Deployment Kit) n'est chargé que sur la page Simulateur
  et à l'ouverture de la surimpression depuis le configurateur.

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
  l'URL de la page ;
- annonce `colibri:parent:pret` à l'app à chaque chargement de l'iframe (avec
  la capacité `simulateur` seulement si le token Wizart est configuré) ;
- à la demande de l'app (popup couleur d'un mur), ouvre le simulateur en
  surimpression plein écran au-dessus de la page, sur la teinte demandée le cas
  échéant ; renvoie les teintes du panier Wizart à l'app à la sortie du panier,
  ou signale la fermeture. La saisie en cours dans l'app n'est jamais perdue.

## 2. Bloc simulateur — page `/pages/simulateur`

Créer une page Shopify `simulateur` (gabarit page standard) avec un bloc
**HTML personnalisé** :

```html
<div id="colibri-simulateur"></div>
<script src="https://calculateur.colibripeinture.com/embed/colibri.js" data-colibri="simulateur"></script>
```

Ce que fait le script : question « Quelle pièce ? » (7 types, libellés de
l'app), consignes photo, simulateur plein écran en français ; `?teinte={handle}`
ouvre le simulateur sur ce produit. À la sortie du panier Wizart, navigation
vers `/pages/configurateur?piece={type}&teintes={handles}`. Fermeture : retour à
la question.

## 3. Bloc fiche teinte — gabarit produit

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

Pour la page Simulateur et les fiches teintes : supprimer les blocs (ou
dépublier la page). Retirer `NEXT_PUBLIC_WIZART_TOKEN` de Vercel puis
redéployer suffit aussi à masquer toutes les entrées vers le simulateur.

## Après la signature Wizart

1. Ajouter `NEXT_PUBLIC_WIZART_TOKEN` dans Vercel (environnement Production),
   puis redéployer.
2. Créer la page `/pages/simulateur` (section 2) et le bloc fiche teinte
   (section 3).
3. Côté Wizart : la référence produit des teintes est le handle Shopify. Si le
   PIM redirige vers la boutique à la sortie du panier, la cible est
   `https://www.colibripeinture.com/pages/configurateur` (paramètres
   `vendorCode[]`, pris en charge par le script).
4. Tester avec le vrai simulateur : popup d'un mur (une teinte, plusieurs
   teintes, fermeture), page Simulateur, bouton d'une fiche teinte.
