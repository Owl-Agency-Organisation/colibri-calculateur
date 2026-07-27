import type { Metadata } from 'next';
import { Inter, Playfair_Display } from 'next/font/google';
import { Analytics } from '@vercel/analytics/next';
import { EmbedBridge } from '@/components/EmbedBridge';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
  display: 'swap',
});

// URL canonique : la page Shopify qui embarque l'app en iframe.
// calculateur.colibripeinture.com n'est plus qu'un hôte technique.
const SITE_URL = 'https://colibripeinture.com/pages/configurateur';
const SITE_TITLE = 'Calculateur de peinture en ligne — Colibri Peinture';
const SITE_DESCRIPTION =
  'Calculez gratuitement la juste quantité de peinture pour votre projet : ' +
  'pièces, surfaces, couleurs et finitions. Peintures biosourcées fabriquées en France, ' +
  '-15% sur votre commande via le calculateur.';

// Accès direct au sous-domaine technique hors iframe → page canonique.
// Le garde sur hostname préserve les previews Vercel (*.vercel.app) ;
// aucune boucle possible : dans l'iframe, window.self !== window.top.
const REDIRECT_GUARD = `
try {
  if (location.hostname === 'calculateur.colibripeinture.com'
      && window.self === window.top) {
    location.replace('https://colibripeinture.com/pages/configurateur');
  }
} catch (e) {}
`;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  robots: { index: false, follow: true },
  openGraph: {
    type: 'website',
    url: SITE_URL,
    siteName: 'Colibri Peinture — Calculateur',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    locale: 'fr_FR',
    images: [
      {
        url: 'https://cdn.shopify.com/s/files/1/0971/0436/3865/files/logo-colibri-lettre-ligne-gris.png?v=1761219657',
        alt: 'Colibri Peinture',
      },
    ],
  },
  twitter: {
    card: 'summary',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" className={`${inter.variable} ${playfair.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: REDIRECT_GUARD }} />
      </head>
      <body className="antialiased font-sans bg-background text-gray-900">
        {/* Pas de header ni footer : le chrome (logo, navigation, crédits) est
            celui du site Shopify qui embarque l'app. La hauteur du document doit
            refléter la hauteur réelle du contenu (auto-resize de l'iframe). */}
        <main className="max-w-4xl mx-auto px-4 py-4">
          {children}
        </main>
        <EmbedBridge />
        <Analytics />
      </body>
    </html>
  );
}
