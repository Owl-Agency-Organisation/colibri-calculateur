# Exports Wizart — essai visualiseur (Deployment Kit)

Scripts d'export d'un échantillon du catalogue Colibri vers les gabarits PIM de
Wizart, pour l'essai de 14 jours du visualiseur. Ils **lisent** la boutique via
la Storefront API et n'écrivent que dans `scripts/wizart/out/`. Aucune
modification de l'application.

## Lancer

Prérequis : Node ≥ 22.6 (TypeScript exécuté nativement par Node, sans
dépendance ajoutée) et un `.env.local` à la racine avec les variables Storefront
de l'application (voir `.env.local.example`) :

- `NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN`
- `NEXT_PUBLIC_SHOPIFY_STOREFRONT_ACCESS_TOKEN`
- `SHOPIFY_API_VERSION` (facultatif, `2025-01` par défaut)

Les variables déjà définies dans l'environnement sont prioritaires sur le
fichier. Aucun secret n'est écrit dans les sorties.

```bash
pnpm wizart:export-peintures
# repérage confirmé sur la boutique (voir « Papiers peints ») :
pnpm wizart:export-papiers-peints --product-type "Papier peint"
```

L'environnement distant de Claude Code ne joint pas Shopify : les exports sont
lancés depuis un autre environnement, et leurs sorties sont commitées dans
`out/`. Les sorties peinture du 08/10/2026 suivent encore l'ancienne méthode
`render_color` ; elles seront régénérées au format ci-dessous (méthode image).

Sorties (commitées pour l'essai) :

| Fichier | Contenu |
| --- | --- |
| `out/colibri-peintures-echantillon.csv` | Gabarit PAINT, mapping par défaut (31 colonnes), UTF-8 sans BOM, virgule, fins de ligne CRLF |
| `out/colibri-peintures-aplats.zip` | Un aplat PNG 1000×1000 RGB uni par teinte, nommé `{handle}.png`, archive plate |
| `out/colibri-peintures-echantillon.md` | Échantillon lisible (collection, teinte, rôle, hex, handle), mention du ZIP + rapport des exclusions |
| `out/colibri-papiers-peints-squelette.csv` | Gabarit WALLPAPER (colonnes requises) |
| `out/colibri-papiers-peints-squelette.md` | Mode de repérage, signalements (largeurs), URLs des images Shopify |

Tests : `pnpm test` — `scripts/wizart/common.test.ts` (hex, luminance,
sélection, mapping PAINT, CSV, conversion des largeurs) et
`scripts/wizart/aplats.test.ts` (PNG et ZIP relus octet par octet : ouverture,
nombre d'entrées, noms, CRC, pixels).

## Peinture — gabarit PAINT

Source : collections `title:Les *` (filtrées ensuite sur les titres commençant
par « Les »), produits paginés par curseur (`first: 100` + `after`), champs
`handle`, `title`, `featuredImage`, metafield `custom.code_hexadecimal`.

Collections « Les … » écartées (`PAINT_EXCLUDED_COLLECTIONS`) :

- « Les laques … » (13 collections) : laques bois et métal, hors murs, donc
  hors visualiseur ;
- « Les Pastels », « Les Peps », « Les Tendances » : sélections thématiques
  transverses, dont les teintes appartiennent déjà aux 14 familles de couleurs.

Sélection de l'échantillon :

1. Les produits sans hex valide (metafield absent ou illisible) sont exclus et
   listés dans le rapport. Hex acceptés : `#RGB`, `#RRGGBB`, avec ou sans `#`.
2. Pour chaque collection, tri par **luminance relative** (WCAG, sRGB
   linéarisé) : teinte la plus claire, médiane (indice `⌊(n−1)/2⌋`) et la plus
   foncée. Moins de 3 teintes → toutes, sans doublon.
3. Un handle n'est exporté qu'une fois (identifiant unique) : un produit
   présent dans plusieurs collections reste dans la première par ordre
   alphabétique, les suivantes choisissent parmi leurs autres teintes.
4. Plafond de **45 lignes** appliqué en tourniquet (la plus claire de chaque
   collection, puis la médiane, puis la plus foncée). Avec 14 familles le
   plafond n'est pas atteint : 41 teintes exportées le 08/10/2026 (« Les
   Noirs » n'en compte que 2). Le plafond initial de 30, posé pour 30
   collections, ne laissait sortir que les teintes claires.

### Méthode image et mapping par défaut

Le premier import dans le PIM Wizart a fixé la méthode : le **mapping par
défaut** du PIM exige la colonne `product_image`, et le formulaire d'import
exige un **ZIP**. Chaque teinte est donc fournie comme une image unie :

- un PNG 1000×1000, RGB 8 bits sans alpha, rempli avec le hex de la teinte ;
- nommé `{handle}.png`, à la racine du ZIP (archive plate, sans dossier) ;
- `product_image` = handle, **sans extension**.

Le CSV reprend exactement, dans l'ordre, les 31 colonnes du fichier
« Default mapping template_Paint.xlsx » de Wizart (`PAINT_COLUMNS`) :

| Colonne Wizart | Valeur |
| --- | --- |
| `brand_name` | `Colibri Peinture` |
| `collection_name` | Titre de la collection Shopify |
| `product_name` | Titre du produit |
| `unique_sku_id` | Handle Shopify du produit |
| `product_image` | Handle (nom de l'aplat dans le ZIP, sans `.png`) |
| `pattern_width` | `1` (flottant en mètres) |
| `product_link` | `https://www.colibripeinture.com/products/{handle}` |
| `application_surface` | `wall` |
| `color` | Hex normalisé `#RRGGBB` |
| `product_availability` | `in_stock` |
| Les 21 autres colonnes (`usage`, `sheen`, `product_description`, `price_per_container`…) | Vides |

**Pourquoi `render_color` est abandonné** : la méthode `render_color` décrit
la teinte par un hex, sans image. Or le mapping par défaut exige
`product_image` et le formulaire d'import exige un ZIP : sans image, l'import
ne passe pas. Le hex reste exporté dans `color`.

Génération sans dépendance (`aplats.ts`) : encodeur PNG minimal (chunks
`IHDR`/`IDAT`/`IEND`, compression `node:zlib`) et ZIP en mode « store » (sans
compression, les PNG étant déjà compressés) avec CRC32. Un aplat pèse environ
4 Ko ; l'archive est déterministe (date fixe 01/01/1980).

## Papiers peints — gabarit WALLPAPER (squelette)

**Repérage confirmé sur la boutique le 08/10/2026** : `productType` =
« Papier peint », 3 produits (`papier-peint-montgolfiere`,
`ombrelle-papier-peint-ecologique`, `rayures-papier-peint-ecologique`).
Le repérage par défaut remonte en plus la collection « Matériel Papier peint »
(outillage : brosses, cutter, règle…) : lancer le script avec
`--product-type "Papier peint"`.

Repérage par défaut, cumulatif (le rapport indique pour chaque produit le ou
les critères qui l'ont retenu) :

1. collections dont le titre ou le handle contient « papier(s) peint(s) » ;
2. produits dont le `productType` contient « papier(s) peint(s) » ;
3. produits portant un tag contenant « papier(s) peint(s) ».

Les options `--collection`, `--product-type`, `--tag` remplacent ce repérage
par des critères exacts.

| Colonne Wizart | Valeur |
| --- | --- |
| `brand_name` | `Colibri Peinture` |
| `collection_name` | Première collection du produit qui n'est pas une collection générique « papiers peints » (à défaut, la première) |
| `product_name` | Titre du produit |
| `unique_sku_id` | Handle Shopify du produit |
| `product_image` | Handle, sans extension (nom du fichier texture attendu dans le ZIP) |
| `product_width` | Mètres, depuis `custom.largeur` / `largeur_rouleau` / `largeur_lai` / `laize` / `product_width` |
| `repeat_width` | Mètres, depuis `custom.raccord` / `largeur_raccord` / `raccord_motif` / `repeat` / `repeat_width` |

Largeurs : premier metafield non vide parmi les candidats, converti en mètres
(metafield `dimension`, `53 cm`, `0,53 m`…). Sans unité : centimètres supposés
au-delà de 3, mètres en dessous, et la supposition est signalée. Metafield
absent → cellule vide, signalée dans le rapport. **Au 08/10/2026, aucun des
metafields candidats n'est renseigné ou exposé** : les largeurs sont à saisir
à la main (ou à créer dans Shopify puis exposer au Storefront API : Admin →
Paramètres → Données personnalisées → accès Storefront).

**Textures** : les images Shopify (photos produit, mises en situation) ne sont
pas des textures raccordables. Elles ne sont jamais utilisées comme textures,
seulement listées dans le rapport pour information. Les textures viendront du
fournisseur, un fichier par produit nommé `{handle}.{extension}`. Les trois
papiers peints existent en plusieurs coloris (images `…-terracotta`, `…-bleu`…)
: une ligne par coloris sera nécessaire dans Wizart, à cadrer avant l'import.

## Décisions

- **Handle comme identifiant** (`unique_sku_id`) : stable,
  unique, lisible, et il reconstruit l'URL produit. Une teinte = un produit :
  ses variantes (contenance, finition) partagent la même couleur, une ligne
  par produit suffit.
- **Méthode image pour la peinture** : un aplat PNG par teinte, `product_image`
  = handle. `render_color` abandonné (voir « Méthode image et mapping par
  défaut »).
- **Prix vides** : la boutique reste la seule source de prix ; aucun prix n'est
  recopié dans le PIM pendant l'essai.
- **Laques et sélections thématiques hors échantillon** (voir ci-dessus).
- **Aucune dépendance ajoutée** : Node exécute le TypeScript nativement
  (`--experimental-strip-types`, sans effet à partir de Node 22.18). Les
  modules locaux sont chargés par import dynamique avec extension `.ts`, car
  Node ne résout pas les imports relatifs sans extension.
- Client Storefront de l'application réutilisé (`shopifyFetch` de
  `lib/shopify.ts`), chargé après lecture de `.env.local`.

## Vérifié lors du premier import Wizart

- Gabarit PAINT : mapping par défaut du PIM, 31 colonnes de « Default mapping
  template_Paint.xlsx » (identifiant `unique_sku_id` en minuscules),
  `product_image` obligatoire, import accompagné d'un ZIP d'images.
- Noms de colonnes WALLPAPER (documentation) : `unique_sku_id`,
  `product_regular_price`, `product_width`, `repeat_width`, mesures en mètres.

## Reste à confirmer sur le fichier exemple

- Séparateur CSV (virgule ici, non documenté) : constante `CSV_SEPARATOR`.
  Le PIM accepte aussi le XLSX, solution de repli si le CSV est refusé.
- Sens de `repeat_width` (largeur du motif) face au « raccord » français
  (souvent la hauteur de raccord vertical).

## Reste manuel

1. Importer `colibri-peintures-echantillon.csv` avec
   `colibri-peintures-aplats.zip` dans le PIM Wizart (mapping par défaut) et
   vérifier le rendu de quelques teintes claires et foncées sur photo réelle.
2. Papiers peints : saisir les largeurs, récupérer les textures auprès du
   fournisseur, les nommer d'après `product_image`, cadrer les coloris, puis
   importer le ZIP des textures et le CSV.

## Références Wizart

- [Gabarit peinture (PAINT)](https://wizart.atlassian.net/wiki/spaces/WDP/pages/2682915697)
- [Gabarit papier peint (WALLPAPER)](https://wizart.atlassian.net/wiki/spaces/WDP/pages/2682915493)
- [Textures papier peint](https://wizart.atlassian.net/wiki/spaces/WDP/pages/2801565923)
- [Procédure d'import PIM](https://wizart.atlassian.net/wiki/spaces/WDP/pages/2682914894)
