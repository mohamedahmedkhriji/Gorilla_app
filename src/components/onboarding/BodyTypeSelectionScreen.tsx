import React, { useState } from 'react';
import { BoxIcon, Circle, User } from 'lucide-react';
import { Button } from '../ui/Button';
import { SelectionCheck } from '../ui/SelectionCheck';
import { getOnboardingLanguage } from './onboardingI18n';

interface BodyTypeSelectionScreenProps {
  onNext: () => void;
  onDataChange?: (data: any) => void;
  onboardingData?: any;
}

const COPY = {
  en: {
    title: 'Body Type',
    subtitle: 'This helps RepSet personalize your training and recovery.',
    cta: 'Next Step',
    types: {
      ectomorph: { name: 'Ectomorph', desc: 'Lean, slim build. Harder to gain mass.' },
      mesomorph: { name: 'Mesomorph', desc: 'Naturally muscular. Gains muscle easily.' },
      endomorph: { name: 'Endomorph', desc: 'Broader build. Gains size easily.' },
      unsure: { name: 'Not Sure', desc: 'Let RepSet AI analyze your photos.' },
    },
  },
  ar: {
    title: '\u0646\u0648\u0639 \u0627\u0644\u062c\u0633\u0645',
    subtitle: '\u064a\u0633\u0627\u0639\u062f \u0630\u0644\u0643 RepSet \u0639\u0644\u0649 \u062a\u062e\u0635\u064a\u0635 \u062a\u062f\u0631\u064a\u0628\u0643 \u0648\u062a\u0639\u0627\u0641\u064a\u0643.',
    cta: '\u0627\u0644\u062e\u0637\u0648\u0629 \u0627\u0644\u062a\u0627\u0644\u064a\u0629',
    types: {
      ectomorph: { name: '\u0625\u0643\u062a\u0648\u0645\u0648\u0631\u0641', desc: '\u0628\u0646\u064a\u0629 \u0646\u062d\u064a\u0641\u0629 \u0648\u0635\u0639\u0628\u0629 \u0641\u064a \u0632\u064a\u0627\u062f\u0629 \u0627\u0644\u0643\u062a\u0644\u0629.' },
      mesomorph: { name: '\u0645\u064a\u0632\u0648\u0645\u0648\u0631\u0641', desc: '\u0639\u0636\u0644\u064a \u0628\u0637\u0628\u064a\u0639\u062a\u0647 \u0648\u064a\u0643\u062a\u0633\u0628 \u0627\u0644\u0639\u0636\u0644\u0627\u062a \u0628\u0633\u0647\u0648\u0644\u0629.' },
      endomorph: { name: '\u0625\u0646\u062f\u0648\u0645\u0648\u0631\u0641', desc: '\u0628\u0646\u064a\u0629 \u0623\u0639\u0631\u0636 \u0648\u062a\u0632\u064a\u062f \u0627\u0644\u0643\u062a\u0644\u0629 \u0628\u0633\u0647\u0648\u0644\u0629.' },
      unsure: { name: '\u063a\u064a\u0631 \u0645\u062a\u0623\u0643\u062f', desc: '\u062f\u0639 RepSet AI \u064a\u062d\u0644\u0644 \u0635\u0648\u0631\u0643.' },
    },
  },
  it: {
    title: 'Tipo di corpo',
    subtitle: 'Questo aiuta RepSet a personalizzare allenamento e recupero.',
    cta: 'Prossimo passo',
    types: {
      ectomorph: { name: 'Ectomorfo', desc: 'Struttura snella. Piu difficile aumentare massa.' },
      mesomorph: { name: 'Mesomorfo', desc: 'Naturalmente muscoloso. Guadagna muscolo facilmente.' },
      endomorph: { name: 'Endomorfo', desc: 'Struttura piu ampia. Aumenta facilmente di taglia.' },
      unsure: { name: 'Non so', desc: 'Lascia che RepSet AI analizzi le tue foto.' },
    },
  },
  de: {
    title: 'Koerpertyp',
    subtitle: 'Das hilft RepSet, dein Training und deine Erholung anzupassen.',
    cta: 'Naechster Schritt',
    types: {
      ectomorph: { name: 'Ektomorph', desc: 'Schlanke Statur. Muskelaufbau faellt schwerer.' },
      mesomorph: { name: 'Mesomorph', desc: 'Von Natur aus muskuloes. Baut leicht Muskeln auf.' },
      endomorph: { name: 'Endomorph', desc: 'Breitere Statur. Baut leicht Masse auf.' },
      unsure: { name: 'Unsicher', desc: 'Lass RepSet AI deine Fotos analysieren.' },
    },
  },
  fr: {
    title: 'Type de corps',
    subtitle: 'Cela aide RepSet a personnaliser ton entrainement et ta recuperation.',
    cta: 'Etape suivante',
    types: {
      ectomorph: { name: 'Ectomorphe', desc: 'Silhouette fine. Plus difficile de prendre de la masse.' },
      mesomorph: { name: 'Mesomorphe', desc: 'Naturellement muscle. Prend du muscle plus facilement.' },
      endomorph: { name: 'Endomorphe', desc: 'Silhouette plus large. Prend du volume plus facilement.' },
      unsure: { name: 'Je ne sais pas', desc: 'Laisse RepSet AI analyser tes photos.' },
    },
  },
} as const;

function Zap(props: any) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}

export function BodyTypeSelectionScreen({
  onNext,
  onDataChange,
  onboardingData,
}: BodyTypeSelectionScreenProps) {
  const language = getOnboardingLanguage();
  const copy = COPY[language as keyof typeof COPY] ?? COPY.en;
  const initialBodyType = typeof onboardingData?.bodyType === 'string'
    ? onboardingData.bodyType.toLowerCase()
    : null;
  const [selected, setSelected] = useState<string | null>(initialBodyType);

  const types = [
    { id: 'ectomorph', icon: User },
    { id: 'mesomorph', icon: BoxIcon },
    { id: 'endomorph', icon: Circle },
    { id: 'unsure', icon: Zap },
  ] as const;

  return (
    <div className="flex-1 flex flex-col space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-white">{copy.title}</h2>
        <p className="text-text-secondary">{copy.subtitle}</p>
      </div>

      <div className="space-y-3">
        {types.map((type) => {
          const Icon = type.icon;
          const typeCopy = copy.types[type.id];
          const isSelected = selected === type.id;
          return (
            <button
              key={type.id}
              type="button"
              onClick={() => {
                setSelected(type.id);
                onDataChange?.({
                  bodyType: type.id,
                  bodyTypeLabel: typeCopy.name,
                });
              }}
              className={`
                w-full p-4 rounded-xl border text-left transition-all duration-200 flex items-center gap-4
                ${isSelected ? 'bg-accent/10 border-accent shadow-[0_0_15px_rgba(191,255,0,0.1)]' : 'bg-card border-white/5 hover:bg-white/5'}
              `}
            >
              <div
                className={`
                  w-12 h-12 rounded-full flex items-center justify-center shrink-0
                  ${isSelected ? 'bg-accent text-black' : 'bg-white/5 text-text-tertiary'}
                `}
              >
                <Icon size={24} />
              </div>

              <div className="flex-1">
                <h3 className="font-bold text-white">{typeCopy.name}</h3>
                <p className={`text-xs ${isSelected ? 'text-white/80' : 'text-text-secondary'}`}>
                  {typeCopy.desc}
                </p>
              </div>

              {isSelected && <SelectionCheck selected size={24} className="shrink-0" />}
            </button>
          );
        })}
      </div>

      <div className="flex-1" />

      <Button onClick={onNext} disabled={!selected}>
        {copy.cta}
      </Button>
    </div>
  );
}
