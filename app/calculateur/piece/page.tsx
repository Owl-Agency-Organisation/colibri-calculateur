'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StepIndicator, CALCULATEUR_STEPS } from '@/components/ui/StepIndicator';
import { useStepperNavigation } from '@/hooks/useStepperNavigation';
import { getStoredPieces } from '@/lib/store/projetStore';
import type { TypePiece } from '@/lib/types';

// Types de pièces disponibles avec leurs images
const TYPES_PIECES: { value: TypePiece; label: string; image: string }[] = [
  { 
    value: 'piece-de-vie', 
    label: 'Pièce de vie', 
    image: 'https://cdn.shopify.com/s/files/1/0971/0436/3865/files/ColibriAssurances_P01_vie.png?v=1769015678' 
  },
  { 
    value: 'chambre', 
    label: 'Chambre', 
    image: 'https://cdn.shopify.com/s/files/1/0971/0436/3865/files/ColibriAssurances_P02_chambre.png?v=1769015679' 
  },
  { 
    value: 'cuisine', 
    label: 'Cuisine', 
    image: 'https://cdn.shopify.com/s/files/1/0971/0436/3865/files/ColibriAssurances_P03_cuisine.png?v=1769015679' 
  },
  { 
    value: 'salle-de-bain', 
    label: 'Salle de bain', 
    image: 'https://cdn.shopify.com/s/files/1/0971/0436/3865/files/ColibriAssurances_P04_salledebain.png?v=1769015678' 
  },
  { 
    value: 'toilettes', 
    label: 'Toilettes', 
    image: 'https://cdn.shopify.com/s/files/1/0971/0436/3865/files/ColibriAssurances_P05_toilettes.png?v=1769015679' 
  },
  { 
    value: 'entree', 
    label: 'Entrée', 
    image: 'https://cdn.shopify.com/s/files/1/0971/0436/3865/files/ColibriAssurances_P06_entree.png?v=1769015680' 
  },
  { 
    value: 'couloir', 
    label: 'Couloir', 
    image: 'https://cdn.shopify.com/s/files/1/0971/0436/3865/files/ColibriAssurances_P07_couloir.png?v=1769015679' 
  },
];

export default function SelectionPiecePage() {
  const router = useRouter();
  const { handleStepClick, isStepDisabled } = useStepperNavigation();
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
    router.push('/calculateur/surfaces');
  };

  const handleBack = () => {
    router.push('/calculateur');
  };

  const handleContinue = () => {
    // Si des pièces existent, aller directement au récapitulatif
    router.push('/calculateur/recapitulatif');
  };

  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <StepIndicator 
        steps={CALCULATEUR_STEPS} 
        currentStep={2} 
        onStepClick={handleStepClick}
        isStepDisabled={isStepDisabled}
      />

      {/* Title */}
      <div className="text-center">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
          Type de pièce à repeindre
        </h1>
        <p className="text-gray-600">
          {hasPieces 
            ? 'Ajoutez une nouvelle pièce ou continuez vers le récapitulatif'
            : 'Sélectionnez le type de pièce à peindre'
          }
        </p>
      </div>

      {/* Grid of room types */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
        {TYPES_PIECES.map((piece) => (
          <button
            key={piece.value}
            onClick={() => handleSelectPiece(piece.value)}
            className="group relative bg-white rounded-2xl border-2 border-gray-100 overflow-hidden hover:border-primary-500 hover:shadow-xl transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
          >
            {/* Image Container */}
            <div className="aspect-square overflow-hidden bg-gray-100 relative">
              <img 
                src={piece.image} 
                alt={piece.label}
                loading="eager"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.src = `https://placehold.co/400x400?text=${encodeURIComponent(piece.label)}`;
                }}
              />
              {/* Overlay on hover */}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300" />
            </div>
            
            {/* Label Container */}
            <div className="p-4 bg-white border-t border-gray-50">
              <p className="text-base font-semibold text-gray-900 group-hover:text-primary-600 transition-colors">
                {piece.label}
              </p>
            </div>

            {/* Selection Indicator (Checkmark) */}
            <div className="absolute top-3 right-3 w-8 h-8 bg-white/90 backdrop-blur-sm rounded-full shadow-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0 transition-all duration-300">
              <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
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
              Vous pourrez ajouter d&apos;autres pièces après avoir saisi les surfaces de celle-ci.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
