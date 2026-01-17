'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StepIndicator, SINISTRE_STEPS } from '@/components/ui/StepIndicator';
import { getStoredPieces, STORAGE_KEYS } from '@/lib/store/sinistreStore';
import { calculerQuantites, type ResultatCalcul } from '@/lib/calcul';
import type { Piece } from '@/lib/types';

// Produits de rénovation (trous/fissures)
const PRODUITS_RENOVATION = [
  { handle: 'pate-a-renover-multi-materiaux', titre: 'Pâte à rénover multi matériaux', prix: 29.20 },
  { handle: 'couteau-de-peintre', titre: 'Couteau de peintre (spatule)', prix: 7.80 },
  { handle: 'papier-a-poncer', titre: 'Papier à poncer grain 120', prix: 3.60 },
  { handle: 'cale-a-poncer-auto-agrippante', titre: 'Cale à poncer', prix: 6.40 },
];

export default function OptionsPage() {
  const router = useRouter();
  const [pieces, setPieces] = useState<Piece[]>([]);
  const [resultat, setResultat] = useState<ResultatCalcul | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [optionSousCouche, setOptionSousCouche] = useState(true);
  const [optionKit, setOptionKit] = useState(true);
  const [optionRenovation, setOptionRenovation] = useState(false);

  useEffect(() => {
    const stored = getStoredPieces();
    if (stored.length === 0) {
      router.push('/sinistre/piece');
      return;
    }
    setPieces(stored);

    // Calculer les quantités
    const calcul = calculerQuantites(stored);
    setResultat(calcul);

    // Charger les options sauvegardées
    const savedOptions = localStorage.getItem(STORAGE_KEYS.OPTIONS);
    if (savedOptions) {
      const parsed = JSON.parse(savedOptions);
      setOptionSousCouche(parsed.sousCouche ?? true);
      setOptionKit(parsed.kit ?? true);
      setOptionRenovation(parsed.renovation ?? false);
    }

    // Sauvegarder le calcul dans localStorage
    localStorage.setItem(STORAGE_KEYS.CALCUL, JSON.stringify(calcul));

    setIsLoaded(true);
  }, [router]);

  const saveOptions = (sousCouche: boolean, kit: boolean, renovation: boolean) => {
    localStorage.setItem(STORAGE_KEYS.OPTIONS, JSON.stringify({
      sousCouche,
      kit,
      renovation,
    }));
  };

  const handleOptionChange = (option: 'sousCouche' | 'kit' | 'renovation', value: boolean) => {
    if (option === 'sousCouche') {
      setOptionSousCouche(value);
      saveOptions(value, optionKit, optionRenovation);
    } else if (option === 'kit') {
      setOptionKit(value);
      saveOptions(optionSousCouche, value, optionRenovation);
    } else if (option === 'renovation') {
      setOptionRenovation(value);
      saveOptions(optionSousCouche, optionKit, value);
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
    
    // Kit
    if (optionKit) {
      total += resultat.kit.prix;
    }
    
    // Produits rénovation
    if (optionRenovation) {
      total += PRODUITS_RENOVATION.reduce((sum, p) => sum + p.prix, 0);
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
      <StepIndicator steps={SINISTRE_STEPS} currentStep={5} />

      {/* Title */}
      <div className="text-center">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
          Calcul des quantités
        </h1>
        <p className="text-gray-600">
          Voici les quantités calculées pour votre projet
        </p>
      </div>

      {/* Résumé */}
      <Card>
        <CardHeader>
          <CardTitle>Résumé du projet</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold text-primary-600">{resultat.resume.nombrePieces}</p>
              <p className="text-sm text-gray-600">Pièce{resultat.resume.nombrePieces > 1 ? 's' : ''}</p>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold text-primary-600">{resultat.resume.nombreCouleurs}</p>
              <p className="text-sm text-gray-600">Couleur{resultat.resume.nombreCouleurs > 1 ? 's' : ''}</p>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold text-primary-600">{resultat.surfaceTotale.toFixed(1)}</p>
              <p className="text-sm text-gray-600">m² totaux</p>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold text-primary-600">
                {resultat.peintures.reduce((sum, p) => sum + p.litresCommandes, 0)}L
              </p>
              <p className="text-sm text-gray-600">de peinture</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Peintures */}
      <Card>
        <CardHeader>
          <CardTitle>Peintures de finition (2 couches)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {resultat.peintures.map((peinture, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-start gap-4">
                  {peinture.couleur.imageUrl && (
                    <img
                      src={peinture.couleur.imageUrl}
                      alt={peinture.couleur.titre}
                      className="w-16 h-16 object-cover rounded"
                    />
                  )}
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900">{peinture.couleur.titre}</h4>
                    <p className="text-sm text-gray-500">{peinture.couleur.collection}</p>
                    <p className="text-sm text-gray-600 mt-1">
                      Surface : {peinture.surfaceTotale.toFixed(1)} m² → {peinture.litresNecessaires}L nécessaires
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gray-900">{peinture.litresCommandes}L</p>
                    <div className="text-xs text-gray-500 mt-1">
                      {peinture.contenants.map((c, i) => (
                        <span key={i}>
                          {c.quantite}×{c.contenance}
                          {i < peinture.contenants.length - 1 ? ' + ' : ''}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Sous-couches (optionnel) */}
      {resultat.sousCouches.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Sous-couche (1 couche)</CardTitle>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={optionSousCouche}
                  onChange={(e) => handleOptionChange('sousCouche', e.target.checked)}
                  className="w-5 h-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm text-gray-600">Inclure</span>
              </label>
            </div>
          </CardHeader>
          <CardContent className={!optionSousCouche ? 'opacity-50' : ''}>
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
                  {PRODUITS_RENOVATION.map((produit) => (
                    <div key={produit.handle} className="flex justify-between text-sm">
                      <span className="text-amber-800">{produit.titre}</span>
                      <span className="font-medium text-amber-900">{produit.prix.toFixed(2)} €</span>
                    </div>
                  ))}
                  <div className="flex justify-between text-sm pt-2 border-t border-amber-300">
                    <span className="font-medium text-amber-900">Total rénovation</span>
                    <span className="font-bold text-amber-900">
                      {PRODUITS_RENOVATION.reduce((sum, p) => sum + p.prix, 0).toFixed(2)} €
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
