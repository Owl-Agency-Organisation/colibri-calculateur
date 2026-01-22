'use client';

import { useRouter } from 'next/navigation';
import { STORAGE_KEYS } from '@/lib/store/sinistreStore';
import type { Assure, Piece } from '@/lib/types';

export function useStepperNavigation() {
  const router = useRouter();

  const getStepPath = (stepId: number): string => {
    switch (stepId) {
      case 1: return '/sinistre/identification';
      case 2: return '/sinistre/piece';
      case 3: return '/sinistre/surfaces';
      case 4: return '/sinistre/recapitulatif';
      case 5: return '/sinistre/options';
      case 6: return '/sinistre/panier';
      case 7: return '/sinistre/confirmation';
      default: return '/sinistre';
    }
  };

  const isStepDisabled = (stepId: number): boolean => {
    if (typeof window === 'undefined') return true;

    try {
      // Étape 1 : Toujours accessible
      if (stepId === 1) return false;

      // Étape 2 (Pièce) : Nécessite l'identification
      const storedAssure = localStorage.getItem(STORAGE_KEYS.ASSURE);
      const assure: Assure | null = storedAssure ? JSON.parse(storedAssure) : null;
      const isIdentified = assure && assure.nom && assure.prenom && assure.email;
      
      if (stepId === 2) return !isIdentified;

      // Étape 3 (Surfaces) : Nécessite au moins une pièce
      const storedPieces = localStorage.getItem(STORAGE_KEYS.PIECES);
      const pieces: Piece[] = storedPieces ? JSON.parse(storedPieces) : [];
      const hasPieces = pieces.length > 0;

      if (stepId === 3) return !isIdentified || !hasPieces;

      // Étape 4 (Récapitulatif) : Nécessite que les surfaces soient configurées
      // On vérifie si au moins un mur a une couleur
      const hasConfiguredSurfaces = pieces.some(p => 
        p.murs.some(m => m.couleur) || p.couleurPlafond || p.couleurBoiseries
      );

      if (stepId === 4) return !isIdentified || !hasPieces || !hasConfiguredSurfaces;

      // Étape 5 (Options) & 6 (Panier) : Nécessite le récapitulatif
      if (stepId === 5 || stepId === 6) {
        return !isIdentified || !hasPieces || !hasConfiguredSurfaces;
      }

      // Étape 7 (Confirmation) : Uniquement après paiement/validation (désactivé par défaut)
      return true;

    } catch (error) {
      console.error('Error checking step status:', error);
      return true;
    }
  };

  const handleStepClick = (stepId: number) => {
    if (!isStepDisabled(stepId)) {
      router.push(getStepPath(stepId));
    }
  };

  return {
    handleStepClick,
    isStepDisabled
  };
}
