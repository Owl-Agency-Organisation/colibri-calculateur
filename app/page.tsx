import Link from 'next/link';
import { Button } from '@/components/ui/Button';

export default function Home() {
  return (
    <main className="min-h-screen bg-background">
      {/* Hero section */}
      <div className="max-w-4xl mx-auto px-4 py-20 sm:py-32">
        <div className="text-center">
          {/* Logo */}
          <div className="flex justify-center mb-12">
            <img 
              src="https://cdn.shopify.com/s/files/1/0971/0436/3865/files/logo-colibri-lettre-ligne-gris.png?v=1761219657" 
              alt="Colibri Logo" 
              className="h-10 w-auto object-contain opacity-90"
            />
          </div>

          {/* Title */}
          <h1 className="text-5xl sm:text-7xl font-serif font-bold text-primary-600 mb-6 tracking-tight">
            Assurances
          </h1>
          <p className="text-xs uppercase tracking-[0.3em] text-primary-500 font-bold mb-8">
            Partenaire de votre assureur
          </p>
          <p className="text-xl text-gray-600 mb-12 max-w-2xl mx-auto leading-relaxed">
            Calculez automatiquement vos besoins en peinture biosourcée 
            pour votre sinistre en quelques minutes.
          </p>

          {/* CTA Button */}
          <Link href="/sinistre">
            <Button size="lg" className="text-lg px-12 py-6 rounded-full shadow-xl hover:shadow-2xl transition-all">
              Commencer le calcul
            </Button>
          </Link>

          {/* Features */}
          <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-8">
            <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Simple et rapide</h3>
              <p className="text-sm text-gray-500">
                Renseignez vos surfaces en quelques clics et obtenez votre devis instantanément.
              </p>
            </div>

            <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Calcul optimisé</h3>
              <p className="text-sm text-gray-500">
                Notre algorithme calcule les quantités exactes pour éviter le gaspillage.
              </p>
            </div>

            <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Peinture biosourcée</h3>
              <p className="text-sm text-gray-500">
                Des peintures écologiques et respectueuses de votre santé et de l'environnement.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-12 mt-24">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <p className="text-xs text-gray-400 tracking-widest uppercase">
            © 2026 COLIBRI PEINTURE — TOUS DROITS RÉSERVÉS
          </p>
        </div>
      </footer>
    </main>
  );
}
