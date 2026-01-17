'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { StepIndicator, SINISTRE_STEPS } from '@/components/ui/StepIndicator';
import { CouleurModal } from '@/components/modals/CouleurModal';
import { getStoredPieces, setStoredPieces } from '@/lib/store/sinistreStore';
import type { Piece, Couleur, TypePiece } from '@/lib/types';

export default function SaisieurfacesPage() {
  const router = useRouter();
  const [typePiece, setTypePiece] = useState<TypePiece | null>(null);
  const [nomPiece, setNomPiece] = useState('');
  const [surfaces, setSurfaces] = useState({
    murs: '',
    plafond: '',
    boiseries: '',
  });
  const [couleurMurs, setCouleurMurs] = useState<Couleur | null>(null);
  const [couleurPlafond, setCouleurPlafond] = useState<Couleur | null>(null);
  const [couleurBoiseries, setCouleurBoiseries] = useState<Couleur | null>(null);
  const [showCouleurModal, setShowCouleurModal] = useState(false);
  const [currentSelection, setCurrentSelection] = useState<'murs' | 'plafond' | 'boiseries' | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isEditMode, setIsEditMode] = useState(false);
  const [hasPieces, setHasPieces] = useState(false);

  // Charger le type de pièce depuis sessionStorage ou éditer une pièce existante
  useEffect(() => {
    const pieces = getStoredPieces();
    setHasPieces(pieces.length > 0);
    
    const editPieceId = sessionStorage.getItem('colibri-edit-piece-id');
    
    if (editPieceId) {
      // Mode édition
      setIsEditMode(true);
      const pieceToEdit = pieces.find(p => p.id === editPieceId);
      
      if (pieceToEdit) {
        setTypePiece(pieceToEdit.typePiece);
        setNomPiece(pieceToEdit.nom);
        setSurfaces({
          murs: pieceToEdit.surfaceMurs.toString(),
          plafond: pieceToEdit.surfacePlafond?.toString() || '',
          boiseries: pieceToEdit.surfaceBoiseries?.toString() || '',
        });
        setCouleurMurs(pieceToEdit.couleurMurs);
        setCouleurPlafond(pieceToEdit.couleurPlafond || null);
        setCouleurBoiseries(pieceToEdit.couleurBoiseries || null);
      } else {
        router.push('/sinistre/piece');
      }
    } else {
      // Mode création
      const type = sessionStorage.getItem('colibri-temp-piece-type') as TypePiece;
      if (!type) {
        router.push('/sinistre/piece');
        return;
      }
      setTypePiece(type);
      
      // Générer un nom par défaut
      const count = pieces.filter(p => p.typePiece === type).length + 1;
      const labels: Record<TypePiece, string> = {
        'piece-de-vie': 'Pièce de vie',
        'chambre': 'Chambre',
        'cuisine': 'Cuisine',
        'salle-de-bain': 'Salle de bain',
        'toilettes': 'Toilettes',
        'entree': 'Entrée',
        'couloir': 'Couloir',
      };
      setNomPiece(`${labels[type]} ${count}`);
    }
  }, [router]);

  const handleOpenCouleurModal = (type: 'murs' | 'plafond' | 'boiseries') => {
    setCurrentSelection(type);
    setShowCouleurModal(true);
  };

  const handleSelectCouleur = (couleur: Couleur) => {
    if (currentSelection === 'murs') {
      setCouleurMurs(couleur);
    } else if (currentSelection === 'plafond') {
      setCouleurPlafond(couleur);
    } else if (currentSelection === 'boiseries') {
      setCouleurBoiseries(couleur);
    }
    setShowCouleurModal(false);
    setCurrentSelection(null);
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!nomPiece.trim()) {
      newErrors.nomPiece = 'Le nom de la pièce est obligatoire';
    }

    const mursValue = parseFloat(surfaces.murs);
    if (!surfaces.murs || isNaN(mursValue) || mursValue <= 0) {
      newErrors.murs = 'La surface des murs est obligatoire et doit être positive';
    }

    if (surfaces.murs && !couleurMurs) {
      newErrors.couleurMurs = 'Veuillez sélectionner une couleur pour les murs';
    }

    if (surfaces.plafond) {
      const plafondValue = parseFloat(surfaces.plafond);
      if (isNaN(plafondValue) || plafondValue <= 0) {
        newErrors.plafond = 'La surface du plafond doit être positive';
      } else if (!couleurPlafond) {
        newErrors.couleurPlafond = 'Veuillez sélectionner une couleur pour le plafond';
      }
    }

    if (surfaces.boiseries) {
      const boiseriesValue = parseFloat(surfaces.boiseries);
      if (isNaN(boiseriesValue) || boiseriesValue <= 0) {
        newErrors.boiseries = 'La surface des boiseries doit être positive';
      } else if (!couleurBoiseries) {
        newErrors.couleurBoiseries = 'Veuillez sélectionner une couleur pour les boiseries';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm() || !typePiece) return;

    const editPieceId = sessionStorage.getItem('colibri-edit-piece-id');
    const pieces = getStoredPieces();

    if (editPieceId) {
      // Mode édition : mettre à jour la pièce existante
      const pieceIndex = pieces.findIndex(p => p.id === editPieceId);
      if (pieceIndex !== -1) {
        pieces[pieceIndex] = {
          id: editPieceId,
          typePiece,
          nom: nomPiece,
          surfaceMurs: parseFloat(surfaces.murs),
          surfacePlafond: surfaces.plafond ? parseFloat(surfaces.plafond) : undefined,
          surfaceBoiseries: surfaces.boiseries ? parseFloat(surfaces.boiseries) : undefined,
          couleurMurs: couleurMurs!,
          couleurPlafond: couleurPlafond || undefined,
          couleurBoiseries: couleurBoiseries || undefined,
        };
      }
      sessionStorage.removeItem('colibri-edit-piece-id');
    } else {
      // Mode création : ajouter une nouvelle pièce
      const nouvellePiece: Piece = {
        id: Date.now().toString(),
        typePiece,
        nom: nomPiece,
        surfaceMurs: parseFloat(surfaces.murs),
        surfacePlafond: surfaces.plafond ? parseFloat(surfaces.plafond) : undefined,
        surfaceBoiseries: surfaces.boiseries ? parseFloat(surfaces.boiseries) : undefined,
        couleurMurs: couleurMurs!,
        couleurPlafond: couleurPlafond || undefined,
        couleurBoiseries: couleurBoiseries || undefined,
      };
      pieces.push(nouvellePiece);
      sessionStorage.removeItem('colibri-temp-piece-type');
    }

    // Sauvegarder dans localStorage
    setStoredPieces(pieces);

    // Naviguer vers le récapitulatif
    router.push('/sinistre/recapitulatif');
  };

  const handleBack = () => {
    // Nettoyer les données temporaires
    sessionStorage.removeItem('colibri-edit-piece-id');
    sessionStorage.removeItem('colibri-temp-piece-type');
    router.push('/sinistre/piece');
  };

  const handleSkipToRecap = () => {
    // Nettoyer les données temporaires et aller au récapitulatif
    sessionStorage.removeItem('colibri-edit-piece-id');
    sessionStorage.removeItem('colibri-temp-piece-type');
    router.push('/sinistre/recapitulatif');
  };

  if (!typePiece) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <StepIndicator steps={SINISTRE_STEPS} currentStep={3} />

      {/* Form card */}
      <Card>
        <CardHeader>
          <CardTitle>Surfaces à peindre</CardTitle>
          <p className="text-sm text-gray-500 mt-1">
            Renseignez les surfaces et choisissez les couleurs
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Nom de la pièce */}
            <Input
              label="Nom de la pièce"
              type="text"
              required
              value={nomPiece}
              onChange={(e) => setNomPiece(e.target.value)}
              error={errors.nomPiece}
              placeholder="Ex: Salon principal"
            />

            {/* Murs (obligatoire) */}
            <div className="border border-gray-200 rounded-lg p-4 space-y-4">
              <h3 className="font-medium text-gray-900">Murs *</h3>
              
              <Input
                label="Surface des murs (m²)"
                type="number"
                step="0.01"
                min="0"
                required
                value={surfaces.murs}
                onChange={(e) => setSurfaces({ ...surfaces, murs: e.target.value })}
                error={errors.murs}
                placeholder="Ex: 45.5"
              />

              {couleurMurs ? (
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  {couleurMurs.imageUrl && (
                    <img
                      src={couleurMurs.imageUrl}
                      alt={couleurMurs.titre}
                      className="w-16 h-16 object-cover rounded"
                    />
                  )}
                  <div className="flex-1">
                    <p className="font-medium text-sm text-gray-900">{couleurMurs.titre}</p>
                    <p className="text-xs text-gray-500">{couleurMurs.collection}</p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenCouleurModal('murs')}
                  >
                    Modifier
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleOpenCouleurModal('murs')}
                  className="w-full"
                >
                  Choisir une couleur
                </Button>
              )}
              {errors.couleurMurs && (
                <p className="text-sm text-red-500">{errors.couleurMurs}</p>
              )}
            </div>

            {/* Plafond (optionnel) */}
            <div className="border border-gray-200 rounded-lg p-4 space-y-4">
              <h3 className="font-medium text-gray-900">Plafond (optionnel)</h3>
              
              <Input
                label="Surface du plafond (m²)"
                type="number"
                step="0.01"
                min="0"
                value={surfaces.plafond}
                onChange={(e) => setSurfaces({ ...surfaces, plafond: e.target.value })}
                error={errors.plafond}
                placeholder="Ex: 20.0"
              />

              {surfaces.plafond && (
                <>
                  {couleurPlafond ? (
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                      {couleurPlafond.imageUrl && (
                        <img
                          src={couleurPlafond.imageUrl}
                          alt={couleurPlafond.titre}
                          className="w-16 h-16 object-cover rounded"
                        />
                      )}
                      <div className="flex-1">
                        <p className="font-medium text-sm text-gray-900">{couleurPlafond.titre}</p>
                        <p className="text-xs text-gray-500">{couleurPlafond.collection}</p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenCouleurModal('plafond')}
                      >
                        Modifier
                      </Button>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => handleOpenCouleurModal('plafond')}
                      className="w-full"
                    >
                      Choisir une couleur
                    </Button>
                  )}
                  {errors.couleurPlafond && (
                    <p className="text-sm text-red-500">{errors.couleurPlafond}</p>
                  )}
                </>
              )}
            </div>

            {/* Boiseries (optionnel) */}
            <div className="border border-gray-200 rounded-lg p-4 space-y-4">
              <h3 className="font-medium text-gray-900">Boiseries (optionnel)</h3>
              
              <Input
                label="Surface des boiseries (m²)"
                type="number"
                step="0.01"
                min="0"
                value={surfaces.boiseries}
                onChange={(e) => setSurfaces({ ...surfaces, boiseries: e.target.value })}
                error={errors.boiseries}
                placeholder="Ex: 5.0"
              />

              {surfaces.boiseries && (
                <>
                  {couleurBoiseries ? (
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                      {couleurBoiseries.imageUrl && (
                        <img
                          src={couleurBoiseries.imageUrl}
                          alt={couleurBoiseries.titre}
                          className="w-16 h-16 object-cover rounded"
                        />
                      )}
                      <div className="flex-1">
                        <p className="font-medium text-sm text-gray-900">{couleurBoiseries.titre}</p>
                        <p className="text-xs text-gray-500">{couleurBoiseries.collection}</p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenCouleurModal('boiseries')}
                      >
                        Modifier
                      </Button>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => handleOpenCouleurModal('boiseries')}
                      className="w-full"
                    >
                      Choisir une couleur
                    </Button>
                  )}
                  {errors.couleurBoiseries && (
                    <p className="text-sm text-red-500">{errors.couleurBoiseries}</p>
                  )}
                </>
              )}
            </div>

            {/* Navigation buttons */}
            <div className="flex justify-between pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleBack}
              >
                ← Précédent
              </Button>
              <div className="flex gap-3">
                {/* Bouton pour aller au récapitulatif si des pièces existent et qu'on n'est pas en mode édition */}
                {hasPieces && !isEditMode && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleSkipToRecap}
                  >
                    Voir le récapitulatif
                  </Button>
                )}
                <Button type="submit" size="lg">
                  {isEditMode ? 'Enregistrer' : 'Suivant'} →
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Couleur Modal */}
      <CouleurModal
        isOpen={showCouleurModal}
        onClose={() => {
          setShowCouleurModal(false);
          setCurrentSelection(null);
        }}
        onSelect={handleSelectCouleur}
      />
    </div>
  );
}
