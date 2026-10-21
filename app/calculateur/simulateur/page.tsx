'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { CartePapierPeint } from '@/components/simulateur/CartePapierPeint';
import { REGLES_FINITION } from '@/lib/calcul';
import { lireEntreeSimulateur, type EntreeSimulateur } from '@/lib/embed-messages';
import type { PapierPeint } from '@/lib/papierPeint';
import { LIBELLES_PIECES } from '@/lib/pieces';
import { trierReferences } from '@/lib/referencesSimulateur';
import { clearProjetData, getStoredPieces } from '@/lib/store/projetStore';
import { enregistrerArriveeSimulateur } from '@/lib/store/arriveeSimulateur';
import type { Couleur } from '@/lib/types';

/**
 * Arrivée depuis la page Simulateur du site :
 * `/calculateur/simulateur?piece={TypePiece}&teintes={handle1},{handle2}`
 * (références dans l'ordre d'application, la dernière est la plus récente).
 * Chaque référence est une teinte ou un papier peint (SKU de variante), triée
 * par la boutique. Un seul mur est créé, avec la dernière peinture appliquée :
 * Wizart n'expose pas l'état de la scène. Toutes les teintes rejoignent « Vos
 * teintes essayées » ; les papiers peints, qui ne se calculent pas, rejoignent
 * le récapitulatif avec un lien vers leur fiche. Paramètres invalides ou
 * absents (ou rien de connu de la boutique) : renvoi silencieux vers l'accueil.
 */

const nomAffiche = (titre: string) => titre.replace(' - Peinture biosourcée murs et plafonds', '');

function CarteTeinte({ couleur, mention }: { couleur: Couleur; mention?: string }) {
  return (
    <li className="rounded-lg border-2 border-gray-200 p-3 bg-white">
      <div
        className="w-full h-20 rounded-md mb-2 border border-gray-100"
        style={{ backgroundColor: couleur.codeHex || '#fff' }}
      >
        {couleur.imageUrl && (
          <img src={couleur.imageUrl} alt="" className="w-full h-full object-cover rounded-md" />
        )}
      </div>
      <p className="text-xs font-medium text-gray-900 line-clamp-2">{nomAffiche(couleur.titre)}</p>
      {mention && (
        <p className="text-[10px] uppercase tracking-widest text-primary-500 font-bold mt-1">{mention}</p>
      )}
    </li>
  );
}
export default function ArriveeSimulateurPage() {
  const router = useRouter();
  const [entree, setEntree] = useState<EntreeSimulateur | null>(null);
  const [couleurs, setCouleurs] = useState<Couleur[]>([]);
  const [papiersPeints, setPapiersPeints] = useState<PapierPeint[]>([]);
  const [nombrePieces, setNombrePieces] = useState(0);
  const [pret, setPret] = useState(false);

  useEffect(() => {
    const lue = lireEntreeSimulateur(new URLSearchParams(window.location.search));
    if (!lue) {
      router.replace('/');
      return;
    }
    let annule = false;
    setEntree(lue);
    setNombrePieces(getStoredPieces().length);

    trierReferences(lue.teintes, { targetFinition: REGLES_FINITION[lue.piece]?.murs })
      .then((triees) => {
        if (annule) return;
        if (triees.couleurs.length === 0 && triees.papiersPeints.length === 0) {
          router.replace('/');
          return;
        }
        setCouleurs(triees.couleurs);
        setPapiersPeints(triees.papiersPeints);
        setPret(true);
      });

    return () => { annule = true; };
  }, [router]);

  const continuer = (nouveauProjet: boolean) => {
    if (!entree) return;
    if (nouveauProjet) clearProjetData();

    // Même suite que le choix d'une pièce : type posé pour la page Surfaces
    sessionStorage.removeItem('colibri-edit-piece-id');
    sessionStorage.setItem('colibri-temp-piece-type', entree.piece);
    // Ordre d'application : la plus récente passe en tête des listes ;
    // un mur avec la dernière peinture appliquée
    enregistrerArriveeSimulateur(couleurs, papiersPeints);
    router.push('/calculateur/surfaces');
  };

  if (!pret || !entree) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  const finition = REGLES_FINITION[entree.piece]?.murs;
  const derniere = couleurs[couleurs.length - 1];
  // Autres teintes essayées, la plus récente d'abord (ordre du bloc)
  const autres = couleurs.slice(0, -1).reverse();
  // Papiers peints, le plus récent d'abord (ordre du récapitulatif)
  const papiersRecents = [...papiersPeints].reverse();

  return (
    <div className="space-y-6">
      <div className="text-center">
        <p className="text-[10px] uppercase tracking-widest text-primary-600 font-bold mb-3">
          Simulateur
        </p>
        <h1 className="text-3xl font-serif font-bold text-gray-900 mb-2">
          Votre sélection du simulateur
        </h1>
        <p className="text-gray-600">
          Calculez maintenant la juste quantité de peinture pour cette pièce.
        </p>
      </div>

      <Card>
        <CardContent className="p-6 space-y-5">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-gray-500">Pièce</span>
            <span className="px-3 py-1 rounded-full bg-primary-100 text-primary-600 text-sm font-semibold">
              {LIBELLES_PIECES[entree.piece]}
            </span>
          </div>

          {couleurs.length === 1 && (
            <div>
              <p className="text-sm text-gray-500 mb-3">
                Votre teinte
                {finition && <> · finition <span className="uppercase">{finition}</span> pour les murs</>}
              </p>
              <ul className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <CarteTeinte couleur={derniere} mention="Mur 1" />
              </ul>
            </div>
          )}
          {couleurs.length > 1 && (
            <>
              <div>
                <p className="text-sm text-gray-500 mb-3">
                  La dernière teinte appliquée
                  {finition && <> · finition <span className="uppercase">{finition}</span> pour les murs</>}
                </p>
                <ul className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <CarteTeinte couleur={derniere} mention="Posée sur le mur 1" />
                </ul>
              </div>
              <div>
                <h2 className="text-base font-semibold text-gray-900">Vos teintes essayées</h2>
                <p className="text-sm text-gray-500 mt-1 mb-3">
                  Vous les retrouverez dans le choix des couleurs de chaque mur.
                </p>
                <ul className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {autres.map((couleur) => (
                    <CarteTeinte key={couleur.productHandle} couleur={couleur} />
                  ))}
                </ul>
              </div>
            </>
          )}

          {papiersRecents.length > 0 && (
            <div>
              <h2 className="text-base font-semibold text-gray-900">
                {papiersRecents.length > 1 ? 'Papiers peints essayés' : 'Papier peint essayé'}
              </h2>
              <p className="text-sm text-gray-500 mt-1 mb-3">
                Le papier peint ne se calcule pas ici&nbsp;: vous le commandez depuis sa fiche. Vous le retrouverez
                dans votre récapitulatif.
              </p>
              <ul className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {papiersRecents.map((papier) => (
                  <CartePapierPeint key={papier.sku} papierPeint={papier} />
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      {nombrePieces === 0 ? (
        <div className="flex justify-center">
          <Button size="lg" onClick={() => continuer(false)}>
            Calculer les quantités pour cette pièce →
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-center text-sm text-gray-600">
            Votre projet en cours&nbsp;: <strong>{nombrePieces} pièce{nombrePieces > 1 ? 's' : ''}</strong>
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button size="lg" onClick={() => continuer(false)}>
              Ajouter cette pièce à mon projet →
            </Button>
            <Button variant="outline" onClick={() => continuer(true)}>
              Commencer un nouveau projet avec cette pièce seule
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
