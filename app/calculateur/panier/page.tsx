'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { track } from '@vercel/analytics';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StepIndicator, CALCULATEUR_STEPS } from '@/components/ui/StepIndicator';
import { useStepperNavigation } from '@/hooks/useStepperNavigation';
import { getStoredPieces, getStoredClient, STORAGE_KEYS } from '@/lib/store/projetStore';
import { removeCartLines, getCart, type ShopifyCart, type CartLineNode } from '@/lib/shopify-cart';
import { normalizeFrenchPhone } from '@/lib/utils/phone';
import { mapCalculToCartLines, canRemoveLine, getLineType } from '@/lib/cart-mapper';
import { EstimationModal } from '@/components/modals/EstimationModal';
import type { ResultatCalcul } from '@/lib/calcul';
import type { Piece, Client } from '@/lib/types';

// Clés localStorage pour persister l'ID du panier Shopify et détecter les changements
const CART_ID_KEY = 'SHOPIFY_CART_ID';
const CART_DATA_HASH_KEY = 'SHOPIFY_CART_DATA_HASH';

// Fonction pour générer un hash des données du panier
function generateCartDataHash(resultat: ResultatCalcul, options: any): string {
  return JSON.stringify({
    peintures: resultat.peintures.map(p => ({ 
      couleur: p.couleur.titre, 
      contenants: p.contenants.map(c => ({ contenance: c.contenance, quantite: c.quantite })),
      litresCommandes: p.litresCommandes 
    })),
    sousCouches: resultat.sousCouches.map(s => ({ 
      type: s.type, 
      contenants: s.contenants.map(c => ({ contenance: c.contenance, quantite: c.quantite })),
      litresCommandes: s.litresCommandes 
    })),
    kit: resultat.kit,
    options,
  });
}

export default function PanierPage() {
  const router = useRouter();
  const { handleStepClick, isStepDisabled } = useStepperNavigation();
  
  // États pour les données du formulaire
  const [client, setClient] = useState<Client | null>(null);
  const [pieces, setPieces] = useState<Piece[]>([]);
  const [resultat, setResultat] = useState<ResultatCalcul | null>(null);
  const [options, setOptions] = useState({ sousCouche: true, kit: true, renovation: false });
  const [shopifyData, setShopifyData] = useState<Record<string, any>>({});

  // États pour le panier Shopify
  const [cart, setCart] = useState<ShopifyCart | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreatingCart, setIsCreatingCart] = useState(false);
  const [isRemovingLine, setIsRemovingLine] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // États pour les actions (sorties du panier)
  const [isProcessing, setIsProcessing] = useState(false);
  const [showEstimationModal, setShowEstimationModal] = useState(false);

  // Charger les données initiales
  useEffect(() => {
    const storedClient = getStoredClient();
    const storedPieces = getStoredPieces();
    const storedCalcul = localStorage.getItem(STORAGE_KEYS.CALCUL);
    const storedOptions = localStorage.getItem(STORAGE_KEYS.OPTIONS);
    const storedShopifyData = localStorage.getItem(STORAGE_KEYS.SHOPIFY_DATA);

    if (!storedCalcul || storedPieces.length === 0) {
      router.push('/calculateur/piece');
      return;
    }

    setClient(storedClient);
    setPieces(storedPieces);
    setResultat(JSON.parse(storedCalcul));

    // Événement anonyme : l'utilisateur a atteint le panier
    track('panier_atteint');
    
    if (storedOptions) {
      setOptions(JSON.parse(storedOptions));
    }
    
    if (storedShopifyData) {
      setShopifyData(JSON.parse(storedShopifyData));
    }
  }, [router]);

  // Créer ou récupérer le panier Shopify
  const initializeCart = useCallback(async () => {
    if (!resultat || !shopifyData || Object.keys(shopifyData).length === 0) {
      return;
    }

    setIsCreatingCart(true);
    setError(null);

    try {
      // Générer un hash des données actuelles
      const currentHash = generateCartDataHash(resultat, options);
      const storedHash = localStorage.getItem(CART_DATA_HASH_KEY);
      const existingCartId = localStorage.getItem(CART_ID_KEY);
      
      // Si les données ont changé, on doit recréer le panier
      const dataHasChanged = currentHash !== storedHash;
      
      if (existingCartId && !dataHasChanged) {
        try {
          // Essayer de récupérer le panier existant (données inchangées)
          const existingCart = await getCart(existingCartId);
          setCart(existingCart);
          setIsLoading(false);
          setIsCreatingCart(false);
          return;
        } catch {
          // Le panier a expiré ou n'existe plus, on en crée un nouveau
          localStorage.removeItem(CART_ID_KEY);
          localStorage.removeItem(CART_DATA_HASH_KEY);
        }
      } else if (dataHasChanged && existingCartId) {
        // Les données ont changé, on supprime l'ancien panier
        localStorage.removeItem(CART_ID_KEY);
        localStorage.removeItem(CART_DATA_HASH_KEY);
      }

      // Créer un nouveau panier
      const cartLines = mapCalculToCartLines(resultat, shopifyData, options);
      
      if (cartLines.length === 0) {
        setError('Aucun produit à ajouter au panier. Vérifiez que les produits sont disponibles sur Shopify.');
        setIsLoading(false);
        setIsCreatingCart(false);
        return;
      }

      // buyerIdentity optionnel : renseigné uniquement si on connaît déjà les
      // coordonnées (posées par une estimation précédente) ; sinon le checkout
      // Shopify les collecte lui-même.
      const buyerInfo = client?.email ? {
        email: client.email,
        phone: normalizeFrenchPhone(client.telephone) || undefined,
        firstName: client.prenom,
        lastName: client.nom,
        country: 'FR',
      } : undefined;

      // Création côté serveur : le code promo -15% est injecté sur le serveur
      // (`process.env.DISCOUNT_CODE`) sans jamais transiter côté client.
      const cartResponse = await fetch('/api/calculateur/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lines: cartLines, buyerInfo }),
      });

      const cartResult = await cartResponse.json();

      if (!cartResponse.ok || !cartResult.cart) {
        throw new Error(cartResult.error || 'Erreur lors de la création du panier');
      }

      const newCart: ShopifyCart = cartResult.cart;

      // Sauvegarder l'ID du panier et le hash des données
      localStorage.setItem(CART_ID_KEY, newCart.id);
      localStorage.setItem(CART_DATA_HASH_KEY, currentHash);
      
      setCart(newCart);
    } catch (err) {
      console.error('Erreur création panier:', err);
      setError(err instanceof Error ? err.message : 'Erreur lors de la création du panier');
    } finally {
      setIsLoading(false);
      setIsCreatingCart(false);
    }
  }, [resultat, shopifyData, options, client]);

  // Initialiser le panier quand les données sont prêtes
  useEffect(() => {
    if (resultat && shopifyData && Object.keys(shopifyData).length > 0) {
      initializeCart();
    }
  }, [resultat, shopifyData, initializeCart]);

  // TODO [2026-03-01]: Nettoyer la compatibilité ascendante des attributs
  // Supprimer tous les fallbacks `|| attributes.find(a => a.key === 'xxx')` (sans préfixe _)
  // après expiration naturelle des paniers existants (~7 jours inactivité Shopify).
  // Occurrences à nettoyer dans ce fichier : lignes ~185, ~196, ~207, ~423, ~433, ~448
  
  // Supprimer une ligne du panier
  const handleRemoveLine = async (lineId: string, attributes: Array<{ key: string; value: string }>) => {
    if (!cart || !canRemoveLine(attributes)) {
      return;
    }

    setIsRemovingLine(lineId);
    setError(null);

    try {
      const updatedCart = await removeCartLines(cart.id, [lineId]);
      setCart(updatedCart);

      // Synchroniser avec localStorage pour l'étape 5
      const lineType = attributes.find(a => a.key === '_type')?.value || attributes.find(a => a.key === 'type')?.value;
      const STORAGE_KEY_OPTIONS = STORAGE_KEYS.OPTIONS;
      
      if (lineType === 'kit' || lineType === 'renovation') {
        // Charger les options actuelles
        const savedOptions = localStorage.getItem(STORAGE_KEY_OPTIONS);
        if (savedOptions) {
          const options = JSON.parse(savedOptions);
          
          if (lineType === 'kit') {
            // Le kit est une ligne unique (tout-ou-rien) : la supprimer décoche l'option
            options.kit = false;
          } else if (lineType === 'renovation') {
            // Retirer le produit de la liste des produits rénovation
            const produitHandle = attributes.find(a => a.key === '_produit')?.value || attributes.find(a => a.key === 'produit')?.value;
            if (produitHandle && options.produitsRenovation) {
              options.produitsRenovation = options.produitsRenovation.filter((h: string) => h !== produitHandle);
              
              // Si tous les produits sont supprimés, décocher l'option rénovation
              if (options.produitsRenovation.length === 0) {
                options.renovation = false;
              }
            }
          }
          
          // Sauvegarder les options mises à jour
          localStorage.setItem(STORAGE_KEY_OPTIONS, JSON.stringify(options));
        }
      }

      // Forcer la recréation du panier à la prochaine visite
      localStorage.removeItem('SHOPIFY_CART_ID');
      localStorage.removeItem('SHOPIFY_CART_DATA_HASH');
    } catch (err) {
      console.error('Erreur suppression ligne:', err);
      setError(err instanceof Error ? err.message : 'Erreur lors de la suppression');
    } finally {
      setIsRemovingLine(null);
    }
  };



  // Lignes du panier au format attendu par les sorties (permalink, estimation)
  const getCartLineItems = () =>
    cart?.lines.edges.map((edge) => ({
      variantId: edge.node.merchandise.id,
      quantity: edge.node.quantity,
    })) || [];

  // Sortie 1 — "🛒 Régler ma commande" : checkout Shopify du panier.
  // La remise -15% et l'éventuel buyerIdentity sont déjà posés sur le panier à sa
  // création ; sinon le checkout collecte les coordonnées lui-même.
  function handleReglerCommande() {
    if (!cart?.checkoutUrl) {
      setError('Panier non disponible. Merci de recharger la page.');
      return;
    }
    track('sortie_choisie', { sortie: 'checkout' });
    setIsProcessing(true);
    window.location.href = cart.checkoutUrl;
  }

  // Sortie 2 — "🛍️ Continuer mes achats" : cart permalink boutique construit
  // côté serveur (le code promo n'atteint jamais le bundle client).
  async function handleContinuerAchats() {
    const lines = getCartLineItems();
    if (lines.length === 0) {
      setError('Panier non disponible. Merci de recharger la page.');
      return;
    }

    track('sortie_choisie', { sortie: 'permalink' });
    setIsProcessing(true);
    setError(null);

    try {
      const response = await fetch('/api/calculateur/permalink', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lines: lines.map(l => ({ merchandiseId: l.variantId, quantity: l.quantity })) }),
      });

      const result = await response.json();

      if (!response.ok || !result.url) {
        throw new Error(result.error || "Impossible d'ouvrir la boutique. Merci de réessayer.");
      }

      window.location.href = result.url;
    } catch (err) {
      console.error('Erreur permalink:', err);
      setError(err instanceof Error ? err.message : "Impossible d'ouvrir la boutique. Merci de réessayer.");
      setIsProcessing(false);
    }
  }

  // Sortie 3 — "✉️ Recevoir mon estimation par e-mail" : la modale collecte les
  // coordonnées et appelle la route serveur (client + draft order remisé + invoice).
  function handleEstimationSuccess() {
    track('sortie_choisie', { sortie: 'estimation' });
    setShowEstimationModal(false);
    router.push('/calculateur/confirmation');
  }

  const handleBack = () => {
    router.push('/calculateur/options');
  };

  // Affichage du loader
  if (isLoading || isCreatingCart || !resultat) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        <p className="text-gray-600">
          {isCreatingCart ? 'Création du panier...' : 'Chargement...'}
        </p>
      </div>
    );
  }

  // Affichage de l'erreur
  if (error && !cart) {
    return (
      <div className="space-y-6">
        <StepIndicator 
          steps={CALCULATEUR_STEPS} 
          currentStep={5} 
          onStepClick={handleStepClick}
          isStepDisabled={isStepDisabled}
        />
        <Card className="bg-red-50 border-red-200">
          <CardContent className="py-6 text-center">
            <p className="text-red-600 font-medium mb-4">{error}</p>
            <Button onClick={() => initializeCart()} variant="outline">
              Réessayer
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Prix catalogue d'une ligne : `cost.subtotalAmount` renvoyé par Shopify (avant remise).
  // La remise du code promo n'apparaît PAS dans `cost.totalAmount` des lignes : Shopify
  // l'expose dans `discountAllocations` — au niveau ligne pour un code "montant sur des
  // produits", au niveau panier pour un code "montant sur la commande". On somme donc
  // ces allocations (montants exacts calculés par Shopify) pour l'économie et le total.
  const lignePrixCatalogue = (node: CartLineNode) =>
    node.cost
      ? parseFloat(node.cost.subtotalAmount.amount)
      : parseFloat(node.merchandise.price.amount) * node.quantity;
  const ligneAllocations = (node: CartLineNode) =>
    (node.discountAllocations ?? []).reduce(
      (sum, a) => sum + parseFloat(a.discountedAmount.amount),
      0
    );

  // Sous-total catalogue (produits, hors frais de port — calculés au checkout).
  const totalCatalogue = cart?.lines.edges.reduce(
    (sum, edge) => sum + lignePrixCatalogue(edge.node),
    0
  ) || 0;
  // Économie réelle = somme de TOUTES les allocations de remise Shopify (lignes +
  // panier). C'est le montant exact que le checkout déduira, au centime près.
  const economie =
    (cart?.lines.edges.reduce((sum, edge) => sum + ligneAllocations(edge.node), 0) || 0) +
    (cart?.discountAllocations ?? []).reduce(
      (sum, a) => sum + parseFloat(a.discountedAmount.amount),
      0
    );
  const remiseAppliquee = economie > 0.005;
  // Total remisé ancré sur les montants Shopify — jamais une somme d'arrondis locaux.
  const total = totalCatalogue - economie;

  // Prix remisé affiché pour une ligne : allocations de la ligne si Shopify les ventile
  // (exact), sinon catalogue × 0,85 à titre indicatif (code appliqué au niveau commande :
  // Shopify ne répartit pas par ligne ; le total, lui, reste exact via `economie`).
  // Aucun montant remisé n'est affiché si le code n'est pas réellement appliqué.
  const lignePrixRemise = (node: CartLineNode) => {
    const catalogue = lignePrixCatalogue(node);
    const alloc = ligneAllocations(node);
    if (alloc > 0.005) return catalogue - alloc;
    return remiseAppliquee ? catalogue * 0.85 : catalogue;
  };

  // Calculer le coût au m² selon la formule Colibri
  // Coût au m² = (Prix peintures + Prix sous-couches) / (Surface réelle × 3)
  // Surface × 3 = 1 couche sous-couche + 2 couches finition
  // Les prix `resultat.*.prixTotal` sont les prix catalogue Shopify (avant remise) ;
  // le coût remisé est l'indicateur au m² après -15%.
  const prixPeintures = resultat.peintures.reduce((sum, p) => sum + p.prixTotal, 0);
  const prixSousCouches = resultat.sousCouches.reduce((sum, s) => sum + s.prixTotal, 0);
  const coutAuM2Catalogue = (prixPeintures + prixSousCouches) / (resultat.surfaceTotale * 3);
  const coutAuM2 = remiseAppliquee ? coutAuM2Catalogue * 0.85 : coutAuM2Catalogue;

  // Grouper les lignes du panier par type
  const lignesParType = {
    peinture: [] as CartLineNode[],
    sousCouche: [] as CartLineNode[],
    kit: [] as CartLineNode[],
    renovation: [] as CartLineNode[],
  };

  cart?.lines.edges.forEach(({ node }) => {
    const type = getLineType(node.attributes);
    if (type === 'peinture') lignesParType.peinture.push(node);
    else if (type === 'sous-couche') lignesParType.sousCouche.push(node);
    else if (type === 'kit') lignesParType.kit.push(node);
    else if (type === 'renovation') lignesParType.renovation.push(node);
  });

  // Le kit est une ligne unique (produit bundle tout-ou-rien) : le titre vient
  // directement du résultat de calcul, jamais d'une reconstruction par composants.
  const titreKit = lignesParType.kit.length > 0 && resultat
    ? `🧰 ${resultat.kit.titre}`
    : '🧰 Matériel sélectionné';

  // Composant pour afficher une ligne produit
  const LigneProductJSX = ({ node }: { node: CartLineNode }) => {
    const surfaceOriginaleAttr = node.attributes.find(a => a.key === '_surface_originale') || node.attributes.find(a => a.key === 'surface_originale');
    const surfaceOriginale = surfaceOriginaleAttr ? parseFloat(surfaceOriginaleAttr.value) : 0;
    // Justification d'une composition dépassant le besoin par choix de prix
    const justification = node.attributes.find(a => a.key === '_justification')?.value;
    const lineType = getLineType(node.attributes);
    const ligneCatalogue = lignePrixCatalogue(node);
    const ligneRemise = lignePrixRemise(node);

    const canRemove = canRemoveLine(node.attributes);
    const isRemoving = isRemovingLine === node.id;
    
    const imageUrl = node.merchandise.image?.url || node.merchandise.product.featuredImage?.url;

    return (
      <div className="py-4 flex flex-wrap items-start gap-4">
        {/* Image */}
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={node.merchandise.product.title}
            className="w-16 h-16 object-cover rounded flex-shrink-0"
          />
        ) : (
          <div className="w-16 h-16 bg-gray-100 rounded flex items-center justify-center flex-shrink-0">
            {lineType === 'sous-couche' && <span className="text-2xl">🪣</span>}
            {lineType === 'kit' && <span className="text-2xl">🧰</span>}
            {lineType === 'renovation' && <span className="text-2xl">🔧</span>}
            {lineType === 'peinture' && <span className="text-2xl">🎨</span>}
            {lineType === 'unknown' && <span className="text-2xl">📦</span>}
          </div>
        )}

        {/* Info */}
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-gray-900">
            {node.merchandise.product.title}
          </h4>
          {node.merchandise.title !== 'Default Title' && (
            <p className="text-sm text-gray-500">
              {node.merchandise.title}
            </p>
          )}
          {lineType === 'peinture' && surfaceOriginale > 0 && (
            <p className="mt-1 text-xs text-gray-500">
              Surface réelle : {surfaceOriginale} m² (soit {surfaceOriginale * 2} m² pour 2 couches)
            </p>
          )}
          {justification && (
            <p className="mt-1 text-xs text-primary-700">
              💡 {justification}
            </p>
          )}
        </div>

        {/* Prix + Quantité + Corbeille (responsive) */}
        <div className="flex items-start gap-4 sm:ml-auto">
          {/* Prix */}
          <div className="text-right">
            {remiseAppliquee && (
              <p className="text-sm text-gray-500 line-through">{ligneCatalogue.toFixed(2)} €</p>
            )}
            <p className="text-lg font-semibold text-gray-900">{ligneRemise.toFixed(2)} €</p>
          </div>

          {/* Quantité + Corbeille (stacked on mobile, horizontal on desktop) */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
            {/* Quantité */}
            <div className="text-center sm:min-w-[60px]">
              <p className="font-medium text-gray-900">
                ×{node.quantity}
              </p>
            </div>

            {/* Bouton supprimer (si autorisé) */}
            {canRemove && (
              <button
                onClick={() => handleRemoveLine(node.id, node.attributes)}
                disabled={isRemoving}
                className="p-2 text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50 self-center"
                title="Supprimer"
              >
                {isRemoving ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-red-500"></div>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <StepIndicator 
        steps={CALCULATEUR_STEPS} 
        currentStep={5} 
        onStepClick={handleStepClick}
        isStepDisabled={isStepDisabled}
      />

      {/* Title */}
      <div className="text-center">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
          Récapitulatif de commande
        </h1>
        <p className="text-gray-600">
          Vérifiez votre commande avant de procéder au paiement
        </p>
      </div>

      {/* Erreur non bloquante */}
      {error && (
        <Card className="bg-yellow-50 border-yellow-200">
          <CardContent className="py-3">
            <p className="text-yellow-700 text-sm">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Résumé du projet + Coût total en haut */}
      <Card className="bg-primary-50 border-primary-200">
        <CardContent className="py-4">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 items-center">
            <div className="text-center">
              <p className="text-xl font-bold text-primary-600">{resultat.resume.nombrePieces}</p>
              <p className="text-xs text-primary-800">Pièce{resultat.resume.nombrePieces > 1 ? 's' : ''}</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold text-primary-600">{resultat.resume.nombreCouleurs}</p>
              <p className="text-xs text-primary-800">Couleur{resultat.resume.nombreCouleurs > 1 ? 's' : ''}</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold text-primary-600">{resultat.surfaceTotale.toFixed(1)} m²</p>
              <p className="text-xs text-primary-800">Surface totale</p>
            </div>
            <div className="text-center">
              {remiseAppliquee && (
                <p className="text-sm text-gray-500 line-through">{coutAuM2Catalogue.toFixed(2)} €</p>
              )}
              <p className="text-xl font-bold text-primary-600">
                {coutAuM2.toFixed(2)} €
              </p>
              <p className="text-xs text-primary-800">Coût / m²</p>
              <p className="text-[10px] text-primary-700">(sous-couche + 2 couches)</p>
            </div>
            <div className="text-center sm:border-l sm:border-primary-300 sm:pl-4">
              {remiseAppliquee && (
                <p className="text-xl font-bold text-gray-500 line-through">{totalCatalogue.toFixed(2)} €</p>
              )}
              <p className="text-2xl font-bold text-primary-600">{total.toFixed(2)} €</p>
              <p className="text-xs text-primary-800">Total</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Panier avec prix */}
      <Card>
        <CardHeader>
          <CardTitle>Produits sélectionnés</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Section Peintures de finition */}
            {lignesParType.peinture.length > 0 && (
              <div>
                <h3 className="font-semibold text-lg mb-3 pb-2 border-b border-gray-200 flex items-center gap-2">
                  <span>🎨</span> Peintures de finition
                  <span className="ml-2 text-sm text-gray-500">({lignesParType.peinture.length})</span>
                </h3>
                <div className="divide-y divide-gray-200">
                  {lignesParType.peinture.map((node) => (
                    <LigneProductJSX key={node.id} node={node} />
                  ))}
                </div>
              </div>
            )}

            {/* Section Sous-couches */}
            {lignesParType.sousCouche.length > 0 && (
              <div>
                <h3 className="font-semibold text-lg mb-3 pb-2 border-b border-gray-200 flex items-center gap-2">
                  <span>🪣</span> Sous-couches
                  <span className="ml-2 text-sm text-gray-500">({lignesParType.sousCouche.length})</span>
                </h3>
                <div className="divide-y divide-gray-200">
                  {lignesParType.sousCouche.map((node) => (
                    <LigneProductJSX key={node.id} node={node} />
                  ))}
                </div>
              </div>
            )}

            {/* Section Kit matériel */}
            {lignesParType.kit.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-200">
                  <h3 className="font-semibold text-lg flex items-center gap-2">
                    {titreKit}
                  </h3>
                </div>
                <div className="divide-y divide-gray-200">
                  {lignesParType.kit.map((node) => (
                    <LigneProductJSX key={node.id} node={node} />
                  ))}
                </div>
                {/* Sous-total kit */}
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">Sous-total matériel</span>
                    <div className="text-right">
                      {remiseAppliquee && (
                        <p className="text-gray-500 line-through">
                          {lignesParType.kit.reduce((sum, node) =>
                            sum + lignePrixCatalogue(node), 0
                          ).toFixed(2)} €
                        </p>
                      )}
                      <p className="font-semibold text-primary-600">
                        {lignesParType.kit.reduce((sum, node) =>
                          sum + lignePrixRemise(node), 0
                        ).toFixed(2)} €
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Section Préparation des surfaces (si présente) */}
            {lignesParType.renovation.length > 0 && (
              <div>
                <h3 className="font-semibold text-lg mb-3 pb-2 border-b border-gray-200 flex items-center gap-2">
                  <span>🔧</span> Préparation des surfaces
                  <span className="ml-2 text-sm text-gray-500">({lignesParType.renovation.length})</span>
                </h3>
                <div className="divide-y divide-gray-200">
                  {lignesParType.renovation.map((node) => (
                    <LigneProductJSX key={node.id} node={node} />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Synthèse en miroir du checkout : sous-total catalogue, remise exacte
              Shopify, total. Les trois montants viennent de Shopify (economie = somme
              des discountAllocations) : l'addition tombe juste au centime. */}
          <div className="mt-4 pt-4 border-t-2 border-gray-200">
            {remiseAppliquee ? (
              <div className="space-y-1">
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Sous-total</span>
                  <span>{totalCatalogue.toFixed(2)} €</span>
                </div>
                <div className="flex justify-between text-sm font-medium text-green-700">
                  <span>Remise −15 % appliquée automatiquement</span>
                  <span>−{economie.toFixed(2)} €</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                  <span className="text-lg font-semibold text-gray-900">Total</span>
                  <span className="text-2xl font-bold text-primary-600">{total.toFixed(2)} €</span>
                </div>
                <div className="flex justify-end pt-1">
                  <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-3 py-1 text-sm font-medium text-green-700">
                    🎉 Vous économisez {economie.toFixed(2)} €
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex justify-between items-center">
                <span className="text-lg font-semibold text-gray-900">Total</span>
                <span className="text-2xl font-bold text-primary-600">{total.toFixed(2)} €</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Actions — triple sortie du panier */}
      <div className="space-y-6 pt-4">
        <div className="flex flex-col gap-4 max-w-2xl mx-auto">
          {/* Sortie 1 : Régler ma commande */}
          <div className="text-center space-y-2">
            <button
              onClick={handleReglerCommande}
              disabled={isProcessing}
              className="w-full bg-primary-700 text-white py-4 px-6 rounded-lg font-semibold hover:bg-primary-800 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors text-lg"
            >
              {isProcessing ? 'Chargement...' : '🛒 Régler ma commande'}
            </button>
            <p className="text-sm text-gray-600">
              ⚡ Expédition 1 jour ouvré après commande
            </p>
          </div>

          {/* Sortie 2 : Continuer mes achats */}
          <div className="text-center space-y-2">
            <button
              onClick={handleContinuerAchats}
              disabled={isProcessing}
              className="w-full bg-white border-2 border-primary-200 text-primary-700 py-4 px-6 rounded-lg font-semibold hover:bg-primary-50 disabled:bg-gray-100 disabled:cursor-not-allowed transition-colors text-lg"
            >
              🛍️ Continuer mes achats
            </button>
            <p className="text-sm text-gray-600">
              Votre sélection vous suit sur la boutique, remise comprise
            </p>
          </div>

          <div className="relative py-4">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-gray-200"></span>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-gray-50 text-gray-500 font-medium uppercase tracking-wider">ou</span>
            </div>
          </div>

          {/* Sortie 3 : Recevoir mon estimation par e-mail */}
          <div className="text-center space-y-2">
            <button
              onClick={() => setShowEstimationModal(true)}
              disabled={isProcessing}
              className="w-full bg-white border-2 border-primary-200 text-primary-700 py-4 px-6 rounded-lg font-semibold hover:bg-primary-50 disabled:bg-gray-100 disabled:cursor-not-allowed transition-colors text-lg"
            >
              ✉️ Recevoir mon estimation par e-mail
            </button>
            <p className="text-sm text-gray-600">
              ⏳ Je peux commander plus tard
            </p>
          </div>
        </div>

        <div className="flex justify-center pt-4">
          <Button
            variant="ghost"
            onClick={handleBack}
            className="text-gray-500 hover:text-gray-700"
          >
            ← Modifier les options
          </Button>
        </div>
      </div>

      {/* Modale estimation par e-mail */}
      <EstimationModal
        isOpen={showEstimationModal}
        onClose={() => setShowEstimationModal(false)}
        lineItems={getCartLineItems()}
        projet={{
          surfaceTotale: resultat.surfaceTotale,
          nombrePieces: resultat.resume.nombrePieces,
        }}
        onSuccess={handleEstimationSuccess}
      />
    </div>
  );
}
