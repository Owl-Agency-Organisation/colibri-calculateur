import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PontLabo } from './PontLabo';

// Page de test du pont simulateur, servie uniquement par les previews Vercel
// (et `next dev`) : 404 en production, jamais indexée.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Labo pont simulateur (test interne)',
  robots: { index: false, follow: false },
};

export default function LaboPontPage() {
  if (process.env.VERCEL_ENV === 'production' || process.env.NEXT_PUBLIC_COLIBRI_LABO !== '1') {
    notFound();
  }
  return <PontLabo />;
}
