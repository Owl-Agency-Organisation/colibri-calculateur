'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { REGLES_FINITION } from '@/lib/calcul';
import { chargerCouleurs } from '@/lib/couleur';
import { lireEntreeSimulateur, MAX_TEINTES_ARRIVEE, type EntreeSimulateur } from '@/lib/embed-messages';
import { LIBELLES_PIECES } from '@/lib/pieces';
import { clearProjetData, getStoredPieces } from '@/lib/store/projetStore';
import { ajouterTeintesEssayees } from '@/lib/store/teintesEssayees';
import { setCouleursArrivee } from '@/lib/store/arriveeSimulateur';
import type { Couleur } from '@/lib/types';

/**
 * Arrivée depuis la page Simulateur du site :
 * `/calculateur/simulateur?piece={TypePiece}&teintes={handle1},{handle2}`.
 * Paramètres invalides ou absents (ou aucune teinte connue de la boutique) :
 * renvoi silencieux vers l'accueil.
 */
export default function ArriveeSimulateurPage() {
  const router = useRouter();
  const [entree, setEntree] = useState<EntreeSimulateur | null>(null);
  const [couleurs, setCouleurs] = useState<Couleur[]>([]);
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

    chargerCouleurs(lue.teintes, { targetFinition: REGLES_FINITION[lue.piece]?.murs })
      .then((chargees) => {
        if (annule) return;
        if (chargees.length === 0) {
          router.replace('/');
          return;
        }
        setCouleurs(chargees);
        setPret(true);
      });

    return () => { annule = true; };
  }, [router]);

  const continuer = (nouveauProjet: boolean) => {
    if (!entree) return;
    if (nouveauProjet) clearProjetData();

    ajouterTeintesEssayees(couleurs.map((c) => c.productHandle));
    // Même suite que le choix d'une pièce : type posé pour la page Surfaces
    sessionStorage.removeItem('colibri-edit-piece-id');
    sessionStorage.setItem('colibri-temp-piece-type', entree.piece);
    setCouleursArrivee(couleurs.slice(0, MAX_TEINTES_ARRIVEE));
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

          <div>
            <p className="text-sm text-gray-500 mb-3">
              {couleurs.length > 1 ? `Vos ${couleurs.length} teintes` : 'Votre teinte'}
              {finition && <> · finition <span className="uppercase">{finition}</span> pour les murs</>}
            </p>
            <ul className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {couleurs.map((couleur, index) => (
                <li
                  key={couleur.productHandle}
                  className={`rounded-lg border-2 p-3 bg-white ${index < MAX_TEINTES_ARRIVEE ? 'border-gray-200' : 'border-dashed border-gray-200 opacity-70'}`}
                >
                  <div
                    className="w-full h-20 rounded-md mb-2 border border-gray-100"
                    style={{ backgroundColor: couleur.codeHex || '#fff' }}
                  >
                    {couleur.imageUrl && (
                      <img src={couleur.imageUrl} alt="" className="w-full h-full object-cover rounded-md" />
                    )}
                  </div>
                  <p className="text-xs font-medium text-gray-900 line-clamp-2">
                    {couleur.titre.replace(' - Peinture biosourcée murs et plafonds', '')}
                  </p>
                  {index < MAX_TEINTES_ARRIVEE && (
                    <p className="text-[10px] uppercase tracking-widest text-primary-500 font-bold mt-1">
                      Mur {index + 1}
                    </p>
                  )}
                </li>
              ))}
            </ul>
            {couleurs.length > MAX_TEINTES_ARRIVEE && (
              <p className="text-xs text-gray-500 mt-3">
                Une pièce compte au plus {MAX_TEINTES_ARRIVEE} murs&nbsp;: les autres teintes restent
                disponibles dans le choix des couleurs (« Vos teintes essayées »).
              </p>
            )}
          </div>
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
