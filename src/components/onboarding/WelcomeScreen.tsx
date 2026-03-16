import React from 'react';
import { Button } from '../ui/Button';
import { BrandLogo } from '../ui/BrandLogo';

interface WelcomeScreenProps {
  onNext: () => void;
}

export function WelcomeScreen({ onNext }: WelcomeScreenProps) {
  const copy = {
    tagline: 'Train Smart. Train Strong.',
    intro: 'Your AI gym trainer wherever you go.',
    detail: 'Build muscle with clear guidance and better recovery.',
    cta: 'Start Setup',
  };
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
