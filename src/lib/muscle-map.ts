export const BODY_MAP_MUSCLES = [
  'trapezius',
  'deltoids',
  'chest',
  'upper-back',
  'serratus',
  'biceps',
  'triceps',
  'forearm',
  'abs',
  'obliques',
  'lower-back',
  'gluteal',
  'quadriceps',
  'hamstring',
  'adductors',
  'hip-flexors',
  'calves',
  'tibialis',
] as const;

export const BODY_MAP_INERT = ['head', 'hair', 'neck', 'hands', 'feet', 'knees', 'ankles'] as const;

export const BODY_MAP_MUSCLE_NAME: Record<BodyMapMuscle, string> = {
  trapezius: 'Traps',
  deltoids: 'Shoulders',
  chest: 'Chest',
  'upper-back': 'Upper back',
  serratus: 'Serratus',
  biceps: 'Biceps',
  triceps: 'Triceps',
  forearm: 'Forearms',
  abs: 'Abs',
  obliques: 'Obliques',
  'lower-back': 'Lower back',
  gluteal: 'Glutes',
  quadriceps: 'Quads',
  hamstring: 'Hamstrings',
  adductors: 'Adductors',
  'hip-flexors': 'Hip flexors',
  calves: 'Calves',
  tibialis: 'Shins',
};

export type BodyMapMuscle = (typeof BODY_MAP_MUSCLES)[number];
export type BodyMapLevels = Partial<Record<BodyMapMuscle, number>>;

const normalizeMuscleKey = (value: unknown) => String(value || '').trim().toLowerCase();

export function recoveryMuscleToBodyMapSlugs(value: unknown): BodyMapMuscle[] {
  const key = normalizeMuscleKey(value);

  if (key.includes('chest')) return ['chest'];
  if (key.includes('trap')) return ['trapezius'];
  if (key.includes('back') || key.includes('lat')) return ['trapezius', 'upper-back', 'lower-back'];
  if (key.includes('shoulder') || key.includes('delt')) return ['deltoids'];
  if (key === 'arm' || key === 'arms') return ['biceps', 'triceps', 'forearm'];
  if (key.includes('tricep')) return ['triceps'];
  if (key.includes('bicep')) return ['biceps'];
  if (
    key.includes('forearm')
    || key.includes('fore arm')
    || key.includes('avant bra')
    || key.includes('avant bras')
    || key.includes('avant-bras')
    || key.includes('wrist')
    || key.includes('grip')
  ) return ['forearm'];
  if (key.includes('quad')) return ['quadriceps'];
  if (key.includes('hamstring')) return ['hamstring'];
  if (key.includes('glute')) return ['gluteal'];
  if (
    key.includes('calf')
    || key.includes('calves')
    || key.includes('claves')
    || key.includes('mollet')
    || key.includes('moulet')
  ) return ['calves'];
  if (
    key.includes('shin')
    || key.includes('tibia')
    || key.includes('tibialis')
    || key.includes('tibial')
  ) return ['tibialis'];
  if (
    key.includes('adductor')
    || key.includes('adducteur')
    || key.includes('addicteur')
    || key.includes('inner thigh')
  ) return ['adductors'];
  if (key.includes('hip flexor')) return ['hip-flexors'];
  if (key.includes('serratus')) return ['serratus'];
  if (
    key.includes('abs')
    || key.includes('abdominal')
    || key.includes('oblique')
    || key.includes('core')
    || key.includes('stomach')
    || key.includes('six pack')
  ) {
    return ['abs', 'obliques'];
  }

  return [];
}

export function recoveryScoreToBodyMapLevel(score: number) {
  if (score < 40) return 1;
  if (score < 70) return 2;
  if (score < 90) return 3;
  return 4;
}
