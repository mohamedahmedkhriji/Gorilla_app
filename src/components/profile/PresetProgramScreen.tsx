import React, { useEffect, useMemo, useState } from 'react';
import { Header } from '../ui/Header';
import { api } from '../../services/api';
import { AppLanguage, getActiveLanguage, getStoredLanguage } from '../../services/language';
import {
  translateAiSignal,
  translateExperienceLevel,
  translateExerciseName,
  translateProgramText,
  translateWorkoutType,
} from '../../services/programI18n';
import { formatWorkoutDayShortLabel } from '../../services/workoutDayLabel';

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

interface ProgramTemplate {
  id: 'ppl' | 'splitpush' | 'upperlower';
  title: string;
  subtitle: string;
  daysPerWeek: number;
  selectedDays: string[];
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

const PROGRAM_TEMPLATES: ProgramTemplate[] = [
  {
    id: 'ppl',
    title: 'PPL',
    subtitle: 'Classic Push/Pull/Legs done 6 days for high volume.',
    daysPerWeek: 6,
    selectedDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
    weeklyWorkouts: [
      {
        dayName: 'monday',
        workoutName: 'Push A',
        workoutType: 'Push',
        exercises: [
          { exerciseName: 'Bench Press', sets: 4, reps: '6-8', restSeconds: 120 },
          { exerciseName: 'Incline Dumbbell Press', sets: 3, reps: '8-10', restSeconds: 90 },
          { exerciseName: 'Seated Shoulder Press', sets: 3, reps: '8-10', restSeconds: 90 },
          { exerciseName: 'Lateral Raise', sets: 3, reps: '12-15', restSeconds: 60 },
          { exerciseName: 'Triceps Pushdown', sets: 3, reps: '10-12', restSeconds: 60 },
        ],
      },
      {
        dayName: 'tuesday',
        workoutName: 'Pull A',
        workoutType: 'Pull',
        exercises: [
          { exerciseName: 'Pull Up', sets: 4, reps: '6-10', restSeconds: 120 },
          { exerciseName: 'Barbell Row', sets: 3, reps: '6-8', restSeconds: 120 },
          { exerciseName: 'Lat Pulldown', sets: 3, reps: '10-12', restSeconds: 90 },
          { exerciseName: 'Face Pull', sets: 3, reps: '12-15', restSeconds: 60 },
          { exerciseName: 'EZ Bar Curl', sets: 3, reps: '10-12', restSeconds: 60 },
        ],
      },
      {
        dayName: 'wednesday',
        workoutName: 'Legs A',
        workoutType: 'Legs',
        exercises: [
          { exerciseName: 'Back Squat', sets: 4, reps: '5-8', restSeconds: 150 },
          { exerciseName: 'Romanian Deadlift', sets: 3, reps: '8-10', restSeconds: 120 },
          { exerciseName: 'Leg Press', sets: 3, reps: '10-12', restSeconds: 90 },
          { exerciseName: 'Leg Curl', sets: 3, reps: '10-12', restSeconds: 75 },
          { exerciseName: 'Standing Calf Raise', sets: 4, reps: '12-15', restSeconds: 60 },
        ],
      },
      {
        dayName: 'thursday',
        workoutName: 'Push B',
        workoutType: 'Push',
        exercises: [
          { exerciseName: 'Incline Barbell Press', sets: 4, reps: '6-8', restSeconds: 120 },
          { exerciseName: 'Dumbbell Shoulder Press', sets: 3, reps: '8-10', restSeconds: 90 },
          { exerciseName: 'Cable Chest Fly', sets: 3, reps: '10-12', restSeconds: 75 },
          { exerciseName: 'Upright Row', sets: 3, reps: '10-12', restSeconds: 75 },
          { exerciseName: 'Overhead Triceps Extension', sets: 3, reps: '10-12', restSeconds: 60 },
        ],
      },
      {
        dayName: 'friday',
        workoutName: 'Pull B',
        workoutType: 'Pull',
        exercises: [
          { exerciseName: 'Deadlift', sets: 3, reps: '4-6', restSeconds: 150 },
          { exerciseName: 'Chest Supported Row', sets: 3, reps: '8-10', restSeconds: 90 },
          { exerciseName: 'Seated Cable Row', sets: 3, reps: '10-12', restSeconds: 90 },
          { exerciseName: 'Rear Delt Fly', sets: 3, reps: '12-15', restSeconds: 60 },
          { exerciseName: 'Hammer Curl', sets: 3, reps: '10-12', restSeconds: 60 },
        ],
      },
      {
        dayName: 'saturday',
        workoutName: 'Legs B',
        workoutType: 'Legs',
        exercises: [
          { exerciseName: 'Front Squat', sets: 4, reps: '5-8', restSeconds: 150 },
          { exerciseName: 'Hip Thrust', sets: 3, reps: '8-10', restSeconds: 120 },
          { exerciseName: 'Bulgarian Split Squat', sets: 3, reps: '8-10', restSeconds: 90 },
          { exerciseName: 'Leg Extension', sets: 3, reps: '12-15', restSeconds: 75 },
          { exerciseName: 'Seated Calf Raise', sets: 4, reps: '12-15', restSeconds: 60 },
        ],
      },
    ],
  },
  {
    id: 'splitpush',
    title: 'SP',
    subtitle: 'Split Push (5-day hybrid split).',
    daysPerWeek: 5,
    selectedDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
    weeklyWorkouts: [
      {
        dayName: 'monday',
        workoutName: 'Push Strength',
        workoutType: 'Push',
        exercises: [
          { exerciseName: 'Bench Press', sets: 4, reps: '5-6', restSeconds: 150 },
          { exerciseName: 'Overhead Press', sets: 4, reps: '5-6', restSeconds: 120 },
          { exerciseName: 'Incline Dumbbell Press', sets: 3, reps: '8-10', restSeconds: 90 },
          { exerciseName: 'Cable Lateral Raise', sets: 3, reps: '12-15', restSeconds: 60 },
          { exerciseName: 'Weighted Dips', sets: 3, reps: '6-8', restSeconds: 90 },
        ],
      },
      {
        dayName: 'tuesday',
        workoutName: 'Pull',
        workoutType: 'Pull',
        exercises: [
          { exerciseName: 'Pull Up', sets: 4, reps: '6-10', restSeconds: 120 },
          { exerciseName: 'Barbell Row', sets: 4, reps: '6-8', restSeconds: 120 },
          { exerciseName: 'Single Arm Dumbbell Row', sets: 3, reps: '8-10', restSeconds: 90 },
          { exerciseName: 'Face Pull', sets: 3, reps: '12-15', restSeconds: 60 },
          { exerciseName: 'Incline Dumbbell Curl', sets: 3, reps: '10-12', restSeconds: 60 },
        ],
      },
      {
        dayName: 'wednesday',
        workoutName: 'Legs',
        workoutType: 'Legs',
        exercises: [
          { exerciseName: 'Back Squat', sets: 4, reps: '5-8', restSeconds: 150 },
          { exerciseName: 'Romanian Deadlift', sets: 3, reps: '8-10', restSeconds: 120 },
          { exerciseName: 'Leg Press', sets: 3, reps: '10-12', restSeconds: 90 },
          { exerciseName: 'Leg Curl', sets: 3, reps: '10-12', restSeconds: 75 },
          { exerciseName: 'Standing Calf Raise', sets: 4, reps: '12-15', restSeconds: 60 },
        ],
      },
      {
        dayName: 'thursday',
        workoutName: 'Push Hypertrophy',
        workoutType: 'Push',
        exercises: [
          { exerciseName: 'Incline Barbell Press', sets: 4, reps: '8-10', restSeconds: 90 },
          { exerciseName: 'Dumbbell Shoulder Press', sets: 3, reps: '8-10', restSeconds: 90 },
          { exerciseName: 'Machine Chest Press', sets: 3, reps: '10-12', restSeconds: 75 },
          { exerciseName: 'Lateral Raise', sets: 4, reps: '12-20', restSeconds: 60 },
          { exerciseName: 'Triceps Rope Pushdown', sets: 3, reps: '10-15', restSeconds: 60 },
        ],
      },
      {
        dayName: 'friday',
        workoutName: 'Upper Balance',
        workoutType: 'Upper Body',
        exercises: [
          { exerciseName: 'Flat Dumbbell Press', sets: 3, reps: '8-10', restSeconds: 90 },
          { exerciseName: 'Chest Supported Row', sets: 3, reps: '8-10', restSeconds: 90 },
          { exerciseName: 'Lat Pulldown', sets: 3, reps: '10-12', restSeconds: 90 },
          { exerciseName: 'Rear Delt Fly', sets: 3, reps: '12-15', restSeconds: 60 },
          { exerciseName: 'Cable Curl', sets: 2, reps: '12-15', restSeconds: 60 },
        ],
      },
    ],
  },
  {
    id: 'upperlower',
    title: 'UL',
    subtitle: 'Upper / Lower (balanced 4-day split).',
    daysPerWeek: 4,
    selectedDays: ['monday', 'tuesday', 'thursday', 'friday'],
    weeklyWorkouts: [
      {
        dayName: 'monday',
        workoutName: 'Upper A',
        workoutType: 'Upper Body',
        exercises: [
          { exerciseName: 'Bench Press', sets: 4, reps: '6-8', restSeconds: 120 },
          { exerciseName: 'Barbell Row', sets: 4, reps: '6-8', restSeconds: 120 },
          { exerciseName: 'Seated Shoulder Press', sets: 3, reps: '8-10', restSeconds: 90 },
          { exerciseName: 'Lat Pulldown', sets: 3, reps: '10-12', restSeconds: 90 },
          { exerciseName: 'Triceps Pushdown', sets: 3, reps: '10-12', restSeconds: 60 },
        ],
      },
      {
        dayName: 'tuesday',
        workoutName: 'Lower A',
        workoutType: 'Lower Body',
        exercises: [
          { exerciseName: 'Back Squat', sets: 4, reps: '5-8', restSeconds: 150 },
          { exerciseName: 'Romanian Deadlift', sets: 3, reps: '8-10', restSeconds: 120 },
          { exerciseName: 'Walking Lunge', sets: 3, reps: '10/leg', restSeconds: 90 },
          { exerciseName: 'Leg Curl', sets: 3, reps: '10-12', restSeconds: 75 },
          { exerciseName: 'Standing Calf Raise', sets: 4, reps: '12-15', restSeconds: 60 },
        ],
      },
      {
        dayName: 'thursday',
        workoutName: 'Upper B',
        workoutType: 'Upper Body',
        exercises: [
          { exerciseName: 'Incline Dumbbell Press', sets: 4, reps: '8-10', restSeconds: 90 },
          { exerciseName: 'Chest Supported Row', sets: 4, reps: '8-10', restSeconds: 90 },
          { exerciseName: 'Dumbbell Lateral Raise', sets: 3, reps: '12-15', restSeconds: 60 },
          { exerciseName: 'Cable Row', sets: 3, reps: '10-12', restSeconds: 90 },
          { exerciseName: 'EZ Bar Curl', sets: 3, reps: '10-12', restSeconds: 60 },
        ],
      },
      {
        dayName: 'friday',
        workoutName: 'Lower B',
        workoutType: 'Lower Body',
        exercises: [
          { exerciseName: 'Front Squat', sets: 4, reps: '6-8', restSeconds: 150 },
          { exerciseName: 'Hip Thrust', sets: 3, reps: '8-10', restSeconds: 120 },
          { exerciseName: 'Leg Press', sets: 3, reps: '10-12', restSeconds: 90 },
          { exerciseName: 'Leg Extension', sets: 3, reps: '12-15', restSeconds: 75 },
          { exerciseName: 'Seated Calf Raise', sets: 4, reps: '12-15', restSeconds: 60 },
        ],
      },
    ],
  },
];

const clampWorkoutDays = (value: number) => {
  if (!Number.isFinite(value)) return 4;
  return Math.max(2, Math.min(6, Math.round(value)));
};

const recommendTemplateByDays = (daysPerWeek: number): ProgramTemplate['id'] => {
  if (daysPerWeek >= 6) return 'ppl';
  if (daysPerWeek >= 5) return 'splitpush';
  return 'upperlower';
};

const mapAiWorkoutTypesToTemplate = (
  suggestedWorkoutTypes: string[],
  workoutDays: number,
): ProgramTemplate['id'] => {
  const joined = suggestedWorkoutTypes.join(' ').toLowerCase();
  if (/upper|lower/.test(joined)) return 'upperlower';
  if (/push|pull|legs|ppl/.test(joined)) {
    return workoutDays >= 6 ? 'ppl' : 'splitpush';
  }
  return recommendTemplateByDays(workoutDays);
};

const mapStoredSplitPreferenceToTemplate = (
  splitPreference: unknown,
  workoutDays: number,
): ProgramTemplate['id'] | null => {
  const normalized = String(splitPreference || '').trim().toLowerCase();
  if (!normalized || normalized === 'auto' || normalized === 'custom') return null;
  if (normalized === 'upper_lower' || normalized === 'full_body') return 'upperlower';
  if (normalized === 'push_pull_legs' || normalized === 'hybrid') {
    return workoutDays >= 6 ? 'ppl' : 'splitpush';
  }
  return null;
};

const readStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem('appUser') || localStorage.getItem('user') || '{}');
  } catch {
    return {};
  }
};

export function PresetProgramScreen({ onBack, onSaved, onBuildCustom }: PresetProgramScreenProps) {
  const [language, setLanguage] = useState<AppLanguage>(() => getActiveLanguage());
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [workoutDays, setWorkoutDays] = useState(4);
  const [recommendedTemplateId, setRecommendedTemplateId] = useState<ProgramTemplate['id']>('upperlower');
  const [selectedTemplateId, setSelectedTemplateId] = useState<ProgramTemplate['id'] | null>(null);
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
  const copy = isArabic
    ? {
      title: 'البرامج المخصصة',
      loadingNote: 'الذكاء الاصطناعي يجهز أفضل تقسيمة لك.',
      selectPlanFirst: 'اختر بطاقة خطة أولاً (PPL أو SP أو UL).',
      noSession: 'لم يتم العثور على جلسة مستخدم نشطة.',
      saveFailed: 'تعذر حفظ البرنامج.',
      recommendedByAi: 'مقترح من الذكاء الاصطناعي',
      aiRecommends: (title: string) => `يقترح الذكاء الاصطناعي ${title} لملفك الشخصي.`,
      aiSignals: (signals: string[], level: string) =>
        `إشارات الذكاء الاصطناعي: ${signals.join('، ')}${level ? ` | المستوى: ${level}` : ''}.`,
      aiFallback: (days: number) => `اختار الذكاء الاصطناعي هذه التقسيمة بناءً على ${days} أيام تدريب أسبوعياً.`,
      recommended: 'مقترح',
      daysPerWeek: (value: number) => `${value} أيام/الأسبوع`,
      buildManualPlan: 'إنشاء خطة يدوية',
      buildManualPlanBody: 'أنشئ خطتك بنفسك، ثم أكدها أو أرسلها للمدرب للمراجعة.',
      customBuilder: 'منشئ مخصص',
      hiddenUntilSelect: 'تفاصيل الأيام والبرنامج مخفية حتى تضغط على بطاقة خطة.',
      availableDays: 'الأيام المتاحة (تلقائياً من الخطة المختارة)',
      twoMonthProgram: (title: string) => `برنامج ${title} لشهرين`,
      repeatsForEightWeeks: 'يتكرر الجدول الأسبوعي أدناه لمدة 8 أسابيع.',
      weekChip: (value: number) => `أ${value}`,
      sets: (value: number) => `${value} مجموعات`,
      rest: (value: number) => `${value}ث راحة`,
      save: 'احفظ هذه الخطة',
      saving: 'جارٍ الحفظ...',
      enableSaveHint: 'اختر بطاقة خطة أولاً لتفعيل الحفظ.',
      savedSuccess: (title: string) => `تم حفظ ${title} كخطتك النشطة.`,
      subtitle: {
        ppl: 'تقسيمة دفع/سحب/أرجل الكلاسيكية لمدة 6 أيام بحجم تدريبي مرتفع.',
        splitpush: 'تقسيمة Push هجينة على 5 أيام.',
        upperlower: 'تقسيمة علوي / سفلي متوازنة على 4 أيام.',
      },
    }
    : {
      title: 'Customized Programs',
      loadingNote: 'AI is preparing your best split recommendation.',
      selectPlanFirst: 'Select a plan card first (PPL, SP, or UL).',
      noSession: 'No active user session found.',
      saveFailed: 'Failed to save program.',
      recommendedByAi: 'Recommended by AI',
      aiRecommends: (title: string) => `AI recommends ${title} for your profile.`,
      aiSignals: (signals: string[], level: string) =>
        `AI signals: ${signals.join(', ')}${level ? ` | level: ${level}` : ''}.`,
      aiFallback: (days: number) => `AI analyzed your profile and selected this split for ${days} days/week.`,
      recommended: 'Recommended',
      daysPerWeek: (value: number) => `${value} days/week`,
      buildManualPlan: 'Build Manual Plan',
      buildManualPlanBody: 'Create your own plan, then confirm it or send it to coach for validation.',
      customBuilder: 'Custom builder',
      hiddenUntilSelect: 'Days and program details are hidden until you click a plan card.',
      availableDays: 'Available Days (auto from selected plan)',
      twoMonthProgram: (title: string) => `${title} - 2 Month Program`,
      repeatsForEightWeeks: 'Weekly split below repeats for 8 weeks.',
      weekChip: (value: number) => `W${value}`,
      sets: (value: number) => `${value} sets`,
      rest: (value: number) => `${value}s rest`,
      save: 'Save This Plan',
      saving: 'Saving...',
      enableSaveHint: 'Select a plan card first to enable save.',
      savedSuccess: (title: string) => `${title} saved as your active plan.`,
      subtitle: {
        ppl: 'Classic Push/Pull/Legs done 6 days for high volume.',
        splitpush: 'Split Push (5-day hybrid split).',
        upperlower: 'Upper / Lower (balanced 4-day split).',
      },
    };

  const templateById = useMemo(() => {
    const map = new Map<ProgramTemplate['id'], ProgramTemplate>();
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
          resolvedDays,
        );
        let recommended = storedSplitRecommendation || recommendTemplateByDays(resolvedDays);
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
        cycleWeeks: 8,
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
    <div className="flex-1 flex flex-col h-full bg-background pb-24">
      <div className="px-4 sm:px-6 pt-2">
        <Header title={copy.title} onBack={onBack} />
      </div>

      <div className="px-4 sm:px-6 pt-2 space-y-4">
        {error && (
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 text-red-300 text-sm p-3">
            {error}
          </div>
        )}
        {success && (
          <div className="rounded-xl border border-green-500/40 bg-green-500/10 text-green-300 text-sm p-3">
            {success}
          </div>
        )}

        <div className="bg-card border border-white/10 rounded-xl p-4">
          <div className="text-sm text-text-secondary">{copy.recommendedByAi}</div>
          <div className="text-white mt-1">
            {copy.aiRecommends(templateById.get(recommendedTemplateId)?.title || 'UL')}
          </div>
          <div className="text-xs text-text-secondary mt-1">
            {aiRecommendationNote}
          </div>
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
                className={`text-left rounded-xl border p-4 transition-colors ${
                  isSelected
                    ? 'border-accent bg-accent/10'
                    : 'border-white/10 bg-card hover:bg-white/5'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="text-white font-semibold">{template.title}</div>
                  {isRecommended && (
                    <span className="text-[10px] uppercase tracking-wide px-2 py-1 rounded border border-accent/50 text-accent bg-accent/10">
                      {copy.recommended}
                    </span>
                  )}
                </div>
                <div className="text-xs text-text-secondary mt-1">{copy.subtitle[template.id]}</div>
                <div className="text-xs text-text-tertiary mt-3">{copy.daysPerWeek(template.daysPerWeek)}</div>
              </button>
            );
          })}

          <button
            type="button"
            onClick={onBuildCustom}
            className="text-left rounded-xl border border-white/10 bg-card p-4 hover:bg-white/5 transition-colors"
          >
            <div className="text-white font-semibold">{copy.buildManualPlan}</div>
            <div className="text-xs text-text-secondary mt-1">
              {copy.buildManualPlanBody}
            </div>
            <div className="text-xs text-text-tertiary mt-3">{copy.customBuilder}</div>
          </button>
        </div>

        {!selectedTemplate && (
          <div className="bg-card border border-white/10 rounded-xl p-4 text-sm text-text-secondary">
            {copy.hiddenUntilSelect}
          </div>
        )}

        {selectedTemplate && (
          <>
            <div className="bg-card border border-white/10 rounded-xl p-4">
              <div className="text-sm text-text-secondary">{copy.availableDays}</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {selectedTemplateDays.map((day) => (
                  <span
                    key={`selected-day-${day}`}
                    className="text-xs px-2.5 py-1 rounded-full border border-accent/40 bg-accent/10 text-accent"
                  >
                    {formatWorkoutDayShortLabel(day, DAY_LABELS[day] || day, language)}
                  </span>
                ))}
              </div>
            </div>

            <div className="rounded-xl p-4 space-y-3 border bg-accent/5 border-accent/40">
              <div>
                <div className="text-white font-semibold">{copy.twoMonthProgram(selectedTemplate.title)}</div>
                <div className="text-xs text-text-secondary mt-1">{copy.repeatsForEightWeeks}</div>
              </div>

              <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                {Array.from({ length: 8 }, (_, index) => (
                  <div
                    key={`${selectedTemplate.id}-week-${index + 1}`}
                    className="text-center text-xs rounded-lg border border-white/10 bg-background py-2 text-text-secondary"
                  >
                    {copy.weekChip(index + 1)}
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                {selectedTemplate.weeklyWorkouts.map((workout) => (
                  <div key={`${selectedTemplate.id}-${workout.dayName}`} className="rounded-lg border border-white/10 bg-background p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-white text-sm font-medium">
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
            className="w-full bg-accent text-black font-semibold rounded-xl p-3 hover:bg-accent/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isSaving ? copy.saving : copy.save}
          </button>
          {!selectedTemplate && (
            <div className="text-xs text-text-secondary text-center">
              {copy.enableSaveHint}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
