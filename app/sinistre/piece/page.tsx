'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StepIndicator, SINISTRE_STEPS } from '@/components/ui/StepIndicator';
import { getStoredPieces } from '@/lib/store/sinistreStore';
import type { TypePiece } from '@/lib/types';

// Types de pièces disponibles avec leurs icônes
const TYPES_PIECES: { value: TypePiece; label: string; icon: string }[] = [
  { value: 'piece-de-vie', label: 'Pièce de vie', icon: '🛋️' },
  { value: 'chambre', label: 'Chambre', icon: '🛏️' },
  { value: 'cuisine', label: 'Cuisine', icon: '🍳' },
  { value: 'salle-de-bain', label: 'Salle de bain', icon: '🚿' },
  { value: 'toilettes', label: 'Toilettes', icon: '🚽' },
  { value: 'entree', label: 'Entrée', icon: '🚪' },
  { value: 'couloir', label: 'Couloir', icon: '↔️' },
];

export default function SelectionPiecePage() {
  const router = useRouter();
  const [hasPieces, setHasPieces] = useState(false);

  useEffect(() => {
    // Vérifier si des pièces existent déjà
    const pieces = getStoredPieces();
    setHasPieces(pieces.length > 0);
  }, []);

  const handleSelectPiece = (typePiece: TypePiece) => {
    // Stocker le type de pièce temporairement
    sessionStorage.setItem('colibri-temp-piece-type', typePiece);
    // Naviguer vers la saisie des surfaces
    router.push('/sinistre/surfaces');
  };

  const handleBack = () => {
    router.push('/sinistre');
  };

  const handleContinue = () => {
    // Si des pièces existent, aller directement au récapitulatif
    router.push('/sinistre/recapitulatif');
  };

  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <StepIndicator steps={SINISTRE_STEPS} currentStep={2} />

      {/* Title */}
      <div className="text-center">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
          Type de pièce sinistrée
        </h1>
        <p className="text-gray-600">
          {hasPieces 
            ? 'Ajoutez une nouvelle pièce ou continuez vers le récapitulatif'
            : 'Sélectionnez le type de pièce à peindre'
          }
        </p>
      </div>

      {/* Grid of room types */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {TYPES_PIECES.map((piece) => (
          <button
            key={piece.value}
            onClick={() => handleSelectPiece(piece.value)}
            className="group relative bg-white rounded-xl border-2 border-gray-200 p-6 hover:border-primary-500 hover:shadow-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
          >
            {/* Icon */}
            <div className="text-5xl mb-3 group-hover:scale-110 transition-transform duration-200">
              {piece.icon}
            </div>
            
            {/* Label */}
            <p className="text-sm font-medium text-gray-900 group-hover:text-primary-600">
              {piece.label}
            </p>

            {/* Hover indicator */}
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <svg className="w-5 h-5 text-primary-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 1.414L10.586 9H7a1 1 0 100 2h3.586l-1.293 1.293a1 1 0 101.414 1.414l3-3a1 1 0 000-1.414z" clipRule="evenodd" />
              </svg>
            </div>
          </button>
        ))}
      </div>

      {/* Navigation buttons */}
      <div className="flex justify-between pt-4">
        <Button
          variant="outline"
          onClick={handleBack}
        >
          ← Précédent
        </Button>
        {hasPieces && (
          <Button
            size="lg"
            onClick={handleContinue}
          >
            Voir le récapitulatif →
          </Button>
        )}
      </div>

      {/* Info box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex gap-3">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div>
            <h4 className="text-sm font-medium text-blue-800">Plusieurs pièces ?</h4>
            <p className="text-sm text-blue-700 mt-1">
              Vous pourrez ajouter d'autres pièces après avoir saisi les surfaces de celle-ci.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
