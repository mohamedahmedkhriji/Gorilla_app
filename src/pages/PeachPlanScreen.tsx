import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Sparkles } from 'lucide-react';
import { Header } from '../components/ui/Header';
import { Card } from '../components/ui/Card';
import { getBodyPartImage } from '../services/bodyPartTheme';
import { api } from '../services/api';
import { AppLanguage, getActiveLanguage, getStoredLanguage } from '../services/language';
import { recordBookApplied } from '../services/bookUsage';
import { getAssignedBookPlan, getPlanSwitchPrompt } from '../services/bookPlanSelection';

interface PeachPlanScreenProps {
  onBack: () => void;
}

type PeachExercise = {
  name: string;
  sets: number;
  reps: string;
  targetRIR: number;
  restSeconds: number;
  restMaxSeconds?: number;
  primaryMuscles: string[];
  secondaryMuscles?: string[];
  movementPattern: string;
  fatigue?: { local: number; systemic: number; eccentric: number };
  cues?: string[];
};

type PeachDay = {
  id: string;
  dayName: string;
  displayName: string;
  focus: string;
  summary: string;
  targetMuscles: string[];
  exercises: PeachExercise[];
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

const copy = {
  title: 'Peach',
  badge: 'Female Physique Template',
  summary: 'An 8-week, 4-day hypertrophy plan for glutes, legs, shoulders, back shape, and core with double progression and recovery-aware fatigue control.',
  usePlan: 'Use As My Plan',
  usingPlan: 'Saving...',
  activePlan: 'Active In My Plan',
  modalTitle: 'Choose Peach as your personal plan?',
  modalBody: 'This will save Peach as your active plan on the My Plan page.',
  modalHint: 'Peach keeps stable movements for progression and uses Tuesday through Friday training days.',
  confirm: 'Yes, Use Peach',
  cancel: 'Cancel',
  noSession: 'No active user session found.',
  saveFailed: 'Failed to save Peach as your plan.',
  success: 'Peach is now saved as your active plan in My Plan.',
};

const peachDays: PeachDay[] = [
  {
    id: 'PEACH_01_BACK_BICEPS_ABS',
    dayName: 'tuesday',
    displayName: 'PEACH 01 - Back + Biceps + Abs',
    focus: 'Back + Biceps + Abs',
    summary: 'Back width, back shape, rear shoulders, biceps, and abdominal strength.',
    targetMuscles: ['back', 'biceps', 'abs'],
    exercises: [
      { name: 'Lat Pulldown', sets: 3, reps: '8-12', targetRIR: 2, restSeconds: 120, primaryMuscles: ['latissimus dorsi'], secondaryMuscles: ['biceps', 'teres major', 'rear deltoids', 'mid traps'], movementPattern: 'vertical_pull', cues: ['Keep chest slightly elevated', 'Drive elbows toward hips', 'Control the stretch at the top'] },
      { name: 'Seated Cable Row', sets: 3, reps: '8-12', targetRIR: 2, restSeconds: 120, primaryMuscles: ['rhomboids', 'mid traps', 'latissimus dorsi'], secondaryMuscles: ['rear deltoids', 'biceps'], movementPattern: 'horizontal_pull', cues: ['Neutral spine', 'Initiate with scapula', 'Pull toward lower ribs'] },
      { name: 'One-Arm Dumbbell Row', sets: 3, reps: '10-12 each arm', targetRIR: 2, restSeconds: 90, primaryMuscles: ['latissimus dorsi'], secondaryMuscles: ['rhomboids', 'traps', 'rear deltoids', 'biceps'], movementPattern: 'horizontal_pull_unilateral' },
      { name: 'Face Pull', sets: 3, reps: '12-20', targetRIR: 2, restSeconds: 75, primaryMuscles: ['rear deltoids'], secondaryMuscles: ['mid traps', 'lower traps', 'rotator cuff'], movementPattern: 'rear_delt_horizontal_pull' },
      { name: 'Dumbbell Curl', sets: 3, reps: '8-12', targetRIR: 2, restSeconds: 75, primaryMuscles: ['biceps brachii'], secondaryMuscles: ['brachialis'], movementPattern: 'elbow_flexion' },
      { name: 'Cable Curl', sets: 2, reps: '12-15', targetRIR: 1, restSeconds: 60, primaryMuscles: ['biceps'], secondaryMuscles: ['brachialis'], movementPattern: 'elbow_flexion_cable' },
      { name: 'Hanging Knee Raise', sets: 3, reps: '10-15', targetRIR: 2, restSeconds: 60, primaryMuscles: ['rectus abdominis'], secondaryMuscles: ['hip flexors'], movementPattern: 'core_flexion' },
      { name: 'Plank', sets: 2, reps: '30-60 sec', targetRIR: 2, restSeconds: 60, primaryMuscles: ['core'], movementPattern: 'anti_extension_core', cues: ['Prioritize brace and position before duration'] },
    ],
  },
  {
    id: 'PEACH_02_QUADS_GLUTES',
    dayName: 'wednesday',
    displayName: 'PEACH 02 - Quads + Glutes',
    focus: 'Quads + Glutes',
    summary: 'Anterior-leg dominant lower session for glutes, quads, glute medius, and calves.',
    targetMuscles: ['Gluteus butt muscles', 'Quadriceps', 'calves'],
    exercises: [
      { name: 'Barbell Hip Thrust', sets: 4, reps: '6-10', targetRIR: 2, restSeconds: 150, restMaxSeconds: 180, primaryMuscles: ['gluteus maximus'], secondaryMuscles: ['hamstrings', 'adductors'], movementPattern: 'hip_extension', fatigue: { local: 4, systemic: 2, eccentric: 2 }, cues: ['Ribs down', 'Pelvis controlled', 'Avoid lumbar hyperextension'] },
      { name: 'Bulgarian Split Squat', sets: 3, reps: '8-12 each leg', targetRIR: 2, restSeconds: 120, primaryMuscles: ['glutes', 'quadriceps'], secondaryMuscles: ['adductors'], movementPattern: 'unilateral_squat', fatigue: { local: 5, systemic: 4, eccentric: 4 } },
      { name: 'Leg Press', sets: 3, reps: '10-15', targetRIR: 2, restSeconds: 120, primaryMuscles: ['quadriceps'], secondaryMuscles: ['glutes', 'adductors'], movementPattern: 'machine_squat', fatigue: { local: 4, systemic: 3, eccentric: 3 } },
      { name: 'Leg Extension', sets: 3, reps: '12-15', targetRIR: 1, restSeconds: 75, primaryMuscles: ['quadriceps'], movementPattern: 'knee_extension', fatigue: { local: 3, systemic: 1, eccentric: 2 } },
      { name: 'Cable Glute Kickback', sets: 3, reps: '12-15 each side', targetRIR: 2, restSeconds: 60, primaryMuscles: ['gluteus maximus'], movementPattern: 'hip_extension_isolation', fatigue: { local: 2, systemic: 1, eccentric: 1 } },
      { name: 'Hip Abduction', sets: 3, reps: '15-25', targetRIR: 1, restSeconds: 60, primaryMuscles: ['gluteus medius', 'gluteus minimus'], movementPattern: 'hip_abduction', fatigue: { local: 2, systemic: 1, eccentric: 1 } },
      { name: 'Standing Calf Raise', sets: 3, reps: '10-15', targetRIR: 2, restSeconds: 60, primaryMuscles: ['gastrocnemius'], movementPattern: 'plantar_flexion', cues: ['Use a full controlled stretch'] },
    ],
  },
  {
    id: 'PEACH_03_CHEST_SHOULDERS_TRICEPS_ABS',
    dayName: 'thursday',
    displayName: 'PEACH 03 - Chest + Shoulders + Triceps + Abs',
    focus: 'Chest + Shoulders + Triceps + Abs',
    summary: 'Shoulder-priority push day with chest, triceps, rear delts, and abs.',
    targetMuscles: ['shoulder', 'chest', 'triceps', 'abs'],
    exercises: [
      { name: 'Dumbbell Shoulder Press', sets: 3, reps: '6-10', targetRIR: 2, restSeconds: 120, primaryMuscles: ['anterior deltoids', 'lateral deltoids'], secondaryMuscles: ['triceps'], movementPattern: 'vertical_push' },
      { name: 'Machine Chest Press', sets: 3, reps: '8-12', targetRIR: 2, restSeconds: 120, primaryMuscles: ['pectoralis major'], secondaryMuscles: ['triceps', 'anterior deltoids'], movementPattern: 'horizontal_push' },
      { name: 'Cable Lateral Raise', sets: 4, reps: '12-20', targetRIR: 2, restSeconds: 60, primaryMuscles: ['lateral deltoid'], movementPattern: 'shoulder_abduction', cues: ['No excessive torso momentum', 'Maintain lateral delt tension'] },
      { name: 'Cable Chest Fly', sets: 2, reps: '10-15', targetRIR: 2, restSeconds: 75, primaryMuscles: ['pectoralis major'], movementPattern: 'chest_fly' },
      { name: 'Rear-Delt Cable Fly', sets: 3, reps: '15-20', targetRIR: 1, restSeconds: 60, primaryMuscles: ['rear deltoids'], secondaryMuscles: ['mid traps'], movementPattern: 'rear_delt_fly' },
      { name: 'Rope Triceps Pushdown', sets: 3, reps: '10-15', targetRIR: 2, restSeconds: 75, primaryMuscles: ['triceps'], movementPattern: 'elbow_extension' },
      { name: 'Overhead Cable Triceps Extension', sets: 2, reps: '10-15', targetRIR: 2, restSeconds: 75, primaryMuscles: ['triceps long head'], movementPattern: 'overhead_elbow_extension' },
      { name: 'Cable Crunch', sets: 3, reps: '10-15', targetRIR: 2, restSeconds: 60, primaryMuscles: ['rectus abdominis'], movementPattern: 'weighted_core_flexion' },
    ],
  },
  {
    id: 'PEACH_04_GLUTES_HAMSTRINGS',
    dayName: 'friday',
    displayName: 'PEACH 04 - Glutes + Hamstrings',
    focus: 'Glutes + Hamstrings',
    summary: 'Posterior-chain lower session for glutes, hamstrings, hip stability, and calves.',
    targetMuscles: ['Gluteus butt muscles', 'hamstring', 'calves'],
    exercises: [
      { name: 'Romanian Deadlift', sets: 4, reps: '6-10', targetRIR: 2, restSeconds: 150, restMaxSeconds: 180, primaryMuscles: ['hamstrings'], secondaryMuscles: ['glutes', 'adductors', 'spinal erectors'], movementPattern: 'hip_hinge', fatigue: { local: 4, systemic: 4, eccentric: 5 }, cues: ['Hips travel backward', 'Keep weight close to legs', 'Do not force range of motion'] },
      { name: 'Hip Thrust', sets: 3, reps: '8-12', targetRIR: 2, restSeconds: 150, primaryMuscles: ['gluteus maximus'], movementPattern: 'hip_extension', fatigue: { local: 4, systemic: 2, eccentric: 2 } },
      { name: 'Seated Leg Curl', sets: 3, reps: '10-15', targetRIR: 2, restSeconds: 90, primaryMuscles: ['hamstrings'], movementPattern: 'knee_flexion', fatigue: { local: 3, systemic: 1, eccentric: 3 } },
      { name: 'Reverse Lunge', sets: 3, reps: '10-12 each leg', targetRIR: 2, restSeconds: 90, primaryMuscles: ['glutes'], secondaryMuscles: ['quadriceps', 'hamstrings'], movementPattern: 'reverse_lunge' },
      { name: '45-Degree Back Extension - Glute Bias', sets: 2, reps: '10-15', targetRIR: 2, restSeconds: 75, primaryMuscles: ['glutes'], secondaryMuscles: ['hamstrings', 'spinal erectors'], movementPattern: 'glute_bias_back_extension', cues: ['Move mainly from hip extension', 'Do not hyperextend lumbar spine'] },
      { name: 'Hip Abduction', sets: 3, reps: '15-25', targetRIR: 1, restSeconds: 60, primaryMuscles: ['gluteus medius', 'gluteus minimus'], movementPattern: 'hip_abduction', fatigue: { local: 2, systemic: 1, eccentric: 1 } },
      { name: 'Seated Calf Raise', sets: 3, reps: '12-20', targetRIR: 2, restSeconds: 60, primaryMuscles: ['soleus'], secondaryMuscles: ['gastrocnemius'], movementPattern: 'seated_plantar_flexion' },
    ],
  },
];

const targetRirForWeek = (weekNumber: number, exercise: PeachExercise) => {
  if (weekNumber === 1) return 3;
  if (weekNumber === 2 || weekNumber === 5) return Math.max(exercise.targetRIR, 3);
  if (weekNumber === 4 || weekNumber === 7) return Math.max(1, exercise.targetRIR - 1);
  if (weekNumber === 8) return Math.max(1, exercise.targetRIR - 1);
  return exercise.targetRIR;
};

const buildPeachPayload = () => {
  const buildWeeklyWorkouts = (weekNumber: number) => peachDays.map((day) => ({
    dayName: day.dayName,
    workoutName: day.displayName,
    workoutType: 'Custom',
    targetMuscles: day.targetMuscles,
    notes: `${day.summary} Peach uses double progression: add reps first, increase load only when all sets reach the top of the range with acceptable technique and average RIR >= 1.`,
    exercises: day.exercises.map((exercise) => {
      const targetRIR = targetRirForWeek(weekNumber, exercise);
      return {
        exerciseName: exercise.name,
        sets: exercise.sets,
        reps: exercise.reps,
        restSeconds: exercise.restSeconds,
        rpeTarget: Math.max(1, 10 - targetRIR),
        targetWeight: 20,
        targetMuscles: exercise.primaryMuscles,
        notes: [
          `Peach day: ${day.id}`,
          `Target RIR: ${targetRIR}`,
          `Rest: ${exercise.restSeconds}${exercise.restMaxSeconds ? `-${exercise.restMaxSeconds}` : ''} sec`,
          `Pattern: ${exercise.movementPattern}`,
          exercise.secondaryMuscles?.length ? `Secondary: ${exercise.secondaryMuscles.join(', ')}` : '',
          exercise.fatigue ? `Fatigue local/systemic/eccentric: ${exercise.fatigue.local}/${exercise.fatigue.systemic}/${exercise.fatigue.eccentric}` : '',
          ...(exercise.cues || []),
        ].filter(Boolean).join(' | '),
      };
    }),
  }));

  const weekPlans = Array.from({ length: 8 }, (_, index) => ({
    weekNumber: index + 1,
    weeklyWorkouts: buildWeeklyWorkouts(index + 1),
  }));

  return {
    planName: 'Peach',
    description: 'Peach 4-day female physique hypertrophy plan for glutes, legs, shoulders, back shape, and core.',
    cycleWeeks: 8,
    templateWeekCount: 1,
    selectedDays: peachDays.map((day) => day.dayName),
    weeklyWorkouts: weekPlans[0].weeklyWorkouts,
    weekPlans,
    bookScheduleConfig: {
      scheduleMode: 'fixed_weekday',
      weekStartsOn: 'monday',
    },
    peachPlanConfig: {
      programId: 'peach_4day_v1',
      target: 'female',
      level: 'intermediate',
      progressionModel: 'double_progression',
      recoveryAware: true,
      schedule: {
        monday: 'rest',
        tuesday: 'PEACH_01_BACK_BICEPS_ABS',
        wednesday: 'PEACH_02_QUADS_GLUTES',
        thursday: 'PEACH_03_CHEST_SHOULDERS_TRICEPS_ABS',
        friday: 'PEACH_04_GLUTES_HAMSTRINGS',
        saturday: 'rest',
        sunday: 'recovery',
      },
    },
  };
};

export function PeachPlanScreen({ onBack }: PeachPlanScreenProps) {
  const [language, setLanguage] = useState<AppLanguage>(() => getActiveLanguage());
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [assignedPlan, setAssignedPlan] = useState(() => getAssignedBookPlan());
  const isCurrentPlanActive = assignedPlan.id === 'peach';
  const modalCopy = useMemo(() => {
    if (assignedPlan.id && assignedPlan.id !== 'peach') {
      return getPlanSwitchPrompt({
        language,
        currentPlanName: assignedPlan.name || 'your current plan',
        nextPlanName: copy.title,
      });
    }
    return { title: copy.modalTitle, body: copy.modalBody, hint: copy.modalHint };
  }, [assignedPlan.id, assignedPlan.name, language]);

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

    const payload = buildPeachPayload();
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
        setAssignedPlan({ id: 'peach', name: payload.planName });
        recordBookApplied('peach', userId);
        window.dispatchEvent(new CustomEvent('program-updated'));
      }
      setIsConfirmOpen(false);
      setSuccess(copy.success);
    } catch (saveError) {
      console.error('Failed to save Peach plan:', saveError);
      setError(saveError instanceof Error ? saveError.message : copy.saveFailed);
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-1 flex-col bg-[#FFF5F5] pb-24 text-[#4A4A4A]">
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
                  ? 'cursor-not-allowed bg-[#F6B6C8]/40 text-[#8A4D62]'
                  : 'bg-[#F6B6C8] text-[#4A4A4A] hover:bg-[#F8C6D4]'
              } ${isApplying ? 'cursor-wait opacity-70' : ''}`}
            >
              {isApplying ? copy.usingPlan : (isCurrentPlanActive ? copy.activePlan : copy.usePlan)}
            </button>
          )}
        />
      </div>

      <div className="space-y-5 px-4 sm:px-6">
        {error && <div className="rounded-xl border border-red-400/40 bg-red-100 px-4 py-3 text-sm text-red-700">{error}</div>}
        {success && <div className="rounded-xl border border-emerald-400/40 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div>}

        <Card className="overflow-hidden border border-[#E2B4BD]/50 bg-[radial-gradient(circle_at_top_left,rgba(249,178,215,0.32),transparent_38%),linear-gradient(135deg,rgba(255,255,255,0.82),rgba(255,245,245,0.74))] p-5 shadow-[0_18px_48px_rgba(170,110,130,0.16)]">
          <div className="mb-2 inline-flex rounded-full bg-[#F6B6C8]/45 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8A4D62]">
            {copy.badge}
          </div>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="font-electrolize text-3xl text-[#4A4A4A]">Peach</h2>
              <p className="mt-2 max-w-2xl text-sm text-[#795E67]">{copy.summary}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {['8 Weeks', '4 Lift Days', 'Glute Priority'].map((item) => (
                <span key={item} className="rounded-full border border-[#E2B4BD]/45 bg-white/65 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#795E67]">{item}</span>
              ))}
            </div>
          </div>
        </Card>

        <Card className="border border-[#E2B4BD]/50 bg-white/72 p-5 shadow-[0_18px_48px_rgba(170,110,130,0.14)]">
          <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-[#795E67]">Weekly Schedule</h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-7">
            {[
              ['Monday', 'Rest'],
              ['Tuesday', 'Back + Biceps + Abs'],
              ['Wednesday', 'Quads + Glutes'],
              ['Thursday', 'Chest + Shoulders + Triceps + Abs'],
              ['Friday', 'Glutes + Hamstrings'],
              ['Saturday', 'Rest'],
              ['Sunday', 'Recovery'],
            ].map(([day, label]) => (
              <div key={day} className={`rounded-2xl border px-3 py-3 ${label === 'Rest' || label === 'Recovery' ? 'border-[#E2B4BD]/35 bg-[#FFF7F7]' : 'border-[#D78DA4]/45 bg-[#F6B6C8]/20'}`}>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#A98490]">{day}</p>
                <p className="mt-1 text-sm font-semibold text-[#4A4A4A]">{label}</p>
              </div>
            ))}
          </div>
        </Card>

        {peachDays.map((day) => (
          <Card key={day.id} className="border border-[#E2B4BD]/50 bg-white/72 p-5 shadow-[0_18px_48px_rgba(170,110,130,0.14)]">
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#A98490]">{day.dayName}</div>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h4 className="text-lg font-semibold text-[#4A4A4A]">{day.displayName}</h4>
                <p className="mt-2 text-sm text-[#795E67]">{day.summary}</p>
              </div>
              <div className="grid shrink-0 grid-cols-3 gap-2">
                {day.targetMuscles.slice(0, 3).map((muscle) => (
                  <div key={`${day.id}-${muscle}`} className="h-10 w-10 overflow-hidden rounded-xl border border-[#E2B4BD]/45 bg-white/65" title={muscle}>
                    <img src={getBodyPartImage(muscle)} alt={muscle} className="h-full w-full object-cover" />
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {day.exercises.map((exercise) => (
                <div key={`${day.id}-${exercise.name}`} className="rounded-2xl border border-[#E2B4BD]/45 bg-[#FFF7F7]/80 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-[#4A4A4A]">{exercise.name}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.14em] text-[#B76E8A]">{exercise.sets} x {exercise.reps} | {exercise.targetRIR} RIR</p>
                    </div>
                    <span className="rounded-full border border-[#E2B4BD]/45 bg-white/70 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#795E67]">
                      Rest {exercise.restSeconds}{exercise.restMaxSeconds ? `-${exercise.restMaxSeconds}` : ''}s
                    </span>
                  </div>
                  <p className="mt-3 text-xs text-[#8F707A]">
                    {exercise.primaryMuscles.join(', ')} | {exercise.movementPattern}
                  </p>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>

      {isConfirmOpen && createPortal(
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[#4A2430]/55 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-[1.75rem] border border-[#E2B4BD]/55 bg-white p-5 text-[#4A4A4A] shadow-[0_24px_72px_rgba(170,110,130,0.24)]">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F6B6C8]/35 text-[#B76E8A]">
              <Sparkles size={22} />
            </div>
            <h2 className="mt-4 text-lg font-semibold">{modalCopy.title}</h2>
            <p className="mt-2 text-sm leading-6 text-[#795E67]">{modalCopy.body}</p>
            <p className="mt-3 rounded-2xl border border-[#E2B4BD]/45 bg-[#FFF7F7] p-3 text-xs leading-5 text-[#8F707A]">{modalCopy.hint}</p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button type="button" onClick={() => setIsConfirmOpen(false)} className="min-h-11 rounded-2xl border border-[#E2B4BD]/45 bg-white px-4 text-sm font-semibold text-[#795E67]">
                {copy.cancel}
              </button>
              <button type="button" onClick={handleApplyPlan} disabled={isApplying} className="min-h-11 rounded-2xl bg-[#F6B6C8] px-4 text-sm font-black text-[#4A4A4A] disabled:cursor-wait disabled:opacity-70">
                {isApplying ? copy.usingPlan : copy.confirm}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}

      {isCurrentPlanActive ? (
        <div className="fixed bottom-[calc(env(safe-area-inset-bottom,0px)+1rem)] left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-full border border-[#D78DA4]/45 bg-white/85 px-4 py-2 text-xs font-semibold text-[#8A4D62] shadow-[0_18px_48px_rgba(170,110,130,0.18)] backdrop-blur">
          <Check size={14} /> {copy.activePlan}
        </div>
      ) : null}
    </div>
  );
}
