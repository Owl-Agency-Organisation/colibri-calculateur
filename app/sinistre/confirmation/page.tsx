'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StepIndicator, SINISTRE_STEPS } from '@/components/ui/StepIndicator';
import { getStoredAssure, clearAllData, STORAGE_KEYS } from '@/lib/store/sinistreStore';
import type { Assure } from '@/lib/types';

export default function ConfirmationPage() {
  const router = useRouter();
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

  const handleNewCommand = () => {
    // Effacer toutes les données et recommencer
    clearAllData();
    router.push('/sinistre');
  };

  const handleBackToHome = () => {
    // Effacer les données et retourner à l'accueil
    clearAllData();
    router.push('/');
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
      <StepIndicator steps={SINISTRE_STEPS} currentStep={7} />

      {/* Success message */}
      <div className="text-center py-8">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
          Commande générée avec succès !
        </h1>
        <p className="text-gray-600 max-w-md mx-auto">
          Votre bon de commande a été créé. Vous pouvez l'imprimer ou le sauvegarder en PDF.
        </p>
      </div>

      {/* Récapitulatif */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm text-gray-500">Numéro de commande</p>
              <p className="text-lg font-bold text-primary-600">{numeroCommande}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">Date</p>
              <p className="font-medium text-gray-900">
                {new Date().toLocaleDateString('fr-FR', {
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric',
                })}
              </p>
            </div>
          </div>
          
          <div className="border-t border-gray-200 pt-4">
            <p className="text-sm text-gray-500 mb-1">Assuré</p>
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
                <p className="font-medium text-gray-900">Imprimez ou sauvegardez le PDF</p>
                <p className="text-sm text-gray-600">
                  Le document s'est ouvert dans une nouvelle fenêtre. Utilisez Ctrl+P (ou Cmd+P) pour l'imprimer ou le sauvegarder en PDF.
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
                  Envoyez le bon de commande à votre assureur pour validation dans le cadre de votre sinistre.
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                <span className="text-primary-600 font-semibold text-sm">3</span>
              </div>
              <div>
                <p className="font-medium text-gray-900">Recevez vos produits</p>
                <p className="text-sm text-gray-600">
                  Une fois validé, votre commande sera traitée et expédiée à l'adresse indiquée.
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
          onClick={handleNewCommand}
        >
          Nouvelle commande
        </Button>
        <Button
          onClick={handleBackToHome}
        >
          Retour à l'accueil
        </Button>
      </div>

      {/* Contact */}
      <div className="text-center text-sm text-gray-500 pt-4">
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
