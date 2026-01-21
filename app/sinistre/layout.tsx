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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex flex-col items-start">
              <img 
                src="https://cdn.shopify.com/s/files/1/0971/0436/3865/files/logo-colibri-lettre-ligne-gris.png?v=1761219657" 
                alt="Colibri Logo" 
                className="h-8 w-auto object-contain mb-1"
              />
              <p className="text-[10px] uppercase tracking-wider text-gray-400 font-medium">
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
      <footer className="bg-white border-t border-gray-200 mt-auto">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <p className="text-center text-sm text-gray-500">
            © 2026 Colibri Peinture
          </p>
        </div>
      </footer>
    </div>
  );
}
