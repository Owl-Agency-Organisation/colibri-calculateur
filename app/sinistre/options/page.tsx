'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StepIndicator, SINISTRE_STEPS } from '@/components/ui/StepIndicator';
import { getStoredPieces, STORAGE_KEYS } from '@/lib/store/sinistreStore';
import { calculerQuantites, type ResultatCalcul } from '@/lib/calcul';
import type { Piece } from '@/lib/types';

export default function OptionsPage() {
  const router = useRouter();
  const [pieces, setPieces] = useState<Piece[]>([]);
  const [resultat, setResultat] = useState<ResultatCalcul | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [optionSousCouche, setOptionSousCouche] = useState(true);
  const [optionKit, setOptionKit] = useState(true);

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

    // Sauvegarder le calcul dans localStorage
    localStorage.setItem(STORAGE_KEYS.CALCUL, JSON.stringify(calcul));
    localStorage.setItem(STORAGE_KEYS.OPTIONS, JSON.stringify({
      sousCouche: true,
      kit: true,
    }));

    setIsLoaded(true);
  }, [router]);

  const handleOptionChange = (option: 'sousCouche' | 'kit', value: boolean) => {
    if (option === 'sousCouche') {
      setOptionSousCouche(value);
    } else {
      setOptionKit(value);
    }

    // Mettre à jour localStorage
    localStorage.setItem(STORAGE_KEYS.OPTIONS, JSON.stringify({
      sousCouche: option === 'sousCouche' ? value : optionSousCouche,
      kit: option === 'kit' ? value : optionKit,
    }));
  };

  const handleContinue = () => {
    router.push('/sinistre/panier');
  };

  const handleBack = () => {
    router.push('/sinistre/recapitulatif');
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
          <CardTitle>Peintures de finition</CardTitle>
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
              <CardTitle>Sous-couche</CardTitle>
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
