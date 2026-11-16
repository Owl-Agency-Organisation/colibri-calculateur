'use client';

import { useId, useMemo, useState, type KeyboardEvent } from 'react';
import {
  LONGUEUR_MIN_RECHERCHE,
  rechercherTeintes,
  vignette,
  type TeinteIndex,
} from '@/lib/rechercheTeintes';

/**
 * Index chargé une seule fois par visite (partagé entre les ouvertures de la
 * popup) ; oublié en cas d'erreur pour pouvoir réessayer.
 */
let indexEnCours: Promise<TeinteIndex[]> | null = null;

function chargerIndex(): Promise<TeinteIndex[]> {
  if (!indexEnCours) {
    indexEnCours = fetch('/api/shopify/teintes')
      .then(async (reponse) => {
        if (!reponse.ok) throw new Error(`teintes : HTTP ${reponse.status}`);
        const { teintes }: { teintes: TeinteIndex[] } = await reponse.json();
        return teintes;
      })
      .catch((erreur: unknown) => {
        indexEnCours = null;
        throw erreur;
      });
  }
  return indexEnCours;
}

interface RechercheTeintesProps {
  /** Finition recommandée de la surface : même filtre que la liste des familles */
  targetFinition?: string;
  onChoisir: (teinte: TeinteIndex) => void;
}

/**
 * Champ de recherche par nom de teinte, avec suggestions au fil de la saisie
 * (toutes familles confondues). Les suggestions restent dans le flux de la
 * page : dans l'iframe de la boutique, un élément superposé risquerait d'être
 * rogné.
 */
export function RechercheTeintes({ targetFinition, onChoisir }: RechercheTeintesProps) {
  const [saisie, setSaisie] = useState('');
  const [index, setIndex] = useState<TeinteIndex[] | null>(null);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState(false);
  const [actif, setActif] = useState(-1);
  const idListe = useId();

  const assezLong = saisie.trim().length >= LONGUEUR_MIN_RECHERCHE;
  const suggestions = useMemo(
    () => (index ? rechercherTeintes(index, saisie, { targetFinition }) : []),
    [index, saisie, targetFinition]
  );
  const ouverte = assezLong && index !== null && suggestions.length > 0;

  const preparer = () => {
    if (index || chargement) return;
    setChargement(true);
    setErreur(false);
    chargerIndex()
      .then(setIndex)
      .catch((err: unknown) => {
        console.error('Impossible de charger les teintes pour la recherche', err);
        setErreur(true);
      })
      .finally(() => setChargement(false));
  };

  const choisir = (teinte: TeinteIndex) => {
    setSaisie('');
    setActif(-1);
    onChoisir(teinte);
  };

  const auClavier = (evenement: KeyboardEvent<HTMLInputElement>) => {
    if (evenement.key === 'ArrowDown' && ouverte) {
      evenement.preventDefault();
      setActif((i) => (i + 1) % suggestions.length);
    } else if (evenement.key === 'ArrowUp' && ouverte) {
      evenement.preventDefault();
      setActif((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (evenement.key === 'Enter' && ouverte) {
      evenement.preventDefault();
      choisir(suggestions[actif >= 0 ? actif : 0]);
    } else if (evenement.key === 'Escape' && saisie) {
      // La popup ne se ferme pas : seule la saisie est effacée
      evenement.stopPropagation();
      setSaisie('');
      setActif(-1);
    }
  };

  return (
    <div className="mb-6">
      <label htmlFor={`${idListe}-champ`} className="sr-only">
        Rechercher une teinte
      </label>
      <div className="relative">
        <svg
          className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 10.5a6.5 6.5 0 11-13 0 6.5 6.5 0 0113 0z" />
        </svg>
        <input
          id={`${idListe}-champ`}
          type="search"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={ouverte}
          aria-controls={idListe}
          aria-activedescendant={ouverte && actif >= 0 ? `${idListe}-${actif}` : undefined}
          autoComplete="off"
          enterKeyHint="search"
          placeholder="Rechercher une teinte par son nom"
          value={saisie}
          onFocus={preparer}
          onChange={(e) => {
            setSaisie(e.target.value);
            setActif(-1);
            preparer();
          }}
          onKeyDown={auClavier}
          className="w-full rounded-lg border border-gray-300 bg-white py-3 pl-10 pr-4 text-base text-gray-900 placeholder:text-gray-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
        />
      </div>

      {assezLong && (
        <div className="mt-2" aria-live="polite">
          {chargement && !index && (
            <p className="px-1 py-2 text-sm text-gray-500">Chargement des teintes…</p>
          )}
          {erreur && !index && (
            <p className="px-1 py-2 text-sm text-red-700">
              La recherche est indisponible pour le moment. Choisissez une famille ci-dessous.
            </p>
          )}
          {index && suggestions.length === 0 && (
            <p className="px-1 py-2 text-sm text-gray-500">
              Aucune teinte ne correspond à «&nbsp;{saisie.trim()}&nbsp;».
            </p>
          )}
          {ouverte && (
            <ul
              id={idListe}
              role="listbox"
              aria-label="Teintes suggérées"
              className="divide-y divide-gray-100 overflow-hidden rounded-lg border border-gray-200 bg-white"
            >
              {suggestions.map((teinte, i) => (
                <li
                  key={teinte.handle}
                  id={`${idListe}-${i}`}
                  role="option"
                  aria-selected={i === actif}
                  onClick={() => choisir(teinte)}
                  onMouseEnter={() => setActif(i)}
                  className={`flex cursor-pointer items-center gap-3 px-3 py-2 ${i === actif ? 'bg-primary-50' : 'hover:bg-gray-50'}`}
                >
                  {teinte.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={vignette(teinte.imageUrl, 96)}
                      alt=""
                      className="h-10 w-10 flex-none rounded-md object-cover"
                    />
                  ) : (
                    <span className="h-10 w-10 flex-none rounded-md bg-gray-100" aria-hidden="true" />
                  )}
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-gray-900">{teinte.nom}</span>
                    <span className="block truncate text-xs text-gray-500">{teinte.collection}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
