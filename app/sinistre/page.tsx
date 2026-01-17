'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { StepIndicator, SINISTRE_STEPS } from '@/components/ui/StepIndicator';
import { isValidEmail, isValidPhone } from '@/lib/utils';
import { STORAGE_KEYS, initialAssure } from '@/lib/store/sinistreStore';
import type { Assure } from '@/lib/types';

// Options de civilité
const CIVILITE_OPTIONS = [
  { value: 'M', label: 'Monsieur' },
  { value: 'Mme', label: 'Madame' },
];

export default function IdentificationPage() {
  const router = useRouter();
  const [isLoaded, setIsLoaded] = useState(false);
  const [formData, setFormData] = useState<Assure>(initialAssure);
  const [errors, setErrors] = useState<Partial<Record<keyof Assure, string>>>({});
  const [touched, setTouched] = useState<Partial<Record<keyof Assure, boolean>>>({});

  // Charger les données depuis localStorage au montage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.ASSURE);
      if (stored) {
        setFormData(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Error loading stored data:', error);
    }
    setIsLoaded(true);
  }, []);

  // Sauvegarder dans localStorage à chaque modification
  useEffect(() => {
    if (isLoaded) {
      try {
        localStorage.setItem(STORAGE_KEYS.ASSURE, JSON.stringify(formData));
      } catch (error) {
        console.error('Error saving data:', error);
      }
    }
  }, [formData, isLoaded]);

  // Validation des champs
  const validateField = useCallback((name: keyof Assure, value: string): string => {
    switch (name) {
      case 'email':
        if (!value.trim()) return 'L\'email est obligatoire';
        if (!isValidEmail(value)) return 'Format d\'email invalide';
        return '';
      case 'telephone':
        if (!value.trim()) return 'Le téléphone est obligatoire';
        if (!isValidPhone(value)) return 'Format de téléphone invalide (ex: 06 12 34 56 78)';
        return '';
      case 'nom':
        if (!value.trim()) return 'Le nom est obligatoire';
        return '';
      case 'prenom':
        if (!value.trim()) return 'Le prénom est obligatoire';
        return '';
      default:
        return '';
    }
  }, []);

  // Gérer les changements de champs
  const handleChange = (name: keyof Assure, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Valider si le champ a déjà été touché
    if (touched[name]) {
      const error = validateField(name, value);
      setErrors(prev => ({ ...prev, [name]: error }));
    }
  };

  // Gérer le blur (perte de focus)
  const handleBlur = (name: keyof Assure) => {
    setTouched(prev => ({ ...prev, [name]: true }));
    const error = validateField(name, formData[name] || '');
    setErrors(prev => ({ ...prev, [name]: error }));
  };

  // Valider tout le formulaire
  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof Assure, string>> = {};
    const requiredFields: (keyof Assure)[] = ['nom', 'prenom', 'email', 'telephone'];
    
    requiredFields.forEach(field => {
      const error = validateField(field, formData[field] || '');
      if (error) newErrors[field] = error;
    });

    setErrors(newErrors);
    setTouched({
      nom: true,
      prenom: true,
      email: true,
      telephone: true,
    });

    return Object.keys(newErrors).length === 0;
  };

  // Soumettre le formulaire
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (validateForm()) {
      router.push('/sinistre/piece');
    }
  };

  // Vérifier si le formulaire est valide pour activer le bouton
  const isFormValid = 
    formData.nom.trim() !== '' &&
    formData.prenom.trim() !== '' &&
    isValidEmail(formData.email) &&
    isValidPhone(formData.telephone);

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <StepIndicator steps={SINISTRE_STEPS} currentStep={1} />

      {/* Form card */}
      <Card>
        <CardHeader>
          <CardTitle>Identification de l'assuré</CardTitle>
          <p className="text-sm text-gray-500 mt-1">
            Renseignez vos coordonnées pour commencer le calcul de peinture
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Civilité */}
            <Select
              label="Civilité"
              options={CIVILITE_OPTIONS}
              value={formData.civilite}
              onChange={(e) => handleChange('civilite', e.target.value as 'M' | 'Mme')}
            />

            {/* Nom et Prénom */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Nom"
                type="text"
                required
                value={formData.nom}
                onChange={(e) => handleChange('nom', e.target.value)}
                onBlur={() => handleBlur('nom')}
                error={errors.nom}
                placeholder="Dupont"
              />
              <Input
                label="Prénom"
                type="text"
                required
                value={formData.prenom}
                onChange={(e) => handleChange('prenom', e.target.value)}
                onBlur={() => handleBlur('prenom')}
                error={errors.prenom}
                placeholder="Jean"
              />
            </div>

            {/* Email */}
            <Input
              label="Email"
              type="email"
              required
              value={formData.email}
              onChange={(e) => handleChange('email', e.target.value)}
              onBlur={() => handleBlur('email')}
              error={errors.email}
              placeholder="jean.dupont@exemple.fr"
            />

            {/* Téléphone */}
            <Input
              label="Téléphone"
              type="tel"
              required
              value={formData.telephone}
              onChange={(e) => handleChange('telephone', e.target.value)}
              onBlur={() => handleBlur('telephone')}
              error={errors.telephone}
              placeholder="06 12 34 56 78"
            />

            {/* Adresse (optionnelle) */}
            <div className="border-t border-gray-200 pt-6 mt-6">
              <p className="text-sm text-gray-500 mb-4">Adresse (optionnel)</p>
              
              <Input
                label="Adresse"
                type="text"
                value={formData.adresse || ''}
                onChange={(e) => handleChange('adresse', e.target.value)}
                placeholder="123 rue de la Paix"
                className="mb-4"
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Code postal"
                  type="text"
                  value={formData.codePostal || ''}
                  onChange={(e) => handleChange('codePostal', e.target.value)}
                  placeholder="75001"
                  maxLength={5}
                />
                <Input
                  label="Ville"
                  type="text"
                  value={formData.ville || ''}
                  onChange={(e) => handleChange('ville', e.target.value)}
                  placeholder="Paris"
                />
              </div>
            </div>

            {/* Submit button */}
            <div className="flex justify-end pt-4">
              <Button
                type="submit"
                size="lg"
                disabled={!isFormValid}
                className="w-full sm:w-auto"
              >
                Suivant →
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Info box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex gap-3">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div>
            <h4 className="text-sm font-medium text-blue-800">Vos données sont protégées</h4>
            <p className="text-sm text-blue-700 mt-1">
              Vos informations sont utilisées uniquement pour le traitement de votre sinistre 
              et ne seront pas partagées avec des tiers.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
