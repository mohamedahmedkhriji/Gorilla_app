import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PRIMARY_LOAD_FACTORS = [1, 0.82, 0.68, 0.56];
const SECONDARY_LOAD_FACTORS = [0.62, 0.5, 0.4, 0.32];

const normalizeName = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const normalizeMuscle = (value) => {
  const key = normalizeName(value);
  if (!key) return '';

  if (/(pectoralis major upper clavicular|upper chest|upper pector|clavicular)/.test(key)) return 'Upper Chest';
  if (/(mid chest|middle chest|mid pector|sternocostal)/.test(key)) return 'Mid Chest';
  if (/(lower chest)/.test(key)) return 'Lower Chest';
  if (/(pectoralis major|chest|pec)/.test(key)) return 'Chest';
  if (/(latissimus dorsi|^lats?$|\blats?\b)/.test(key)) return 'Lats';
  if (/(rhomboid)/.test(key)) return 'Rhomboids';
  if (/(traps? upper|upper trapezius)/.test(key)) return 'Upper Traps';
  if (/(traps? mid|middle trapezius|mid trap)/.test(key)) return 'Mid Traps';
  if (/(traps? lower|lower trapezius)/.test(key)) return 'Lower Traps';
  if (/(traps?|trapezius)/.test(key)) return 'Traps';
  if (/(erector spinae|spinae|lower back)/.test(key)) return 'Lower Back';
  if (/(upper back|middle back)/.test(key)) return 'Upper Back';
  if (/(rear delts?|posterior deltoid|posterior deltoids|rear deltoids)/.test(key)) return 'Rear Delts';
  if (/(side delts?|lateral deltoid|lateral deltoids|medial deltoid|medial deltoids)/.test(key)) return 'Side Delts';
  if (/(front delts?|anterior deltoid|anterior deltoids)/.test(key)) return 'Front Delts';
  if (/(deltoids anterior lateral)/.test(key)) return 'Front Delts';
  if (/(shoulders?|deltoids?)/.test(key)) return 'Shoulders';
  if (/(long head biceps)/.test(key)) return 'Long Head Biceps';
  if (/(short head biceps)/.test(key)) return 'Short Head Biceps';
  if (/(biceps brachii|biceps)/.test(key)) return 'Biceps';
  if (/(brachioradialis)/.test(key)) return 'Forearms';
  if (/(brachialis)/.test(key)) return 'Brachialis';
  if (/(triceps brachii|triceps)/.test(key)) return 'Triceps';
  if (/(forearm|wrist extensor|grip)/.test(key)) return 'Forearms';
  if (/(rectus abdominis|abs|abdominals)/.test(key)) return 'Abs';
  if (/(obliques)/.test(key)) return 'Obliques';
  if (/(core|transverse abdominis)/.test(key)) return 'Abs';
  if (/(quadriceps|quadricep|quads?)/.test(key)) return 'Quadriceps';
  if (/(hamstrings?)/.test(key)) return 'Hamstrings';
  if (/(gluteus medius|gluteus minimus|glutes?|gluteus maximus)/.test(key)) return 'Glutes';
  if (/(gastrocnemius|soleus|calves?)/.test(key)) return 'Calves';
  if (/(adductor|abductor)/.test(key)) return 'Glutes';
  if (/(hip flexor)/.test(key)) return 'Abs';
  if (/(supraspinatus)/.test(key)) return 'Side Delts';
  if (/(serratus)/.test(key)) return 'Serratus';
  if (/(rotator cuff|external rotator|infraspinatus|teres minor)/.test(key)) return 'Shoulders';

  return String(value || '').trim();
};

const dedupeMuscles = (values = []) => {
  const seen = new Set();
  const result = [];

  values.forEach((value) => {
    const muscle = normalizeMuscle(value);
    const key = normalizeName(muscle);
    if (!key) return;
    if (key === 'none' || key === 'no significant stabilizers') return;
    if (seen.has(key)) return;
    seen.add(key);
    result.push(muscle);
  });

  return result;
};

const RAW_MUSCLE_PROFILES = {
  'abs circuit': { primary: ['Abs'], secondary: ['Obliques'] },
  'assisted dip': { primary: ['Triceps', 'Chest'], secondary: ['Front Delts'] },
  'back squat': { primary: ['Quadriceps'], secondary: ['Glutes', 'Hamstrings', 'Abs', 'Lower Back'] },
  'barbell bench press': { primary: ['Chest'], secondary: ['Front Delts', 'Triceps'] },
  'barbell bent over row': { primary: ['Lats', 'Rhomboids', 'Mid Traps'], secondary: ['Biceps', 'Rear Delts', 'Lower Back'] },
  'barbell hip thrust': { primary: ['Glutes'], secondary: ['Hamstrings'] },
  'bent over reverse dumbbell flye': { primary: ['Rear Delts'], secondary: ['Rhomboids', 'Mid Traps'] },
  'bicycle crunch': { primary: ['Abs', 'Obliques'], secondary: [] },
  'cable flye': { primary: ['Chest'], secondary: ['Front Delts'] },
  'cable lateral raise': { primary: ['Side Delts'], secondary: ['Front Delts', 'Traps'] },
  'cable reverse fly': { primary: ['Rear Delts'], secondary: ['Rhomboids', 'Mid Traps'] },
  'cable seated row': { primary: ['Lats', 'Rhomboids', 'Mid Traps'], secondary: ['Biceps', 'Rear Delts'] },
  'cable curl pushdown superset': { primary: ['Biceps'], secondary: ['Brachialis', 'Forearms'] },
  'cable tricep kickback': { primary: ['Triceps'], secondary: [] },
  'chest supported t bar row': { primary: ['Lats', 'Rhomboids', 'Mid Traps'], secondary: ['Biceps', 'Rear Delts'] },
  'close grip bench press': { primary: ['Triceps'], secondary: ['Chest', 'Front Delts'] },
  crunch: { primary: ['Abs'], secondary: ['Obliques'] },
  deadlift: { primary: ['Hamstrings', 'Glutes', 'Lower Back'], secondary: ['Traps', 'Forearms', 'Quadriceps'] },
  'dumbbell floor press': { primary: ['Triceps'], secondary: ['Chest', 'Front Delts'] },
  'dumbbell incline press': { primary: ['Upper Chest'], secondary: ['Front Delts', 'Triceps'] },
  'incline dumbbell bench press': { primary: ['Upper Chest'], secondary: ['Front Delts', 'Triceps'] },
  'machine incline chest press': { primary: ['Upper Chest'], secondary: ['Front Delts', 'Triceps'] },
  'dumbbell lateral raise': { primary: ['Side Delts'], secondary: ['Front Delts', 'Upper Traps'] },
  'lateral raise': { primary: ['Side Delts'], secondary: ['Front Delts', 'Upper Traps'] },
  'dumbbell row': { primary: ['Lats', 'Rhomboids', 'Mid Traps'], secondary: ['Biceps', 'Rear Delts'] },
  'dumbbell seated shoulder press': { primary: ['Front Delts', 'Side Delts'], secondary: ['Triceps', 'Traps'] },
  'seated shoulder press': { primary: ['Front Delts', 'Side Delts'], secondary: ['Triceps', 'Traps'] },
  'dumbbell single leg hip thrust': { primary: ['Glutes'], secondary: ['Hamstrings'] },
  'dumbbell skull crusher': { primary: ['Triceps'], secondary: [] },
  'dumbbell supinated curl': { primary: ['Biceps'], secondary: ['Brachialis', 'Forearms'] },
  'dumbbell walking lunge': { primary: ['Quadriceps', 'Glutes'], secondary: ['Hamstrings', 'Calves'] },
  'ez bar curl': { primary: ['Biceps'], secondary: ['Brachialis', 'Forearms'] },
  'fst 7 curl': { primary: ['Biceps'], secondary: ['Brachialis', 'Forearms'] },
  'goblet squat': { primary: ['Quadriceps'], secondary: ['Glutes', 'Hamstrings', 'Abs'] },
  'hammer curl': { primary: ['Brachialis', 'Forearms'], secondary: ['Biceps'] },
  'hanging leg raise': { primary: ['Abs'], secondary: ['Obliques'] },
  'lat pulldown': { primary: ['Lats'], secondary: ['Biceps', 'Rhomboids', 'Mid Traps'] },
  'leg curl': { primary: ['Hamstrings'], secondary: ['Calves'] },
  'lying leg curl': { primary: ['Hamstrings'], secondary: ['Calves'] },
  'seated leg curl': { primary: ['Hamstrings'], secondary: ['Calves'] },
  'leg extension': { primary: ['Quadriceps'], secondary: [] },
  'leg press': { primary: ['Quadriceps'], secondary: ['Glutes', 'Hamstrings'] },
  'machine seated hip abduction': { primary: ['Glutes'], secondary: [] },
  'neutral grip pulldown': { primary: ['Lats'], secondary: ['Biceps', 'Brachialis', 'Rhomboids'] },
  'overhead press': { primary: ['Front Delts', 'Side Delts'], secondary: ['Triceps', 'Upper Traps'] },
  'pec deck': { primary: ['Chest'], secondary: ['Front Delts'] },
  plank: { primary: ['Abs'], secondary: ['Shoulders', 'Glutes'] },
  'rope pushdown': { primary: ['Triceps'], secondary: [] },
  'reverse grip lat pulldown': { primary: ['Lats', 'Biceps'], secondary: ['Rhomboids', 'Mid Traps'] },
  'reverse grip lat pulldown gethin variation': { primary: ['Lats', 'Biceps'], secondary: ['Rhomboids', 'Mid Traps'] },
  'reverse pec deck': { primary: ['Rear Delts'], secondary: ['Rhomboids', 'Mid Traps'] },
  'romanian deadlift': { primary: ['Hamstrings', 'Glutes'], secondary: ['Lower Back'] },
  rdl: { primary: ['Hamstrings', 'Glutes'], secondary: ['Lower Back'] },
  'seated face pull': { primary: ['Rear Delts', 'Mid Traps', 'Rhomboids'], secondary: ['Shoulders'] },
  'single arm cable curl': { primary: ['Biceps'], secondary: ['Brachialis', 'Forearms'] },
  'single arm pulldown': { primary: ['Lats'], secondary: ['Biceps', 'Rhomboids', 'Traps'] },
  'single arm rope tricep extension': { primary: ['Triceps'], secondary: [] },
  'single leg leg extension': { primary: ['Quadriceps'], secondary: [] },
  'single leg lying leg curl': { primary: ['Hamstrings'], secondary: ['Calves'] },
  'standing calf raise': { primary: ['Calves'], secondary: [] },
  'hip thrust': { primary: ['Glutes'], secondary: ['Hamstrings'] },
};

const ALIASES = {
  'fst 7 rope pushdown': 'rope pushdown',
  'incline db': 'incline dumbbell bench press',
  'incline db press': 'incline dumbbell bench press',
  'incline db bench press': 'incline dumbbell bench press',
  'incline dumbbell press': 'incline dumbbell bench press',
  'incline bench press dumbbell': 'incline dumbbell bench press',
  'incline chest press': 'machine incline chest press',
  'machine incline press': 'machine incline chest press',
  'incline machine press': 'machine incline chest press',
  'reverse grip lat pulldown': 'reverse grip lat pulldown',
  'reverse grip pulldown': 'reverse grip lat pulldown',
  'face pull': 'seated face pull',
};

const BODY_PART_ALIASES = {
  'cable curl pushdown superset': {
    biceps: 'ez bar curl',
    triceps: 'rope pushdown',
    arms: 'ez bar curl',
    default: 'ez bar curl',
  },
  'cable curl and pushdown superset': {
    biceps: 'ez bar curl',
    triceps: 'rope pushdown',
    arms: 'ez bar curl',
    default: 'ez bar curl',
  },
  'seated curl': {
    legs: 'seated leg curl',
    arms: 'ez bar curl',
    default: 'seated leg curl',
  },
  'lying curl': {
    legs: 'lying leg curl',
    default: 'lying leg curl',
  },
  'fst 7 curl': {
    legs: 'seated leg curl',
    arms: 'ez bar curl',
    default: 'ez bar curl',
  },
  'fst 7 leg curl': {
    default: 'seated leg curl',
  },
};

const getBodyPartContext = (...values) => {
  const haystack = normalizeName(values.filter(Boolean).join(' '));
  if (!haystack) return '';
  if (/(bicep)/.test(haystack)) return 'biceps';
  if (/(tricep)/.test(haystack)) return 'triceps';
  if (/(hamstring|glute|calf|quad|thigh|leg)/.test(haystack)) return 'legs';
  if (/(bicep|tricep|forearm|arm)/.test(haystack)) return 'arms';
  if (/(chest|pect|pec)/.test(haystack)) return 'chest';
  if (/(back|lat|trap|rhomboid|erector)/.test(haystack)) return 'back';
  if (/(shoulder|delt)/.test(haystack)) return 'shoulders';
  if (/(abs|abdom|core|oblique)/.test(haystack)) return 'abs';
  return '';
};

const stripLeadingContext = (value) =>
  normalizeName(value)
    .replace(/^\d+\s+/, '')
    .replace(/^(chest|back|legs?|shoulders?|arms?|abs)\s+/, '')
    .trim();

const PROFILE_KEYS = Object.keys(RAW_MUSCLE_PROFILES);

const getProfileKeyFromName = ({ name, bodyPart, muscleHint } = {}) => {
  const candidates = [
    normalizeName(name),
    stripLeadingContext(name),
  ].filter(Boolean);
  const context = getBodyPartContext(bodyPart, muscleHint);

  for (const candidate of candidates) {
    const bodyPartAlias = BODY_PART_ALIASES[candidate];
    if (bodyPartAlias) {
      const resolved = bodyPartAlias[context] || bodyPartAlias.default || null;
      if (resolved && RAW_MUSCLE_PROFILES[resolved]) return resolved;
    }

    if (RAW_MUSCLE_PROFILES[candidate]) return candidate;

    const alias = ALIASES[candidate];
    if (alias && RAW_MUSCLE_PROFILES[alias]) return alias;
  }

  for (const candidate of candidates) {
    const fuzzyMatch = PROFILE_KEYS
      .filter((key) => candidate.includes(key) || key.includes(candidate))
      .sort((left, right) => right.length - left.length)[0];
    if (fuzzyMatch) return fuzzyMatch;
  }

  return null;
};

const buildRowsForSection = ({
  muscles = [],
  role,
  loadFactors,
  bodyPart = null,
}) =>
  dedupeMuscles(muscles).map((muscle, index) => ({
    body_part: bodyPart,
    muscle_group: muscle,
    role,
    load_factor: loadFactors[index] ?? loadFactors[loadFactors.length - 1] ?? 1,
    is_primary: role === 'target' ? 1 : 0,
  }));

export const getExerciseFallbackMuscleRows = ({
  name,
  bodyPart = null,
  muscleHint = null,
} = {}) => {
  const key = getProfileKeyFromName({ name, bodyPart, muscleHint });
  if (!key) return [];

  const profile = RAW_MUSCLE_PROFILES[key];
  if (!profile) return [];

  const rows = [
    ...buildRowsForSection({
      muscles: profile.primary,
      role: 'target',
      loadFactors: PRIMARY_LOAD_FACTORS,
      bodyPart,
    }),
    ...buildRowsForSection({
      muscles: profile.secondary,
      role: 'secondary',
      loadFactors: SECONDARY_LOAD_FACTORS,
      bodyPart,
    }),
  ];

  return rows.filter(Boolean);
};

export const exerciseMuscleProfilesMeta = {
  loadedFrom: path.join(__dirname, 'exerciseMuscleProfiles.js'),
  profileCount: Object.keys(RAW_MUSCLE_PROFILES).length,
};
