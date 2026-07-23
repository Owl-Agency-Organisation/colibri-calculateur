'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import toast, { Toaster } from 'react-hot-toast';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StepIndicator, CALCULATEUR_STEPS } from '@/components/ui/StepIndicator';
import { useStepperNavigation } from '@/hooks/useStepperNavigation';
import { getStoredPieces, STORAGE_KEYS } from '@/lib/store/projetStore';
import { calculerQuantites, type ResultatCalcul } from '@/lib/calcul';
import { determinerKit, KITS_CONFIG } from '@/lib/kits-config';
import type { Piece } from '@/lib/types';

// Produits de rénovation (trous/fissures)
// REMARQUE : Les prix sont récupérés dynamiquement depuis Shopify
const PRODUITS_RENOVATION = [
  { handle: 'pate-a-renover-multi-materiaux', titre: 'Pâte à rénover multi matériaux' },
  { handle: 'couteau-de-peintre', titre: 'Couteau de peintre (spatule)' },
  { handle: 'papier-a-poncer', titre: 'Papier à poncer grain 120' },
  { handle: 'cale-a-poncer-auto-agrippante', titre: 'Cale à poncer' },
];

export default function OptionsPage() {
  const router = useRouter();
  const { handleStepClick, isStepDisabled } = useStepperNavigation();
  const [pieces, setPieces] = useState<Piece[]>([]);
  const [resultat, setResultat] = useState<ResultatCalcul | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoadingShopify, setIsLoadingShopify] = useState(false);
  const optionSousCouche = true;
  const [optionKit, setOptionKit] = useState(true); // ✅ Kit coché par défaut
  const [optionRenovation, setOptionRenovation] = useState(false);
  const [shopifyData, setShopifyData] = useState<Record<string, any>>({});

  // États pour la gestion des produits de rénovation sélectionnés
  const [produitsRenovation, setProduitsRenovation] = useState<string[]>([]);

  useEffect(() => {
    const init = async () => {
      const stored = getStoredPieces();
      if (stored.length === 0) {
        router.push('/calculateur/piece');
        return;
      }
      setPieces(stored);

      // 1. Calculer d'abord la surface totale pour déterminer le kit
      const surfaceTotale = stored.reduce((sum, p) => {
        const surfacePlafond = p.surfacePlafond || 0;
        const surfaceMurs = p.murs.reduce((s, m) => s + (m.surface || 0), 0);
        const surfaceBoiseries = p.surfaceBoiseries || 0;
        return sum + surfacePlafond + surfaceMurs + surfaceBoiseries;
      }, 0);

      // 2. Identifier tous les handles de produits nécessaires
      const handles = new Set<string>();
      stored.forEach(p => {
        p.murs.forEach(m => handles.add(m.couleur.productHandle));
        if (p.couleurPlafond) handles.add(p.couleurPlafond.productHandle);
        if (p.couleurBoiseries) handles.add(p.couleurBoiseries.productHandle);
      });
      
      // Ajouter les sous-couches
      handles.add('sous-couche-blanche-peinture-biosourcee-murs-et-plafonds');
      handles.add('sous-couche-grise-peinture-biosourcee-murs-et-plafonds');
      
      // Ajouter le kit recommandé selon la surface (produit unique, prix bundle)
      const kitType = determinerKit(surfaceTotale);
      const kitConfig = KITS_CONFIG[kitType];
      handles.add(kitConfig.handle);

      // Ajouter les produits de rénovation
      PRODUITS_RENOVATION.forEach(p => handles.add(p.handle));

      // 3. Charger les données Shopify en parallèle
      setIsLoadingShopify(true);
      const shopifyData: Record<string, any> = {};
      
      try {
        await Promise.all(Array.from(handles).map(async (handle) => {
          const res = await fetch(`/api/shopify/products/variants?handle=${handle}`);
          if (res.ok) {
            const data = await res.json();
            shopifyData[handle] = data;
          }
        }));
      } catch (error) {
        console.error('Error loading Shopify data:', error);
      } finally {
        setIsLoadingShopify(false);
      }

      // 4. Calculer les quantités avec les données réelles
      const calcul = calculerQuantites(stored, shopifyData);
      setResultat(calcul);

      // Détecter si le kit a changé
      const kitActuel = determinerKit(calcul.surfaceTotale);
      const kitPrecedent = localStorage.getItem('KIT_TYPE');
      
      if (kitPrecedent && kitPrecedent !== kitActuel) {
        // ✅ SUPPRIMÉ : Toast de notification (inutile et confusant)
        // Le kit change automatiquement, pas besoin d'informer l'utilisateur
        
        // Forcer recréation du panier pour mettre à jour le kit
        localStorage.removeItem('SHOPIFY_CART_ID');
        localStorage.removeItem('SHOPIFY_CART_DATA_HASH');
      }
      
      // Sauvegarder le type de kit actuel
      localStorage.setItem('KIT_TYPE', kitActuel);

      // 5. Charger les options sauvegardées
      const savedOptions = localStorage.getItem(STORAGE_KEYS.OPTIONS);
      if (savedOptions) {
        const parsed = JSON.parse(savedOptions);

        setOptionKit(parsed.kit ?? true); // ✅ Default true si undefined
        setOptionRenovation(parsed.renovation ?? false);

        if (parsed.produitsRenovation) {
          setProduitsRenovation(parsed.produitsRenovation);
        } else if (parsed.renovation) {
          // Si pas de produits sauvegardés mais rénovation activée, initialiser avec tous les produits
          setProduitsRenovation(PRODUITS_RENOVATION.map(p => p.handle));
        }
      } else {
        // ✅ NOUVEAU : Initialiser par défaut avec le kit activé
        setOptionKit(true);
        // Sauvegarder immédiatement
        saveOptions(true, false, []);
      }

      // 6. Sauvegarder le calcul et les données Shopify dans localStorage
      localStorage.setItem(STORAGE_KEYS.CALCUL, JSON.stringify(calcul));
      localStorage.setItem(STORAGE_KEYS.SHOPIFY_DATA, JSON.stringify(shopifyData));
      setShopifyData(shopifyData);
      setIsLoaded(true);
    };

    init();
  }, [router]);

  const saveOptions = (kit: boolean, renovation: boolean, produits?: string[]) => {
    localStorage.setItem(STORAGE_KEYS.OPTIONS, JSON.stringify({
      sousCouche: true, // Toujours true car obligatoire
      kit,
      renovation,
      produitsRenovation: produits || produitsRenovation,
    }));
  };

  const handleOptionChange = (option: 'kit' | 'renovation', value: boolean) => {
    if (option === 'kit') {
      setOptionKit(value);
      saveOptions(value, optionRenovation, produitsRenovation);
      // Forcer recréation du panier pour refléter l'ajout/retrait du kit
      localStorage.removeItem('SHOPIFY_CART_ID');
      localStorage.removeItem('SHOPIFY_CART_DATA_HASH');
    } else if (option === 'renovation') {
      setOptionRenovation(value);
      if (value) {
        // Initialiser avec tous les produits de rénovation
        const handles = PRODUITS_RENOVATION.map(p => p.handle);
        setProduitsRenovation(handles);
        saveOptions(optionKit, value, handles);
      } else {
        saveOptions(optionKit, value, []);
      }
    }
  };

  const supprimerProduitRenovation = (handle: string) => {
    const nouveauxProduits = produitsRenovation.filter(h => h !== handle);
    setProduitsRenovation(nouveauxProduits);
    saveOptions(optionKit, optionRenovation, nouveauxProduits);

    // Forcer recréation du panier
    localStorage.removeItem('SHOPIFY_CART_ID');
    localStorage.removeItem('SHOPIFY_CART_DATA_HASH');
  };

  const reinitialiserRenovation = () => {
    const handles = PRODUITS_RENOVATION.map(p => p.handle);
    setProduitsRenovation(handles);
    setOptionRenovation(true);
    saveOptions(optionKit, true, handles);

    // Forcer recréation du panier
    localStorage.removeItem('SHOPIFY_CART_ID');
    localStorage.removeItem('SHOPIFY_CART_DATA_HASH');
  };

  const handleContinue = () => {
    router.push('/calculateur/panier');
  };

  const handleBack = () => {
    router.push('/calculateur/recapitulatif');
  };

  if (!isLoaded || !resultat) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  const kitType = determinerKit(resultat.surfaceTotale);
  const kitConfig = KITS_CONFIG[kitType];

  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <StepIndicator 
        steps={CALCULATEUR_STEPS} 
        currentStep={4} 
        onStepClick={handleStepClick}
        isStepDisabled={isStepDisabled}
      />

      {/* Title */}
      <div className="text-center">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
          Choix des options
        </h1>
        <p className="text-gray-600">
          Kit matériel, préparation des surfaces : vous choisissez !
        </p>
      </div>

      {/* Kit matériel — tout-ou-rien : un seul produit boutique, contenu informatif */}
      <Card>
        <CardHeader>
          <CardTitle>Kit matériel</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-start gap-4">
              <input
                type="checkbox"
                id="kit"
                checked={optionKit}
                onChange={(e) => handleOptionChange('kit', e.target.checked)}
                className="w-5 h-5 mt-1 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <label htmlFor="kit" className="flex-1 cursor-pointer">
                <p className="font-medium text-gray-900">
                  Souhaitez-vous inclure le kit matériel ?
                </p>
                <p className="text-sm text-gray-600 mt-1">
                  {kitConfig.titre} recommandé pour les surfaces {resultat.surfaceTotale <= 30 ? '≤ 30' : '> 30'} m²
                </p>
              </label>
            </div>

            {optionKit && (
              <div className="pt-2 border-t border-gray-200">
                {(() => {
                  const kitProductData = shopifyData[kitConfig.handle];
                  const imageUrl = kitProductData?.featuredImage?.url;
                  const contenu = (kitProductData?.description || '')
                    .split('\n')
                    .map((ligne: string) => ligne.trim())
                    .filter(Boolean);

                  return (
                    <div className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg">
                      {imageUrl ? (
                        <img
                          src={imageUrl}
                          alt={kitConfig.titre}
                          className="w-12 h-12 object-cover rounded flex-shrink-0"
                        />
                      ) : (
                        <div className="w-12 h-12 bg-gray-100 rounded flex items-center justify-center flex-shrink-0">
                          <span className="text-xl">🧰</span>
                        </div>
                      )}
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">{kitConfig.titre}</p>
                        {contenu.length > 0 ? (
                          <ul className="mt-1 text-sm text-gray-600 list-disc list-inside">
                            {contenu.map((ligne: string, i: number) => (
                              <li key={i}>{ligne}</li>
                            ))}
                          </ul>
                        ) : (
                          <p className="mt-1 text-sm text-gray-500">Contenu détaillé sur la fiche produit.</p>
                        )}
                        <p className="mt-2 text-xs text-gray-500">
                          Contenu à titre informatif — non modifiable (produit boutique unique).
                        </p>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Préparation des surfaces */}
      <Card>
        <CardHeader>
          <CardTitle>Préparation des surfaces</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-start gap-4">
              <input
                type="checkbox"
                id="renovation"
                checked={optionRenovation}
                onChange={(e) => handleOptionChange('renovation', e.target.checked)}
                className="w-5 h-5 mt-1 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <label htmlFor="renovation" className="flex-1 cursor-pointer">
                <p className="font-medium text-gray-900">
                  Y a-t-il des trous ou fissures à reboucher ?
                </p>
                <p className="text-sm text-gray-600 mt-1">
                  Si oui, nous ajouterons le matériel nécessaire pour préparer vos surfaces avant peinture.
                </p>
              </label>
            </div>

            {optionRenovation && (
              <div className="space-y-2 pt-2 border-t border-gray-200">
                {/* Liste des produits */}
                {PRODUITS_RENOVATION
                  .filter(p => produitsRenovation.includes(p.handle))
                  .map((produit) => {
                    const productData = shopifyData[produit.handle];
                    const imageUrl = productData?.featuredImage?.url;
                    
                    return (
                      <div key={produit.handle} className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg">
                        {/* Image */}
                        {imageUrl ? (
                          <img
                            src={imageUrl}
                            alt={produit.titre}
                            className="w-12 h-12 object-cover rounded"
                          />
                        ) : (
                          <div className="w-12 h-12 bg-gray-100 rounded flex items-center justify-center">
                            <span className="text-xl">🔧</span>
                          </div>
                        )}
                        
                        {/* Nom */}
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">{produit.titre}</p>
                        </div>
                        
                        {/* Bouton supprimer */}
                        <button
                          onClick={() => supprimerProduitRenovation(produit.handle)}
                          className="text-gray-400 hover:text-red-600 transition-colors"
                          aria-label="Supprimer"
                        >
                          ✕
                        </button>
                      </div>
                    );
                  })}

                {/* Bouton réinitialiser */}
                <div className="pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={reinitialiserRenovation}
                  >
                    Réinitialiser la sélection
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Navigation buttons */}
      <div className="flex justify-between pt-4">
        <Button
          variant="outline"
          onClick={handleBack}
        >
          ← Modifier les pièces
        </Button>
        <Button
          size="lg"
          onClick={handleContinue}
        >
          Voir le panier →
        </Button>
      </div>

      {/* Toast notifications */}
      <Toaster />
    </div>
  );
}
