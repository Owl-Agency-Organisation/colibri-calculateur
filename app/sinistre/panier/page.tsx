'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StepIndicator, SINISTRE_STEPS } from '@/components/ui/StepIndicator';
import { useStepperNavigation } from '@/hooks/useStepperNavigation';
import { getStoredPieces, getStoredAssure, STORAGE_KEYS } from '@/lib/store/sinistreStore';
import { createCart, removeCartLines, getCart, type ShopifyCart, type CartLineNode } from '@/lib/shopify-cart';
import { mapCalculToCartLines, canRemoveLine, getLineType, PRODUITS_RENOVATION } from '@/lib/cart-mapper';
import type { ResultatCalcul } from '@/lib/calcul';
import type { Piece, Assure } from '@/lib/types';

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
  const [assure, setAssure] = useState<Assure | null>(null);
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
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  // Charger les données initiales
  useEffect(() => {
    const storedAssure = getStoredAssure();
    const storedPieces = getStoredPieces();
    const storedCalcul = localStorage.getItem(STORAGE_KEYS.CALCUL);
    const storedOptions = localStorage.getItem(STORAGE_KEYS.OPTIONS);
    const storedShopifyData = localStorage.getItem(STORAGE_KEYS.SHOPIFY_DATA);

    if (!storedCalcul || storedPieces.length === 0) {
      router.push('/sinistre/piece');
      return;
    }

    setAssure(storedAssure);
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

      const newCart = await createCart(cartLines, assure?.email);
      
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
  }, [resultat, shopifyData, options, assure?.email]);

  // Initialiser le panier quand les données sont prêtes
  useEffect(() => {
    if (resultat && shopifyData && Object.keys(shopifyData).length > 0) {
      initializeCart();
    }
  }, [resultat, shopifyData, initializeCart]);

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
    } catch (err) {
      console.error('Erreur suppression ligne:', err);
      setError(err instanceof Error ? err.message : 'Erreur lors de la suppression');
    } finally {
      setIsRemovingLine(null);
    }
  };

  // Générer le PDF
  const handleGeneratePdf = async () => {
    setIsGeneratingPdf(true);
    try {
      // Construire les lignes du panier pour le PDF depuis le cart Shopify
      const lignesPanier = cart?.lines.edges.map(({ node }) => ({
        id: node.id,
        type: getLineType(node.attributes),
        titre: `${node.merchandise.product.title} - ${node.merchandise.title}`,
        description: '',
        quantite: node.quantity,
        unite: '',
        prixUnitaire: parseFloat(node.merchandise.price.amount),
        prixTotal: parseFloat(node.merchandise.price.amount) * node.quantity,
        imageUrl: node.merchandise.image?.url || node.merchandise.product.featuredImage?.url,
        editable: false,
      })) || [];

      const response = await fetch('/api/generate-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          assure,
          pieces,
          resultat,
          options,
          lignesPanier,
          total: parseFloat(cart?.cost.totalAmount.amount || '0'),
        }),
      });

      if (!response.ok) {
        throw new Error('Erreur lors de la génération du PDF');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `commande-colibri-${Date.now()}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      router.push('/sinistre/confirmation');
    } catch (error) {
      console.error('Erreur PDF:', error);
      alert('Une erreur est survenue lors de la génération du PDF. Veuillez réessayer.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Procéder au checkout Shopify
  const handleCheckout = () => {
    if (cart?.checkoutUrl) {
      window.location.href = cart.checkoutUrl;
    }
  };

  const handleBack = () => {
    router.push('/sinistre/options');
  };

  // Affichage du loader
  if (isLoading || isCreatingCart || !resultat || !assure) {
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
          steps={SINISTRE_STEPS} 
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

  // Calculer le total depuis le panier Shopify
  const total = parseFloat(cart?.cost.totalAmount.amount || '0');

  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <StepIndicator 
        steps={SINISTRE_STEPS} 
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
              <p className="text-xl font-bold text-primary-600">
                {resultat.peintures.reduce((sum, p) => sum + p.litresCommandes, 0)}L
              </p>
              <p className="text-xs text-primary-800">Peinture</p>
            </div>
            <div className="text-center sm:border-l sm:border-primary-300 sm:pl-4">
              <p className="text-2xl font-bold text-primary-700">{total.toFixed(2)} €</p>
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
                {assure.civilite} {assure.prenom} {assure.nom}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Email</p>
              <p className="font-medium text-gray-900">{assure.email}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Téléphone</p>
              <p className="font-medium text-gray-900">{assure.telephone}</p>
            </div>
            {assure.adresse && (
              <div>
                <p className="text-sm text-gray-500">Adresse</p>
                <p className="font-medium text-gray-900">
                  {assure.adresse}
                  {assure.codePostal && `, ${assure.codePostal}`}
                  {assure.ville && ` ${assure.ville}`}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Panier avec prix - Design conservé */}
      <Card>
        <CardHeader>
          <CardTitle>Produits sélectionnés</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="divide-y divide-gray-200">
            {cart?.lines.edges.map(({ node }) => {
	              const surfaceOriginaleAttr = node.attributes.find(a => a.key === 'surface_originale');
	              const surfaceOriginale = surfaceOriginaleAttr ? parseFloat(surfaceOriginaleAttr.value) : 0;
	              const prixUnitaire = parseFloat(node.merchandise.price.amount);
	              const lineType = getLineType(node.attributes);
	              let lineTotal = parseFloat(node.merchandise.price.amount) * node.quantity;
	              
	              // Calcul du prix au m² (approximatif, basé sur le prix total de la ligne)
	              // On suppose que le prix total de la ligne correspond au prix du contenant
	              // On doit trouver le prix du contenant sans remise pour le prix barré
	              // Pour l'instant, on va utiliser une remise fixe de 15% pour simuler
	              const REMISE = 0.15;
	              
	              let prixM2Plein = 0;
	              let prixM2Remise = 0;
	              
	              if (lineType === 'peinture' && surfaceOriginale > 0) {
// Prix total de la ligne (sans remise)
		                const prixTotalLignePlein = lineTotal;
		                // Prix total de la ligne (avec remise)
		                const prixTotalLigneRemise = prixTotalLignePlein * (1 - REMISE);
	                
	                // Prix au m² (sans remise)
	                prixM2Plein = prixTotalLignePlein / (surfaceOriginale * 2);
// Prix au m² (avec remise)
		                prixM2Remise = prixTotalLigneRemise / (surfaceOriginale * 2);
		                
// Le prix affiché dans la colonne Prix est le prix remisé
			                lineTotal = prixTotalLigneRemise;
	              }
	              
	              

              const canRemove = canRemoveLine(node.attributes);
              const isRemoving = isRemovingLine === node.id;
              
              const imageUrl = node.merchandise.image?.url || node.merchandise.product.featuredImage?.url;

              return (
                <div key={node.id} className="py-4 flex items-center gap-4">
                  {/* Image */}
                  {imageUrl ? (
                    <img
                      src={imageUrl}
                      alt={node.merchandise.product.title}
                      className="w-16 h-16 object-cover rounded"
                    />
                  ) : (
                    <div className="w-16 h-16 bg-gray-100 rounded flex items-center justify-center">
                      {lineType === 'sous-couche' && <span className="text-2xl">🪣</span>}
                      {lineType === 'kit' && <span className="text-2xl">🧰</span>}
                      {lineType === 'renovation' && <span className="text-2xl">🔧</span>}
                      {lineType === 'peinture' && <span className="text-2xl">🎨</span>}
                      {lineType === 'unknown' && <span className="text-2xl">📦</span>}
                    </div>
                  )}

                  {/* Info */}
<div className="flex-1">
	                    <h4 className="font-medium text-gray-900">
	                      {node.merchandise.product.title}
	                    </h4>
	                    <p className="text-sm text-gray-500">
	                      {node.merchandise.title}
	                    </p>
	                    {lineType === 'peinture' && (
	                      <div className="mt-1 text-xs text-gray-500">
	                        <p>Surface réelle : {surfaceOriginale} m² (soit {surfaceOriginale * 2} m² pour 2 couches)</p>
	                        <p>
	                          Prix au m² : <span className="line-through text-red-500">{prixM2Plein.toFixed(2)} €</span> <span className="font-semibold text-green-600">{prixM2Remise.toFixed(2)} €</span>
	                        </p>
	                      </div>
	                    )}
	                  </div>

                  {/* Quantité */}
                  <div className="text-center min-w-[60px]">
                    <p className="font-medium text-gray-900">
                      ×{node.quantity}
                    </p>
                  </div>

                  {/* Prix */}
<div className="text-right min-w-[80px]">
	                    <p className="font-semibold text-gray-900">{lineTotal.toFixed(2)} €</p>
	                  </div>

                  {/* Bouton supprimer (si autorisé) */}
                  {canRemove && (
                    <button
                      onClick={() => handleRemoveLine(node.id, node.attributes)}
                      disabled={isRemoving}
                      className="p-2 text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50"
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
              );
            })}
          </div>

          {/* Total */}
          <div className="mt-4 pt-4 border-t-2 border-gray-200">
            <div className="flex justify-between items-center">
              <span className="text-lg font-semibold text-gray-900">Total</span>
              <span className="text-2xl font-bold text-primary-600">{total.toFixed(2)} €</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="space-y-6 pt-4">
        <div className="flex flex-col gap-4 max-w-2xl mx-auto">
          {/* CTA Principal : Checkout Shopify */}
          <div className="text-center space-y-2">
            <Button
              size="lg"
              className="w-full py-8 text-xl font-bold bg-primary-600 hover:bg-primary-700 shadow-lg flex items-center justify-center gap-3"
              onClick={handleCheckout}
              disabled={!cart?.checkoutUrl}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Commander et recevoir sous 72h
            </Button>
            <p className="text-sm text-gray-500 font-medium">
              ⚡ Livraison prioritaire à domicile pour votre sinistre
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

          {/* CTA Secondaire : Sauvegarde PDF */}
          <div className="text-center space-y-2">
            <Button
              variant="outline"
              size="lg"
              className="w-full py-6 text-lg border-2 border-primary-200 text-primary-700 hover:bg-primary-50 flex items-center justify-center gap-3"
              onClick={handleGeneratePdf}
              disabled={isGeneratingPdf}
            >
              {isGeneratingPdf ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-600"></div>
                  Génération en cours...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Sauvegarder mon estimation (PDF)
                </>
              )}
            </Button>
            <p className="text-sm text-gray-500">
              ⏳ J'attends mon indemnisation de la part de mon assureur
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
