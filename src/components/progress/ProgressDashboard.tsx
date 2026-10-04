import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Card } from '../ui/Card';
import { CalendarDays, ChevronRight, CircleQuestionMark, PlayCircle, X } from 'lucide-react';
import { api } from '../../services/api';
import { AppLanguage, getActiveLanguage, getStoredLanguage } from '../../services/language';
import { offlineCacheKeys, readOfflineCacheValue } from '../../services/offlineCache';
import BodyMap from '../BodyMap';
import { GirlsPeriodCarousel } from './MuscleRecoveryScreen';
import { MuscleSvgBadge } from '../workout/MuscleSvgBadge';
import {
  type BodyMapLevels,
  type BodyMapMuscle,
  recoveryMuscleToBodyMapSlugs,
} from '../../lib/muscle-map';
import {
  aggregateTrainingVolume,
  formatTrainingVolume,
  getWorkoutDateKey,
  getWorkoutSetCount,
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
  return normalized === 'woman' || normalized === 'female' || normalized === 'f' || normalized === 'girl' || normalized === 'girls' || normalized === 'femme';
};

interface MuscleDistributionItem {
  name: string;
  val: number;
  sets?: number;
}

type BodyMapMode = '7d' | '30d' | 'recovery';

interface DashboardRecoveryMuscle {
  muscle: string;
  name: string;
  score: number;
}

interface OverloadRecommendation {
  name: string;
  current: string;
  next: string;
  direction?: string;
}

const toTitleCase = (value: unknown) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const normalizeOverloadExerciseName = (value: unknown) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const PENDING_OVERLOAD_STORAGE_KEY = 'repset:pending-overload-targets';

const storePendingOverloadTarget = (recommendation: OverloadRecommendation) => {
  if (typeof window === 'undefined') return;
  const normalizedName = normalizeOverloadExerciseName(recommendation.name);
  if (!normalizedName) return;

  let existing: Record<string, unknown> = {};
  try {
    existing = JSON.parse(localStorage.getItem(PENDING_OVERLOAD_STORAGE_KEY) || '{}') || {};
  } catch {
    existing = {};
  }

  localStorage.setItem(PENDING_OVERLOAD_STORAGE_KEY, JSON.stringify({
    ...existing,
    [normalizedName]: {
      ...recommendation,
      normalizedName,
      savedAt: new Date().toISOString(),
    },
  }));
  window.dispatchEvent(new CustomEvent('repset:pending-overload-updated', { detail: { recommendation } }));
};

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
      sets: Math.max(0, Number((item as any)?.setUnits ?? (item as any)?.sets ?? (item as any)?.setCount ?? 0)),
    }));

const normalizeBodyMapDistributionItems = (items: Array<{ muscle?: unknown; percent?: unknown }>) =>
  items
    .map((item) => ({
      name: String(item?.muscle || '-'),
      val: Math.max(0, Math.min(100, Number(item?.percent || 0))),
      sets: Math.max(0, Number((item as any)?.setUnits ?? (item as any)?.sets ?? (item as any)?.setCount ?? 0)),
    }))
    .filter((item) => item.name && item.name !== '-' && item.val > 0);

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
      setsLabel: 'sets',
    classification: 'Classification',
    viewLeaderboard: 'View leaderboard',
    muscleDistribution: 'Muscle Distribution (Plan Target)',
    noPlanDistribution: 'No plan distribution is available yet for this user.',
    viewBiWeeklyReport: 'View Bi-Weekly Report',
    fourWeeks: '4 weeks',
    eightWeeks: '8 weeks',
    allTime: 'All time',
    volumeRange: (range: string) => `Volume · ${range}`,
    weight: 'Weight',
    estimated1RM: 'Estimated 1RM',
    addYours: 'Add yours',
    change: 'Change',
    regularity: 'Regularity',
    dayStreak: (days: number) => `${days} day streak`,
    weekGoal: (completed: number, goal: number) => `${completed} of ${goal} this week`,
    heatmapSets: 'sets',
    nextStep: 'Next Step',
    nextOverloadReady: 'Next overload is ready',
    keepLoggingSets: 'Keep logging your sets',
    overloadLocked: 'Complete more workouts to unlock your next overload recommendation.',
    startWorkout: 'Start workout',
    getIt: 'Get it',
    overloadModalTitle: 'Overload propositions',
    overloadModalSubtitle: 'Pick one target and RepSet will apply it to that exercise in your workout tracker.',
    overloadApplied: 'Target saved. Open the matching exercise to see it applied.',
    progressDialogTitle: "What's on this page",
    close: 'Close',
    infoLine1: 'Your weekly strength trend (estimated 1RM).',
    infoLine2: 'Your weekly consistency percentage and completed days.',
    infoLine3: 'Your total lifted volume.',
    infoLine4: 'Your top target muscles for the current plan.',
    infoLine5: 'Next overload recommendations and quick report access.',
    fireAlt: 'Fire',
    progressDialogAria: 'Progress page info dialog',
    muscleMapTitle: 'Muscle map',
    muscleRadarTitle: 'Last 30 days',
    muscleRadarSubtitle: 'See which zones need the most work',
    sevenDays: '7 d',
    thirtyDays: '30 d',
    recovery: 'Recovery',
    notWorked: 'Not worked',
    maxVolume: 'Max volume',
    overdue: 'Behind',
    noOverdueMuscles: 'No muscles behind',
  },
  ar: {
    title: 'تقدمك',
    strengthScoreInfo: 'معلومات درجة القوة',
    totalVolume: 'الحجم الكلي',
    setsLabel: 'مجموعات',
    classification: 'التصنيف',
    viewLeaderboard: 'عرض لوحة الصدارة',
    muscleDistribution: 'توزيع العضلات (هدف الخطة)',
    noPlanDistribution: 'لا يتوفر توزيع للخطة لهذا المستخدم حتى الآن.',
    viewBiWeeklyReport: 'عرض التقرير نصف الأسبوعي',
    fourWeeks: '4 أسابيع',
    eightWeeks: '8 أسابيع',
    allTime: 'كل الوقت',
    volumeRange: (range: string) => `الحجم · ${range}`,
    weight: 'الوزن',
    estimated1RM: '1RM تقديري',
    addYours: 'أضف قيمتك',
    change: 'التغيير',
    regularity: 'الانتظام',
    dayStreak: (days: number) => `${days} يوم متتالي`,
    weekGoal: (completed: number, goal: number) => `${completed} من ${goal} هذا الأسبوع`,
    heatmapSets: 'مجموعات',
    nextStep: 'الخطوة التالية',
    nextOverloadReady: 'التحميل التالي جاهز',
    keepLoggingSets: 'استمر في تسجيل المجموعات',
    overloadLocked: 'أكمل تمارين أكثر لفتح توصية التحميل التالية.',
    startWorkout: 'ابدأ التمرين',
    getIt: 'طبقها',
    overloadModalTitle: 'اقتراحات التحميل',
    overloadModalSubtitle: 'اختر هدفًا واحدًا وسيطبقه RepSet على هذا التمرين في المتتبع.',
    overloadApplied: 'تم حفظ الهدف. افتح التمرين المطابق لتراه مطبقًا.',
    progressDialogTitle: 'ما الذي ستجده في هذه الصفحة',
    close: 'إغلاق',
    infoLine1: 'اتجاه قوتك الأسبوعي (تقدير 1RM).',
    infoLine2: 'نسبة التزامك أسبوعيًا وعدد الأيام المكتملة.',
    infoLine3: 'إجمالي حجم الأوزان التي رفعتها.',
    infoLine4: 'أكثر العضلات استهدافًا في خطتك الحالية.',
    infoLine5: 'توصيات التحميل التدريجي القادمة مع وصول سريع للتقرير.',
    fireAlt: 'نار',
    progressDialogAria: 'نافذة معلومات صفحة التقدم',
    muscleMapTitle: 'خريطة العضلات',
    muscleRadarTitle: 'آخر 30 يومًا',
    muscleRadarSubtitle: 'شاهد المناطق التي تحتاج إلى أكبر قدر من العمل',
    sevenDays: '7 أ',
    thirtyDays: '30 ي',
    recovery: 'التعافي',
    notWorked: 'غير مدرب',
    maxVolume: 'أعلى حجم',
    overdue: 'متأخر',
    noOverdueMuscles: 'لا توجد عضلات متأخرة',
  },
  it: {
    title: 'I Tuoi Progressi',
    strengthScoreInfo: 'Info punteggio forza',
    totalVolume: 'Volume Totale',
    setsLabel: 'serie',
    classification: 'Classifica',
    viewLeaderboard: 'Apri leaderboard',
    muscleDistribution: 'Distribuzione Muscolare (Target del Piano)',
    noPlanDistribution: 'Nessuna distribuzione del piano disponibile per questo utente.',
    viewBiWeeklyReport: 'Visualizza Report Bisettimanale',
    fourWeeks: '4 settimane',
    eightWeeks: '8 settimane',
    allTime: 'Sempre',
    volumeRange: (range: string) => `Volume · ${range}`,
    weight: 'Peso',
    estimated1RM: '1RM stimato',
    addYours: 'Aggiungi il tuo',
    change: 'Cambio',
    regularity: 'Regolarita',
    dayStreak: (days: number) => `Serie di ${days} giorni`,
    weekGoal: (completed: number, goal: number) => `${completed} di ${goal} questa settimana`,
    heatmapSets: 'serie',
    nextStep: 'Prossimo passo',
    nextOverloadReady: 'Il prossimo overload e pronto',
    keepLoggingSets: 'Continua a registrare le serie',
    overloadLocked: 'Completa piu allenamenti per sbloccare il prossimo consiglio di overload.',
    startWorkout: 'Inizia allenamento',
    getIt: 'Prendilo',
    overloadModalTitle: 'Proposte di overload',
    overloadModalSubtitle: 'Scegli un target e RepSet lo applichera a quell esercizio nel tracker.',
    overloadApplied: 'Target salvato. Apri l esercizio corrispondente per vederlo applicato.',
    progressDialogTitle: 'Cosa trovi in questa pagina',
    close: 'Chiudi',
    infoLine1: 'Il tuo trend settimanale della forza (1RM stimato).',
    infoLine2: 'La tua percentuale settimanale di costanza e i giorni completati.',
    infoLine3: 'Il volume totale sollevato.',
    infoLine4: 'I principali muscoli target del piano attuale.',
    infoLine5: 'Prossimi consigli di overload e accesso rapido al report.',
    fireAlt: 'Fuoco',
    progressDialogAria: 'Finestra info pagina progressi',
    muscleMapTitle: 'Mappa muscolare',
    muscleRadarTitle: 'Ultimi 30 giorni',
    muscleRadarSubtitle: 'Vedi quali zone hanno bisogno di piu lavoro',
    sevenDays: '7 g',
    thirtyDays: '30 g',
    recovery: 'Recupero',
    notWorked: 'Non allenato',
    maxVolume: 'Volume massimo',
    overdue: 'In ritardo',
    noOverdueMuscles: 'Nessun muscolo in ritardo',
  },
  fr: {
    title: 'Tes Progres',
    strengthScoreInfo: 'Infos score de force',
    totalVolume: 'Volume Total',
    setsLabel: 'series',
    classification: 'Classement',
    viewLeaderboard: 'Voir le classement',
    muscleDistribution: 'Repartition Musculaire (Cible du Plan)',
    noPlanDistribution: 'Aucune repartition du plan n est encore disponible pour cet utilisateur.',
    viewBiWeeklyReport: 'Voir le Rapport Bi-Hebdomadaire',
    fourWeeks: '4 semaines',
    eightWeeks: '8 semaines',
    allTime: 'Tout',
    volumeRange: (range: string) => `Volume · ${range}`,
    weight: 'Poids',
    estimated1RM: '1RM estime',
    addYours: 'Ajoute le tien',
    change: 'Changement',
    regularity: 'Regularite',
    dayStreak: (days: number) => `Serie de ${days} jours`,
    weekGoal: (completed: number, goal: number) => `${completed} sur ${goal} cette semaine`,
    heatmapSets: 'series',
    nextStep: 'Prochaine etape',
    nextOverloadReady: 'La prochaine surcharge est prete',
    keepLoggingSets: 'Continue a enregistrer tes series',
    overloadLocked: 'Complete plus de seances pour debloquer ta prochaine recommandation de surcharge.',
    startWorkout: 'Commencer la seance',
    getIt: 'Le prendre',
    overloadModalTitle: 'Propositions de surcharge',
    overloadModalSubtitle: 'Choisis une cible et RepSet l appliquera a cet exercice dans le tracker.',
    overloadApplied: 'Cible enregistree. Ouvre l exercice correspondant pour la voir appliquee.',
    progressDialogTitle: 'Ce que montre cette page',
    close: 'Fermer',
    infoLine1: 'Ta tendance de force hebdomadaire (1RM estime).',
    infoLine2: 'Ton pourcentage de regularite hebdomadaire et les jours completes.',
    infoLine3: 'Ton volume total souleve.',
    infoLine4: 'Tes principaux muscles cibles dans le plan actuel.',
    infoLine5: 'Les prochaines recommandations de surcharge et un acces rapide au rapport.',
    fireAlt: 'Feu',
    progressDialogAria: 'Fenetre d information de la page progres',
    muscleMapTitle: 'Carte musculaire',
    muscleRadarTitle: '30 derniers jours',
    muscleRadarSubtitle: 'Vois quelles zones ont besoin de plus de travail',
    sevenDays: '7 j',
    thirtyDays: '30 j',
    recovery: 'Recuperation',
    notWorked: 'Non travaille',
    maxVolume: 'Volume maximal',
    overdue: 'En retard',
    noOverdueMuscles: 'Aucun muscle en retard',
  },
  de: {
    title: 'Dein Fortschritt',
    strengthScoreInfo: 'Infos zum Kraftwert',
    totalVolume: 'Gesamtvolumen',
    setsLabel: 'Saetze',
    classification: 'Platzierung',
    viewLeaderboard: 'Bestenliste anzeigen',
    muscleDistribution: 'Muskelverteilung (Plan-Ziel)',
    noPlanDistribution: 'Fuer diesen Nutzer ist noch keine Planverteilung verfuegbar.',
    viewBiWeeklyReport: 'Zweiwochenbericht Anzeigen',
    fourWeeks: '4 Wochen',
    eightWeeks: '8 Wochen',
    allTime: 'Gesamt',
    volumeRange: (range: string) => `Volumen · ${range}`,
    weight: 'Gewicht',
    estimated1RM: 'Geschaetztes 1RM',
    addYours: 'Eigenen Wert eintragen',
    change: 'Aenderung',
    regularity: 'Regelmaessigkeit',
    dayStreak: (days: number) => `${days}-Tage-Serie`,
    weekGoal: (completed: number, goal: number) => `${completed} von ${goal} diese Woche`,
    heatmapSets: 'Saetze',
    nextStep: 'Naechster Schritt',
    nextOverloadReady: 'Naechster Overload ist bereit',
    keepLoggingSets: 'Logge weiter deine Saetze',
    overloadLocked: 'Schliesse mehr Workouts ab, um deine naechste Overload-Empfehlung freizuschalten.',
    startWorkout: 'Workout starten',
    getIt: 'Uebernehmen',
    overloadModalTitle: 'Overload-Vorschlaege',
    overloadModalSubtitle: 'Waehle ein Ziel und RepSet uebernimmt es fuer diese Uebung im Tracker.',
    overloadApplied: 'Ziel gespeichert. Oeffne die passende Uebung, um es angewendet zu sehen.',
    progressDialogTitle: 'Was auf dieser Seite ist',
    close: 'Schliessen',
    infoLine1: 'Dein woechentlicher Krafttrend (geschaetztes 1RM).',
    infoLine2: 'Deine woechentliche Konstanz in Prozent und abgeschlossene Tage.',
    infoLine3: 'Dein gesamtes bewegtes Volumen.',
    infoLine4: 'Deine wichtigsten Zielmuskeln im aktuellen Plan.',
    infoLine5: 'Naechste Overload-Empfehlungen und schneller Berichtszugang.',
    fireAlt: 'Feuer',
    progressDialogAria: 'Info-Dialog Fortschrittsseite',
    muscleMapTitle: 'Muskelkarte',
    muscleRadarTitle: 'Letzte 30 Tage',
    muscleRadarSubtitle: 'Sieh, welche Zonen mehr Arbeit brauchen',
    sevenDays: '7 T',
    thirtyDays: '30 T',
    recovery: 'Erholung',
    notWorked: 'Nicht trainiert',
    maxVolume: 'Max. Volumen',
    overdue: 'Rueckstand',
    noOverdueMuscles: 'Keine Muskeln im Rueckstand',
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

const toBodyMapVolumeLevels = (distribution: MuscleDistributionItem[]): BodyMapLevels => {
  const levels: BodyMapLevels = {};
  const maxValue = Math.max(...distribution.map((item) => Number(item.val || 0)), 1);

  distribution.forEach((item) => {
    const intensity = Math.max(0, Math.min(1, Number(item.val || 0) / maxValue));
    const level = intensity >= 0.75 ? 4 : intensity >= 0.5 ? 3 : intensity >= 0.25 ? 2 : intensity > 0 ? 1 : 0;
    if (!level) return;

    recoveryMuscleToBodyMapSlugs(item.name).forEach((slug) => {
      levels[slug] = Math.max(levels[slug] || 0, level);
    });
  });

  return levels;
};

const toBodyMapRecoveryDamageLevels = (recovery: DashboardRecoveryMuscle[]): BodyMapLevels => {
  const levels: BodyMapLevels = {};

  recovery.forEach((item) => {
    const score = Math.max(0, Math.min(100, Number(item.score || 0)));
    const damage = 100 - score;
    const level = damage >= 70 ? 4 : damage >= 40 ? 3 : damage >= 15 ? 2 : damage > 0 ? 1 : 0;
    if (!level) return;

    const names = [item.muscle, item.name].filter(Boolean);
    names.flatMap((name) => recoveryMuscleToBodyMapSlugs(name)).forEach((slug) => {
      levels[slug] = Math.max(levels[slug] || 0, level);
    });
  });

  return levels;
};

const itemMatchesBodyMapMuscle = (item: { muscle?: string; name?: string }, muscle: BodyMapMuscle) => {
  const slugs = new Set([
    ...recoveryMuscleToBodyMapSlugs(item.muscle),
    ...recoveryMuscleToBodyMapSlugs(item.name),
  ]);
  return slugs.has(muscle);
};

const normalizeDashboardRecovery = (items: unknown): DashboardRecoveryMuscle[] => {
  if (!Array.isArray(items)) return [];

  return items
    .map((item: any) => ({
      muscle: String(item?.muscle || item?.name || ''),
      name: String(item?.name || item?.muscle || ''),
      score: Math.max(0, Math.min(100, Number(item?.score ?? item?.recoveryPercentage ?? 100))),
    }))
    .filter((item) => item.name || item.muscle);
};

const formatDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getWeekdayInitials = (language: AppLanguage) => {
  if (language === 'fr') return ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
  if (language === 'it') return ['L', 'M', 'M', 'G', 'V', 'S', 'D'];
  if (language === 'de') return ['M', 'D', 'M', 'D', 'F', 'S', 'S'];
  if (language === 'ar') return ['ن', 'ث', 'ر', 'خ', 'ج', 'س', 'ح'];
  return ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
};

function MiniSparkline({ values, tone = 'default' }: { values: number[]; tone?: 'default' | 'girls' }) {
  const safeValues = values.length ? values : [0, 0];
  const max = Math.max(...safeValues, 1);
  const min = Math.min(...safeValues, 0);
  const span = Math.max(1, max - min);
  const points = safeValues.map((value, index) => {
    const x = safeValues.length === 1 ? 92 : (index / (safeValues.length - 1)) * 92 + 4;
    const y = 42 - ((value - min) / span) * 34;
    return `${x},${y}`;
  }).join(' ');
  const lastValue = safeValues[safeValues.length - 1] || 0;
  const lastX = safeValues.length === 1 ? 92 : 96;
  const lastY = 42 - ((lastValue - min) / span) * 34;
  const stroke = tone === 'girls' ? '#A87884' : '#AFC0D5';
  const dot = tone === 'girls' ? '#F9B2D7' : '#BBFF5C';

  return (
    <svg className="h-12 w-full overflow-visible" viewBox="0 0 100 48" preserveAspectRatio="none" aria-hidden="true">
      <line x1="4" y1="42" x2="96" y2="42" stroke="currentColor" strokeOpacity="0.55" strokeWidth="1.4" />
      <polyline points={points} fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lastX} cy={lastY} r="3" fill="rgb(var(--color-background))" stroke={dot} strokeWidth="2" />
    </svg>
  );
}

function DashboardMuscleMapCard({
  mode,
  onModeChange,
  levels,
  overdueMuscles,
  selectedMuscle,
  onMuscleSelect,
  onClearSelection,
  body,
  copy,
  language,
  isGirlsTheme,
}: {
  mode: BodyMapMode;
  onModeChange: (nextMode: BodyMapMode) => void;
  levels: BodyMapLevels;
  overdueMuscles: DashboardRecoveryMuscle[];
  selectedMuscle: BodyMapMuscle | null;
  onMuscleSelect: (muscle: BodyMapMuscle) => void;
  onClearSelection: () => void;
  body?: 'male' | 'female';
  copy: typeof PROGRESS_DASHBOARD_I18N.en;
  language: AppLanguage;
  isGirlsTheme: boolean;
}) {
  const textPrimary = isGirlsTheme ? 'text-[#4A4A4A]' : 'text-white';
  const textSecondary = isGirlsTheme ? 'text-[#795E67]' : 'text-text-secondary';
  const textTertiary = isGirlsTheme ? 'text-[#A87884]' : 'text-text-tertiary';
  const modes: Array<{ key: BodyMapMode; label: string }> = [
    { key: '7d', label: copy.sevenDays },
    { key: '30d', label: copy.thirtyDays },
    { key: 'recovery', label: copy.recovery },
  ];
  const overdueText = overdueMuscles.length
    ? overdueMuscles
        .slice(0, 3)
        .map((muscle) => getLocalizedMuscleName(toTitleCase(muscle.name || muscle.muscle), language))
        .join(' · ')
    : copy.noOverdueMuscles;

  return (
    <section
      onClick={selectedMuscle ? onClearSelection : undefined}
      className={`rounded-[1.35rem] border p-4 ${
        isGirlsTheme
          ? 'border-[#E2B4BD]/55 bg-white/75 shadow-[0_14px_32px_rgba(226,180,189,0.15)] ring-1 ring-white/35'
          : 'border-[#AFC0D5]/55 bg-[#101824] shadow-[0_16px_36px_rgba(0,0,0,0.22)]'
      }`}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className={`text-[10px] font-semibold uppercase tracking-[0.18em] ${textTertiary}`}>{copy.muscleMapTitle}</h2>
        <div className={`flex rounded-full p-1 ${isGirlsTheme ? 'bg-[#FFF5F5]/80' : 'bg-[#0B121B]/90'}`}>
          {modes.map((item) => (
            <button
              key={item.key}
              type="button"
              aria-pressed={mode === item.key}
              onClick={(event) => {
                event.stopPropagation();
                onModeChange(item.key);
              }}
              className={`min-h-7 rounded-full px-3 text-[10px] font-semibold transition-colors ${
                mode === item.key
                  ? isGirlsTheme
                    ? 'bg-[#F9B2D7] text-[#4A4A4A]'
                    : 'bg-accent text-black'
                  : textSecondary
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div onClick={(event) => event.stopPropagation()}>
        <BodyMap
          body={body}
          className="dashboard-bodymap"
          levels={levels}
          selected={selectedMuscle}
          onMuscle={onMuscleSelect}
        />
      </div>

      <div className={`mt-4 flex items-center gap-2 text-[10px] ${textTertiary}`}>
        <span className="shrink-0">{copy.notWorked}</span>
        <div className="flex flex-1 items-center justify-center gap-1">
          <span className="h-1.5 w-8 rounded-full bg-[#4B5563]" />
          <span className="h-1.5 w-8 rounded-full bg-accent" />
          <span className="h-1.5 w-8 rounded-full bg-[#FACC15]" />
          <span className="h-1.5 w-8 rounded-full bg-[#FB923C]" />
          <span className="h-1.5 w-8 rounded-full bg-error" />
        </div>
        <span className="shrink-0">{copy.maxVolume}</span>
      </div>

      <p className={`mt-4 text-xs ${textSecondary}`}>
        <span className={textPrimary}>{copy.overdue} : </span>
        {overdueText}
      </p>
    </section>
  );
}

const RADAR_FALLBACK_MUSCLES = [
  'Quadriceps',
  'Chest',
  'Back',
  'Shoulders',
  'Biceps',
  'Triceps',
  'Abs',
  'Glutes',
  'Hamstrings',
  'Calves',
];

function DashboardMuscleRadarCard({
  distribution,
  selectedMuscle,
  onMuscleSelect,
  onClearSelection,
  body,
  copy,
  language,
  isGirlsTheme,
}: {
  distribution: MuscleDistributionItem[];
  selectedMuscle: string | null;
  onMuscleSelect: (muscle: string) => void;
  onClearSelection: () => void;
  body?: 'male' | 'female';
  copy: typeof PROGRESS_DASHBOARD_I18N.en;
  language: AppLanguage;
  isGirlsTheme: boolean;
}) {
  const baseChartMuscles = useMemo(() => {
    const unique = new Map<string, MuscleDistributionItem>();
    distribution.forEach((item) => {
      const key = toTitleCase(item.name);
      if (!key || unique.has(key)) return;
      unique.set(key, { ...item, name: key });
    });
    RADAR_FALLBACK_MUSCLES.forEach((name) => {
      if (!unique.has(name)) unique.set(name, { name, val: 0, sets: 0 });
    });
    const primaryOrder = ['Quadriceps', 'Hamstrings', 'Glutes', 'Calves', 'Abs', 'Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps'];
    return primaryOrder
      .map((name) => unique.get(name))
      .filter((item): item is MuscleDistributionItem => Boolean(item))
      .slice(0, 10);
  }, [distribution]);
  const chartMuscles = useMemo(
    () => selectedMuscle
      ? baseChartMuscles.map((muscle) => (
        muscle.name === selectedMuscle ? muscle : { ...muscle, val: 0, sets: 0 }
      ))
      : baseChartMuscles,
    [baseChartMuscles, selectedMuscle],
  );

  const maxValue = Math.max(...chartMuscles.map((item) => Number(item.val || 0)), 1);
  const center = 120;
  const radius = 82;
  const rings = [0.2, 0.4, 0.6, 0.8, 1];
  const axes = chartMuscles.map((_, index) => {
    const angle = (-Math.PI / 2) + (index / chartMuscles.length) * Math.PI * 2;
    return {
      x: center + Math.cos(angle) * radius,
      y: center + Math.sin(angle) * radius,
    };
  });
  const areaPoints = chartMuscles.map((item, index) => {
    const angle = (-Math.PI / 2) + (index / chartMuscles.length) * Math.PI * 2;
    const valueRadius = radius * Math.max(0.08, Math.min(1, Number(item.val || 0) / maxValue));
    return `${center + Math.cos(angle) * valueRadius},${center + Math.sin(angle) * valueRadius}`;
  }).join(' ');
  const textPrimary = isGirlsTheme ? 'text-[#4A4A4A]' : 'text-white';
  const textSecondary = isGirlsTheme ? 'text-[#795E67]' : 'text-text-secondary';
  const lineColor = isGirlsTheme ? 'rgba(168,120,132,0.42)' : 'rgba(175,192,213,0.72)';
  const fillColor = isGirlsTheme ? 'rgba(249,178,215,0.25)' : 'rgba(187,255,92,0.18)';
  const strokeColor = isGirlsTheme ? '#F9B2D7' : '#BBFF5C';

  return (
    <section
      onClick={selectedMuscle ? onClearSelection : undefined}
      className={`rounded-[1.35rem] border p-4 ${
        isGirlsTheme
          ? 'border-[#E2B4BD]/55 bg-white/75 shadow-[0_14px_32px_rgba(226,180,189,0.15)] ring-1 ring-white/35'
          : 'dashboard-radar-card border-white/8 bg-[#101824] shadow-[0_16px_36px_rgba(0,0,0,0.22)]'
      }`}
    >
      <h2 className={`text-lg font-bold ${textPrimary}`}>{copy.muscleRadarTitle}</h2>
      <p className={`mt-0.5 text-xs ${textSecondary}`}>{copy.muscleRadarSubtitle}</p>

      <div className="relative mx-auto mt-3 h-[340px] w-full max-w-[335px]">
        <svg className="absolute left-1/2 top-1/2 h-[252px] w-[252px] -translate-x-1/2 -translate-y-1/2 overflow-visible" viewBox="0 0 240 240" aria-hidden="true">
          {rings.map((ring) => {
            const points = axes.map((point) => `${center + (point.x - center) * ring},${center + (point.y - center) * ring}`).join(' ');
            return <polygon key={ring} points={points} fill="none" stroke={lineColor} strokeWidth="1" />;
          })}
          {axes.map((point, index) => (
            <line key={`axis-${index}`} x1={center} y1={center} x2={point.x} y2={point.y} stroke={lineColor} strokeWidth="1" />
          ))}
          <polygon points={areaPoints} fill={fillColor} stroke={strokeColor} strokeWidth="2" strokeLinejoin="round" />
          {areaPoints.split(' ').map((point, index) => {
            const [x, y] = point.split(',').map(Number);
            return <circle key={`point-${index}`} cx={x} cy={y} r="3" fill={index === 0 ? '#E5E7EB' : strokeColor} />;
          })}
        </svg>

        {baseChartMuscles.map((muscle, index) => {
          const angle = (-Math.PI / 2) + (index / chartMuscles.length) * Math.PI * 2;
          const iconRadius = 100;
          const left = 50 + (Math.cos(angle) * iconRadius) / 2.65;
          const top = 50 + (Math.sin(angle) * iconRadius) / 2.5;
          const label = getLocalizedMuscleName(toTitleCase(muscle.name), language);
          const isSelected = selectedMuscle === muscle.name;
          return (
            <button
              key={`${muscle.name}-${index}`}
              type="button"
              aria-pressed={isSelected}
              aria-label={label}
              onClick={(event) => {
                event.stopPropagation();
                onMuscleSelect(muscle.name);
              }}
              className={`absolute h-16 w-16 -translate-x-1/2 -translate-y-1/2 transition ${
                isSelected ? 'scale-110 opacity-100 drop-shadow-[0_0_10px_rgba(187,255,92,0.35)]' : selectedMuscle ? 'opacity-45' : 'opacity-100'
              }`}
              style={{ left: `${left}%`, top: `${top}%` }}
            >
              <MuscleSvgBadge
                muscle={{ label, sourceName: muscle.name }}
                body={body}
                className="h-full w-full"
                figureClassName="h-full"
                showLabel={false}
                showContext
                hideHeadContext
                variant="bare"
                themeVariant={isGirlsTheme ? 'girls' : 'default'}
              />
            </button>
          );
        })}
      </div>
    </section>
  );
}

export function ProgressDashboard({ onViewReport, onViewTrainingVolume, onStartWorkout }: ProgressDashboardProps) {
  const [range, setRange] = useState<VolumeRange>('4w');
  const [bodyMapMode, setBodyMapMode] = useState<BodyMapMode>('30d');
  const [selectedBodyMapMuscle, setSelectedBodyMapMuscle] = useState<BodyMapMuscle | null>(null);
  const [selectedRadarMuscle, setSelectedRadarMuscle] = useState<string | null>(null);
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
  const [bodyMapDistributions, setBodyMapDistributions] = useState<{
    sevenDays: MuscleDistributionItem[];
    thirtyDays: MuscleDistributionItem[];
  }>({ sevenDays: [], thirtyDays: [] });
  const [recoveryMuscles, setRecoveryMuscles] = useState<DashboardRecoveryMuscle[]>([]);
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
  const [overloadRecommendations, setOverloadRecommendations] = useState<OverloadRecommendation[]>([]);
  const [showOverloadModal, setShowOverloadModal] = useState(false);
  const [appliedOverloadName, setAppliedOverloadName] = useState<string | null>(null);
  const [showPageInfo, setShowPageInfo] = useState(false);
  const [language, setLanguage] = useState<AppLanguage>('en');
  const [styleGender, setStyleGender] = useState(() => readStoredStyleGender());
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
      setBodyMapDistributions({ sevenDays: [], thirtyDays: [] });
      setRecoveryMuscles([]);
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
    const cachedSevenDayDistribution = readOfflineCacheValue<any>(offlineCacheKeys.muscleDistribution(userId, 7));
    const cachedHistoryDistribution = readOfflineCacheValue<any>(offlineCacheKeys.muscleDistribution(userId, 30));
    const cachedRecoveryStatus = readOfflineCacheValue<any>(offlineCacheKeys.recoveryStatus(userId));
    if (cachedSevenDayDistribution || cachedHistoryDistribution) {
      setBodyMapDistributions({
        sevenDays: normalizeBodyMapDistributionItems(Array.isArray(cachedSevenDayDistribution?.distribution) ? cachedSevenDayDistribution.distribution : []),
        thirtyDays: normalizeBodyMapDistributionItems(Array.isArray(cachedHistoryDistribution?.distribution) ? cachedHistoryDistribution.distribution : []),
      });
    }
    if (cachedRecoveryStatus) {
      setRecoveryMuscles(normalizeDashboardRecovery(cachedRecoveryStatus?.recovery));
    }
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
      const [sevenDayDistributionResult, thirtyDayDistributionResult, recoveryResult] = await Promise.allSettled([
        api.getMuscleDistribution(userId, 7),
        api.getMuscleDistribution(userId, 30),
        api.getRecoveryStatus(userId),
      ]);

      setBodyMapDistributions({
        sevenDays: sevenDayDistributionResult.status === 'fulfilled'
          ? normalizeBodyMapDistributionItems(Array.isArray(sevenDayDistributionResult.value?.distribution) ? sevenDayDistributionResult.value.distribution : [])
          : [],
        thirtyDays: thirtyDayDistributionResult.status === 'fulfilled'
          ? normalizeBodyMapDistributionItems(Array.isArray(thirtyDayDistributionResult.value?.distribution) ? thirtyDayDistributionResult.value.distribution : [])
          : [],
      });

      setRecoveryMuscles(
        recoveryResult.status === 'fulfilled'
          ? normalizeDashboardRecovery(recoveryResult.value?.recovery)
          : [],
      );
    } catch (error) {
      console.error('Failed to fetch dashboard body map data:', error);
      setBodyMapDistributions({ sevenDays: [], thirtyDays: [] });
      setRecoveryMuscles([]);
    }

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
      const normalizedList = list
        .map((item: any) => ({
          name: String(item?.name || '').trim(),
          current: String(item?.current || '').trim(),
          next: String(item?.next || '').trim(),
          direction: String(item?.direction || '').trim() || undefined,
        }))
        .filter((item: OverloadRecommendation) => item.name && item.next);
      const first = normalizedList[0];
      setOverloadRecommendations(normalizedList);
      setOverloadRecommendation(first ? `${first.name}: ${first.current} -> ${first.next}` : null);
    } catch (error) {
      console.error('Failed to fetch compact overload recommendation:', error);
      setOverloadRecommendations([]);
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

  const rangeItems = useMemo(
    () => RANGE_ITEMS.map((item) => ({
      ...item,
      label: item.key === '4w' ? copy.fourWeeks : item.key === '8w' ? copy.eightWeeks : copy.allTime,
    })),
    [copy],
  );
  const selectedRange = rangeItems.find((item) => item.key === range) || rangeItems[0];
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
  const dashboardDays = 30;
  const volumeSparkValues = volumeAggregation.buckets.map((bucket) => bucket.volumeKg).slice(-10);
  const consistencyGoal = Math.max(1, stats.workoutsPlannedThisWeek || 4);
  const dashboardBodyMapLevels = useMemo(() => {
    if (bodyMapMode === 'recovery') {
      const selectedRecovery = selectedBodyMapMuscle
        ? recoveryMuscles.filter((muscle) => itemMatchesBodyMapMuscle(muscle, selectedBodyMapMuscle))
        : recoveryMuscles;
      return toBodyMapRecoveryDamageLevels(selectedRecovery);
    }

    const sourceDistribution = bodyMapMode === '7d' ? bodyMapDistributions.sevenDays : bodyMapDistributions.thirtyDays;
    const selectedDistribution = selectedBodyMapMuscle
      ? sourceDistribution.filter((muscle) => itemMatchesBodyMapMuscle(muscle, selectedBodyMapMuscle))
      : sourceDistribution;
    return toBodyMapVolumeLevels(selectedDistribution);
  }, [bodyMapDistributions.sevenDays, bodyMapDistributions.thirtyDays, bodyMapMode, recoveryMuscles, selectedBodyMapMuscle]);
  const overdueRecoveryMuscles = useMemo(
    () => (selectedBodyMapMuscle
      ? recoveryMuscles.filter((muscle) => itemMatchesBodyMapMuscle(muscle, selectedBodyMapMuscle))
      : recoveryMuscles)
      .filter((muscle) => Number(muscle.score || 0) < 70)
      .sort((left, right) => Number(left.score || 0) - Number(right.score || 0)),
    [recoveryMuscles, selectedBodyMapMuscle],
  );
  const streakText = copy.dayStreak(stats.currentStreak || 0);
  const weekGoalText = copy.weekGoal(stats.workoutsCompletedThisWeek, consistencyGoal);
  const regularityCells = useMemo(() => {
    const byDate = new Map<string, number>();
    workoutSummaries.forEach((summary) => {
      const key = getWorkoutDateKey(summary);
      if (!key) return;
      byDate.set(key, (byDate.get(key) || 0) + getWorkoutSetCount(summary));
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = new Date(today);
    start.setDate(start.getDate() - (dashboardDays - 1));
    const offset = (start.getDay() + 6) % 7;
    start.setDate(start.getDate() - offset);

    return Array.from({ length: 35 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      const key = formatDateKey(date);
      const sets = byDate.get(key) || 0;
      const inWindow = date <= today && index >= offset;
      const level = !inWindow || sets <= 0 ? 0 : sets >= 12 ? 4 : sets >= 8 ? 3 : sets >= 4 ? 2 : 1;
      return { key, sets, level, inWindow };
    });
  }, [workoutSummaries]);
  const heatmapLabels = getWeekdayInitials(language);
  const heatmapTone = isGirlsTheme
    ? ['bg-[#E2B4BD]/22', 'bg-[#F9B2D7]/35', 'bg-[#F9B2D7]/55', 'bg-[#A87884]/75', 'bg-[#795E67]']
    : ['bg-[#223044]', 'bg-accent/25', 'bg-accent/45', 'bg-accent/70', 'bg-accent'];

  const primaryTextClassName = isGirlsTheme ? 'text-[#4A4A4A]' : 'text-white';
  const secondaryTextClassName = isGirlsTheme ? 'text-[#795E67]' : 'text-text-secondary';
  const tertiaryTextClassName = isGirlsTheme ? 'text-[#A87884]' : 'text-text-tertiary';
  const girlsSurfaceClassName =
    'border-[#E2B4BD]/50 !bg-[linear-gradient(135deg,rgba(255,255,255,0.84),rgba(255,245,245,0.70)_48%,rgba(207,236,243,0.34))] shadow-[0_18px_42px_rgba(226,180,189,0.18)] ring-1 ring-white/45';
  const accentTextClassName = isGirlsTheme ? 'text-[#A87884]' : 'text-accent';
  const accentButtonClassName = isGirlsTheme ? 'bg-[linear-gradient(135deg,#F9B2D7,#E2B4BD)] text-[#4A4A4A] shadow-[0_14px_30px_rgba(249,178,215,0.30)]' : 'bg-accent text-black';
  const progressTrackClassName = isGirlsTheme ? 'bg-[#E2B4BD]/28' : 'bg-white/10';
  const progressFillClassName = isGirlsTheme ? 'bg-[linear-gradient(90deg,#F9B2D7,#CFECF3)]' : 'bg-accent';
  const handleBodyMapMuscleSelect = (muscle: BodyMapMuscle) => {
    setSelectedBodyMapMuscle(muscle);
  };
  const handleApplyOverload = (recommendation: OverloadRecommendation) => {
    storePendingOverloadTarget(recommendation);
    setAppliedOverloadName(recommendation.name);
    setShowOverloadModal(false);
    onStartWorkout();
  };

  return (
    <div data-coachmark-target="progress_dashboard" className={`progress-dashboard space-y-6 ${isGirlsTheme ? 'progress-dashboard--girls text-[#4A4A4A]' : ''}`}>
      <div className="flex items-center justify-between">
        <h1 className={`text-2xl font-bold ${primaryTextClassName}`}>{copy.title}</h1>
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
        {rangeItems.map((item) => (
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

      <section data-coachmark-target="progress_consistency_card" className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            data-coachmark-target="progress_total_volume_card"
            onClick={onViewTrainingVolume}
            className={`min-h-[8.75rem] rounded-[1.35rem] border p-4 text-left transition-colors focus-visible:outline focus-visible:outline-2 ${
              isGirlsTheme
                ? 'border-[#E2B4BD]/45 bg-white/75 shadow-[0_14px_32px_rgba(226,180,189,0.15)] focus-visible:outline-[#F9B2D7]'
                : 'border-white/8 bg-[#101824] shadow-[0_14px_32px_rgba(0,0,0,0.18)] focus-visible:outline-accent'
            }`}
          >
            <div className={`text-[10px] font-semibold uppercase tracking-[0.18em] ${tertiaryTextClassName}`}>{copy.volumeRange(selectedRange.label)}</div>
            <div className={`mt-3 flex items-end gap-1 ${primaryTextClassName}`}>
              <span className="font-electrolize text-3xl font-bold leading-none">{formatTrainingVolume(totalVolumeKg).split(' ')[0]}</span>
              <span className={`pb-0.5 text-sm font-semibold ${secondaryTextClassName}`}>{formatTrainingVolume(totalVolumeKg).split(' ')[1] || 'kg'}</span>
            </div>
            <div className={`mt-5 ${secondaryTextClassName}`}>
              <MiniSparkline values={volumeSparkValues} tone={isGirlsTheme ? 'girls' : 'default'} />
            </div>
          </button>

          <div className={`min-h-[8.75rem] rounded-[1.35rem] border p-4 ${
            isGirlsTheme
              ? 'border-[#E2B4BD]/45 bg-white/75 shadow-[0_14px_32px_rgba(226,180,189,0.15)]'
              : 'border-white/8 bg-[#101824] shadow-[0_14px_32px_rgba(0,0,0,0.18)]'
          }`}>
            <div className={`text-[10px] font-semibold uppercase tracking-[0.18em] ${tertiaryTextClassName}`}>{copy.weight}</div>
            <div className={`mt-3 font-electrolize text-3xl font-bold leading-none ${primaryTextClassName}`}>{currentStrengthText}</div>
            <div className={`mt-3 text-xs ${secondaryTextClassName}`}>{currentStrengthText === '-' ? copy.addYours : copy.estimated1RM}</div>
            <div className={`mt-6 text-xs ${tertiaryTextClassName}`}>{copy.change}: {strengthChangeText}</div>
          </div>
        </div>

        <div className={`rounded-[1.35rem] border p-4 ${
          isGirlsTheme
            ? 'border-[#E2B4BD]/45 bg-white/75 shadow-[0_14px_32px_rgba(226,180,189,0.15)]'
            : 'border-white/8 bg-[#101824] shadow-[0_14px_32px_rgba(0,0,0,0.18)]'
        }`}>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className={`text-[10px] font-semibold uppercase tracking-[0.18em] ${tertiaryTextClassName}`}>{copy.regularity}</div>
            <div className="flex items-center gap-1.5">
              {heatmapTone.slice(1).map((tone) => (
                <span key={tone} className={`h-2.5 w-2.5 rounded-[3px] ${tone}`} aria-hidden="true" />
              ))}
            </div>
          </div>
          <div className="grid grid-cols-[1rem_1fr] gap-3">
            <div className={`grid grid-rows-7 gap-2 text-[10px] ${tertiaryTextClassName}`}>
              {heatmapLabels.map((label, index) => (
                <span key={`${label}-${index}`} className="flex h-5 items-center">{label}</span>
              ))}
            </div>
            <div className="grid grid-flow-col grid-rows-7 gap-2">
              {regularityCells.map((cell) => (
                <span
                  key={cell.key}
                  title={`${cell.key}: ${cell.sets} ${copy.heatmapSets}`}
                  className={`h-5 rounded ${cell.inWindow ? heatmapTone[cell.level] : 'bg-transparent'}`}
                  aria-hidden="true"
                />
              ))}
            </div>
          </div>
          <div className={`mt-4 flex items-center justify-between gap-3 text-xs ${secondaryTextClassName}`}>
            <span className="inline-flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full ${isGirlsTheme ? 'bg-[#F9B2D7]' : 'bg-accent'}`} aria-hidden="true" />
              {streakText}
            </span>
            <span className={tertiaryTextClassName}>{weekGoalText}</span>
          </div>
        </div>

      </section>

      <DashboardMuscleMapCard
        mode={bodyMapMode}
        onModeChange={setBodyMapMode}
        levels={dashboardBodyMapLevels}
        overdueMuscles={overdueRecoveryMuscles}
        selectedMuscle={selectedBodyMapMuscle}
        onMuscleSelect={handleBodyMapMuscleSelect}
        onClearSelection={() => setSelectedBodyMapMuscle(null)}
        body={isGirlsTheme ? 'female' : undefined}
        copy={copy}
        language={language}
        isGirlsTheme={isGirlsTheme}
      />

      {isGirlsTheme ? <GirlsPeriodCarousel language={language} /> : null}

      <DashboardMuscleRadarCard
        distribution={bodyMapDistributions.thirtyDays}
        selectedMuscle={selectedRadarMuscle}
        onMuscleSelect={setSelectedRadarMuscle}
        onClearSelection={() => setSelectedRadarMuscle(null)}
        body={isGirlsTheme ? 'female' : undefined}
        copy={copy}
        language={language}
        isGirlsTheme={isGirlsTheme}
      />

      <Card coachmarkTargetId="progress_overload_card" className={isGirlsTheme ? 'p-4 !border-[#F9B2D7]/45 !bg-[linear-gradient(135deg,rgba(249,178,215,0.25),rgba(255,255,255,0.78)_46%,rgba(207,236,243,0.30))] !shadow-[0_18px_42px_rgba(249,178,215,0.18)] ring-1 ring-white/45' : 'p-4'}>
        <p className={`text-[11px] font-bold uppercase tracking-[0.16em] ${accentTextClassName}`}>{copy.nextStep}</p>
        {overloadRecommendation ? (
          <>
            <h3 className={`mt-2 text-lg font-semibold ${primaryTextClassName}`}>{copy.nextOverloadReady}</h3>
            <p className={`mt-1 text-sm ${secondaryTextClassName}`}>{overloadRecommendation}</p>
          </>
        ) : (
          <>
            <h3 className={`mt-2 text-lg font-semibold ${primaryTextClassName}`}>{copy.keepLoggingSets}</h3>
            <p className={`mt-1 text-sm ${secondaryTextClassName}`}>{copy.overloadLocked}</p>
          </>
        )}
        <button
          type="button"
          onClick={() => {
            setAppliedOverloadName(null);
            setShowOverloadModal(true);
          }}
          className={`mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl px-4 text-sm font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${accentButtonClassName} ${isGirlsTheme ? 'focus-visible:outline-[#F9B2D7]' : 'focus-visible:outline-accent'}`}
        >
          <PlayCircle size={18} aria-hidden="true" />
          {copy.getIt}
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
          {copy.viewBiWeeklyReport}
        </span>
        <ChevronRight size={18} className={secondaryTextClassName} aria-hidden="true" />
      </button>

      {appliedOverloadName && (
        <div className={`rounded-2xl border px-4 py-3 text-sm ${isGirlsTheme ? 'border-[#E2B4BD]/45 bg-white/75 text-[#795E67] shadow-[0_12px_28px_rgba(226,180,189,0.12)]' : 'border-accent/25 bg-accent/10 text-text-primary'}`}>
          {copy.overloadApplied}
        </div>
      )}

      {showOverloadModal && typeof document !== 'undefined' && createPortal(
        <div
          className={`fixed inset-0 z-[170] flex items-end justify-center overflow-y-auto px-4 pb-4 pt-[calc(env(safe-area-inset-top,0px)+0.75rem)] sm:items-center sm:py-8 ${isGirlsTheme ? 'bg-[#4A4A4A]/35 backdrop-blur-sm' : 'bg-black/65'}`}
          onClick={() => setShowOverloadModal(false)}
          role="presentation"
        >
          <div
            className={`w-full max-w-lg max-h-[calc(100dvh-1.5rem)] overflow-y-auto rounded-[1.75rem] border p-5 shadow-2xl ${isGirlsTheme ? 'border-[#E2B4BD]/55 bg-[#FFF5F5] text-[#4A4A4A]' : 'border-white/10 bg-card text-text-primary'}`}
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={copy.overloadModalTitle}
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h3 className={`text-lg font-bold ${primaryTextClassName}`}>{copy.overloadModalTitle}</h3>
                <p className={`mt-1 text-sm leading-6 ${secondaryTextClassName}`}>{copy.overloadModalSubtitle}</p>
              </div>
              <button
                type="button"
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-colors ${isGirlsTheme ? 'border-[#E2B4BD]/45 bg-white/70 text-[#795E67] hover:text-[#4A4A4A]' : 'border-white/10 text-text-secondary hover:border-accent/30 hover:text-text-primary'}`}
                onClick={() => setShowOverloadModal(false)}
                aria-label={copy.close}
              >
                <X size={15} />
              </button>
            </div>

            {overloadRecommendations.length > 0 ? (
              <div className="space-y-3">
                {overloadRecommendations.map((recommendation) => (
                  <div
                    key={`${recommendation.name}-${recommendation.current}-${recommendation.next}`}
                    className={`flex items-center gap-3 rounded-2xl border p-3 ${isGirlsTheme ? 'border-[#E2B4BD]/45 bg-white/70 shadow-[0_10px_24px_rgba(226,180,189,0.12)]' : 'border-white/10 bg-white/[0.04]'}`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className={`truncate text-sm font-bold ${primaryTextClassName}`}>{recommendation.name}</div>
                      <div className={`mt-1 text-xs ${secondaryTextClassName}`}>
                        {recommendation.current} <span aria-hidden="true">-&gt;</span> {recommendation.next}
                      </div>
                    </div>
                    <button
                      type="button"
                      className={`min-h-10 shrink-0 rounded-xl px-4 text-xs font-bold transition-colors ${isGirlsTheme ? 'bg-[linear-gradient(135deg,#F9B2D7,#E2B4BD)] text-[#4A4A4A] shadow-[0_10px_22px_rgba(249,178,215,0.24)] hover:brightness-[1.02]' : 'bg-accent text-black hover:bg-accent/90'}`}
                      onClick={() => handleApplyOverload(recommendation)}
                    >
                      {copy.getIt}
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className={`rounded-2xl border px-4 py-5 text-sm ${isGirlsTheme ? 'border-[#E2B4BD]/45 bg-white/70 text-[#795E67]' : 'border-white/10 bg-white/[0.04] text-text-secondary'}`}>
                {copy.overloadLocked}
              </div>
            )}
          </div>
        </div>,
        document.body,
      )}

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
