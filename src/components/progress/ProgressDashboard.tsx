import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { StrengthChart } from './StrengthChart';
import { Card } from '../ui/Card';
import { Activity, CalendarDays, ChevronDown, ChevronRight, CircleQuestionMark, Dumbbell, PlayCircle, Target, X } from 'lucide-react';
import { api } from '../../services/api';
import { AppLanguage, getActiveLanguage, getStoredLanguage } from '../../services/language';
import { offlineCacheKeys, readOfflineCacheValue } from '../../services/offlineCache';
import {
  aggregateTrainingVolume,
  formatTrainingVolume,
  type VolumeRange,
  type VolumeWorkoutSummary,
} from '../../lib/training-volume';
interface ProgressDashboardProps {
  onViewReport: () => void;
  onViewTrainingVolume: () => void;
  onViewMuscleReport: () => void;
  onStartWorkout: () => void;
}

const readStoredStyleGender = () => {
  try {
    return String(localStorage.getItem('appStyleGender') || '').trim().toLowerCase();
  } catch {
    return '';
  }
};

const isGirlsStyleValue = (value: unknown) => {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === 'woman' || normalized === 'female' || normalized === 'f' || normalized === 'girls' || normalized === 'femme';
};

interface MuscleDistributionItem {
  name: string;
  val: number;
}

const toTitleCase = (value: unknown) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const parseTargetMuscles = (raw: unknown): string[] => {
  if (Array.isArray(raw)) {
    return raw.map((entry) => toTitleCase(entry)).filter(Boolean);
  }

  if (typeof raw !== 'string' || !raw.trim()) return [];

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map((entry) => toTitleCase(entry)).filter(Boolean);
    }
  } catch {
    return raw
      .split(/[,;|]+/)
      .map((entry) => toTitleCase(entry))
      .filter(Boolean);
  }

  return [];
};

const inferMusclesFromExerciseName = (exerciseName: unknown) => {
  const name = String(exerciseName || '').toLowerCase();
  const matches: string[] = [];

  if (/bench|chest|fly|push-up|push up/.test(name)) matches.push('Chest', 'Triceps', 'Shoulders');
  if (/deadlift|row|pull-up|pull up|lat|pulldown|pullover/.test(name)) matches.push('Back', 'Biceps', 'Forearms');
  if (/squat|leg press|lunge|split squat|step up/.test(name)) matches.push('Quadriceps', 'Hamstrings', 'Calves');
  if (/romanian deadlift|rdl|leg curl|hamstring/.test(name)) matches.push('Hamstrings');
  if (/lateral raise|rear delt|face pull|front raise/.test(name)) matches.push('Shoulders');
  if (/shoulder|overhead press|arnold press|seated shoulder press|machine shoulder press/.test(name)) matches.push('Shoulders', 'Triceps');
  if (/curl/.test(name)) matches.push('Biceps', 'Forearms');
  if (/tricep|triceps|dip/.test(name)) matches.push('Triceps');
  if (/calf/.test(name)) matches.push('Calves');
  if (/abs|core|crunch|plank|sit-up|sit up/.test(name)) matches.push('Abs');

  return [...new Set(matches.map((entry) => toTitleCase(entry)).filter(Boolean))];
};

const normalizeDistributionItems = (items: Array<{ muscle?: unknown; percent?: unknown }>) =>
  items
    .slice(0, 3)
    .map((item) => ({
      name: String(item?.muscle || '-'),
      val: Math.max(0, Math.min(100, Number(item?.percent || 0))),
    }));

const buildProgramDistribution = (programData: any): MuscleDistributionItem[] => {
  const weeklyWorkouts = Array.isArray(programData?.currentWeekWorkouts)
    ? programData.currentWeekWorkouts
    : Array.isArray(programData?.workouts)
      ? programData.workouts
      : [];
  const fallbackWorkouts = programData?.todayWorkout ? [programData.todayWorkout] : [];
  const workouts = weeklyWorkouts.length ? weeklyWorkouts : fallbackWorkouts;
  const byMuscle = new Map<string, number>();

  workouts.forEach((workout: any) => {
    const exercises = Array.isArray(workout?.exercises)
      ? workout.exercises
      : typeof workout?.exercises === 'string'
        ? (() => {
            try {
              const parsed = JSON.parse(workout.exercises);
              return Array.isArray(parsed) ? parsed : [];
            } catch {
              return [];
            }
          })()
        : [];

    exercises.forEach((exercise: any) => {
      const plannedSets = Math.max(
        1,
        Number(
          exercise?.sets
          ?? exercise?.targetSets
          ?? exercise?.target_sets
          ?? 1,
        ) || 1,
      );

      const muscles = [
        ...parseTargetMuscles(exercise?.targetMuscles ?? exercise?.muscleTargets ?? exercise?.muscles),
        toTitleCase(exercise?.muscleGroup || exercise?.muscle_group || exercise?.muscle || exercise?.bodyPart || ''),
      ].filter(Boolean);

      const resolvedMuscles = muscles.length
        ? [...new Set(muscles)]
        : inferMusclesFromExerciseName(exercise?.exerciseName || exercise?.exercise_name || exercise?.name || '');

      if (!resolvedMuscles.length) return;

      const share = plannedSets / resolvedMuscles.length;
      resolvedMuscles.forEach((muscle) => {
        byMuscle.set(muscle, Number(byMuscle.get(muscle) || 0) + share);
      });
    });
  });

  const total = Array.from(byMuscle.values()).reduce((sum, value) => sum + Number(value || 0), 0);
  if (total <= 0) return [];

  return Array.from(byMuscle.entries())
    .map(([muscle, value]) => ({
      muscle,
      percent: (Number(value) / total) * 100,
    }))
    .sort((left, right) => Number(right.percent) - Number(left.percent))
    .slice(0, 3)
    .map((item) => ({
      name: String(item.muscle || '-'),
      val: Math.max(0, Math.min(100, Number(item.percent || 0))),
    }));
};

const inferPlannedWorkoutsThisWeek = (progress: any, programData: any) => {
  const normalizeWorkouts = (raw: unknown) => {
    if (Array.isArray(raw)) return raw;
    if (typeof raw !== 'string' || !raw.trim()) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const programWorkouts = Array.isArray(programData?.currentWeekWorkouts)
    ? programData.currentWeekWorkouts
    : Array.isArray(programData?.workouts)
      ? programData.workouts
      : [];
  const normalizedProgramWorkouts = normalizeWorkouts(programWorkouts);
  if (normalizedProgramWorkouts.length > 0) {
    return normalizedProgramWorkouts.length;
  }

  const progressWorkouts = Array.isArray(progress?.program?.currentWeekWorkouts)
    ? progress.program.currentWeekWorkouts
    : [];
  if (progressWorkouts.length > 0) {
    return progressWorkouts.length;
  }

  const selectedDays = Array.isArray(programData?.selectedDays)
    ? programData.selectedDays.filter(Boolean)
    : [];
  if (selectedDays.length > 0) {
    return selectedDays.length;
  }

  const programDaysPerWeek = Number(
    programData?.daysPerWeek
    ?? progress?.program?.daysPerWeek
    ?? 0,
  );
  if (programDaysPerWeek > 0) {
    return Math.round(programDaysPerWeek);
  }

  return Math.max(0, Number(progress?.summary?.workoutsPlannedThisWeek || 0));
};

const RANGE_ITEMS: Array<{ key: VolumeRange; label: string; weeks: number }> = [
  { key: '4w', label: '4 weeks', weeks: 4 },
  { key: '8w', label: '8 weeks', weeks: 8 },
  { key: 'all', label: 'All time', weeks: 52 },
];

const PROGRESS_DASHBOARD_I18N = {
  en: {
    title: 'Your Progress',
    strengthScoreInfo: 'Strength score info',
    totalVolume: 'Total Volume',
    classification: 'Classification',
    viewLeaderboard: 'View leaderboard',
    muscleDistribution: 'Muscle Distribution (Plan Target)',
    noPlanDistribution: 'No plan distribution is available yet for this user.',
    viewBiWeeklyReport: 'View Bi-Weekly Report',
    progressDialogTitle: "What's on this page",
    close: 'Close',
    infoLine1: 'Your weekly strength trend (estimated 1RM).',
    infoLine2: 'Your weekly consistency percentage and completed days.',
    infoLine3: 'Your total lifted volume.',
    infoLine4: 'Your top target muscles for the current plan.',
    infoLine5: 'Next overload recommendations and quick report access.',
    fireAlt: 'Fire',
    progressDialogAria: 'Progress page info dialog',
  },
  ar: {
    title: 'تقدمك',
    strengthScoreInfo: 'معلومات درجة القوة',
    totalVolume: 'الحجم الكلي',
    classification: 'التصنيف',
    viewLeaderboard: 'عرض لوحة الصدارة',
    muscleDistribution: 'توزيع العضلات (هدف الخطة)',
    noPlanDistribution: 'لا يتوفر توزيع للخطة لهذا المستخدم حتى الآن.',
    viewBiWeeklyReport: 'عرض التقرير نصف الأسبوعي',
    progressDialogTitle: 'ما الذي ستجده في هذه الصفحة',
    close: 'إغلاق',
    infoLine1: 'اتجاه قوتك الأسبوعي (تقدير 1RM).',
    infoLine2: 'نسبة التزامك أسبوعيًا وعدد الأيام المكتملة.',
    infoLine3: 'إجمالي حجم الأوزان التي رفعتها.',
    infoLine4: 'أكثر العضلات استهدافًا في خطتك الحالية.',
    infoLine5: 'توصيات التحميل التدريجي القادمة مع وصول سريع للتقرير.',
    fireAlt: 'نار',
    progressDialogAria: 'نافذة معلومات صفحة التقدم',
  },
  it: {
    title: 'I Tuoi Progressi',
    strengthScoreInfo: 'Info punteggio forza',
    totalVolume: 'Volume Totale',
    classification: 'Classifica',
    viewLeaderboard: 'Apri leaderboard',
    muscleDistribution: 'Distribuzione Muscolare (Target del Piano)',
    noPlanDistribution: 'Nessuna distribuzione del piano disponibile per questo utente.',
    viewBiWeeklyReport: 'Visualizza Report Bisettimanale',
    progressDialogTitle: 'Cosa trovi in questa pagina',
    close: 'Chiudi',
    infoLine1: 'Il tuo trend settimanale della forza (1RM stimato).',
    infoLine2: 'La tua percentuale settimanale di costanza e i giorni completati.',
    infoLine3: 'Il volume totale sollevato.',
    infoLine4: 'I principali muscoli target del piano attuale.',
    infoLine5: 'Prossimi consigli di overload e accesso rapido al report.',
    fireAlt: 'Fuoco',
    progressDialogAria: 'Finestra info pagina progressi',
  },
  fr: {
    title: 'Tes Progres',
    strengthScoreInfo: 'Infos score de force',
    totalVolume: 'Volume Total',
    classification: 'Classement',
    viewLeaderboard: 'Voir le classement',
    muscleDistribution: 'Repartition Musculaire (Cible du Plan)',
    noPlanDistribution: 'Aucune repartition du plan n est encore disponible pour cet utilisateur.',
    viewBiWeeklyReport: 'Voir le Rapport Bi-Hebdomadaire',
    progressDialogTitle: 'Ce que montre cette page',
    close: 'Fermer',
    infoLine1: 'Ta tendance de force hebdomadaire (1RM estime).',
    infoLine2: 'Ton pourcentage de regularite hebdomadaire et les jours completes.',
    infoLine3: 'Ton volume total souleve.',
    infoLine4: 'Tes principaux muscles cibles dans le plan actuel.',
    infoLine5: 'Les prochaines recommandations de surcharge et un acces rapide au rapport.',
    fireAlt: 'Feu',
    progressDialogAria: 'Fenetre d information de la page progres',
  },
  de: {
    title: 'Dein Fortschritt',
    strengthScoreInfo: 'Infos zum Kraftwert',
    totalVolume: 'Gesamtvolumen',
    classification: 'Platzierung',
    viewLeaderboard: 'Bestenliste anzeigen',
    muscleDistribution: 'Muskelverteilung (Plan-Ziel)',
    noPlanDistribution: 'Fuer diesen Nutzer ist noch keine Planverteilung verfuegbar.',
    viewBiWeeklyReport: 'Zweiwochenbericht Anzeigen',
    progressDialogTitle: 'Was auf dieser Seite ist',
    close: 'Schliessen',
    infoLine1: 'Dein woechentlicher Krafttrend (geschaetztes 1RM).',
    infoLine2: 'Deine woechentliche Konstanz in Prozent und abgeschlossene Tage.',
    infoLine3: 'Dein gesamtes bewegtes Volumen.',
    infoLine4: 'Deine wichtigsten Zielmuskeln im aktuellen Plan.',
    infoLine5: 'Naechste Overload-Empfehlungen und schneller Berichtszugang.',
    fireAlt: 'Feuer',
    progressDialogAria: 'Info-Dialog Fortschrittsseite',
  },
} as const;

const ARABIC_MUSCLE_NAME_MAP: Record<string, string> = {
  Abs: 'البطن',
  Triceps: 'الترايسبس',
  Biceps: 'البايسبس',
  Chest: 'الصدر',
  Back: 'الظهر',
  Shoulders: 'الأكتاف',
  Quadriceps: 'الرباعية',
  Hamstrings: 'الخلفية',
  Calves: 'السمانة',
  Forearms: 'الساعد',
};

const ITALIAN_MUSCLE_NAME_MAP: Record<string, string> = {
  Abs: 'Addome',
  Triceps: 'Tricipiti',
  Biceps: 'Bicipiti',
  Chest: 'Petto',
  Back: 'Schiena',
  Shoulders: 'Spalle',
  Quadriceps: 'Quadricipiti',
  Hamstrings: 'Femorali',
  Calves: 'Polpacci',
  Forearms: 'Avambracci',
};

const GERMAN_MUSCLE_NAME_MAP: Record<string, string> = {
  Abs: 'Bauch',
  Triceps: 'Trizeps',
  Biceps: 'Bizeps',
  Chest: 'Brust',
  Back: 'Ruecken',
  Shoulders: 'Schultern',
  Quadriceps: 'Quadrizeps',
  Hamstrings: 'Beinbeuger',
  Calves: 'Waden',
  Forearms: 'Unterarme',
};

const FRENCH_MUSCLE_NAME_MAP: Record<string, string> = {
  Abs: 'Abdos',
  Triceps: 'Triceps',
  Biceps: 'Biceps',
  Chest: 'Poitrine',
  Back: 'Dos',
  Shoulders: 'Epaules',
  Quadriceps: 'Quadriceps',
  Hamstrings: 'Ischio-jambiers',
  Calves: 'Mollets',
  Forearms: 'Avant-bras',
};

const getLocalizedMuscleName = (name: string, language: AppLanguage) => {
  if (language === 'ar') return ARABIC_MUSCLE_NAME_MAP[name] || name;
  if (language === 'it') return ITALIAN_MUSCLE_NAME_MAP[name] || name;
  if (language === 'fr') return FRENCH_MUSCLE_NAME_MAP[name] || name;
  if (language === 'de') return GERMAN_MUSCLE_NAME_MAP[name] || name;
  return name;
};

export function ProgressDashboard({ onViewReport, onViewTrainingVolume, onViewMuscleReport, onStartWorkout }: ProgressDashboardProps) {
  const [range, setRange] = useState<VolumeRange>('4w');
  const [stats, setStats] = useState({
    totalWorkouts: 0,
    totalVolumeKg: 0,
    consistency: 0,
    currentStreak: 0,
    workoutsCompletedThisWeek: 0,
    workoutsPlannedThisWeek: 0,
    workoutsMissedThisWeek: 0,
    workoutsRemainingThisWeek: 0,
  });
  const [muscleDistribution, setMuscleDistribution] = useState<MuscleDistributionItem[]>([]);
  const [workoutSummaries, setWorkoutSummaries] = useState<VolumeWorkoutSummary[]>([]);
  const [strengthSummary, setStrengthSummary] = useState<{
    currentAvgE1RM: number | null;
    baselineAvgE1RM: number | null;
    percentChange: number | null;
    pointCount: number;
  }>({
    currentAvgE1RM: null,
    baselineAvgE1RM: null,
    percentChange: null,
    pointCount: 0,
  });
  const [overloadRecommendation, setOverloadRecommendation] = useState<string | null>(null);
  const [showPageInfo, setShowPageInfo] = useState(false);
  const [language, setLanguage] = useState<AppLanguage>('en');
  const [styleGender, setStyleGender] = useState(() => readStoredStyleGender());
  const [isMetricMenuOpen, setIsMetricMenuOpen] = useState(false);
  const metricMenuRef = useRef<HTMLDivElement | null>(null);
  const copy = PROGRESS_DASHBOARD_I18N[language as keyof typeof PROGRESS_DASHBOARD_I18N] || PROGRESS_DASHBOARD_I18N.en;
  const isGirlsTheme = isGirlsStyleValue(styleGender);

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
    const handleThemeChanged = () => setStyleGender(readStoredStyleGender());
    window.addEventListener('repset:app-style-gender-changed', handleThemeChanged);
    window.addEventListener('repset:stored-user-changed', handleThemeChanged);
    window.addEventListener('storage', handleThemeChanged);
    return () => {
      window.removeEventListener('repset:app-style-gender-changed', handleThemeChanged);
      window.removeEventListener('repset:stored-user-changed', handleThemeChanged);
      window.removeEventListener('storage', handleThemeChanged);
    };
  }, []);

  useEffect(() => {
    if (!isMetricMenuOpen) return undefined;

    const handlePointerDown = (event: PointerEvent) => {
      if (metricMenuRef.current && !metricMenuRef.current.contains(event.target as Node)) {
        setIsMetricMenuOpen(false);
      }
    };

    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, [isMetricMenuOpen]);

  const getUserId = () => {
    const localUserId = Number(localStorage.getItem('appUserId') || localStorage.getItem('userId') || 0);
    let parsedUserId = 0;
    try {
      const user = JSON.parse(localStorage.getItem('appUser') || localStorage.getItem('user') || '{}');
      parsedUserId = Number(user?.id || 0);
    } catch {
      parsedUserId = 0;
    }
    return localUserId || parsedUserId;
  };

  const loadStats = useCallback(async () => {
    const userId = getUserId();
    if (!userId) {
      setStats({
        totalWorkouts: 0,
        totalVolumeKg: 0,
        consistency: 0,
        currentStreak: 0,
        workoutsCompletedThisWeek: 0,
        workoutsPlannedThisWeek: 0,
        workoutsMissedThisWeek: 0,
        workoutsRemainingThisWeek: 0,
      });
      setMuscleDistribution([]);
      setWorkoutSummaries([]);
      return;
    }

    const applySnapshot = (progress: any, programData: any, planDistributionData?: any, historyDistributionData?: any) => {
      const weeklyRate = Number(progress?.summary?.weeklyCompletionRate || 0);
      const workoutsPlannedThisWeek = inferPlannedWorkoutsThisWeek(progress, programData);
      const workoutsCompletedThisWeek = Number(progress?.summary?.workoutsCompletedThisWeek || 0);
      const workoutsMissedThisWeek = Number(progress?.summary?.workoutsMissedThisWeek || 0);
      const volumeLoadAllTime = Number(
        progress?.summary?.volumeLoadAllTime
        ?? progress?.summary?.volumeLoadSinceStart
        ?? progress?.summary?.volumeLoadLast30Days
        ?? 0,
      );

      setStats({
        totalWorkouts: Number(progress?.summary?.completedWorkouts || 0),
        totalVolumeKg: volumeLoadAllTime,
        consistency: Math.max(0, Math.min(100, weeklyRate)),
        currentStreak: Number(progress?.summary?.workoutStreakDays || 0),
        workoutsCompletedThisWeek,
        workoutsPlannedThisWeek,
        workoutsMissedThisWeek,
        workoutsRemainingThisWeek: Math.max(0, workoutsPlannedThisWeek - workoutsCompletedThisWeek - workoutsMissedThisWeek),
      });
      const topPlanDistribution = Array.isArray(planDistributionData?.distribution)
        ? planDistributionData.distribution.slice(0, 3)
        : [];
      if (topPlanDistribution.length > 0) {
        setMuscleDistribution(normalizeDistributionItems(topPlanDistribution));
        return;
      }

      const programFallback = buildProgramDistribution(programData);
      if (programFallback.length > 0) {
        setMuscleDistribution(programFallback);
        return;
      }

      const topHistoryDistribution = Array.isArray(historyDistributionData?.distribution)
        ? historyDistributionData.distribution.slice(0, 3)
        : [];
      if (topHistoryDistribution.length > 0) {
        setMuscleDistribution(normalizeDistributionItems(topHistoryDistribution));
        return;
      }

      setMuscleDistribution([]);
    };

    const cachedProgress = readOfflineCacheValue<any>(offlineCacheKeys.programProgress(userId));
    const cachedProgramData = readOfflineCacheValue<any>(offlineCacheKeys.userProgram(userId));
    const cachedPlanDistribution = readOfflineCacheValue<any>(offlineCacheKeys.planMuscleDistribution(userId));
    const cachedHistoryDistribution = readOfflineCacheValue<any>(offlineCacheKeys.muscleDistribution(userId, 30));
    if (cachedProgress || cachedProgramData || cachedPlanDistribution || cachedHistoryDistribution) {
      applySnapshot(
        cachedProgress || {},
        cachedProgramData || null,
        cachedPlanDistribution,
        cachedHistoryDistribution,
      );
    }
    let consistency = 0;
    let currentStreak = 0;
    let totalVolumeKg = 0;
    let totalWorkouts = 0;
    let workoutsCompletedThisWeek = 0;
    let workoutsPlannedThisWeek = 0;
    let workoutsMissedThisWeek = 0;
    let workoutsRemainingThisWeek = 0;
    let activeProgramData: any = null;

    try {
      const progress = await api.getProgramProgress(userId);
      try {
        activeProgramData = await api.getUserProgram(userId);
      } catch (programError) {
        console.error('Failed to fetch active program for weekly plan stats:', programError);
      }
      const weeklyRate = Number(progress?.summary?.weeklyCompletionRate || 0);
      consistency = Math.max(0, Math.min(100, weeklyRate));
      currentStreak = Number(progress?.summary?.workoutStreakDays || 0);
      totalWorkouts = Number(progress?.summary?.completedWorkouts || 0);
      workoutsCompletedThisWeek = Number(progress?.summary?.workoutsCompletedThisWeek || 0);
      workoutsPlannedThisWeek = inferPlannedWorkoutsThisWeek(progress, activeProgramData);
      workoutsMissedThisWeek = Number(progress?.summary?.workoutsMissedThisWeek || 0);
      workoutsRemainingThisWeek = Math.max(0, workoutsPlannedThisWeek - workoutsCompletedThisWeek - workoutsMissedThisWeek);
      const volumeLoadAllTime = Number(
        progress?.summary?.volumeLoadAllTime
        ?? progress?.summary?.volumeLoadSinceStart
        ?? progress?.summary?.volumeLoadLast30Days
        ?? 0,
      );
      totalVolumeKg = volumeLoadAllTime;
    } catch (error) {
      console.error('Failed to fetch program progress for consistency:', error);
    }

    try {
      const response = await api.getPlanMuscleDistribution(userId);
      const top = Array.isArray(response?.distribution) ? response.distribution.slice(0, 3) : [];
      if (top.length > 0) {
        setMuscleDistribution(normalizeDistributionItems(top));
      } else {
        const programData = activeProgramData || await api.getUserProgram(userId);
        const programFallback = buildProgramDistribution(programData);
        if (programFallback.length > 0) {
          setMuscleDistribution(programFallback);
          return;
        }

        const fallbackResponse = await api.getMuscleDistribution(userId, 30);
        const fallbackTop = Array.isArray(fallbackResponse?.distribution) ? fallbackResponse.distribution.slice(0, 3) : [];
        if (fallbackTop.length > 0) {
          setMuscleDistribution(normalizeDistributionItems(fallbackTop));
        } else {
          setMuscleDistribution([]);
        }
      }
    } catch (error) {
      console.error('Failed to fetch muscle distribution:', error);
      setMuscleDistribution([]);
    }

    setStats({
      totalWorkouts,
      totalVolumeKg,
      consistency,
      currentStreak,
      workoutsCompletedThisWeek,
      workoutsPlannedThisWeek,
      workoutsMissedThisWeek,
      workoutsRemainingThisWeek,
    });

    try {
      const summariesResponse = await api.getWorkoutDaySummaries(userId, 365);
      setWorkoutSummaries(Array.isArray(summariesResponse?.summaries) ? summariesResponse.summaries : []);
    } catch (error) {
      console.error('Failed to fetch workout summaries for progress overview:', error);
      setWorkoutSummaries([]);
    }

    try {
      const selectedRange = RANGE_ITEMS.find((item) => item.key === range) || RANGE_ITEMS[0];
      const strength = await api.getStrengthProgress(userId, selectedRange.weeks);
      const weeks = Array.isArray(strength?.weeks) ? strength.weeks : [];
      setStrengthSummary({
        currentAvgE1RM: strength?.summary?.currentAvgE1RM ?? null,
        baselineAvgE1RM: strength?.summary?.baselineAvgE1RM ?? null,
        percentChange: weeks.length >= 2 ? Number(strength?.summary?.percentChange || 0) : null,
        pointCount: weeks.length,
      });
    } catch (error) {
      console.error('Failed to fetch strength summary for progress overview:', error);
      setStrengthSummary({ currentAvgE1RM: null, baselineAvgE1RM: null, percentChange: null, pointCount: 0 });
    }

    try {
      const overload = await api.getOverloadPlan(userId);
      const list = Array.isArray(overload?.recommendations) ? overload.recommendations : [];
      const first = list[0];
      setOverloadRecommendation(first ? `${first.name}: ${first.current} -> ${first.next}` : null);
    } catch (error) {
      console.error('Failed to fetch compact overload recommendation:', error);
      setOverloadRecommendation(null);
    }
  }, [range]);

  useEffect(() => {
    void loadStats();

    const handleProgressRefresh = () => {
      void loadStats();
    };

    window.addEventListener('gamification-updated', handleProgressRefresh);
    window.addEventListener('recovery-updated', handleProgressRefresh);
    window.addEventListener('program-updated', handleProgressRefresh);
    const intervalId = window.setInterval(() => {
      void loadStats();
    }, 30000);

    return () => {
      window.removeEventListener('gamification-updated', handleProgressRefresh);
      window.removeEventListener('recovery-updated', handleProgressRefresh);
      window.removeEventListener('program-updated', handleProgressRefresh);
      window.clearInterval(intervalId);
    };
  }, [loadStats]);

  const selectedRange = RANGE_ITEMS.find((item) => item.key === range) || RANGE_ITEMS[0];
  const volumeAggregation = useMemo(
    () => aggregateTrainingVolume(workoutSummaries, range),
    [range, workoutSummaries],
  );
  const totalVolumeKg = volumeAggregation.totalVolumeKg || stats.totalVolumeKg;
  const strengthChangeText = strengthSummary.pointCount < 2 || strengthSummary.percentChange == null
    ? '-'
    : `${strengthSummary.percentChange >= 0 ? '+' : ''}${Math.round(strengthSummary.percentChange * 10) / 10}%`;
  const currentStrengthText = strengthSummary.currentAvgE1RM && strengthSummary.currentAvgE1RM > 0
    ? `${Math.round(strengthSummary.currentAvgE1RM)} kg`
    : '-';
  const baselineStrengthText = strengthSummary.baselineAvgE1RM && strengthSummary.baselineAvgE1RM > 0
    ? `${Math.round(strengthSummary.baselineAvgE1RM)} kg`
    : '-';
  const muscleMax = Math.max(...muscleDistribution.map((item) => item.val), 1);

  const primaryTextClassName = isGirlsTheme ? 'text-[#4A4A4A]' : 'text-white';
  const secondaryTextClassName = isGirlsTheme ? 'text-[#795E67]' : 'text-text-secondary';
  const tertiaryTextClassName = isGirlsTheme ? 'text-[#A87884]' : 'text-text-tertiary';
  const girlsSurfaceClassName =
    'border-[#E2B4BD]/50 !bg-[linear-gradient(135deg,rgba(255,255,255,0.84),rgba(255,245,245,0.70)_48%,rgba(207,236,243,0.34))] shadow-[0_18px_42px_rgba(226,180,189,0.18)] ring-1 ring-white/45';
  const cardClassName = isGirlsTheme
    ? 'border border-[#E2B4BD]/45 bg-[linear-gradient(145deg,rgba(255,255,255,0.82),rgba(255,245,245,0.66))] shadow-[0_12px_28px_rgba(226,180,189,0.14)] ring-1 ring-white/40'
    : 'border border-white/10 bg-[#14202E]';
  const accentTextClassName = isGirlsTheme ? 'text-[#A87884]' : 'text-accent';
  const accentButtonClassName = isGirlsTheme ? 'bg-[linear-gradient(135deg,#F9B2D7,#E2B4BD)] text-[#4A4A4A] shadow-[0_14px_30px_rgba(249,178,215,0.30)]' : 'bg-accent text-black';
  const progressTrackClassName = isGirlsTheme ? 'bg-[#E2B4BD]/28' : 'bg-white/10';
  const progressFillClassName = isGirlsTheme ? 'bg-[linear-gradient(90deg,#F9B2D7,#CFECF3)]' : 'bg-accent';

  return (
    <div data-coachmark-target="progress_dashboard" className={`progress-dashboard space-y-6 ${isGirlsTheme ? 'progress-dashboard--girls text-[#4A4A4A]' : ''}`}>
      <div className="flex items-center justify-between">
        <h1 className={`text-2xl font-bold ${primaryTextClassName}`}>Progress</h1>
        <button
          type="button"
          data-coachmark-target="progress_info_button"
          className={`flex h-9 w-9 items-center justify-center rounded-full border transition-colors ${isGirlsTheme ? 'border-[#E2B4BD]/45 bg-white/70 text-[#795E67] hover:border-[#F9B2D7]/70 hover:text-[#4A4A4A]' : 'border-white/10 bg-card/70 text-text-secondary hover:border-accent/30 hover:text-text-primary'}`}
          aria-label={copy.strengthScoreInfo}
          onClick={() => setShowPageInfo(true)}
        >
          <CircleQuestionMark size={16} />
        </button>
      </div>

      <div className={`grid grid-cols-3 rounded-2xl border p-1 ${isGirlsTheme ? 'border-[#E2B4BD]/45 bg-white/70 shadow-[0_10px_24px_rgba(226,180,189,0.12)] ring-1 ring-white/35' : 'border-white/10 bg-[#101824]'}`}>
        {RANGE_ITEMS.map((item) => (
          <button
            key={item.key}
            type="button"
            aria-pressed={range === item.key}
            onClick={() => setRange(item.key)}
            className={`min-h-11 rounded-xl px-2 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 ${
              isGirlsTheme
                ? range === item.key ? 'bg-[linear-gradient(135deg,#F9B2D7,#E2B4BD)] text-[#4A4A4A] shadow-[0_8px_18px_rgba(249,178,215,0.24)] focus-visible:outline-[#F9B2D7]' : 'text-[#795E67] hover:text-[#4A4A4A] focus-visible:outline-[#F9B2D7]'
                : range === item.key ? 'bg-accent text-black' : 'text-text-secondary hover:text-white'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <Card coachmarkTargetId="progress_consistency_card" className={isGirlsTheme ? `p-4 !${girlsSurfaceClassName}` : 'p-4'}>
        <h2 className={`mb-3 text-sm font-semibold uppercase tracking-[0.16em] ${secondaryTextClassName}`}>Your overview</h2>
        <div className="grid grid-cols-3 gap-2">
          <div className={`rounded-2xl p-3 ${isGirlsTheme ? 'border border-[#E2B4BD]/45 bg-[#FFF5F5]/80 shadow-[0_10px_22px_rgba(226,180,189,0.12)] ring-1 ring-white/45' : cardClassName}`}>
            <Activity size={18} className={`mb-2 ${accentTextClassName}`} aria-hidden="true" />
            <div className={`text-[11px] ${secondaryTextClassName}`}>Estimated 1RM</div>
            <div className={`mt-1 text-lg font-bold ${primaryTextClassName}`}>{currentStrengthText}</div>
          </div>
          <button
            type="button"
            data-coachmark-target="progress_total_volume_card"
            onClick={onViewTrainingVolume}
            className={`rounded-2xl border p-3 text-left transition-colors focus-visible:outline focus-visible:outline-2 ${isGirlsTheme ? 'border-[#CFECF3]/70 bg-[linear-gradient(145deg,rgba(207,236,243,0.72),rgba(255,255,255,0.72))] shadow-[0_10px_22px_rgba(207,236,243,0.20)] hover:border-[#F9B2D7]/65 hover:bg-[#CFECF3]/80 focus-visible:outline-[#F9B2D7]' : 'border-accent/30 bg-accent/10 hover:bg-accent/15 focus-visible:outline-accent'}`}
          >
            <Dumbbell size={18} className={`mb-2 ${accentTextClassName}`} aria-hidden="true" />
            <div className={`text-[11px] ${secondaryTextClassName}`}>{copy.totalVolume}</div>
            <div className={`mt-1 text-lg font-bold ${primaryTextClassName}`}>{formatTrainingVolume(totalVolumeKg)}</div>
          </button>
          <div className={`rounded-2xl p-3 ${isGirlsTheme ? 'border border-[#F9B2D7]/45 bg-[linear-gradient(145deg,rgba(249,178,215,0.24),rgba(255,255,255,0.74))] shadow-[0_10px_22px_rgba(249,178,215,0.14)] ring-1 ring-white/45' : cardClassName}`}>
            <Target size={18} className={`mb-2 ${accentTextClassName}`} aria-hidden="true" />
            <div className={`text-[11px] ${secondaryTextClassName}`}>Strength change</div>
            <div className={`mt-1 text-lg font-bold ${primaryTextClassName}`}>{strengthChangeText}</div>
          </div>
        </div>
      </Card>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h2 className={`text-lg font-semibold ${primaryTextClassName}`}>Strength trend</h2>
          <div
            ref={metricMenuRef}
            className={`group relative z-20 min-w-[188px] overflow-visible rounded-[1.15rem] border transition-all duration-200 ${
              isGirlsTheme
                ? 'border-[#E2B4BD]/50 bg-[linear-gradient(135deg,rgba(255,255,255,0.88),rgba(255,245,245,0.74)_55%,rgba(207,236,243,0.28))] shadow-[0_12px_26px_rgba(226,180,189,0.16)] ring-1 ring-white/50 hover:border-[#F9B2D7]/70 focus-within:border-[#F9B2D7]/80 focus-within:ring-[#F9B2D7]/25'
                : 'border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.075),rgba(255,255,255,0.025))] shadow-[0_14px_30px_rgba(0,0,0,0.22)] ring-1 ring-white/[0.03] hover:border-accent/35 focus-within:border-accent/65 focus-within:ring-accent/20'
            }`}
          >
            <div className="pointer-events-none absolute left-3 top-1/2 flex -translate-y-1/2 items-center gap-2">
              <span
                className={`grid h-7 w-7 place-items-center rounded-xl ${
                  isGirlsTheme
                    ? 'border border-[#F9B2D7]/40 bg-[#F9B2D7]/18 text-[#A87884]'
                    : 'border border-accent/20 bg-accent/10 text-accent'
                }`}
                aria-hidden="true"
              >
                <Activity size={14} />
              </span>
              <span className={`hidden text-[10px] font-bold uppercase tracking-[0.14em] sm:inline ${isGirlsTheme ? 'text-[#A87884]' : 'text-text-tertiary'}`}>
                Metric
              </span>
            </div>
            <button
              type="button"
              aria-label="Strength metric"
              aria-haspopup="listbox"
              aria-expanded={isMetricMenuOpen}
              onClick={() => setIsMetricMenuOpen((open) => !open)}
              className={`min-h-12 w-full bg-transparent py-2 pl-12 pr-10 text-left text-sm font-bold outline-none transition-colors sm:pl-[5.95rem] ${
                isGirlsTheme
                  ? 'text-[#795E67] group-hover:text-[#4A4A4A]'
                  : 'text-text-secondary group-hover:text-text-primary'
              }`}
            >
              Estimated 1RM
            </button>
            <ChevronDown
              size={16}
              className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 transition-transform duration-200 group-hover:translate-y-[-45%] ${isMetricMenuOpen ? 'rotate-180' : ''} ${
                isGirlsTheme ? 'text-[#A87884] group-hover:text-[#4A4A4A]' : 'text-text-tertiary group-hover:text-accent'
              }`}
              aria-hidden="true"
            />
            {isMetricMenuOpen ? (
              <div
                role="listbox"
                aria-label="Strength metric"
                className={`absolute left-2 right-2 top-[calc(100%+0.35rem)] z-30 rounded-[1rem] border p-1.5 shadow-2xl backdrop-blur-xl ${
                  isGirlsTheme
                    ? 'border-[#E2B4BD]/55 bg-[#FFF5F5]/95 text-[#4A4A4A] shadow-[0_18px_34px_rgba(226,180,189,0.22)]'
                    : 'border-white/10 bg-[#101824]/95 text-text-primary shadow-[0_18px_34px_rgba(0,0,0,0.34)]'
                }`}
              >
                <button
                  type="button"
                  role="option"
                  aria-selected="true"
                  onClick={() => setIsMetricMenuOpen(false)}
                  className={`flex min-h-10 w-full items-center justify-between rounded-[0.8rem] px-3 text-left text-sm font-semibold transition-colors ${
                    isGirlsTheme
                      ? 'bg-[#F9B2D7]/18 text-[#4A4A4A] hover:bg-[#F9B2D7]/28'
                      : 'bg-accent/12 text-text-primary hover:bg-accent/18'
                  }`}
                >
                  <span>Estimated 1RM</span>
                  <span className={`h-2 w-2 rounded-full ${isGirlsTheme ? 'bg-[#F9B2D7]' : 'bg-accent'}`} aria-hidden="true" />
                </button>
              </div>
            ) : null}
          </div>
        </div>
        <StrengthChart coachmarkTargetId="progress_strength_chart" weeks={selectedRange.weeks} themeVariant={isGirlsTheme ? 'girls' : 'default'} />
        <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
          <div className={`rounded-2xl border p-3 ${isGirlsTheme ? 'border-[#E2B4BD]/45 bg-white/70 shadow-[0_10px_22px_rgba(226,180,189,0.10)]' : 'border-white/10 bg-[#101824]'}`}>
            <div className={tertiaryTextClassName}>Baseline</div>
            <div className={`mt-1 font-semibold ${primaryTextClassName}`}>{baselineStrengthText}</div>
          </div>
          <div className={`rounded-2xl border p-3 ${isGirlsTheme ? 'border-[#CFECF3]/70 bg-[#CFECF3]/45 shadow-[0_10px_22px_rgba(207,236,243,0.14)]' : 'border-white/10 bg-[#101824]'}`}>
            <div className={tertiaryTextClassName}>Current</div>
            <div className={`mt-1 font-semibold ${primaryTextClassName}`}>{currentStrengthText}</div>
          </div>
        </div>
      </div>

      <Card coachmarkTargetId="progress_muscle_distribution_card" className={isGirlsTheme ? `p-4 !${girlsSurfaceClassName}` : 'p-4'}>
        <div>
          <h3 className={`font-semibold ${primaryTextClassName}`}>Training focus</h3>
          <p className={`mt-1 text-sm ${secondaryTextClassName}`}>Leading muscle targets from your plan and history.</p>

          {muscleDistribution.length > 0 ? (
            <div className="mt-4 space-y-3">
              {muscleDistribution.map((m) => (
                <div key={m.name}>
                  <div className="mb-1 flex justify-between gap-3 text-sm">
                    <span className={`font-semibold ${primaryTextClassName}`}>{getLocalizedMuscleName(m.name, language)}</span>
                    <span className={secondaryTextClassName}>{Math.round(m.val)}%</span>
                  </div>
                  <div className={`h-2 overflow-hidden rounded-full ${progressTrackClassName}`}>
                    <div
                      className={`h-full rounded-full ${progressFillClassName}`}
                      style={{ width: `${Math.max(5, (m.val / muscleMax) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={onViewMuscleReport}
                className={`mt-2 flex min-h-12 w-full items-center justify-between rounded-2xl border px-4 text-sm font-bold focus-visible:outline focus-visible:outline-2 ${isGirlsTheme ? 'border-[#E2B4BD]/45 bg-white/70 text-[#A87884] shadow-[0_10px_22px_rgba(226,180,189,0.10)] hover:border-[#F9B2D7]/70 focus-visible:outline-[#F9B2D7]' : 'border-white/10 bg-[#14202E] text-accent focus-visible:outline-accent'}`}
              >
                VIEW MUSCLE REPORT
                <ChevronRight size={18} aria-hidden="true" />
              </button>
            </div>
          ) : (
            <div className={`mt-4 rounded-2xl border px-4 py-4 text-sm ${isGirlsTheme ? 'border-[#E2B4BD]/45 bg-white/70 text-[#795E67]' : 'border-white/8 bg-background/50 text-text-secondary'}`}>
              {copy.noPlanDistribution}
            </div>
          )}
        </div>
      </Card>

      <Card coachmarkTargetId="progress_overload_card" className={isGirlsTheme ? 'p-4 !border-[#F9B2D7]/45 !bg-[linear-gradient(135deg,rgba(249,178,215,0.25),rgba(255,255,255,0.78)_46%,rgba(207,236,243,0.30))] !shadow-[0_18px_42px_rgba(249,178,215,0.18)] ring-1 ring-white/45' : 'p-4'}>
        <p className={`text-[11px] font-bold uppercase tracking-[0.16em] ${accentTextClassName}`}>Next Step</p>
        {overloadRecommendation ? (
          <>
            <h3 className={`mt-2 text-lg font-semibold ${primaryTextClassName}`}>Next overload is ready</h3>
            <p className={`mt-1 text-sm ${secondaryTextClassName}`}>{overloadRecommendation}</p>
          </>
        ) : (
          <>
            <h3 className={`mt-2 text-lg font-semibold ${primaryTextClassName}`}>Keep logging your sets</h3>
            <p className={`mt-1 text-sm ${secondaryTextClassName}`}>Complete more workouts to unlock your next overload recommendation.</p>
          </>
        )}
        <button
          type="button"
          onClick={onStartWorkout}
          className={`mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl px-4 text-sm font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${accentButtonClassName} ${isGirlsTheme ? 'focus-visible:outline-[#F9B2D7]' : 'focus-visible:outline-accent'}`}
        >
          <PlayCircle size={18} aria-hidden="true" />
          START WORKOUT
        </button>
      </Card>

      <button
        type="button"
        data-coachmark-target="progress_biweekly_report_button"
        onClick={onViewReport}
        className={`flex min-h-12 w-full items-center justify-between rounded-2xl border px-4 text-left transition-colors focus-visible:outline focus-visible:outline-2 ${isGirlsTheme ? 'border-[#E2B4BD]/45 bg-white/75 shadow-[0_12px_28px_rgba(226,180,189,0.12)] hover:border-[#F9B2D7]/70 hover:bg-white/90 focus-visible:outline-[#F9B2D7]' : 'border-white/10 bg-[#101824] hover:border-accent/30 focus-visible:outline-accent'}`}
      >
        <span className={`flex items-center gap-3 text-sm font-semibold ${primaryTextClassName}`}>
          <CalendarDays size={18} className={accentTextClassName} aria-hidden="true" />
          View bi-weekly report
        </span>
        <ChevronRight size={18} className={secondaryTextClassName} aria-hidden="true" />
      </button>

      {showPageInfo && typeof document !== 'undefined' && createPortal(
        <div
          className={`fixed inset-0 z-[160] flex items-start justify-center overflow-y-auto px-4 pb-6 pt-[calc(env(safe-area-inset-top,0px)+0.75rem)] sm:pt-8 ${isGirlsTheme ? 'bg-[#4A4A4A]/35 backdrop-blur-sm' : 'bg-black/60'}`}
          onClick={() => setShowPageInfo(false)}
          role="presentation"
        >
          <div
            className={`w-full max-w-md max-h-[calc(100dvh-1.5rem)] overflow-y-auto rounded-2xl border p-5 ${isGirlsTheme ? 'border-[#E2B4BD]/45 bg-[#FFF5F5]' : 'border-white/10 bg-card'}`}
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={copy.progressDialogAria}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className={`text-base font-semibold ${primaryTextClassName}`}>{copy.progressDialogTitle}</h3>
              <button
                type="button"
                className={`flex h-8 w-8 items-center justify-center rounded-full border transition-colors ${isGirlsTheme ? 'border-[#E2B4BD]/45 bg-white/70 text-[#795E67] hover:text-[#4A4A4A]' : 'border-white/10 text-text-secondary hover:border-accent/30 hover:text-text-primary'}`}
                onClick={() => setShowPageInfo(false)}
                aria-label={copy.close}
              >
                <X size={14} />
              </button>
            </div>
            <div className={`space-y-2 text-sm ${secondaryTextClassName}`}>
              <p>{copy.infoLine1}</p>
              <p>{copy.infoLine2}</p>
              <p>{copy.infoLine3}</p>
              <p>{copy.infoLine4}</p>
              <p>{copy.infoLine5}</p>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>);

}
