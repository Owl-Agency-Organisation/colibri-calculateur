'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { isValidEmail, isValidPhone } from '@/lib/utils';
import { getStoredClient, setStoredClient } from '@/lib/store/projetStore';

const POLITIQUE_CONFIDENTIALITE_URL =
  'https://www.colibripeinture.com/policies/privacy-policy';

interface EstimationModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Lignes du panier Shopify à reprendre dans le draft order */
  lineItems: Array<{ variantId: string; quantity: number }>;
  /** Contexte projet, repris dans les relances Klaviyo (informatif) */
  projet?: { surfaceTotale: number; nombrePieces: number };
  /** Appelé après envoi réussi de l'estimation */
  onSuccess: () => void;
}

interface FormState {
  email: string;
  prenom: string;
  nom: string;
  telephone: string;
}

const emptyForm: FormState = { email: '', prenom: '', nom: '', telephone: '' };

export function EstimationModal({ isOpen, onClose, lineItems, projet, onSuccess }: EstimationModalProps) {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [consentement, setConsentement] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Pré-remplir avec les coordonnées d'une estimation précédente
  useEffect(() => {
    if (isOpen) {
      const stored = getStoredClient();
      if (stored) {
        setForm({
          email: stored.email,
          prenom: stored.prenom || '',
          nom: stored.nom || '',
          telephone: stored.telephone || '',
        });
      }
      setErrors({});
      setSubmitError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleChange = (name: keyof FormState, value: string) => {
    setForm(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: undefined }));
    }
  };

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof FormState, string>> = {};

    if (!form.email.trim()) {
      newErrors.email = "L'e-mail est obligatoire";
    } else if (!isValidEmail(form.email.trim())) {
      newErrors.email = "Format d'e-mail invalide";
    }

    if (form.telephone.trim() && !isValidPhone(form.telephone.trim())) {
      newErrors.telephone = 'Format de téléphone invalide (ex : 06 12 34 56 78)';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const response = await fetch('/api/calculateur/estimation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.email.trim(),
          prenom: form.prenom.trim() || undefined,
          nom: form.nom.trim() || undefined,
          telephone: form.telephone.trim() || undefined,
          consentementMarketing: consentement,
          lineItems,
          projet,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Impossible d'envoyer l'estimation. Merci de réessayer.");
      }

      // Mémoriser les coordonnées pour pré-remplir la modale et le checkout
      setStoredClient({
        email: form.email.trim(),
        prenom: form.prenom.trim() || undefined,
        nom: form.nom.trim() || undefined,
        telephone: form.telephone.trim() || undefined,
      });

      onSuccess();
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : 'Une erreur est survenue. Merci de réessayer.'
      );
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={() => !isSubmitting && onClose()}
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-1">
            Recevoir mon estimation par e-mail
          </h3>
          <p className="text-sm text-gray-600 mb-5">
            Recevez le détail de votre projet avec la remise de 15 % déjà appliquée,
            et commandez quand vous êtes prêt.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="E-mail"
              type="email"
              required
              value={form.email}
              onChange={(e) => handleChange('email', e.target.value)}
              error={errors.email}
              placeholder="jean.dupont@exemple.fr"
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Prénom (optionnel)"
                type="text"
                value={form.prenom}
                onChange={(e) => handleChange('prenom', e.target.value)}
                placeholder="Jean"
              />
              <Input
                label="Nom (optionnel)"
                type="text"
                value={form.nom}
                onChange={(e) => handleChange('nom', e.target.value)}
                placeholder="Dupont"
              />
            </div>

            <Input
              label="Téléphone (optionnel)"
              type="tel"
              value={form.telephone}
              onChange={(e) => handleChange('telephone', e.target.value)}
              error={errors.telephone}
              placeholder="06 12 34 56 78"
            />

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={consentement}
                onChange={(e) => setConsentement(e.target.checked)}
                className="w-4 h-4 mt-1 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-xs text-gray-600 leading-relaxed">
                J&apos;accepte de recevoir des conseils et offres de Colibri Peinture par
                e-mail. Voir notre{' '}
                <a
                  href={POLITIQUE_CONFIDENTIALITE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary-600 underline hover:text-primary-700"
                >
                  politique de confidentialité
                </a>
                .
              </span>
            </label>

            {submitError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm text-red-700">{submitError}</p>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={onClose}
                disabled={isSubmitting}
              >
                Annuler
              </Button>
              <Button type="submit" className="flex-1" disabled={isSubmitting}>
                {isSubmitting ? 'Envoi en cours...' : 'Recevoir mon estimation'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
