'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StepIndicator, SINISTRE_STEPS } from '@/components/ui/StepIndicator';
import { useStepperNavigation } from '@/hooks/useStepperNavigation';
import { ConfirmModal } from '@/components/modals/ConfirmModal';
import { getStoredPieces, setStoredPieces } from '@/lib/store/sinistreStore';
import type { Piece, TypePiece } from '@/lib/types';
import { REGLES_FINITION } from '@/lib/calcul';

const TYPE_PIECE_LABELS: Record<TypePiece, string> = {
  'piece-de-vie': 'Pièce de vie',
  'chambre': 'Chambre',
  'cuisine': 'Cuisine',
  'salle-de-bain': 'Salle de bain',
  'toilettes': 'Toilettes',
  'entree': 'Entrée',
  'couloir': 'Couloir',
};

export default function RecapitulatifPage() {
  const router = useRouter();
  const { handleStepClick, isStepDisabled } = useStepperNavigation();
  const [pieces, setPieces] = useState<Piece[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [pieceToDelete, setPieceToDelete] = useState<string | null>(null);

  useEffect(() => {
    const stored = getStoredPieces();
    if (stored.length === 0) {
      router.push('/sinistre/piece');
      return;
    }
    setPieces(stored);
    setIsLoaded(true);
  }, [router]);

  const handleAddPiece = () => {
    router.push('/sinistre/piece');
  };

  const handleEditPiece = (pieceId: string) => {
    // Stocker l'ID de la pièce à éditer
    sessionStorage.setItem('colibri-edit-piece-id', pieceId);
    router.push('/sinistre/surfaces');
  };

  const handleDeleteClick = (pieceId: string) => {
    setPieceToDelete(pieceId);
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = () => {
    if (!pieceToDelete) return;
    
    const updatedPieces = pieces.filter(p => p.id !== pieceToDelete);
    setPieces(updatedPieces);
    setStoredPieces(updatedPieces);
    
    setShowDeleteModal(false);
    setPieceToDelete(null);
    
    // Si plus de pièces, retourner à la sélection
    if (updatedPieces.length === 0) {
      router.push('/sinistre/piece');
    }
  };

  const handleCancelDelete = () => {
    setShowDeleteModal(false);
    setPieceToDelete(null);
  };

  const handleContinue = () => {
    router.push('/sinistre/options');
  };

  const handleBack = () => {
    // Retourner à l'étape 2 (choix de pièce), pas à l'étape 1
    router.push('/sinistre/piece');
  };

  const calculateTotalSurface = (piece: Piece): number => {
    const surfaceMurs = piece.murs.reduce((total, mur) => total + mur.surface, 0);
    let total = surfaceMurs;
    if (piece.surfacePlafond) total += piece.surfacePlafond;
    if (piece.surfaceBoiseries) total += piece.surfaceBoiseries;
    return total;
  };

  // Trouver le nom de la pièce à supprimer pour le message
  const pieceToDeleteName = pieceToDelete 
    ? pieces.find(p => p.id === pieceToDelete)?.nom || 'cette pièce'
    : '';

  if (!isLoaded) {
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
        currentStep={4} 
        onStepClick={handleStepClick}
        isStepDisabled={isStepDisabled}
      />

      {/* Title */}
      <div className="text-center">
        <h1 className="text-3xl sm:text-4xl font-serif font-bold text-primary-600 mb-2">
          Récapitulatif des pièces
        </h1>
        <p className="text-gray-500 uppercase tracking-widest text-xs font-bold">
          {pieces.length} pièce{pieces.length > 1 ? 's' : ''} à peindre
        </p>
      </div>

      {/* Liste des pièces */}
      <div className="space-y-4">
        {pieces.map((piece) => (
          <Card key={piece.id}>
            <CardContent className="p-6">
              <div className="flex items-start justify-between gap-4">
                {/* Info pièce */}
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {piece.nom}
                    </h3>
                    <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                      {TYPE_PIECE_LABELS[piece.typePiece]}
                    </span>
                  </div>

                  {/* Surfaces */}
                  <div className="space-y-2 mb-4">
                    {/* Murs */}
                    {piece.murs.map((mur, index) => (
                      <div key={mur.id} className="flex items-center gap-3">
                        <div className="flex items-center gap-2 flex-1">
                          {mur.couleur.imageUrl && (
                            <img
                              src={mur.couleur.imageUrl}
                              alt={mur.couleur.titre}
                              className="w-10 h-10 object-cover rounded"
                            />
                          )}
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              Mur {index + 1} : {mur.surface} m²
                            </p>
                            <p className="text-xs text-gray-500">
                              {mur.couleur.titre} • <span className="uppercase">{mur.couleur.finition || REGLES_FINITION[piece.typePiece]?.murs}</span>
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}

                    {/* Plafond */}
                    {piece.surfacePlafond && piece.couleurPlafond && (
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 flex-1">
                          {piece.couleurPlafond.imageUrl && (
                            <img
                              src={piece.couleurPlafond.imageUrl}
                              alt={piece.couleurPlafond.titre}
                              className="w-10 h-10 object-cover rounded"
                            />
                          )}
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              Plafond : {piece.surfacePlafond} m²
                            </p>
                            <p className="text-xs text-gray-500">
                              {piece.couleurPlafond.titre} • <span className="uppercase">{piece.couleurPlafond.finition || REGLES_FINITION[piece.typePiece]?.plafond}</span>
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Boiseries */}
                    {piece.surfaceBoiseries && piece.couleurBoiseries && (
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 flex-1">
                          {piece.couleurBoiseries.imageUrl && (
                            <img
                              src={piece.couleurBoiseries.imageUrl}
                              alt={piece.couleurBoiseries.titre}
                              className="w-10 h-10 object-cover rounded"
                            />
                          )}
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              Boiseries : {piece.surfaceBoiseries} m²
                            </p>
                            <p className="text-xs text-gray-500">
                              {piece.couleurBoiseries.titre}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Total */}
                  <div className="pt-3 border-t border-gray-200">
                    <p className="text-sm font-medium text-gray-900">
                      Surface totale : {calculateTotalSurface(piece).toFixed(2)} m²
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEditPiece(piece.id)}
                  >
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Modifier
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteClick(piece.id)}
                    className="text-red-600 hover:text-red-700 hover:border-red-300"
                  >
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Supprimer
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Bouton ajouter une pièce */}
      <button
        onClick={handleAddPiece}
        className="w-full border-2 border-dashed border-gray-300 rounded-lg p-6 hover:border-primary-500 hover:bg-primary-50 transition-colors group"
      >
        <div className="flex items-center justify-center gap-2 text-gray-600 group-hover:text-primary-600">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          <span className="font-medium">Ajouter une autre pièce</span>
        </div>
      </button>

      {/* Navigation buttons */}
      <div className="flex justify-between pt-4">
        <Button
          variant="outline"
          onClick={handleBack}
        >
          ← Retour au choix de pièce
        </Button>
        <Button
          size="lg"
          onClick={handleContinue}
        >
          Choisir vos options →
        </Button>
      </div>

      {/* Info box */}
      <div className="bg-primary-50 border border-primary-100 rounded-xl p-6">
        <div className="flex gap-4">
          <div className="flex-shrink-0">
            <svg className="h-6 w-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h4 className="text-sm font-serif font-bold text-primary-700">Prêt pour le calcul ?</h4>
            <p className="text-sm text-primary-600/80 mt-1 leading-relaxed">
              Notre algorithme va calculer automatiquement les quantités optimales de peinture 
              et de sous-couche nécessaires pour votre projet.
            </p>
          </div>
        </div>
      </div>

      {/* Modal de confirmation de suppression */}
      <ConfirmModal
        isOpen={showDeleteModal}
        title="Supprimer cette pièce ?"
        message={`Êtes-vous sûr de vouloir supprimer "${pieceToDeleteName}" ? Cette action est irréversible.`}
        confirmLabel="Supprimer"
        cancelLabel="Annuler"
        confirmVariant="danger"
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
      />
    </div>
  );
}
