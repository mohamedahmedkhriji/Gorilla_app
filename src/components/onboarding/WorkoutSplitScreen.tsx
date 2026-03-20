import React, { useMemo, useState } from 'react';
import { Button } from '../ui/Button';
import { SelectionCheck } from '../ui/SelectionCheck';
import { DEFAULT_ONBOARDING_CONFIG, type SplitOption } from '../../config/onboardingConfig';
import {
  getOnboardingLanguage,
  localizeExperienceLevel,
  localizeWorkoutSplitOptions,
} from './onboardingI18n';

interface WorkoutSplitScreenProps {
  onNext: () => void;
  onDataChange?: (data: any) => void;
  onboardingData?: any;
  options?: SplitOption[];
  recommendedByDays?: Record<string, string>;
}

const COPY = {
  en: {
    title: 'Choose your plan type',
    customBadge: 'Create + AI Feedback',
    recommendedBadge: 'Recommended for you',
    cta: 'Next Step',
    summary: (days: number, level: string, profile: string) =>
      `Based on ${days} training day${days > 1 ? 's' : ''}, ${level} level, and ${profile} profile, these are your best-fit options.`,
  },
  ar: {
    title: '\u0627\u062e\u062a\u0631 \u0646\u0648\u0639 \u062e\u0637\u062a\u0643',
    customBadge: '\u0625\u0646\u0634\u0627\u0621 + \u0645\u0644\u0627\u062d\u0638\u0627\u062a \u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064a',
    recommendedBadge: '\u0645\u0648\u0635\u0649 \u0628\u0647 \u0644\u0643',
    cta: '\u0627\u0644\u062e\u0637\u0648\u0629 \u0627\u0644\u062a\u0627\u0644\u064a\u0629',
    summary: (days: number, level: string, profile: string) =>
      `\u0628\u0646\u0627\u0621\u064b \u0639\u0644\u0649 ${days} \u064a\u0648\u0645 \u062a\u062f\u0631\u064a\u0628\u060c \u0648\u0645\u0633\u062a\u0648\u0649 ${level}\u060c \u0648\u0645\u0644\u0641 ${profile}\u060c \u0647\u0630\u0647 \u0623\u0641\u0636\u0644 \u0627\u0644\u062e\u064a\u0627\u0631\u0627\u062a \u0644\u0643.`,
  },
  it: {
    title: 'Scegli il tipo di piano',
    customBadge: 'Crea + feedback AI',
    recommendedBadge: 'Consigliato per te',
    cta: 'Prossimo passo',
    summary: (days: number, level: string, profile: string) =>
      `In base a ${days} giorn${days > 1 ? 'i' : 'o'} di allenamento, livello ${level} e profilo ${profile}, queste sono le opzioni migliori per te.`,
  },
  de: {
    title: 'Waehle deinen Plantyp',
    customBadge: 'Erstellen + KI-Feedback',
    recommendedBadge: 'Empfohlen fuer dich',
    cta: 'Naechster Schritt',
    summary: (days: number, level: string, profile: string) =>
      `Basierend auf ${days} Trainingstag${days > 1 ? 'en' : ''}, Level ${level} und Profil ${profile} sind das deine besten Optionen.`,
  },
} as const;

const toTrainingDays = (value: unknown) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 4;
  return Math.max(2, Math.min(6, Math.round(parsed)));
};

const recommendedSplitForDays = (days: number, recommendations?: Record<string, string>) => {
  const recommended = recommendations?.[String(days)];
  if (recommended) return recommended;
  if (days <= 3) return 'full_body';
  if (days === 4) return 'upper_lower';
  return 'push_pull_legs';
};

const PROFILE_COPY = {
  en: { male: 'male', female: 'female', unspecified: 'general' },
  ar: { male: '\u0630\u0643\u0631', female: '\u0623\u0646\u062b\u0649', unspecified: '\u0639\u0627\u0645' },
  it: { male: 'uomo', female: 'donna', unspecified: 'generale' },
  de: { male: 'Mann', female: 'Frau', unspecified: 'allgemein' },
} as const;

export function WorkoutSplitScreen({
  onNext,
  onDataChange,
  onboardingData,
  options,
  recommendedByDays,
}: WorkoutSplitScreenProps) {
  const language = getOnboardingLanguage();
  const copy = COPY[language] ?? COPY.en;
  const profileCopy = PROFILE_COPY[language] ?? PROFILE_COPY.en;
  const splitOptions = options?.length
    ? options
    : DEFAULT_ONBOARDING_CONFIG.options.workoutSplit;
  const localizedOptions = localizeWorkoutSplitOptions(splitOptions, language);
  const splitRecommendations = recommendedByDays || DEFAULT_ONBOARDING_CONFIG.splitRecommendations;
  const trainingDays = toTrainingDays(onboardingData?.workoutDays);
  const levelLabel = localizeExperienceLevel(
    String(onboardingData?.experienceLevel || 'intermediate').trim(),
    language,
  ).toLowerCase();
  const genderLabel = String(onboardingData?.gender || 'unspecified').trim().toLowerCase();
  const profileLabel = genderLabel === 'male'
    ? profileCopy.male
    : genderLabel === 'female'
      ? profileCopy.female
      : profileCopy.unspecified;

  const availableOptions = useMemo(
    () => localizedOptions.filter((option) => option.days.includes(trainingDays)),
    [localizedOptions, trainingDays],
  );
  const recommendedId = recommendedSplitForDays(trainingDays, splitRecommendations);

  const initialSelection = useMemo(() => {
    const saved = String(onboardingData?.workoutSplitPreference || '').trim().toLowerCase();
    if (availableOptions.some((option) => option.id === saved)) return saved;
    if (availableOptions.some((option) => option.id === recommendedId)) return recommendedId;
    if (availableOptions.some((option) => option.id === 'auto')) return 'auto';
    return availableOptions[0]?.id || 'auto';
  }, [availableOptions, onboardingData?.workoutSplitPreference, recommendedId]);

  const [selectedId, setSelectedId] = useState(initialSelection);

  const persistSelection = (optionId: string) => {
    const selectedOption = availableOptions.find((option) => option.id === optionId);
    if (!selectedOption) return;
    onDataChange?.({
      workoutSplitPreference: selectedOption.id,
      workoutSplitLabel: selectedOption.title,
      ...(optionId !== 'auto'
        ? {
            aiTrainingFocus: '',
            aiLimitations: '',
            aiRecoveryPriority: '',
            aiEquipmentNotes: '',
          }
        : {}),
    });
    return selectedOption;
  };

  const advanceToNextStep = () => {
    if (typeof window !== 'undefined') {
      window.setTimeout(() => onNext(), 0);
      return;
    }
    onNext();
  };

  return (
    <div className="flex-1 flex flex-col space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-light text-white">{copy.title}</h2>
        <p className="text-text-secondary">{copy.summary(trainingDays, levelLabel, profileLabel)}</p>
      </div>

      <div className="space-y-3">
        {availableOptions.map((option) => {
          const isSelected = selectedId === option.id;
          const isRecommended = option.id === recommendedId;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => {
                setSelectedId(option.id);
                const selectedOption = persistSelection(option.id);
                if (option.id === 'custom' && selectedOption) {
                  advanceToNextStep();
                }
              }}
              className={`w-full rounded-xl border p-4 text-left transition-colors ${
                isSelected
                  ? 'bg-accent/12 border-accent text-white'
                  : 'bg-card border-white/10 text-text-secondary hover:bg-white/5'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  {option.id === 'custom' && (
                    <span className="inline-flex items-center rounded-full bg-accent/20 text-accent px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                      {copy.customBadge}
                    </span>
                  )}
                  {isRecommended && (
                    <span className="inline-flex items-center rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-black">
                      {copy.recommendedBadge}
                    </span>
                  )}
                  <p className="text-sm font-semibold text-white">{option.title}</p>
                  <p className="text-xs text-text-secondary">{option.summary}</p>
                  <p className="text-[11px] text-text-tertiary">{option.detail}</p>
                </div>
                <SelectionCheck selected={isSelected} className="mt-0.5 shrink-0" />
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex-1" />

      <Button
        onClick={() => {
          const selectedOption = persistSelection(selectedId);
          if (!selectedOption) return;
          if (selectedOption.id === 'custom') {
            advanceToNextStep();
            return;
          }
          onNext();
        }}
        disabled={!selectedId}
      >
        {copy.cta}
      </Button>
    </div>
  );
}
