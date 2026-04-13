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
    intro: 'Let\u2019s personalize your plan',
    title: 'What should we call you?',
    label: 'Name',
    placeholder: 'Your first name',
    cta: 'Continue',
    feedback: (name: string) => `Great to meet you, ${name}.`,
  },
  ar: {
    intro: '\u0644\u0646\u062e\u0635\u0635 \u062e\u0637\u062a\u0643',
    title: '\u0628\u0623\u064a \u0627\u0633\u0645 \u062a\u062d\u0628 \u0623\u0646 \u0646\u0646\u0627\u062f\u064a\u0643\u061f',
    label: '\u0627\u0644\u0627\u0633\u0645',
    placeholder: '\u0627\u0633\u0645\u0643',
    cta: '\u0645\u062a\u0627\u0628\u0639\u0629',
    feedback: (name: string) => `\u0645\u0633\u0631\u0648\u0631\u0648\u0646 \u0628\u0645\u0639\u0631\u0641\u062a\u0643\u060c ${name}.`,
  },
  it: {
    intro: 'Personalizziamo il tuo piano',
    title: 'Come vuoi che ti chiamiamo?',
    label: 'Nome',
    placeholder: 'Il tuo nome',
    cta: 'Continua',
    feedback: (name: string) => `Piacere di conoscerti, ${name}.`,
  },
  de: {
    intro: 'Wir personalisieren deinen Plan',
    title: 'Wie sollen wir dich nennen?',
    label: 'Name',
    placeholder: 'Dein Vorname',
    cta: 'Weiter',
    feedback: (name: string) => `Schoen dich kennenzulernen, ${name}.`,
  },
  fr: {
    intro: 'On personnalise ton programme',
    title: 'Comment veux-tu que nous t appelions ?',
    label: 'Prenom',
    placeholder: 'Ton prenom',
    cta: 'Continuer',
    feedback: (name: string) => `Ravi de te rencontrer, ${name}.`,
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

      {trimmedName ? (
        <p className="text-center text-sm text-text-secondary">{copy.feedback(trimmedName)}</p>
      ) : null}

      <div className="flex-1" />

      <Button onClick={() => canContinue && onNext()} disabled={!canContinue}>
        {copy.cta}
      </Button>
    </div>
  );
}
