import { cn } from '@/lib/utils';

interface Step {
  id: number;
  title: string;
}

interface StepIndicatorProps {
  steps: Step[];
  currentStep: number;
  className?: string;
  onStepClick?: (stepId: number) => void;
  isStepDisabled?: (stepId: number) => boolean;
}

export function StepIndicator({ 
  steps, 
  currentStep, 
  className, 
  onStepClick,
  isStepDisabled = (id) => id > currentStep 
}: StepIndicatorProps) {
  return (
    <div className={cn('w-full', className)}>
      {/* Mobile: Simple text indicator */}
      <div className="sm:hidden text-center mb-4">
        <span className="text-sm text-gray-500">
          Étape {currentStep} sur {steps.length}
        </span>
        <p className="text-lg font-serif font-bold text-primary-600">
          {steps.find(s => s.id === currentStep)?.title}
        </p>
      </div>

      {/* Desktop: Full step indicator */}
      <div className="hidden sm:flex items-center justify-between">
        {steps.map((step, index) => {
          const isDisabled = isStepDisabled(step.id);
          const isCompleted = step.id < currentStep;
          const isCurrent = step.id === currentStep;

          return (
            <div key={step.id} className="flex items-center flex-1">
              {/* Step circle & title container */}
              <button
                type="button"
                disabled={isDisabled}
                onClick={() => !isDisabled && onStepClick?.(step.id)}
                className={cn(
                  "flex flex-col items-center group transition-all",
                  isDisabled ? "cursor-not-allowed" : "cursor-pointer hover:opacity-80"
                )}
              >
                {/* Step circle */}
                <div
                  className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all',
                    isCompleted
                      ? 'bg-primary-600 text-white'
                      : isCurrent
                      ? 'bg-primary-600 text-white ring-4 ring-primary-200'
                      : 'bg-gray-100 text-gray-400',
                    !isDisabled && !isCurrent && "group-hover:ring-4 group-hover:ring-primary-100"
                  )}
                >
                  {isCompleted ? (
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
                    'mt-2 text-[10px] uppercase tracking-wider font-bold text-center max-w-[80px] transition-colors',
                    step.id <= currentStep ? 'text-primary-600' : 'text-gray-400',
                    !isDisabled && !isCurrent && "group-hover:text-primary-500"
                  )}
                >
                  {step.title}
                </span>
              </button>

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
          );
        })}
      </div>
    </div>
  );
}

// Étapes du parcours calculateur
export const CALCULATEUR_STEPS: Step[] = [
  { id: 1, title: 'Identification' },
  { id: 2, title: 'Pièce' },
  { id: 3, title: 'Surfaces' },
  { id: 4, title: 'Récapitulatif' },
  { id: 5, title: 'Options' },
  { id: 6, title: 'Panier' },
  { id: 7, title: 'Confirmation' },
];
