'use client';

import { useRouter } from 'next/navigation';
import { STORAGE_KEYS } from '@/lib/store/projetStore';
import type { Client, Piece } from '@/lib/types';

export function useStepperNavigation() {
  const router = useRouter();

  const getStepPath = (stepId: number): string => {
    switch (stepId) {
      case 1: return '/calculateur/identification';
      case 2: return '/calculateur/piece';
      case 3: return '/calculateur/surfaces';
      case 4: return '/calculateur/recapitulatif';
      case 5: return '/calculateur/options';
      case 6: return '/calculateur/panier';
      case 7: return '/calculateur/confirmation';
      default: return '/';
    }
  };

  const isStepDisabled = (stepId: number): boolean => {
    if (typeof window === 'undefined') return true;

    try {
      // Étape 1 : Toujours accessible
      if (stepId === 1) return false;

      // Étape 2 (Pièce) : Nécessite l'identification
      const storedClient = localStorage.getItem(STORAGE_KEYS.CLIENT);
      const client: Client | null = storedClient ? JSON.parse(storedClient) : null;
      const isIdentified = client && client.nom && client.prenom && client.email;

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
