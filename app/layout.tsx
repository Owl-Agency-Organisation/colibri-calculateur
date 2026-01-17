import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Colibri Assurances - Calcul de peinture sinistre',
  description: 'Application de calcul automatique de peinture pour sinistres - Colibri x Covea',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body className="antialiased">{children}</body>
    </html>
  );
}