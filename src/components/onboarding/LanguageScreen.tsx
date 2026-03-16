import React, { useMemo, useState } from 'react';
import { Languages } from 'lucide-react';
import { Button } from '../ui/Button';
import { SelectionCheck } from '../ui/SelectionCheck';
import { AppLanguage, applyLanguage, getActiveLanguage, getStoredLanguage } from '../../services/language';
import { getOnboardingLanguage } from './onboardingI18n';

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
  subtitle: string;
}> = [
  {
    id: 'en',
    title: 'English',
    subtitle: 'Continue in English',
  },
  {
    id: 'ar',
    title: 'العربية',
    subtitle: 'المتابعة بالعربية',
  },
];

export function LanguageScreen({ onNext, onDataChange, onboardingData }: LanguageScreenProps) {
  const initialLanguage = useMemo<AppLanguage>(() => {
    const saved = String(onboardingData?.language || '').trim().toLowerCase();
    if (saved === 'ar' || saved === 'en') return saved;
    return getActiveLanguage() || getStoredLanguage();
  }, [onboardingData?.language]);

  const [selectedLanguage, setSelectedLanguage] = useState<AppLanguage>(initialLanguage);
  const activeLanguage = getOnboardingLanguage();
  const displayLanguage = selectedLanguage || activeLanguage;
  const copy = displayLanguage === 'ar'
    ? {
        title: 'اختر لغتك',
        subtitle: 'يمكنك تغييرها لاحقًا من الإعدادات.',
        welcome: 'مرحبًا',
        cta: 'متابعة',
      }
    : {
        title: 'Choose your language',
        subtitle: 'You can change this later in Settings.',
        welcome: 'Welcome!',
        cta: 'Continue',
      };

  const handleSelect = (language: AppLanguage) => {
    setSelectedLanguage(language);
    applyLanguage(language, true);
    onDataChange?.({ language });
  };

  const buttonLabel = selectedLanguage === 'ar' ? 'متابعة' : 'Continue';

  return (
    <div className="flex-1 flex flex-col space-y-6">
      <div className="space-y-2 text-center">
        <p className="text-sm text-text-tertiary">
          {copy.welcome} / مرحبا
        </p>
        <h2 className="text-2xl font-light text-white">{copy.title}</h2>
        <p className="text-text-secondary text-sm">{copy.subtitle}</p>
      </div>

      <div className="space-y-4">
        {LANGUAGE_OPTIONS.map((option) => {
          const isSelected = selectedLanguage === option.id;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => handleSelect(option.id)}
              className={`w-full min-h-[88px] rounded-2xl border px-5 py-4 text-left transition-colors ${
                isSelected
                  ? 'bg-accent/12 border-accent text-white'
                  : 'bg-card border-white/10 text-text-secondary hover:bg-white/5'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Languages size={18} className="text-accent" />
                    <p className="text-base font-semibold leading-snug text-white">{option.title}</p>
                  </div>
                  <p className="text-sm leading-relaxed text-text-secondary">{option.subtitle}</p>
                </div>
                <SelectionCheck selected={isSelected} size={22} className="mt-1 shrink-0" />
              </div>
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
