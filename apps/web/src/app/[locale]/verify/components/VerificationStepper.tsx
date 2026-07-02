'use client';

/**
 * VerificationStepper — Progress indicator for verification flow.
 */

interface VerificationStepperProps {
  steps: readonly string[];
  currentStep: string;
  stepTitles: Record<string, string>;
}

export function VerificationStepper({
  steps,
  currentStep,
  stepTitles,
}: VerificationStepperProps): React.ReactElement {
  const currentIndex = steps.indexOf(currentStep);

  return (
    <nav aria-label="Verification progress" className="mb-8">
      <ol className="flex items-center justify-between">
        {steps.map((step, index) => {
          const isComplete = index < currentIndex;
          const isCurrent = index === currentIndex;
          const title = stepTitles[step] ?? step;

          return (
            <li key={step} className="flex flex-1 items-center">
              {/* Step indicator */}
              <div className="flex flex-col items-center">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm font-medium transition-colors ${
                    isComplete
                      ? 'border-[var(--accent)] bg-[var(--accent)] text-black'
                      : isCurrent
                        ? 'border-[var(--accent)] bg-transparent text-[var(--accent)]'
                        : 'border-[var(--border-default)] bg-transparent text-[var(--fg-tertiary)]'
                  }`}
                  aria-current={isCurrent ? 'step' : undefined}
                >
                  {isComplete ? (
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={3}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    index + 1
                  )}
                </div>
                <span
                  className={`mt-2 text-xs ${
                    isCurrent ? 'font-medium text-[var(--fg-primary)]' : 'text-[var(--fg-tertiary)]'
                  }`}
                >
                  {title}
                </span>
              </div>

              {/* Connector line */}
              {index < steps.length - 1 && (
                <div
                  className={`mx-2 h-0.5 flex-1 ${
                    index < currentIndex ? 'bg-[var(--accent)]' : 'bg-[var(--border-default)]'
                  }`}
                  aria-hidden="true"
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
