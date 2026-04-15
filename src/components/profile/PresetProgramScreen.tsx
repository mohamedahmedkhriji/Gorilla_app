import React, { useEffect, useMemo, useState } from 'react';
import { Header } from '../ui/Header';
import { api } from '../../services/api';
import {
  READY_PLAN_TEMPLATES,
  mapAiWorkoutTypesToTemplate,
  recommendTemplateByDays,
  type ReadyPlanTemplate,
  type ReadyTemplateId,
} from '../admin/coachPlanTemplates';
import { AppLanguage, getActiveLanguage, getStoredLanguage } from '../../services/language';
import {
  translateAiSignal,
  translateExperienceLevel,
  translateExerciseName,
  translateProgramText,
  translateWorkoutType,
} from '../../services/programI18n';
import { formatWorkoutDayShortLabel } from '../../services/workoutDayLabel';
import { persistStoredUser } from '../../shared/authStorage';

interface PresetProgramScreenProps {
  onBack: () => void;
  onSaved: () => void;
  onBuildCustom: () => void;
}

interface TemplateExercise {
  exerciseName: string;
  sets: number;
  reps: string;
  restSeconds: number;
}

interface TemplateWorkoutDay {
  dayName: string;
  workoutName: string;
  workoutType: string;
  exercises: TemplateExercise[];
}

interface ProgramTemplate extends Omit<ReadyPlanTemplate, 'weeklyWorkouts'> {
  daysPerWeek: number;
  weeklyWorkouts: TemplateWorkoutDay[];
}

const DAY_LABELS: Record<string, string> = {
  monday: 'Mon',
  tuesday: 'Tue',
  wednesday: 'Wed',
  thursday: 'Thu',
  friday: 'Fri',
  saturday: 'Sat',
  sunday: 'Sun',
};

const DAY_ORDER: string[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

const resolvePresetRestSeconds = (workoutType: string, exerciseName: string) => {
  const combined = `${workoutType} ${exerciseName}`.toLowerCase();
  if (/deadlift|squat|bench press|barbell row|pull up|pull-up|lat pulldown|romanian deadlift|hip thrust|overhead press/.test(combined)) {
    return 120;
  }
  if (/raise|curl|pushdown|push-down|extension|face pull|rear delt|calf|leg curl|leg extension/.test(combined)) {
    return 60;
  }
  return 90;
};

const PROGRAM_TEMPLATES: ProgramTemplate[] = READY_PLAN_TEMPLATES.map((template) => ({
  ...template,
  daysPerWeek: template.selectedDays.length,
  weeklyWorkouts: template.weeklyWorkouts.map((workout) => ({
    ...workout,
    exercises: workout.exercises.map((exercise) => ({
      ...exercise,
      restSeconds: resolvePresetRestSeconds(workout.workoutType, exercise.exerciseName),
    })),
  })),
}));

const clampWorkoutDays = (value: number) => {
  if (!Number.isFinite(value)) return 4;
  return Math.max(2, Math.min(6, Math.round(value)));
};

const mapStoredSplitPreferenceToTemplate = (
  splitPreference: unknown,
  splitLabel: unknown,
  workoutDays: number,
): ReadyTemplateId | null => {
  const normalized = `${String(splitPreference || '').trim().toLowerCase()} ${String(splitLabel || '').trim().toLowerCase()}`;
  if (!normalized.trim() || normalized.includes('auto') || normalized.includes('custom')) return null;
  if (normalized.includes('ppl ul') || normalized.includes('pplul') || normalized.includes('hybrid')) return 'ppl_ul';
  if (normalized.includes('split push') || normalized.includes('splitpush') || /\bsp\b/.test(normalized)) return 'sp';
  if (
    normalized.includes('upper_lower')
    || normalized.includes('upper lower')
    || normalized.includes('upper/lower')
    || /\bul\b/.test(normalized)
    || normalized.includes('full_body')
    || normalized.includes('full body')
  ) {
    return 'ul';
  }
  if (
    normalized.includes('push_pull_legs')
    || normalized.includes('push pull legs')
    || /\bppl\b/.test(normalized)
  ) {
    return workoutDays >= 6 ? 'ppl' : 'ppl_ul';
  }
  return null;
};

const toStoredSplitPreference = (templateId: ReadyTemplateId) => {
  switch (templateId) {
    case 'ul':
      return 'upper_lower';
    case 'ppl':
      return 'push_pull_legs';
    case 'ppl_ul':
      return 'hybrid';
    case 'sp':
      return 'splitpush';
    default:
      return 'upper_lower';
  }
};

const readStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem('appUser') || localStorage.getItem('user') || '{}');
  } catch {
    return {};
  }
};

type CopyShape = {
  title: string;
  loadingNote: string;
  selectPlanFirst: string;
  noSession: string;
  saveFailed: string;
  recommendedByAi: string;
  aiRecommends: (title: string) => string;
  aiSignals: (signals: string[], level: string) => string;
  aiFallback: (days: number) => string;
  recommended: string;
  daysPerWeek: (value: number) => string;
  buildManualPlan: string;
  buildManualPlanBody: string;
  customBuilder: string;
  hiddenUntilSelect: string;
  availableDays: string;
  twoMonthProgram: (title: string) => string;
  repeatsForEightWeeks: string;
  weekChip: (value: number) => string;
  sets: (value: number) => string;
  rest: (value: number) => string;
  save: string;
  saving: string;
  enableSaveHint: string;
  savedSuccess: (title: string) => string;
  subtitle: Record<ReadyTemplateId, string>;
};

const COPY: Record<'en' | 'ar', CopyShape> = {
  en: {
    title: 'Preset Programs',
    loadingNote: 'AI is preparing your best split recommendation.',
    selectPlanFirst: 'Select a plan card first (PPL, SP, UL, or PPL UL).',
    noSession: 'No active user session found.',
    saveFailed: 'Failed to save program.',
    recommendedByAi: 'Recommended by AI',
    aiRecommends: (title) => `AI recommends ${title} for your profile.`,
    aiSignals: (signals, level) => `AI signals: ${signals.join(', ')}${level ? ` | level: ${level}` : ''}.`,
    aiFallback: (days) => `AI analyzed your profile and selected this split for ${days} days/week.`,
    recommended: 'Recommended',
    daysPerWeek: (value) => `${value} days/week`,
    buildManualPlan: 'Build Manual Plan',
    buildManualPlanBody: 'Create your own plan, then confirm it or send it to coach for validation.',
    customBuilder: 'Custom builder',
    hiddenUntilSelect: 'Days and program details are hidden until you click a plan card.',
    availableDays: 'Available Days (auto from selected plan)',
    twoMonthProgram: (title) => `${title} - 2 Month Program`,
    repeatsForEightWeeks: 'Weekly split below repeats for 8 weeks.',
    weekChip: (value) => `W${value}`,
    sets: (value) => `${value} sets`,
    rest: (value) => `${value}s rest`,
    save: 'Save This Plan',
    saving: 'Saving...',
    enableSaveHint: 'Select a plan card first to enable save.',
    savedSuccess: (title) => `${title} saved as your active plan.`,
    subtitle: {
      ppl: 'Classic Push/Pull/Legs done 6 days for high volume.',
      sp: 'Split Push with mixed strength and hypertrophy focus.',
      ul: 'Upper / Lower (balanced 4-day split).',
      ppl_ul: 'Push / Pull / Legs + Upper / Lower hybrid.',
    },
  },
  ar: {
    title: '\u0627\u0644\u0628\u0631\u0627\u0645\u062c \u0627\u0644\u062c\u0627\u0647\u0632\u0629',
    loadingNote: '\u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064a \u064a\u062c\u0647\u0632 \u0623\u0641\u0636\u0644 \u062a\u0642\u0633\u064a\u0645\u0629 \u0644\u0643.',
    selectPlanFirst: '\u0627\u062e\u062a\u0631 \u0628\u0637\u0627\u0642\u0629 \u062e\u0637\u0629 \u0623\u0648\u0644\u0627\u064b (PPL \u0623\u0648 SP \u0623\u0648 UL \u0623\u0648 PPL UL).',
    noSession: '\u0644\u0645 \u064a\u062a\u0645 \u0627\u0644\u0639\u062b\u0648\u0631 \u0639\u0644\u0649 \u062c\u0644\u0633\u0629 \u0645\u0633\u062a\u062e\u062f\u0645 \u0646\u0634\u0637\u0629.',
    saveFailed: '\u062a\u0639\u0630\u0631 \u062d\u0641\u0638 \u0627\u0644\u0628\u0631\u0646\u0627\u0645\u062c.',
    recommendedByAi: '\u0645\u0642\u062a\u0631\u062d \u0645\u0646 \u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064a',
    aiRecommends: (title) => `\u064a\u0642\u062a\u0631\u062d \u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064a ${title} \u0644\u0645\u0644\u0641\u0643 \u0627\u0644\u0634\u062e\u0635\u064a.`,
    aiSignals: (signals, level) =>
      `\u0625\u0634\u0627\u0631\u0627\u062a \u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064a: ${signals.join('\u060c ')}${level ? ` | \u0627\u0644\u0645\u0633\u062a\u0648\u0649: ${level}` : ''}.`,
    aiFallback: (days) => `\u0627\u062e\u062a\u0627\u0631 \u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064a \u0647\u0630\u0647 \u0627\u0644\u062a\u0642\u0633\u064a\u0645\u0629 \u0628\u0646\u0627\u0621\u064b \u0639\u0644\u0649 ${days} \u0623\u064a\u0627\u0645 \u062a\u062f\u0631\u064a\u0628 \u0623\u0633\u0628\u0648\u0639\u064a\u0627\u064b.`,
    recommended: '\u0645\u0642\u062a\u0631\u062d',
    daysPerWeek: (value) => `${value} \u0623\u064a\u0627\u0645/\u0627\u0644\u0623\u0633\u0628\u0648\u0639`,
    buildManualPlan: '\u0625\u0646\u0634\u0627\u0621 \u062e\u0637\u0629 \u064a\u062f\u0648\u064a\u0629',
    buildManualPlanBody: '\u0623\u0646\u0634\u0626 \u062e\u0637\u062a\u0643 \u0628\u0646\u0641\u0633\u0643\u060c \u062b\u0645 \u0623\u0643\u062f\u0647\u0627 \u0623\u0648 \u0623\u0631\u0633\u0644\u0647\u0627 \u0644\u0644\u0645\u062f\u0631\u0628 \u0644\u0644\u0645\u0631\u0627\u062c\u0639\u0629.',
    customBuilder: '\u0645\u0646\u0634\u0626 \u0645\u062e\u0635\u0635',
    hiddenUntilSelect: '\u062a\u0641\u0627\u0635\u064a\u0644 \u0627\u0644\u0623\u064a\u0627\u0645 \u0648\u0627\u0644\u0628\u0631\u0646\u0627\u0645\u062c \u0645\u062e\u0641\u064a\u0629 \u062d\u062a\u0649 \u062a\u0636\u063a\u0637 \u0639\u0644\u0649 \u0628\u0637\u0627\u0642\u0629 \u062e\u0637\u0629.',
    availableDays: '\u0627\u0644\u0623\u064a\u0627\u0645 \u0627\u0644\u0645\u062a\u0627\u062d\u0629 (\u062a\u0644\u0642\u0627\u0626\u064a\u0627\u064b \u0645\u0646 \u0627\u0644\u062e\u0637\u0629 \u0627\u0644\u0645\u062e\u062a\u0627\u0631\u0629)',
    twoMonthProgram: (title) => `\u0628\u0631\u0646\u0627\u0645\u062c ${title} \u0644\u0634\u0647\u0631\u064a\u0646`,
    repeatsForEightWeeks: '\u064a\u062a\u0643\u0631\u0631 \u0627\u0644\u062c\u062f\u0648\u0644 \u0627\u0644\u0623\u0633\u0628\u0648\u0639\u064a \u0623\u062f\u0646\u0627\u0647 \u0644\u0645\u062f\u0629 8 \u0623\u0633\u0627\u0628\u064a\u0639.',
    weekChip: (value) => `\u0623${value}`,
    sets: (value) => `${value} \u0645\u062c\u0645\u0648\u0639\u0627\u062a`,
    rest: (value) => `${value}\u062b \u0631\u0627\u062d\u0629`,
    save: '\u0627\u062d\u0641\u0638 \u0647\u0630\u0647 \u0627\u0644\u062e\u0637\u0629',
    saving: '\u062c\u0627\u0631\u064d \u0627\u0644\u062d\u0641\u0638...',
    enableSaveHint: '\u0627\u062e\u062a\u0631 \u0628\u0637\u0627\u0642\u0629 \u062e\u0637\u0629 \u0623\u0648\u0644\u0627\u064b \u0644\u062a\u0641\u0639\u064a\u0644 \u0627\u0644\u062d\u0641\u0638.',
    savedSuccess: (title) => `\u062a\u0645 \u062d\u0641\u0638 ${title} \u0643\u062e\u0637\u062a\u0643 \u0627\u0644\u0646\u0634\u0637\u0629.`,
    subtitle: {
      ppl: '\u062a\u0642\u0633\u064a\u0645\u0629 \u062f\u0641\u0639/\u0633\u062d\u0628/\u0623\u0631\u062c\u0644 \u0643\u0644\u0627\u0633\u064a\u0643\u064a\u0629 \u0639\u0644\u0649 6 \u0623\u064a\u0627\u0645.',
      sp: '\u062a\u0642\u0633\u064a\u0645\u0629 Split Push \u0639\u0644\u0649 5 \u0623\u064a\u0627\u0645.',
      ul: '\u062a\u0642\u0633\u064a\u0645\u0629 \u0639\u0644\u0648\u064a / \u0633\u0641\u0644\u064a \u0645\u062a\u0648\u0627\u0632\u0646\u0629 \u0639\u0644\u0649 4 \u0623\u064a\u0627\u0645.',
      ppl_ul: '\u062a\u0642\u0633\u064a\u0645\u0629 PPL + \u0639\u0644\u0648\u064a / \u0633\u0641\u0644\u064a \u0639\u0644\u0649 5 \u0623\u064a\u0627\u0645.',
    },
  },
};

export function PresetProgramScreen({ onBack, onSaved, onBuildCustom }: PresetProgramScreenProps) {
  const [language, setLanguage] = useState<AppLanguage>(() => getActiveLanguage());
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [workoutDays, setWorkoutDays] = useState(4);
  const [recommendedTemplateId, setRecommendedTemplateId] = useState<ReadyTemplateId>('ul');
  const [selectedTemplateId, setSelectedTemplateId] = useState<ReadyTemplateId | null>(null);
  const [aiRecommendationMeta, setAiRecommendationMeta] = useState<{
    type: 'loading' | 'fallback' | 'signals';
    days: number;
    signals: string[];
    level: string;
  }>({
    type: 'loading',
    days: 4,
    signals: [],
    level: '',
  });

  const isArabic = language === 'ar';
  const copy = isArabic ? COPY.ar : COPY.en;

  const templateById = useMemo(() => {
    const map = new Map<ReadyTemplateId, ProgramTemplate>();
    PROGRAM_TEMPLATES.forEach((template) => {
      map.set(template.id, template);
    });
    return map;
  }, []);

  const selectedTemplate = selectedTemplateId ? (templateById.get(selectedTemplateId) || null) : null;
  const selectedTemplateDays = useMemo(
    () => (selectedTemplate
      ? [...selectedTemplate.selectedDays].sort((a, b) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b))
      : []),
    [selectedTemplate],
  );

  const aiRecommendationNote = useMemo(() => {
    if (aiRecommendationMeta.type === 'loading') return copy.loadingNote;
    if (aiRecommendationMeta.type === 'signals' && aiRecommendationMeta.signals.length > 0) {
      return copy.aiSignals(
        aiRecommendationMeta.signals.map((signal) => translateAiSignal(signal, language)),
        translateExperienceLevel(aiRecommendationMeta.level, language),
      );
    }
    return copy.aiFallback(aiRecommendationMeta.days || workoutDays);
  }, [aiRecommendationMeta, copy, language, workoutDays]);

  useEffect(() => {
    setLanguage(getActiveLanguage());

    const handleLanguageChanged = () => {
      setLanguage(getStoredLanguage());
    };

    window.addEventListener('app-language-changed', handleLanguageChanged);
    window.addEventListener('storage', handleLanguageChanged);
    return () => {
      window.removeEventListener('app-language-changed', handleLanguageChanged);
      window.removeEventListener('storage', handleLanguageChanged);
    };
  }, []);

  useEffect(() => {
    const bootstrap = async () => {
      const user = readStoredUser();
      const userId = Number(localStorage.getItem('appUserId') || localStorage.getItem('userId') || user?.id || 0);
      if (!userId) return;

      try {
        const progress = await api.getProgramProgress(userId);
        const fromProgram = Number(
          progress?.program?.daysPerWeek
          ?? progress?.summary?.workoutsPlannedThisWeek
          ?? 0,
        );
        const fromLocalUser = Number(
          user?.workoutDays
          ?? user?.workout_days_per_week
          ?? user?.daysPerWeek
          ?? user?.days_per_week
          ?? 0,
        );
        const resolvedDays = clampWorkoutDays(fromProgram > 0 ? fromProgram : fromLocalUser);
        const storedSplitRecommendation = mapStoredSplitPreferenceToTemplate(
          user?.workoutSplitPreference
          ?? user?.workout_split_preference
          ?? '',
          user?.workoutSplitLabel
          ?? user?.workout_split_label
          ?? '',
          resolvedDays,
        );

        let recommended: ReadyTemplateId = storedSplitRecommendation || recommendTemplateByDays(resolvedDays);
        let recommendationMeta: typeof aiRecommendationMeta = {
          type: 'fallback',
          days: resolvedDays,
          signals: [],
          level: '',
        };

        try {
          const insights = await api.getOnboardingInsights({
            age: user?.age ?? null,
            gender: user?.gender ?? null,
            weightKg: user?.weightKg ?? user?.weight_kg ?? null,
            heightCm: user?.heightCm ?? user?.height_cm ?? null,
            restingBpm: user?.restingBpm ?? user?.resting_bpm ?? null,
            workoutFrequency: resolvedDays,
          });

          const suggestedWorkoutTypes = Array.isArray(insights?.interpretation?.suggestedWorkoutTypes)
            ? insights.interpretation.suggestedWorkoutTypes.map((item: unknown) => String(item || '').trim()).filter(Boolean)
            : [];
          const suggestedLevel = String(insights?.interpretation?.suggestedExperienceLevel || '').trim();

          if (!storedSplitRecommendation) {
            recommended = mapAiWorkoutTypesToTemplate(suggestedWorkoutTypes, resolvedDays);
          }

          recommendationMeta = suggestedWorkoutTypes.length
            ? {
              type: 'signals',
              days: resolvedDays,
              signals: suggestedWorkoutTypes.slice(0, 2),
              level: suggestedLevel,
            }
            : {
              type: 'fallback',
              days: resolvedDays,
              signals: [],
              level: '',
            };
        } catch (aiError) {
          console.error('Failed to compute AI recommendation, using fallback:', aiError);
        }

        setWorkoutDays(resolvedDays);
        setAiRecommendationMeta(recommendationMeta);
        setRecommendedTemplateId(recommended);
        setSelectedTemplateId((current) => current ?? recommended);
      } catch (fetchError) {
        console.error('Failed to infer workout-day recommendation:', fetchError);
      }
    };

    void bootstrap();
  }, []);

  const handleSavePlan = async () => {
    setError(null);
    setSuccess(null);

    if (!selectedTemplate) {
      setError(copy.selectPlanFirst);
      return;
    }

    const user = readStoredUser();
    const userId = Number(localStorage.getItem('appUserId') || localStorage.getItem('userId') || user?.id || 0);
    if (!userId) {
      setError(copy.noSession);
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        planName: `${selectedTemplate.title} 2-Month Program`,
        description: `${selectedTemplate.title} template selected from preset programs`,
        cycleWeeks: selectedTemplate.cycleWeeks,
        selectedDays: selectedTemplate.selectedDays,
        weeklyWorkouts: selectedTemplate.weeklyWorkouts.map((day) => ({
          dayName: day.dayName,
          workoutName: day.workoutName,
          workoutType: day.workoutType,
          exercises: day.exercises.map((exercise) => ({
            exerciseName: exercise.exerciseName,
            sets: exercise.sets,
            reps: exercise.reps,
            restSeconds: exercise.restSeconds,
          })),
        })),
      };

      const result = await api.saveCustomProgram(userId, payload);
      if (!result?.success) {
        throw new Error(result?.error || 'Failed to save program');
      }

      persistStoredUser({
        ...user,
        id: userId,
        workoutSplitPreference: toStoredSplitPreference(selectedTemplate.id),
        workout_split_preference: toStoredSplitPreference(selectedTemplate.id),
        workoutSplitLabel: selectedTemplate.title,
        workout_split_label: selectedTemplate.title,
      });

      localStorage.removeItem('recoveryNeedsUpdate');
      setSuccess(copy.savedSuccess(selectedTemplate.title));
      window.setTimeout(() => onSaved(), 500);
    } catch (saveError) {
      console.error('Failed to save preset plan:', saveError);
      setError(saveError instanceof Error && !isArabic ? saveError.message : copy.saveFailed);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex h-full flex-1 flex-col bg-background pb-24">
      <div className="px-4 pt-2 sm:px-6">
        <Header title={copy.title} onBack={onBack} />
      </div>

      <div className="space-y-4 px-4 pt-2 sm:px-6">
        {error && (
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
            {error}
          </div>
        )}
        {success && (
          <div className="rounded-xl border border-green-500/40 bg-green-500/10 p-3 text-sm text-green-300">
            {success}
          </div>
        )}

        <div className="rounded-xl border border-white/10 bg-card p-4">
          <div className="text-sm text-text-secondary">{copy.recommendedByAi}</div>
          <div className="mt-1 text-white">
            {copy.aiRecommends(templateById.get(recommendedTemplateId)?.title || 'UL')}
          </div>
          <div className="mt-1 text-xs text-text-secondary">{aiRecommendationNote}</div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {PROGRAM_TEMPLATES.map((template) => {
            const isSelected = selectedTemplateId === template.id;
            const isRecommended = recommendedTemplateId === template.id;

            return (
              <button
                key={template.id}
                type="button"
                onClick={() => setSelectedTemplateId(template.id)}
                className={`rounded-xl border p-4 text-left transition-colors ${
                  isSelected
                    ? 'border-accent bg-accent/10'
                    : 'border-white/10 bg-card hover:bg-white/5'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="font-semibold text-white">{template.title}</div>
                  {isRecommended && (
                    <span className="rounded border border-accent/50 bg-accent/10 px-2 py-1 text-[10px] uppercase tracking-wide text-accent">
                      {copy.recommended}
                    </span>
                  )}
                </div>
                <div className="mt-1 text-xs text-text-secondary">{copy.subtitle[template.id]}</div>
                <div className="mt-3 text-xs text-text-tertiary">{copy.daysPerWeek(template.daysPerWeek)}</div>
              </button>
            );
          })}

          <button
            type="button"
            onClick={onBuildCustom}
            className="rounded-xl border border-white/10 bg-card p-4 text-left transition-colors hover:bg-white/5"
          >
            <div className="font-semibold text-white">{copy.buildManualPlan}</div>
            <div className="mt-1 text-xs text-text-secondary">{copy.buildManualPlanBody}</div>
            <div className="mt-3 text-xs text-text-tertiary">{copy.customBuilder}</div>
          </button>
        </div>

        {!selectedTemplate && (
          <div className="rounded-xl border border-white/10 bg-card p-4 text-sm text-text-secondary">
            {copy.hiddenUntilSelect}
          </div>
        )}

        {selectedTemplate && (
          <>
            <div className="rounded-xl border border-white/10 bg-card p-4">
              <div className="text-sm text-text-secondary">{copy.availableDays}</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {selectedTemplateDays.map((day) => (
                  <span
                    key={`selected-day-${day}`}
                    className="rounded-full border border-accent/40 bg-accent/10 px-2.5 py-1 text-xs text-accent"
                  >
                    {formatWorkoutDayShortLabel(day, DAY_LABELS[day] || day, language)}
                  </span>
                ))}
              </div>
            </div>

            <div className="space-y-3 rounded-xl border border-accent/40 bg-accent/5 p-4">
              <div>
                <div className="font-semibold text-white">{copy.twoMonthProgram(selectedTemplate.title)}</div>
                <div className="mt-1 text-xs text-text-secondary">{copy.repeatsForEightWeeks}</div>
              </div>

              <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
                {Array.from({ length: selectedTemplate.cycleWeeks }, (_, index) => (
                  <div
                    key={`${selectedTemplate.id}-week-${index + 1}`}
                    className="rounded-lg border border-white/10 bg-background py-2 text-center text-xs text-text-secondary"
                  >
                    {copy.weekChip(index + 1)}
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                {selectedTemplate.weeklyWorkouts.map((workout) => (
                  <div key={`${selectedTemplate.id}-${workout.dayName}`} className="rounded-lg border border-white/10 bg-background p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-medium text-white">
                        {formatWorkoutDayShortLabel(workout.dayName, DAY_LABELS[workout.dayName] || workout.dayName, language)}
                        {' - '}
                        {translateProgramText(workout.workoutName, language)}
                      </div>
                      <div className="text-[10px] uppercase text-text-tertiary">
                        {translateWorkoutType(workout.workoutType, language)}
                      </div>
                    </div>
                    <div className="mt-2 space-y-1">
                      {workout.exercises.map((exercise) => (
                        <div key={`${selectedTemplate.id}-${workout.dayName}-${exercise.exerciseName}`} className="text-xs text-text-secondary">
                          <span className="text-white">{translateExerciseName(exercise.exerciseName, language)}</span>
                          {' | '}
                          {copy.sets(exercise.sets)}
                          {' | '}
                          {exercise.reps}
                          {' | '}
                          {copy.rest(exercise.restSeconds)}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        <div className="grid grid-cols-1 gap-3">
          <button
            type="button"
            onClick={() => void handleSavePlan()}
            disabled={isSaving || !selectedTemplate}
            className="w-full rounded-xl bg-accent p-3 font-semibold text-black transition-colors hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? copy.saving : copy.save}
          </button>
          {!selectedTemplate && (
            <div className="text-center text-xs text-text-secondary">{copy.enableSaveHint}</div>
          )}
        </div>
      </div>
    </div>
  );
}
