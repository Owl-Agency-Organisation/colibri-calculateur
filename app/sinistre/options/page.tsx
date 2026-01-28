'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StepIndicator, SINISTRE_STEPS } from '@/components/ui/StepIndicator';
import { useStepperNavigation } from '@/hooks/useStepperNavigation';
import { getStoredPieces, STORAGE_KEYS } from '@/lib/store/sinistreStore';
import { calculerQuantites, type ResultatCalcul } from '@/lib/calcul';
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
  const [optionKit, setOptionKit] = useState(true);
  const [optionRenovation, setOptionRenovation] = useState(false);
  const [shopifyData, setShopifyData] = useState<Record<string, any>>({});

  useEffect(() => {
    const init = async () => {
      const stored = getStoredPieces();
      if (stored.length === 0) {
        router.push('/sinistre/piece');
        return;
      }
      setPieces(stored);

      // 1. Identifier tous les handles de produits nécessaires
      const handles = new Set<string>();
      stored.forEach(p => {
        p.murs.forEach(m => handles.add(m.couleur.productHandle));
        if (p.couleurPlafond) handles.add(p.couleurPlafond.productHandle);
        if (p.couleurBoiseries) handles.add(p.couleurBoiseries.productHandle);
      });
      
      // Ajouter les sous-couches
      handles.add('sous-couche-blanche-peinture-biosourcee-murs-et-plafonds');
      handles.add('sous-couche-grise-peinture-biosourcee-murs-et-plafonds');
      
      // Ajouter les kits
      handles.add('kit-materiel-de-peinture-petite-surface');
      handles.add('kit-materiel-de-peinture-moyenne-et-grande-surface');
      
      // Ajouter les produits de rénovation
      PRODUITS_RENOVATION.forEach(p => handles.add(p.handle));

      // 2. Charger les données Shopify en parallèle
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

      // 3. Calculer les quantités avec les données réelles
      const calcul = calculerQuantites(stored, shopifyData);
      setResultat(calcul);

      // 4. Charger les options sauvegardées
      const savedOptions = localStorage.getItem(STORAGE_KEYS.OPTIONS);
      if (savedOptions) {
        const parsed = JSON.parse(savedOptions);
        
        setOptionKit(parsed.kit ?? true);
        setOptionRenovation(parsed.renovation ?? false);
      }

      // 5. Sauvegarder le calcul et les données Shopify dans localStorage
      localStorage.setItem(STORAGE_KEYS.CALCUL, JSON.stringify(calcul));
      localStorage.setItem(STORAGE_KEYS.SHOPIFY_DATA, JSON.stringify(shopifyData));
      setShopifyData(shopifyData);
      setIsLoaded(true);
    };

    init();
  }, [router]);

  const saveOptions = (kit: boolean, renovation: boolean) => {
    localStorage.setItem(STORAGE_KEYS.OPTIONS, JSON.stringify({
      sousCouche: true, // Toujours true car obligatoire
      kit,
      renovation,
    }));
  };

  const handleOptionChange = (option: 'kit' | 'renovation', value: boolean) => {
    if (option === 'kit') {
      setOptionKit(value);
      saveOptions(value, optionRenovation);
    } else if (option === 'renovation') {
      setOptionRenovation(value);
      saveOptions(optionKit, value);
    }
  };

  const handleContinue = () => {
    router.push('/sinistre/panier');
  };

  const handleBack = () => {
    router.push('/sinistre/recapitulatif');
  };

  // Calculer le coût total estimé
  const calculerCoutTotal = (): number => {
    if (!resultat) return 0;
    let total = 0;
    
    // Peintures
    total += resultat.peintures.reduce((sum, p) => sum + p.prixTotal, 0);
    
    // Sous-couches
    if (optionSousCouche) {
      total += resultat.sousCouches.reduce((sum, s) => sum + s.prixTotal, 0);
    }
    
    // Kit
    if (optionKit) {
      total += resultat.kit.prix;
    }
    
    // Produits rénovation
    if (optionRenovation) {
      PRODUITS_RENOVATION.forEach(produit => {
        const variants = shopifyData[produit.handle]?.variants || [];
        const prix = variants.length > 0 ? parseFloat(variants[0].price.amount || variants[0].price) : 0;
        total += prix;
      });
    }
    
    return total;
  };

  if (!isLoaded || !resultat) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <StepIndicator 
        steps={SINISTRE_STEPS} 
        currentStep={5} 
        onStepClick={handleStepClick}
        isStepDisabled={isStepDisabled}
      />

      {/* Title */}
      <div className="text-center">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
          Choix des options
        </h1>
        <p className="text-gray-600">
          Sous-couche, kit matériel, préparation des surfaces : vous choisissez !
        </p>
      </div>

      {/* Sous-couches (optionnel) */}
      {resultat.sousCouches.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Sous-couche (1 couche)</CardTitle>
              <div className="flex items-center gap-2 px-3 py-1 bg-primary-50 text-primary-700 rounded-full">
                <span className="text-sm font-semibold">Obligatoire</span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {resultat.sousCouches.map((sousCouche, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-gray-900">
                        Sous-couche {sousCouche.type}
                      </h4>
                      <p className="text-sm text-gray-600 mt-1">
                        Surface : {sousCouche.surfaceTotale.toFixed(1)} m² → {sousCouche.litresNecessaires}L nécessaires
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-gray-900">{sousCouche.litresCommandes}L</p>
                      <p className="text-sm font-medium text-primary-600">{sousCouche.prixTotal.toFixed(2)}€</p>
                      <div className="text-xs text-gray-500 mt-1">
                        {sousCouche.contenants.map((c, i) => (
                          <span key={i}>
                            {c.quantite}×{c.contenance}
                            {i < sousCouche.contenants.length - 1 ? ' + ' : ''}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Recommandation :</strong> La sous-couche assure une meilleure adhérence 
                et un rendu optimal de la peinture de finition.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Kit matériel (optionnel) */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Kit matériel</CardTitle>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={optionKit}
                onChange={(e) => handleOptionChange('kit', e.target.checked)}
                className="w-5 h-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-gray-600">Inclure</span>
            </label>
          </div>
        </CardHeader>
        <CardContent className={!optionKit ? 'opacity-50' : ''}>
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium text-gray-900">{resultat.kit.titre}</h4>
                <p className="text-sm text-gray-600 mt-1">
                  Recommandé pour les surfaces {resultat.kit.type === 'petite' ? '≤ 30' : '> 30'} m²
                </p>
              </div>
              <div className="text-right">
                <p className="font-semibold text-gray-900">{resultat.kit.prix.toFixed(2)} €</p>
              </div>
            </div>
          </div>
          <div className="mt-4 p-3 bg-green-50 rounded-lg">
            <p className="text-sm text-green-800">
              <strong>Contenu :</strong> Bâche de protection, ruban de masquage, 
              {resultat.kit.type === 'petite' 
                ? ' rouleau, bac, pinceau' 
                : ' rouleaux, bac pro, pinceaux, perche télescopique'}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Question trous/fissures */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Préparation des surfaces</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-start gap-4 p-4 border border-gray-200 rounded-lg">
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
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <h5 className="font-medium text-amber-900 mb-3">Matériel de rénovation inclus :</h5>
                <div className="space-y-2">
                  {PRODUITS_RENOVATION.map((produit) => {
                    const variants = shopifyData[produit.handle]?.variants || [];
                    const prix = variants.length > 0 ? parseFloat(variants[0].price.amount || variants[0].price) : 0;
                    return (
                      <div key={produit.handle} className="flex justify-between text-sm">
                        <span className="text-amber-800">{produit.titre}</span>
                        <span className="font-medium text-amber-900">{prix.toFixed(2)} €</span>
                      </div>
                    );
                  })}
                  <div className="flex justify-between text-sm pt-2 border-t border-amber-300">
                    <span className="font-medium text-amber-900">Total rénovation</span>
                    <span className="font-bold text-amber-900">
                      {PRODUITS_RENOVATION.reduce((sum, p) => {
                        const variants = shopifyData[p.handle]?.variants || [];
                        const prix = variants.length > 0 ? parseFloat(variants[0].price.amount || variants[0].price) : 0;
                        return sum + prix;
                      }, 0).toFixed(2)} €
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Coût total estimé (hors peintures) */}
      {(optionKit || optionRenovation) && (
        <Card className="bg-primary-50 border-primary-200">
          <CardContent className="py-4">
            <div className="flex justify-between items-center">
              <span className="font-medium text-primary-900">Coût matériel estimé (hors peintures)</span>
              <span className="text-xl font-bold text-primary-600">{calculerCoutTotal().toFixed(2)} €</span>
            </div>
          </CardContent>
        </Card>
      )}

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
    </div>
  );
}
