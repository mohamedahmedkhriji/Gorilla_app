import { useEffect, useRef, useState } from 'react';
import { Card } from '../ui/Card';
import { ArrowLeft, Play } from 'lucide-react';
import { getBodyPartImage } from '../../services/bodyPartTheme';
import { api } from '../../services/api';
import { resolveExerciseVideoUrl } from '../../services/exerciseVideos';
import { AppLanguage, getActiveLanguage, getStoredLanguage } from '../../services/language';
import { stripExercisePrefix } from '../../services/exerciseName';
import { playMediaSafely } from '../../shared/mediaPlayback';
import backLatsImageUrl from '../../../assets/Workout/body part/back/Lates.png';
import backUpperImageUrl from '../../../assets/Workout/body part/back/upper back.png';
import backLowerImageUrl from '../../../assets/Workout/body part/back/lower back.png';

interface ExerciseVideoScreenProps {
  onBack: () => void;
  exercise?: {
    name: string;
    muscle?: string;
    video?: string | null;
    exerciseCatalogId?: number | null;
    targetMuscles?: string | string[];
    importance?: string;
    anatomy?: string | string[];
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

const BACK_LATS_IMAGE = backLatsImageUrl;
const BACK_UPPER_IMAGE = backUpperImageUrl;
const BACK_LOWER_IMAGE = backLowerImageUrl;

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

const EXERCISE_VIDEO_I18N: Record<AppLanguage, {
  muscleDistributionTitle: string;
  noVideo: string;
  defaultMuscle: string;
}> = {
  en: {
    muscleDistributionTitle: 'Muscle Distribution (Plan Target)',
    noVideo: 'No linked video yet for this exercise',
    defaultMuscle: 'Chest',
  },
  ar: {
    muscleDistributionTitle: 'توزيع العضلات (هدف الخطة)',
    noVideo: 'لا يوجد فيديو مرتبط بهذا التمرين بعد',
    defaultMuscle: 'الصدر',
  },
  it: {
    muscleDistributionTitle: 'Distribuzione Muscolare (Target del Piano)',
    noVideo: 'Nessun video collegato ancora per questo esercizio',
    defaultMuscle: 'Petto',
  },
  de: {
    muscleDistributionTitle: 'Muskelverteilung (Plan-Ziel)',
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

const SEGMENT_COUNT = 10;

const clampPercent = (value: number) => Math.max(0, Math.min(100, value));

const getActiveSegments = (percent: number) =>
  Math.round((clampPercent(percent) / 100) * SEGMENT_COUNT);

const getSegmentColor = (index: number, isActive: boolean) => {
  const ratio = SEGMENT_COUNT <= 1 ? 0 : index / (SEGMENT_COUNT - 1);
  if (isActive) {
    // Yellow -> Green progression across active segments
    const hue = 60 + (ratio * 60);
    const saturation = 90;
    const lightness = 48;
    return `hsl(${hue} ${saturation}% ${lightness}%)`;
  }
  return 'rgb(39, 46, 52)';
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
  let remaining = 100 - rounded.reduce((sum, value) => sum + value, 0);

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

const resolveWorkoutMuscleImage = (muscleName?: string, muscleGroup?: string) => {
  const normalizedMuscle = normalizeLookup(muscleName);
  const normalizedGroup = normalizeLookup(muscleGroup);

  if (normalizedMuscle.includes('lat')) {
    return BACK_LATS_IMAGE;
  }

  if (normalizedMuscle.includes('lower back') || normalizedMuscle.includes('erector')) {
    return BACK_LOWER_IMAGE;
  }

  if (
    normalizedMuscle.includes('upper back')
    || normalizedMuscle.includes('middle back')
    || normalizedMuscle.includes('back')
    || normalizedMuscle.includes('trap')
    || normalizedMuscle.includes('rhomboid')
    || normalizedGroup.includes('back')
  ) {
    return BACK_UPPER_IMAGE;
  }

  return null;
};

const resolveTargetMuscleImage = (muscleName?: string, muscleGroup?: string) => {
  const specificImage = resolveWorkoutMuscleImage(muscleName, muscleGroup);
  if (specificImage) return specificImage;

  // Prefer detailed theme image using both muscle label and group context.
  return getBodyPartImage(`${muscleName || ''} ${muscleGroup || ''}`.trim() || 'General');
};

export function ExerciseVideoScreen({ onBack, exercise }: ExerciseVideoScreenProps) {
  const language = getActiveLanguage(getStoredLanguage());
  const isArabic = language === 'ar';
  const copy = EXERCISE_VIDEO_I18N[language] || EXERCISE_VIDEO_I18N.en;
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [catalogMuscleDistribution, setCatalogMuscleDistribution] = useState<MuscleDistributionEntry[]>([]);
  const displayExerciseName = getDisplayExerciseName(exercise?.name);
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
  const exactPrimaryMuscle = (
    toBaseMuscleGroup(catalogMuscleDistribution[0]?.baseMuscle || catalogMuscleDistribution[0]?.name)
    || ''
  );
  const primaryMuscle = (
    exactPrimaryMuscle
    || toBaseMuscleGroup(targetMuscles[0])
    || toBaseMuscleGroup(exercise?.muscle)
    || toBaseMuscleGroup(inferredTargetMuscles[0])
    || 'General'
  );
  const resolvedVideoUrl = exercise?.video || resolveExerciseVideoUrl({
    name: exercise?.name,
    muscle: primaryMuscle,
    bodyPart: targetMuscles.join(', ') || String(exercise?.anatomy || exercise?.muscle || ''),
    targetMuscles,
  }) || undefined;
  const conservativeFallbackTargets = (() => {
    if (explicitTargetMuscles.length > 0) return explicitTargetMuscles;
    const directMuscle = canonicalizeMuscleLabel(exercise?.muscle);
    if (directMuscle && directMuscle !== 'General') return [directMuscle];
    if (primaryMuscle && primaryMuscle !== 'General') return [primaryMuscle];
    return ['General'];
  })();
  const fallbackMuscleDistribution: MuscleDistributionEntry[] = getMuscleDistribution(conservativeFallbackTargets);
  const muscleDistribution: MuscleDistributionEntry[] = catalogMuscleDistribution.length > 0
    ? catalogMuscleDistribution
    : fallbackMuscleDistribution;
  const fallbackPosterUrl = resolveTargetMuscleImage(
    muscleDistribution[0]?.name,
    muscleDistribution[0]?.baseMuscle || primaryMuscle,
  );

  useEffect(() => {
    let cancelled = false;
    const exerciseCatalogId = Number(exercise?.exerciseCatalogId || 0) || null;
    const exerciseName = String(exercise?.name || '').trim();
    const catalogLookupMuscleHint = explicitTargetMuscles[0] || canonicalizeMuscleLabel(exercise?.muscle) || primaryMuscle;

    setCatalogMuscleDistribution([]);
    if (!exerciseCatalogId && !exerciseName) return () => {
      cancelled = true;
    };

    const loadCatalogMuscles = async () => {
      try {
        const data = exerciseCatalogId
          ? await api.getExerciseCatalogMuscles(exerciseCatalogId)
          : await api.getExerciseCatalogMusclesByName(exerciseName, catalogLookupMuscleHint);
        if (cancelled) return;

        const nextDistribution = getExactMuscleDistribution(
          Array.isArray(data?.muscles) ? data.muscles : [],
        );
        setCatalogMuscleDistribution(nextDistribution);
      } catch (error) {
        if (!cancelled) {
          setCatalogMuscleDistribution([]);
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
    setIsPlaying(false);
    const video = videoRef.current;
    if (!video) return;
    video.pause();
    video.load();
  }, [resolvedVideoUrl]);

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

  return (
    <div className="flex-1 flex flex-col h-full bg-background overflow-y-auto px-4 sm:px-6">
      {/* Video Player */}
      <div
        className="relative mb-6 flex w-full items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-black"
        style={{ minHeight: 'clamp(16rem, 46vh, 24rem)', maxHeight: '72vh' }}
      >
        {resolvedVideoUrl ? (
          <>
            <video
              key={resolvedVideoUrl}
              ref={videoRef}
              controls
              playsInline
              preload="metadata"
              poster={fallbackPosterUrl}
              className="block max-h-[72vh] w-full bg-black object-contain"
              src={resolvedVideoUrl}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onEnded={() => setIsPlaying(false)}>
            </video>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
              {!isPlaying && (
                <div onClick={togglePlay} className="w-16 h-16 rounded-full bg-accent/90 flex items-center justify-center text-black shadow-glow cursor-pointer pointer-events-auto">
                  <Play size={24} fill="currentColor" className="ml-1" />
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-white/5 px-6 text-center text-sm font-semibold uppercase tracking-[0.12em] text-text-secondary">
            {copy.noVideo}
          </div>
        )}
        <div className="absolute left-4 right-4 top-4 z-10 flex items-center gap-4">
          <button
            onClick={onBack}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-black/45 text-white backdrop-blur-md transition-colors hover:border-accent/40"
          >
            <ArrowLeft size={18} />
          </button>
          <h1 className="flex-1 text-base leading-tight text-white drop-shadow-md sm:text-xl">
            {displayExerciseName}
          </h1>
        </div>
        <div className="absolute bottom-4 left-4 right-4 pointer-events-none">
          <div className="flex gap-2 mt-2">
            <span className="px-2 py-1 bg-black/60 backdrop-blur-md rounded text-[10px] font-bold text-white uppercase border border-white/10">
              {toLocalizedBaseMuscle(primaryMuscle)}
            </span>
          </div>
        </div>
      </div>

      <div className="pb-24 space-y-6">
          <Card translate="no">
            <h3 className="mb-4 font-medium text-white">{copy.muscleDistributionTitle}</h3>
            <div className="mb-5 grid grid-cols-3 gap-3">
              {muscleDistribution.map((muscle) => {
                const displayName = toLocalizedSubMuscle(muscle.name);
                return (
                  <div
                    key={`${muscle.name}-image`}
                    className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]"
                  >
                    <img
                      src={resolveTargetMuscleImage(muscle.name, muscle.baseMuscle || primaryMuscle)}
                      alt={displayName}
                      className="h-24 w-full object-cover object-center sm:h-28"
                      loading="lazy"
                    />
                    <div className="border-t border-white/10 px-3 py-2 text-center text-[11px] font-medium text-text-secondary">
                      {displayName}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="space-y-3">
              {muscleDistribution.map((muscle) => (
                <div key={muscle.name}>
                  <div className="mb-1 flex justify-between text-xs text-text-secondary">
                    <span>{toLocalizedSubMuscle(muscle.name)}</span>
                    <span className="font-electrolize">{muscle.percent}%</span>
                  </div>
                  <div className="mt-1 rounded-md border border-white/10 bg-white/[0.02] p-1">
                    <div className="flex h-2 items-center gap-1">
                      {Array.from({ length: SEGMENT_COUNT }, (_, index) => {
                        const isActive = index < getActiveSegments(muscle.percent);
                        return (
                          <div
                            key={`${muscle.name}-segment-${index}`}
                            className="h-full flex-1 rounded-[2px] transition-colors duration-300"
                            style={{ backgroundColor: getSegmentColor(index, isActive) }}
                          />
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

      </div>
    </div>);

}
