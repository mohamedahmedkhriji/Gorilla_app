import React, { useState } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

interface FirstNameScreenProps {
  onNext: () => void;
  onDataChange?: (data: Record<string, unknown>) => void;
  onboardingData?: {
    firstName?: string;
    name?: string;
  };
}

export function FirstNameScreen({ onNext, onDataChange, onboardingData }: FirstNameScreenProps) {
  const [firstName, setFirstName] = useState(
    String(onboardingData?.firstName || onboardingData?.name || '').trim(),
  );

  const trimmedName = firstName.trim();
  const canContinue = trimmedName.length > 0;

  const persistName = (value: string) => {
    const trimmed = value.trim();
    onDataChange?.({
      firstName: trimmed,
      name: trimmed,
    });
  };

  return (
    <div className="flex-1 flex flex-col space-y-8">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => {
            setFirstName('');
            persistName('');
            onNext();
          }}
          className="rounded-xl px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary border border-white/10 bg-white/5 hover:bg-white/10 transition-colors"
        >
          Skip
        </button>
      </div>

      <div className="space-y-2 text-center">
        <p className="text-sm text-text-tertiary">Let&apos;s get started!</p>
        <h2 className="text-2xl font-light text-white">What would you like us to call you?</h2>
      </div>

      <Input
        label="First name"
        placeholder="Your name"
        value={firstName}
        onChange={(event) => {
          const nextValue = event.target.value;
          setFirstName(nextValue);
          persistName(nextValue);
        }}
        required
      />

      <div className="flex-1" />

      <Button onClick={() => canContinue && onNext()} disabled={!canContinue}>
        Next
      </Button>
    </div>
  );
}
