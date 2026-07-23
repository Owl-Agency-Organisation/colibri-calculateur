'use client';

import { useEffect, useRef, useState } from 'react';

interface InfoTooltipProps {
  text: string;
  /** Libellé accessible du bouton (lecteurs d'écran) */
  ariaLabel?: string;
}

/**
 * Infobulle informative : icône ⓘ qui révèle un texte court au survol,
 * au focus clavier ou au clic/tap (mobile). Fermeture au clic extérieur.
 */
export function InfoTooltip({ text, ariaLabel = 'Plus d’informations' }: InfoTooltipProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleOutsideClick = (event: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('touchstart', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, [open]);

  return (
    <span ref={containerRef} className="relative inline-flex align-middle">
      <button
        type="button"
        aria-label={ariaLabel}
        aria-expanded={open}
        onClick={(e) => {
          // Les badges finition vivent parfois dans des zones cliquables :
          // le clic sur l'infobulle ne doit pas les déclencher.
          e.stopPropagation();
          setOpen(o => !o);
        }}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className="inline-flex items-center justify-center w-4 h-4 rounded-full text-gray-400 hover:text-primary-600 focus:text-primary-600 focus:outline-none transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </button>

      {open && (
        <span
          role="tooltip"
          className="absolute z-30 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 rounded-lg bg-gray-900 text-white text-xs leading-relaxed p-3 shadow-lg text-left normal-case font-normal tracking-normal whitespace-normal"
        >
          {text}
        </span>
      )}
    </span>
  );
}

/**
 * Texte factuel de la règle de finition automatique. La personnalisation des
 * finitions n'est pas proposée : ne rien promettre ici, renvoyer au téléphone.
 */
export const TOOLTIP_FINITION =
  'La finition est choisie automatiquement selon la pièce : velours pour les murs ' +
  'des pièces de vie et chambres, satin pour les pièces d’eau, mat pour les ' +
  'plafonds (sauf salle de bains, en satin). Une question ? Appelez-nous au 05 62 14 16 46.';
