import React from 'react';
import { Button } from '../ui/Button';
import { BrandLogo } from '../ui/BrandLogo';
import { getOnboardingLanguage } from './onboardingI18n';

interface WelcomeScreenProps {
  onNext: () => void;
}

const COPY = {
  en: {
    tagline: 'Your AI training system',
    intro: 'Build a plan that adapts to you.',
    detail: 'Fast setup • personalized program',
    cta: 'Create My Plan',
  },
  ar: {
    tagline: '\u0646\u0638\u0627\u0645 \u062a\u062f\u0631\u064a\u0628 \u0630\u0643\u064a',
    intro: '\u0627\u0628\u0646\u0650 \u062e\u0637\u0629 \u062a\u062a\u0643\u064a\u0641 \u0645\u0639\u0643.',
    detail: '\u062a\u062c\u0647\u064a\u0632 \u0633\u0631\u064a\u0639 \u2022 \u0628\u0631\u0646\u0627\u0645\u062c \u0645\u062e\u0635\u0635',
    cta: '\u0627\u0646\u0634\u0626 \u062e\u0637\u062a\u064a',
  },
  it: {
    tagline: 'Il tuo sistema di allenamento AI',
    intro: 'Un piano che si adatta a te.',
    detail: 'Setup rapido • programma personalizzato',
    cta: 'Crea il mio piano',
  },
  de: {
    tagline: 'Dein KI-Trainingssystem',
    intro: 'Ein Plan, der sich dir anpasst.',
    detail: 'Schneller Start • persoenliches Programm',
    cta: 'Meinen Plan erstellen',
  },
  fr: {
    tagline: 'Ton systeme d entrainement IA',
    intro: 'Un plan qui s adapte a toi.',
    detail: 'Profil rapide • programme personnalise',
    cta: 'Creer mon plan',
  },
} as const;

export function WelcomeScreen({ onNext }: WelcomeScreenProps) {
  const language = getOnboardingLanguage();
  const copy = COPY[language as keyof typeof COPY] ?? COPY.en;

  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center space-y-8 py-10">
      <div className="relative w-44 h-44 md:w-48 md:h-48 mb-2 group">
        <div className="relative w-full h-full rounded-[28px] bg-black border border-accent/30 overflow-hidden flex items-center justify-center p-1">
          <BrandLogo className="rounded-[22px] bg-black p-2 md:p-2.5" imageClassName="object-contain" />
        </div>
      </div>

      <div className="space-y-3">
        <h1 className="font-brand text-[2.35rem] md:text-5xl text-white">RepSet</h1>
        <h2 className="text-base font-semibold uppercase tracking-[0.16em] text-accent sm:text-lg">{copy.tagline}</h2>
        <p className="mx-auto max-w-xs text-base leading-relaxed text-text-secondary sm:text-lg">
          {copy.intro}
        </p>
        <p className="text-sm font-medium uppercase tracking-[0.12em] text-text-tertiary sm:text-base">{copy.detail}</p>
      </div>

      <div className="flex-1" />

      <Button onClick={onNext} className="w-full">
        {copy.cta}
      </Button>
    </div>
  );
}
