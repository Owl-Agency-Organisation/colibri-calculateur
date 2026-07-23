'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/Card';
import { clearAllData } from '@/lib/store/projetStore';

export default function AccueilPage() {
  const router = useRouter();

  const handleNewProject = (e: React.MouseEvent) => {
    e.preventDefault();
    // Réinitialisation complète des données stockées
    clearAllData();
    // Le tunnel démarre directement au choix des pièces
    router.push('/calculateur/piece');
  };

  return (
    <div className="max-w-2xl mx-auto py-12 px-4">
      <div className="text-center mb-12">
        <h1 className="text-3xl font-serif font-bold text-gray-900 mb-4">
          Bienvenue dans votre espace dédié
        </h1>
        <p className="text-lg text-gray-600">
          Choisissez l&apos;option qui vous convient pour continuer votre projet de rénovation.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* Option 1: Nouveau projet */}
        <div
          className="cursor-pointer group"
          onClick={handleNewProject}
        >
          <Card className="hover:border-primary-500 transition-colors">
            <div className="block p-2">
              <CardContent className="p-6 flex items-center gap-6">
              <div className="w-16 h-16 bg-primary-50 rounded-full flex items-center justify-center flex-shrink-0 group-hover:bg-primary-100 transition-colors">
                <svg className="w-8 h-8 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <div className="flex-grow">
                <h2 className="text-xl font-bold text-gray-900 mb-1">Démarrer un nouveau projet</h2>
                <p className="text-gray-500">
                  Calculez vos besoins et choisissez vos couleurs en quelques minutes.
                </p>
              </div>
                <div className="text-primary-600">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </CardContent>
            </div>
          </Card>
        </div>

        {/* Option 2: Reprendre un projet */}
        <Card className="hover:border-primary-500 transition-colors cursor-pointer group opacity-75 hover:opacity-100">
          <Link href="/calculateur/piece" className="block p-2">
            <CardContent className="p-6 flex items-center gap-6">
              <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center flex-shrink-0 group-hover:bg-gray-100 transition-colors">
                <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </div>
              <div className="flex-grow">
                <h2 className="text-xl font-bold text-gray-900 mb-1">Reprendre mon projet</h2>
                <p className="text-gray-500">
                  Retrouvez votre sélection et finalisez votre commande.
                </p>
              </div>
              <div className="text-gray-400 group-hover:text-primary-600 transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </CardContent>
          </Link>
        </Card>
      </div>

      <div className="mt-12 text-center">
        <p className="text-sm text-gray-500">
          Besoin d&apos;assistance ? Notre équipe est là pour vous aider au <a href="tel:+33562141646" className="text-primary-600 font-medium">05 62 14 16 46</a>
        </p>
      </div>
    </div>
  );
}
