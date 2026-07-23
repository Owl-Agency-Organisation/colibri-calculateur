'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { REGLES_FINITION } from '@/lib/calcul';

/**
 * Textes des infobulles de finition, contextualisés par surface et type de
 * pièce. Centralisés ici : aucune chaîne dupliquée dans les composants.
 * Factuel uniquement — la personnalisation des finitions n'existe pas,
 * ne rien promettre.
 */
export const FINITION_TOOLTIPS = {
  mursVelours:
    'Finition velours : lavable et lessivable, recommandée pour les murs des pièces de vie et chambres.',
  mursSatin:
    "Finition satin : résiste à l'humidité et au nettoyage, idéale pour cuisine, WC et salle de bains.",
  plafondMat:
    'Finition mate : masque les petites irrégularités, idéale pour les plafonds.',
  plafondSatin:
    "Finition satin : obligatoire au plafond des salles de bains, résiste à l'humidité.",
} as const;

/**
 * Texte d'infobulle pour une surface d'un type de pièce donné, dérivé de
 * REGLES_FINITION (source de vérité unique de la règle de finition).
 */
export function getFinitionTooltip(surface: 'murs' | 'plafond', typePiece: string): string {
  const regles = REGLES_FINITION[typePiece];
  if (surface === 'murs') {
    return regles?.murs === 'Satin' ? FINITION_TOOLTIPS.mursSatin : FINITION_TOOLTIPS.mursVelours;
  }
  return regles?.plafond === 'Satin' ? FINITION_TOOLTIPS.plafondSatin : FINITION_TOOLTIPS.plafondMat;
}

interface InfoTooltipProps {
  text: string;
  /** Libellé accessible du bouton (lecteurs d'écran) */
  ariaLabel?: string;
}

/**
 * Infobulle informative : icône ⓘ qui révèle un texte court au survol,
 * au focus clavier ou au clic/tap (mobile). Fermeture au clic extérieur ou
 * au scroll. Positionnée en `fixed` et bornée au viewport : elle ne déborde
 * jamais de l'écran sur mobile (au-dessus de l'icône par défaut, bascule en
 * dessous si la place manque).
 */
export function InfoTooltip({ text, ariaLabel = 'Plus d’informations' }: InfoTooltipProps) {
  const [open, setOpen] = useState(false);
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({ visibility: 'hidden' });
  const containerRef = useRef<HTMLSpanElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const tooltipRef = useRef<HTMLSpanElement>(null);

  // Position calculée après rendu : centrée sur l'icône puis bornée aux marges
  // du viewport ; au-dessus de l'icône, ou en dessous si la place manque.
  useLayoutEffect(() => {
    if (!open) {
      setTooltipStyle({ visibility: 'hidden' });
      return;
    }
    const button = buttonRef.current;
    const tooltip = tooltipRef.current;
    if (!button || !tooltip) return;

    const MARGE = 8;
    const btnRect = button.getBoundingClientRect();
    const tipRect = tooltip.getBoundingClientRect();

    let left = btnRect.left + btnRect.width / 2 - tipRect.width / 2;
    left = Math.max(MARGE, Math.min(left, window.innerWidth - tipRect.width - MARGE));

    let top = btnRect.top - tipRect.height - MARGE;
    if (top < MARGE) {
      top = btnRect.bottom + MARGE;
    }

    setTooltipStyle({ position: 'fixed', top, left, visibility: 'visible' });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const handleOutsideClick = (event: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        close();
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('touchstart', handleOutsideClick);
    // En `fixed`, la position devient fausse au scroll : on ferme simplement
    window.addEventListener('scroll', close, true);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
      window.removeEventListener('scroll', close, true);
    };
  }, [open]);

  return (
    <span ref={containerRef} className="relative inline-flex align-middle">
      <button
        ref={buttonRef}
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
          ref={tooltipRef}
          role="tooltip"
          style={tooltipStyle}
          className="z-30 w-64 max-w-[calc(100vw-16px)] rounded-lg bg-gray-900 text-white text-xs leading-relaxed p-3 shadow-lg text-left normal-case font-normal tracking-normal whitespace-normal"
        >
          {text}
        </span>
      )}
    </span>
  );
}
