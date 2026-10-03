import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Sparkles } from 'lucide-react';
import { Header } from '../components/ui/Header';
import { Card } from '../components/ui/Card';
import { getBodyPartImage } from '../services/bodyPartTheme';
import { api } from '../services/api';
import { AppLanguage, LocalizedLanguageRecord, getActiveLanguage, getStoredLanguage } from '../services/language';
import { recordBookApplied } from '../services/bookUsage';
import { getAssignedBookPlan, getPlanSwitchPrompt } from '../services/bookPlanSelection';

interface T3PlanScreenProps {
  onBack: () => void;
}

type T3Exercise = {
  name: string;
  sets: number;
  reps: string;
  targetRPE: string;
  restSecondsMin: number;
  restSecondsMax: number;
  primaryMuscles: string[];
  secondaryMuscles?: string[];
  movementPattern: string;
  coachingCues?: string[];
};

type T3Day = {
  dayLabel: string;
  dayName: string;
  focus: string;
  summary: string;
  targetMuscles: string[];
  isRest?: boolean;
  exercises: T3Exercise[];
};

const COPY: LocalizedLanguageRecord<{
  title: string;
  badge: string;
  summary: string;
  usePlan: string;
  usingPlan: string;
  activePlan: string;
  modalTitle: string;
  modalBody: string;
  modalHint: string;
  confirm: string;
  cancel: string;
  noSession: string;
  saveFailed: string;
  success: string;
  payloadName: string;
  payloadDescription: string;
}> = {
  en: {
    title: 'T-3 PLP + Upper/Lower',
    badge: 'RepSet Hypertrophy Template',
    summary: 'An 8-week Pull / Legs / Push / Rest / Upper / Lower / Rest hypertrophy plan built around fundamentals, double progression, RPE control, and lower-body recovery spacing.',
    usePlan: 'Use As My Plan',
    usingPlan: 'Saving...',
    activePlan: 'Active In My Plan',
    modalTitle: 'Choose T-3 as your personal plan?',
    modalBody: 'This will save T-3 as your active plan on the My Plan page.',
    modalHint: 'The plan keeps Tuesday Legs and Saturday Lower at least 72 hours apart.',
    confirm: 'Yes, Use T-3',
    cancel: 'Cancel',
    noSession: 'No active user session found.',
    saveFailed: 'Failed to save T-3 as your plan.',
    success: 'T-3 is now saved as your active plan in My Plan.',
    payloadName: 'T-3 PLP + Upper/Lower Personal Plan',
    payloadDescription: 'T-3 PLP plus Upper/Lower hypertrophy template applied as an active personal plan.',
  },
  ar: {
    title: 'T-3 PLP + Upper/Lower',
    badge: 'RepSet Hypertrophy Template',
    summary: 'خطة تضخيم 8 أسابيع بنظام Pull / Legs / Push / Rest / Upper / Lower / Rest مع تدرج مزدوج وتحكم RPE.',
    usePlan: 'اجعلها خطتي',
    usingPlan: 'جار الحفظ...',
    activePlan: 'مفعلة في خطتي',
    modalTitle: 'هل تريد اختيار T-3 كخطتك الشخصية؟',
    modalBody: 'سيتم حفظ T-3 كخطتك النشطة داخل صفحة خطتي.',
    modalHint: 'تحافظ الخطة على 72 ساعة على الأقل بين تمارين الأرجل المباشرة.',
    confirm: 'نعم، اختر T-3',
    cancel: 'إلغاء',
    noSession: 'لا توجد جلسة مستخدم نشطة.',
    saveFailed: 'تعذر حفظ T-3 كخطتك.',
    success: 'تم حفظ T-3 كخطتك النشطة داخل صفحة خطتي.',
    payloadName: 'خطة T-3 PLP + Upper/Lower الشخصية',
    payloadDescription: 'تم تطبيق قالب T-3 للتضخيم كخطة شخصية نشطة.',
  },
  it: {
    title: 'T-3 PLP + Upper/Lower',
    badge: 'Template Ipertrofia RepSet',
    summary: 'Piano ipertrofia di 8 settimane: Pull / Legs / Push / Rest / Upper / Lower / Rest con doppia progressione e controllo RPE.',
    usePlan: 'Usalo Come Mio Piano',
    usingPlan: 'Salvataggio...',
    activePlan: 'Attivo In My Plan',
    modalTitle: 'Vuoi scegliere T-3 come piano personale?',
    modalBody: 'Questo salvera T-3 come piano attivo nella pagina My Plan.',
    modalHint: 'Il piano mantiene almeno 72 ore tra le sedute lower dirette.',
    confirm: 'Si, usa T-3',
    cancel: 'Annulla',
    noSession: 'Nessuna sessione utente attiva trovata.',
    saveFailed: 'Impossibile salvare T-3 come tuo piano.',
    success: 'T-3 ora e salvato come piano attivo in My Plan.',
    payloadName: 'Piano Personale T-3 PLP + Upper/Lower',
    payloadDescription: 'Template T-3 ipertrofia applicato come piano personale attivo.',
  },
  de: {
    title: 'T-3 PLP + Upper/Lower',
    badge: 'RepSet-Hypertrophie-Vorlage',
    summary: '8-Wochen-Hypertrophieplan: Pull / Legs / Push / Rest / Upper / Lower / Rest mit Double Progression und RPE-Steuerung.',
    usePlan: 'Als Meinen Plan Nutzen',
    usingPlan: 'Speichern...',
    activePlan: 'In My Plan Aktiv',
    modalTitle: 'Moechtest du T-3 als deinen persoenlichen Plan waehlen?',
    modalBody: 'Dadurch wird T-3 als aktiver Plan auf der Seite My Plan gespeichert.',
    modalHint: 'Der Plan haelt mindestens 72 Stunden zwischen direkten Lower-Sessions ein.',
    confirm: 'Ja, T-3 nutzen',
    cancel: 'Abbrechen',
    noSession: 'Keine aktive Benutzersitzung gefunden.',
    saveFailed: 'T-3 konnte nicht als dein Plan gespeichert werden.',
    success: 'T-3 ist jetzt als aktiver Plan in My Plan gespeichert.',
    payloadName: 'T-3 PLP + Upper/Lower Persoenlicher Plan',
    payloadDescription: 'T-3-Hypertrophievorlage als aktiver persoenlicher Plan angewendet.',
  },
  fr: {
    title: 'T-3 PLP + Upper/Lower',
    badge: 'Modele Hypertrophie RepSet',
    summary: 'Plan hypertrophie de 8 semaines: Pull / Legs / Push / Rest / Upper / Lower / Rest avec double progression et controle RPE.',
    usePlan: 'Utiliser Comme Mon Plan',
    usingPlan: 'Enregistrement...',
    activePlan: 'Actif Dans My Plan',
    modalTitle: 'Choisir T-3 comme plan personnel ?',
    modalBody: 'T-3 sera enregistre comme plan actif dans My Plan.',
    modalHint: 'Le plan garde au moins 72 heures entre les seances bas du corps directes.',
    confirm: 'Oui, utiliser T-3',
    cancel: 'Annuler',
    noSession: 'Aucune session utilisateur active.',
    saveFailed: 'Impossible de sauvegarder T-3 comme plan.',
    success: 'T-3 est maintenant ton plan actif dans My Plan.',
    payloadName: 'Plan Personnel T-3 PLP + Upper/Lower',
    payloadDescription: 'Modele T-3 hypertrophie applique comme plan personnel actif.',
  },
};

const days: T3Day[] = [
  {
    dayLabel: 'Day 1',
    dayName: 'monday',
    focus: 'Pull',
    summary: 'Lats, upper/mid back, rear delts, biceps, and brachialis.',
    targetMuscles: ['back', 'biceps', 'shoulder back'],
    exercises: [
      { name: 'Lat Pulldown', sets: 3, reps: '6-10', targetRPE: '7-8', restSecondsMin: 120, restSecondsMax: 180, primaryMuscles: ['latissimus dorsi'], secondaryMuscles: ['biceps', 'brachialis', 'teres major', 'mid trapezius'], movementPattern: 'vertical_pull', coachingCues: ['Pull elbows down toward the sides', 'Avoid excessive torso swinging', 'Control the eccentric'] },
      { name: 'Chest-Supported T-Bar Row', sets: 3, reps: '8-12', targetRPE: '8', restSecondsMin: 120, restSecondsMax: 180, primaryMuscles: ['latissimus dorsi', 'middle trapezius', 'rhomboids'], secondaryMuscles: ['rear deltoid', 'biceps', 'brachialis'], movementPattern: 'horizontal_pull' },
      { name: 'Cable Seated Row', sets: 3, reps: '10-12', targetRPE: '8', restSecondsMin: 120, restSecondsMax: 180, primaryMuscles: ['latissimus dorsi', 'middle back'], secondaryMuscles: ['biceps', 'rear deltoids', 'traps'], movementPattern: 'horizontal_pull' },
      { name: 'Seated Face Pull', sets: 3, reps: '12-15', targetRPE: '8', restSecondsMin: 60, restSecondsMax: 120, primaryMuscles: ['posterior deltoid', 'middle trapezius', 'lower trapezius'], secondaryMuscles: ['rotator cuff'], movementPattern: 'horizontal_abduction_external_rotation' },
      { name: 'Dumbbell Supinated Curl', sets: 3, reps: '8-12', targetRPE: '8', restSecondsMin: 60, restSecondsMax: 120, primaryMuscles: ['biceps'], secondaryMuscles: ['brachialis', 'forearms'], movementPattern: 'elbow_flexion_supination' },
      { name: 'Hammer Curl', sets: 2, reps: '10-12', targetRPE: '8', restSecondsMin: 60, restSecondsMax: 120, primaryMuscles: ['brachialis', 'brachioradialis'], secondaryMuscles: ['biceps'], movementPattern: 'neutral_grip_elbow_flexion' },
    ],
  },
  {
    dayLabel: 'Day 2',
    dayName: 'tuesday',
    focus: 'Legs',
    summary: 'Quad emphasis with glutes, hamstrings, calves, and abs.',
    targetMuscles: ['Quadriceps', 'Gluteus butt muscles', 'hamstring'],
    exercises: [
      { name: 'Back Squat', sets: 3, reps: '6-8', targetRPE: '7-8', restSecondsMin: 180, restSecondsMax: 240, primaryMuscles: ['quadriceps', 'gluteus maximus'], secondaryMuscles: ['adductors', 'spinal erectors', 'hamstrings'], movementPattern: 'squat' },
      { name: 'Romanian Deadlift', sets: 3, reps: '8-10', targetRPE: '7-8', restSecondsMin: 120, restSecondsMax: 180, primaryMuscles: ['hamstrings', 'gluteus maximus'], secondaryMuscles: ['spinal erectors', 'adductors'], movementPattern: 'hip_hinge' },
      { name: 'Leg Press', sets: 3, reps: '10-12', targetRPE: '8', restSecondsMin: 120, restSecondsMax: 120, primaryMuscles: ['quadriceps'], secondaryMuscles: ['glutes', 'adductors'], movementPattern: 'squat_press' },
      { name: 'Lying Leg Curl', sets: 3, reps: '10-15', targetRPE: '8-9', restSecondsMin: 60, restSecondsMax: 120, primaryMuscles: ['hamstrings'], movementPattern: 'knee_flexion' },
      { name: 'Standing Calf Raise', sets: 3, reps: '8-12', targetRPE: '8', restSecondsMin: 60, restSecondsMax: 120, primaryMuscles: ['gastrocnemius', 'soleus'], movementPattern: 'plantar_flexion' },
      { name: 'Crunch', sets: 3, reps: '10-15', targetRPE: '8', restSecondsMin: 60, restSecondsMax: 120, primaryMuscles: ['rectus abdominis'], secondaryMuscles: ['obliques'], movementPattern: 'spinal_flexion' },
    ],
  },
  {
    dayLabel: 'Day 3',
    dayName: 'wednesday',
    focus: 'Push',
    summary: 'Chest, anterior delts, lateral delts, and triceps.',
    targetMuscles: ['chest', 'shoulder', 'triceps'],
    exercises: [
      { name: 'Barbell Bench Press', sets: 3, reps: '6-8', targetRPE: '7-8', restSecondsMin: 180, restSecondsMax: 240, primaryMuscles: ['pectoralis major'], secondaryMuscles: ['anterior deltoid', 'triceps'], movementPattern: 'horizontal_press' },
      { name: 'Dumbbell Incline Press', sets: 3, reps: '8-10', targetRPE: '8', restSecondsMin: 120, restSecondsMax: 180, primaryMuscles: ['upper chest'], secondaryMuscles: ['anterior deltoid', 'triceps'], movementPattern: 'incline_press' },
      { name: 'Assisted Dip', sets: 3, reps: '8-12', targetRPE: '8', restSecondsMin: 120, restSecondsMax: 120, primaryMuscles: ['pectoralis major', 'triceps'], secondaryMuscles: ['anterior deltoid'], movementPattern: 'dip_press' },
      { name: 'Cable Lateral Raise', sets: 3, reps: '12-15', targetRPE: '8-9', restSecondsMin: 60, restSecondsMax: 120, primaryMuscles: ['lateral deltoid'], secondaryMuscles: ['supraspinatus', 'upper trapezius'], movementPattern: 'shoulder_abduction' },
      { name: 'Single Arm Rope Triceps Extension', sets: 3, reps: '10-15', targetRPE: '8', restSecondsMin: 60, restSecondsMax: 120, primaryMuscles: ['triceps'], movementPattern: 'elbow_extension' },
    ],
  },
  { dayLabel: 'Day 4', dayName: 'thursday', focus: 'Rest', summary: 'No hypertrophy workout.', targetMuscles: [], isRest: true, exercises: [] },
  {
    dayLabel: 'Day 5',
    dayName: 'friday',
    focus: 'Upper',
    summary: 'Second weekly upper-body exposure.',
    targetMuscles: ['shoulder', 'back', 'chest'],
    exercises: [
      { name: 'Overhead Press', sets: 3, reps: '6-8', targetRPE: '7-8', restSecondsMin: 180, restSecondsMax: 240, primaryMuscles: ['anterior deltoid', 'lateral deltoid'], secondaryMuscles: ['triceps', 'upper trapezius'], movementPattern: 'vertical_press' },
      { name: 'Neutral-Grip Pulldown', sets: 3, reps: '8-10', targetRPE: '8', restSecondsMin: 120, restSecondsMax: 180, primaryMuscles: ['latissimus dorsi'], secondaryMuscles: ['biceps', 'brachialis'], movementPattern: 'vertical_pull' },
      { name: 'Dumbbell Incline Press', sets: 3, reps: '8-12', targetRPE: '8', restSecondsMin: 120, restSecondsMax: 180, primaryMuscles: ['upper chest'], secondaryMuscles: ['anterior deltoid', 'triceps'], movementPattern: 'incline_press' },
      { name: 'Dumbbell Row', sets: 3, reps: '8-12', targetRPE: '8', restSecondsMin: 120, restSecondsMax: 180, primaryMuscles: ['lats', 'mid back'], secondaryMuscles: ['biceps', 'rear deltoid'], movementPattern: 'horizontal_pull' },
      { name: 'Cable Lateral Raise', sets: 3, reps: '12-15', targetRPE: '8-9', restSecondsMin: 60, restSecondsMax: 120, primaryMuscles: ['lateral deltoid'], movementPattern: 'shoulder_abduction' },
      { name: 'EZ Bar Curl', sets: 2, reps: '10-15', targetRPE: '8', restSecondsMin: 60, restSecondsMax: 120, primaryMuscles: ['biceps'], movementPattern: 'elbow_flexion' },
      { name: 'Rope Triceps Extension', sets: 2, reps: '10-15', targetRPE: '8', restSecondsMin: 60, restSecondsMax: 120, primaryMuscles: ['triceps'], movementPattern: 'elbow_extension' },
    ],
  },
  {
    dayLabel: 'Day 6',
    dayName: 'saturday',
    focus: 'Lower',
    summary: 'Posterior emphasis with heavy hinge work, glutes, quads, calves, and abs.',
    targetMuscles: ['Gluteus butt muscles', 'hamstring', 'Quadriceps'],
    exercises: [
      { name: 'Deadlift', sets: 3, reps: '4-6', targetRPE: '7-8', restSecondsMin: 180, restSecondsMax: 240, primaryMuscles: ['gluteus maximus', 'hamstrings', 'spinal erectors'], secondaryMuscles: ['lats', 'traps', 'forearms', 'quadriceps'], movementPattern: 'hip_hinge_pull' },
      { name: 'Dumbbell Walking Lunge', sets: 3, reps: '8-12 each leg', targetRPE: '8', restSecondsMin: 120, restSecondsMax: 180, primaryMuscles: ['quadriceps', 'gluteus maximus'], secondaryMuscles: ['hamstrings', 'adductors', 'gluteus medius'], movementPattern: 'unilateral_lunge' },
      { name: 'Barbell Hip Thrust', sets: 3, reps: '8-12', targetRPE: '8', restSecondsMin: 120, restSecondsMax: 180, primaryMuscles: ['gluteus maximus'], secondaryMuscles: ['hamstrings', 'adductors'], movementPattern: 'hip_extension' },
      { name: 'Leg Extension', sets: 3, reps: '12-15', targetRPE: '8-9', restSecondsMin: 60, restSecondsMax: 120, primaryMuscles: ['quadriceps'], movementPattern: 'knee_extension' },
      { name: 'Seated Leg Curl', sets: 3, reps: '10-15', targetRPE: '8-9', restSecondsMin: 60, restSecondsMax: 120, primaryMuscles: ['hamstrings'], movementPattern: 'knee_flexion' },
      { name: 'Machine Hip Abduction', sets: 2, reps: '15-20', targetRPE: '8-9', restSecondsMin: 60, restSecondsMax: 120, primaryMuscles: ['gluteus medius', 'gluteus minimus'], secondaryMuscles: ['gluteus maximus'], movementPattern: 'hip_abduction' },
      { name: 'Standing Calf Raise', sets: 3, reps: '10-15', targetRPE: '8', restSecondsMin: 60, restSecondsMax: 120, primaryMuscles: ['gastrocnemius', 'soleus'], movementPattern: 'plantar_flexion' },
      { name: 'Hanging Leg Raise', sets: 3, reps: '8-15', targetRPE: '8', restSecondsMin: 60, restSecondsMax: 120, primaryMuscles: ['rectus abdominis'], secondaryMuscles: ['hip flexors'], movementPattern: 'spinal_flexion' },
    ],
  },
  { dayLabel: 'Day 7', dayName: 'sunday', focus: 'Rest', summary: 'No resistance workout.', targetMuscles: [], isRest: true, exercises: [] },
];

const getStoredUserId = () => {
  if (typeof window === 'undefined') return 0;
  try {
    const localUser = JSON.parse(localStorage.getItem('appUser') || localStorage.getItem('user') || '{}');
    return Number(localStorage.getItem('appUserId') || localStorage.getItem('userId') || localUser?.id || 0);
  } catch {
    return Number(localStorage.getItem('appUserId') || localStorage.getItem('userId') || 0);
  }
};

const buildPayload = (language: AppLanguage) => {
  const copy = COPY[language] || COPY.en;
  const weeklyWorkouts = days.filter((day) => !day.isRest).map((day) => ({
    dayName: day.dayName,
    workoutName: `T-3 - ${day.focus}`,
    workoutType: 'Custom',
    targetMuscles: day.targetMuscles,
    notes: `${day.summary} Progress with reps first, then load, while keeping target RPE and technique intact.`,
    exercises: day.exercises.map((exercise) => ({
      exerciseName: exercise.name,
      sets: exercise.sets,
      reps: exercise.reps,
      restSeconds: exercise.restSecondsMin,
      rpeTarget: Number(String(exercise.targetRPE).match(/\d+(?:\.\d+)?$/)?.[0] || String(exercise.targetRPE).match(/\d+(?:\.\d+)?/)?.[0] || 8),
      targetWeight: 20,
      targetMuscles: exercise.primaryMuscles,
      notes: [
        `Target RPE: ${exercise.targetRPE}`,
        `Rest: ${exercise.restSecondsMin}-${exercise.restSecondsMax} sec`,
        `Pattern: ${exercise.movementPattern}`,
        exercise.secondaryMuscles?.length ? `Secondary: ${exercise.secondaryMuscles.join(', ')}` : '',
        ...(exercise.coachingCues || []),
      ].filter(Boolean).join(' | '),
    })),
  }));

  const weekPlans = Array.from({ length: 8 }, (_, index) => ({
    weekNumber: index + 1,
    weeklyWorkouts,
  }));

  return {
    planName: copy.payloadName,
    description: copy.payloadDescription,
    cycleWeeks: 8,
    templateWeekCount: 1,
    selectedDays: weeklyWorkouts.map((workout) => workout.dayName),
    weeklyWorkouts,
    weekPlans,
    bookScheduleConfig: {
      scheduleMode: 'fixed_weekday',
      weekStartsOn: 'monday',
    },
    t3PlanConfig: {
      planKind: 't3-plp-upper-lower',
      strategy: 'plp_upper_lower',
      recoveryEngineVersion: 'v3',
      minimumLowerBodyRecoveryHours: 72,
      weeklySchedule: ['Pull', 'Legs', 'Push', 'Rest', 'Upper', 'Lower', 'Rest'],
    },
  };
};

export function T3PlanScreen({ onBack }: T3PlanScreenProps) {
  const [language, setLanguage] = useState<AppLanguage>(() => getActiveLanguage());
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [assignedPlan, setAssignedPlan] = useState(() => getAssignedBookPlan());
  const copy = useMemo(() => COPY[language] || COPY.en, [language]);
  const isArabic = language === 'ar';
  const isCurrentPlanActive = assignedPlan.id === 't-3';
  const modalCopy = useMemo(() => {
    if (assignedPlan.id && assignedPlan.id !== 't-3') {
      return getPlanSwitchPrompt({
        language,
        currentPlanName: assignedPlan.name || 'your current plan',
        nextPlanName: copy.title,
      });
    }

    return {
      title: copy.modalTitle,
      body: copy.modalBody,
      hint: copy.modalHint,
    };
  }, [assignedPlan.id, assignedPlan.name, copy.modalBody, copy.modalHint, copy.modalTitle, copy.title, language]);

  useEffect(() => {
    const syncAssignedPlan = () => setAssignedPlan(getAssignedBookPlan());
    const handleLanguageChanged = () => setLanguage(getStoredLanguage());
    const handleStorage = () => {
      handleLanguageChanged();
      syncAssignedPlan();
    };
    window.addEventListener('app-language-changed', handleLanguageChanged);
    window.addEventListener('program-updated', syncAssignedPlan);
    window.addEventListener('storage', handleStorage);
    syncAssignedPlan();
    return () => {
      window.removeEventListener('app-language-changed', handleLanguageChanged);
      window.removeEventListener('program-updated', syncAssignedPlan);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  const handleApplyPlan = async () => {
    setError(null);
    setSuccess(null);
    const userId = getStoredUserId();
    if (!userId) {
      setError(copy.noSession);
      return;
    }

    const payload = buildPayload(language);
    setIsApplying(true);
    try {
      const result = await api.saveCustomProgram(userId, payload);
      if (!result?.success) throw new Error(result?.error || copy.saveFailed);
      if (typeof window !== 'undefined') {
        localStorage.removeItem('recoveryNeedsUpdate');
        localStorage.setItem('assignedProgramTemplate', JSON.stringify({
          ...(result?.assignedProgram || {}),
          ...payload,
          templateWeekPlans: payload.weekPlans,
          repeatedWeekPlans: payload.weekPlans,
        }));
        setAssignedPlan({ id: 't-3', name: payload.planName });
        recordBookApplied('t-3', userId);
        window.dispatchEvent(new CustomEvent('program-updated'));
      }
      setIsConfirmOpen(false);
      setSuccess(copy.success);
    } catch (saveError) {
      console.error('Failed to save T-3 plan:', saveError);
      setError(saveError instanceof Error ? saveError.message : copy.saveFailed);
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-1 flex-col bg-background pb-24">
      <div className="px-4 pt-2 sm:px-6">
        <Header
          title={copy.title}
          onBack={onBack}
          rightElement={(
            <button
              type="button"
              onClick={() => {
                if (!isCurrentPlanActive) setIsConfirmOpen(true);
              }}
              disabled={isApplying || isCurrentPlanActive}
              className={`rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] transition-colors ${
                isCurrentPlanActive
                  ? 'cursor-not-allowed bg-emerald-500/15 text-emerald-200'
                  : 'bg-accent/15 text-accent hover:bg-accent/20'
              } ${isApplying ? 'cursor-wait opacity-70' : ''}`}
            >
              {isApplying ? copy.usingPlan : (isCurrentPlanActive ? copy.activePlan : copy.usePlan)}
            </button>
          )}
        />
      </div>

      <div className="space-y-5 px-4 sm:px-6">
        {error && <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div>}
        {success && <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">{success}</div>}

        <Card className="overflow-hidden border border-accent/20 bg-[radial-gradient(circle_at_top_left,rgba(201,255,89,0.18),transparent_35%),linear-gradient(135deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] p-5">
          <div className="mb-2 inline-flex rounded-full bg-emerald-500/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-200">
            {copy.badge}
          </div>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="font-electrolize text-2xl text-white">T-3</h2>
              <p className="mt-2 max-w-2xl text-sm text-text-secondary">{copy.summary}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-text-secondary">8 Weeks</span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-text-secondary">5 Lift Days</span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-text-secondary">72h Lower Rule</span>
            </div>
          </div>
        </Card>

        <Card className="border border-white/12 bg-white/5 p-5">
          <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-text-secondary">Weekly Schedule</h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-7">
            {days.map((day) => (
              <div key={day.dayLabel} className={`rounded-2xl border px-3 py-3 ${day.isRest ? 'border-white/10 bg-black/10' : 'border-accent/20 bg-accent/5'}`}>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-tertiary">{day.dayName}</p>
                <p className="mt-1 text-sm font-semibold text-white">{day.focus}</p>
              </div>
            ))}
          </div>
        </Card>

        {days.map((day) => (
          <Card key={day.dayLabel} className="border border-white/12 bg-white/5 p-5">
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-text-tertiary">{day.dayLabel}</div>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h4 className="text-lg font-semibold text-white">{day.focus}</h4>
                <p className="mt-2 text-sm text-text-secondary">{day.summary}</p>
              </div>
              {day.targetMuscles.length > 0 && (
                <div className="grid shrink-0 grid-cols-3 gap-2">
                  {day.targetMuscles.slice(0, 3).map((muscle) => (
                    <div key={`${day.dayLabel}-${muscle}`} className="h-10 w-10 overflow-hidden rounded-xl border border-white/10 bg-white/5" title={muscle}>
                      <img src={getBodyPartImage(muscle)} alt={muscle} className="h-full w-full object-cover" />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {day.exercises.length > 0 && (
              <div className="mt-4 space-y-3">
                {day.exercises.map((exercise) => (
                  <div key={`${day.dayLabel}-${exercise.name}`} className="rounded-2xl border border-white/10 bg-black/10 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-white">{exercise.name}</p>
                        <p className="mt-1 text-xs uppercase tracking-[0.14em] text-accent">{exercise.sets} x {exercise.reps} @ RPE {exercise.targetRPE}</p>
                      </div>
                      <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-text-secondary">
                        {exercise.restSecondsMin}-{exercise.restSecondsMax}s
                      </span>
                    </div>
                    <p className="mt-3 text-xs text-text-secondary">
                      <span className="font-semibold text-text-primary">Pattern:</span> {exercise.movementPattern}
                    </p>
                    <p className="mt-2 text-xs text-text-secondary">
                      <span className="font-semibold text-text-primary">Primary:</span> {exercise.primaryMuscles.join(', ')}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </Card>
        ))}

        <Card className="border border-white/12 bg-white/5 p-5">
          <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-text-secondary">Progression Rules</h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {[
              'Technique and ROM come before load.',
              'If all sets hit the top of the range at target RPE, add load.',
              'If reps are inside the range, add reps before load.',
              'If recovery is poor, hold or reduce volume.',
            ].map((item) => (
              <div key={item} className="rounded-2xl border border-white/10 bg-black/10 px-4 py-3 text-sm text-text-secondary">{item}</div>
            ))}
          </div>
        </Card>
      </div>

      {isConfirmOpen && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[160] flex items-start justify-center overflow-y-auto overscroll-contain bg-black/70 px-2 pt-[calc(env(safe-area-inset-top,0px)+0.75rem)] pb-[calc(env(safe-area-inset-bottom,0px)+5.5rem)] sm:items-center sm:p-4"
          onClick={() => {
            if (!isApplying) setIsConfirmOpen(false);
          }}
        >
          <div
            dir={isArabic ? 'rtl' : 'ltr'}
            className={`flex max-h-[min(calc(100dvh-8.5rem),38rem)] w-full max-w-sm flex-col overflow-hidden rounded-2xl border border-white/10 bg-card p-3.5 shadow-2xl sm:max-h-[min(90dvh,48rem)] sm:max-w-md sm:p-5 ${isArabic ? 'text-right' : 'text-left'}`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1 pb-2 [scrollbar-gutter:stable] [-webkit-overflow-scrolling:touch]">
              <div className="mb-4 flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent/15 text-accent">
                  {success ? <Check size={18} /> : <Sparkles size={18} />}
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">{modalCopy.title}</h3>
                  <p className="mt-1 text-sm text-text-secondary">{modalCopy.body}</p>
                </div>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/10 px-4 py-3 text-sm text-text-secondary">
                {modalCopy.hint}
              </div>
            </div>

            <div className="sticky bottom-0 mt-0 flex shrink-0 gap-3 border-t border-white/10 bg-card/95 pt-2 pb-1 backdrop-blur">
              <button
                type="button"
                onClick={() => setIsConfirmOpen(false)}
                disabled={isApplying}
                className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-text-primary transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {copy.cancel}
              </button>
              <button
                type="button"
                onClick={() => void handleApplyPlan()}
                disabled={isApplying}
                className="flex-1 rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-black transition-opacity hover:opacity-90 disabled:cursor-wait disabled:opacity-70"
              >
                {isApplying ? copy.usingPlan : copy.confirm}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
