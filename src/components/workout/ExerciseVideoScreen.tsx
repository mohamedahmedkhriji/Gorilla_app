import { useEffect, useRef, useState } from 'react';
import { Card } from '../ui/Card';
import { ArrowLeft, Play } from 'lucide-react';
import { getBodyPartImage } from '../../services/bodyPartTheme';
import { resolveExerciseVideoUrl } from '../../services/exerciseVideos';
import { AppLanguage, getActiveLanguage, getStoredLanguage } from '../../services/language';
import { stripExercisePrefix } from '../../services/exerciseName';
import { playMediaSafely } from '../../shared/mediaPlayback';

interface ExerciseVideoScreenProps {
  onBack: () => void;
  exercise?: {
    name: string;
    muscle?: string;
    video?: string | null;
    targetMuscles?: string | string[];
    importance?: string;
    anatomy?: string | string[];
  };
}

const BACK_LATS_IMAGE = '/assets/Workout/body%20part/back/Lates.png';
const BACK_UPPER_IMAGE = '/assets/Workout/body%20part/back/upper%20back.png';
const BACK_LOWER_IMAGE = '/assets/Workout/body%20part/back/lower%20back.png';

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

  if (key.includes('upper chest')) return 'Upper Chest';
  if (key.includes('mid chest') || key.includes('middle chest')) return 'Mid Chest';
  if (key.includes('lower chest')) return 'Lower Chest';
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
  if (key.includes('shoulder') || key.includes('delt')) return 'Shoulders';
  if (key.includes('tricep') || key.includes('triceps brachii')) return 'Triceps';
  if (key.includes('bicep') || key.includes('biceps brachii')) return 'Biceps';
  if (key.includes('chest') || key.includes('pect') || key.includes('pec')) return 'Chest';
  if (key.includes('back') || key.includes('trap') || key.includes('rhomboid')) return 'Back';
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

  if (/bench|chest|fly|push-up|push up|pec deck|incline (db|dumbbell|barbell|machine|smith)? ?press|machine press|hammer strength press|weighted dip|dip/.test(name)) matches.push('Chest', 'Triceps', 'Shoulders');
  if (/deadlift|row|pull-up|pull up|pullup|chin-up|chin up|chinup|pulldown|pullover|lat pulldown|lat pull|rack pull/.test(name)) matches.push('Back', 'Biceps', 'Forearms');
  if (/squat|leg press|leg extension|lunge|split squat|step up|hip thrust/.test(name)) matches.push('Quadriceps', 'Hamstrings', 'Calves');
  if (/romanian deadlift|rdl|leg curl|hamstring/.test(name)) matches.push('Hamstrings');
  if (/shoulder|overhead press|lateral raise|\blateral\b|rear delt|face pull|arnold press|seated db press|seated shoulder press|machine shoulder press/.test(name)) matches.push('Shoulders', 'Triceps');
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

const BACK_MUSCLE_DISTRIBUTION = [
  { name: 'Upper Back', colorClass: MUSCLE_BAR_COLORS[0] },
  { name: 'Lats', colorClass: MUSCLE_BAR_COLORS[1] },
  { name: 'Lower Back', colorClass: MUSCLE_BAR_COLORS[2] },
];

const CHEST_MUSCLE_DISTRIBUTION = [
  { name: 'Upper Chest', colorClass: MUSCLE_BAR_COLORS[0] },
  { name: 'Mid Chest', colorClass: MUSCLE_BAR_COLORS[1] },
  { name: 'Lower Chest', colorClass: MUSCLE_BAR_COLORS[2] },
];

const BICEPS_MUSCLE_DISTRIBUTION = [
  { name: 'Long Head Biceps', colorClass: MUSCLE_BAR_COLORS[0] },
  { name: 'Short Head Biceps', colorClass: MUSCLE_BAR_COLORS[1] },
  { name: 'Brachialis', colorClass: MUSCLE_BAR_COLORS[2] },
];

const ABS_MUSCLE_DISTRIBUTION = [
  { name: 'Upper Abs', colorClass: MUSCLE_BAR_COLORS[0] },
  { name: 'Obliques', colorClass: MUSCLE_BAR_COLORS[1] },
  { name: 'Lower Abs', colorClass: MUSCLE_BAR_COLORS[2] },
];

const SHOULDERS_MUSCLE_DISTRIBUTION = [
  { name: 'Front Delts', colorClass: MUSCLE_BAR_COLORS[0] },
  { name: 'Side Delts', colorClass: MUSCLE_BAR_COLORS[1] },
  { name: 'Rear Delts', colorClass: MUSCLE_BAR_COLORS[2] },
];

const TRICEPS_MUSCLE_DISTRIBUTION = [
  { name: 'Long Head Triceps', colorClass: MUSCLE_BAR_COLORS[0] },
  { name: 'Lateral Head Triceps', colorClass: MUSCLE_BAR_COLORS[1] },
  { name: 'Medial Head Triceps', colorClass: MUSCLE_BAR_COLORS[2] },
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

const applyDistribution = (
  template: Array<{ name: string; colorClass: string }>,
  percentages: number[],
) => template.map((muscle, index) => ({
  ...muscle,
  percent: percentages[index] ?? 0,
}));

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

const getMuscleDistribution = (muscles: string[]) => {
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

const getBackMuscleDistribution = (exerciseName?: string, videoUrl?: string) => {
  const lookup = normalizeLookup(`${exerciseName || ''} ${videoUrl || ''}`);
  let distribution = [40, 40, 20];

  if (
    lookup.includes('deadlift')
    || lookup.includes('back extension')
    || lookup.includes('hyperextension')
    || lookup.includes('good morning')
  ) {
    distribution = [30, 15, 55];
  } else if (
    lookup.includes('trap')
    || lookup.includes('shrug')
  ) {
    distribution = [65, 20, 15];
  } else if (
    lookup.includes('rear delt')
    || lookup.includes('reverse fly')
  ) {
    distribution = [55, 30, 15];
  } else if (lookup.includes('pullover')) {
    distribution = [20, 65, 15];
  } else if (lookup.includes('lower lats')) {
    distribution = [20, 50, 30];
  } else if (lookup.includes('upper lats')) {
    distribution = [45, 40, 15];
  } else if (
    lookup.includes('pull up')
    || lookup.includes('pullup')
    || lookup.includes('pull down')
    || lookup.includes('pulldown')
    || lookup.includes('lat pull')
  ) {
    distribution = [30, 55, 15];
  } else if (
    lookup.includes('bent over')
    || lookup.includes('barbell row')
    || lookup.includes('dumbbell row')
    || lookup.includes('landmine row')
  ) {
    distribution = [40, 35, 25];
  } else if (
    lookup.includes('row')
    || lookup.includes('rope pulling')
    || lookup.includes('seated row')
  ) {
    distribution = [45, 40, 15];
  }

  return applyDistribution(BACK_MUSCLE_DISTRIBUTION, distribution);
};

const getChestMuscleDistribution = (exerciseName?: string, videoUrl?: string) => {
  const lookup = normalizeLookup(`${exerciseName || ''} ${videoUrl || ''}`);
  let distribution = [30, 50, 20];

  if (
    lookup.includes('upper')
    || lookup.includes('incline')
    || lookup.includes('45')
  ) {
    distribution = [60, 25, 15];
  } else if (
    lookup.includes('lower')
    || lookup.includes('dip')
    || lookup.includes('decline')
  ) {
    distribution = [15, 30, 55];
  } else if (
    lookup.includes('middle')
    || lookup.includes('midel')
    || lookup.includes('flat')
    || lookup.includes('pec deck')
    || lookup.includes('bench press')
    || lookup.includes('guillotine')
  ) {
    distribution = [25, 55, 20];
  }

  return applyDistribution(CHEST_MUSCLE_DISTRIBUTION, distribution);
};

const getBicepsMuscleDistribution = (exerciseName?: string, videoUrl?: string) => {
  const lookup = normalizeLookup(`${exerciseName || ''} ${videoUrl || ''}`);
  let distribution = [40, 35, 25];

  if (lookup.includes('hammer')) {
    distribution = [20, 20, 60];
  } else if (lookup.includes('incline')) {
    distribution = [60, 25, 15];
  } else if (
    lookup.includes('scott')
    || lookup.includes('preacher')
  ) {
    distribution = [25, 55, 20];
  } else if (
    lookup.includes('cable')
    || lookup.includes('v ')
    || lookup.endsWith(' v')
  ) {
    distribution = [35, 45, 20];
  }

  return applyDistribution(BICEPS_MUSCLE_DISTRIBUTION, distribution);
};

const getAbsMuscleDistribution = (exerciseName?: string, videoUrl?: string) => {
  const lookup = normalizeLookup(`${exerciseName || ''} ${videoUrl || ''}`);
  let distribution = [45, 30, 25];

  if (
    lookup.includes('bicycle')
    || lookup.includes('russian')
    || lookup.includes('twist')
    || lookup.includes('side crunch')
  ) {
    distribution = [20, 55, 25];
  } else if (
    lookup.includes('leg raise')
    || lookup.includes('leg lift')
    || lookup.includes('knee raise')
    || lookup.includes('weighted leg lift')
  ) {
    distribution = [15, 25, 60];
  } else if (
    lookup.includes('crunch')
    || lookup.includes('reach')
    || lookup.includes('half crunch')
    || lookup.includes('knee tap')
  ) {
    distribution = [60, 25, 15];
  }

  return applyDistribution(ABS_MUSCLE_DISTRIBUTION, distribution);
};

const getShouldersMuscleDistribution = (exerciseName?: string, videoUrl?: string) => {
  const lookup = normalizeLookup(`${exerciseName || ''} ${videoUrl || ''}`);
  let distribution = [35, 40, 25];

  if (
    lookup.includes('front')
    || lookup.includes('overhead')
    || lookup.includes('press')
  ) {
    distribution = [60, 25, 15];
  } else if (
    lookup.includes('lateral')
    || lookup.includes('side delt')
  ) {
    distribution = [20, 65, 15];
  } else if (lookup.includes('rear delt')) {
    distribution = [15, 25, 60];
  }

  return applyDistribution(SHOULDERS_MUSCLE_DISTRIBUTION, distribution);
};

const getTricepsMuscleDistribution = (exerciseName?: string, videoUrl?: string) => {
  const lookup = normalizeLookup(`${exerciseName || ''} ${videoUrl || ''}`);
  let distribution = [45, 35, 20];

  if (
    lookup.includes('overhead')
    || lookup.includes('french press')
    || lookup.includes('skullcrusher')
  ) {
    distribution = [60, 25, 15];
  } else if (
    lookup.includes('pressdown')
    || lookup.includes('press down')
    || lookup.includes('rope')
    || lookup.includes('bar')
  ) {
    distribution = [35, 50, 15];
  } else if (lookup.includes('kickback')) {
    distribution = [40, 25, 35];
  }

  return applyDistribution(TRICEPS_MUSCLE_DISTRIBUTION, distribution);
};

const getLegsMuscleDistribution = (exerciseName?: string, videoUrl?: string) => {
  const lookup = normalizeLookup(`${exerciseName || ''} ${videoUrl || ''}`);

  if (lookup.includes('calf')) {
    return [
      { name: 'Calves', percent: 70, colorClass: MUSCLE_BAR_COLORS[0] },
      { name: 'Hamstrings', percent: 15, colorClass: MUSCLE_BAR_COLORS[1] },
      { name: 'Quadriceps', percent: 15, colorClass: MUSCLE_BAR_COLORS[2] },
    ];
  }

  if (
    lookup.includes('hamstring')
    || lookup.includes('romanian deadlift')
    || lookup.includes('rdl')
  ) {
    return [
      { name: 'Hamstrings', percent: 60, colorClass: MUSCLE_BAR_COLORS[0] },
      { name: 'Glutes', percent: 25, colorClass: MUSCLE_BAR_COLORS[1] },
      { name: 'Quadriceps', percent: 15, colorClass: MUSCLE_BAR_COLORS[2] },
    ];
  }

  if (
    lookup.includes('adductor')
    || lookup.includes('sumo')
  ) {
    return [
      { name: 'Adductors', percent: 55, colorClass: MUSCLE_BAR_COLORS[0] },
      { name: 'Glutes', percent: 30, colorClass: MUSCLE_BAR_COLORS[1] },
      { name: 'Quadriceps', percent: 15, colorClass: MUSCLE_BAR_COLORS[2] },
    ];
  }

  if (lookup.includes('glute')) {
    return [
      { name: 'Glutes', percent: 60, colorClass: MUSCLE_BAR_COLORS[0] },
      { name: 'Hamstrings', percent: 25, colorClass: MUSCLE_BAR_COLORS[1] },
      { name: 'Quadriceps', percent: 15, colorClass: MUSCLE_BAR_COLORS[2] },
    ];
  }

  return [
    { name: 'Quadriceps', percent: 60, colorClass: MUSCLE_BAR_COLORS[0] },
    { name: 'Hamstrings', percent: 25, colorClass: MUSCLE_BAR_COLORS[1] },
    { name: 'Glutes', percent: 15, colorClass: MUSCLE_BAR_COLORS[2] },
  ];
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

const detectExerciseGroup = (
  muscle?: string,
  videoUrl?: string,
  targetMuscles: string[] = [],
  exerciseName?: string,
) => {
  const lookup = normalizeLookup(`${muscle || ''} ${targetMuscles.join(' ')} ${exerciseName || ''} ${videoUrl || ''}`);

  if (lookup.includes('body part back') || lookup.includes('back')) return 'back';
  if (lookup.includes('body part chest') || lookup.includes('chest')) return 'chest';
  if (lookup.includes('body part biceps') || lookup.includes('biceps')) return 'biceps';
  if (lookup.includes('body part triceps') || lookup.includes('triceps')) return 'triceps';
  if (
    lookup.includes('body part arms')
    || lookup.includes('arms')
    || lookup.includes('forearm')
  ) {
    if (lookup.includes('tricep')) return 'triceps';
    return 'biceps';
  }
  if (lookup.includes('body part shoulder') || lookup.includes('shoulder')) return 'shoulders';
  if (lookup.includes('body part abs') || lookup.includes(' abs ') || lookup.includes('abdom') || lookup.includes('oblique') || lookup.includes('core')) return 'abs';
  if (lookup.includes('body part legs') || lookup.includes('body part calves') || lookup.includes('legs') || lookup.includes('quads') || lookup.includes('hamstring') || lookup.includes('glute') || lookup.includes('calf')) return 'legs';
  return 'general';
};

export function ExerciseVideoScreen({ onBack, exercise }: ExerciseVideoScreenProps) {
  const language = getActiveLanguage(getStoredLanguage());
  const isArabic = language === 'ar';
  const copy = EXERCISE_VIDEO_I18N[language] || EXERCISE_VIDEO_I18N.en;
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
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
  const primaryMuscle = (
    toBaseMuscleGroup(targetMuscles[0])
    || toBaseMuscleGroup(exercise?.muscle)
    || toBaseMuscleGroup(inferredTargetMuscles[0])
    || 'General'
  );
  const resolvedVideoUrl = exercise?.video || resolveExerciseVideoUrl({
    name: exercise?.name,
    muscle: primaryMuscle,
    bodyPart: targetMuscles.join(', ') || String(exercise?.anatomy || exercise?.muscle || ''),
  }) || undefined;
  const exerciseGroup = detectExerciseGroup(primaryMuscle, resolvedVideoUrl, targetMuscles, exercise?.name);
  const muscleDistribution = exerciseGroup === 'back'
    ? getBackMuscleDistribution(exercise?.name, resolvedVideoUrl)
    : exerciseGroup === 'chest'
      ? getChestMuscleDistribution(exercise?.name, resolvedVideoUrl)
      : exerciseGroup === 'biceps'
        ? getBicepsMuscleDistribution(exercise?.name, resolvedVideoUrl)
        : exerciseGroup === 'triceps'
          ? getTricepsMuscleDistribution(exercise?.name, resolvedVideoUrl)
          : exerciseGroup === 'shoulders'
            ? getShouldersMuscleDistribution(exercise?.name, resolvedVideoUrl)
            : exerciseGroup === 'abs'
              ? getAbsMuscleDistribution(exercise?.name, resolvedVideoUrl)
              : exerciseGroup === 'legs'
              ? getLegsMuscleDistribution(exercise?.name, resolvedVideoUrl)
                : getMuscleDistribution(targetMuscles);
  const fallbackPosterUrl = resolveTargetMuscleImage(muscleDistribution[0]?.name, primaryMuscle);

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
                      src={resolveTargetMuscleImage(muscle.name, primaryMuscle)}
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
