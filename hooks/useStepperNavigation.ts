'use client';

import { useRouter } from 'next/navigation';
import { STORAGE_KEYS } from '@/lib/store/projetStore';
import type { Piece } from '@/lib/types';

export function useStepperNavigation() {
  const router = useRouter();

  const getStepPath = (stepId: number): string => {
    switch (stepId) {
      case 1: return '/calculateur/piece';
      case 2: return '/calculateur/surfaces';
      case 3: return '/calculateur/recapitulatif';
      case 4: return '/calculateur/options';
      case 5: return '/calculateur/panier';
      case 6: return '/calculateur/confirmation';
      default: return '/';
    }
  };

  const isStepDisabled = (stepId: number): boolean => {
    if (typeof window === 'undefined') return true;

    try {
      // Étape 1 (Pièce) : toujours accessible — le tunnel démarre ici
      if (stepId === 1) return false;

      // Étape 2 (Surfaces) : nécessite au moins une pièce
      const storedPieces = localStorage.getItem(STORAGE_KEYS.PIECES);
      const pieces: Piece[] = storedPieces ? JSON.parse(storedPieces) : [];
      const hasPieces = pieces.length > 0;

      if (stepId === 2) return !hasPieces;

      // Étape 3 (Récapitulatif) : nécessite que les surfaces soient configurées
      // On vérifie si au moins un mur a une couleur
      const hasConfiguredSurfaces = pieces.some(p =>
        p.murs.some(m => m.couleur) || p.couleurPlafond || p.couleurBoiseries
      );

      if (stepId === 3) return !hasPieces || !hasConfiguredSurfaces;

      // Étapes 4 (Options) & 5 (Panier) : nécessitent le récapitulatif
      if (stepId === 4 || stepId === 5) {
        return !hasPieces || !hasConfiguredSurfaces;
      }

      // Étape 6 (Confirmation) : uniquement après envoi de l'estimation (désactivée par défaut)
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
