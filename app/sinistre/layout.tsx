import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Calcul de peinture sinistre | Colibri',
  description: 'Calculez automatiquement vos besoins en peinture pour votre sinistre',
};

export default function SinistreLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md sticky top-0 z-50 border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex flex-col items-start">
              <img 
                src="https://cdn.shopify.com/s/files/1/0971/0436/3865/files/logo-colibri-lettre-ligne-gris.png?v=1761219657" 
                alt="Colibri Logo" 
                className="h-8 w-auto object-contain mb-1"
              />
              <p className="text-[10px] uppercase tracking-widest text-primary-600 font-bold">
                Partenaire de votre assureur
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600">Besoin d'aide ?</p>
              <a href="tel:+33123456789" className="text-sm font-medium text-primary-600 hover:text-primary-700">
                01 23 45 67 89
              </a>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-100 mt-auto">
        <div className="max-w-4xl mx-auto px-4 py-12">
          <div className="flex flex-col items-center space-y-4">
            <img 
              src="https://cdn.shopify.com/s/files/1/0971/0436/3865/files/logo-colibri-lettre-ligne-gris.png?v=1761219657" 
              alt="Colibri Logo" 
              className="h-6 w-auto opacity-50 grayscale"
            />
            <p className="text-center text-xs text-gray-400 tracking-wide">
              © 2026 COLIBRI PEINTURE — TOUS DROITS RÉSERVÉS
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
