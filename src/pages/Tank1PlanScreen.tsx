import React, { useEffect, useMemo, useState } from 'react';
import { Check, Sparkles } from 'lucide-react';
import { Header } from '../components/ui/Header';
import { Card } from '../components/ui/Card';
import { getBodyPartImage } from '../services/bodyPartTheme';
import { api } from '../services/api';
import { AppLanguage, getActiveLanguage, getStoredLanguage } from '../services/language';

interface Tank1PlanScreenProps {
  onBack: () => void;
}

type Tank1Exercise = {
  name: string;
  prescription: string;
  comment: string;
  technique?: string;
  pairing?: string;
};

type Tank1Day = {
  dayLabel: string;
  focus: string;
  summary?: string;
  details?: string[];
  targetMuscles?: string[];
  exercises?: Tank1Exercise[];
};

type Tank1Month = {
  title: string;
  block: string;
  goal: string[];
  intensity: string[];
  tempo: string;
  rest: string[];
  split: string;
  progressionTitle: string;
  progression: string[];
  days: Tank1Day[];
};

const TANK1_DAY_NAME_BY_LABEL: Record<string, string> = {
  'Day 1': 'monday',
  'Day 2': 'tuesday',
  'Day 4': 'thursday',
  'Day 5': 'friday',
  'Day 6': 'saturday',
};

const HEAVY_EXERCISE_PATTERN = /(squat|deadlift|barbell row|bench press|shoulder press|pull-up|pull up|close grip bench|chest supported row|t-bar row)/i;

const TANK1_PLAN_I18N: Record<AppLanguage, {
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
}> = {
  en: {
    title: 'Tank-1 Plan',
    badge: 'RepSet Template',
    summary: 'Bodybuilding periodization template with RepSet comments, technique instructions, exact pairings, Month 1 progression, and Month 2 progression using the same split.',
    usePlan: 'Use As My Plan',
    usingPlan: 'Saving...',
    activePlan: 'Active In My Plan',
    modalTitle: 'Choose Tank-1 as your personal plan?',
    modalBody: 'This will save Tank-1 as your active plan on the My Plan page.',
    modalHint: 'You can still edit this plan later if you want to personalize it more.',
    confirm: 'Yes, Use Tank-1',
    cancel: 'Cancel',
    noSession: 'No active user session found.',
    saveFailed: 'Failed to save Tank-1 as your plan.',
    success: 'Tank-1 is now saved as your active plan in My Plan.',
  },
  ar: {
    title: 'خطة Tank-1',
    badge: 'قالب RepSet',
    summary: 'قالب فترة تدريب كمال أجسام مع ملاحظات RepSet، وتعليمات التكنيك، والاقترانات الدقيقة، وتدرج الشهر الأول والشهر الثاني بنفس التقسيمة.',
    usePlan: 'اجعلها خطتي',
    usingPlan: 'جارٍ الحفظ...',
    activePlan: 'مفعلة في خطتي',
    modalTitle: 'هل تريد اختيار Tank-1 كخطتك الشخصية؟',
    modalBody: 'سيتم حفظ Tank-1 كخطتك النشطة داخل صفحة خطتي.',
    modalHint: 'ويمكنك تعديل هذه الخطة لاحقًا إذا أردت تخصيصها أكثر.',
    confirm: 'نعم، اختر Tank-1',
    cancel: 'إلغاء',
    noSession: 'لا توجد جلسة مستخدم نشطة.',
    saveFailed: 'تعذر حفظ Tank-1 كخطتك.',
    success: 'تم حفظ Tank-1 كخطتك النشطة داخل صفحة خطتي.',
  },
  it: {
    title: 'Tank-1 Plan',
    badge: 'RepSet Template',
    summary: 'Bodybuilding periodization template with RepSet comments, technique instructions, exact pairings, Month 1 progression, and Month 2 progression using the same split.',
    usePlan: 'Use As My Plan',
    usingPlan: 'Saving...',
    activePlan: 'Active In My Plan',
    modalTitle: 'Choose Tank-1 as your personal plan?',
    modalBody: 'This will save Tank-1 as your active plan on the My Plan page.',
    modalHint: 'You can still edit this plan later if you want to personalize it more.',
    confirm: 'Yes, Use Tank-1',
    cancel: 'Cancel',
    noSession: 'No active user session found.',
    saveFailed: 'Failed to save Tank-1 as your plan.',
    success: 'Tank-1 is now saved as your active plan in My Plan.',
  },
  de: {
    title: 'Tank-1 Plan',
    badge: 'RepSet Template',
    summary: 'Bodybuilding periodization template with RepSet comments, technique instructions, exact pairings, Month 1 progression, and Month 2 progression using the same split.',
    usePlan: 'Use As My Plan',
    usingPlan: 'Saving...',
    activePlan: 'Active In My Plan',
    modalTitle: 'Choose Tank-1 as your personal plan?',
    modalBody: 'This will save Tank-1 as your active plan on the My Plan page.',
    modalHint: 'You can still edit this plan later if you want to personalize it more.',
    confirm: 'Yes, Use Tank-1',
    cancel: 'Cancel',
    noSession: 'No active user session found.',
    saveFailed: 'Failed to save Tank-1 as your plan.',
    success: 'Tank-1 is now saved as your active plan in My Plan.',
  },
};

const getStoredUserId = () => {
  if (typeof window === 'undefined') return 0;

  try {
    const localUser = JSON.parse(localStorage.getItem('appUser') || localStorage.getItem('user') || '{}');
    return Number(localStorage.getItem('appUserId') || localStorage.getItem('userId') || localUser?.id || 0);
  } catch {
    return Number(localStorage.getItem('appUserId') || localStorage.getItem('userId') || 0);
  }
};

const parsePrescription = (exercise: Tank1Exercise) => {
  const normalized = String(exercise.prescription || '').trim().toLowerCase();
  const setsMatch = normalized.match(/^(\d+)\s*x\s*(.+)$/i);
  if (setsMatch) {
    return {
      sets: Math.max(1, Number(setsMatch[1] || 1)),
      reps: setsMatch[2].replace(/\s+/g, ' ').trim(),
    };
  }

  const roundsMatch = normalized.match(/^(\d+)\s*rounds?$/i);
  if (roundsMatch) {
    return {
      sets: Math.max(1, Number(roundsMatch[1] || 1)),
      reps: exercise.name === 'Vacuum Holds' ? '20-30 sec' : 'Rounds',
    };
  }

  return {
    sets: 3,
    reps: '8-12',
  };
};

const inferRestSeconds = (month: Tank1Month, day: Tank1Day, exercise: Tank1Exercise) => {
  if (day.dayLabel === 'Day 6') return 60;
  if (HEAVY_EXERCISE_PATTERN.test(exercise.name)) {
    return month.title === 'Month 2 Plan' ? 120 : 150;
  }
  return month.title === 'Month 2 Plan' ? 60 : 75;
};

const buildTank1PlanPayload = (language: AppLanguage) => {
  const weekPlans = monthPlans.map((month) => ({
    weeklyWorkouts: month.days.map((day) => ({
      dayName: TANK1_DAY_NAME_BY_LABEL[day.dayLabel] || 'monday',
      workoutName: day.focus,
      workoutType: 'Custom',
      targetMuscles: day.targetMuscles || [],
      notes: [day.summary, ...(day.details || [])].filter(Boolean).join(' '),
      exercises: (day.exercises || []).map((exercise) => {
        const parsed = parsePrescription(exercise);
        return {
          exerciseName: exercise.name,
          sets: parsed.sets,
          reps: parsed.reps,
          restSeconds: inferRestSeconds(month, day, exercise),
          targetWeight: 20,
          targetMuscles: day.targetMuscles || [],
          notes: [
            `RepSet comment: ${exercise.comment}`,
            exercise.technique ? `Technique: ${exercise.technique}` : '',
            exercise.pairing ? `Exact pairing: ${exercise.pairing}` : '',
            `Tempo: ${month.tempo}`,
          ].filter(Boolean).join(' '),
        };
      }),
    })),
  }));

  return {
    planName: language === 'ar' ? 'خطة Tank-1 الشخصية' : 'Tank-1 Personal Plan',
    description: language === 'ar'
      ? 'قالب Tank-1 المطبق كخطة شخصية نشطة.'
      : 'Tank-1 template applied as an active personal plan.',
    cycleWeeks: 12,
    templateWeekCount: 2,
    selectedDays: Object.values(TANK1_DAY_NAME_BY_LABEL),
    weeklyWorkouts: weekPlans[0]?.weeklyWorkouts || [],
    weekPlans,
  };
};

const vShapeDayTemplate: Tank1Day = {
  dayLabel: 'Day 6',
  focus: 'V-Shape Specialization',
  summary: 'High pump plus stretch hypertrophy.',
  details: [
    'Focus muscles: Lats (width priority), side delts (width illusion), upper chest (frame balance), serratus and core tightening, rear delts (3D width).',
    'Rest: 45 to 60 seconds.',
    'Tempo: 3 second eccentric.',
  ],
  targetMuscles: ['Lats', 'Side Delts', 'Upper Chest', 'Core', 'Rear Delts'],
  exercises: [
    {
      name: 'Wide Grip Pull-Ups',
      prescription: '4 x failure',
      comment: 'Your V-shape starts at the pull-up bar. Pull elbows outward to create wing expansion.',
      technique: 'Week 2+: Add rest-pause.',
    },
    {
      name: 'Single Arm Lat Pulldown',
      prescription: '3 x 12 each',
      comment: 'Unilateral work fixes narrow back genetics.',
      technique: 'Week 2+: Dropset.',
    },
    {
      name: 'Straight Arm Pulldown',
      prescription: '3 x 15',
      comment: 'This engraves lat lines into your torso.',
      technique: 'Week 2+: Superset with pulldown.',
      pairing: 'Straight Arm Pulldown -> Pulldown',
    },
    {
      name: 'Cable Lateral Raise',
      prescription: '4 x 15',
      comment: 'Side delts create the illusion of a small waist.',
      technique: 'Week 2+: Giant set.',
      pairing: 'Raise -> Partial -> Hold',
    },
    {
      name: 'Machine Lateral Raise',
      prescription: '3 x 20',
      comment: 'Delts respond to burn, not ego.',
    },
    {
      name: 'Incline Upper Chest Press',
      prescription: '3 x 12',
      comment: 'Upper chest completes the V-frame.',
      technique: 'Week 2+: Dropset.',
    },
    {
      name: 'Serratus Cable Crunch',
      prescription: '3 x 20',
      comment: 'Tight core sharpens torso taper.',
    },
    {
      name: 'Vacuum Holds',
      prescription: '5 rounds',
      comment: 'Waist control is the secret of classic physiques.',
      technique: 'Hold 20 to 30 seconds.',
    },
  ],
};

const monthPlans: Tank1Month[] = [
  {
    title: 'Month 1 Plan',
    block: 'Block A (4-6 Weeks)',
    goal: [
      'Neural learning',
      'Stretch hypertrophy',
      'Base volume accumulation',
      'Technique mastery',
    ],
    intensity: [
      'Week 1: None, learn control.',
      'Week 2: Introduce dropsets, supersets, and rest-pause work.',
    ],
    tempo: '3 second eccentric on the default working tempo.',
    rest: [
      'Hypertrophy work: 75 seconds',
      'Heavy work: 2 to 3 minutes',
    ],
    split: 'Day 1 chest + triceps, Day 2 back + biceps, Day 3 recovery, Day 4 legs, Day 5 shoulders + arms, Day 6 weak point.',
    progressionTitle: 'Month 1 Progression',
    progression: [
      'Week 1: Learn movement, perfect tempo, and build mind-muscle connection.',
      'Week 2: Add intensity techniques, push closer to failure, and make a slight load increase.',
    ],
    days: [
      {
        dayLabel: 'Day 1',
        focus: 'Chest + Triceps',
        targetMuscles: ['Chest', 'Triceps'],
        exercises: [
          {
            name: 'Incline Barbell Press',
            prescription: '4 x 8',
            comment: 'Upper chest sets your physique ceiling.',
            technique: 'Week 2: Last set rest-pause (8 + 3 + 2).',
          },
          {
            name: 'Flat Dumbbell Press',
            prescription: '3 x 10',
            comment: 'Press inward to recruit inner chest fibers.',
            technique: 'Week 2: Dropset on the last set with 30 percent less weight.',
          },
          {
            name: 'Machine Chest Fly',
            prescription: '3 x 12',
            comment: 'Freeze the contraction like time stopped.',
            technique: 'Week 2: Superset added.',
            pairing: 'Machine Chest Fly -> Push-ups to failure',
          },
          {
            name: 'Chest Dips',
            prescription: '3 x failure',
            comment: 'Lean forward to shift tension to the chest.',
          },
          {
            name: 'Skull Crushers',
            prescription: '3 x 10',
            comment: 'Stretch the long head brutally.',
            technique: 'Week 2: Dropset.',
          },
          {
            name: 'Rope Pushdown',
            prescription: '3 x 12',
            comment: 'Break the rope apart at lockout.',
            technique: 'Week 2: Superset added.',
            pairing: 'Rope Pushdown -> Overhead Extension',
          },
        ],
      },
      {
        dayLabel: 'Day 2',
        focus: 'Back + Biceps',
        targetMuscles: ['Back', 'Biceps'],
        exercises: [
          {
            name: 'Pull-ups',
            prescription: '4 x failure',
            comment: 'Drive elbows down to widen the lats.',
          },
          {
            name: 'Barbell Row',
            prescription: '4 x 8',
            comment: 'Back thickness is built here.',
            technique: 'Week 2: Rest-pause on the last set.',
          },
          {
            name: 'Lat Pulldown',
            prescription: '3 x 12',
            comment: 'Pause for 1 second at the bottom.',
            technique: 'Week 2: Dropset.',
          },
          {
            name: 'Seated Cable Row',
            prescription: '3 x 12',
            comment: 'Crack a walnut between the scapula.',
            technique: 'Week 2: Superset added.',
            pairing: 'Seated Cable Row -> Straight Arm Pulldown',
          },
          {
            name: 'Incline DB Curl',
            prescription: '3 x 10',
            comment: 'Painful stretch builds the peak.',
          },
          {
            name: 'Hammer Curl',
            prescription: '3 x 12',
            comment: 'Density builder.',
            technique: 'Week 2: Dropset.',
          },
        ],
      },
      {
        dayLabel: 'Day 4',
        focus: 'Legs',
        summary: 'Destroy mode.',
        targetMuscles: ['Quadriceps', 'Hamstrings', 'Calves'],
        exercises: [
          {
            name: 'Back Squat',
            prescription: '4 x 6',
            comment: 'Depth separates amateurs from athletes.',
            technique: 'Week 2: Rest-pause.',
          },
          {
            name: 'Leg Press',
            prescription: '3 x 12',
            comment: 'Slow negative ignites the quads.',
            technique: 'Week 2: Dropset.',
          },
          {
            name: 'Romanian Deadlift',
            prescription: '3 x 10',
            comment: 'Hamstrings grow in the stretch.',
          },
          {
            name: 'Seated Leg Curl',
            prescription: '3 x 12',
            comment: 'Squeeze like holding a coin.',
            technique: 'Week 2: Superset added.',
            pairing: 'Seated Leg Curl -> Leg Extension',
          },
          {
            name: 'Leg Extension',
            prescription: '3 x 15',
            comment: 'Pain equals quad detail.',
          },
          {
            name: 'Standing Calf Raise',
            prescription: '5 x 12',
            comment: 'Full stretch unlocks the calves.',
            technique: 'Week 2: Dropset every set.',
          },
        ],
      },
      {
        dayLabel: 'Day 5',
        focus: 'Shoulders + Arms',
        targetMuscles: ['Shoulders', 'Biceps', 'Triceps'],
        exercises: [
          {
            name: 'DB Shoulder Press',
            prescription: '4 x 8',
            comment: 'Shoulders define upper body width.',
            technique: 'Week 2: Rest-pause.',
          },
          {
            name: 'Lateral Raise',
            prescription: '4 x 15',
            comment: 'Raise elbows, not weights.',
            technique: 'Week 2: Giant set added.',
            pairing: 'Lateral Raise -> Partials -> Hold',
          },
          {
            name: 'Rear Delt Fly',
            prescription: '3 x 15',
            comment: 'Rear delts create the 3D look.',
          },
          {
            name: 'Cable Curl',
            prescription: '3 x 12',
            comment: 'Constant tension peak builder.',
            technique: 'Week 2: Dropset.',
          },
          {
            name: 'Overhead Triceps Extension',
            prescription: '3 x 12',
            comment: 'Long head grows the sleeves.',
            technique: 'Week 2: Superset added.',
            pairing: 'Overhead Triceps Extension -> Pushdown',
          },
        ],
      },
      {
        ...vShapeDayTemplate,
      },
    ],
  },
  {
    title: 'Month 2 Plan',
    block: 'Block B (4-6 Weeks)',
    goal: [
      'New stimulus',
      'More stretch hypertrophy',
      'More machine precision',
      'Higher metabolic stress',
      'Joint-friendly volume',
      'Density training',
    ],
    intensity: [
      'Week 3: Light techniques.',
      'Week 4: Aggressive techniques and intensity shock.',
    ],
    tempo: '3 second eccentric remains mandatory.',
    rest: [
      'Hypertrophy work: 60 to 75 seconds',
      'Heavy work: 2 minutes',
    ],
    split: 'Day 1 chest + triceps, Day 2 back + biceps, Day 3 recovery, Day 4 legs, Day 5 shoulders + arms, Day 6 weak point.',
    progressionTitle: 'Month 2 Progression',
    progression: [
      'Week 3: Adaptation, technique precision, and volume accumulation.',
      'Week 4: Intensity shock, high metabolic stress, and expanded fiber recruitment.',
    ],
    days: [
      {
        dayLabel: 'Day 1',
        focus: 'Chest + Triceps',
        targetMuscles: ['Chest', 'Triceps'],
        exercises: [
          {
            name: 'Incline Dumbbell Press',
            prescription: '4 x 10',
            comment: 'Freedom of dumbbells forces real chest activation.',
            technique: 'Week 4: Rest-pause (10 + 4 + 3).',
          },
          {
            name: 'Smith Machine Flat Press',
            prescription: '3 x 10',
            comment: 'Stability allows deeper fiber recruitment.',
            technique: 'Week 4: Dropset with 25 percent less weight.',
          },
          {
            name: 'Low Cable Fly',
            prescription: '3 x 15',
            comment: 'Stretch the chest like opening armor.',
            technique: 'Week 4: Superset added.',
            pairing: 'Low Cable Fly -> Push-ups',
          },
          {
            name: 'Close Grip Bench Press',
            prescription: '3 x 8',
            comment: 'Heavy triceps create pressing power.',
          },
          {
            name: 'Rope Pushdown',
            prescription: '3 x 12',
            comment: 'Lockout defines arm sharpness.',
            technique: 'Week 4: Dropset.',
          },
          {
            name: 'Bench Dips',
            prescription: '3 x failure',
            comment: 'Bodyweight destruction finishes the triceps.',
          },
        ],
      },
      {
        dayLabel: 'Day 2',
        focus: 'Back + Biceps',
        targetMuscles: ['Back', 'Biceps'],
        exercises: [
          {
            name: 'Chest Supported Row',
            prescription: '4 x 10',
            comment: 'Eliminate cheating to isolate back thickness.',
            technique: 'Week 4: Rest-pause.',
          },
          {
            name: 'Neutral Grip Pulldown',
            prescription: '3 x 12',
            comment: 'Neutral grip maximizes lat length tension.',
            technique: 'Week 4: Dropset.',
          },
          {
            name: 'T-Bar Row',
            prescription: '3 x 8',
            comment: 'Back density builder.',
          },
          {
            name: 'Straight Arm Pulldown',
            prescription: '3 x 15',
            comment: 'Lat isolation teaches mind-muscle control.',
            technique: 'Week 4: Superset added.',
            pairing: 'Straight Arm Pulldown -> Neutral Grip Pulldown',
          },
          {
            name: 'EZ Bar Curl',
            prescription: '3 x 10',
            comment: 'Controlled negative builds the peak.',
          },
          {
            name: 'Preacher Curl',
            prescription: '3 x 12',
            comment: 'No cheating means pure biceps load.',
            technique: 'Week 4: Dropset.',
          },
        ],
      },
      {
        dayLabel: 'Day 4',
        focus: 'Legs',
        targetMuscles: ['Quadriceps', 'Hamstrings', 'Calves'],
        exercises: [
          {
            name: 'Front Squat',
            prescription: '4 x 6',
            comment: 'Quad dominance creates aesthetic legs.',
            technique: 'Week 4: Rest-pause.',
          },
          {
            name: 'Hack Squat',
            prescription: '3 x 12',
            comment: 'Machine path allows brutal quad fatigue.',
            technique: 'Week 4: Dropset.',
          },
          {
            name: 'Stiff-Leg Deadlift',
            prescription: '3 x 10',
            comment: 'Hamstrings grow in controlled stretch.',
          },
          {
            name: 'Seated Leg Curl',
            prescription: '3 x 12',
            comment: 'Hamstring contraction prevents injury.',
            technique: 'Week 4: Superset added.',
            pairing: 'Seated Leg Curl -> Leg Extension',
          },
          {
            name: 'Walking Lunges',
            prescription: '3 x 20 steps',
            comment: 'Functional hypertrophy.',
          },
          {
            name: 'Seated Calf Raise',
            prescription: '5 x 12',
            comment: 'Calves require high frequency stimulus.',
            technique: 'Week 4: Dropset every set.',
          },
        ],
      },
      {
        dayLabel: 'Day 5',
        focus: 'Shoulders + Arms',
        targetMuscles: ['Shoulders', 'Biceps', 'Triceps'],
        exercises: [
          {
            name: 'Machine Shoulder Press',
            prescription: '4 x 10',
            comment: 'Machine control allows higher fatigue tolerance.',
            technique: 'Week 4: Rest-pause.',
          },
          {
            name: 'Cable Lateral Raise',
            prescription: '4 x 15',
            comment: 'Constant tension builds capped delts.',
            technique: 'Week 4: Giant set added.',
            pairing: 'Cable Lateral Raise -> Partials -> Hold -> Burn reps',
          },
          {
            name: 'Reverse Pec Deck',
            prescription: '3 x 15',
            comment: 'Rear delts stabilize the shoulder joint.',
          },
          {
            name: 'Spider Curl',
            prescription: '3 x 12',
            comment: 'Peak builder with full isolation.',
            technique: 'Week 4: Dropset.',
          },
          {
            name: 'Rope Overhead Extension',
            prescription: '3 x 12',
            comment: 'Long head triceps create the arm size illusion.',
            technique: 'Week 4: Superset added.',
            pairing: 'Rope Overhead Extension -> Pushdown',
          },
        ],
      },
      {
        ...vShapeDayTemplate,
      },
    ],
  },
];

export function Tank1PlanScreen({ onBack }: Tank1PlanScreenProps) {
  const [language, setLanguage] = useState<AppLanguage>(() => getActiveLanguage());
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const copy = useMemo(() => TANK1_PLAN_I18N[language] || TANK1_PLAN_I18N.en, [language]);
  const isArabic = language === 'ar';

  useEffect(() => {
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

  const handleApplyPlan = async () => {
    setError(null);
    setSuccess(null);

    const userId = getStoredUserId();
    if (!userId) {
      setError(copy.noSession);
      return;
    }

    const payload = buildTank1PlanPayload(language);
    setIsApplying(true);
    try {
      const result = await api.saveCustomProgram(userId, payload);
      if (!result?.success) {
        throw new Error(result?.error || copy.saveFailed);
      }

      if (typeof window !== 'undefined') {
        localStorage.removeItem('recoveryNeedsUpdate');
        localStorage.setItem('assignedProgramTemplate', JSON.stringify({
          ...(result?.assignedProgram || {}),
          ...payload,
          templateWeekPlans: payload.weekPlans,
          repeatedWeekPlans: payload.weekPlans,
        }));
        window.dispatchEvent(new CustomEvent('program-updated'));
      }

      setIsConfirmOpen(false);
      setSuccess(copy.success);
    } catch (saveError) {
      console.error('Failed to save Tank-1 plan:', saveError);
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
              onClick={() => setIsConfirmOpen(true)}
              disabled={isApplying}
              className={`rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] transition-colors ${
                success
                  ? 'bg-emerald-500/15 text-emerald-200'
                  : 'bg-accent/15 text-accent hover:bg-accent/20'
              } ${isApplying ? 'cursor-wait opacity-70' : ''}`}
            >
              {isApplying ? copy.usingPlan : (success ? copy.activePlan : copy.usePlan)}
            </button>
          )}
        />
      </div>

      <div className="space-y-5 px-4 sm:px-6">
        {error && (
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}
        {success && (
          <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            {success}
          </div>
        )}

        <Card className="border border-accent/20 bg-accent/5 p-5">
          <div className="mb-2 inline-flex rounded-full bg-emerald-500/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-200">
            {copy.badge}
          </div>
          <h2 className="text-2xl font-electrolize text-white">Tank-1</h2>
          <p className="mt-2 text-sm text-text-secondary">
            {copy.summary}
          </p>
        </Card>

        {monthPlans.map((month) => (
          <section key={month.title} className="space-y-4">
            <Card className="border border-white/12 bg-white/5 p-5">
              <div className="mb-2 inline-flex rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-text-secondary">
                {month.block}
              </div>
              <h3 className="text-xl font-semibold text-white">{month.title}</h3>
              <p className="mt-3 text-sm font-semibold text-text-primary">Goal</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {month.goal.map((item) => (
                  <span
                    key={item}
                    className="rounded-full bg-white/8 px-3 py-1 text-xs text-text-secondary"
                  >
                    {item}
                  </span>
                ))}
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-sm font-semibold text-text-primary">Intensity Techniques</p>
                  <div className="mt-2 space-y-2">
                    {month.intensity.map((item) => (
                      <p key={item} className="text-xs text-text-secondary">
                        {item}
                      </p>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-sm font-semibold text-text-primary">Split</p>
                  <p className="mt-2 text-xs text-text-secondary">{month.split}</p>
                </div>
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-sm font-semibold text-text-primary">Tempo</p>
                  <p className="mt-2 text-xs text-text-secondary">{month.tempo}</p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-text-primary">Rest</p>
                  <div className="mt-2 space-y-2">
                    {month.rest.map((item) => (
                      <p key={item} className="text-xs text-text-secondary">
                        {item}
                      </p>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <p className="text-sm font-semibold text-text-primary">{month.progressionTitle}</p>
                <div className="mt-2 space-y-2">
                  {month.progression.map((item) => (
                    <p key={item} className="text-xs text-text-secondary">
                      {item}
                    </p>
                  ))}
                </div>
              </div>
            </Card>

            {month.days.map((day) => (
              <Card key={`${month.title}-${day.dayLabel}`} className="border border-white/12 bg-white/5 p-5">
                <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-text-tertiary">
                  {day.dayLabel}
                </div>
                <div className="flex items-start justify-between gap-3">
                  <h4 className="text-lg font-semibold text-white">{day.focus}</h4>
                  {day.targetMuscles && day.targetMuscles.length > 0 && (
                    <div className="flex shrink-0 items-center gap-2">
                      {day.targetMuscles.slice(0, 4).map((muscle) => (
                        <div
                          key={`${day.dayLabel}-${muscle}`}
                          className="h-10 w-10 overflow-hidden rounded-xl border border-white/10 bg-white/5"
                          title={muscle}
                        >
                          <img
                            src={getBodyPartImage(muscle)}
                            alt={muscle}
                            className="h-full w-full object-cover"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {day.summary && (
                  <p className="mt-2 text-sm text-text-secondary">{day.summary}</p>
                )}
                {day.details && day.details.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {day.details.map((detail) => (
                      <p key={`${day.dayLabel}-${detail}`} className="text-xs text-text-secondary">
                        {detail}
                      </p>
                    ))}
                  </div>
                )}

                {day.exercises && day.exercises.length > 0 && (
                  <div className="mt-4 space-y-3">
                    {day.exercises.map((exercise) => (
                      <div key={`${day.dayLabel}-${exercise.name}`} className="rounded-2xl border border-white/10 bg-black/10 p-4">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p className="text-sm font-semibold text-white">{exercise.name}</p>
                            <p className="mt-1 text-xs uppercase tracking-[0.14em] text-accent">
                              {exercise.prescription}
                            </p>
                          </div>
                        </div>
                        <p className="mt-3 text-xs text-text-secondary">
                          <span className="font-semibold text-text-primary">RepSet comment:</span> {exercise.comment}
                        </p>
                        {exercise.technique && (
                          <p className="mt-2 text-xs text-text-secondary">
                            <span className="font-semibold text-text-primary">Technique:</span> {exercise.technique}
                          </p>
                        )}
                        {exercise.pairing && (
                          <p className="mt-2 text-xs text-text-secondary">
                            <span className="font-semibold text-text-primary">Exact pairing:</span> {exercise.pairing}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            ))}
          </section>
        ))}
      </div>

      {isConfirmOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => {
            if (!isApplying) setIsConfirmOpen(false);
          }}
        >
          <div
            dir={isArabic ? 'rtl' : 'ltr'}
            className={`w-full max-w-md rounded-2xl border border-white/10 bg-card p-5 ${isArabic ? 'text-right' : 'text-left'}`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent/15 text-accent">
                {success ? <Check size={18} /> : <Sparkles size={18} />}
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">{copy.modalTitle}</h3>
                <p className="mt-1 text-sm text-text-secondary">{copy.modalBody}</p>
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-black/10 px-4 py-3 text-sm text-text-secondary">
              {copy.modalHint}
            </div>

            <div className="mt-4 flex gap-3">
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
        </div>
      )}
    </div>
  );
}
