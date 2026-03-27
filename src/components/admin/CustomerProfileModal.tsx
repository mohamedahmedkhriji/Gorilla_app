import React, { useEffect, useMemo, useState } from 'react';
import { X, Calendar, Target, TrendingUp } from 'lucide-react';
import { api } from '../../services/api';
import {
  extractCycleWeeksFromPrompt,
  inferTemplateFromPrompt,
  mapAiWorkoutTypesToTemplate,
  READY_PLAN_TEMPLATES,
  recommendTemplateByDays,
  type ReadyPlanTemplate,
  type ReadyTemplateId,
} from './coachPlanTemplates';

interface Client {
  id: string;
  name: string;
  age: number | null;
  avatar: string;
  rank: 'bronze' | 'silver' | 'gold' | 'elite';
  profilePicture?: string | null;
}

interface CustomerProfileModalProps {
  client: Client;
  onClose: () => void;
  isLightTheme?: boolean;
}

type ActiveTab = 'overview' | 'workouts' | 'program' | 'progress' | 'createPlan';

interface PlanExerciseDraft {
  exerciseName: string;
  sets: number;
  reps: string;
  notes: string;
}

interface DayPlanDraft {
  workoutName: string;
  exercises: PlanExerciseDraft[];
}

type CreatePlanMode = ReadyTemplateId | 'ai' | 'edit' | null;

interface CoachPlanDraftInput {
  planName: string;
  description: string;
  cycleWeeks: number;
  selectedDays: string[];
  dayPlans: Record<string, DayPlanDraft>;
}

const DAY_OPTIONS = [
  { key: 'monday', label: 'Mon' },
  { key: 'tuesday', label: 'Tue' },
  { key: 'wednesday', label: 'Wed' },
  { key: 'thursday', label: 'Thu' },
  { key: 'friday', label: 'Fri' },
  { key: 'saturday', label: 'Sat' },
  { key: 'sunday', label: 'Sun' },
];

const rankStyles = {
  bronze: {
    bg: 'bg-gradient-to-b from-amber-800 to-amber-600',
    border: 'border-amber-400',
    glow: 'shadow-[0_0_20px_rgba(217,119,6,0.6)]',
    label: 'Beginner',
    shieldBg: 'border-t-amber-700'
  },
  silver: {
    bg: 'bg-gradient-to-b from-gray-300 to-gray-500',
    border: 'border-gray-200',
    glow: 'shadow-[0_0_25px_rgba(156,163,175,0.7)]',
    label: 'Intermediate',
    shieldBg: 'border-t-gray-400'
  },
  gold: {
    bg: 'bg-gradient-to-b from-yellow-400 to-yellow-600',
    border: 'border-yellow-300',
    glow: 'shadow-[0_0_30px_rgba(253,224,71,0.8)]',
    label: 'Advanced',
    shieldBg: 'border-t-yellow-500'
  },
  elite: {
    bg: 'bg-gradient-to-b from-cyan-400 via-blue-600 to-blue-900',
    border: 'border-cyan-300',
    glow: 'shadow-[0_0_40px_rgba(59,130,246,0.9)]',
    label: 'Elite',
    shieldBg: 'border-t-blue-800'
  }
};

const toNumberOrNull = (value: unknown): number | null => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const firstNumber = (...values: unknown[]): number | null => {
  for (const value of values) {
    const n = toNumberOrNull(value);
    if (n != null) return n;
  }
  return null;
};

const formatMonthYear = (value: unknown) => {
  if (!value) return 'N/A';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return 'N/A';
  return date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
};

const formatDate = (value: unknown) => {
  if (!value) return 'N/A';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return 'N/A';
  return date.toLocaleDateString();
};

const formatMetric = (value: number | null, unit = '', decimals = 0) => {
  if (value == null) return 'N/A';
  const shown = decimals > 0 ? value.toFixed(decimals) : String(Math.round(value));
  return unit ? `${shown} ${unit}` : shown;
};

const parseExercisesCount = (value: unknown): number => {
  if (Array.isArray(value)) return value.length;
  if (typeof value !== 'string') return 0;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
};

const normalizeDayKey = (value: unknown): string | null => {
  const key = String(value || '').trim().toLowerCase();
  if (!key) return null;
  if (key.startsWith('mon')) return 'monday';
  if (key.startsWith('tue')) return 'tuesday';
  if (key.startsWith('wed')) return 'wednesday';
  if (key.startsWith('thu')) return 'thursday';
  if (key.startsWith('fri')) return 'friday';
  if (key.startsWith('sat')) return 'saturday';
  if (key.startsWith('sun')) return 'sunday';
  return null;
};

const defaultExercise = (): PlanExerciseDraft => ({
  exerciseName: '',
  sets: 3,
  reps: '8-12',
  notes: '',
});

const parseWorkoutExercises = (raw: unknown): PlanExerciseDraft[] => {
  let source: any[] = [];
  if (Array.isArray(raw)) {
    source = raw;
  } else if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      source = Array.isArray(parsed) ? parsed : [];
    } catch {
      source = [];
    }
  }

  const mapped = source
    .map((exercise: any) => ({
      exerciseName: String(exercise?.exerciseName || exercise?.name || '').trim(),
      sets: Math.max(1, Math.min(10, Number(exercise?.sets || 3) || 3)),
      reps: String(exercise?.reps || '8-12').trim() || '8-12',
      notes: String(exercise?.notes || '').trim(),
    }))
    .filter((exercise) => exercise.exerciseName);

  return mapped.length ? mapped : [defaultExercise()];
};

const extractMeasurementInput = (snapshot: any): Record<string, unknown> => {
  const raw = snapshot?.rawPayload;
  if (!raw || typeof raw !== 'object') return {};
  const input = (raw as any).input;
  return input && typeof input === 'object' ? input : {};
};

const buildPlanDraftFromTemplate = (
  template: ReadyPlanTemplate,
  input: {
    clientName: string;
    planName?: string;
    description?: string;
    cycleWeeks?: number;
  },
): CoachPlanDraftInput => {
  const dayPlans: Record<string, DayPlanDraft> = {};

  template.weeklyWorkouts.forEach((workout, index) => {
    const normalizedDay = normalizeDayKey(workout.dayName);
    const dayKey = normalizedDay || template.selectedDays[index];
    if (!dayKey) return;
    dayPlans[dayKey] = {
      workoutName: String(workout.workoutName || `Workout ${index + 1}`).trim() || `Workout ${index + 1}`,
      exercises: workout.exercises.length
        ? workout.exercises.map((exercise) => ({
          exerciseName: String(exercise.exerciseName || '').trim(),
          sets: Math.max(1, Math.min(10, Number(exercise.sets || 3) || 3)),
          reps: String(exercise.reps || '8-12').trim() || '8-12',
          notes: String(exercise.notes || '').trim(),
        }))
        : [defaultExercise()],
    };
  });

  template.selectedDays.forEach((dayKey, index) => {
    if (!dayPlans[dayKey]) {
      dayPlans[dayKey] = {
        workoutName: `Workout ${index + 1}`,
        exercises: [defaultExercise()],
      };
    }
  });

  const defaultPlanName = `${template.title} Plan`;
  const defaultDescription = `${template.title} template assigned by coach for ${input.clientName}`;
  return {
    planName: String(input.planName || defaultPlanName).trim() || defaultPlanName,
    description: String(input.description || defaultDescription).trim() || defaultDescription,
    cycleWeeks: Math.max(8, Math.min(16, Math.round(Number(input.cycleWeeks || template.cycleWeeks) || 8))),
    selectedDays: [...template.selectedDays],
    dayPlans,
  };
};

export const CustomerProfileModal: React.FC<CustomerProfileModalProps> = ({ client, onClose, isLightTheme }) => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [profileDetails, setProfileDetails] = useState<any>(null);
  const [profileStats, setProfileStats] = useState<any>(null);
  const [profilePicture, setProfilePicture] = useState<string | null>(client.profilePicture || null);
  const [programData, setProgramData] = useState<any>(null);
  const [programProgress, setProgramProgress] = useState<any>(null);
  const [missions, setMissions] = useState<any[]>([]);
  const [gamificationSummary, setGamificationSummary] = useState<any>(null);
  const [recentActivity, setRecentActivity] = useState<any>(null);
  const [overloadPlan, setOverloadPlan] = useState<any>(null);
  const [strengthProgress, setStrengthProgress] = useState<any>(null);
  const [insightsHistory, setInsightsHistory] = useState<any>(null);
  const [coachPlanName, setCoachPlanName] = useState('');
  const [coachPlanDescription, setCoachPlanDescription] = useState('');
  const [coachCycleWeeks, setCoachCycleWeeks] = useState(8);
  const [coachSelectedDays, setCoachSelectedDays] = useState<string[]>([]);
  const [coachDayPlans, setCoachDayPlans] = useState<Record<string, DayPlanDraft>>({});
  const [planInitialized, setPlanInitialized] = useState(false);
  const [savingCoachPlan, setSavingCoachPlan] = useState(false);
  const [coachPlanError, setCoachPlanError] = useState('');
  const [coachPlanSuccess, setCoachPlanSuccess] = useState('');
  const [selectedCreatePlanMode, setSelectedCreatePlanMode] = useState<CreatePlanMode>(null);
  const [aiCoachPrompt, setAiCoachPrompt] = useState('');
  const [generatingAiDraft, setGeneratingAiDraft] = useState(false);
  const [aiDraftTemplateId, setAiDraftTemplateId] = useState<ReadyTemplateId | null>(null);
  const [assigningTemplateId, setAssigningTemplateId] = useState<ReadyTemplateId | null>(null);

  const style = rankStyles[client.rank];
  const userId = useMemo(() => Number(client.id), [client.id]);
  const coachId = useMemo(() => {
    const adminUser = JSON.parse(localStorage.getItem('adminUser') || '{}');
    const coach = JSON.parse(localStorage.getItem('coach') || '{}');
    return Number(adminUser?.id || coach?.id || 0);
  }, []);
  const resolvedIsLightTheme = useMemo(() => {
    if (typeof isLightTheme === 'boolean') return isLightTheme;
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('coach-dashboard-theme') === 'light';
  }, [isLightTheme]);

  useEffect(() => {
    setPlanInitialized(false);
    setCoachPlanError('');
    setCoachPlanSuccess('');
    setSelectedCreatePlanMode(null);
    setAiCoachPrompt('');
    setAiDraftTemplateId(null);
    setAssigningTemplateId(null);
    setProfilePicture(client.profilePicture || null);
  }, [userId]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!Number.isFinite(userId) || userId <= 0) {
        setError('Invalid user');
        return;
      }

      setLoading(true);
      setError('');

      const results = await Promise.allSettled([
        api.getProfileDetails(userId),
        api.getProfileStats(userId),
        api.getProfilePicture(userId),
        api.getUserProgram(userId),
        api.getProgramProgress(userId),
        api.getUserMissions(userId),
        api.getGamificationSummary(userId),
        api.getRecentWorkoutActivity(userId),
        api.getOverloadPlan(userId),
        api.getStrengthProgress(userId, 8),
        api.getUserInsightsHistory(userId, {
          days: 365,
          limit: 100,
          includeRawPayload: true,
        }),
      ]);

      if (cancelled) return;

      const hasFailure = results.some((item) => item.status === 'rejected');
      if (hasFailure) {
        setError('Some profile data could not be loaded.');
      }

      if (results[0].status === 'fulfilled') setProfileDetails(results[0].value);
      if (results[1].status === 'fulfilled') setProfileStats(results[1].value);
      if (results[2].status === 'fulfilled') setProfilePicture(String(results[2].value?.profilePicture || '').trim() || null);
      if (results[3].status === 'fulfilled') setProgramData(results[3].value);
      if (results[4].status === 'fulfilled') setProgramProgress(results[4].value);
      if (results[5].status === 'fulfilled') setMissions(Array.isArray(results[5].value) ? results[5].value : []);
      if (results[6].status === 'fulfilled') setGamificationSummary(results[6].value);
      if (results[7].status === 'fulfilled') setRecentActivity(results[7].value);
      if (results[8].status === 'fulfilled') setOverloadPlan(results[8].value);
      if (results[9].status === 'fulfilled') setStrengthProgress(results[9].value);
      if (results[10].status === 'fulfilled') setInsightsHistory(results[10].value);

      setLoading(false);
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const summary = useMemo(() => programProgress?.summary || {}, [programProgress]);
  const memberSince = formatMonthYear(profileStats?.firstCompletedAt);
  const streakDays = Number(summary?.workoutStreakDays || 0);
  const totalSessions = Number(summary?.completedWorkouts || summary?.totalWorkouts || 0);
  const workoutsThisWeek = Number(summary?.workoutsCompletedThisWeek || 0);

  const missionItems = Array.isArray(missions) ? missions : [];
  const completedFromList = missionItems.filter((item) => Boolean(item?.completed)).length;
  const completedMissions = completedFromList || Number(gamificationSummary?.completedMissions || 0);
  const totalMissions = missionItems.length
    || (Number(gamificationSummary?.completedMissions || 0) + Number(gamificationSummary?.activeMissions || 0));

  const latestSnapshot = useMemo(() => {
    const snapshots = Array.isArray(insightsHistory?.snapshots) ? insightsHistory.snapshots : [];
    return snapshots.length ? snapshots[0] : null;
  }, [insightsHistory]);

  const rawMeasurementInput = useMemo(() => extractMeasurementInput(latestSnapshot), [latestSnapshot]);

  const measurements = useMemo(() => ({
    weight: firstNumber(latestSnapshot?.weightKg, profileDetails?.weightKg),
    bodyFat: firstNumber(
      rawMeasurementInput.bodyFat,
      rawMeasurementInput.body_fat,
      rawMeasurementInput.bodyFatPercentage,
      rawMeasurementInput.body_fat_percentage,
    ),
    chest: firstNumber(rawMeasurementInput.chest, rawMeasurementInput.chestCm, rawMeasurementInput.chest_cm),
    waist: firstNumber(rawMeasurementInput.waist, rawMeasurementInput.waistCm, rawMeasurementInput.waist_cm),
    arms: firstNumber(rawMeasurementInput.arms, rawMeasurementInput.armsCm, rawMeasurementInput.arms_cm),
    legs: firstNumber(rawMeasurementInput.legs, rawMeasurementInput.legsCm, rawMeasurementInput.legs_cm),
  }), [latestSnapshot?.weightKg, profileDetails?.weightKg, rawMeasurementInput]);

  const weeklyProgramWorkouts = useMemo(() => {
    if (!Array.isArray(programData?.currentWeekWorkouts)) return [];
    return programData.currentWeekWorkouts;
  }, [programData]);

  useEffect(() => {
    if (planInitialized) return;

    const byDay: Record<string, DayPlanDraft> = {};
    const selectedFromProgram: string[] = [];
    weeklyProgramWorkouts.forEach((workout: any, index: number) => {
      const dayKey = normalizeDayKey(workout?.day_name || workout?.dayName);
      if (!dayKey) return;
      if (!selectedFromProgram.includes(dayKey)) selectedFromProgram.push(dayKey);
      byDay[dayKey] = {
        workoutName: String(workout?.workout_name || workout?.workoutName || `Workout ${index + 1}`).trim() || `Workout ${index + 1}`,
        exercises: parseWorkoutExercises(workout?.exercises),
      };
    });

    const defaultSelected = selectedFromProgram.length
      ? selectedFromProgram
      : ['monday', 'wednesday', 'friday', 'saturday'];
    defaultSelected.forEach((dayKey, index) => {
      if (!byDay[dayKey]) {
        byDay[dayKey] = {
          workoutName: `Workout ${index + 1}`,
          exercises: [defaultExercise()],
        };
      }
    });

    setCoachSelectedDays(defaultSelected);
    setCoachDayPlans(byDay);
    setCoachPlanName(
      String(programData?.name || 'Coach Custom Plan').trim() || 'Coach Custom Plan',
    );
    setCoachPlanDescription(
      String(programData?.description || '').trim() || `Coach-created plan for ${client.name}`,
    );
    const programWeeks = Number(programData?.totalWeeks || 0);
    const boundedWeeks = Number.isFinite(programWeeks)
      ? Math.max(8, Math.min(16, Math.round(programWeeks)))
      : 8;
    setCoachCycleWeeks(boundedWeeks);
    setPlanInitialized(true);
  }, [planInitialized, programData, weeklyProgramWorkouts, client.name]);

  const workoutRows = useMemo(() => {
    const rows: Array<{
      key: string;
      title: string;
      date: string;
      duration: string;
      exercises: string;
      state: string;
    }> = [];

    const latest = recentActivity?.activity;
    if (latest) {
      rows.push({
        key: `latest-${latest.date || 'now'}`,
        title: String(latest.title || 'Workout Session'),
        date: formatDate(latest.date),
        duration: 'N/A',
        exercises: 'N/A',
        state: 'Latest Completed',
      });
    }

    weeklyProgramWorkouts.slice(0, 6).forEach((workout: any, index: number) => {
      const exerciseCount = parseExercisesCount(workout?.exercises);
      rows.push({
        key: `plan-${index}-${workout?.day_name || ''}`,
        title: String(workout?.workout_name || workout?.workoutType || 'Workout'),
        date: workout?.day_name ? String(workout.day_name) : `Day ${index + 1}`,
        duration: 'N/A',
        exercises: exerciseCount > 0 ? `${exerciseCount} exercises` : 'N/A',
        state: 'Planned',
      });
    });

    return rows;
  }, [recentActivity, weeklyProgramWorkouts]);

  const currentProgram = useMemo(() => {
    const hasActiveProgram = Boolean(programProgress?.hasActiveProgram && programData?.id);
    const currentWeek = Number(summary?.currentWeek || programData?.currentWeek || 1);
    const totalWeeks = Number(summary?.totalWeeks || programData?.totalWeeks || 0);

    return {
      hasActiveProgram,
      name: String(programData?.name || programProgress?.program?.name || 'No Program Assigned'),
      week: currentWeek,
      totalWeeks,
      nextWorkout: String(programData?.todayWorkout?.name || weeklyProgramWorkouts[0]?.workout_name || 'N/A'),
      schedule: weeklyProgramWorkouts.map((workout: any) => {
        const day = workout?.day_name
          ? String(workout.day_name).slice(0, 3)
          : `Day ${workout?.day_order || ''}`;
        const name = String(workout?.workout_name || workout?.workoutType || 'Workout');
        return `${day}: ${name}`;
      }),
    };
  }, [programData, programProgress, summary, weeklyProgramWorkouts]);

  const strengthRecommendations = Array.isArray(overloadPlan?.recommendations)
    ? overloadPlan.recommendations.slice(0, 3)
    : [];
  const strengthSummary = strengthProgress?.summary || null;
  const resolvedProfilePicture = String(profilePicture || client.profilePicture || '').trim() || null;
  const readyTemplateById = useMemo(() => {
    const map = new Map<ReadyTemplateId, ReadyPlanTemplate>();
    READY_PLAN_TEMPLATES.forEach((template) => {
      map.set(template.id, template);
    });
    return map;
  }, []);
  const selectedReadyTemplate = useMemo(() => {
    if (!selectedCreatePlanMode) return null;
    if (selectedCreatePlanMode === 'ai' || selectedCreatePlanMode === 'edit') return null;
    return readyTemplateById.get(selectedCreatePlanMode) || null;
  }, [selectedCreatePlanMode, readyTemplateById]);

  const modalClass = resolvedIsLightTheme
    ? 'bg-white text-[#111827]'
    : 'bg-[#1A1A1A] text-white';
  const modalHeaderClass = resolvedIsLightTheme
    ? 'bg-white border-slate-200'
    : 'bg-[#1A1A1A] border-gray-800';
  const panelClass = resolvedIsLightTheme
    ? 'bg-white border border-slate-200'
    : 'bg-[#242424]';
  const cardClass = resolvedIsLightTheme
    ? 'bg-[#F8FAFC] border border-slate-200'
    : 'bg-[#1A1A1A]';
  const textPrimaryClass = resolvedIsLightTheme ? 'text-[#111827]' : 'text-white';
  const textMutedClass = resolvedIsLightTheme ? 'text-slate-600' : 'text-gray-400';
  const textSubtleClass = resolvedIsLightTheme ? 'text-slate-600' : 'text-white/70';
  const tabBorderClass = resolvedIsLightTheme ? 'border-slate-200' : 'border-gray-700';
  const tabInactiveClass = resolvedIsLightTheme ? 'text-slate-600' : 'text-gray-400';
  const progressTrackClass = resolvedIsLightTheme ? 'bg-slate-200' : 'bg-gray-700';
  const createPlanCardClass = resolvedIsLightTheme
    ? 'bg-[#F8FAFC] border border-slate-200'
    : 'bg-[#1A1A1A] border border-white/10';

  const ensureDayPlan = (dayKey: string): DayPlanDraft => (
    coachDayPlans[dayKey] || {
      workoutName: 'Workout',
      exercises: [defaultExercise()],
    }
  );
  const getDayPlanFrom = (plans: Record<string, DayPlanDraft>, dayKey: string): DayPlanDraft => (
    plans[dayKey] || {
      workoutName: 'Workout',
      exercises: [defaultExercise()],
    }
  );

  const toggleCoachDay = (dayKey: string) => {
    setCoachPlanError('');
    setCoachPlanSuccess('');
    setCoachSelectedDays((prev) => {
      if (prev.includes(dayKey)) {
        return prev.filter((item) => item !== dayKey);
      }
      return [...prev, dayKey];
    });
    setCoachDayPlans((prev) => (
      prev[dayKey]
        ? prev
        : {
          ...prev,
          [dayKey]: {
            workoutName: 'Workout',
            exercises: [defaultExercise()],
          },
        }
    ));
  };

  const updateWorkoutName = (dayKey: string, value: string) => {
    setCoachDayPlans((prev) => {
      const day = getDayPlanFrom(prev, dayKey);
      return {
        ...prev,
        [dayKey]: {
          ...day,
          workoutName: value,
        },
      };
    });
  };

  const updateDayExercise = (
    dayKey: string,
    index: number,
    patch: Partial<PlanExerciseDraft>,
  ) => {
    setCoachDayPlans((prev) => {
      const day = getDayPlanFrom(prev, dayKey);
      const nextExercises = day.exercises.map((exercise, i) => (
        i === index ? { ...exercise, ...patch } : exercise
      ));
      return {
        ...prev,
        [dayKey]: {
          ...day,
          exercises: nextExercises,
        },
      };
    });
  };

  const addDayExercise = (dayKey: string) => {
    setCoachDayPlans((prev) => {
      const day = getDayPlanFrom(prev, dayKey);
      return {
        ...prev,
        [dayKey]: {
          ...day,
          exercises: [...day.exercises, defaultExercise()],
        },
      };
    });
  };

  const removeDayExercise = (dayKey: string, index: number) => {
    setCoachDayPlans((prev) => {
      const day = getDayPlanFrom(prev, dayKey);
      const nextExercises = day.exercises.filter((_, i) => i !== index);
      return {
        ...prev,
        [dayKey]: {
          ...day,
          exercises: nextExercises.length ? nextExercises : [defaultExercise()],
        },
      };
    });
  };

  const applyPlanDraftToBuilder = (draft: CoachPlanDraftInput) => {
    const orderedDays = DAY_OPTIONS
      .map((day) => day.key)
      .filter((dayKey) => draft.selectedDays.includes(dayKey));
    setCoachSelectedDays(orderedDays);
    setCoachDayPlans({ ...draft.dayPlans });
    setCoachPlanName(String(draft.planName || '').trim() || 'Coach Custom Plan');
    setCoachPlanDescription(String(draft.description || '').trim() || `Coach-created plan for ${client.name}`);
    setCoachCycleWeeks(Math.max(8, Math.min(16, Math.round(Number(draft.cycleWeeks) || 8))));
    setPlanInitialized(true);
  };

  const saveCoachPlanDraft = async (
    draft: CoachPlanDraftInput,
    successMessage = 'Plan saved and activated for this user.',
  ): Promise<boolean> => {
    if (!coachId || coachId <= 0) {
      setCoachPlanError('Coach session not found. Please login again.');
      return false;
    }
    if (!userId || userId <= 0) {
      setCoachPlanError('Invalid user profile.');
      return false;
    }

    const selectedDays = DAY_OPTIONS
      .map((day) => day.key)
      .filter((dayKey) => draft.selectedDays.includes(dayKey));

    if (!selectedDays.length) {
      setCoachPlanError('Select at least one training day.');
      return false;
    }

    const weeklyWorkouts = selectedDays.map((dayKey) => {
      const day = getDayPlanFrom(draft.dayPlans, dayKey);
      return {
        dayName: dayKey,
        workoutName: String(day.workoutName || '').trim() || 'Workout',
        workoutType: 'Custom',
        exercises: day.exercises
          .map((exercise) => ({
            exerciseName: String(exercise.exerciseName || '').trim(),
            sets: Math.max(1, Math.min(10, Number(exercise.sets || 3) || 3)),
            reps: String(exercise.reps || '8-12').trim() || '8-12',
            notes: String(exercise.notes || '').trim() || null,
          }))
          .filter((exercise) => exercise.exerciseName),
      };
    });

    if (weeklyWorkouts.some((workout) => workout.exercises.length === 0)) {
      setCoachPlanError('Each selected day must have at least one exercise name.');
      return false;
    }

    try {
      setSavingCoachPlan(true);
      setCoachPlanError('');
      setCoachPlanSuccess('');
      await api.coachSaveCustomProgram(coachId, userId, {
        planName: String(draft.planName || '').trim() || 'Coach Custom Plan',
        description: String(draft.description || '').trim() || null,
        cycleWeeks: Math.max(8, Math.min(16, Math.round(Number(draft.cycleWeeks) || 8))),
        selectedDays,
        weeklyWorkouts,
      });

      const [latestProgram, latestProgress] = await Promise.all([
        api.getUserProgram(userId),
        api.getProgramProgress(userId),
      ]);
      setProgramData(latestProgram);
      setProgramProgress(latestProgress);
      setCoachPlanSuccess(successMessage);
      setPlanInitialized(false);
      window.dispatchEvent(new CustomEvent('program-updated'));
      return true;
    } catch (error: any) {
      console.error('Failed to save coach plan:', error);
      setCoachPlanError(error?.message || 'Failed to save plan.');
      return false;
    } finally {
      setSavingCoachPlan(false);
    }
  };

  const handleSaveCoachPlan = async () => saveCoachPlanDraft({
    planName: coachPlanName,
    description: coachPlanDescription,
    cycleWeeks: coachCycleWeeks,
    selectedDays: coachSelectedDays,
    dayPlans: coachDayPlans,
  });

  const handleAssignTemplate = async (templateId: ReadyTemplateId) => {
    const template = readyTemplateById.get(templateId);
    if (!template) {
      setCoachPlanError('Template not found.');
      return;
    }

    setCoachPlanError('');
    setCoachPlanSuccess('');
    setSelectedCreatePlanMode(templateId);
    setAiDraftTemplateId(null);

    const draft = buildPlanDraftFromTemplate(template, {
      clientName: client.name,
      planName: `${template.title} Program`,
      description: `${template.title} assigned by coach for ${client.name}`,
      cycleWeeks: template.cycleWeeks,
    });
    applyPlanDraftToBuilder(draft);

    try {
      setAssigningTemplateId(templateId);
      await saveCoachPlanDraft(draft, `${template.title} assigned and activated for this user.`);
    } finally {
      setAssigningTemplateId(null);
    }
  };

  const handleGenerateAiDraft = async () => {
    const prompt = String(aiCoachPrompt || '').trim();
    if (!prompt) {
      setCoachPlanError('Write a short AI prompt first.');
      return;
    }

    const fallbackDays = Math.max(
      2,
      Math.min(
        6,
        Number(summary?.workoutsPlannedThisWeek || weeklyProgramWorkouts.length || coachSelectedDays.length || 4),
      ),
    );

    setGeneratingAiDraft(true);
    setCoachPlanError('');
    setCoachPlanSuccess('');

    try {
      let templateId = inferTemplateFromPrompt(prompt);

      if (!templateId) {
        const insights = await api.getOnboardingInsights({
          age: client.age ?? null,
          weightKg: measurements.weight,
          bodyFatPercentage: measurements.bodyFat,
          chestCm: measurements.chest,
          waistCm: measurements.waist,
          armsCm: measurements.arms,
          legsCm: measurements.legs,
          workoutFrequency: fallbackDays,
          fitnessGoal: profileDetails?.fitnessGoal ?? profileDetails?.fitness_goal ?? null,
          prompt,
          coachPrompt: prompt,
        });

        const suggestedWorkoutTypes = Array.isArray(insights?.interpretation?.suggestedWorkoutTypes)
          ? insights.interpretation.suggestedWorkoutTypes
            .map((item: unknown) => String(item || '').trim())
            .filter(Boolean)
          : [];
        const suggestedDaysRaw = Number(
          insights?.interpretation?.workoutFrequency
          ?? insights?.interpretation?.recommendedWorkoutDays
          ?? fallbackDays,
        );
        const suggestedDays = Number.isFinite(suggestedDaysRaw)
          ? Math.max(2, Math.min(6, Math.round(suggestedDaysRaw)))
          : fallbackDays;
        templateId = mapAiWorkoutTypesToTemplate(suggestedWorkoutTypes, suggestedDays);
      }

      const resolvedTemplateId = templateId || recommendTemplateByDays(fallbackDays);
      const template = readyTemplateById.get(resolvedTemplateId) || READY_PLAN_TEMPLATES[0];
      const cycleWeeks = extractCycleWeeksFromPrompt(prompt) || template.cycleWeeks;

      const draft = buildPlanDraftFromTemplate(template, {
        clientName: client.name,
        planName: `AI ${template.title} Plan`,
        description: `AI draft for ${client.name}: ${prompt}`.slice(0, 255),
        cycleWeeks,
      });
      applyPlanDraftToBuilder(draft);
      setSelectedCreatePlanMode('ai');
      setAiDraftTemplateId(template.id);
      setCoachPlanSuccess(`AI drafted ${template.title}. Review the workouts, edit anything, then save.`);
    } catch (error: any) {
      console.error('Failed to generate AI draft:', error);
      setCoachPlanError(error?.message || 'Failed to generate AI draft.');
    } finally {
      setGeneratingAiDraft(false);
    }
  };

  const showEditableBuilder = selectedCreatePlanMode === 'edit'
    || (selectedCreatePlanMode === 'ai' && Boolean(aiDraftTemplateId));
  const selectedAiTemplate = aiDraftTemplateId ? readyTemplateById.get(aiDraftTemplateId) || null : null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 p-0 md:flex md:items-center md:justify-center md:p-4" onClick={onClose}>
      <div className={`${modalClass} absolute inset-x-0 bottom-0 max-h-[94vh] w-full overflow-y-auto rounded-t-[28px] border border-white/10 md:relative md:max-w-[90vw] md:rounded-[28px]`} onClick={(e) => e.stopPropagation()}>
        <div className={`sticky top-0 z-10 border-b p-4 ${modalHeaderClass}`}>
          <div className="mx-auto mb-3 h-1.5 w-14 rounded-full bg-current/15 md:hidden" />
          <div className="flex items-center justify-between gap-3">
          <h2 className={`text-xl font-bold md:text-2xl ${textPrimaryClass}`}>Customer Profile</h2>
          <button
            onClick={onClose}
            className={`rounded-2xl p-2 transition-colors ${resolvedIsLightTheme ? 'text-slate-500 hover:bg-slate-100 hover:text-[#111827]' : 'text-gray-400 hover:bg-white/10 hover:text-white'}`}
          >
            <X size={24} />
          </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 p-4 md:gap-6 md:p-6 lg:grid-cols-3">
          <div className={`lg:col-span-1 rounded-[28px] p-5 md:p-6 ${panelClass}`}>
            <h3 className={`text-xl font-bold ${textPrimaryClass}`}>{client.name}</h3>
            <p className="text-sm text-cyan-400 mb-6">{style.label}</p>

            <div className="flex justify-center mb-6">
              <div className={`relative w-full max-w-[240px] rounded-[28px] flex flex-col items-center px-6 pb-8 pt-8 border-2 ${style.bg} ${style.border} ${style.glow}`}>
                <div className="w-24 h-24 rounded-3xl overflow-hidden border-2 border-white bg-white/20 flex items-center justify-center">
                  {resolvedProfilePicture ? (
                    <img
                      src={resolvedProfilePicture}
                      alt={`${client.name} profile`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="font-bold text-4xl text-white">{client.avatar}</span>
                  )}
                </div>
                <p className="mt-4 text-white text-base font-semibold tracking-wide uppercase text-center px-2">
                  {client.name}
                </p>
                <span className="text-sm text-white/80 mt-2">{style.label}</span>
                <p className="text-white/70 text-sm mt-1">
                  {typeof client.age === 'number' ? `${client.age} years` : 'Age N/A'}
                </p>
              </div>
            </div>

            <div className={`text-sm ${textSubtleClass} space-y-2`}>
              <p>Member Since: {memberSince}</p>
              <p>Streak: {streakDays} days</p>
              <p>Total Sessions: {totalSessions}</p>
            </div>

            {error && (
              <p className="mt-4 text-xs text-red-400">{error}</p>
            )}
          </div>

          <div className={`lg:col-span-2 rounded-[28px] p-4 md:p-6 ${panelClass}`}>
            <div className={`mb-6 flex gap-2 overflow-x-auto border-b pb-3 ${tabBorderClass}`}>
              <button onClick={() => setActiveTab('overview')} className={`rounded-full px-4 py-2 whitespace-nowrap text-sm ${activeTab === 'overview' ? 'bg-[#10b981] text-black' : tabInactiveClass}`}>Overview</button>
              <button onClick={() => setActiveTab('workouts')} className={`rounded-full px-4 py-2 whitespace-nowrap text-sm ${activeTab === 'workouts' ? 'bg-[#10b981] text-black' : tabInactiveClass}`}>Workouts</button>
              <button onClick={() => setActiveTab('program')} className={`rounded-full px-4 py-2 whitespace-nowrap text-sm ${activeTab === 'program' ? 'bg-[#10b981] text-black' : tabInactiveClass}`}>Program</button>
              <button onClick={() => setActiveTab('progress')} className={`rounded-full px-4 py-2 whitespace-nowrap text-sm ${activeTab === 'progress' ? 'bg-[#10b981] text-black' : tabInactiveClass}`}>Progress</button>
              <button onClick={() => setActiveTab('createPlan')} className={`rounded-full px-4 py-2 whitespace-nowrap text-sm ${activeTab === 'createPlan' ? 'bg-[#10b981] text-black' : tabInactiveClass}`}>Create Plan</button>
            </div>

            {loading && (
              <div className={`text-sm mb-4 ${textMutedClass}`}>Loading profile data...</div>
            )}

            {activeTab === 'overview' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className={`${cardClass} p-4 rounded-lg`}>
                    <Calendar className="text-emerald-600 mb-2" size={20} />
                    <p className={`text-2xl font-bold ${textPrimaryClass}`}>{workoutsThisWeek}</p>
                    <p className={`text-xs ${textMutedClass}`}>Workouts This Week</p>
                  </div>
                  <div className={`${cardClass} p-4 rounded-lg`}>
                    <Target className="text-blue-400 mb-2" size={20} />
                    <p className={`text-2xl font-bold ${textPrimaryClass}`}>{completedMissions}/{totalMissions || 0}</p>
                    <p className={`text-xs ${textMutedClass}`}>Missions Completed</p>
                  </div>
                </div>
                <div className={`${cardClass} p-4 rounded-lg`}>
                  <h4 className={`font-semibold mb-3 ${textPrimaryClass}`}>Body Measurements</h4>
                  <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                    <p className={textMutedClass}>Weight: <span className={textPrimaryClass}>{formatMetric(measurements.weight, 'kg', 1)}</span></p>
                    <p className={textMutedClass}>Body Fat: <span className={textPrimaryClass}>{formatMetric(measurements.bodyFat, '%', 1)}</span></p>
                    <p className={textMutedClass}>Chest: <span className={textPrimaryClass}>{formatMetric(measurements.chest, 'cm', 1)}</span></p>
                    <p className={textMutedClass}>Waist: <span className={textPrimaryClass}>{formatMetric(measurements.waist, 'cm', 1)}</span></p>
                    <p className={textMutedClass}>Arms: <span className={textPrimaryClass}>{formatMetric(measurements.arms, 'cm', 1)}</span></p>
                    <p className={textMutedClass}>Legs: <span className={textPrimaryClass}>{formatMetric(measurements.legs, 'cm', 1)}</span></p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'workouts' && (
              <div className="space-y-3">
                {workoutRows.length === 0 && (
                  <div className={`${cardClass} p-4 rounded-lg text-sm ${textMutedClass}`}>
                    No workout records found.
                  </div>
                )}
                {workoutRows.map((workout) => (
                  <div key={workout.key} className={`${cardClass} p-4 rounded-lg`}>
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className={`font-semibold ${textPrimaryClass}`}>{workout.title}</p>
                        <p className={`text-xs ${textMutedClass}`}>{workout.date}</p>
                        <p className={`text-xs mt-1 ${resolvedIsLightTheme ? 'text-emerald-600' : 'text-emerald-600'}`}>{workout.state}</p>
                      </div>
                      <div className="text-right">
                        <p className={`text-sm ${textMutedClass}`}>{workout.duration}</p>
                        <p className={`text-xs ${textMutedClass}`}>{workout.exercises}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'program' && (
              <div className="space-y-4">
                <div className={`${cardClass} p-4 rounded-lg`}>
                  <h4 className={`font-semibold mb-2 ${textPrimaryClass}`}>{currentProgram.name}</h4>
                  <p className={`text-sm mb-3 ${textMutedClass}`}>
                    Week {currentProgram.week} of {currentProgram.totalWeeks || 0}
                  </p>
                  <div className={`w-full h-2 rounded mb-4 ${progressTrackClass}`}>
                    <div
                      className="h-2 bg-[#10b981] rounded"
                      style={{
                        width: `${currentProgram.totalWeeks > 0 ? Math.min(100, (currentProgram.week / currentProgram.totalWeeks) * 100) : 0}%`,
                      }}
                    />
                  </div>
                  <p className={`text-sm mb-2 ${textPrimaryClass}`}>
                    Next: <span className="text-emerald-600">{currentProgram.nextWorkout}</span>
                  </p>
                </div>
                <div className={`${cardClass} p-4 rounded-lg`}>
                  <h4 className={`font-semibold mb-3 ${textPrimaryClass}`}>Weekly Schedule</h4>
                  {currentProgram.schedule.length > 0 ? (
                    currentProgram.schedule.map((day: string, idx: number) => (
                      <p key={idx} className={`text-sm mb-1 ${textMutedClass}`}>{day}</p>
                    ))
                  ) : (
                    <p className={`text-sm ${textMutedClass}`}>No active program schedule.</p>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'progress' && (
              <div className="space-y-4">
                <div className={`${cardClass} p-4 rounded-lg`}>
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingUp className="text-emerald-600" size={18} />
                    <h4 className={`font-semibold ${textPrimaryClass}`}>Strength Progress</h4>
                  </div>
                  {strengthRecommendations.length > 0 ? (
                    <div className="space-y-2 text-sm">
                      {strengthRecommendations.map((item: any, idx: number) => (
                        <div key={`${item?.name || 'strength'}-${idx}`} className="flex justify-between gap-3">
                          <span className={resolvedIsLightTheme ? textPrimaryClass : textMutedClass}>{String(item?.name || 'Exercise')}</span>
                          <span className="text-emerald-600">
                            {String(item?.current || '')} {'->'} {String(item?.next || '')}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : strengthSummary ? (
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className={textMutedClass}>Baseline Avg E1RM</span>
                        <span className={textPrimaryClass}>{formatMetric(toNumberOrNull(strengthSummary?.baselineAvgE1RM), 'kg', 1)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className={textMutedClass}>Current Avg E1RM</span>
                        <span className={textPrimaryClass}>{formatMetric(toNumberOrNull(strengthSummary?.currentAvgE1RM), 'kg', 1)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className={textMutedClass}>Change</span>
                        <span className="text-emerald-600">{formatMetric(toNumberOrNull(strengthSummary?.percentChange), '%', 1)}</span>
                      </div>
                    </div>
                  ) : (
                    <p className={`text-sm ${textMutedClass}`}>Not enough strength data yet.</p>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'createPlan' && (
              <div className="space-y-4">
                <div className={`${createPlanCardClass} p-4 rounded-lg`}>
                  <h4 className={`font-semibold mb-1 ${textPrimaryClass}`}>Choose Plan Action</h4>
                  <p className={`text-sm mb-3 ${textMutedClass}`}>
                    Assign a ready split, generate a draft with AI, or edit the user&apos;s current plan.
                  </p>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {READY_PLAN_TEMPLATES.map((template) => {
                      const isSelected = selectedCreatePlanMode === template.id;
                      const isAssigning = savingCoachPlan && assigningTemplateId === template.id;
                      return (
                        <div
                          key={template.id}
                          className={`rounded-xl border p-3 transition-colors ${
                            isSelected
                              ? 'border-[#10b981] bg-[#10b981]/10'
                              : resolvedIsLightTheme
                                ? 'border-slate-200 bg-white'
                                : 'border-gray-700 bg-[#111]'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => setSelectedCreatePlanMode(template.id)}
                            className="w-full text-left"
                          >
                            <div className={`font-semibold ${textPrimaryClass}`}>{template.title}</div>
                            <div className={`text-xs mt-1 ${textMutedClass}`}>{template.subtitle}</div>
                            <div className={`text-xs mt-2 ${textMutedClass}`}>
                              {template.selectedDays.length} days/week
                            </div>
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleAssignTemplate(template.id)}
                            disabled={savingCoachPlan || generatingAiDraft}
                            className="mt-3 w-full rounded-lg px-3 py-2 text-xs font-semibold bg-[#10b981] text-white hover:bg-[#0ea574] transition-colors disabled:opacity-60"
                          >
                            {isAssigning ? 'Assigning...' : 'Assign To User'}
                          </button>
                        </div>
                      );
                    })}

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCreatePlanMode('ai');
                        setCoachPlanError('');
                        setCoachPlanSuccess('');
                      }}
                      className={`rounded-xl border p-3 text-left transition-colors ${
                        selectedCreatePlanMode === 'ai'
                          ? 'border-[#10b981] bg-[#10b981]/10'
                          : resolvedIsLightTheme
                            ? 'border-slate-200 bg-white'
                            : 'border-gray-700 bg-[#111]'
                      }`}
                    >
                      <div className={`font-semibold ${textPrimaryClass}`}>Create with AI</div>
                      <div className={`text-xs mt-1 ${textMutedClass}`}>
                        Coach writes a prompt, AI drafts the program, coach reviews and saves.
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCreatePlanMode('edit');
                        setAiDraftTemplateId(null);
                        setCoachPlanError('');
                        setCoachPlanSuccess('');
                        setPlanInitialized(false);
                      }}
                      className={`rounded-xl border p-3 text-left transition-colors ${
                        selectedCreatePlanMode === 'edit'
                          ? 'border-[#10b981] bg-[#10b981]/10'
                          : resolvedIsLightTheme
                            ? 'border-slate-200 bg-white'
                            : 'border-gray-700 bg-[#111]'
                      }`}
                    >
                      <div className={`font-semibold ${textPrimaryClass}`}>Edit Existing Plan</div>
                      <div className={`text-xs mt-1 ${textMutedClass}`}>
                        Load the active user plan, edit it, and save the update.
                      </div>
                    </button>
                  </div>
                </div>

                {selectedReadyTemplate && (
                  <div className={`${createPlanCardClass} p-4 rounded-lg space-y-3`}>
                    <div className="flex items-center justify-between gap-3">
                      <h4 className={`font-semibold ${textPrimaryClass}`}>{selectedReadyTemplate.title} Plan Content</h4>
                      <span className={`text-xs ${textMutedClass}`}>
                        {selectedReadyTemplate.selectedDays.length} days/week
                      </span>
                    </div>
                    <p className={`text-sm ${textMutedClass}`}>{selectedReadyTemplate.subtitle}</p>

                    <div className="flex flex-wrap gap-2">
                      {selectedReadyTemplate.selectedDays.map((dayKey) => {
                        const label = DAY_OPTIONS.find((day) => day.key === dayKey)?.label || dayKey;
                        return (
                          <span
                            key={`preview-day-${selectedReadyTemplate.id}-${dayKey}`}
                            className="px-2.5 py-1 rounded-full text-xs border border-[#10b981]/40 bg-[#10b981]/10 text-[#10b981]"
                          >
                            {label}
                          </span>
                        );
                      })}
                    </div>

                    <div className="space-y-2">
                      {selectedReadyTemplate.weeklyWorkouts.map((workout) => (
                        <div
                          key={`preview-workout-${selectedReadyTemplate.id}-${workout.dayName}`}
                          className={`rounded-lg border p-3 ${
                            resolvedIsLightTheme ? 'bg-white border-slate-200' : 'bg-[#111] border-gray-700'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className={`text-sm font-semibold ${textPrimaryClass}`}>
                              {(DAY_OPTIONS.find((day) => day.key === workout.dayName)?.label || workout.dayName)} - {workout.workoutName}
                            </p>
                            <span className={`text-[10px] uppercase ${textMutedClass}`}>{workout.workoutType}</span>
                          </div>
                          <div className="mt-2 space-y-1">
                            {workout.exercises.map((exercise, index) => (
                              <p
                                key={`preview-exercise-${selectedReadyTemplate.id}-${workout.dayName}-${exercise.exerciseName}-${index}`}
                                className={`text-xs ${textMutedClass}`}
                              >
                                <span className={textPrimaryClass}>{exercise.exerciseName}</span>
                                {' | '}
                                {exercise.sets} sets
                                {' | '}
                                {exercise.reps}
                              </p>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selectedCreatePlanMode === 'ai' && (
                  <div className={`${createPlanCardClass} p-4 rounded-lg space-y-3`}>
                    <h4 className={`font-semibold ${textPrimaryClass}`}>Create with AI</h4>
                    <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                      <p className={textMutedClass}>Age: <span className={textPrimaryClass}>{client.age ?? 'N/A'}</span></p>
                      <p className={textMutedClass}>Weight: <span className={textPrimaryClass}>{formatMetric(measurements.weight, 'kg', 1)}</span></p>
                      <p className={textMutedClass}>Body Fat: <span className={textPrimaryClass}>{formatMetric(measurements.bodyFat, '%', 1)}</span></p>
                      <p className={textMutedClass}>Chest: <span className={textPrimaryClass}>{formatMetric(measurements.chest, 'cm', 1)}</span></p>
                      <p className={textMutedClass}>Waist: <span className={textPrimaryClass}>{formatMetric(measurements.waist, 'cm', 1)}</span></p>
                      <p className={textMutedClass}>Arms: <span className={textPrimaryClass}>{formatMetric(measurements.arms, 'cm', 1)}</span></p>
                      <p className={textMutedClass}>Legs: <span className={textPrimaryClass}>{formatMetric(measurements.legs, 'cm', 1)}</span></p>
                    </div>
                    <label className="text-sm block">
                      <span className={`block mb-1 ${textMutedClass}`}>Coach Prompt</span>
                      <textarea
                        rows={3}
                        value={aiCoachPrompt}
                        onChange={(e) => setAiCoachPrompt(e.target.value)}
                        placeholder="Example: Build an 8-week hypertrophy plan with extra shoulder and glute focus, moderate recovery demand."
                        className={`w-full rounded-lg px-3 py-2 text-sm border outline-none resize-none ${
                          resolvedIsLightTheme
                            ? 'bg-white border-slate-300 text-[#111827]'
                            : 'bg-[#111] border-gray-700 text-white'
                        }`}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => void handleGenerateAiDraft()}
                      disabled={generatingAiDraft || savingCoachPlan}
                      className="px-4 py-2 rounded-lg bg-[#10b981] font-semibold hover:bg-[#0ea574] transition-colors disabled:opacity-60 text-white"
                    >
                      {generatingAiDraft ? 'Generating AI Draft...' : 'Generate AI Draft'}
                    </button>
                    {selectedAiTemplate && (
                      <p className={`text-xs ${textMutedClass}`}>
                        Draft template selected: <span className={textPrimaryClass}>{selectedAiTemplate.title}</span>.
                      </p>
                    )}
                  </div>
                )}

                {selectedCreatePlanMode === 'edit' && (
                  <div className={`${createPlanCardClass} p-4 rounded-lg`}>
                    <p className={`text-sm ${textMutedClass}`}>
                      The user&apos;s active plan is loaded below. Edit any field then save.
                    </p>
                  </div>
                )}

                {coachPlanError && (
                  <div className="text-sm text-red-400">{coachPlanError}</div>
                )}
                {coachPlanSuccess && (
                  <div className="text-sm text-green-500">{coachPlanSuccess}</div>
                )}

                {showEditableBuilder && (
                  <>
                    <div className={`${createPlanCardClass} p-4 rounded-lg`}>
                      <h4 className={`font-semibold mb-3 ${textPrimaryClass}`}>Coach Plan Builder</h4>

                      <div className="grid grid-cols-1 gap-3 mb-3 md:grid-cols-2">
                        <label className="text-sm">
                          <span className={`block mb-1 ${textMutedClass}`}>Plan Name</span>
                          <input
                            type="text"
                            value={coachPlanName}
                            onChange={(e) => setCoachPlanName(e.target.value)}
                            className={`w-full rounded-lg px-3 py-2 text-sm border outline-none ${
                              resolvedIsLightTheme
                                ? 'bg-white border-slate-300 text-[#111827]'
                                : 'bg-[#111] border-gray-700 text-white'
                            }`}
                          />
                        </label>
                        <label className="text-sm">
                          <span className={`block mb-1 ${textMutedClass}`}>Cycle Weeks</span>
                          <select
                            value={coachCycleWeeks}
                            onChange={(e) => setCoachCycleWeeks(Number(e.target.value))}
                            className={`w-full rounded-lg px-3 py-2 text-sm border outline-none ${
                              resolvedIsLightTheme
                                ? 'bg-white border-slate-300 text-[#111827]'
                                : 'bg-[#111] border-gray-700 text-white'
                            }`}
                          >
                            {[8, 9, 10, 11, 12, 13, 14, 15, 16].map((weeks) => (
                              <option key={weeks} value={weeks}>{weeks} weeks</option>
                            ))}
                          </select>
                        </label>
                      </div>

                      <label className="text-sm block mb-3">
                        <span className={`block mb-1 ${textMutedClass}`}>Description</span>
                        <textarea
                          rows={2}
                          value={coachPlanDescription}
                          onChange={(e) => setCoachPlanDescription(e.target.value)}
                          className={`w-full rounded-lg px-3 py-2 text-sm border outline-none resize-none ${
                            resolvedIsLightTheme
                              ? 'bg-white border-slate-300 text-[#111827]'
                              : 'bg-[#111] border-gray-700 text-white'
                          }`}
                        />
                      </label>

                      <div className="mb-3">
                        <div className={`text-sm mb-2 ${textMutedClass}`}>Training Days</div>
                        <div className="flex flex-wrap gap-2">
                          {DAY_OPTIONS.map((day) => {
                            const selected = coachSelectedDays.includes(day.key);
                            return (
                              <button
                                key={day.key}
                                type="button"
                                onClick={() => toggleCoachDay(day.key)}
                                className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${
                                  selected
                                    ? 'border-[#10b981] text-black bg-[#10b981]/10'
                                    : resolvedIsLightTheme
                                      ? 'border-slate-300 text-slate-600 bg-white'
                                      : 'border-gray-700 text-gray-400 bg-[#111]'
                                }`}
                              >
                                {day.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {coachSelectedDays.map((dayKey, dayIndex) => {
                      const dayLabel = DAY_OPTIONS.find((day) => day.key === dayKey)?.label || dayKey;
                      const dayPlan = ensureDayPlan(dayKey);
                      return (
                        <div key={dayKey} className={`${createPlanCardClass} p-4 rounded-lg`}>
                          <div className="flex flex-col gap-3 mb-3 sm:flex-row sm:items-center sm:justify-between">
                            <h5 className={`font-semibold ${textPrimaryClass}`}>{dayLabel}</h5>
                            <button
                              type="button"
                              onClick={() => addDayExercise(dayKey)}
                              className="px-4 py-2 rounded-lg bg-[#10b981] font-semibold hover:bg-[#a8e600] transition-colors disabled:opacity-50 text-white"
                            >
                              + Exercise
                            </button>
                          </div>

                          <label className="text-sm block mb-3">
                            <span className={`block mb-1 ${textMutedClass}`}>Workout Name</span>
                            <input
                              type="text"
                              value={dayPlan.workoutName}
                              onChange={(e) => updateWorkoutName(dayKey, e.target.value)}
                              className={`w-full rounded-lg px-3 py-2 text-sm border outline-none ${
                                resolvedIsLightTheme
                                  ? 'bg-white border-slate-300 text-[#111827]'
                                  : 'bg-[#111] border-gray-700 text-white'
                              }`}
                              placeholder={`Workout ${dayIndex + 1}`}
                            />
                          </label>

                          <div className="space-y-2">
                            {dayPlan.exercises.map((exercise, index) => (
                              <div key={`${dayKey}-${index}`} className={`rounded-lg p-3 border ${
                                resolvedIsLightTheme ? 'border-slate-200 bg-white' : 'border-gray-700 bg-[#111]'
                              }`}>
                                <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                                  <input
                                    type="text"
                                    value={exercise.exerciseName}
                                    onChange={(e) => updateDayExercise(dayKey, index, { exerciseName: e.target.value })}
                                    placeholder="Exercise name"
                                    className={`rounded-lg px-3 py-2 text-sm border outline-none md:col-span-3 ${
                                      resolvedIsLightTheme
                                        ? 'bg-white border-slate-300 text-[#111827]'
                                        : 'bg-[#0d0d0d] border-gray-700 text-white'
                                    }`}
                                  />
                                  <input
                                    type="number"
                                    min={1}
                                    max={10}
                                    value={exercise.sets}
                                    onChange={(e) => updateDayExercise(dayKey, index, { sets: Number(e.target.value || 3) })}
                                    placeholder="Sets"
                                    className={`rounded-lg px-3 py-2 text-sm border outline-none ${
                                      resolvedIsLightTheme
                                        ? 'bg-white border-slate-300 text-[#111827]'
                                        : 'bg-[#0d0d0d] border-gray-700 text-white'
                                    }`}
                                  />
                                  <input
                                    type="text"
                                    value={exercise.reps}
                                    onChange={(e) => updateDayExercise(dayKey, index, { reps: e.target.value })}
                                    placeholder="Reps (e.g. 8-12)"
                                    className={`rounded-lg px-3 py-2 text-sm border outline-none ${
                                      resolvedIsLightTheme
                                        ? 'bg-white border-slate-300 text-[#111827]'
                                        : 'bg-[#0d0d0d] border-gray-700 text-white'
                                    }`}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => removeDayExercise(dayKey, index)}
                                    className="rounded-lg px-3 py-2 text-xs border border-red-500/40 text-red-400 hover:bg-red-500/10"
                                  >
                                    Remove
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}

                    <button
                      type="button"
                      onClick={() => void handleSaveCoachPlan()}
                      disabled={savingCoachPlan}
                      className={`px-4 py-2 rounded-lg bg-[#10b981] font-semibold hover:bg-[#a8e600] transition-colors disabled:opacity-50 ${
                        resolvedIsLightTheme ? 'text-white' : 'text-black'
                      }`}
                    >
                      {savingCoachPlan ? 'Saving...' : 'Save Plan For User'}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

