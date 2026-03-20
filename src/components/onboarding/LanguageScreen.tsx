import React, { useMemo, useState } from 'react';
import { Button } from '../ui/Button';
import { AppLanguage, applyLanguage, getActiveLanguage, getStoredLanguage, pickLanguage } from '../../services/language';
import { getOnboardingLanguage } from './onboardingI18n';

const ENGLISH_FLAG = new URL('../../../assets/flags/English.png', import.meta.url).href;
const ARABIC_FLAG = new URL('../../../assets/flags/العربية.png', import.meta.url).href;
const ITALIAN_FLAG = new URL('../../../assets/flags/Italiano.png', import.meta.url).href;
const GERMAN_FLAG = new URL('../../../assets/flags/Deutsch.png', import.meta.url).href;

interface LanguageScreenProps {
  onNext: () => void;
  onDataChange?: (data: Record<string, unknown>) => void;
  onboardingData?: {
    language?: AppLanguage;
  };
}

const LANGUAGE_OPTIONS: Array<{
  id: AppLanguage;
  title: string;
  flagSrc: string;
}> = [
  {
    id: 'en',
    title: 'English',
    flagSrc: ENGLISH_FLAG,
  },
  {
    id: 'ar',
    title: '\u0627\u0644\u0639\u0631\u0628\u064a\u0629',
    flagSrc: ARABIC_FLAG,
  },
  {
    id: 'it',
    title: 'Italiano',
    flagSrc: ITALIAN_FLAG,
  },
  {
    id: 'de',
    title: 'Deutsch',
    flagSrc: GERMAN_FLAG,
  },
];

export function LanguageScreen({ onNext, onDataChange, onboardingData }: LanguageScreenProps) {
  const initialLanguage = useMemo<AppLanguage>(() => {
    const saved = String(onboardingData?.language || '').trim().toLowerCase();
    if (saved === 'ar' || saved === 'en' || saved === 'it' || saved === 'de') return saved;
    return getActiveLanguage() || getStoredLanguage();
  }, [onboardingData?.language]);

  const [selectedLanguage, setSelectedLanguage] = useState<AppLanguage>(initialLanguage);
  const activeLanguage = getOnboardingLanguage();
  const displayLanguage = selectedLanguage || activeLanguage;
  const copy = pickLanguage(displayLanguage, {
    en: {
      title: 'Choose your language',
      subtitle: 'You can change this later in Settings.',
      welcome: 'Welcome!',
      greeting: '\u0645\u0631\u062d\u0628\u0627',
      cta: 'Continue',
    },
    ar: {
      title: '\u0627\u062e\u062a\u0631 \u0644\u063a\u062a\u0643',
      subtitle: '\u064a\u0645\u0643\u0646\u0643 \u062a\u063a\u064a\u064a\u0631\u0647\u0627 \u0644\u0627\u062d\u0642\u064b\u0627 \u0645\u0646 \u0627\u0644\u0625\u0639\u062f\u0627\u062f\u0627\u062a.',
      welcome: '\u0645\u0631\u062d\u0628\u064b\u0627',
      greeting: '\u0645\u0631\u062d\u0628\u0627',
      cta: '\u0645\u062a\u0627\u0628\u0639\u0629',
    },
    it: {
      title: 'Scegli la tua lingua',
      subtitle: 'Potrai cambiarla piu tardi nelle Impostazioni.',
      welcome: 'Benvenuto!',
      greeting: '\u0645\u0631\u062d\u0628\u0627',
      cta: 'Continua',
    },
    de: {
      title: 'Wahle deine Sprache',
      subtitle: 'Du kannst sie spater in den Einstellungen andern.',
      welcome: 'Willkommen!',
      greeting: 'Hallo',
      cta: 'Weiter',
    },
  });

  const handleSelect = (language: AppLanguage) => {
    setSelectedLanguage(language);
    applyLanguage(language, true);
    onDataChange?.({ language });
  };

  const buttonLabel = pickLanguage(selectedLanguage, {
    en: 'Continue',
    ar: '\u0645\u062a\u0627\u0628\u0639\u0629',
    it: 'Continua',
    de: 'Weiter',
  });

  return (
    <div className="flex-1 flex flex-col space-y-6">
      <div className="space-y-2 text-center">
        <p className="text-sm text-text-tertiary">
          {copy.welcome} / {copy.greeting}
        </p>
        <h2 className="text-2xl font-light text-white">{copy.title}</h2>
        <p className="text-text-secondary text-sm">{copy.subtitle}</p>
      </div>

      <div className="grid grid-cols-2 gap-5">
        {LANGUAGE_OPTIONS.map((option) => {
          const isSelected = selectedLanguage === option.id;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => handleSelect(option.id)}
              className="group flex w-full flex-col items-center justify-center gap-5 px-2 py-4 text-center transition-transform duration-200 hover:scale-[1.02]"
              aria-pressed={isSelected}
            >
              <div
                className={`flex h-28 w-28 items-center justify-center overflow-hidden rounded-full border p-1.5 ${
                  isSelected ? 'border-accent/70 bg-accent/10' : 'border-white/10 bg-white/[0.03]'
                }`}
              >
                <img
                  src={option.flagSrc}
                  alt={option.title}
                  className="h-full w-full rounded-full object-cover"
                />
              </div>
              <p className={`text-lg font-semibold leading-snug ${isSelected ? 'text-white' : 'text-text-primary'}`}>
                {option.title}
              </p>
            </button>
          );
        })}
      </div>

      <div className="flex-1" />

      <Button onClick={() => selectedLanguage && onNext()} disabled={!selectedLanguage}>
        {buttonLabel}
      </Button>
    </div>
  );
}
