import React, { useState } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { getOnboardingLanguage } from './onboardingI18n';

interface FirstNameScreenProps {
  onNext: () => void;
  onDataChange?: (data: Record<string, unknown>) => void;
  onboardingData?: {
    firstName?: string;
    name?: string;
  };
}

const COPY = {
  en: {
    intro: "Let's get started!",
    title: 'What would you like us to call you?',
    label: 'First name',
    placeholder: 'Your name',
    cta: 'Next',
  },
  ar: {
    intro: '\u0644\u0646\u0628\u062f\u0623!',
    title: '\u0628\u0623\u064a \u0627\u0633\u0645 \u062a\u062d\u0628 \u0623\u0646 \u0646\u0646\u0627\u062f\u064a\u0643\u061f',
    label: '\u0627\u0644\u0627\u0633\u0645 \u0627\u0644\u0623\u0648\u0644',
    placeholder: '\u0627\u0633\u0645\u0643',
    cta: '\u0627\u0644\u062a\u0627\u0644\u064a',
  },
  it: {
    intro: 'Iniziamo!',
    title: 'Come vuoi che ti chiamiamo?',
    label: 'Nome',
    placeholder: 'Il tuo nome',
    cta: 'Avanti',
  },
  de: {
    intro: 'Los gehts!',
    title: 'Wie sollen wir dich nennen?',
    label: 'Vorname',
    placeholder: 'Dein Name',
    cta: 'Weiter',
  },
  fr: {
    intro: 'Commencons !',
    title: 'Comment veux-tu que nous t appelions ?',
    label: 'Prenom',
    placeholder: 'Ton prenom',
    cta: 'Suivant',
  },
} as const;

export function FirstNameScreen({ onNext, onDataChange, onboardingData }: FirstNameScreenProps) {
  const language = getOnboardingLanguage();
  const copy = COPY[language as keyof typeof COPY] ?? COPY.en;
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
      <div className="space-y-2 text-center">
        <p className="text-sm text-text-tertiary">{copy.intro}</p>
        <h2 className="text-2xl font-light text-white font-electrolize">{copy.title}</h2>
      </div>

      <Input
        label={copy.label}
        placeholder={copy.placeholder}
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
        {copy.cta}
      </Button>
    </div>
  );
}
