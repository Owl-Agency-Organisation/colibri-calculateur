'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StepIndicator, CALCULATEUR_STEPS } from '@/components/ui/StepIndicator';
import { useStepperNavigation } from '@/hooks/useStepperNavigation';
import { getStoredClient, clearAllData } from '@/lib/store/projetStore';
import type { Client } from '@/lib/types';

export default function ConfirmationPage() {
  const router = useRouter();
  const { handleStepClick, isStepDisabled } = useStepperNavigation();
  const [client, setClient] = useState<Client | null>(null);

  useEffect(() => {
    // Cette page confirme l'envoi d'une estimation : sans coordonnées
    // enregistrées, on renvoie au début du tunnel.
    const storedClient = getStoredClient();
    if (!storedClient) {
      router.push('/');
      return;
    }
    setClient(storedClient);
  }, [router]);

  const handleBackToPanier = () => {
    router.push('/calculateur/panier');
  };

  const handleNewProject = () => {
    // Effacer toutes les données et recommencer
    clearAllData();
    router.push('/');
  };

  if (!client) {
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
        steps={CALCULATEUR_STEPS}
        currentStep={6}
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
          Votre estimation est en route !
        </h1>
        <p className="text-gray-600 max-w-md mx-auto">
          Nous venons de vous envoyer votre estimation détaillée à{' '}
          <span className="font-medium text-gray-900">{client.email}</span>,
          avec la remise de 15 % déjà appliquée.
        </p>
      </div>

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
                <p className="font-medium text-gray-900">Ouvrez l&apos;e-mail que nous venons de vous envoyer</p>
                <p className="text-sm text-gray-600">
                  Pensez à vérifier vos courriers indésirables s&apos;il n&apos;apparaît pas d&apos;ici quelques minutes.
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                <span className="text-primary-600 font-semibold text-sm">2</span>
              </div>
              <div>
                <p className="font-medium text-gray-900">Vérifiez votre estimation</p>
                <p className="text-sm text-gray-600">
                  Relisez le récapitulatif : quantités, couleurs et options de votre projet.
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                <span className="text-primary-600 font-semibold text-sm">3</span>
              </div>
              <div>
                <p className="font-medium text-gray-900">Commandez quand vous êtes prêt</p>
                <p className="text-sm text-gray-600">
                  Le lien de l&apos;e-mail vous permet de finaliser votre commande en quelques clics,
                  remise comprise.
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
          onClick={handleNewProject}
          className="flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Nouveau projet
        </Button>
      </div>

      {/* Contact */}
      <div className="text-center text-sm text-gray-500 pt-2">
        <p>
          Une question ? Appelez-nous au{' '}
          <a href="tel:+33562141646" className="text-primary-600 hover:underline">
            05 62 14 16 46
          </a>
        </p>
      </div>
    </div>
  );
}
