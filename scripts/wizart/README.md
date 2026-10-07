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
pnpm wizart:export-papiers-peints
# critères de repérage explicites (répétables, correspondance exacte) :
pnpm wizart:export-papiers-peints --collection papiers-peints --product-type "Papier peint" --tag "Papier peint"
```

Sorties (à committer pour l'essai) :

| Fichier | Contenu |
| --- | --- |
| `out/colibri-peintures-echantillon.csv` | Gabarit PAINT, UTF-8 sans BOM, virgule, fins de ligne CRLF |
| `out/colibri-peintures-echantillon.md` | Échantillon lisible (collection, teinte, rôle, hex, handle) + rapport des exclusions |
| `out/colibri-papiers-peints-squelette.csv` | Gabarit WALLPAPER (colonnes requises) |
| `out/colibri-papiers-peints-squelette.md` | Mode de repérage, signalements (largeurs), URLs des images Shopify |

Tests des fonctions pures (hex, luminance, sélection, CSV, conversion des
largeurs) : `pnpm test` (`scripts/wizart/common.test.ts`).

## Peinture — gabarit PAINT

Source : collections `title:Les *` (filtrées ensuite sur les titres commençant
par « Les »), produits paginés par curseur (`first: 100` + `after`), champs
`handle`, `title`, `featuredImage`, metafield `custom.code_hexadecimal`.

Sélection de l'échantillon :

1. Les produits sans hex valide (metafield absent ou illisible) sont exclus et
   listés dans le rapport. Hex acceptés : `#RGB`, `#RRGGBB`, avec ou sans `#`.
2. Pour chaque collection, tri par **luminance relative** (WCAG, sRGB
   linéarisé) : teinte la plus claire, médiane (indice `⌊(n−1)/2⌋`) et la plus
   foncée. Moins de 3 teintes → toutes, sans doublon.
3. Un handle n'est exporté qu'une fois (identifiant unique) : un produit
   présent dans plusieurs collections reste dans la première par ordre
   alphabétique, les suivantes choisissent parmi leurs autres teintes.
4. Plafond de **30 lignes** appliqué en tourniquet (la plus claire de chaque
   collection, puis la médiane, puis la plus foncée) pour que chaque
   collection soit représentée. Les teintes écartées sont listées.

| Colonne Wizart | Valeur |
| --- | --- |
| `brand_name` | `Colibri Peinture` |
| `collection_name` | Titre de la collection Shopify |
| `product_name` | Titre du produit |
| `unique_SKU_ID` | Handle Shopify du produit |
| `render_color` | Hex normalisé `#RRGGBB` |
| `product_link` | `https://www.colibripeinture.com/products/{handle}` |
| `pattern_width` | `1` (voir « À confirmer ») |
| `price`, `description`, `product_image` | Vides |

## Papiers peints — gabarit WALLPAPER (squelette)

Repérage par défaut, cumulatif (le rapport indique pour chaque produit le ou
les critères qui l'ont retenu) :

1. collections dont le titre ou le handle contient « papier(s) peint(s) » ;
2. produits dont le `productType` contient « papier(s) peint(s) » ;
3. produits portant un tag contenant « papier(s) peint(s) ».

Les options `--collection`, `--product-type`, `--tag` remplacent ce repérage
une fois le mode réel confirmé dans l'admin Shopify. Le repérage n'a pas pu
être vérifié sur la boutique depuis l'environnement de développement : la
section « Repérage dans Shopify » du rapport fait foi au premier lancement.

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
absent → cellule vide, signalée dans le rapport. Les metafields doivent être
exposés au Storefront API (Admin → Paramètres → Données personnalisées →
accès Storefront), sinon ils remontent vides.

**Textures** : les images Shopify (photos produit, mises en situation) ne sont
pas des textures raccordables. Elles ne sont jamais utilisées comme textures,
seulement listées dans le rapport pour information. Les textures viendront du
fournisseur, un fichier par produit nommé `{handle}.{extension}`.

## Décisions

- **Handle comme identifiant** (`unique_SKU_ID` / `unique_sku_id`) : stable,
  unique, lisible, et il reconstruit l'URL produit. Une teinte = un produit :
  ses variantes (contenance, finition) partagent la même couleur, une ligne
  par produit suffit.
- **`render_color` pour toutes les lignes peinture**, jamais `product_image` :
  le visualiseur teinte le mur à partir du hex, sans fichier image.
- **Prix vides** : la boutique reste la seule source de prix ; aucun prix n'est
  recopié dans le PIM pendant l'essai.
- **Aucune dépendance ajoutée** : Node exécute le TypeScript nativement
  (`--experimental-strip-types`, sans effet à partir de Node 22.18). Les
  modules locaux sont chargés par import dynamique avec extension `.ts`, car
  Node ne résout pas les imports relatifs sans extension.
- Client Storefront de l'application réutilisé (`shopifyFetch` de
  `lib/shopify.ts`), chargé après lecture de `.env.local`.

## À confirmer sur le gabarit officiel

Les pages Wizart n'étaient pas accessibles depuis l'environnement de
développement ; les points suivants suivent le brief et sont à vérifier sur le
fichier exemple avant l'import. Le gabarit fait foi.

- Séparateur CSV (virgule ici) : constante `CSV_SEPARATOR` dans `common.ts`.
- `pattern_width` (peinture) : `1` faute de valeur lue dans le fichier exemple
  (la documentation publique Wizart borne la valeur entre 0,01 et 9 m) :
  constante `PAINT_PATTERN_WIDTH`.
- Casse de l'identifiant : `unique_SKU_ID` (PAINT) et `unique_sku_id`
  (WALLPAPER), comme dans le brief.
- Noms exacts des colonnes prix et description (`price`, `description` ici).
- Sens de `repeat_width` (largeur du motif) face au « raccord » français
  (souvent la hauteur de raccord vertical).

## Reste manuel

1. Lancer les deux scripts avec un `.env.local` valide, relire les rapports
   `.md`, committer `out/`.
2. Importer `colibri-peintures-echantillon.csv` dans le PIM Wizart (procédure
   d'import ci-dessous) et vérifier le rendu de quelques teintes claires et
   foncées.
3. Papiers peints : confirmer le mode de repérage, compléter les largeurs
   manquantes, récupérer les textures auprès du fournisseur, les nommer
   d'après `product_image`, puis importer le ZIP des textures et le CSV.

## Références Wizart

- [Gabarit peinture (PAINT)](https://wizart.atlassian.net/wiki/spaces/WDP/pages/2682915697)
- [Gabarit papier peint (WALLPAPER)](https://wizart.atlassian.net/wiki/spaces/WDP/pages/2682915493)
- [Textures papier peint](https://wizart.atlassian.net/wiki/spaces/WDP/pages/2801565923)
- [Procédure d'import PIM](https://wizart.atlassian.net/wiki/spaces/WDP/pages/2682914894)
