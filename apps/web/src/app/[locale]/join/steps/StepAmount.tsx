'use client';

/**
 * StepAmount — Contribution amount selection step in the join flow.
 *
 * Shows preset amounts and allows custom input.
 * Displays tier preview as amount changes.
 */

import type { ReactElement } from 'react';
import { useState, useCallback } from 'react';

interface StepAmountTranslations {
  title: string;
  description: string;
  amountLabel: string;
  minimum: string;
  custom: string;
  placeholder: string;
  back: string;
  next: string;
}

export interface PresetAmount {
  label: string;
  cents: number;
}

export interface StepAmountProps {
  translations: StepAmountTranslations;
  amountCents: number;
  presetAmounts: PresetAmount[];
  onAmountChange: (cents: number) => void;
  onNext: () => void;
  onBack: () => void;
}

export function StepAmount({
  translations: t,
  amountCents,
  presetAmounts,
  onAmountChange,
  onNext,
  onBack,
}: StepAmountProps): ReactElement {
  const [isCustom, setIsCustom] = useState(false);
  const [customInput, setCustomInput] = useState('');

  // Check if current amount matches a preset
  const selectedPreset = presetAmounts.find((p) => p.cents === amountCents);

  const handlePresetSelect = useCallback(
    (cents: number) => {
      setIsCustom(false);
      setCustomInput('');
      onAmountChange(cents);
    },
    [onAmountChange]
  );

  const handleCustomToggle = useCallback(() => {
    setIsCustom(true);
    setCustomInput((amountCents / 100).toString());
  }, [amountCents]);

  const handleCustomChange = useCallback(
    (value: string) => {
      setCustomInput(value);

      // Parse as dollars, convert to cents
      const dollars = parseFloat(value);
      if (!isNaN(dollars) && dollars >= 0) {
        onAmountChange(Math.round(dollars * 100));
      }
    },
    [onAmountChange]
  );

  return (
    <div className="rounded-container border border-[var(--border-default)] bg-[var(--bg-surface-nested)] p-8">
      <h2 className="mb-2 font-display text-xl font-medium text-[var(--fg-primary)]">{t.title}</h2>
      <p className="mb-8 text-[var(--fg-secondary)]">{t.description}</p>

      <div className="space-y-6">
        {/* Amount label */}
        <div>
          <label className="mb-2 block text-sm font-medium text-[var(--fg-secondary)]">
            {t.amountLabel}
          </label>
          <p className="text-xs text-[var(--fg-tertiary)]">{t.minimum}</p>
        </div>

        {/* Preset amounts */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {presetAmounts.map((preset) => {
            const isSelected = !isCustom && selectedPreset?.cents === preset.cents;
            return (
              <button
                key={preset.cents}
                type="button"
                onClick={() => handlePresetSelect(preset.cents)}
                className={`rounded-nested border px-4 py-3 text-center font-medium transition-all ${
                  isSelected
                    ? 'bg-[var(--color-firefly-gold)]/10 border-[var(--color-firefly-gold)] text-[var(--color-firefly-gold)]'
                    : 'border-[var(--border-default)] text-[var(--fg-primary)] hover:border-[var(--border-emphasis)]'
                }`}
              >
                {preset.label}
              </button>
            );
          })}
        </div>

        {/* Custom amount */}
        <div>
          <button
            type="button"
            onClick={handleCustomToggle}
            className={`mb-3 text-sm ${
              isCustom
                ? 'text-[var(--color-firefly-gold)]'
                : 'text-[var(--fg-tertiary)] hover:text-[var(--fg-secondary)]'
            }`}
          >
            {t.custom}
          </button>

          {isCustom && (
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--fg-secondary)]">
                $
              </span>
              <input
                type="number"
                min="5"
                step="1"
                value={customInput}
                onChange={(e) => handleCustomChange(e.target.value)}
                placeholder={t.placeholder}
                className="w-full rounded-nested border border-[var(--border-default)] bg-[var(--bg-surface-container)] py-3 pl-8 pr-4 text-[var(--fg-primary)] placeholder:text-[var(--fg-tertiary)] focus:border-[var(--color-firefly-gold)] focus:outline-none"
              />
            </div>
          )}
        </div>

        {/* Current selection display */}
        <div className="rounded-nested bg-[var(--bg-surface-container)] p-4 text-center">
          <p className="text-sm text-[var(--fg-tertiary)]">Your contribution</p>
          <p className="font-display text-3xl font-medium text-[var(--fg-primary)]">
            ${(amountCents / 100).toFixed(2)}
          </p>
        </div>

        {/* Actions */}
        <div className="flex justify-between">
          <button
            type="button"
            onClick={onBack}
            className="rounded-nested border border-[var(--border-default)] px-4 py-2 text-sm text-[var(--fg-secondary)] transition-colors hover:border-[var(--border-emphasis)] hover:text-[var(--fg-primary)]"
          >
            {t.back}
          </button>
          <button
            type="button"
            onClick={onNext}
            className="rounded-nested bg-[var(--color-firefly-gold)] px-6 py-2 font-medium text-black transition-opacity hover:opacity-90"
          >
            {t.next}
          </button>
        </div>
      </div>
    </div>
  );
}
