import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { ArrowLeft } from 'lucide-react';
import { MuscleSvgBadge } from './MuscleSvgBadge';
import { api } from '../../services/api';
import { resolveExerciseVideo, resolveExerciseVideoUrl, type ExerciseRemoteMedia } from '../../services/exerciseVideos';
import { LocalizedLanguageRecord, getActiveLanguage, getStoredLanguage } from '../../services/language';
import { stripExercisePrefix } from '../../services/exerciseName';
import { playMediaSafely } from '../../shared/mediaPlayback';
import { useScreenshotProtection } from '../../shared/useScreenshotProtection';
import { getStoredAppUser } from '../../shared/authStorage';
import cardioManVideoUrl from '../../../assets/Workout/body part/cardio/cardio man.mp4';
import cardioWomanVideoUrl from '../../../assets/Workout/body part/cardio/cardio woman.mp4';
import genericCardioPlaceholderVideoUrl from '../../../assets/intro.mp4';
import { ExerciseMedia } from './ExerciseMedia';

interface ExerciseVideoScreenProps {
  onBack: () => void;
  exercise?: {
    name: string;
    muscle?: string;
    video?: string | null;
    primaryMedia?: ExerciseRemoteMedia | null;
    media?: ExerciseRemoteMedia[];
    exerciseCatalogId?: number | null;
    targetMuscles?: string | string[];
    importance?: string;
    anatomy?: string | string[];
    workoutType?: string;
    isCardio?: boolean;
  };
}

type MuscleDistributionEntry = {
  name: string;
  percent: number;
  colorClass: string;
  baseMuscle?: string | null;
  role?: string;
  isPrimary?: boolean;
};

const getDisplayExerciseName = (name?: string) =>
  stripExercisePrefix(String(name || 'Barbell Bench Press'));

const normalizeLookup = (value?: string) =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const toTitleCase = (value = '') =>
  String(value || '')
    .trim()
    .toLowerCase()
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const formatVideoTime = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00';
  const totalSeconds = Math.floor(seconds);
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;
  return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
};

const canonicalizeMuscleLabel = (value: unknown) => {
  const key = String(value || '').trim().toLowerCase();
  if (!key) return '';

  if (key.includes('clavicular') || key.includes('upper pector')) return 'Upper Chest';
  if (key.includes('upper chest')) return 'Upper Chest';
  if (key.includes('mid chest') || key.includes('middle chest')) return 'Mid Chest';
  if (key.includes('sternocostal') || key.includes('mid pector')) return 'Mid Chest';
  if (key.includes('lower chest')) return 'Lower Chest';
  if (key.includes('latissimus')) return 'Lats';
  if (key.includes('rhomboid')) return 'Rhomboids';
  if (key.includes('trapezius') || key.includes('trap')) return 'Traps';
  if (key.includes('erector spinae') || key.includes('spinal erector') || key.includes('spinae')) return 'Lower Back';
  if (key.includes('rear delt') || key.includes('rear deltoid') || key.includes('posterior delt')) return 'Rear Delts';
  if (key.includes('lateral delt') || key.includes('side delt') || key.includes('medial delt')) return 'Side Delts';
  if (key.includes('front delt') || key.includes('anterior delt') || key.includes('front deltoid')) return 'Front Delts';
  if (key.includes('upper back')) return 'Upper Back';
  if (key.includes('lower back')) return 'Lower Back';
  if (key.includes('lat')) return 'Lats';
  if (key.includes('long head biceps')) return 'Long Head Biceps';
  if (key.includes('short head biceps')) return 'Short Head Biceps';
  if (key.includes('brachialis')) return 'Brachialis';
  if (key.includes('long head triceps')) return 'Long Head Triceps';
  if (key.includes('lateral head triceps')) return 'Lateral Head Triceps';
  if (key.includes('medial head triceps')) return 'Medial Head Triceps';
  if (key.includes('upper abs')) return 'Upper Abs';
  if (key.includes('lower abs')) return 'Lower Abs';
  if (key.includes('oblique')) return 'Obliques';
  if (key.includes('serratus')) return 'Serratus';
  if (key.includes('shoulder') || key.includes('delt')) return 'Shoulders';
  if (key.includes('tricep') || key.includes('triceps brachii')) return 'Triceps';
  if (key.includes('bicep') || key.includes('biceps brachii')) return 'Biceps';
  if (key.includes('chest') || key.includes('pect') || key.includes('pec')) return 'Chest';
  if (key.includes('back')) return 'Back';
  if (key.includes('quad') || key.includes('thigh')) return 'Quadriceps';
  if (key.includes('hamstring')) return 'Hamstrings';
  if (key.includes('calf')) return 'Calves';
  if (key.includes('glute')) return 'Glutes';
  if (key.includes('abs') || key.includes('core') || key.includes('abdom')) return 'Abs';
  if (key.includes('forearm') || key.includes('grip') || key.includes('wrist')) return 'Forearms';
  if (key.includes('general')) return 'General';

  return toTitleCase(key);
};

const toBaseMuscleGroup = (value: unknown) => {
  const key = String(value || '').trim().toLowerCase();
  if (!key) return '';

  if (key.includes('chest') || key.includes('pect') || key.includes('pec')) return 'Chest';
  if (key.includes('back') || key.includes('lat') || key.includes('trap') || key.includes('rhomboid')) return 'Back';
  if (key.includes('shoulder') || key.includes('delt')) return 'Shoulders';
  if (key.includes('tricep')) return 'Triceps';
  if (key.includes('bicep') || key.includes('brachialis')) return 'Biceps';
  if (key.includes('abs') || key.includes('core') || key.includes('oblique') || key.includes('abdom')) return 'Abs';
  if (
    key.includes('quad')
    || key.includes('hamstring')
    || key.includes('calf')
    || key.includes('glute')
    || key.includes('thigh')
    || key.includes('leg')
  ) {
    return 'Legs';
  }
  if (key.includes('general')) return 'General';

  return toTitleCase(key);
};

const dedupeMuscles = (muscles: string[]) => {
  const seen = new Set<string>();
  const result: string[] = [];

  muscles.forEach((entry) => {
    const normalized = normalizeLookup(entry);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    result.push(entry);
  });

  return result;
};

const isGirlsStyleValue = (value: unknown) => {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === 'woman' || normalized === 'female' || normalized === 'f' || normalized === 'girls' || normalized === 'femme';
};

const readExerciseVideoStyleGender = () => {
  try {
    return String(localStorage.getItem('appStyleGender') || '').trim().toLowerCase();
  } catch {
    return '';
  }
};

const readExerciseVideoProfile = (user: any) => {
  const rawProfile = user?.onboarding_profile || user?.onboardingProfile;
  if (!rawProfile) return {};
  if (typeof rawProfile === 'object') return rawProfile;
  try {
    return JSON.parse(String(rawProfile));
  } catch {
    return {};
  }
};

const shouldUseGirlsExerciseVideoTheme = (user: any, styleGender: string) => {
  if (styleGender) return isGirlsStyleValue(styleGender);
  const profile = readExerciseVideoProfile(user);
  return isGirlsStyleValue(user?.gender) || isGirlsStyleValue(profile?.gender) || profile?.onboardingTheme === 'girls';
};

const CARDIO_CONTEXT_PATTERN = /\b(cardio|conditioning|liss|hiit|treadmill|incline walk|incline treadmill|bike|cycling|cycle|row|rowing|jog|jogging|run|running|elliptical|stair|stepper|jump rope|skipping)\b/i;

const isCardioExerciseContext = (exercise?: ExerciseVideoScreenProps['exercise']) => {
  if (exercise?.isCardio) return true;

  const lookupText = [
    exercise?.workoutType,
    exercise?.name,
    exercise?.muscle,
    ...(Array.isArray(exercise?.targetMuscles) ? exercise.targetMuscles : [exercise?.targetMuscles]),
    ...(Array.isArray(exercise?.anatomy) ? exercise.anatomy : [exercise?.anatomy]),
  ]
    .map((entry) => String(entry || '').trim())
    .filter(Boolean)
    .join(' ');

  return CARDIO_CONTEXT_PATTERN.test(lookupText);
};

const parseTargetMuscles = (value?: string | string[]) => {
  if (Array.isArray(value)) {
    return dedupeMuscles(
      value
        .map((entry) => canonicalizeMuscleLabel(entry))
        .filter(Boolean),
    );
  }

  const text = String(value || '').trim();
  if (!text) return [];

  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) {
      return dedupeMuscles(
        parsed
          .map((entry) => canonicalizeMuscleLabel(entry))
          .filter(Boolean),
      );
    }
    if (typeof parsed === 'string' && parsed.trim()) {
      return [canonicalizeMuscleLabel(parsed)].filter(Boolean);
    }
  } catch {
    // Fall through to delimited parsing.
  }

  return dedupeMuscles(
    text
      .split(/[,;|]+/)
      .map((part) => canonicalizeMuscleLabel(part))
      .filter(Boolean),
  );
};

const inferMusclesFromExerciseName = (exerciseName?: string) => {
  const name = String(exerciseName || '').toLowerCase();
  const matches: string[] = [];
  const isShoulderIsolation = /lateral raise|\blateral\b|rear delt|face pull|front raise/.test(name);
  const isShoulderPress = /shoulder|overhead press|arnold press|seated db press|seated shoulder press|machine shoulder press/.test(name);

  if (/bench|chest|fly|push-up|push up|pec deck|incline (db|dumbbell|barbell|machine|smith)? ?press|machine press|hammer strength press|weighted dip|dip/.test(name)) matches.push('Chest', 'Triceps', 'Shoulders');
  if (/deadlift|row|pull-up|pull up|pullup|chin-up|chin up|chinup|pulldown|pullover|lat pulldown|lat pull|rack pull/.test(name)) matches.push('Back', 'Biceps', 'Forearms');
  if (/squat|leg press|leg extension|lunge|split squat|step up|hip thrust/.test(name)) matches.push('Quadriceps', 'Hamstrings', 'Calves');
  if (/romanian deadlift|rdl|leg curl|hamstring/.test(name)) matches.push('Hamstrings');
  if (isShoulderIsolation) matches.push('Shoulders');
  if (isShoulderPress) matches.push('Shoulders', 'Triceps');
  if (/curl/.test(name)) matches.push('Biceps', 'Forearms');
  if (/tricep|triceps|pushdown|push down|skullcrusher|french press/.test(name)) matches.push('Triceps');
  if (/calf/.test(name)) matches.push('Calves');
  if (/abs|core|crunch|plank|sit-up|sit up|leg raise|leg lift|knee raise|vacuum|hollow|dead bug|toe touch|abs circuit/.test(name)) matches.push('Abs');

  return dedupeMuscles(
    matches
      .map((entry) => canonicalizeMuscleLabel(entry))
      .filter(Boolean),
  );
};

const MUSCLE_BAR_COLORS = [
  'bg-blue-500',
  'bg-indigo-500',
  'bg-purple-500',
  'bg-cyan-500',
  'bg-emerald-500',
];

const EXERCISE_VIDEO_I18N: LocalizedLanguageRecord<{
  muscleDistributionTitle: string;
  primaryTargetsTitle: string;
  secondaryTargetsTitle: string;
  noVideo: string;
  defaultMuscle: string;
}> = {
  en: {
    muscleDistributionTitle: 'Muscle Distribution (Plan Target)',
    primaryTargetsTitle: 'Main Target Muscles',
    secondaryTargetsTitle: 'Secondary Target Muscles',
    noVideo: 'No linked video yet for this exercise',
    defaultMuscle: 'Chest',
  },
  ar: {
    muscleDistributionTitle: 'توزيع العضلات (هدف الخطة)',
    primaryTargetsTitle: 'العضلات المستهدفة أساسيًا',
    secondaryTargetsTitle: 'العضلات المساعدة',
    noVideo: 'لا يوجد فيديو مرتبط بهذا التمرين بعد',
    defaultMuscle: 'الصدر',
  },
  it: {
    muscleDistributionTitle: 'Distribuzione Muscolare (Target del Piano)',
    primaryTargetsTitle: 'Muscoli target principali',
    secondaryTargetsTitle: 'Muscoli target secondari',
    noVideo: 'Nessun video collegato ancora per questo esercizio',
    defaultMuscle: 'Petto',
  },
  de: {
    muscleDistributionTitle: 'Muskelverteilung (Plan-Ziel)',
    primaryTargetsTitle: 'Hauptzielmuskeln',
    secondaryTargetsTitle: 'Sekundaere Zielmuskeln',
    noVideo: 'Fuer diese Uebung ist noch kein Video verknuepft',
    defaultMuscle: 'Brust',
  },
};

const AR_SUB_MUSCLE_LABELS: Record<string, string> = {
  'upper chest': 'الصدر العلوي',
  'mid chest': 'منتصف الصدر',
  'lower chest': 'الصدر السفلي',
  'upper back': 'أعلى الظهر',
  'lower back': 'أسفل الظهر',
  lats: 'اللاتس',
  traps: 'الترابس',
  rhomboids: 'الرومبويد',
  serratus: 'العضلة المنشارية',
  'long head biceps': 'الرأس الطويل للبايسبس',
  'short head biceps': 'الرأس القصير للبايسبس',
  brachialis: 'العضلة العضدية',
  'upper abs': 'البطن العلوي',
  obliques: 'العضلات الجانبية',
  'lower abs': 'البطن السفلي',
  'front delts': 'الدالية الأمامية',
  'side delts': 'الدالية الجانبية',
  'rear delts': 'الدالية الخلفية',
  'long head triceps': 'الرأس الطويل للترايسبس',
  'lateral head triceps': 'الرأس الجانبي للترايسبس',
  'medial head triceps': 'الرأس الأوسط للترايسبس',
};

const AR_BASE_MUSCLE_LABELS: Record<string, string> = {
  chest: 'الصدر',
  back: 'الظهر',
  shoulders: 'الأكتاف',
  triceps: 'الترايسبس',
  biceps: 'البايسبس',
  abs: 'البطن',
  core: 'الجذع',
  legs: 'الأرجل',
  general: 'عام',
};

const IT_SUB_MUSCLE_LABELS: Record<string, string> = {
  'upper chest': 'Petto alto',
  'mid chest': 'Petto medio',
  'lower chest': 'Petto basso',
  'upper back': 'Schiena alta',
  'lower back': 'Schiena bassa',
  lats: 'Dorsali',
  traps: 'Trapezi',
  rhomboids: 'Romboidi',
  serratus: 'Dentato anteriore',
  'long head biceps': 'Capo lungo bicipite',
  'short head biceps': 'Capo corto bicipite',
  brachialis: 'Brachiale',
  'upper abs': 'Addome alto',
  obliques: 'Obliqui',
  'lower abs': 'Addome basso',
  'front delts': 'Deltoidi anteriori',
  'side delts': 'Deltoidi laterali',
  'rear delts': 'Deltoidi posteriori',
  'long head triceps': 'Capo lungo tricipite',
  'lateral head triceps': 'Capo laterale tricipite',
  'medial head triceps': 'Capo mediale tricipite',
};

const DE_SUB_MUSCLE_LABELS: Record<string, string> = {
  'upper chest': 'Obere Brust',
  'mid chest': 'Mittlere Brust',
  'lower chest': 'Untere Brust',
  'upper back': 'Oberer Ruecken',
  'lower back': 'Unterer Ruecken',
  lats: 'Latissimus',
  traps: 'Trapezmuskel',
  rhomboids: 'Rhomboiden',
  serratus: 'Serratus',
  'long head biceps': 'Langer Bizepskopf',
  'short head biceps': 'Kurzer Bizepskopf',
  brachialis: 'Brachialis',
  'upper abs': 'Obere Bauchmuskeln',
  obliques: 'Schraege Bauchmuskeln',
  'lower abs': 'Untere Bauchmuskeln',
  'front delts': 'Vordere Delts',
  'side delts': 'Seitliche Delts',
  'rear delts': 'Hintere Delts',
  'long head triceps': 'Langer Trizepskopf',
  'lateral head triceps': 'Lateraler Trizepskopf',
  'medial head triceps': 'Medialer Trizepskopf',
};

const IT_BASE_MUSCLE_LABELS: Record<string, string> = {
  chest: 'Petto',
  back: 'Schiena',
  shoulders: 'Spalle',
  triceps: 'Tricipiti',
  biceps: 'Bicipiti',
  abs: 'Addome',
  core: 'Core',
  legs: 'Gambe',
  general: 'Generale',
};

const DE_BASE_MUSCLE_LABELS: Record<string, string> = {
  chest: 'Brust',
  back: 'Ruecken',
  shoulders: 'Schultern',
  triceps: 'Trizeps',
  biceps: 'Bizeps',
  abs: 'Bauch',
  core: 'Core',
  legs: 'Beine',
  general: 'Allgemein',
};

const toRoundedPercentages = (weights: number[]) => {
  if (weights.length === 0) return [];

  const safeWeights = weights.map((value) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) && numeric > 0 ? numeric : 1;
  });
  const total = safeWeights.reduce((sum, value) => sum + value, 0) || safeWeights.length;
  const rawPercentages = safeWeights.map((value) => (value / total) * 100);
  const rounded = rawPercentages.map((value) => Math.floor(value));
  const remaining = 100 - rounded.reduce((sum, value) => sum + value, 0);

  const rankedByRemainder = rawPercentages
    .map((value, index) => ({
      index,
      remainder: value - rounded[index],
      weight: safeWeights[index],
    }))
    .sort((left, right) =>
      right.remainder - left.remainder
      || right.weight - left.weight
      || left.index - right.index);

  for (let i = 0; i < remaining; i += 1) {
    rounded[rankedByRemainder[i % rankedByRemainder.length].index] += 1;
  }

  return rounded;
};

const getExactMuscleDistribution = (
  muscles: Array<{
    name?: string;
    percent?: number;
    loadFactor?: number;
    role?: string;
    isPrimary?: boolean;
    baseMuscle?: string | null;
  }>,
): MuscleDistributionEntry[] => {
  if (!Array.isArray(muscles) || muscles.length === 0) return [];

  const byMuscle = new Map<string, {
    name: string;
    weight: number;
    role?: string;
    isPrimary?: boolean;
    baseMuscle?: string | null;
    order: number;
  }>();

  muscles.forEach((entry, index) => {
    const name = canonicalizeMuscleLabel(entry?.name);
    if (!name) return;

    const key = normalizeLookup(name);
    const weightRaw = Number(entry?.loadFactor ?? entry?.percent ?? 0);
    const weight = Number.isFinite(weightRaw) && weightRaw > 0 ? weightRaw : 1;
    const baseMuscle = toBaseMuscleGroup(name) || canonicalizeMuscleLabel(entry?.baseMuscle) || null;
    const current = byMuscle.get(key);

    if (!current) {
      byMuscle.set(key, {
        name,
        weight,
        role: entry?.role,
        isPrimary: Boolean(entry?.isPrimary),
        baseMuscle,
        order: index,
      });
      return;
    }

    current.weight += weight;
    current.isPrimary = current.isPrimary || Boolean(entry?.isPrimary);
    if (!current.role && entry?.role) current.role = entry.role;
    if (!current.baseMuscle && baseMuscle) current.baseMuscle = baseMuscle;
  });

  const ordered = Array.from(byMuscle.values()).sort((left, right) =>
    Number(right.isPrimary) - Number(left.isPrimary)
    || right.weight - left.weight
    || left.order - right.order
    || left.name.localeCompare(right.name));
  const percentages = toRoundedPercentages(ordered.map((entry) => entry.weight));

  return ordered.map((entry, index) => ({
    name: entry.name,
    percent: percentages[index] ?? 0,
    colorClass: MUSCLE_BAR_COLORS[index % MUSCLE_BAR_COLORS.length],
    baseMuscle: entry.baseMuscle || null,
    role: entry.role,
    isPrimary: entry.isPrimary,
  }));
};

const getMuscleDistribution = (muscles: string[]): MuscleDistributionEntry[] => {
  if (muscles.length === 0) return [];

  if (muscles.length === 1) {
    return [{ name: muscles[0], percent: 100, colorClass: MUSCLE_BAR_COLORS[0] }];
  }

  if (muscles.length === 2) {
    return [
      { name: muscles[0], percent: 60, colorClass: MUSCLE_BAR_COLORS[0] },
      { name: muscles[1], percent: 40, colorClass: MUSCLE_BAR_COLORS[1] },
    ];
  }

  if (muscles.length === 3) {
    return [
      { name: muscles[0], percent: 50, colorClass: MUSCLE_BAR_COLORS[0] },
      { name: muscles[1], percent: 30, colorClass: MUSCLE_BAR_COLORS[1] },
      { name: muscles[2], percent: 20, colorClass: MUSCLE_BAR_COLORS[2] },
    ];
  }

  const preset = [40, 25, 20, 15];
  return muscles.slice(0, 4).map((name, index) => ({
    name,
    percent: preset[index],
    colorClass: MUSCLE_BAR_COLORS[index % MUSCLE_BAR_COLORS.length],
  }));
};

export function ExerciseVideoScreen({ onBack, exercise }: ExerciseVideoScreenProps) {
  useScreenshotProtection();
  const language = getActiveLanguage(getStoredLanguage());
  const copy = EXERCISE_VIDEO_I18N[language] || EXERCISE_VIDEO_I18N.en;
  const storedUser = getStoredAppUser();
  const [themeRefreshKey, setThemeRefreshKey] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const clickTimerRef = useRef<number | null>(null);
  const holdTimerRef = useRef<number | null>(null);
  const rewindIntervalRef = useRef<number | null>(null);
  const wasPlayingBeforeHoldRef = useRef(false);
  const holdActiveRef = useRef(false);
  const ignoreNextClickRef = useRef(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [videoCurrentTime, setVideoCurrentTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [catalogPrimaryMuscleDistribution, setCatalogPrimaryMuscleDistribution] = useState<MuscleDistributionEntry[]>([]);
  const displayExerciseName = getDisplayExerciseName(exercise?.name);
  const isCardioContext = isCardioExerciseContext(exercise);
  const isGirlsTheme = (() => {
    void themeRefreshKey;
    return shouldUseGirlsExerciseVideoTheme(storedUser, readExerciseVideoStyleGender());
  })();
  const preferredMediaAudience = isGirlsTheme ? 'female' : 'male';
  const cardioGuideVideoUrl = preferredMediaAudience === 'female'
    ? cardioWomanVideoUrl
    : cardioManVideoUrl;
  const pageClassName = isGirlsTheme
    ? 'flex-1 flex flex-col h-full overflow-y-auto px-4 sm:px-6 bg-[radial-gradient(circle_at_top_left,rgba(249,178,215,0.22),transparent_34%),radial-gradient(circle_at_85%_8%,rgba(207,236,243,0.34),transparent_32%),linear-gradient(180deg,#FFF5F5_0%,#F7D6D0_52%,#FFF5F5_100%)] text-[#4A4A4A]'
    : 'flex-1 flex flex-col h-full bg-background overflow-y-auto px-4 sm:px-6';
  const videoFrameClassName = isGirlsTheme
    ? 'relative mb-6 flex w-full items-center justify-center overflow-hidden rounded-2xl border border-[#E2B4BD]/55 bg-[linear-gradient(145deg,rgba(255,255,255,0.76),rgba(255,245,245,0.64)_48%,rgba(207,236,243,0.20))] shadow-[0_18px_42px_rgba(226,180,189,0.20)] ring-1 ring-white/45'
    : 'relative mb-6 flex w-full items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-black';
  const videoElementClassName = isGirlsTheme
    ? 'block max-h-[72vh] w-full bg-[#FFF5F5] object-contain'
    : 'block max-h-[72vh] w-full bg-black object-contain';
  const backButtonClassName = isGirlsTheme
    ? 'flex h-10 w-10 items-center justify-center rounded-xl border border-[#E2B4BD]/55 bg-white/70 text-[#4A4A4A] backdrop-blur-md transition-colors hover:border-[#F9B2D7]/70'
    : 'flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-black/45 text-white backdrop-blur-md transition-colors hover:border-accent/40';
  const musclePillClassName = isGirlsTheme
    ? 'px-2 py-1 bg-white/70 backdrop-blur-md rounded text-[10px] font-bold text-[#4A4A4A] uppercase border border-[#E2B4BD]/45'
    : 'px-2 py-1 bg-black/60 backdrop-blur-md rounded text-[10px] font-bold text-white uppercase border border-white/10';
  const timelineTrackClassName = isGirlsTheme
    ? 'h-1.5 w-full cursor-pointer appearance-none rounded-full bg-[#E2B4BD]/45 outline-none accent-[#F9B2D7]'
    : 'h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/20 outline-none accent-accent';
  const timelineTextClassName = isGirlsTheme
    ? 'text-[10px] font-semibold tabular-nums text-[#4A4A4A]'
    : 'text-[10px] font-semibold tabular-nums text-white/85';
  const explicitTargetMuscles = dedupeMuscles([
    ...parseTargetMuscles(exercise?.targetMuscles),
    ...parseTargetMuscles(exercise?.anatomy),
  ]);
  const inferredTargetMuscles = inferMusclesFromExerciseName(exercise?.name);
  const targetMuscles = (() => {
    const combined = dedupeMuscles([
      ...explicitTargetMuscles,
      ...inferredTargetMuscles,
      canonicalizeMuscleLabel(exercise?.muscle),
    ].filter(Boolean));
    const nonGeneral = combined.filter((entry) => normalizeLookup(entry) !== 'general');
    return nonGeneral.length > 0 ? nonGeneral : combined;
  })();
  const directMuscle = canonicalizeMuscleLabel(exercise?.muscle);
  const primaryFallbackTargets = (() => {
    if (explicitTargetMuscles.length > 0) return explicitTargetMuscles;
    if (directMuscle && directMuscle !== 'General') return [directMuscle];
    if (targetMuscles.length > 0) return targetMuscles;
    const inferredPrimary = inferMusclesFromExerciseName(exercise?.name);
    if (inferredPrimary.length > 0) return inferredPrimary.slice(0, 2);
    return ['General'];
  })();
  const fallbackPrimaryMuscleDistribution: MuscleDistributionEntry[] = getMuscleDistribution(primaryFallbackTargets);
  const primaryMuscleDistribution: MuscleDistributionEntry[] = isCardioContext
    ? []
    : catalogPrimaryMuscleDistribution.length > 0
    ? catalogPrimaryMuscleDistribution
    : fallbackPrimaryMuscleDistribution;
  const exactPrimaryMuscle = (
    toBaseMuscleGroup(primaryMuscleDistribution[0]?.baseMuscle || primaryMuscleDistribution[0]?.name)
    || ''
  );
  const primaryMuscle = isCardioContext
    ? 'Cardio'
    : (
    exactPrimaryMuscle
    || toBaseMuscleGroup(primaryFallbackTargets[0])
    || toBaseMuscleGroup(targetMuscles[0])
    || toBaseMuscleGroup(exercise?.muscle)
    || toBaseMuscleGroup(inferredTargetMuscles[0])
    || 'General'
  );
  const resolvedVideoMatch = resolveExerciseVideo({
    name: exercise?.name,
    muscle: primaryMuscle,
    bodyPart: targetMuscles.join(', ') || String(exercise?.anatomy || exercise?.muscle || ''),
    targetMuscles,
    primaryMedia: exercise?.primaryMedia,
    media: exercise?.media,
    preferredAudience: preferredMediaAudience,
  });
  const resolvedVideoUrlFromExercise = resolvedVideoMatch.url || exercise?.video || resolveExerciseVideoUrl({
    name: exercise?.name,
    muscle: primaryMuscle,
    bodyPart: targetMuscles.join(', ') || String(exercise?.anatomy || exercise?.muscle || ''),
    targetMuscles,
    primaryMedia: exercise?.primaryMedia,
    media: exercise?.media,
    preferredAudience: preferredMediaAudience,
  }) || undefined;
  const shouldUseCardioGuideVideo = isCardioContext && (
    !resolvedVideoUrlFromExercise
    || resolvedVideoUrlFromExercise === genericCardioPlaceholderVideoUrl
  );
  const resolvedVideoUrl = shouldUseCardioGuideVideo
    ? cardioGuideVideoUrl
    : resolvedVideoUrlFromExercise;
  const resolvedMediaType = shouldUseCardioGuideVideo ? 'video' : (resolvedVideoMatch.mediaType || 'video');
  const isResolvedVideo = resolvedMediaType === 'video';
  useEffect(() => {
    let cancelled = false;
    const exerciseCatalogId = Number(exercise?.exerciseCatalogId || 0) || null;
    const exerciseName = String(exercise?.name || '').trim();
    const catalogLookupMuscleHint = explicitTargetMuscles[0] || canonicalizeMuscleLabel(exercise?.muscle) || primaryMuscle;

    setCatalogPrimaryMuscleDistribution([]);
    if (!exerciseCatalogId && !exerciseName) return () => {
      cancelled = true;
    };

    const loadCatalogMuscles = async () => {
      try {
        const data = exerciseCatalogId
          ? await api.getExerciseCatalogMuscles(exerciseCatalogId)
          : await api.getExerciseCatalogMusclesByName(exerciseName, catalogLookupMuscleHint);
        if (cancelled) return;

        const nextPrimaryDistribution = getExactMuscleDistribution(
          Array.isArray(data?.primaryMuscles)
            ? data.primaryMuscles
            : Array.isArray(data?.muscles)
              ? data.muscles
              : [],
        );
        setCatalogPrimaryMuscleDistribution(nextPrimaryDistribution);
      } catch (error) {
        if (!cancelled) {
          setCatalogPrimaryMuscleDistribution([]);
          if (import.meta.env.DEV) {
            console.error('Failed to load exact exercise muscle targets:', error);
          }
        }
      }
    };

    void loadCatalogMuscles();

    return () => {
      cancelled = true;
    };
  }, [exercise?.exerciseCatalogId, exercise?.name, exercise?.muscle, explicitTargetMuscles.join('|'), primaryMuscle]);

  useEffect(() => {
    const refreshTheme = () => setThemeRefreshKey((current) => current + 1);
    window.addEventListener('repset:stored-user-changed', refreshTheme);
    window.addEventListener('repset:app-style-gender-changed', refreshTheme);
    window.addEventListener('storage', refreshTheme);
    return () => {
      window.removeEventListener('repset:stored-user-changed', refreshTheme);
      window.removeEventListener('repset:app-style-gender-changed', refreshTheme);
      window.removeEventListener('storage', refreshTheme);
    };
  }, []);

  useEffect(() => {
    setIsPlaying(false);
    setVideoCurrentTime(0);
    setVideoDuration(0);
    const video = videoRef.current;
    if (!video) return;
    video.pause();
    video.playbackRate = 1;
    video.load();
  }, [resolvedVideoUrl]);

  useEffect(() => {
    return () => {
      if (clickTimerRef.current) window.clearTimeout(clickTimerRef.current);
      if (holdTimerRef.current) window.clearTimeout(holdTimerRef.current);
      if (rewindIntervalRef.current) window.clearInterval(rewindIntervalRef.current);
    };
  }, []);

  const toLocalizedSubMuscle = (value: string) => {
    const key = String(value || '').trim().toLowerCase();
    if (language === 'ar') return AR_SUB_MUSCLE_LABELS[key] || AR_BASE_MUSCLE_LABELS[key] || value;
    if (language === 'it') return IT_SUB_MUSCLE_LABELS[key] || IT_BASE_MUSCLE_LABELS[key] || value;
    if (language === 'de') return DE_SUB_MUSCLE_LABELS[key] || DE_BASE_MUSCLE_LABELS[key] || value;
    return value;
  };

  const toLocalizedBaseMuscle = (value?: string) => {
    const key = String(value || '').trim().toLowerCase();
    if (language === 'ar') return AR_BASE_MUSCLE_LABELS[key] || value || copy.defaultMuscle;
    if (language === 'it') return IT_BASE_MUSCLE_LABELS[key] || value || copy.defaultMuscle;
    if (language === 'de') return DE_BASE_MUSCLE_LABELS[key] || value || copy.defaultMuscle;
    return value || copy.defaultMuscle;
  };

  const renderMuscleSection = (muscles: MuscleDistributionEntry[]) => {
    if (!muscles.length) return null;
    const visibleMuscles = muscles.slice(0, 3);

    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {visibleMuscles.map((muscle) => (
          <MuscleSvgBadge
            key={muscle.name}
            muscle={{
              label: toLocalizedSubMuscle(muscle.name),
              sourceName: muscle.name || muscle.baseMuscle || primaryMuscle,
            }}
            className="w-full"
            figureClassName="h-24 sm:h-28"
            themeVariant={isGirlsTheme ? 'girls' : 'default'}
          />
        ))}
      </div>
    );
  };

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      void playMediaSafely(video);
      return;
    }

    video.pause();
    setIsPlaying(false);
  };

  const toggleFullscreen = async () => {
    const video = videoRef.current;
    if (!video) return;

    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        return;
      }

      await video.requestFullscreen();
    } catch {
      // Fullscreen can be blocked by the browser if the gesture is not accepted.
    }
  };

  const handleVideoClick = () => {
    if (ignoreNextClickRef.current) {
      ignoreNextClickRef.current = false;
      return;
    }

    if (clickTimerRef.current) {
      window.clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
      void toggleFullscreen();
      return;
    }

    clickTimerRef.current = window.setTimeout(() => {
      togglePlay();
      clickTimerRef.current = null;
    }, 180);
  };

  const stopHoldScrub = () => {
    if (holdTimerRef.current) {
      window.clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }

    if (rewindIntervalRef.current) {
      window.clearInterval(rewindIntervalRef.current);
      rewindIntervalRef.current = null;
    }

    const video = videoRef.current;
    const wasHoldActive = holdActiveRef.current;
    holdActiveRef.current = false;

    if (!video) return;
    video.playbackRate = 1;

    if (wasHoldActive) {
      ignoreNextClickRef.current = true;
      if (wasPlayingBeforeHoldRef.current) {
        void playMediaSafely(video);
      } else {
        video.pause();
        setIsPlaying(false);
      }
    }
  };

  const handleVideoPointerDown = (event: PointerEvent<HTMLVideoElement>) => {
    if (event.button !== 0) return;

    const video = videoRef.current;
    if (!video) return;

    const bounds = event.currentTarget.getBoundingClientRect();
    const isLeftSide = event.clientX < bounds.left + bounds.width / 2;

    wasPlayingBeforeHoldRef.current = !video.paused;
    holdActiveRef.current = false;

    if (holdTimerRef.current) window.clearTimeout(holdTimerRef.current);
    holdTimerRef.current = window.setTimeout(() => {
      holdActiveRef.current = true;

      if (isLeftSide) {
        video.pause();
        setIsPlaying(false);
        rewindIntervalRef.current = window.setInterval(() => {
          const nextTime = Math.max(0, video.currentTime - 0.18);
          video.currentTime = nextTime;
          setVideoCurrentTime(nextTime);
        }, 90);
        return;
      }

      video.playbackRate = 2;
      void playMediaSafely(video);
    }, 280);
  };

  const handleTimelineChange = (event: { target: HTMLInputElement }) => {
    const video = videoRef.current;
    const nextTime = Number(event.target.value);
    setVideoCurrentTime(nextTime);
    if (video) video.currentTime = nextTime;
  };

  const videoTimelineMax = Math.max(videoDuration || videoCurrentTime || 0, 0);
  const videoTimelineValue = Math.min(videoCurrentTime, videoTimelineMax);

  return (
    <div className={pageClassName}>
      {/* Video Player */}
      <div
        className={videoFrameClassName}
        style={{ minHeight: 'clamp(16rem, 46vh, 24rem)', maxHeight: '72vh' }}
      >
        {resolvedVideoUrl ? (
          <>
            {isResolvedVideo ? (
              <>
                <video
                  key={resolvedVideoUrl}
                  ref={videoRef}
                  playsInline
                  disablePictureInPicture
                  preload="metadata"
                  className={`${videoElementClassName} cursor-pointer select-none`}
                  src={resolvedVideoUrl}
                  onClick={handleVideoClick}
                  onPointerDown={handleVideoPointerDown}
                  onPointerUp={stopHoldScrub}
                  onPointerLeave={stopHoldScrub}
                  onPointerCancel={stopHoldScrub}
                  onContextMenu={(event) => event.preventDefault()}
                  onLoadedMetadata={(event) => {
                    setVideoDuration(event.currentTarget.duration || 0);
                    setVideoCurrentTime(event.currentTarget.currentTime || 0);
                  }}
                  onDurationChange={(event) => setVideoDuration(event.currentTarget.duration || 0)}
                  onTimeUpdate={(event) => setVideoCurrentTime(event.currentTarget.currentTime || 0)}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  onEnded={(event) => {
                    event.currentTarget.playbackRate = 1;
                    setIsPlaying(false);
                  }}>
                </video>
                <div className="pointer-events-auto absolute bottom-3 left-4 right-4 z-10">
                  <input
                    type="range"
                    min="0"
                    max={videoTimelineMax}
                    step="0.01"
                    value={videoTimelineValue}
                    onChange={handleTimelineChange}
                    className={timelineTrackClassName}
                    aria-label="Video timeline"
                  />
                  <div className="mt-1 flex items-center justify-between">
                    <span className={timelineTextClassName}>{formatVideoTime(videoCurrentTime)}</span>
                    <span className={timelineTextClassName}>{formatVideoTime(videoDuration)}</span>
                  </div>
                </div>
              </>
            ) : (
              <ExerciseMedia
                src={resolvedVideoUrl}
                mediaType={resolvedMediaType}
                alt={displayExerciseName}
                className={videoElementClassName}
                imageProps={{ draggable: false }}
              />
            )}
          </>
        ) : (
          <div className={`flex h-full w-full items-center justify-center px-6 text-center text-sm font-semibold uppercase tracking-[0.12em] ${isGirlsTheme ? 'bg-white/55 text-[#795E67]' : 'bg-white/5 text-text-secondary'}`}>
            {copy.noVideo}
          </div>
        )}
        <div className="absolute left-4 right-4 top-4 z-10 flex items-center gap-4">
          <button
            onClick={onBack}
            className={backButtonClassName}
          >
            <ArrowLeft size={18} />
          </button>
          <h1 className="flex-1 text-base leading-tight text-white drop-shadow-md sm:text-xl">
            {displayExerciseName}
          </h1>
        </div>
        <div className="absolute bottom-12 left-4 right-4 pointer-events-none">
          <div className="flex gap-2 mt-2">
            <span className={musclePillClassName}>
              {toLocalizedBaseMuscle(primaryMuscle)}
            </span>
          </div>
        </div>
      </div>

      <div className="pb-24 space-y-6">
          {!isCardioContext ? (
            renderMuscleSection(primaryMuscleDistribution)
          ) : null}

      </div>
    </div>);

}
