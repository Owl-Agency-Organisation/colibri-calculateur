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
lancés depuis un autre environnement. Les sorties ne sont **pas versionnées** :
on les régénère à chaque import dans le PIM. L'échantillon de l'essai a été
importé le 08/10/2026 (import n° 77968, méthode image ci-dessous) ; les
sorties commitées pendant l'essai, restées au format `render_color`
abandonné, ont été retirées du repo le 15/10/2026.

Sorties (générées dans `out/`, à ne pas commiter) :

| Fichier | Contenu |
| --- | --- |
| `out/colibri-peintures-echantillon.csv` | Gabarit PAINT, mapping par défaut (31 colonnes), UTF-8 sans BOM, virgule, fins de ligne CRLF |
| `out/colibri-peintures-aplats.zip` | Un aplat PNG 1000×1000 RGB uni par teinte, nommé `{handle}.png`, archive plate |
| `out/colibri-peintures-echantillon.md` | Échantillon lisible (collection, teinte, rôle, hex, handle), mention du ZIP + rapport des exclusions |
| `out/colibri-papiers-peints.csv` | Gabarit WALLPAPER, une ligne par coloris (variante « Lé ») |
| `out/colibri-papiers-peints.md` | Repérage, lignes et signalements, fichier manuel, vérification des textures |

Tests : `pnpm test` — `scripts/wizart/common.test.ts` (hex, luminance,
sélection, mapping PAINT, CSV, conversion des largeurs),
`scripts/wizart/aplats.test.ts` (PNG et ZIP relus octet par octet : ouverture,
nombre d'entrées, noms, CRC, pixels) et `scripts/wizart/papiers-peints.test.ts`
(12 lignes, largeurs, liens, fichier manuel, textures).

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

## Papiers peints — gabarit WALLPAPER (une ligne par coloris)

Décision du 21/10/2026 : les papiers peints Colibri entrent dans le
simulateur. **Référence Wizart = SKU de la variante « Lé »**
(`unique_sku_id`, que Wizart renvoie en `article_sku`), par exemple
`pp-montg-terracotta-le` : le handle produit ne dit pas le coloris. Côté app,
une référence reçue est soit un handle de teinte, soit un SKU de papier peint
(voir `docs/EMBED_SHOPIFY.md`).

**Repérage confirmé sur la boutique** (08/10, puis 21/10 sur l'Admin API) :
`productType` = « Papier peint », 3 produits, chacun en 4 coloris (option
« Couleur ») et 2 tailles (option « Taille » : « Lé : 60x280cm » ou
« Lé : 53x280cm », et « Echantillon : A4 »). Soit **12 lignes** : les
variantes « Echantillon » ne vont pas dans Wizart. Le repérage par défaut
remonte en plus la collection « Matériel Papier peint » (outillage) : lancer
le script avec `--product-type "Papier peint"`.

```bash
pnpm wizart:export-papiers-peints --product-type "Papier peint"
pnpm wizart:export-papiers-peints --product-type "Papier peint" --textures ~/textures-colibri
```

Repérage par défaut, cumulatif (le rapport indique pour chaque produit le ou
les critères qui l'ont retenu) : collections dont le titre ou le handle
contient « papier(s) peint(s) », produits dont le `productType` ou un tag le
contient. Les options `--collection`, `--product-type`, `--tag` remplacent ce
repérage par des critères exacts.

| Colonne Wizart | Valeur |
| --- | --- |
| `brand_name` | `Colibri Peinture` |
| `collection_name` | `Papiers peints` |
| `product_name` | « {Motif} - {Coloris} » (motif = titre avant le tiret, comme `nomCourtTeinte`) ; coloris seul s'il contient déjà le motif (« Rayures bleues », « Ombrelle bleu nuit ») |
| `unique_sku_id` | SKU de la variante « Lé » |
| `product_image` | SKU, sans extension (nom du fichier texture dans le ZIP) |
| `product_width` | Largeur du lé en mètres, lue dans l'option « Taille » (`Lé : 60x280cm` → `0.6`) |
| `repeat_width` | `largeurMotif` du fichier manuel |
| `pattern_repeat` | `hauteurRaccord` du fichier manuel |
| `pattern_offset` | `decalage` du fichier manuel, sinon `0` (raccord droit ou libre) ou moitié de `hauteurRaccord` (raccord sauté) |
| `product_link` | `https://www.colibripeinture.com/products/{handle}?variant={id numérique}` |
| `product_regular_price`, `product_promotional_price` | Vides |

**Sens de `repeat_width`** (tranché le 21/10/2026 sur la page « WALLPAPER
(upload requirements) », mise à jour Wizart du 14/04/2026) : « Width of the
imported pattern », c'est-à-dire la **largeur du motif de la texture
importée**, en mètres (requis, 0,01 à 10). Ce n'est **pas** le raccord
français : la hauteur de raccord (répétition verticale) va dans
`pattern_repeat`, et le type de raccord se traduit en `pattern_offset`
(« how much the next tile must be shifted so that the pattern matches », 0
pour un raccord droit ou libre). Dans l'exemple Wizart, `repeat_width` vaut la
largeur du lé : c'est le cas quand la texture fournie couvre un lé entier.

**Fichier manuel `papiers-peints.json`** (versionné, une entrée par SKU,
rempli à la main depuis les fichiers de Colibri) : `largeurMotif`,
`hauteurRaccord`, `raccord` (`droit`, `saute` ou `libre`), `decalage`
(facultatif, prioritaire), en mètres ; `null` = pas encore renseigné. Entrée
absente ou valeur `null` : cellule vide, signalée dans le rapport (avec la
mention « requis par Wizart » pour `repeat_width`). La clé `_lisezmoi` est un
commentaire.

**Textures** : préparées par Owl à partir des motifs raccordables fournis par
Colibri, hors du repo. Un fichier par ligne, `{sku}.png` ou `{sku}.jpg`.
`--textures <dossier>` vérifie le dossier : SKU sans fichier et fichiers en
trop (fichiers cachés ignorés), listés dans le rapport et la console. Aucun
traitement d'image. Les images Shopify (mises en situation) ne sont jamais
des textures.

## Décisions

- **Handle comme identifiant des teintes** (`unique_sku_id`) : stable,
  unique, lisible, et il reconstruit l'URL produit. Une teinte = un produit :
  ses variantes (contenance, finition) partagent la même couleur, une ligne
  par produit suffit.
- **SKU de la variante « Lé » comme identifiant des papiers peints**
  (21/10/2026) : un produit = un motif en plusieurs coloris, une ligne par
  coloris.
- **Méthode image pour la peinture** : un aplat PNG par teinte, `product_image`
  = handle. `render_color` abandonné (voir « Méthode image et mapping par
  défaut »).
- **Prix vides** : la boutique reste la seule source de prix ; aucun prix n'est
  recopié dans le PIM pendant l'essai.
- **Laques et sélections thématiques hors échantillon** (voir ci-dessus).
- **Sorties non versionnées** (15/10/2026) : régénérées à chaque import dans le
  PIM, pour que le repo ne contienne jamais de fichiers d'export périmés.
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

## Reste manuel

1. Importer `colibri-peintures-echantillon.csv` avec
   `colibri-peintures-aplats.zip` dans le PIM Wizart (mapping par défaut) et
   vérifier le rendu de quelques teintes claires et foncées sur photo réelle.
2. Papiers peints : remplir `papiers-peints.json` depuis les fichiers de
   Colibri, préparer les 12 textures (`{sku}.png`), vérifier avec
   `--textures`, puis importer le ZIP des textures et le CSV.

## Références Wizart

- [Gabarit peinture (PAINT)](https://wizart.atlassian.net/wiki/spaces/WDP/pages/2682915697)
- [Gabarit papier peint (WALLPAPER)](https://wizart.atlassian.net/wiki/spaces/WDP/pages/2682915493)
- [Textures papier peint](https://wizart.atlassian.net/wiki/spaces/WDP/pages/2801565923)
- [Procédure d'import PIM](https://wizart.atlassian.net/wiki/spaces/WDP/pages/2682914894)
