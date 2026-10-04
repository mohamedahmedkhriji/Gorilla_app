import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Header } from '../ui/Header';
import { Play, Square, BarChart3, Video, Trash2 } from 'lucide-react';
import { api } from '../../services/api';
import { LocalizedLanguageRecord, getActiveLanguage, getStoredLanguage } from '../../services/language';
import { stripExercisePrefix } from '../../services/exerciseName';
import { buildT3OverloadAdvice } from '../../services/t3Overload';

interface TrackerScreenProps {
  onBack: () => void;
  exerciseName: string;
  plannedSets?: number;
  plannedReps?: string;
  targetRpe?: number | null;
  overloadStrategy?: 't3' | null;
  onVideoClick?: (exerciseName: string) => void;
  savedSets?: SetData[];
  onSaveSets?: (sets: SetData[]) => void;
  onRemoveExercise?: () => Promise<void> | void;
}

interface SetData {
  set: number;
  reps: number;
  weight: number;
  completed: boolean;
  duration?: number;
  restTime?: number;
}

const DEFAULT_SET_TEMPLATE: Array<{ reps: number; weight: number }> = [
  { reps: 11, weight: 70 },
  { reps: 10, weight: 75 },
  { reps: 8, weight: 80 },
  { reps: 8, weight: 80 },
];
const PENDING_OVERLOAD_STORAGE_KEY = 'repset:pending-overload-targets';
const REST_WINDOW_MIN_SECONDS = 60;
const REST_WINDOW_MAX_SECONDS = 120;
const LCD_SEGMENTS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;

type PendingOverloadTarget = {
  name?: string;
  normalizedName?: string;
  current?: string;
  next?: string;
};

const normalizeOverloadExerciseName = (value: unknown) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const parseFirstNumber = (value: unknown) => {
  const match = String(value || '').match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
};

const readPendingOverloadTarget = (exerciseName: string): PendingOverloadTarget | null => {
  if (typeof window === 'undefined') return null;
  const normalizedName = normalizeOverloadExerciseName(exerciseName);
  if (!normalizedName) return null;

  try {
    const targets = JSON.parse(localStorage.getItem(PENDING_OVERLOAD_STORAGE_KEY) || '{}') || {};
    const direct = targets[normalizedName];
    if (direct) return direct;

    const matchedKey = Object.keys(targets).find((key) => (
      key === normalizedName
      || key.includes(normalizedName)
      || normalizedName.includes(key)
    ));
    return matchedKey ? targets[matchedKey] : null;
  } catch {
    return null;
  }
};

const consumePendingOverloadTarget = (exerciseName: string) => {
  if (typeof window === 'undefined') return;
  const normalizedName = normalizeOverloadExerciseName(exerciseName);
  if (!normalizedName) return;

  try {
    const targets = JSON.parse(localStorage.getItem(PENDING_OVERLOAD_STORAGE_KEY) || '{}') || {};
    const matchedKey = Object.keys(targets).find((key) => (
      key === normalizedName
      || key.includes(normalizedName)
      || normalizedName.includes(key)
    ));
    if (!matchedKey) return;
    delete targets[matchedKey];
    localStorage.setItem(PENDING_OVERLOAD_STORAGE_KEY, JSON.stringify(targets));
  } catch {
    // Ignore malformed local data.
  }
};

const applyPendingOverloadToSets = (sourceSets: SetData[], target: PendingOverloadTarget | null) => {
  if (!target || !Array.isArray(sourceSets) || sourceSets.length === 0) return sourceSets;
  const nextText = String(target.next || '').toLowerCase();
  const currentText = String(target.current || '').toLowerCase();
  const delta = parseFirstNumber(nextText);
  if (delta == null || delta <= 0) return sourceSets;

  const isRepTarget = nextText.includes('rep') || currentText.includes('rep');
  const isWeightTarget = nextText.includes('kg') || currentText.includes('kg');
  const currentValue = parseFirstNumber(target.current);
  const targetValue = currentValue != null ? currentValue + delta : delta;

  return sourceSets.map((set) => {
    if (set.completed) return set;
    if (isRepTarget) return { ...set, reps: Math.max(0, Math.round(targetValue)) };
    if (isWeightTarget) return { ...set, weight: Math.max(0, Number(targetValue.toFixed(1))) };
    return set;
  });
};

const renderLcdDigits = (value: string) => (
  value.split('').map((digit, index) => (
    digit === ':' ? (
      <span className="lcd-colon" aria-hidden="true" key={`colon-${index}`} />
    ) : (
      <span className="lcd-digit" data-digit={digit} aria-hidden="true" key={`${digit}-${index}`}>
        {LCD_SEGMENTS.map((segment) => (
          <span key={segment} className={`lcd-segment seg-${segment}`} />
        ))}
      </span>
    )
  ))
);

const getBarbellPlateSet = (weight: number) => {
  const safeWeight = Number.isFinite(weight) ? Math.max(0, weight) : 0;
  if (safeWeight > 50) {
    return [
      { key: 'heavy-teal', x: 10, width: 15, height: 36, fill: 'url(#barbellTeal)' },
      { key: 'heavy-gold', x: 25, width: 8, height: 32, fill: 'url(#barbellGold)' },
      { key: 'heavy-red', x: 33, width: 9, height: 35, fill: 'url(#barbellRed)' },
    ];
  }

  if (safeWeight >= 20) {
    return [
      { key: 'medium-teal', x: 13, width: 15, height: 35, fill: 'url(#barbellTeal)' },
      { key: 'medium-gold', x: 28, width: 9, height: 30, fill: 'url(#barbellGold)' },
    ];
  }

  return [
    { key: 'light-teal', x: 18, width: 16, height: 34, fill: 'url(#barbellTeal)' },
  ];
};

function BarbellSliderThumb({ weight }: { weight: number }) {
  const plates = getBarbellPlateSet(weight);
  const collarX = Math.max(...plates.map((plate) => plate.x + plate.width)) + 2;

  return (
    <svg className="barbell-thumb-svg" viewBox="0 0 92 46" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="barbellSteel" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#7b8491" />
          <stop offset="0.42" stopColor="#f3f6f9" />
          <stop offset="1" stopColor="#8c96a3" />
        </linearGradient>
        <linearGradient id="barbellDarkSteel" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#394150" />
          <stop offset="0.48" stopColor="#d8dde5" />
          <stop offset="1" stopColor="#404958" />
        </linearGradient>
        <linearGradient id="barbellTeal" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#08959c" />
          <stop offset="1" stopColor="#05656e" />
        </linearGradient>
        <linearGradient id="barbellGold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffd84f" />
          <stop offset="1" stopColor="#d69a11" />
        </linearGradient>
        <linearGradient id="barbellBlue" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2f7fd7" />
          <stop offset="1" stopColor="#1e4f9a" />
        </linearGradient>
        <linearGradient id="barbellRed" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#e44755" />
          <stop offset="1" stopColor="#a91f2e" />
        </linearGradient>
      </defs>
      <ellipse cx="30" cy="40" rx="23" ry="4" fill="rgba(0,0,0,0.22)" />
      <rect x={collarX + 2} y="21" width="50" height="4" rx="2" fill="url(#barbellSteel)" />
      <rect x={collarX - 1} y="15" width="8" height="16" rx="3" fill="url(#barbellDarkSteel)" />
      <circle cx={collarX + 3} cy="23" r="5.5" fill="url(#barbellSteel)" stroke="rgba(255,255,255,0.62)" strokeWidth="0.8" />
      {plates.map((plate) => (
        <rect
          key={plate.key}
          x={plate.x}
          y={(46 - plate.height) / 2}
          width={plate.width}
          height={plate.height}
          rx="3"
          fill={plate.fill}
          stroke="rgba(5,12,20,0.38)"
          strokeWidth="0.8"
        />
      ))}
      <rect x={collarX - 7} y="13" width="6" height="20" rx="2.5" fill="url(#barbellSteel)" stroke="rgba(5,12,20,0.25)" strokeWidth="0.7" />
      <circle cx="13" cy="23" r="2.5" fill="#141922" stroke="#d9e0e8" strokeWidth="0.8" />
      <circle cx="7" cy="20" r="2.2" fill="#141922" stroke="#d9e0e8" strokeWidth="0.8" />
      <circle cx="7" cy="26" r="2.2" fill="#141922" stroke="#d9e0e8" strokeWidth="0.8" />
      <path d="M14 17c4-4 9-6 15-6" stroke="rgba(255,255,255,0.34)" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

type HistorySetRow = {
  setNumber: number;
  reps: number;
  weight: number;
  duration: number;
  restTime: number;
  dateKey: string;
  timestamp: number;
};

type AnalyticsRange = 'week' | '30d' | '90d' | 'all';

type ExerciseChartPoint = {
  dateKey: string;
  timestamp: number;
  volume: number;
  maxWeight: number;
  workTime: number;
  restTime: number;
  sets: number;
};

const toDateKey = (value: unknown) => {
  if (!value) return '';
  const parsed = new Date(value as string);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString().slice(0, 10);
};

const normalizeHistoryRows = (rows: any[]): HistorySetRow[] => {
  if (!Array.isArray(rows)) return [];

  return rows
    .map((row: any, index: number) => {
      const completedFlag = Number(row?.completed ?? 1);
      if (completedFlag === 0) return null;

      const createdAt = row?.created_at || row?.createdAt || row?.date || row?.createdAtUtc || null;
      const timestamp = createdAt ? new Date(createdAt).getTime() : 0;
      const dateKey = toDateKey(createdAt);
      const setNumber = Number(row?.setNumber ?? row?.set_number ?? row?.set ?? index + 1);
      const reps = Number(row?.reps ?? 0);
      const weight = Number(row?.weight ?? 0);
      const duration = Number(row?.duration ?? row?.durationSeconds ?? row?.workTime ?? 0);
      const restTime = Number(row?.restTime ?? row?.rest_time ?? row?.restSeconds ?? 0);

      if (!Number.isFinite(reps) && !Number.isFinite(weight)) return null;

      return {
        setNumber: Number.isFinite(setNumber) && setNumber > 0 ? setNumber : index + 1,
        reps: Number.isFinite(reps) ? reps : 0,
        weight: Number.isFinite(weight) ? weight : 0,
        duration: Number.isFinite(duration) ? Math.max(0, Math.round(duration)) : 0,
        restTime: Number.isFinite(restTime) ? Math.max(0, Math.round(restTime)) : 0,
        dateKey,
        timestamp: Number.isFinite(timestamp) ? timestamp : 0,
      };
    })
    .filter(Boolean) as HistorySetRow[];
};

const getLatestHistorySets = (rows: any[]): HistorySetRow[] => {
  const normalized = normalizeHistoryRows(rows);
  if (normalized.length === 0) return [];

  const sortedByTime = [...normalized].sort((a, b) => {
    if (b.timestamp !== a.timestamp) return b.timestamp - a.timestamp;
    return a.setNumber - b.setNumber;
  });

  const latestDateKey = sortedByTime[0]?.dateKey;
  const latestGroup = latestDateKey
    ? sortedByTime.filter((row) => row.dateKey === latestDateKey)
    : sortedByTime;

  return latestGroup.sort((a, b) => a.setNumber - b.setNumber || a.timestamp - b.timestamp);
};

const buildPrefilledSets = (plannedSets: number | undefined, historySets: HistorySetRow[]) => {
  const requested = Number(plannedSets);
  const setCount = Number.isFinite(requested) && requested > 0
    ? Math.max(1, Math.round(requested))
    : (historySets.length || DEFAULT_SET_TEMPLATE.length);

  const fallbackHistory = historySets.length > 0 ? historySets[historySets.length - 1] : null;

  return Array.from({ length: setCount }, (_, index) => {
    const template = DEFAULT_SET_TEMPLATE[index] || DEFAULT_SET_TEMPLATE[DEFAULT_SET_TEMPLATE.length - 1];
    const history = historySets[index] || fallbackHistory;
    const reps = Number(history?.reps ?? template.reps);
    const weight = Number(history?.weight ?? template.weight);

    return {
      set: index + 1,
      reps: Number.isFinite(reps) ? Math.max(0, Math.round(reps)) : template.reps,
      weight: Number.isFinite(weight) ? Math.max(0, weight) : template.weight,
      completed: false,
    };
  });
};

const todayDateKey = () => new Date().toISOString().slice(0, 10);

const getRangeStartTimestamp = (range: AnalyticsRange) => {
  if (range === 'all') return 0;
  const days = range === 'week' ? 7 : range === '30d' ? 30 : 90;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));
  return start.getTime();
};

const formatChartDate = (dateKey: string) => {
  const parsed = new Date(`${dateKey}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return dateKey;
  return parsed.toLocaleDateString(undefined, { day: '2-digit', month: 'short' });
};

const buildExerciseChartPoints = (rows: HistorySetRow[], range: AnalyticsRange): ExerciseChartPoint[] => {
  const startTimestamp = getRangeStartTimestamp(range);
  const byDate = new Map<string, ExerciseChartPoint>();

  rows.forEach((row) => {
    const dateKey = row.dateKey || (row.timestamp ? new Date(row.timestamp).toISOString().slice(0, 10) : '');
    if (!dateKey) return;
    const timestamp = row.timestamp || new Date(`${dateKey}T00:00:00`).getTime();
    if (startTimestamp && timestamp < startTimestamp) return;

    const current = byDate.get(dateKey) || {
      dateKey,
      timestamp,
      volume: 0,
      maxWeight: 0,
      workTime: 0,
      restTime: 0,
      sets: 0,
    };

    current.timestamp = Math.max(current.timestamp, timestamp);
    current.volume += Math.max(0, row.reps) * Math.max(0, row.weight);
    current.maxWeight = Math.max(current.maxWeight, Math.max(0, row.weight));
    current.workTime += Math.max(0, row.duration);
    current.restTime += Math.max(0, row.restTime);
    current.sets += 1;
    byDate.set(dateKey, current);
  });

  return Array.from(byDate.values()).sort((left, right) => left.timestamp - right.timestamp);
};

const buildChartPath = (points: ExerciseChartPoint[]) => {
  const width = 340;
  const height = 130;
  const left = 34;
  const right = 328;
  const top = 14;
  const bottom = 108;
  const values = points.map((point) => point.volume);
  const minValue = Math.min(...values, 0);
  const maxValue = Math.max(...values, 1);
  const span = Math.max(1, maxValue - minValue);

  const coords = points.map((point, index) => {
    const x = points.length === 1 ? right : left + ((right - left) * index) / (points.length - 1);
    const y = bottom - ((point.volume - minValue) / span) * (bottom - top);
    return { ...point, x, y };
  });

  const polyline = coords.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ');
  const area = coords.length
    ? `${left},${bottom} ${polyline} ${coords[coords.length - 1].x.toFixed(1)},${bottom}`
    : '';

  return { width, height, left, right, top, bottom, minValue, maxValue, coords, polyline, area };
};

const TRACKER_I18N: LocalizedLanguageRecord<{
  title: string;
  removeExerciseAria: string;
  timerAria: (timer: string) => string;
  backToTracker: string;
  workoutAnalytics: string;
  totalWorkTime: string;
  totalRestTime: string;
  totalVolume: string;
  setsCompleted: string;
  chartEmpty: string;
  rangeWeek: string;
  range30d: string;
  range90d: string;
  rangeAll: string;
  heaviestWeight: string;
  intensity: string;
  setDetails: string;
  setLabel: string;
  repsLabel: string;
  weightLabel: string;
  unitLabel: string;
  workLabel: string;
  restLabel: string;
  video: string;
  analytics: string;
  restTimerLabel: (time: string) => string;
  restTarget: string;
  restExceeded: string;
  dismiss: string;
  allSetsCompleted: string;
  effectiveSets: string;
  delete: string;
  addSet: string;
  setNumber: (value: number) => string;
  repsTimesWeight: (reps: number, weight: number, unit: string) => string;
  setWeightAria: (value: number) => string;
  removeTitle: string;
  removeBody: (name: string) => string;
  removeFootnote: string;
  cancel: string;
  remove: string;
  removing: string;
  removeErrorFallback: string;
  restNotificationTitle: string;
  restExceededNotification: (name: string, nextSet: number) => string;
}> = {
  en: {
    title: 'The Tracker',
    removeExerciseAria: 'Remove exercise',
    timerAria: (timer) => `Set timer ${timer}`,
    backToTracker: 'Back to Tracker',
    workoutAnalytics: 'Workout Analytics',
    totalWorkTime: 'Total Work Time',
    totalRestTime: 'Total Rest Time',
    totalVolume: 'Total Volume',
    setsCompleted: 'Sets Completed',
    chartEmpty: 'Complete sets over time to build your exercise chart.',
    rangeWeek: 'Week',
    range30d: '30d',
    range90d: '90d',
    rangeAll: 'All',
    heaviestWeight: 'Heaviest weight',
    intensity: 'Intensity',
    setDetails: 'Set Details',
    setLabel: 'Set',
    repsLabel: 'Reps',
    weightLabel: 'Weight',
    unitLabel: 'kg',
    workLabel: 'Work',
    restLabel: 'Rest',
    video: 'Video',
    analytics: 'Analytics',
    restTimerLabel: (time) => `Rest Timer: ${time}`,
    restTarget: 'Target 01:00 - 02:00',
    restExceeded: 'Rest is over 2 minutes. Start your next set.',
    dismiss: 'Dismiss',
    allSetsCompleted: 'All sets are completed for this exercise.',
    effectiveSets: 'Effective sets',
    delete: 'Delete',
    addSet: 'Add Set',
    setNumber: (value) => `Set ${value}`,
    repsTimesWeight: (reps, weight, unit) => `${reps} reps × ${weight} ${unit}`,
    setWeightAria: (value) => `Set ${value} weight`,
    removeTitle: 'Remove Exercise?',
    removeBody: (name) => `${name} will be removed from today's workout.`,
    removeFootnote: 'This updates your workout plan immediately.',
    cancel: 'Cancel',
    remove: 'Remove',
    removing: 'Removing...',
    removeErrorFallback: 'Failed to remove exercise.',
    restNotificationTitle: 'RepSet Rest Timer',
    restExceededNotification: (name, nextSet) =>
      `Rest exceeded 2:00 on ${name}. Start set ${nextSet} now.`,
  },
  ar: {
    title: 'المتتبع',
    removeExerciseAria: 'إزالة التمرين',
    timerAria: (timer) => `مؤقت المجموعة ${timer}`,
    backToTracker: 'العودة إلى المتتبع',
    workoutAnalytics: 'تحليلات التمرين',
    totalWorkTime: 'إجمالي وقت العمل',
    totalRestTime: 'إجمالي وقت الراحة',
    totalVolume: 'إجمالي الحجم',
    setsCompleted: 'المجموعات المكتملة',
    chartEmpty: 'أكمل المجموعات بمرور الوقت لبناء رسم التقدم.',
    rangeWeek: 'أسبوع',
    range30d: '30ي',
    range90d: '90ي',
    rangeAll: 'الكل',
    heaviestWeight: 'أعلى وزن',
    intensity: 'الشدة',
    setDetails: 'تفاصيل المجموعات',
    setLabel: 'المجموعة',
    repsLabel: 'التكرارات',
    weightLabel: 'الوزن',
    unitLabel: 'كجم',
    workLabel: 'عمل',
    restLabel: 'راحة',
    video: 'فيديو',
    analytics: 'تحليلات',
    restTimerLabel: (time) => `مؤقت الراحة: ${time}`,
    restTarget: 'الهدف 01:00 - 02:00',
    restExceeded: 'تجاوزت الراحة دقيقتين. ابدأ مجموعتك التالية.',
    dismiss: 'إخفاء',
    allSetsCompleted: 'تم إكمال جميع المجموعات لهذا التمرين.',
    effectiveSets: 'المجموعات الفعالة',
    delete: 'حذف',
    addSet: 'أضف مجموعة',
    setNumber: (value) => `المجموعة ${value}`,
    repsTimesWeight: (reps, weight, unit) => `${reps} تكرار × ${weight} ${unit}`,
    setWeightAria: (value) => `وزن المجموعة ${value}`,
    removeTitle: 'إزالة التمرين؟',
    removeBody: (name) => `سيتم إزالة ${name} من تمرين اليوم.`,
    removeFootnote: 'سيتم تحديث خطة التمرين فورًا.',
    cancel: 'إلغاء',
    remove: 'إزالة',
    removing: 'جارٍ الإزالة...',
    removeErrorFallback: 'تعذر إزالة التمرين.',
    restNotificationTitle: 'مؤقت الراحة',
    restExceededNotification: (name, nextSet) =>
      `تجاوزت الراحة دقيقتين في ${name}. ابدأ المجموعة ${nextSet} الآن.`,
  },
};

const createInitialSets = (plannedSets?: number): SetData[] => {
  const requested = Number(plannedSets);
  const setCount = Number.isFinite(requested) && requested > 0
    ? Math.max(1, Math.round(requested))
    : DEFAULT_SET_TEMPLATE.length;

  return Array.from({ length: setCount }, (_, index) => {
    const template = DEFAULT_SET_TEMPLATE[index] || DEFAULT_SET_TEMPLATE[DEFAULT_SET_TEMPLATE.length - 1];
    return {
      set: index + 1,
      reps: template.reps,
      weight: template.weight,
      completed: false,
    };
  });
};

const isGirlsStyleValue = (value: unknown) => {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === 'woman' || normalized === 'female' || normalized === 'f' || normalized === 'girl' || normalized === 'girls' || normalized === 'femme';
};

const safeParseStoredJson = (key: string) => {
  try {
    const rawValue = localStorage.getItem(key);
    return rawValue ? JSON.parse(rawValue) : null;
  } catch {
    return null;
  }
};

const readStoredStyleGender = () => {
  if (typeof window === 'undefined') return '';
  return String(localStorage.getItem('appStyleGender') || '').trim().toLowerCase();
};

const shouldUseGirlsTheme = () => {
  if (typeof window === 'undefined') return false;
  const profile = safeParseStoredJson('onboardingProfile');
  const storedUser = safeParseStoredJson('appUser') || safeParseStoredJson('user');
  const explicitGender = String(storedUser?.gender || profile?.gender || '').trim().toLowerCase();
  if (explicitGender === 'man' || explicitGender === 'male' || explicitGender === 'm') return false;
  const styleGender = readStoredStyleGender();
  if (styleGender) return isGirlsStyleValue(styleGender);
  return isGirlsStyleValue(storedUser?.gender) || isGirlsStyleValue(profile?.gender) || profile?.onboardingTheme === 'girls';
};

export function TrackerScreen({
  onBack,
  exerciseName,
  plannedSets,
  plannedReps,
  targetRpe,
  overloadStrategy,
  onVideoClick,
  savedSets,
  onSaveSets,
  onRemoveExercise,
}: TrackerScreenProps) {
  const user = JSON.parse(localStorage.getItem('appUser') || localStorage.getItem('user') || '{}');
  const userId = Number(user?.id || 0);
  const language = getActiveLanguage(getStoredLanguage());
  const isArabic = language === 'ar';
  const copy = TRACKER_I18N[isArabic ? 'ar' : 'en'];
  const displayExerciseName = stripExercisePrefix(exerciseName);
  const [sets, setSets] = useState<SetData[]>(() => {
    if (savedSets && savedSets.length > 0) return savedSets;
    return createInitialSets(plannedSets);
  });
  const unit: 'kg' | 'lbs' = 'kg';
  const unitLabel = copy.unitLabel || unit;
  const [isRunning, setIsRunning] = useState(false);
  const [setTimerSeconds, setSetTimerSeconds] = useState(0);
  const [swipedIndex, setSwipedIndex] = useState<number | null>(null);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [analyticsRange, setAnalyticsRange] = useState<AnalyticsRange>('week');
  const [historyRows, setHistoryRows] = useState<HistorySetRow[]>([]);
  const [isResting, setIsResting] = useState(false);
  const [restTime, setRestTime] = useState(0);
  const [restReminderText, setRestReminderText] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [isRemovingExercise, setIsRemovingExercise] = useState(false);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [styleGender, setStyleGender] = useState(() => readStoredStyleGender());
  const isGirlsTheme = useMemo(() => shouldUseGirlsTheme(), [styleGender]);
  const restReminderLock = useRef(false);
  const setTimerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const restTimerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const historyLoadIdRef = useRef(0);
  const hasLocalEditsRef = useRef(false);
  const [notificationSettings, setNotificationSettings] = useState({
    coachMessages: true,
    restTimer: true,
    missionChallenge: true,
  });

  useEffect(() => {
    const handleThemeChanged = () => {
      setStyleGender(readStoredStyleGender());
    };

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
    hasLocalEditsRef.current = false;
    const pendingOverloadTarget = readPendingOverloadTarget(exerciseName);
    if (savedSets && savedSets.length > 0) {
      const nextSets = applyPendingOverloadToSets(savedSets, pendingOverloadTarget);
      setSets(nextSets);
      if (pendingOverloadTarget && nextSets !== savedSets) {
        onSaveSets?.(nextSets);
        consumePendingOverloadTarget(exerciseName);
      }
      return;
    }
    const initialSets = createInitialSets(plannedSets);
    const nextSets = applyPendingOverloadToSets(initialSets, pendingOverloadTarget);
    setSets(nextSets);
    if (pendingOverloadTarget && nextSets !== initialSets) {
      onSaveSets?.(nextSets);
      consumePendingOverloadTarget(exerciseName);
    }
  }, [exerciseName, plannedSets, savedSets]);

  useEffect(() => {
    if (!userId) return;
    if (savedSets && savedSets.length > 0) return;
    if (!exerciseName) return;

    const currentLoadId = historyLoadIdRef.current + 1;
    historyLoadIdRef.current = currentLoadId;

    const loadHistory = async () => {
      try {
        const historyRows = await api.getWorkoutHistory(userId, exerciseName);
        if (historyLoadIdRef.current !== currentLoadId) return;
        const normalizedHistory = normalizeHistoryRows(Array.isArray(historyRows) ? historyRows : []);
        setHistoryRows(normalizedHistory);
        if (hasLocalEditsRef.current) return;

        const latestSets = getLatestHistorySets(normalizedHistory);
        if (latestSets.length === 0) return;

        const pendingOverloadTarget = readPendingOverloadTarget(exerciseName);
        const prefilled = applyPendingOverloadToSets(buildPrefilledSets(plannedSets, latestSets), pendingOverloadTarget);
        setSets(prefilled);
        onSaveSets?.(prefilled);
        if (pendingOverloadTarget) consumePendingOverloadTarget(exerciseName);
      } catch (error) {
        // Ignore history load failures, fallback to defaults.
        setHistoryRows([]);
      }
    };

    void loadHistory();
  }, [exerciseName, plannedSets, savedSets, userId, onSaveSets]);

  useEffect(() => {
    if (setTimerIntervalRef.current) {
      clearInterval(setTimerIntervalRef.current);
      setTimerIntervalRef.current = null;
    }

    if (isRunning) {
      setTimerIntervalRef.current = setInterval(() => {
        setSetTimerSeconds((prev) => prev + 1);
      }, 1000);
    }

    return () => {
      if (setTimerIntervalRef.current) {
        clearInterval(setTimerIntervalRef.current);
        setTimerIntervalRef.current = null;
      }
    };
  }, [isRunning]);

  useEffect(() => {
    if (restTimerIntervalRef.current) {
      clearInterval(restTimerIntervalRef.current);
      restTimerIntervalRef.current = null;
    }

    if (isResting) {
      restTimerIntervalRef.current = setInterval(() => {
        setRestTime((prev) => prev + 1);
      }, 1000);
    }

    return () => {
      if (restTimerIntervalRef.current) {
        clearInterval(restTimerIntervalRef.current);
        restTimerIntervalRef.current = null;
      }
    };
  }, [isResting]);

  useEffect(() => {
    const loadNotificationSettings = async () => {
      const cached = localStorage.getItem('notificationSettings');
      if (cached) {
        try {
          setNotificationSettings((prev) => ({ ...prev, ...JSON.parse(cached) }));
        } catch {
          // ignore malformed cache
        }
      }

      if (!userId) return;
      try {
        const remote = await api.getNotificationSettings(userId);
        const next = {
          coachMessages: !!remote?.coachMessages,
          restTimer: !!remote?.restTimer,
          missionChallenge: !!remote?.missionChallenge,
        };
        setNotificationSettings(next);
        localStorage.setItem('notificationSettings', JSON.stringify(next));
      } catch {
        // Keep defaults/cached values.
      }
    };

    void loadNotificationSettings();
  }, [userId]);

  const sendRestReminder = (message: string) => {
    if (!notificationSettings.restTimer) return;
    setRestReminderText(message);

    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(200);
    }

    if (typeof window === 'undefined' || !('Notification' in window)) return;

    const showBrowserNotification = () => {
      try {
        new Notification(copy.restNotificationTitle, {
          body: message,
          tag: 'rest-timeout-reminder',
        });
      } catch {
        // Ignore browser notification errors and keep the in-app reminder.
      }
    };

    if (Notification.permission === 'granted') {
      showBrowserNotification();
      return;
    }

    if (Notification.permission === 'default') {
      void Notification.requestPermission().then((permission) => {
        if (permission === 'granted') showBrowserNotification();
      }).catch(() => {
        // Ignore permission request failures.
      });
    }
  };

  useEffect(() => {
    if (!notificationSettings.restTimer) return;
    if (!isResting) return;
    if (restTime <= REST_WINDOW_MAX_SECONDS) return;
    if (restReminderLock.current) return;

    const nextSet = sets.find((set) => !set.completed)?.set;
    if (!nextSet) return;

    restReminderLock.current = true;
    sendRestReminder(copy.restExceededNotification(displayExerciseName, nextSet));
  }, [exerciseName, isResting, notificationSettings.restTimer, restTime, sets]);

  const persistSets = (nextSets: SetData[]) => {
    hasLocalEditsRef.current = true;
    setSets(nextSets);
    onSaveSets?.(nextSets);
  };

  const handleRemoveExercise = async () => {
    if (!onRemoveExercise || isRemovingExercise) return;

    try {
      setRemoveError(null);
      setIsRemovingExercise(true);
      await onRemoveExercise();
      setShowRemoveConfirm(false);
    } catch (error) {
      setRemoveError(error instanceof Error ? error.message : copy.removeErrorFallback);
    } finally {
      setIsRemovingExercise(false);
    }
  };

  const toggleTimer = () => {
    hasLocalEditsRef.current = true;
    if (isRunning) {
      const firstIncomplete = sets.findIndex(s => !s.completed);
      const setDuration = Math.max(0, setTimerSeconds);
      const completedRestTime = Math.max(0, restTime);

      // Stop the active set timer immediately before any async work.
      if (setTimerIntervalRef.current) {
        clearInterval(setTimerIntervalRef.current);
        setTimerIntervalRef.current = null;
      }
      setIsRunning(false);
      setSetTimerSeconds(0);

      if (firstIncomplete !== -1) {
        const newSets = [...sets];
        newSets[firstIncomplete].completed = true;
        newSets[firstIncomplete].duration = setDuration;
        newSets[firstIncomplete].restTime = completedRestTime;
        persistSets(newSets);

        // Save to database without blocking UI updates.
        if (user?.id) {
          const completedSet = newSets[firstIncomplete];

          void api.saveWorkoutSet({
              userId: user.id,
              exerciseName,
              setNumber: completedSet.set,
              reps: completedSet.reps,
              weight: completedSet.weight,
              duration: setDuration,
              restTime: completedRestTime,
              completed: true,
            }).then(() => {
            window.dispatchEvent(new CustomEvent('gamification-updated'));
            localStorage.setItem('recoveryNeedsUpdate', 'true');
            window.dispatchEvent(new CustomEvent('recovery-updated'));
          }).catch((error) => {
            console.error('Failed to save workout set:', error);
          });
        }

        const hasMoreSets = newSets.some((s) => !s.completed);
        setRestReminderText(null);
        restReminderLock.current = false;

        if (hasMoreSets) {
          // Start rest timer between sets immediately.
          if (restTimerIntervalRef.current) {
            clearInterval(restTimerIntervalRef.current);
            restTimerIntervalRef.current = null;
          }
          setRestTime(0);
          setIsResting(true);
        } else {
          // All sets done for this exercise.
          if (restTimerIntervalRef.current) {
            clearInterval(restTimerIntervalRef.current);
            restTimerIntervalRef.current = null;
          }
          setRestTime(0);
          setIsResting(false);
        }
      }
      return;
    } else {
      if (areAllSetsCompleted) {
        if (restTimerIntervalRef.current) {
          clearInterval(restTimerIntervalRef.current);
          restTimerIntervalRef.current = null;
        }
        setIsResting(false);
        setRestReminderText(null);
        restReminderLock.current = false;
        return;
      }

      // Stop rest timer and start set timer immediately.
      if (restTimerIntervalRef.current) {
        clearInterval(restTimerIntervalRef.current);
        restTimerIntervalRef.current = null;
      }
      setIsResting(false);
      setRestReminderText(null);
      restReminderLock.current = false;
      setSetTimerSeconds(0);
      setIsRunning(true);
      return;
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const updateSet = (index: number, field: 'reps' | 'weight', value: number) => {
    if (!sets[index] || sets[index].completed) return;
    const newSets = [...sets];
    newSets[index][field] = value;
    persistSets(newSets);
  };

  const removeSet = (index: number) => {
    const updated = sets.filter((_, i) => i !== index).map((s, i) => ({ ...s, set: i + 1 }));
    persistSets(updated);
    setSwipedIndex(null);
  };

  const handleTouchStart = (index: number, e: React.TouchEvent) => {
    if (!sets[index] || sets[index].completed) return;
    const touch = e.touches[0];
    (e.currentTarget as any).startX = touch.clientX;
  };

  const handleTouchMove = (index: number, e: React.TouchEvent) => {
    if (!sets[index] || sets[index].completed) return;
    const touch = e.touches[0];
    const startX = (e.currentTarget as any).startX;
    const diff = startX - touch.clientX;
    if (diff > 50) {
      setSwipedIndex(index);
    } else if (diff < -20) {
      setSwipedIndex(null);
    }
  };

  const getTotalVolume = () => sets.filter(s => s.completed).reduce((acc, set) => acc + (set.reps * set.weight), 0);
  const areAllSetsCompleted = sets.length > 0 && sets.every((set) => set.completed);
  const timerText = formatTime(setTimerSeconds);
  const restTimerText = formatTime(restTime);
  const firstIncompleteIndex = sets.findIndex((set) => !set.completed);
  const activeTimerText = isResting ? restTimerText : timerText;
  const timerRows = sets.map((set, index) => {
    const isActiveSet = isRunning && index === firstIncompleteIndex;
    const isRestAfterSet = isResting && index === firstIncompleteIndex - 1;
    const workSeconds = isActiveSet ? setTimerSeconds : Math.max(0, set.duration || 0);
    const restSeconds = isRestAfterSet ? restTime : Math.max(0, set.restTime || 0);

    return {
      set,
      label: `REP ${set.set}`,
      workText: formatTime(workSeconds),
      restText: formatTime(restSeconds),
      isActiveSet,
      isRestAfterSet,
      isDone: set.completed,
      workWidth: Math.max(8, Math.min(100, (workSeconds / 90) * 100)),
      restLeft: Math.max(0, Math.min(84, (workSeconds / 180) * 100)),
      restWidth: Math.max(10, Math.min(54, (restSeconds / 120) * 100)),
    };
  });
  const timelineTotalSeconds = timerRows.reduce((total, row) => total + Math.max(1, row.isActiveSet ? setTimerSeconds : row.set.duration || 0), 0);
  let timelineCursor = 0;
  const timelineSegments = timerRows.map((row) => {
    const seconds = Math.max(1, row.isActiveSet ? setTimerSeconds : row.set.duration || 0);
    const left = timelineTotalSeconds > 0 ? (timelineCursor / timelineTotalSeconds) * 100 : 0;
    const width = timelineTotalSeconds > 0 ? (seconds / timelineTotalSeconds) * 100 : 0;
    timelineCursor += seconds;

    return {
      key: row.set.set,
      left,
      width,
      isActive: row.isActiveSet,
      isDone: row.isDone,
    };
  });
  const completedSetRowsForChart = useMemo(() => sets
    .filter((set) => set.completed)
    .map((set) => ({
      setNumber: set.set,
      reps: Number(set.reps || 0),
      weight: Number(set.weight || 0),
      duration: Number(set.duration || 0),
      restTime: Number(set.restTime || 0),
      dateKey: todayDateKey(),
      timestamp: Date.now() + set.set,
    })), [sets]);
  const chartPoints = useMemo(
    () => buildExerciseChartPoints([...historyRows, ...completedSetRowsForChart], analyticsRange),
    [analyticsRange, historyRows, completedSetRowsForChart],
  );
  const chartPath = useMemo(() => buildChartPath(chartPoints), [chartPoints]);
  const t3OverloadAdvice = useMemo(() => (
    overloadStrategy === 't3'
      ? buildT3OverloadAdvice({ historyRows, plannedReps })
      : null
  ), [historyRows, overloadStrategy, plannedReps]);
  const latestChartPoint = chartPoints[chartPoints.length - 1] || null;
  const previousChartPoint = chartPoints[chartPoints.length - 2] || null;
  const volumeDelta = latestChartPoint && previousChartPoint
    ? latestChartPoint.volume - previousChartPoint.volume
    : 0;
  const rangeItems: Array<{ key: AnalyticsRange; label: string }> = [
    { key: 'week', label: copy.rangeWeek },
    { key: '30d', label: copy.range30d },
    { key: '90d', label: copy.range90d },
    { key: 'all', label: copy.rangeAll },
  ];

  const pageClassName = isGirlsTheme
    ? 'flex-1 flex flex-col h-full pb-24 bg-[radial-gradient(circle_at_top_left,rgba(249,178,215,0.22),transparent_34%),radial-gradient(circle_at_85%_8%,rgba(207,236,243,0.34),transparent_32%),linear-gradient(180deg,#FFF5F5_0%,#F7D6D0_52%,#FFF5F5_100%)] text-[#4A4A4A] [&_h1]:text-[#4A4A4A]'
    : 'flex-1 flex flex-col h-full bg-background pb-24';
  const removeButtonClassName = isGirlsTheme
    ? 'flex h-10 w-10 items-center justify-center rounded-xl border border-[#E2B4BD]/55 bg-white/70 text-[#A87884] backdrop-blur-md transition-colors hover:border-[#F9B2D7]/70 disabled:cursor-not-allowed disabled:opacity-60'
    : 'flex h-10 w-10 items-center justify-center rounded-xl border border-red-500/25 bg-[rgb(var(--color-card))]/80 text-red-400 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition-colors hover:border-red-500/45 hover:bg-red-500/12 disabled:cursor-not-allowed disabled:opacity-60';
  const mutedTextClassName = isGirlsTheme ? 'text-[#795E67]' : 'text-text-secondary';
  const tertiaryTextClassName = isGirlsTheme ? 'text-[#A87884]' : 'text-text-tertiary';
  const setInputClassName = isGirlsTheme
    ? 'rounded-full border border-[#E2B4BD]/45 bg-white/65 px-4 py-2 text-center font-semibold text-[#4A4A4A] outline-none focus:border-[#F9B2D7]/80 disabled:cursor-not-allowed disabled:border-[#E2B4BD]/25 disabled:text-[#A87884]'
    : 'bg-transparent rounded-full px-4 py-2 text-center text-white font-semibold border border-white/20 focus:border-accent outline-none disabled:cursor-not-allowed disabled:border-white/10 disabled:text-text-tertiary';

  return (
    <div className={pageClassName}>
      <div className="px-4 sm:px-6 pt-2">
        <Header
          title={displayExerciseName || copy.title}
          onBack={onBack}
          backButtonCoachmarkTargetId="workout_tracker_back_button"
          titleCoachmarkTargetId="workout_tracker_title"
          titleClassName={isArabic ? 'text-right' : ''}
          rightElement={onRemoveExercise ? (
            <button
              data-coachmark-target="workout_tracker_remove_button"
              type="button"
              onClick={() => {
                setShowRemoveConfirm(true);
              }}
              disabled={isRemovingExercise}
              className={removeButtonClassName}
              aria-label={copy.removeExerciseAria}
            >
              <Trash2 size={17} />
            </button>
          ) : undefined}
        />
      </div>
      <div className="px-4 sm:px-6 -mt-2 mb-2">
        <div className="w-full flex justify-center">
          <div
            className={`workout-timer-board ${isGirlsTheme ? 'workout-timer-board--girls' : ''}`}
            role="timer"
            aria-label={copy.timerAria(activeTimerText)}
            data-coachmark-target="workout_tracker_timer"
          >
            <div className="workout-timer-top">
              <span className="workout-timer-title">REP TIMERS</span>
            </div>
            <div className="workout-timer-tiles">
              {timerRows.map((row) => (
                <div
                  key={row.set.set}
                  className={`workout-timer-tile ${
                    row.isActiveSet ? 'is-active' : row.isRestAfterSet ? 'is-resting' : row.isDone ? 'is-done' : ''
                  }`}
                >
                  <span className="timer-label">{row.label}</span>
                  <span className="timer-value lcd" aria-label={row.workText}>{renderLcdDigits(row.workText)}</span>
                </div>
              ))}
            </div>
            <div className="workout-timeline-viewer" aria-hidden="true">
              {timelineSegments.map((segment) => (
                <div
                  key={segment.key}
                  className={`tl-child ${segment.isActive ? 'is-active' : ''} ${segment.isDone ? 'is-done' : ''}`}
                  style={{ left: `${segment.left}%`, width: `${segment.width}%` }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 sm:px-6 mt-6">
        {removeError && (
          <div className="mb-4 rounded-xl border border-red-500/35 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {removeError}
          </div>
        )}
        <h2 className={`mb-6 text-center text-2xl font-bold ${isGirlsTheme ? 'text-[#4A4A4A]' : 'text-white'}`}>{displayExerciseName}</h2>

        {showAnalytics ? (
          <div className="space-y-4 mb-8">
            <button onClick={() => setShowAnalytics(false)} className={`mb-4 text-sm ${isGirlsTheme ? 'text-[#A87884]' : 'text-accent'} ${isArabic ? 'text-right' : ''}`}>
              {copy.backToTracker}
            </button>
            <div className={`rounded-2xl border p-4 ${isGirlsTheme ? 'border-[#E2B4BD]/45 bg-white/70 shadow-[0_12px_28px_rgba(226,180,189,0.12)]' : 'border-white/10 bg-white/[0.03]'}`}>
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className={`text-lg font-bold ${isGirlsTheme ? 'text-[#4A4A4A]' : 'text-white'}`}>{displayExerciseName}</h3>
                  <p className={`mt-0.5 text-xs ${mutedTextClassName}`}>{copy.workoutAnalytics}</p>
                </div>
                <div className={`grid grid-cols-4 rounded-full border p-1 text-[11px] font-bold ${isGirlsTheme ? 'border-[#E2B4BD]/45 bg-white/65 text-[#795E67]' : 'border-white/10 bg-black/20 text-text-secondary'}`}>
                  {rangeItems.map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      aria-pressed={analyticsRange === item.key}
                      onClick={() => setAnalyticsRange(item.key)}
                      className={`min-h-8 rounded-full px-2 transition-colors ${
                        isGirlsTheme
                          ? analyticsRange === item.key ? 'bg-[#F9B2D7] text-[#4A4A4A]' : 'hover:text-[#4A4A4A]'
                          : analyticsRange === item.key ? 'bg-accent text-black' : 'hover:text-white'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-3 flex items-end gap-2">
                <div className={`text-[2rem] font-bold leading-none ${isGirlsTheme ? 'text-[#4A4A4A]' : 'text-white'}`}>
                  {Math.round(latestChartPoint?.volume || getTotalVolume()).toLocaleString()}
                  <span className={`ml-1 text-sm font-semibold ${mutedTextClassName}`}>{unitLabel}</span>
                </div>
                {volumeDelta !== 0 && (
                  <span className={`pb-1 text-xs font-semibold ${volumeDelta > 0 ? 'text-accent' : 'text-red-300'}`}>
                    {volumeDelta > 0 ? '+' : ''}{Math.round(volumeDelta).toLocaleString()}
                  </span>
                )}
                <span className={`ml-auto pb-1 text-[11px] ${tertiaryTextClassName}`}>
                  {latestChartPoint ? formatChartDate(latestChartPoint.dateKey) : todayDateKey()}
                </span>
              </div>

              <div className={`rounded-2xl border p-2 ${isGirlsTheme ? 'border-[#E2B4BD]/45 bg-white/70' : 'border-white/10 bg-[#151d28]'}`}>
                {chartPoints.length > 0 ? (
                  <svg viewBox="0 0 340 130" preserveAspectRatio="none" className="aspect-[340/130] w-full">
                    <defs>
                      <linearGradient id="trackerVolumeGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0" stopColor={isGirlsTheme ? '#F9B2D7' : 'rgb(187 255 92)'} stopOpacity="0.28" />
                        <stop offset="1" stopColor={isGirlsTheme ? '#F9B2D7' : 'rgb(187 255 92)'} stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    {[0, 0.5, 1].map((ratio) => {
                      const y = chartPath.bottom - ((chartPath.bottom - chartPath.top) * ratio);
                      const value = Math.round(chartPath.minValue + ((chartPath.maxValue - chartPath.minValue) * ratio));
                      return (
                        <g key={`grid-${ratio}`}>
                          <line x1={chartPath.left} y1={y} x2={chartPath.right} y2={y} stroke="rgba(255,255,255,0.14)" strokeWidth="1" strokeDasharray="2 4" />
                          <text x={chartPath.left - 5} y={y + 3.5} textAnchor="end" fontSize="9.5" fill="rgb(var(--color-text-secondary))">{value}</text>
                        </g>
                      );
                    })}
                    {chartPath.coords.map((point, index) => (
                      <g key={`x-${point.dateKey}`}>
                        <line x1={point.x} y1={chartPath.top} x2={point.x} y2={chartPath.bottom} stroke="rgba(255,255,255,0.1)" strokeWidth="1" strokeDasharray="2 4" />
                        {(index === 0 || index === chartPath.coords.length - 1 || index === Math.floor(chartPath.coords.length / 2)) && (
                          <text x={point.x} y="123" textAnchor={index === 0 ? 'start' : index === chartPath.coords.length - 1 ? 'end' : 'middle'} fontSize="9.5" fill="rgb(var(--color-text-secondary))">
                            {formatChartDate(point.dateKey)}
                          </text>
                        )}
                      </g>
                    ))}
                    {chartPath.area && <polygon points={chartPath.area} fill="url(#trackerVolumeGradient)" />}
                    {chartPath.polyline && <polyline points={chartPath.polyline} fill="none" stroke={isGirlsTheme ? '#A87884' : 'rgb(187 255 92)'} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />}
                    {chartPath.coords.map((point, index) => (
                      <circle key={`dot-${point.dateKey}-${index}`} cx={point.x} cy={point.y} r={index === chartPath.coords.length - 1 ? 4 : 2.8} fill={isGirlsTheme ? '#A87884' : 'rgb(187 255 92)'} />
                    ))}
                  </svg>
                ) : (
                  <div className="flex aspect-[340/130] items-center justify-center px-4 text-center text-xs text-text-secondary">
                    {copy.chartEmpty}
                  </div>
                )}
              </div>

            </div>
            <div className="space-y-2">
              <h4 className={`text-sm font-bold uppercase tracking-wider ${mutedTextClassName}`}>{copy.setDetails}</h4>
              {sets.filter(s => s.completed).map((set) => (
                <div key={set.set} className={`rounded-xl border p-4 ${isGirlsTheme ? 'border-[#E2B4BD]/45 bg-white/60' : 'border-white/10 bg-transparent'}`}>
                  <div className="flex justify-between items-center mb-2">
                    <span className={`font-semibold ${isGirlsTheme ? 'text-[#4A4A4A]' : 'text-white'}`}>{copy.setNumber(set.set)}</span>
                    <span className={`${mutedTextClassName} text-sm`}>{copy.repsTimesWeight(set.reps, set.weight, unitLabel)}</span>
                  </div>
                  <div className={`flex gap-4 text-xs ${mutedTextClassName}`}>
                    <span>{copy.workLabel}: {formatTime(set.duration || 0)}</span>
                    {set.restTime && <span>{copy.restLabel}: {formatTime(set.restTime)}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <>
            {t3OverloadAdvice && (
              <div
                className={`mb-5 rounded-2xl border p-4 ${
                  isGirlsTheme
                    ? 'border-[#E2B4BD]/45 bg-white/70 text-[#4A4A4A]'
                    : 'border-accent/25 bg-accent/5 text-text-primary'
                }`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${
                    isGirlsTheme ? 'bg-[#F9B2D7]/35 text-[#795E67]' : 'bg-accent/15 text-accent'
                  }`}>
                    T-3 Overload
                  </span>
                  {plannedReps && (
                    <span className={`text-[11px] font-semibold uppercase tracking-[0.12em] ${tertiaryTextClassName}`}>
                      Target {plannedReps}
                      {targetRpe ? ` @ RPE ${targetRpe}` : ''}
                    </span>
                  )}
                </div>
                <h3 className={`mt-3 text-sm font-semibold ${isGirlsTheme ? 'text-[#4A4A4A]' : 'text-white'}`}>
                  {t3OverloadAdvice.title}
                </h3>
                <p className={`mt-1 text-xs ${mutedTextClassName}`}>{t3OverloadAdvice.body}</p>
                <p className={`mt-2 text-xs ${isGirlsTheme ? 'text-[#795E67]' : 'text-text-secondary'}`}>
                  {t3OverloadAdvice.detail}
                </p>
              </div>
            )}

            <div className="flex justify-around mb-8">
              <button
                data-coachmark-target="workout_tracker_play_button"
                onClick={toggleTimer}
                disabled={!isRunning && areAllSetsCompleted}
                className="flex flex-col items-center gap-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <div className={`flex h-12 w-12 items-center justify-center rounded-full border-2 ${
                  isGirlsTheme
                    ? isRunning
                      ? 'border-rose-300 bg-white/70'
                      : areAllSetsCompleted
                        ? 'border-[#E2B4BD]/35 bg-white/55'
                        : 'border-[#F9B2D7] bg-white/75'
                    : isRunning
                      ? 'border-red-500 bg-red-500/10'
                      : areAllSetsCompleted
                        ? 'border-white/15 bg-white/5'
                        : 'border-green-500 bg-green-500/10'
                }`}>
                  {isRunning ? (
                    <Square size={18} className="text-red-500" />
                  ) : (
                    <Play size={18} className={`${isGirlsTheme ? (areAllSetsCompleted ? 'text-[#A87884]' : 'text-[#A87884]') : (areAllSetsCompleted ? 'text-text-tertiary' : 'text-green-500')} ml-0.5`} />
                  )}
                </div>
              </button>
              <button
                data-coachmark-target="workout_tracker_video_button"
                onClick={() => onVideoClick?.(exerciseName)}
                className="flex flex-col items-center gap-2"
              >
                <div className={`flex h-12 w-12 items-center justify-center rounded-full border-2 ${isGirlsTheme ? 'border-[#E2B4BD]/55 bg-white/70' : 'border-white/20'}`}>
                  <Video size={20} className={isGirlsTheme ? 'text-[#A87884]' : 'text-white'} />
                </div>
                <span className={`text-xs ${mutedTextClassName}`}>{copy.video}</span>
              </button>
              <button
                data-coachmark-target="workout_tracker_analytics_button"
                onClick={() => setShowAnalytics(true)}
                className="flex flex-col items-center gap-2"
              >
                <div className={`flex h-12 w-12 items-center justify-center rounded-full border-2 ${isGirlsTheme ? 'border-[#E2B4BD]/55 bg-white/70' : 'border-white/20'}`}>
                  <BarChart3 size={20} className={isGirlsTheme ? 'text-[#A87884]' : 'text-white'} />
                </div>
                <span className={`text-xs ${mutedTextClassName}`}>{copy.analytics}</span>
              </button>

            </div>

            {isResting && restTime > REST_WINDOW_MAX_SECONDS && (
              <div className="mb-4 rounded-xl border border-red-500/50 bg-red-500/10 p-3">
                <p className="text-xs text-red-300">{copy.restExceeded}</p>
              </div>
            )}

            {restReminderText && (
              <div className={`mb-4 rounded-xl border p-3 ${isGirlsTheme ? 'border-[#F9B2D7]/55 bg-white/70' : 'border-accent/40 bg-accent/10'}`}>
                <div className="flex items-center justify-between gap-2">
                  <p className={`text-sm ${isGirlsTheme ? 'text-[#4A4A4A]' : 'text-white'}`}>{restReminderText}</p>
                  <button
                    onClick={() => setRestReminderText(null)}
                    className={`text-xs transition-colors ${isGirlsTheme ? 'text-[#A87884] hover:text-[#4A4A4A]' : 'text-accent hover:text-white'}`}
                    type="button"
                  >
                    {copy.dismiss}
                  </button>
                </div>
              </div>
            )}

            {areAllSetsCompleted && !isRunning && (
              <div className="mb-4 rounded-xl border border-green-500/35 bg-green-500/10 p-3 text-sm text-green-200">
                {copy.allSetsCompleted}
              </div>
            )}

            <h3 className={`mb-4 text-xs font-bold uppercase tracking-wider ${mutedTextClassName}`}>
              {copy.effectiveSets}
            </h3>

            <div className="grid grid-cols-[60px_60px_80px_1fr] gap-3 mb-3 px-2">
              <span className={`text-xs uppercase ${mutedTextClassName}`}>{copy.setLabel}</span>
              <span className={`text-xs uppercase ${mutedTextClassName}`}>{copy.repsLabel}</span>
              <span className={`text-xs uppercase ${mutedTextClassName}`}>{copy.weightLabel}</span>
              <span></span>
            </div>

            <div className="space-y-3">
              {sets.map((set, index) => (
                <div
                  key={index}
                  data-coachmark-target={index === 0 ? 'workout_tracker_first_set_row' : undefined}
                  className="relative overflow-hidden"
                  onTouchStart={(e) => handleTouchStart(index, e)}
                  onTouchMove={(e) => handleTouchMove(index, e)}>
                  {swipedIndex === index && (
                    <button
                      onClick={() => removeSet(index)}
                      className="absolute right-0 top-0 bottom-0 w-20 bg-red-500 flex items-center justify-center text-white font-bold rounded-r-lg z-10">
                      {copy.delete}
                    </button>
                  )}
                  <div className={`grid grid-cols-[60px_60px_80px_1fr] gap-4 items-center transition-transform ${
                    swipedIndex === index ? '-translate-x-20' : ''
                  } ${set.completed ? 'opacity-50' : ''}`}>
                    <div className={`rounded-full px-4 py-2 text-center ${
                      isGirlsTheme
                        ? set.completed ? 'border border-emerald-300/55 bg-emerald-50/80' : 'border border-[#E2B4BD]/45 bg-white/65'
                        : set.completed ? 'bg-green-500/20 border border-green-500' : 'bg-transparent border border-white/20'
                    }`}>
                      <span className={`font-semibold ${
                        isGirlsTheme
                          ? set.completed ? 'text-emerald-700' : 'text-[#4A4A4A]'
                          : set.completed ? 'text-green-500' : 'text-white'
                      }`}>{set.set}</span>
                    </div>
                    <input
                      type="number"
                      value={set.reps}
                      onChange={(e) => updateSet(index, 'reps', parseInt(e.target.value) || 0)}
                      disabled={set.completed}
                      className={setInputClassName}
                    />
                    <input
                      type="number"
                      value={set.weight}
                      step="0.5"
                      onChange={(e) => updateSet(index, 'weight', parseFloat(e.target.value) || 0)}
                      disabled={set.completed}
                      className={setInputClassName}
                    />
                    <div className="relative h-8">
                      {(() => {
                        const sliderPercent = Math.max(0, Math.min(100, (set.weight / 200) * 100));
                        return (
                          <>
                            <input
                              type="range"
                              min="0"
                              max="200"
                              step="0.5"
                              value={set.weight}
                              onChange={(e) => updateSet(index, 'weight', parseFloat(e.target.value))}
                              disabled={set.completed}
                              className="barbell-slider-hit absolute inset-y-0 left-6 right-0 z-20 h-full w-auto cursor-pointer opacity-0 disabled:cursor-not-allowed"
                              aria-label={copy.setWeightAria(set.set)}
                            />
                            <div className="barbell-track-shell pointer-events-none absolute left-6 right-0 top-1/2 z-10 h-[10px] -translate-y-1/2">
                              <div className="barbell-track-fill" style={{ width: `${sliderPercent}%` }} />
                              <div className="barbell-track-remainder" style={{ left: `${sliderPercent}%` }} />
                              <div className="barbell-knob" style={{ left: `${sliderPercent}%` }}>
                                <BarbellSliderThumb weight={set.weight} />
                              </div>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button
              data-coachmark-target="workout_tracker_add_set_button"
              onClick={() => persistSets([...sets, { set: sets.length + 1, reps: 8, weight: 80, completed: false }])}
              className={`mt-6 w-full rounded-full py-3 font-bold transition-colors ${isGirlsTheme ? 'border border-[#E2B4BD]/55 bg-[#F9B2D7] text-[#4A4A4A] hover:bg-[#E2B4BD]' : 'bg-accent text-black hover:bg-accent/90'}`}>
              {copy.addSet}
            </button>
          </>
        )}
      </div>

      {showRemoveConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4 backdrop-blur-sm"
          onClick={() => {
            if (!isRemovingExercise) setShowRemoveConfirm(false);
          }}
        >
          <div
            className={`w-full max-w-sm overflow-hidden rounded-[1.75rem] border shadow-[0_24px_80px_rgba(0,0,0,0.28)] ${isGirlsTheme ? 'border-[#E2B4BD]/45 bg-[#FFF5F5]' : 'border-white/12 bg-[rgb(var(--color-card))]/95'}`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="relative overflow-hidden px-6 pb-5 pt-6">
              <div className="relative">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-red-500/25 bg-red-500/12 text-red-400 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]">
                  <Trash2 size={22} />
                </div>
                <h3 className={`mt-5 text-xl font-semibold ${isGirlsTheme ? 'text-[#4A4A4A]' : 'text-text-primary'}`}>{copy.removeTitle}</h3>
                <p className={`mt-2 text-sm leading-relaxed ${isGirlsTheme ? 'text-[#795E67]' : 'text-text-secondary'}`}>
                  {copy.removeBody(displayExerciseName)}
                </p>
                <p className={`mt-1 text-xs uppercase tracking-[0.18em] ${tertiaryTextClassName}`}>
                  {copy.removeFootnote}
                </p>
              </div>
            </div>

            <div className={`grid grid-cols-2 gap-3 border-t px-6 py-5 ${isGirlsTheme ? 'border-[#E2B4BD]/35 bg-white/45' : 'border-white/8 bg-black/5'}`}>
              <button
                type="button"
                onClick={() => setShowRemoveConfirm(false)}
                disabled={isRemovingExercise}
                className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${isGirlsTheme ? 'border-[#E2B4BD]/45 bg-white/70 text-[#795E67] hover:bg-white' : 'border-white/10 bg-white/5 text-text-primary hover:bg-white/10'}`}
              >
                {copy.cancel}
              </button>
              <button
                type="button"
                onClick={() => {
                  void handleRemoveExercise();
                }}
                disabled={isRemovingExercise}
                className="rounded-2xl border border-red-500/25 bg-red-500/12 px-4 py-3 text-sm font-semibold text-red-400 transition-colors hover:bg-red-500/18 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isRemovingExercise ? copy.removing : copy.remove}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .barbell-track-shell {
          position: relative;
          border-radius: 9999px;
          border: 1px solid rgba(255, 255, 255, 0.16);
          background: linear-gradient(90deg, rgba(7, 12, 20, 0.95), rgba(12, 20, 32, 0.95));
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.1),
            inset 0 -1px 0 rgba(0, 0, 0, 0.45),
            0 3px 8px rgba(0, 0, 0, 0.35);
          overflow: visible;
        }

        .barbell-track-shell::before {
          content: '';
          position: absolute;
          top: 50%;
          left: -14px;
          transform: translateY(-50%);
          width: 10px;
          height: 4px;
          border-radius: 9999px;
          border: 1px solid rgba(255, 255, 255, 0.2);
          background: linear-gradient(90deg, #9ca3af 0%, #d1d5db 48%, #6b7280 100%);
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.35);
        }

        .barbell-track-shell::after {
          content: '';
          position: absolute;
          top: 50%;
          left: -5px;
          transform: translateY(-50%);
          width: 8px;
          height: 6px;
          border-radius: 9999px;
          border: 1px solid rgba(255, 255, 255, 0.2);
          background: linear-gradient(90deg, #9ca3af 0%, #e5e7eb 52%, #6b7280 100%);
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.35);
        }

        .barbell-track-fill {
          position: absolute;
          inset: 0 auto 0 0;
          border-radius: 9999px;
          background: linear-gradient(180deg, #ff7a7a 0%, #ef4444 65%, #b91c1c 100%);
          box-shadow: inset 0 0 5px rgba(255, 255, 255, 0.18);
          z-index: 2;
        }

        .barbell-track-remainder {
          position: absolute;
          top: 0;
          bottom: 0;
          right: 0;
          border-top-right-radius: 9999px;
          border-bottom-right-radius: 9999px;
          background: linear-gradient(90deg, rgba(19, 31, 46, 0.95), rgba(10, 17, 29, 0.95));
          z-index: 1;
        }

        .barbell-knob {
          position: absolute;
          top: 50%;
          transform: translate(-50%, -50%);
          display: flex;
          align-items: center;
          width: 92px;
          height: 46px;
          margin-left: 4px;
        }

        .barbell-thumb-svg {
          display: block;
          width: 92px;
          height: 46px;
          overflow: visible;
        }

        .barbell-slider-hit:focus-visible + .barbell-track-shell {
          box-shadow:
            0 0 0 2px rgba(187, 255, 92, 0.45),
            inset 0 1px 0 rgba(255, 255, 255, 0.1),
            inset 0 -1px 0 rgba(0, 0, 0, 0.45),
            0 3px 8px rgba(0, 0, 0, 0.35);
        }

        .barbell-slider-hit {
          accent-color: #ef4444;
        }

        .workout-timer-board {
          --timer-panel: #101824;
          --timer-panel-dark: #14202e;
          --timer-accent: rgb(var(--color-accent));
          --timer-accent-muted: rgba(187, 255, 92, 0.7);
          --timer-led-shadow: rgba(187, 255, 92, 0.5);
          --timer-led-soft-shadow: rgba(187, 255, 92, 0.22);
          --timer-track: rgba(187, 255, 92, 0.18);
          width: 100%;
          border: 1px solid rgba(187, 255, 92, 0.18);
          border-radius: 18px;
          background: var(--timer-panel);
          box-shadow: 0 18px 34px rgba(0, 0, 0, 0.24);
          padding: 18px 24px 22px;
          color: var(--timer-accent);
          direction: ltr;
        }

        .workout-timer-top {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 16px;
          margin-bottom: 12px;
        }

        .workout-timer-title {
          color: var(--timer-accent);
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
          font-size: 12px;
          font-weight: 900;
          letter-spacing: 0;
          line-height: 1;
        }

        .workout-timer-tiles {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(72px, 1fr));
          gap: 8px;
        }

        .timer-label {
          display: block;
          color: var(--timer-accent-muted);
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0;
          line-height: 1.1;
          text-align: center;
          white-space: nowrap;
        }

        .workout-timer-tile {
          min-width: 0;
          opacity: 0.66;
        }

        .workout-timer-tile.is-done,
        .workout-timer-tile.is-active,
        .workout-timer-tile.is-resting {
          opacity: 1;
        }

        .workout-timer-tile.is-active .timer-value.lcd,
        .workout-timer-tile.is-resting .timer-value.lcd {
          box-shadow:
            inset 0 0 0 1px color-mix(in srgb, var(--timer-accent) 32%, transparent),
            inset 0 0 18px rgba(0, 0, 0, 0.34),
            0 0 16px var(--timer-led-soft-shadow);
        }

        .timer-value.lcd {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          isolation: isolate;
          min-height: 48px;
          margin-top: 6px;
          overflow: hidden;
          border: 1px solid color-mix(in srgb, var(--timer-accent) 18%, transparent);
          border-radius: 6px;
          background:
            linear-gradient(180deg, rgba(255, 255, 255, 0.045), transparent 38%),
            radial-gradient(circle at 50% 0%, color-mix(in srgb, var(--timer-accent) 12%, transparent), transparent 62%),
            var(--timer-panel-dark);
          padding: 7px 6px 3px;
          color: var(--timer-accent);
          gap: clamp(3px, 1vw, 6px);
          box-shadow:
            inset 0 0 0 1px rgba(255, 255, 255, 0.035),
            inset 0 0 18px rgba(0, 0, 0, 0.32);
        }

        .timer-value.lcd::before {
          content: "";
          position: absolute;
          inset: 0;
          z-index: -1;
          background:
            repeating-linear-gradient(
              180deg,
              rgba(255, 255, 255, 0.045) 0,
              rgba(255, 255, 255, 0.045) 1px,
              transparent 1px,
              transparent 5px
            );
          opacity: 0.34;
          pointer-events: none;
        }

        .lcd-digit {
          position: relative;
          display: inline-block;
          width: clamp(18px, 5.8vw, 28px);
          height: clamp(32px, 8.6vw, 42px);
          flex: 0 0 auto;
          filter: drop-shadow(0 0 3px var(--timer-led-soft-shadow));
        }

        .lcd-colon {
          position: relative;
          display: inline-block;
          width: clamp(5px, 1.8vw, 8px);
          height: clamp(32px, 8.6vw, 42px);
          flex: 0 0 auto;
          filter: drop-shadow(0 0 3px var(--timer-led-soft-shadow));
        }

        .lcd-colon::before,
        .lcd-colon::after {
          content: "";
          position: absolute;
          left: 50%;
          width: clamp(3px, 1.1vw, 5px);
          height: clamp(3px, 1.1vw, 5px);
          border-radius: 50%;
          background: var(--timer-accent);
          box-shadow:
            0 0 2px var(--timer-led-shadow),
            0 0 8px var(--timer-led-soft-shadow),
            0 0 14px var(--timer-led-soft-shadow);
          transform: translateX(-50%);
        }

        .lcd-colon::before {
          top: 30%;
        }

        .lcd-colon::after {
          bottom: 30%;
        }

        .lcd-segment {
          position: absolute;
          display: block;
          opacity: 0.12;
          background: color-mix(in srgb, var(--timer-accent) 78%, transparent);
          box-shadow: none;
          transition: opacity 160ms ease, box-shadow 160ms ease;
        }

        .lcd-segment::before,
        .lcd-segment::after {
          content: "";
          position: absolute;
          width: 0;
          height: 0;
        }

        .lcd-segment.seg-a,
        .lcd-segment.seg-d,
        .lcd-segment.seg-g {
          left: 18%;
          width: 64%;
          height: 9%;
          clip-path: polygon(10% 0, 90% 0, 100% 50%, 90% 100%, 10% 100%, 0 50%);
        }

        .lcd-segment.seg-a {
          top: 0;
        }

        .lcd-segment.seg-g {
          top: 45.5%;
        }

        .lcd-segment.seg-d {
          bottom: 0;
        }

        .lcd-segment.seg-b,
        .lcd-segment.seg-c,
        .lcd-segment.seg-e,
        .lcd-segment.seg-f,
        .lcd-segment.seg-h {
          width: 12%;
          height: 38%;
          clip-path: polygon(50% 0, 100% 10%, 100% 90%, 50% 100%, 0 90%, 0 10%);
        }

        .lcd-segment.seg-b {
          top: 7%;
          right: 2%;
        }

        .lcd-segment.seg-c {
          right: 2%;
          bottom: 7%;
        }

        .lcd-segment.seg-e {
          left: 2%;
          bottom: 7%;
        }

        .lcd-segment.seg-f {
          top: 7%;
          left: 2%;
        }

        .lcd-segment.seg-h {
          top: 31%;
          left: 44%;
          height: 38%;
          opacity: 0.08;
        }

        .lcd-digit[data-digit="0"] :is(.seg-a, .seg-b, .seg-c, .seg-d, .seg-e, .seg-f),
        .lcd-digit[data-digit="1"] :is(.seg-b, .seg-c),
        .lcd-digit[data-digit="2"] :is(.seg-a, .seg-b, .seg-g, .seg-e, .seg-d),
        .lcd-digit[data-digit="3"] :is(.seg-a, .seg-b, .seg-g, .seg-c, .seg-d),
        .lcd-digit[data-digit="4"] :is(.seg-f, .seg-g, .seg-b, .seg-c),
        .lcd-digit[data-digit="5"] :is(.seg-a, .seg-f, .seg-g, .seg-c, .seg-d),
        .lcd-digit[data-digit="6"] :is(.seg-a, .seg-f, .seg-g, .seg-e, .seg-c, .seg-d),
        .lcd-digit[data-digit="7"] :is(.seg-a, .seg-b, .seg-c),
        .lcd-digit[data-digit="8"] :is(.seg-a, .seg-b, .seg-c, .seg-d, .seg-e, .seg-f, .seg-g, .seg-h),
        .lcd-digit[data-digit="9"] :is(.seg-a, .seg-b, .seg-c, .seg-d, .seg-f, .seg-g) {
          opacity: 1;
          background: var(--timer-accent);
          box-shadow:
            0 0 2px var(--timer-led-shadow),
            0 0 8px var(--timer-led-soft-shadow),
            0 0 14px var(--timer-led-soft-shadow);
        }

        .workout-timeline-viewer {
          position: relative;
          height: 24px;
          margin-top: 24px;
          border-left: 1px solid var(--timer-accent);
          border-right: 2px solid var(--timer-accent);
        }

        .tl-child {
          position: absolute;
          top: 0;
          height: 8px;
          min-width: 3px;
          border-radius: 999px;
          background: var(--timer-accent-muted);
          transform: translateY(0);
        }

        .tl-child:nth-child(2n) {
          top: 9px;
        }

        .tl-child:nth-child(3n) {
          top: 15px;
        }

        .tl-child.is-active,
        .tl-child.is-done {
          background: var(--timer-accent);
        }

        [data-theme='light'] .workout-timer-board {
          --timer-panel: #ffffff;
          --timer-panel-dark: #f1f7e7;
          --timer-accent: rgb(var(--color-accent-dark));
          --timer-accent-muted: rgba(109, 149, 34, 0.68);
          --timer-led-shadow: rgba(109, 149, 34, 0.44);
          --timer-led-soft-shadow: rgba(155, 214, 52, 0.2);
          --timer-track: rgba(155, 214, 52, 0.18);
          border-color: rgba(155, 214, 52, 0.28);
          box-shadow: 0 16px 30px rgba(90, 109, 133, 0.16);
        }

        .workout-timer-board--girls {
          --timer-panel: rgba(255, 255, 255, 0.76);
          --timer-panel-dark: #fff1f5;
          --timer-accent: #a87884;
          --timer-accent-muted: rgba(168, 120, 132, 0.72);
          --timer-led-shadow: rgba(168, 120, 132, 0.42);
          --timer-led-soft-shadow: rgba(249, 178, 215, 0.26);
          --timer-track: rgba(249, 178, 215, 0.2);
          border-color: rgba(226, 180, 189, 0.55);
          box-shadow: 0 14px 30px rgba(168, 120, 132, 0.18);
        }

        @media (max-width: 420px) {
          .workout-timer-board {
            padding: 16px 20px 20px;
          }

          .workout-timer-tiles {
            gap: 7px;
          }

          .timer-value.lcd {
            min-height: 43px;
            font-size: clamp(25px, 8.6vw, 32px);
          }
        }
      `}</style>
    </div>
  );
}

