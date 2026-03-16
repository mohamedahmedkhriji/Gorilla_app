import React, { useMemo, useState } from 'react';
import { Button } from '../ui/Button';
import { SelectionCheck } from '../ui/SelectionCheck';
import { DEFAULT_ONBOARDING_CONFIG, type SplitOption } from '../../config/onboardingConfig';
import {
  getOnboardingLanguage,
  localizeExperienceLevel,
  localizeGenderButtonLabel,
  localizeWorkoutSplitOptions,
} from './onboardingI18n';

interface WorkoutSplitScreenProps {
  onNext: () => void;
  onDataChange?: (data: any) => void;
  onboardingData?: any;
  options?: SplitOption[];
  recommendedByDays?: Record<string, string>;
}

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

export function WorkoutSplitScreen({
  onNext,
  onDataChange,
  onboardingData,
  options,
  recommendedByDays,
}: WorkoutSplitScreenProps) {
  const language = getOnboardingLanguage();
  const isArabic = language === 'ar';
  const splitOptions = options?.length
    ? options
    : DEFAULT_ONBOARDING_CONFIG.options.workoutSplit;
  const localizedOptions = localizeWorkoutSplitOptions(splitOptions, language);
  const splitRecommendations = recommendedByDays
    || DEFAULT_ONBOARDING_CONFIG.splitRecommendations;
  const trainingDays = toTrainingDays(onboardingData?.workoutDays);
  const levelLabel = String(onboardingData?.experienceLevel || 'intermediate').trim().toLowerCase();
  const genderLabel = String(onboardingData?.gender || 'unspecified').trim().toLowerCase();
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

  const handleNext = () => {
    const selectedOption = persistSelection(selectedId);
    if (!selectedOption) return;
    onNext();
  };

  return (
    <div className="flex-1 flex flex-col space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-light text-white">
          {isArabic ? 'اختر نوع خطتك' : 'Choose your plan type'}
        </h2>
        <p className="text-text-secondary">
          {isArabic
            ? `بناءً على ${trainingDays} يوم تدريب، ومستوى ${localizeExperienceLevel(levelLabel, language)}، وملف ${localizeGenderButtonLabel(genderLabel, language)}، هذه أفضل الخيارات لك.`
            : `Based on ${trainingDays} training day${trainingDays > 1 ? 's' : ''}, ${levelLabel} level, and ${genderLabel} profile, these are your best-fit options.`}
        </p>
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
                if (option.id === 'custom') {
                  if (selectedOption) onNext();
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
                      {isArabic ? 'إنشاء + ملاحظات الذكاء الاصطناعي' : 'Create + AI Feedback'}
                    </span>
                  )}
                  {isRecommended && (
                    <span className="inline-flex items-center rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-black">
                      {isArabic ? 'موصى به لك' : 'Recommended for you'}
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

      <Button onClick={handleNext} disabled={!selectedId}>
        {isArabic ? 'الخطوة التالية' : 'Next Step'}
      </Button>
    </div>
  );
}
