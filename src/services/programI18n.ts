import { AppLanguage } from './language';

const normalizeText = (value: unknown) => String(value || '').trim().toLowerCase();

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const replaceByMap = (value: string, replacements: Array<[string, string]>) =>
  replacements.reduce(
    (nextValue, [from, to]) => nextValue.replace(new RegExp(escapeRegExp(from), 'gi'), to),
    value,
  );

const ARABIC_EXERCISE_NAME_MAP: Record<string, string> = {
  'assisted dip': 'ديب مساعد',
  'back squat': 'سكوات خلفي',
  'barbell bench press': 'بنش برس بالبار',
  'barbell bent over row': 'تجديف بالبار مع انحناء',
  'barbell hip thrust': 'هيب ثرست بالبار',
  'barbell row': 'تجديف بالبار',
  'bench press': 'بنش برس',
  'bulgarian split squat': 'سكوات بلغاري',
  'cable chest fly': 'فلاي صدر بالكابل',
  'cable curl': 'كيرل بالكابل',
  'cable flye': 'فلاي بالكابل',
  'cable lateral raise': 'رفرفة جانبية بالكابل',
  'cable row': 'تجديف بالكابل',
  'chest supported row': 'تجديف مدعوم للصدر',
  'chest-supported t-bar row': 'تجديف تي بار مدعوم للصدر',
  deadlift: 'ديدلفت',
  'dumbbell incline press': 'ضغط مائل بالدمبل',
  'dumbbell lateral raise': 'رفرفة جانبية بالدمبل',
  'dumbbell shoulder press': 'ضغط كتف بالدمبل',
  'dumbbell supinated curl': 'كيرل دمبل قبضة مقلوبة',
  'dumbbell walking lunge': 'لانج مشي بالدمبل',
  'ez bar curl': 'كيرل EZ',
  'face pull': 'سحب للوجه',
  'flat dumbbell press': 'ضغط دمبل مسطح',
  'front squat': 'سكوات أمامي',
  'hip thrust': 'هيب ثرست',
  'incline barbell press': 'ضغط مائل بالبار',
  'incline dumbbell curl': 'كيرل دمبل مائل',
  'incline dumbbell press': 'ضغط دمبل مائل',
  'lat pulldown': 'سحب علوي',
  'leg curl': 'ثني الساق',
  'leg extension': 'تمديد الساق',
  'leg press': 'ضغط الأرجل',
  'lying leg curl': 'ثني الساق مستلقياً',
  'machine chest press': 'ضغط صدر على الجهاز',
  'machine seated hip abduction': 'إبعاد الورك جلوساً على الجهاز',
  'overhead press': 'ضغط علوي',
  'overhead triceps extension': 'تمديد ترايسبس فوق الرأس',
  'pull up': 'عقلة',
  'rear delt fly': 'رفرفة خلفية للكتف',
  'reverse-grip lat pulldown': 'سحب علوي قبضة معكوسة',
  'romanian deadlift': 'ديدلفت روماني',
  'seated calf raise': 'رفع سمانة جلوساً',
  'seated cable row': 'تجديف بالكابل جلوساً',
  'seated face pull': 'سحب للوجه جلوساً',
  'seated shoulder press': 'ضغط كتف جلوساً',
  'single arm dumbbell row': 'تجديف دمبل بذراع واحدة',
  'single-leg leg extension': 'تمديد ساق واحدة',
  'single-leg lying leg curl': 'ثني ساق واحدة مستلقياً',
  'standing calf raise': 'رفع سمانة واقفاً',
  'triceps pushdown': 'ضغط ترايسبس للأسفل',
  'triceps rope pushdown': 'ضغط ترايسبس بالحبل',
  'upright row': 'تجديف رأسي',
  'walking lunge': 'لانج مشي',
  'weighted dips': 'ديبس بالأوزان',
};

const ARABIC_WORKOUT_TYPE_MAP: Record<string, string> = {
  legs: 'أرجل',
  'lower body': 'الجزء السفلي',
  pull: 'سحب',
  push: 'دفع',
  'upper body': 'الجزء العلوي',
};

const ARABIC_SIGNAL_MAP: Record<string, string> = {
  bodybuilding: 'كمال الأجسام',
  cardio: 'الكارديو',
  endurance: 'التحمل',
  hypertrophy: 'التضخيم',
  mobility: 'المرونة',
  strength: 'القوة',
  weight_loss: 'خسارة الوزن',
};

const ARABIC_LEVEL_MAP: Record<string, string> = {
  advanced: 'متقدم',
  beginner: 'مبتدئ',
  intermediate: 'متوسط',
};

const PROGRAM_TEXT_REPLACEMENTS: Array<[string, string]> = [
  ['Strength & Bulk Plan', 'خطة القوة والتضخيم'],
  ['Upper / Lower', 'علوي / سفلي'],
  ['Upper/Lower', 'علوي/سفلي'],
  ['Current Program', 'البرنامج الحالي'],
  ['Lower Body', 'الجزء السفلي'],
  ['Upper Body', 'الجزء العلوي'],
  ['Push Hypertrophy', 'دفع للتضخيم'],
  ['Push Strength', 'دفع للقوة'],
  ['Upper Balance', 'توازن علوي'],
  ['Lower B', 'سفلي B'],
  ['Lower A', 'سفلي A'],
  ['Upper B', 'علوي B'],
  ['Upper A', 'علوي A'],
  ['Legs B', 'أرجل B'],
  ['Legs A', 'أرجل A'],
  ['Pull B', 'سحب B'],
  ['Pull A', 'سحب A'],
  ['Push B', 'دفع B'],
  ['Push A', 'دفع A'],
  ['Week', 'الأسبوع'],
  ['Program', 'برنامج'],
  ['Workout', 'تمرين'],
];

export const translateExerciseName = (value: unknown, language: AppLanguage = 'en') => {
  const text = String(value || '').trim();
  if (!text || language !== 'ar') return text;
  return ARABIC_EXERCISE_NAME_MAP[normalizeText(text)] || text;
};

export const translateWorkoutType = (value: unknown, language: AppLanguage = 'en') => {
  const text = String(value || '').trim();
  if (!text || language !== 'ar') return text;
  return ARABIC_WORKOUT_TYPE_MAP[normalizeText(text)] || text;
};

export const translateAiSignal = (value: unknown, language: AppLanguage = 'en') => {
  const text = String(value || '').trim();
  if (!text || language !== 'ar') return text;
  return ARABIC_SIGNAL_MAP[normalizeText(text).replace(/\s+/g, '_')] || text;
};

export const translateExperienceLevel = (value: unknown, language: AppLanguage = 'en') => {
  const text = String(value || '').trim();
  if (!text || language !== 'ar') return text;
  return ARABIC_LEVEL_MAP[normalizeText(text)] || text;
};

export const translateProgramText = (value: unknown, language: AppLanguage = 'en') => {
  const text = String(value || '').trim();
  if (!text || language !== 'ar') return text;
  return replaceByMap(text, PROGRAM_TEXT_REPLACEMENTS);
};
