'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { StepIndicator, SINISTRE_STEPS } from '@/components/ui/StepIndicator';
import { CouleurModal } from '@/components/modals/CouleurModal';
import { getStoredPieces, setStoredPieces } from '@/lib/store/sinistreStore';
import type { Piece, Couleur, TypePiece, Mur } from '@/lib/types';
import { REGLES_FINITION } from '@/lib/calcul';

const MAX_MURS = 4;

export default function SaisieSurfacesPage() {
  const router = useRouter();
  const [typePiece, setTypePiece] = useState<TypePiece | null>(null);
  const [nomPiece, setNomPiece] = useState('');
  
  // État local pour les murs (nouveau modèle)
  const [murs, setMurs] = useState<Array<{ id: string; surface: string; couleur: Couleur | null }>>([
    { id: '1', surface: '', couleur: null },
  ]);
  
  // État local pour plafond et boiseries
  const [surfaces, setSurfaces] = useState({
    plafond: '',
    boiseries: '',
  });
  
  const [couleurPlafond, setCouleurPlafond] = useState<Couleur | null>(null);
  const [couleurBoiseries, setCouleurBoiseries] = useState<Couleur | null>(null);
  const [showCouleurModal, setShowCouleurModal] = useState(false);
  const [currentSelection, setCurrentSelection] = useState<{ type: 'mur' | 'plafond' | 'boiseries'; murId?: string } | null>(null);
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
        
        // Charger les murs existants
        if (pieceToEdit.murs && pieceToEdit.murs.length > 0) {
          setMurs(
            pieceToEdit.murs.map((m) => ({
              id: m.id,
              surface: m.surface.toString(),
              couleur: m.couleur,
            }))
          );
        }
        
        // Charger plafond et boiseries
        setSurfaces({
          plafond: pieceToEdit.surfacePlafond?.toString() || '',
          boiseries: pieceToEdit.surfaceBoiseries?.toString() || '',
        });
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

  // Gestion des murs
  const handleAddMur = () => {
    if (murs.length < MAX_MURS) {
      const lastMur = murs[murs.length - 1];
      setMurs([
        ...murs,
        {
          id: Date.now().toString(),
          surface: '',
          couleur: lastMur.couleur, // Hériter de la couleur du mur précédent
        },
      ]);
    }
  };

  const handleRemoveMur = (murId: string) => {
    if (murs.length > 1) {
      setMurs(murs.filter((m) => m.id !== murId));
    }
  };

  const handleMurSurfaceChange = (murId: string, value: string) => {
    setMurs(murs.map((m) => (m.id === murId ? { ...m, surface: value } : m)));
  };

  const handleOpenCouleurModal = (type: 'mur' | 'plafond' | 'boiseries', murId?: string) => {
    setCurrentSelection({ type, murId });
    setShowCouleurModal(true);
  };

  const getTargetFinition = () => {
    if (!currentSelection || !typePiece) return undefined;
    const regles = REGLES_FINITION[typePiece];
    if (!regles) return undefined;

    if (currentSelection.type === 'mur') return regles.murs;
    if (currentSelection.type === 'plafond') return regles.plafond;
    return undefined; // Boiseries (Laque) géré séparément ou pas de filtrage
  };

  const handleSelectCouleur = (couleur: Couleur) => {
    if (!currentSelection) return;

    if (currentSelection.type === 'mur' && currentSelection.murId) {
      setMurs(murs.map((m) => (m.id === currentSelection.murId ? { ...m, couleur } : m)));
    } else if (currentSelection.type === 'plafond') {
      setCouleurPlafond(couleur);
    } else if (currentSelection.type === 'boiseries') {
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

    // Valider les murs
    murs.forEach((mur, index) => {
      if (!mur.surface || parseFloat(mur.surface) <= 0) {
        newErrors[`mur_${mur.id}_surface`] = 'Surface requise';
      }
      if (!mur.couleur) {
        newErrors[`mur_${mur.id}_couleur`] = 'Couleur requise';
      }
    });

    // Valider plafond
    if (surfaces.plafond) {
      const plafondValue = parseFloat(surfaces.plafond);
      if (isNaN(plafondValue) || plafondValue <= 0) {
        newErrors.plafond = 'La surface du plafond doit être positive';
      } else if (!couleurPlafond) {
        newErrors.couleurPlafond = 'Veuillez sélectionner une couleur pour le plafond';
      }
    }

    // Valider boiseries
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

    // Construire l'objet Piece avec le nouveau modèle
    const mursData: Mur[] = murs.map((m) => ({
      id: m.id,
      surface: parseFloat(m.surface),
      couleur: m.couleur!,
    }));

    const pieceData: Piece = {
      id: editPieceId || Date.now().toString(),
      typePiece,
      nom: nomPiece,
      murs: mursData,
      surfacePlafond: surfaces.plafond ? parseFloat(surfaces.plafond) : undefined,
      surfaceBoiseries: surfaces.boiseries ? parseFloat(surfaces.boiseries) : undefined,
      couleurPlafond: couleurPlafond || undefined,
      couleurBoiseries: couleurBoiseries || undefined,
    };

    console.log('DEBUG: Sauvegarde pièce', {
      nom: pieceData.nom,
      murs: pieceData.murs.map(m => ({ id: m.id, finition: m.couleur.finition })),
      plafondFinition: pieceData.couleurPlafond?.finition
    });

    if (editPieceId) {
      // Mode édition : mettre à jour la pièce existante
      const pieceIndex = pieces.findIndex(p => p.id === editPieceId);
      if (pieceIndex !== -1) {
        pieces[pieceIndex] = pieceData;
      }
      sessionStorage.removeItem('colibri-edit-piece-id');
    } else {
      // Mode création : ajouter une nouvelle pièce
      pieces.push(pieceData);
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

            {/* Murs (obligatoire) - Nouveau design multi-murs */}
            <div className="border border-primary-100 bg-primary-50/30 rounded-xl p-6 space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="font-serif font-bold text-primary-600">Murs *</h3>
                <span className="text-[10px] uppercase tracking-widest text-primary-400 font-bold">
                  {murs.length} / {MAX_MURS} MURS
                </span>
              </div>

              <div className="space-y-4">
                {murs.map((mur, index) => (
                  <div key={mur.id} className="relative border border-gray-100 rounded-xl p-5 space-y-4 bg-white shadow-sm transition-all hover:shadow-md">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary-600 text-white text-[10px] font-bold">
                          {index + 1}
                        </span>
                        <h4 className="text-sm font-serif font-bold text-primary-700">Mur {index + 1}</h4>
                        {typePiece && (
                          <span className="px-2 py-0.5 rounded-full bg-primary-100 text-primary-700 text-[10px] font-bold uppercase tracking-wider">
                            {mur.couleur?.finition || REGLES_FINITION[typePiece]?.murs}
                          </span>
                        )}
                      </div>
                      {murs.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveMur(mur.id)}
                          className="text-red-400 hover:text-red-600 transition-colors p-1"
                          title="Supprimer ce mur"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Input
                        label="Surface (m²)"
                        type="number"
                        step="0.01"
                        required
                        value={mur.surface}
                        onChange={(e) => handleMurSurfaceChange(mur.id, e.target.value)}
                        error={errors[`mur_${mur.id}_surface`]}
                        placeholder="0.00"
                      />
                      
                      <div className="space-y-1.5">
                        <label className="block text-sm font-medium text-gray-700">Couleur</label>
                        <button
                          type="button"
                          onClick={() => handleOpenCouleurModal('mur', mur.id)}
                          className={`w-full flex items-center gap-3 px-3 py-2 border rounded-md text-left transition-all ${
                            errors[`mur_${mur.id}_couleur`] ? 'border-red-500 bg-red-50' : 'border-gray-300 hover:border-primary-500'
                          }`}
                        >
                          {mur.couleur ? (
                            <>
                              <div className="w-6 h-6 rounded-full border border-gray-200 shadow-sm" style={{ backgroundColor: mur.couleur.codeHex || '#fff' }}>
                                {mur.couleur.imageUrl && (
                                  <img src={mur.couleur.imageUrl} alt="" className="w-full h-full rounded-full object-cover" />
                                )}
                              </div>
                              <span className="text-sm text-gray-900 truncate">{mur.couleur.titre}</span>
                            </>
                          ) : (
                            <span className="text-sm text-gray-400 italic">Choisir une couleur</span>
                          )}
                        </button>
                        {errors[`mur_${mur.id}_couleur`] && (
                          <p className="text-xs text-red-500">{errors[`mur_${mur.id}_couleur`]}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                {/* Bouton Ajouter un mur - Design Add-at-Bottom */}
                {murs.length < MAX_MURS && (
                  <button
                    type="button"
                    onClick={handleAddMur}
                    className="w-full py-4 border-2 border-dashed border-primary-200 rounded-xl bg-primary-50/50 text-primary-600 hover:bg-primary-50 hover:border-primary-300 transition-all group flex flex-col items-center justify-center gap-1"
                  >
                    <div className="flex items-center gap-2">
                      <svg className="w-5 h-5 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                      <span className="font-serif font-bold">Ajouter un mur</span>
                    </div>
                    <span className="text-[10px] uppercase tracking-widest opacity-60">
                      {MAX_MURS - murs.length} emplacement{MAX_MURS - murs.length > 1 ? 's' : ''} disponible{MAX_MURS - murs.length > 1 ? 's' : ''}
                    </span>
                  </button>
                )}
              </div>
            </div>

            {/* Plafond (optionnel) */}
            <div className="border border-gray-100 rounded-xl p-6 space-y-4 bg-gray-50/30">
              <div className="flex items-center gap-3">
                <h3 className="font-serif font-bold text-gray-700">Plafond (optionnel)</h3>
                {typePiece && (
                  <span className="px-2 py-0.5 rounded-full bg-gray-200 text-gray-700 text-[10px] font-bold uppercase tracking-wider">
                    {couleurPlafond?.finition || REGLES_FINITION[typePiece]?.plafond}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Surface (m²)"
                  type="number"
                  step="0.01"
                  value={surfaces.plafond}
                  onChange={(e) => setSurfaces({ ...surfaces, plafond: e.target.value })}
                  error={errors.plafond}
                  placeholder="0.00"
                />
                
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-gray-700">Couleur</label>
                  <button
                    type="button"
                    onClick={() => handleOpenCouleurModal('plafond')}
                    className={`w-full flex items-center gap-3 px-3 py-2 border rounded-md text-left transition-all ${
                      errors.couleurPlafond ? 'border-red-500 bg-red-50' : 'border-gray-300 hover:border-primary-500'
                    }`}
                  >
                    {couleurPlafond ? (
                      <>
                        <div className="w-6 h-6 rounded-full border border-gray-200 shadow-sm" style={{ backgroundColor: couleurPlafond.codeHex || '#fff' }}>
                          {couleurPlafond.imageUrl && (
                            <img src={couleurPlafond.imageUrl} alt="" className="w-full h-full rounded-full object-cover" />
                          )}
                        </div>
                        <span className="text-sm text-gray-900 truncate">{couleurPlafond.titre}</span>
                      </>
                    ) : (
                      <span className="text-sm text-gray-400 italic">Choisir une couleur</span>
                    )}
                  </button>
                  {errors.couleurPlafond && (
                    <p className="text-xs text-red-500">{errors.couleurPlafond}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Boiseries (optionnel) */}
            <div className="border border-gray-100 rounded-xl p-6 space-y-4 bg-gray-50/30">
              <h3 className="font-serif font-bold text-gray-700">Boiseries (optionnel)</h3>
              <p className="text-xs text-gray-500 -mt-2 italic">Portes, fenêtres, plinthes...</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Surface (m²)"
                  type="number"
                  step="0.01"
                  value={surfaces.boiseries}
                  onChange={(e) => setSurfaces({ ...surfaces, boiseries: e.target.value })}
                  error={errors.boiseries}
                  placeholder="0.00"
                />
                
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-gray-700">Couleur</label>
                  <button
                    type="button"
                    onClick={() => handleOpenCouleurModal('boiseries')}
                    className={`w-full flex items-center gap-3 px-3 py-2 border rounded-md text-left transition-all ${
                      errors.couleurBoiseries ? 'border-red-500 bg-red-50' : 'border-gray-300 hover:border-primary-500'
                    }`}
                  >
                    {couleurBoiseries ? (
                      <>
                        <div className="w-6 h-6 rounded-full border border-gray-200 shadow-sm" style={{ backgroundColor: couleurBoiseries.codeHex || '#fff' }}>
                          {couleurBoiseries.imageUrl && (
                            <img src={couleurBoiseries.imageUrl} alt="" className="w-full h-full rounded-full object-cover" />
                          )}
                        </div>
                        <span className="text-sm text-gray-900 truncate">{couleurBoiseries.titre}</span>
                      </>
                    ) : (
                      <span className="text-sm text-gray-400 italic">Choisir une couleur</span>
                    )}
                  </button>
                  {errors.couleurBoiseries && (
                    <p className="text-xs text-red-500">{errors.couleurBoiseries}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Navigation buttons */}
            <div className="flex justify-between pt-6 border-t border-gray-100">
              <Button
                type="button"
                variant="outline"
                onClick={handleBack}
              >
                ← Retour
              </Button>
              <div className="flex gap-3">
                {hasPieces && !isEditMode && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleSkipToRecap}
                  >
                    Voir le récapitulatif
                  </Button>
                )}
                <Button
                  type="submit"
                  size="lg"
                >
                  {isEditMode ? 'Enregistrer les modifications' : 'Valider cette pièce →'}
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Couleur Modal */}
      <CouleurModal
        isOpen={showCouleurModal}
        onClose={() => setShowCouleurModal(false)}
        onSelect={handleSelectCouleur}
        title={
          currentSelection?.type === 'mur' 
            ? 'Choisir une couleur pour le mur' 
            : currentSelection?.type === 'plafond'
            ? 'Choisir une couleur pour le plafond'
            : 'Choisir une couleur pour les boiseries'
        }
        targetFinition={getTargetFinition()}
      />
    </div>
  );
}
