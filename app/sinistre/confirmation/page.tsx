'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StepIndicator, SINISTRE_STEPS } from '@/components/ui/StepIndicator';
import { useStepperNavigation } from '@/hooks/useStepperNavigation';
import { getStoredAssure, clearAllData } from '@/lib/store/sinistreStore';
import type { Assure } from '@/lib/types';

export default function ConfirmationPage() {
  const router = useRouter();
  const { handleStepClick, isStepDisabled } = useStepperNavigation();
  const [assure, setAssure] = useState<Assure | null>(null);
  const [numeroCommande, setNumeroCommande] = useState('');

  useEffect(() => {
    const storedAssure = getStoredAssure();
    if (!storedAssure) {
      router.push('/sinistre');
      return;
    }
    setAssure(storedAssure);
    
    // Générer un numéro de commande
    setNumeroCommande(`COL-${Date.now().toString(36).toUpperCase()}`);
  }, [router]);

  const handleBackToPanier = () => {
    router.push('/sinistre/panier');
  };

  const handleNewCommand = () => {
    // Effacer toutes les données et recommencer
    clearAllData();
    router.push('/sinistre');
  };

  if (!assure) {
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
        currentStep={7} 
        onStepClick={handleStepClick}
        isStepDisabled={isStepDisabled}
      />

      {/* Success message */}
      <div className="text-center py-8">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-3xl sm:text-4xl font-serif font-bold text-primary-600 mb-2">
          PDF téléchargé avec succès !
        </h1>
        <p className="text-gray-600 max-w-md mx-auto">
          Votre récapitulatif de commande a été téléchargé. Vous pouvez le transmettre à votre assureur.
        </p>
      </div>

      {/* Récapitulatif */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-gray-400 font-bold">Référence</p>
              <p className="text-lg font-serif font-bold text-primary-600">{numeroCommande}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-widest text-gray-400 font-bold">Date</p>
              <p className="font-serif font-bold text-primary-600">
                {new Date().toLocaleDateString('fr-FR', {
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric',
                })}
              </p>
            </div>
          </div>
          
          <div className="border-t border-gray-200 pt-4">
            <p className="text-sm text-gray-500 mb-1">Bénéficiaire</p>
            <p className="font-medium text-gray-900">
              {assure.civilite} {assure.prenom} {assure.nom}
            </p>
            <p className="text-sm text-gray-600">{assure.email}</p>
          </div>
        </CardContent>
      </Card>

      {/* Prochaines étapes */}
      <Card>
        <CardContent className="p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Prochaines étapes</h3>
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                <span className="text-primary-600 font-semibold text-sm">1</span>
              </div>
              <div>
                <p className="font-medium text-gray-900">Retrouvez le PDF dans vos téléchargements</p>
                <p className="text-sm text-gray-600">
                  Le fichier a été téléchargé automatiquement sur votre appareil.
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                <span className="text-primary-600 font-semibold text-sm">2</span>
              </div>
              <div>
                <p className="font-medium text-gray-900">Transmettez à votre assureur</p>
                <p className="text-sm text-gray-600">
                  Envoyez le récapitulatif à votre assureur pour validation dans le cadre de votre sinistre.
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                <span className="text-primary-600 font-semibold text-sm">3</span>
              </div>
              <div>
                <p className="font-medium text-gray-900">Passez commande</p>
                <p className="text-sm text-gray-600">
                  Une fois validé par votre assureur, passez commande sur notre boutique en ligne.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row justify-center gap-4 pt-4">
        <Button
          variant="outline"
          onClick={handleBackToPanier}
          className="flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Retour au panier
        </Button>
        <Button
          onClick={handleNewCommand}
          className="flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Nouvelle estimation
        </Button>
      </div>



      {/* Contact */}
      <div className="text-center text-sm text-gray-500 pt-2">
        <p>
          Une question ? Contactez-nous à{' '}
          <a href="mailto:contact@colibri-peintures.fr" className="text-primary-600 hover:underline">
            contact@colibri-peintures.fr
          </a>
        </p>
      </div>
    </div>
  );
}
