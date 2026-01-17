'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StepIndicator, SINISTRE_STEPS } from '@/components/ui/StepIndicator';
import { getStoredPieces, getStoredAssure, STORAGE_KEYS } from '@/lib/store/sinistreStore';
import type { ResultatCalcul } from '@/lib/calcul';
import type { Piece, Assure } from '@/lib/types';

interface LignePanier {
  id: string;
  type: 'peinture' | 'sous-couche' | 'kit';
  titre: string;
  description: string;
  quantite: string;
  prixUnitaire?: number;
  prixTotal?: number;
  imageUrl?: string;
}

export default function PanierPage() {
  const router = useRouter();
  const [assure, setAssure] = useState<Assure | null>(null);
  const [pieces, setPieces] = useState<Piece[]>([]);
  const [resultat, setResultat] = useState<ResultatCalcul | null>(null);
  const [options, setOptions] = useState({ sousCouche: true, kit: true });
  const [lignesPanier, setLignesPanier] = useState<LignePanier[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  useEffect(() => {
    // Charger les données
    const storedAssure = getStoredAssure();
    const storedPieces = getStoredPieces();
    const storedCalcul = localStorage.getItem(STORAGE_KEYS.CALCUL);
    const storedOptions = localStorage.getItem(STORAGE_KEYS.OPTIONS);

    if (!storedCalcul || storedPieces.length === 0) {
      router.push('/sinistre/piece');
      return;
    }

    setAssure(storedAssure);
    setPieces(storedPieces);
    setResultat(JSON.parse(storedCalcul));
    
    if (storedOptions) {
      setOptions(JSON.parse(storedOptions));
    }

    setIsLoaded(true);
  }, [router]);

  // Construire les lignes du panier
  useEffect(() => {
    if (!resultat) return;

    const lignes: LignePanier[] = [];

    // Peintures
    resultat.peintures.forEach((peinture, index) => {
      const contenantsStr = peinture.contenants
        .map(c => `${c.quantite}×${c.contenance}`)
        .join(' + ');

      lignes.push({
        id: `peinture-${index}`,
        type: 'peinture',
        titre: peinture.couleur.titre,
        description: `${peinture.surfaceTotale.toFixed(1)} m² - ${contenantsStr}`,
        quantite: `${peinture.litresCommandes}L`,
        imageUrl: peinture.couleur.imageUrl,
      });
    });

    // Sous-couches (si option activée)
    if (options.sousCouche) {
      resultat.sousCouches.forEach((sousCouche, index) => {
        const contenantsStr = sousCouche.contenants
          .map(c => `${c.quantite}×${c.contenance}`)
          .join(' + ');

        lignes.push({
          id: `sous-couche-${index}`,
          type: 'sous-couche',
          titre: `Sous-couche ${sousCouche.type}`,
          description: `${sousCouche.surfaceTotale.toFixed(1)} m² - ${contenantsStr}`,
          quantite: `${sousCouche.litresCommandes}L`,
        });
      });
    }

    // Kit (si option activée)
    if (options.kit) {
      lignes.push({
        id: 'kit',
        type: 'kit',
        titre: resultat.kit.titre,
        description: `Pour surfaces ${resultat.kit.type === 'petite' ? '≤ 30' : '> 30'} m²`,
        quantite: '1',
        prixTotal: resultat.kit.prix,
      });
    }

    setLignesPanier(lignes);
  }, [resultat, options]);

  const handleGeneratePdf = async () => {
    setIsGeneratingPdf(true);
    try {
      const response = await fetch('/api/generate-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          assure,
          pieces,
          resultat,
          options,
        }),
      });

      if (!response.ok) {
        throw new Error('Erreur lors de la génération du PDF');
      }

      // Récupérer le HTML et l'ouvrir dans une nouvelle fenêtre pour impression
      const html = await response.text();
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(html);
        printWindow.document.close();
        // Attendre le chargement puis imprimer
        printWindow.onload = () => {
          printWindow.print();
        };
      }

      // Naviguer vers la confirmation
      router.push('/sinistre/confirmation');
    } catch (error) {
      console.error('Erreur PDF:', error);
      alert('Une erreur est survenue lors de la génération du PDF. Veuillez réessayer.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleBack = () => {
    router.push('/sinistre/options');
  };

  if (!isLoaded || !resultat || !assure) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <StepIndicator steps={SINISTRE_STEPS} currentStep={6} />

      {/* Title */}
      <div className="text-center">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
          Récapitulatif de commande
        </h1>
        <p className="text-gray-600">
          Vérifiez votre commande avant de générer le PDF
        </p>
      </div>

      {/* Informations assuré */}
      <Card>
        <CardHeader>
          <CardTitle>Informations assuré</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500">Nom complet</p>
              <p className="font-medium text-gray-900">
                {assure.civilite} {assure.prenom} {assure.nom}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Email</p>
              <p className="font-medium text-gray-900">{assure.email}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Téléphone</p>
              <p className="font-medium text-gray-900">{assure.telephone}</p>
            </div>
            {assure.adresse && (
              <div>
                <p className="text-sm text-gray-500">Adresse</p>
                <p className="font-medium text-gray-900">
                  {assure.adresse}
                  {assure.codePostal && `, ${assure.codePostal}`}
                  {assure.ville && ` ${assure.ville}`}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Panier */}
      <Card>
        <CardHeader>
          <CardTitle>Produits sélectionnés</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="divide-y divide-gray-200">
            {lignesPanier.map((ligne) => (
              <div key={ligne.id} className="py-4 flex items-center gap-4">
                {/* Image */}
                {ligne.imageUrl ? (
                  <img
                    src={ligne.imageUrl}
                    alt={ligne.titre}
                    className="w-16 h-16 object-cover rounded"
                  />
                ) : (
                  <div className="w-16 h-16 bg-gray-100 rounded flex items-center justify-center">
                    {ligne.type === 'sous-couche' && (
                      <span className="text-2xl">🪣</span>
                    )}
                    {ligne.type === 'kit' && (
                      <span className="text-2xl">🧰</span>
                    )}
                  </div>
                )}

                {/* Info */}
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900">{ligne.titre}</h4>
                  <p className="text-sm text-gray-500">{ligne.description}</p>
                </div>

                {/* Quantité */}
                <div className="text-right">
                  <p className="font-semibold text-gray-900">{ligne.quantite}</p>
                  {ligne.prixTotal && (
                    <p className="text-sm text-gray-500">{ligne.prixTotal.toFixed(2)} €</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Résumé surfaces */}
      <Card>
        <CardHeader>
          <CardTitle>Résumé des surfaces</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Surfaces murs</span>
              <span className="font-medium">{resultat.resume.surfaceMurs.toFixed(1)} m²</span>
            </div>
            {resultat.resume.surfacePlafonds > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Surfaces plafonds</span>
                <span className="font-medium">{resultat.resume.surfacePlafonds.toFixed(1)} m²</span>
              </div>
            )}
            {resultat.resume.surfaceBoiseries > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Surfaces boiseries</span>
                <span className="font-medium">{resultat.resume.surfaceBoiseries.toFixed(1)} m²</span>
              </div>
            )}
            <div className="flex justify-between text-sm pt-2 border-t border-gray-200">
              <span className="font-medium text-gray-900">Surface totale</span>
              <span className="font-bold text-primary-600">{resultat.surfaceTotale.toFixed(1)} m²</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row justify-between gap-4 pt-4">
        <Button
          variant="outline"
          onClick={handleBack}
        >
          ← Modifier les options
        </Button>
        <Button
          size="lg"
          onClick={handleGeneratePdf}
          disabled={isGeneratingPdf}
          className="flex items-center gap-2"
        >
          {isGeneratingPdf ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              Génération en cours...
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Générer le PDF de commande
            </>
          )}
        </Button>
      </div>

      {/* Info box */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex gap-3">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          </div>
          <div>
            <h4 className="text-sm font-medium text-green-800">Prêt à commander</h4>
            <p className="text-sm text-green-700 mt-1">
              Le PDF généré contiendra tous les détails de votre commande. 
              Vous pourrez le transmettre à votre assureur ou le conserver pour vos archives.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
