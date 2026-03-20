import React from 'react';
import { Button } from '../ui/Button';
import { BrandLogo } from '../ui/BrandLogo';
import { getOnboardingLanguage } from './onboardingI18n';

interface WelcomeScreenProps {
  onNext: () => void;
}

const COPY = {
  en: {
    tagline: 'Train Smart. Train Strong.',
    intro: 'Your AI gym trainer wherever you go.',
    detail: 'Build muscle with clear guidance and better recovery.',
    cta: 'Start Setup',
  },
  ar: {
    tagline: '\u062a\u062f\u0631\u0628 \u0628\u0630\u0643\u0627\u0621. \u062a\u062f\u0631\u0628 \u0628\u0642\u0648\u0629.',
    intro: '\u0645\u062f\u0631\u0628\u0643 \u0627\u0644\u0630\u0643\u064a \u0644\u0644\u062c\u064a\u0645 \u0645\u0639\u0643 \u0641\u064a \u0643\u0644 \u0645\u0643\u0627\u0646.',
    detail: '\u0627\u0628\u0646\u0650 \u0627\u0644\u0639\u0636\u0644\u0627\u062a \u0628\u062a\u0648\u062c\u064a\u0647 \u0648\u0627\u0636\u062d \u0648\u062a\u0639\u0627\u0641\u064d \u0623\u0641\u0636\u0644.',
    cta: '\u0627\u0628\u062f\u0623 \u0627\u0644\u0625\u0639\u062f\u0627\u062f',
  },
  it: {
    tagline: 'Allenati meglio. Allenati forte.',
    intro: 'Il tuo coach AI da palestra, ovunque tu sia.',
    detail: 'Costruisci muscoli con guida chiara e recupero migliore.',
    cta: 'Inizia configurazione',
  },
  de: {
    tagline: 'Trainiere smart. Trainiere stark.',
    intro: 'Dein KI-Gym-Coach, egal wo du bist.',
    detail: 'Baue Muskeln auf mit klarer Anleitung und besserer Erholung.',
    cta: 'Setup starten',
  },
} as const;

export function WelcomeScreen({ onNext }: WelcomeScreenProps) {
  const language = getOnboardingLanguage();
  const copy = COPY[language] ?? COPY.en;

  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center space-y-8 py-10">
      <div className="relative w-44 h-44 md:w-48 md:h-48 mb-2 group">
        <div className="absolute inset-0 bg-accent/25 rounded-full blur-3xl group-hover:bg-accent/35 transition-all duration-500" />

        <div className="relative w-full h-full rounded-[28px] bg-black border border-accent/30 shadow-glow overflow-hidden flex items-center justify-center p-1">
          <BrandLogo className="rounded-[22px] bg-black p-2 md:p-2.5" imageClassName="object-contain" />
        </div>
      </div>

      <div className="space-y-3">
        <h1 className="font-brand text-3xl md:text-4xl text-white">RepSet</h1>
        <h2 className="text-sm font-semibold uppercase tracking-[0.26em] text-accent">{copy.tagline}</h2>
        <p className="text-text-secondary text-sm max-w-xs mx-auto leading-relaxed">
          {copy.intro}
          <br />
          {copy.detail}
        </p>
      </div>

      <div className="flex-1" />

      <Button onClick={onNext} className="w-full">
        {copy.cta}
      </Button>
    </div>
  );
}
