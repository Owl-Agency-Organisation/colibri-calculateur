'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StepIndicator, SINISTRE_STEPS } from '@/components/ui/StepIndicator';
import { getStoredPieces, getStoredAssure, STORAGE_KEYS } from '@/lib/store/sinistreStore';
import type { ResultatCalcul, CalculPeinture, CalculSousCouche } from '@/lib/calcul';
import type { Piece, Assure } from '@/lib/types';

// Produits de rénovation
const PRODUITS_RENOVATION = [
  { handle: 'pate-a-renover-multi-materiaux', titre: 'Pâte à rénover multi matériaux', prix: 29.20 },
  { handle: 'couteau-de-peintre', titre: 'Couteau de peintre (spatule)', prix: 7.80 },
  { handle: 'papier-a-poncer', titre: 'Papier à poncer grain 120', prix: 3.60 },
  { handle: 'cale-a-poncer-auto-agrippante', titre: 'Cale à poncer', prix: 6.40 },
];

// Les prix sont désormais calculés dynamiquement via l'API Shopify
// et injectés dans le résultat du calcul.

interface LignePanier {
  id: string;
  type: 'peinture' | 'sous-couche' | 'kit' | 'renovation';
  titre: string;
  description: string;
  quantite: number;
  unite: string;
  prixUnitaire: number;
  prixTotal: number;
  imageUrl?: string;
  editable: boolean;
}

export default function PanierPage() {
  const router = useRouter();
  const [assure, setAssure] = useState<Assure | null>(null);
  const [pieces, setPieces] = useState<Piece[]>([]);
  const [resultat, setResultat] = useState<ResultatCalcul | null>(null);
  const [options, setOptions] = useState({ sousCouche: true, kit: true, renovation: false });
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
      const prix = peinture.prixTotal;

      lignes.push({
        id: `peinture-${index}`,
        type: 'peinture',
        titre: peinture.couleur.titre,
        description: `${peinture.surfaceTotale.toFixed(1)} m² - ${contenantsStr}`,
        quantite: peinture.litresCommandes,
        unite: 'L',
        prixUnitaire: peinture.litresCommandes > 0 ? prix / peinture.litresCommandes : 0,
        prixTotal: prix,
        imageUrl: peinture.couleur.imageUrl,
        editable: false,
      });
    });

    // Sous-couches (si option activée)
    if (options.sousCouche) {
      resultat.sousCouches.forEach((sousCouche, index) => {
        const contenantsStr = sousCouche.contenants
          .map(c => `${c.quantite}×${c.contenance}`)
          .join(' + ');
        const prix = sousCouche.prixTotal;

        lignes.push({
          id: `sous-couche-${index}`,
          type: 'sous-couche',
          titre: `Sous-couche ${sousCouche.type}`,
          description: `${sousCouche.surfaceTotale.toFixed(1)} m² - ${contenantsStr}`,
          quantite: sousCouche.litresCommandes,
          unite: 'L',
          prixUnitaire: sousCouche.litresCommandes > 0 ? prix / sousCouche.litresCommandes : 0,
          prixTotal: prix,
          editable: false,
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
        quantite: 1,
        unite: '',
        prixUnitaire: resultat.kit.prix,
        prixTotal: resultat.kit.prix,
        editable: false,
      });
    }

    // Produits de rénovation (si option activée)
    if (options.renovation) {
      PRODUITS_RENOVATION.forEach((produit) => {
        lignes.push({
          id: `renovation-${produit.handle}`,
          type: 'renovation',
          titre: produit.titre,
          description: 'Préparation des surfaces',
          quantite: 1,
          unite: '',
          prixUnitaire: produit.prix,
          prixTotal: produit.prix,
          editable: false,
        });
      });
    }

    setLignesPanier(lignes);
  }, [resultat, options]);

  // Calculer le total
  const calculerTotal = (): number => {
    return lignesPanier.reduce((total, ligne) => total + ligne.prixTotal, 0);
  };

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
          lignesPanier,
          total: calculerTotal(),
        }),
      });

      if (!response.ok) {
        throw new Error('Erreur lors de la génération du PDF');
      }

      // Récupérer le blob PDF et le télécharger directement
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `commande-colibri-${Date.now()}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

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

  const total = calculerTotal();

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

      {/* Résumé du projet + Coût total en haut */}
      <Card className="bg-primary-50 border-primary-200">
        <CardContent className="py-4">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 items-center">
            <div className="text-center">
              <p className="text-xl font-bold text-primary-600">{resultat.resume.nombrePieces}</p>
              <p className="text-xs text-primary-800">Pièce{resultat.resume.nombrePieces > 1 ? 's' : ''}</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold text-primary-600">{resultat.resume.nombreCouleurs}</p>
              <p className="text-xs text-primary-800">Couleur{resultat.resume.nombreCouleurs > 1 ? 's' : ''}</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold text-primary-600">{resultat.surfaceTotale.toFixed(1)} m²</p>
              <p className="text-xs text-primary-800">Surface totale</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold text-primary-600">
                {resultat.peintures.reduce((sum, p) => sum + p.litresCommandes, 0)}L
              </p>
              <p className="text-xs text-primary-800">Peinture</p>
            </div>
            <div className="text-center sm:border-l sm:border-primary-300 sm:pl-4">
              <p className="text-2xl font-bold text-primary-700">{total.toFixed(2)} €</p>
              <p className="text-xs text-primary-800">Total estimé</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Vos informations */}
      <Card>
        <CardHeader>
          <CardTitle>Vos informations</CardTitle>
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

      {/* Panier avec prix */}
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
                    {ligne.type === 'renovation' && (
                      <span className="text-2xl">🔧</span>
                    )}
                    {ligne.type === 'peinture' && !ligne.imageUrl && (
                      <span className="text-2xl">🎨</span>
                    )}
                  </div>
                )}

                {/* Info */}
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900">{ligne.titre}</h4>
                  <p className="text-sm text-gray-500">{ligne.description}</p>
                </div>

                {/* Quantité */}
                <div className="text-center min-w-[60px]">
                  <p className="font-medium text-gray-900">
                    {ligne.quantite}{ligne.unite}
                  </p>
                </div>

                {/* Prix */}
                <div className="text-right min-w-[80px]">
                  <p className="font-semibold text-gray-900">{ligne.prixTotal.toFixed(2)} €</p>
                </div>
              </div>
            ))}
          </div>

          {/* Total */}
          <div className="mt-4 pt-4 border-t-2 border-gray-200">
            <div className="flex justify-between items-center">
              <span className="text-lg font-semibold text-gray-900">Total estimé</span>
              <span className="text-2xl font-bold text-primary-600">{total.toFixed(2)} €</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              * Prix indicatifs. Les prix définitifs seront confirmés lors de la commande.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="space-y-6 pt-4">
        <div className="flex flex-col gap-4 max-w-2xl mx-auto">
          {/* CTA Principal : Commande */}
          <div className="text-center space-y-2">
            <Button
              size="lg"
              className="w-full py-8 text-xl font-bold bg-primary-600 hover:bg-primary-700 shadow-lg flex items-center justify-center gap-3"
              onClick={() => window.open('https://colibripeinture.fr', '_blank')}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Commander et recevoir sous 72h
            </Button>
            <p className="text-sm text-gray-500 font-medium">
              ⚡ Livraison prioritaire à domicile pour votre sinistre
            </p>
          </div>

          <div className="relative py-4">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-gray-200"></span>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-gray-50 text-gray-500 font-medium uppercase tracking-wider">ou</span>
            </div>
          </div>

          {/* CTA Secondaire : Sauvegarde */}
          <div className="text-center space-y-2">
            <Button
              variant="outline"
              size="lg"
              className="w-full py-6 text-lg border-2 border-primary-200 text-primary-700 hover:bg-primary-50 flex items-center justify-center gap-3"
              onClick={handleGeneratePdf}
              disabled={isGeneratingPdf}
            >
              {isGeneratingPdf ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-600"></div>
                  Génération en cours...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Sauvegarder mon estimation (PDF)
                </>
              )}
            </Button>
            <p className="text-sm text-gray-500">
              ⏳ J'attends mon indemnisation de la part de mon assureur
            </p>
          </div>
        </div>

        <div className="flex justify-center pt-4">
          <Button
            variant="ghost"
            onClick={handleBack}
            className="text-gray-500 hover:text-gray-700"
          >
            ← Modifier les options
          </Button>
        </div>
      </div>
    </div>
  );
}
