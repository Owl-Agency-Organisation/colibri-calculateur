import { redirect } from 'next/navigation';

// L'accueil du parcours vit sur la page d'accueil de l'app
export default function CalculateurIndexPage() {
  redirect('/');
}
