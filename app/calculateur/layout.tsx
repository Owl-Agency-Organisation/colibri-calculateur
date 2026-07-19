import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Calculateur de peinture | Colibri',
  description: 'Calculez automatiquement vos besoins en peinture pour votre projet de rénovation',
};

export default function CalculateurLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
