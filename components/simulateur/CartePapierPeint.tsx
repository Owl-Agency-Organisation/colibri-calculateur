'use client';

import { libellePapierPeint, type PapierPeint } from '@/lib/papierPeint';
import { redirectTop } from '@/lib/navigation';

/**
 * Carte d'un papier peint essayé dans le simulateur : image de la variante,
 * « {Motif}, {Coloris} », « Voir la fiche ». Un papier peint ne se calcule
 * pas : la fiche s'ouvre dans la fenêtre principale (l'app tourne dans une
 * iframe), où le client le commande.
 */
export function CartePapierPeint({ papierPeint }: { papierPeint: PapierPeint }) {
  const libelle = libellePapierPeint(papierPeint.motif, papierPeint.coloris);
  return (
    <li className="rounded-lg border-2 border-gray-200 p-3 bg-white flex flex-col">
      <div className="w-full h-20 rounded-md mb-2 border border-gray-100 bg-gray-50">
        {papierPeint.imageUrl && (
          <img src={papierPeint.imageUrl} alt="" className="w-full h-full object-cover rounded-md" />
        )}
      </div>
      <p className="text-xs font-medium text-gray-900 line-clamp-2">{libelle}</p>
      <button
        type="button"
        onClick={() => redirectTop(papierPeint.lien)}
        className="mt-2 text-left text-xs font-medium text-primary-500 underline underline-offset-2 hover:text-primary-600"
      >
        Voir la fiche
      </button>
    </li>
  );
}
