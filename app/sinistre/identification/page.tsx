	'use client';

	import { useState, useEffect, useCallback } from 'react';
	import { useRouter } from 'next/navigation';
	import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
	import { Input } from '@/components/ui/Input';
	import { Select } from '@/components/ui/Select';
	import { Button } from '@/components/ui/Button';
	import { StepIndicator, SINISTRE_STEPS } from '@/components/ui/StepIndicator';
	import { useStepperNavigation } from '@/hooks/useStepperNavigation';
	import { isValidEmail, isValidPhone } from '@/lib/utils';
	import { STORAGE_KEYS, initialAssure } from '@/lib/store/sinistreStore';
	import type { Assure } from '@/lib/types';

	// Options de civilité
	const CIVILITE_OPTIONS = [
	  { value: 'M', label: 'Monsieur' },
	  { value: 'Mme', label: 'Madame' },
	];

		// Options d'assureur
		const ASSUREUR_OPTIONS = [
		  { value: '', label: 'Sélectionner votre assureur' }, // Option vide pour l'affichage initial
		  { value: 'MAAF', label: 'MAAF' },
		  { value: 'MMA', label: 'MMA' },
		  { value: 'GMF', label: 'GMF' },
		  { value: 'BPCE', label: 'BPCE' },
		  { value: 'Karma', label: 'Karma' },
		];

	export default function IdentificationPage() {
	  const router = useRouter();
	  const { handleStepClick, isStepDisabled } = useStepperNavigation();
	  const [isLoaded, setIsLoaded] = useState(false);
	  const [formData, setFormData] = useState<Assure>(initialAssure);
	  const [errors, setErrors] = useState<Partial<Record<keyof Assure, string>>>({});
	  const [touched, setTouched] = useState<Partial<Record<keyof Assure, boolean>>>({});
	  const [isSubmitting, setIsSubmitting] = useState(false);
		  const [submitError, setSubmitError] = useState<string | null>(null);
		  const isAssureurSelected = formData.assureur && formData.assureur.trim() !== '';

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
	      case 'assureur':
	        if (!value.trim()) return 'L\'assureur est obligatoire';
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
	    const requiredFields: (keyof Assure)[] = ['nom', 'prenom', 'email', 'telephone', 'assureur'];
	    
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
	      assureur: true,
	    });

	    return Object.keys(newErrors).length === 0;
	  };

	  // Créer un client Shopify
	  const createShopifyCustomer = async () => {
	    try {
	      const response = await fetch('/api/shopify/customer', {
	        method: 'POST',
	        headers: {
	          'Content-Type': 'application/json',
	        },
	        body: JSON.stringify({
	          firstName: formData.prenom,
	          lastName: formData.nom,
	          email: formData.email,
	          phone: formData.telephone,
	          address: formData.adresse,
	          city: formData.ville,
	          postalCode: formData.codePostal,
	        }),
	      });

	      if (!response.ok) {
	        const error = await response.json();
	        console.error('Failed to create customer:', error);
	        // Ne pas bloquer le flux si la création échoue
	        console.warn('Customer creation failed, continuing anyway');
	      } else {
	        const data = await response.json();
	        console.log('Customer created successfully:', data);
	        // Sauvegarder le customerId si nécessaire pour plus tard
	        if (data.customerId) {
	          localStorage.setItem('shopify_customer_id', data.customerId);
	        }
	      }
	    } catch (error) {
	      console.error('Error creating customer:', error);
	      // Ne pas bloquer le flux si la création échoue
	      console.warn('Customer creation error, continuing anyway');
	    }
	  };

	  // Soumettre le formulaire
	  const handleSubmit = async (e: React.FormEvent) => {
	    e.preventDefault();
	    
	    if (validateForm()) {
	      setIsSubmitting(true);
	      setSubmitError(null);
	      
	      try {
	        // Créer le client Shopify (asynchrone mais non-bloquant)
	        await createShopifyCustomer();
	        
	        // Continuer vers l'étape suivante
	        router.push('/sinistre/piece');
	      } catch (error) {
	        console.error('Unexpected error:', error);
	        setSubmitError('Une erreur est survenue. Veuillez réessayer.');
	        setIsSubmitting(false);
	      }
	    }
	  };

	  // Vérifier si le formulaire est valide pour activer le bouton
	  const isFormValid = 
	    formData.nom.trim() !== '' &&
	    formData.prenom.trim() !== '' &&
	    isValidEmail(formData.email) &&
	    isValidPhone(formData.telephone) &&
	    formData.assureur && formData.assureur.trim() !== '' &&
	    !isSubmitting;

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
	      <StepIndicator 
	        steps={SINISTRE_STEPS} 
	        currentStep={1} 
	        onStepClick={handleStepClick}
	        isStepDisabled={isStepDisabled}
	      />

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

	            {/* Assureur */}
	            <Select
	              label="Assureur"
	              options={ASSUREUR_OPTIONS}
	              value={formData.assureur || ''}
	              onChange={(e) => handleChange('assureur', e.target.value)}
	              onBlur={() => handleBlur('assureur')}
		              error={errors.assureur}
		              required
		            />
		            {isAssureurSelected && (
		              <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
		                Félicitations ! Grâce à <b>{formData.assureur}</b>, vous bénéficiez de 15% de remise sur votre projet.
		              </div>
		            )}

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

	            {/* Error message */}
	            {submitError && (
	              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
	                <p className="text-sm text-red-700">{submitError}</p>
	              </div>
	            )}

	            {/* Submit button */}
	            <div className="flex justify-end pt-4">
	              <Button
	                type="submit"
	                size="lg"
	                disabled={!isFormValid}
	                className="w-full sm:w-auto"
	              >
	                {isSubmitting ? 'Traitement...' : 'Suivant →'}
	              </Button>
	            </div>
	          </form>
	        </CardContent>
	      </Card>

	      {/* Info box */}
	      <div className="bg-primary-50 border border-primary-100 rounded-xl p-6">
	        <div className="flex gap-4">
	          <div className="flex-shrink-0">
	            <svg className="h-6 w-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
	              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
	            </svg>
	          </div>
	          <div>
	            <h4 className="text-sm font-serif font-bold text-primary-700">Vos données sont protégées</h4>
	            <p className="text-sm text-primary-600/80 mt-1 leading-relaxed">
	              Vos informations sont utilisées uniquement pour le traitement de votre sinistre 
	              et ne seront pas partagées avec des tiers.
	            </p>
	          </div>
	        </div>
	      </div>
	    </div>
	  );
	}
