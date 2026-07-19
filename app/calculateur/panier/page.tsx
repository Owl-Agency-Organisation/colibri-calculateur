'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StepIndicator, CALCULATEUR_STEPS } from '@/components/ui/StepIndicator';
import { useStepperNavigation } from '@/hooks/useStepperNavigation';
import { getStoredPieces, getStoredClient, STORAGE_KEYS } from '@/lib/store/projetStore';
import { createCart, removeCartLines, getCart, updateCartBuyerIdentity, type ShopifyCart, type CartLineNode, type BuyerInfo, type UserData } from '@/lib/shopify-cart';
import { normalizeFrenchPhone } from '@/lib/utils/phone';
import { mapCalculToCartLines, canRemoveLine, getLineType, PRODUITS_RENOVATION } from '@/lib/cart-mapper';
import { determinerKit, KITS_CONFIG } from '@/lib/kits-config';
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
  
  // États pour les actions
  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState('');

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

      // Préparer les informations de l'acheteur pour pré-remplir le checkout
      const userData = JSON.parse(localStorage.getItem('USER_DATA') || '{}');
      const normalizedPhone = normalizeFrenchPhone(userData.telephone);
      const buyerInfo = client?.email ? {
        email: client.email,
        phone: normalizedPhone || undefined,
        firstName: userData.prenom,
        lastName: userData.nom,
        address1: userData.adresse,
        city: userData.ville,
        zip: userData.codePostal,
        country: 'FR',
      } : undefined;

      const newCart = await createCart(cartLines, buyerInfo);
      
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
  }, [resultat, shopifyData, options, client?.email]);

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
            // Retirer le composant de la liste des composants kit
            const composantHandle = attributes.find(a => a.key === '_composant')?.value || attributes.find(a => a.key === 'composant')?.value;
            if (composantHandle && options.composantsKit) {
              options.composantsKit = options.composantsKit.filter((h: string) => h !== composantHandle);
              
              // Si tous les composants sont supprimés, décocher l'option kit
              if (options.composantsKit.length === 0) {
                options.kit = false;
              }
            }
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



  // Fonction helper pour préparer les données de checkout
  const prepareCheckoutData = () => {
    const userData = JSON.parse(localStorage.getItem('USER_DATA') || '{}');
    const customerId = localStorage.getItem('CUSTOMER_ID');
    const lineItems = cart?.lines.edges.map((edge: any) => ({
      variantId: edge.node.merchandise.id,
      quantity: edge.node.quantity,
    })) || [];
    
    return { userData, customerId, lineItems };
  };

  // Fonction pour "Commander maintenant" (checkout direct)
  async function handleCommanderMaintenant() {
    if (!cart?.checkoutUrl || !cart?.id) {
      alert('Erreur : Panier non disponible');
      return;
    }
    
    setIsProcessing(true);
    
    try {
      const { userData, customerId, lineItems } = prepareCheckoutData();
      
      if (!customerId) {
        console.warn('No customer ID found');
      }
      
      // NOUVEAU : Pré-remplir le checkout avec les données utilisateur
      if (userData.email) {
        console.log('Updating cart buyer identity...');
        const updatedCart = await updateCartBuyerIdentity(cart.id, userData);
        
        if (updatedCart) {
          console.log('Buyer identity updated successfully');
        } else {
          console.warn('Failed to update buyer identity, checkout may not be pre-filled');
        }
      }
      
      // Appeler l'API checkout en mode direct (pour tracking/logs)
      const response = await fetch('/api/calculateur/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'direct',
          customerId,
          lineItems,
          userData,
          cartCheckoutUrl: cart.checkoutUrl,
        }),
      });
      
      const result = await response.json();
      
      if (result.success && result.checkoutUrl) {
        // Rediriger vers le checkout Shopify (maintenant pré-rempli)
        window.location.href = result.checkoutUrl;
      } else {
        alert('Erreur lors de la préparation du checkout');
        setIsProcessing(false);
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Une erreur est survenue');
      setIsProcessing(false);
    }
  }

  // Fonction pour "Sauvegarder mon projet" (draft order)
  async function handleSauvegarderProjet() {
    if (!cart) {
      alert('Erreur : Panier non disponible');
      return;
    }
    
    setIsProcessing(true);
    setMessage('');
    
    try {
      const { userData, customerId, lineItems } = prepareCheckoutData();
      
      if (!customerId) {
        alert('Erreur : Client non créé. Veuillez recharger la page.');
        setIsProcessing(false);
        return;
      }
      
      // Appeler l'API checkout en mode save
      const response = await fetch('/api/calculateur/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'save',
          customerId,
          lineItems,
          userData,
        }),
      });
      
      const result = await response.json();
      
      if (result.success) {
        setMessage(result.message);
      } else {
        alert('Erreur lors de la sauvegarde du projet : ' + (result.error || 'Erreur inconnue'));
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Une erreur est survenue');
    } finally {
      setIsProcessing(false);
    }
  }

  const handleBack = () => {
    router.push('/calculateur/options');
  };

  // Affichage du loader
  if (isLoading || isCreatingCart || !resultat || !client) {
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
          currentStep={6} 
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

  // Calculer le total manuellement (somme des produits, sans frais de port)
  // Les frais de port seront calculés uniquement au checkout
  const total = cart?.lines.edges.reduce((sum, edge) => {
    return sum + (parseFloat(edge.node.merchandise.price.amount) * edge.node.quantity);
  }, 0) || 0;
  const DISCOUNT_FACTOR = 0.85;
  const totalFull = total / DISCOUNT_FACTOR;

  // Calculer le coût au m² selon la formule Colibri
  // Coût au m² = (Prix peintures + Prix sous-couches) / (Surface réelle × 3)
  // Surface × 3 = 1 couche sous-couche + 2 couches finition
  const prixPeintures = resultat.peintures.reduce((sum, p) => sum + p.prixTotal, 0);
  const prixSousCouches = resultat.sousCouches.reduce((sum, s) => sum + s.prixTotal, 0);
  const coutAuM2 = (prixPeintures + prixSousCouches) / (resultat.surfaceTotale * 3);
  const coutAuM2Full = coutAuM2 / DISCOUNT_FACTOR;

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

  // Vérifier si tous les composants du kit sont présents
  const kitType = lignesParType.kit.length > 0
    ? (lignesParType.kit[0].attributes.find(a => a.key === '_kit_type')?.value || lignesParType.kit[0].attributes.find(a => a.key === 'kit_type')?.value)
    : null;

  let estKitComplet = false;
  let titreKit = '🧰 Matériel sélectionné';

  if (kitType && resultat) {
    const kitConfig = KITS_CONFIG[kitType as keyof typeof KITS_CONFIG];
    if (kitConfig) {
      const composantsPresents = lignesParType.kit.map(node =>
(node.attributes.find(a => a.key === '_composant')?.value || node.attributes.find(a => a.key === 'composant')?.value)
      );

      estKitComplet = kitConfig.composants.every(c =>
        composantsPresents.includes(c.handle)
      );

      if (estKitComplet) {
        titreKit = `🧰 ${kitConfig.titre}`;
      }
    }
  }

  // Composant pour afficher une ligne produit
  const LigneProductJSX = ({ node }: { node: CartLineNode }) => {
    const surfaceOriginaleAttr = node.attributes.find(a => a.key === '_surface_originale') || node.attributes.find(a => a.key === 'surface_originale');
    const surfaceOriginale = surfaceOriginaleAttr ? parseFloat(surfaceOriginaleAttr.value) : 0;
    const lineType = getLineType(node.attributes);
    let lineTotal = parseFloat(node.merchandise.price.amount) * node.quantity;

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
        </div>

        {/* Prix + Quantité + Corbeille (responsive) */}
        <div className="flex items-start gap-4 sm:ml-auto">
          {/* Prix */}
          <div className="text-right">
            <p className="text-sm text-gray-500 line-through">{(lineTotal / DISCOUNT_FACTOR).toFixed(2)} €</p>
            <p className="text-lg font-semibold text-gray-900">{lineTotal.toFixed(2)} €</p>
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
        currentStep={6} 
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
              <p className="text-sm text-gray-500 line-through">{coutAuM2Full.toFixed(2)} €</p>
              <p className="text-xl font-bold text-primary-600">
                {coutAuM2.toFixed(2)} €
              </p>
              <p className="text-xs text-primary-800">Coût / m²</p>
              <p className="text-[10px] text-primary-700">(sous-couche + 2 couches)</p>
            </div>
            <div className="text-center sm:border-l sm:border-primary-300 sm:pl-4">
              <p className="text-xl font-bold text-gray-500 line-through">{totalFull.toFixed(2)} €</p>
              <p className="text-2xl font-bold text-primary-600">{total.toFixed(2)} €</p>
              <p className="text-xs text-primary-800">Total</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Vos informations */}
      <Card>
        <CardHeader>
          <CardTitle>Vos informations</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500">Nom complet</p>
              <p className="font-medium text-gray-900">
                {client.civilite} {client.prenom} {client.nom}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Email</p>
              <p className="font-medium text-gray-900">{client.email}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Téléphone</p>
              <p className="font-medium text-gray-900">{client.telephone}</p>
            </div>
            {client.adresse && (
              <div>
                <p className="text-sm text-gray-500">Adresse</p>
                <p className="font-medium text-gray-900">
                  {client.adresse}
                  {client.codePostal && `, ${client.codePostal}`}
                  {client.ville && ` ${client.ville}`}
                </p>
              </div>
            )}
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
                    <span className="ml-2 text-sm text-gray-500">({lignesParType.kit.length})</span>
                  </h3>
                  {estKitComplet && (
                    <span className="text-xs text-green-600 font-medium">✓ Kit complet</span>
                  )}
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
                      <p className="text-gray-500 line-through">
                        {lignesParType.kit.reduce((sum, node) =>
                          sum + (parseFloat(node.merchandise.price.amount) * node.quantity / DISCOUNT_FACTOR), 0
                        ).toFixed(2)} €
                      </p>
                      <p className="font-semibold text-primary-600">
                        {lignesParType.kit.reduce((sum, node) =>
                          sum + (parseFloat(node.merchandise.price.amount) * node.quantity), 0
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

          {/* Total */}
          <div className="mt-4 pt-4 border-t-2 border-gray-200">
            <div className="flex justify-between items-center">
              <span className="text-lg font-semibold text-gray-900">Total</span>
              <div className="flex flex-col items-end">
                <span className="text-lg text-gray-500 line-through">{totalFull.toFixed(2)} €</span>
                <span className="text-2xl font-bold text-primary-600">{total.toFixed(2)} €</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="space-y-6 pt-4">
        <div className="flex flex-col gap-4 max-w-2xl mx-auto">
          {/* Message de confirmation si projet sauvegardé */}
          {message && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-green-800">{message}</p>
            </div>
          )}

          {/* Bouton 1 : Valider le panier */}
          <div className="text-center space-y-2">
            <button
              onClick={handleCommanderMaintenant}
              disabled={isProcessing}
              className="w-full bg-primary-700 text-white py-4 px-6 rounded-lg font-semibold hover:bg-primary-800 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors text-lg"
            >
              {isProcessing ? 'Chargement...' : '⚡ Valider le panier'}
            </button>
            <p className="text-sm text-gray-600">
              ⚡ Expédition 1 jour ouvré après commande
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

          {/* Bouton 2 : Recevoir mon estimation par e-mail */}
          <div className="text-center space-y-2">
            <button
              onClick={handleSauvegarderProjet}
              disabled={isProcessing}
              className="w-full bg-white border-2 border-primary-200 text-primary-700 py-4 px-6 rounded-lg font-semibold hover:bg-primary-50 disabled:bg-gray-100 disabled:cursor-not-allowed transition-colors text-lg"
            >
              {isProcessing ? 'Envoi en cours...' : 'Recevoir mon estimation par e-mail'}
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
    </div>
  );
}
