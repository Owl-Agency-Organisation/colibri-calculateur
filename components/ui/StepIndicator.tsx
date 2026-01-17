import { cn } from '@/lib/utils';

interface Step {
  id: number;
  title: string;
}

interface StepIndicatorProps {
  steps: Step[];
  currentStep: number;
  className?: string;
}

export function StepIndicator({ steps, currentStep, className }: StepIndicatorProps) {
  return (
    <div className={cn('w-full', className)}>
      {/* Mobile: Simple text indicator */}
      <div className="sm:hidden text-center mb-4">
        <span className="text-sm text-gray-500">
          Étape {currentStep} sur {steps.length}
        </span>
        <p className="text-lg font-medium text-gray-900">
          {steps.find(s => s.id === currentStep)?.title}
        </p>
      </div>

      {/* Desktop: Full step indicator */}
      <div className="hidden sm:flex items-center justify-between">
        {steps.map((step, index) => (
          <div key={step.id} className="flex items-center flex-1">
            {/* Step circle */}
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors',
                  step.id < currentStep
                    ? 'bg-primary-600 text-white'
                    : step.id === currentStep
                    ? 'bg-primary-600 text-white ring-4 ring-primary-100'
                    : 'bg-gray-200 text-gray-500'
                )}
              >
                {step.id < currentStep ? (
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                ) : (
                  step.id
                )}
              </div>
              <span
                className={cn(
                  'mt-2 text-xs font-medium text-center max-w-[80px]',
                  step.id <= currentStep ? 'text-primary-600' : 'text-gray-500'
                )}
              >
                {step.title}
              </span>
            </div>

            {/* Connector line */}
            {index < steps.length - 1 && (
              <div
                className={cn(
                  'flex-1 h-0.5 mx-2 mt-[-20px]',
                  step.id < currentStep ? 'bg-primary-600' : 'bg-gray-200'
                )}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// Étapes du parcours sinistre
export const SINISTRE_STEPS: Step[] = [
  { id: 1, title: 'Identification' },
  { id: 2, title: 'Pièce' },
  { id: 3, title: 'Surfaces' },
  { id: 4, title: 'Récapitulatif' },
  { id: 5, title: 'Options' },
  { id: 6, title: 'Panier' },
  { id: 7, title: 'Confirmation' },
];
