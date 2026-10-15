import type { Metadata } from 'next';
import { SimulateurLabo } from './SimulateurLabo';

// Page de test interne du visualiseur Wizart (Deployment Kit), servie
// uniquement pour le preview Vercel : jamais indexée.
export const metadata: Metadata = {
  title: 'Labo simulateur (test interne)',
  robots: { index: false, follow: false },
};

export default function LaboSimulateurPage() {
  return <SimulateurLabo />;
}
