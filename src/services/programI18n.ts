import { AppLanguage, repairMojibakeText } from './language';

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

const ITALIAN_EXERCISE_NAME_MAP: Record<string, string> = {
  'assisted dip': 'Dip assistito',
  'back squat': 'Back squat',
  'barbell bench press': 'Panca piana con bilanciere',
  'barbell bent over row': 'Rematore con bilanciere',
  'barbell hip thrust': 'Hip thrust con bilanciere',
  'barbell row': 'Rematore con bilanciere',
  'bench press': 'Panca piana',
  'bulgarian split squat': 'Bulgarian split squat',
  'cable chest fly': 'Croci ai cavi per il petto',
  'cable curl': 'Curl ai cavi',
  'cable flye': 'Croci ai cavi',
  'cable lateral raise': 'Alzate laterali ai cavi',
  'cable row': 'Rematore ai cavi',
  'chest supported row': 'Rematore con petto in appoggio',
  'chest-supported t-bar row': 'T-bar row con petto in appoggio',
  deadlift: 'Stacco da terra',
  'dumbbell incline press': 'Panca inclinata con manubri',
  'dumbbell lateral raise': 'Alzate laterali con manubri',
  'dumbbell shoulder press': 'Shoulder press con manubri',
  'dumbbell supinated curl': 'Curl supinato con manubri',
  'dumbbell walking lunge': 'Affondi camminati con manubri',
  'ez bar curl': 'Curl con barra EZ',
  'face pull': 'Face pull',
  'flat dumbbell press': 'Panca piana con manubri',
  'front squat': 'Front squat',
  'hip thrust': 'Hip thrust',
  'incline barbell press': 'Panca inclinata con bilanciere',
  'incline dumbbell curl': 'Curl inclinato con manubri',
  'incline dumbbell press': 'Panca inclinata con manubri',
  'lat pulldown': 'Lat machine',
  'leg curl': 'Leg curl',
  'leg extension': 'Leg extension',
  'leg press': 'Leg press',
  'lying leg curl': 'Leg curl sdraiato',
  'machine chest press': 'Chest press alla macchina',
  'machine seated hip abduction': 'Abduzione dell\'anca da seduto alla macchina',
  'overhead press': 'Military press',
  'overhead triceps extension': 'Estensione tricipiti sopra la testa',
  'pull up': 'Trazioni',
  'rear delt fly': 'Alzate posteriori',
  'reverse-grip lat pulldown': 'Lat machine presa inversa',
  'romanian deadlift': 'Stacco rumeno',
  'seated calf raise': 'Calf raise da seduto',
  'seated cable row': 'Rematore ai cavi da seduto',
  'seated face pull': 'Face pull da seduto',
  'seated shoulder press': 'Shoulder press da seduto',
  'single arm dumbbell row': 'Rematore con un manubrio',
  'single-leg leg extension': 'Leg extension a una gamba',
  'single-leg lying leg curl': 'Leg curl sdraiato a una gamba',
  'standing calf raise': 'Calf raise in piedi',
  'triceps pushdown': 'Pushdown tricipiti',
  'triceps rope pushdown': 'Pushdown tricipiti con corda',
  'upright row': 'Tirata al mento',
  'walking lunge': 'Affondi camminati',
  'weighted dips': 'Dip zavorrati',
};

const GERMAN_EXERCISE_NAME_MAP: Record<string, string> = {
  'assisted dip': 'Unterstutzter Dip',
  'back squat': 'Kniebeuge mit Langhantel',
  'barbell bench press': 'Langhantel-Bankdrucken',
  'barbell bent over row': 'Vorgebeugtes Langhantelrudern',
  'barbell hip thrust': 'Langhantel-Hip-Thrust',
  'barbell row': 'Langhantelrudern',
  'bench press': 'Bankdrucken',
  'bulgarian split squat': 'Bulgarische Kniebeuge',
  'cable chest fly': 'Kabel-Brustfly',
  'cable curl': 'Kabel-Curl',
  'cable flye': 'Kabel-Fly',
  'cable lateral raise': 'Kabel-Seitheben',
  'cable row': 'Kabelrudern',
  'chest supported row': 'Brustgestutztes Rudern',
  'chest-supported t-bar row': 'Brustgestutztes T-Bar-Rudern',
  deadlift: 'Kreuzheben',
  'dumbbell incline press': 'Schragbankdrucken mit Kurzhanteln',
  'dumbbell lateral raise': 'Seitheben mit Kurzhanteln',
  'dumbbell shoulder press': 'Schulterdrucken mit Kurzhanteln',
  'dumbbell supinated curl': 'Supinierter Kurzhantel-Curl',
  'dumbbell walking lunge': 'Gehende Ausfallschritte mit Kurzhanteln',
  'ez bar curl': 'EZ-Bar-Curl',
  'face pull': 'Face Pull',
  'flat dumbbell press': 'Flaches Kurzhantel-Bankdrucken',
  'front squat': 'Frontkniebeuge',
  'hip thrust': 'Hip Thrust',
  'incline barbell press': 'Schragbankdrucken mit Langhantel',
  'incline dumbbell curl': 'Schragbank-Curl mit Kurzhanteln',
  'incline dumbbell press': 'Schragbankdrucken mit Kurzhanteln',
  'lat pulldown': 'Latzug',
  'leg curl': 'Beinbeuger',
  'leg extension': 'Beinstrecker',
  'leg press': 'Beinpresse',
  'lying leg curl': 'Liegender Beinbeuger',
  'machine chest press': 'Brustpresse an der Maschine',
  'machine seated hip abduction': 'Sitzende Hip-Abduktion an der Maschine',
  'overhead press': 'Schulterdrucken',
  'overhead triceps extension': 'Trizepsstrecken uber Kopf',
  'pull up': 'Klimmzug',
  'rear delt fly': 'Reverse Fly',
  'reverse-grip lat pulldown': 'Latzug im Untergriff',
  'romanian deadlift': 'Rumanisches Kreuzheben',
  'seated calf raise': 'Wadenheben sitzend',
  'seated cable row': 'Sitzendes Kabelrudern',
  'seated face pull': 'Sitzender Face Pull',
  'seated shoulder press': 'Sitzendes Schulterdrucken',
  'single arm dumbbell row': 'Einarmiges Kurzhantelrudern',
  'single-leg leg extension': 'Einbeiniger Beinstrecker',
  'single-leg lying leg curl': 'Einbeiniger liegender Beinbeuger',
  'standing calf raise': 'Wadenheben stehend',
  'triceps pushdown': 'Trizeps-Pushdown',
  'triceps rope pushdown': 'Trizeps-Pushdown mit Seil',
  'upright row': 'Aufrechtes Rudern',
  'walking lunge': 'Gehende Ausfallschritte',
  'weighted dips': 'Dips mit Zusatzgewicht',
};

const ARABIC_WORKOUT_TYPE_MAP: Record<string, string> = {
  legs: 'أرجل',
  'lower body': 'الجزء السفلي',
  pull: 'سحب',
  push: 'دفع',
  'upper body': 'الجزء العلوي',
};

const ITALIAN_WORKOUT_TYPE_MAP: Record<string, string> = {
  legs: 'Gambe',
  'lower body': 'Parte inferiore',
  pull: 'Tirata',
  push: 'Spinta',
  'upper body': 'Parte superiore',
};

const GERMAN_WORKOUT_TYPE_MAP: Record<string, string> = {
  legs: 'Beine',
  'lower body': 'Unterkorper',
  pull: 'Pull',
  push: 'Push',
  'upper body': 'Oberkorper',
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

const ITALIAN_SIGNAL_MAP: Record<string, string> = {
  bodybuilding: 'Bodybuilding',
  cardio: 'Cardio',
  endurance: 'Resistenza',
  hypertrophy: 'Ipertrofia',
  mobility: 'Mobilita',
  strength: 'Forza',
  weight_loss: 'Perdita di peso',
};

const GERMAN_SIGNAL_MAP: Record<string, string> = {
  bodybuilding: 'Bodybuilding',
  cardio: 'Cardio',
  endurance: 'Ausdauer',
  hypertrophy: 'Hypertrophie',
  mobility: 'Mobilitat',
  strength: 'Kraft',
  weight_loss: 'Gewichtsverlust',
};

const ARABIC_LEVEL_MAP: Record<string, string> = {
  advanced: 'متقدم',
  beginner: 'مبتدئ',
  intermediate: 'متوسط',
};

const ITALIAN_LEVEL_MAP: Record<string, string> = {
  advanced: 'Avanzato',
  beginner: 'Principiante',
  intermediate: 'Intermedio',
};

const GERMAN_LEVEL_MAP: Record<string, string> = {
  advanced: 'Fortgeschritten',
  beginner: 'Anfanger',
  intermediate: 'Mittelstufe',
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
  if (!text) return text;
  if (language === 'ar') return repairMojibakeText(ARABIC_EXERCISE_NAME_MAP[normalizeText(text)] || text);
  if (language === 'it') return ITALIAN_EXERCISE_NAME_MAP[normalizeText(text)] || text;
  if (language === 'de') return GERMAN_EXERCISE_NAME_MAP[normalizeText(text)] || text;
  return text;
};

export const translateWorkoutType = (value: unknown, language: AppLanguage = 'en') => {
  const text = String(value || '').trim();
  if (!text) return text;
  if (language === 'ar') return repairMojibakeText(ARABIC_WORKOUT_TYPE_MAP[normalizeText(text)] || text);
  if (language === 'it') return ITALIAN_WORKOUT_TYPE_MAP[normalizeText(text)] || text;
  if (language === 'de') return GERMAN_WORKOUT_TYPE_MAP[normalizeText(text)] || text;
  return text;
};

export const translateAiSignal = (value: unknown, language: AppLanguage = 'en') => {
  const text = String(value || '').trim();
  if (!text) return text;
  const key = normalizeText(text).replace(/\s+/g, '_');
  if (language === 'ar') return repairMojibakeText(ARABIC_SIGNAL_MAP[key] || text);
  if (language === 'it') return ITALIAN_SIGNAL_MAP[key] || text;
  if (language === 'de') return GERMAN_SIGNAL_MAP[key] || text;
  return text;
};

export const translateExperienceLevel = (value: unknown, language: AppLanguage = 'en') => {
  const text = String(value || '').trim();
  if (!text) return text;
  if (language === 'ar') return repairMojibakeText(ARABIC_LEVEL_MAP[normalizeText(text)] || text);
  if (language === 'it') return ITALIAN_LEVEL_MAP[normalizeText(text)] || text;
  if (language === 'de') return GERMAN_LEVEL_MAP[normalizeText(text)] || text;
  return text;
};

export const translateProgramText = (value: unknown, language: AppLanguage = 'en') => {
  const text = String(value || '').trim();
  if (!text) return text;
  if (language === 'ar') return repairMojibakeText(replaceByMap(text, PROGRAM_TEXT_REPLACEMENTS));
  if (language === 'it') {
    return replaceByMap(text, [
      ['Strength & Bulk Plan', 'Piano Forza e Massa'],
      ['Upper / Lower', 'Parte Superiore / Inferiore'],
      ['Upper/Lower', 'Parte Superiore/Inferiore'],
      ['Current Program', 'Programma Attuale'],
      ['Lower Body', 'Parte Inferiore'],
      ['Upper Body', 'Parte Superiore'],
      ['Push Hypertrophy', 'Spinta Ipertrofia'],
      ['Push Strength', 'Spinta Forza'],
      ['Upper Balance', 'Equilibrio Parte Superiore'],
      ['Lower B', 'Inferiore B'],
      ['Lower A', 'Inferiore A'],
      ['Upper B', 'Superiore B'],
      ['Upper A', 'Superiore A'],
      ['Legs B', 'Gambe B'],
      ['Legs A', 'Gambe A'],
      ['Pull B', 'Tirata B'],
      ['Pull A', 'Tirata A'],
      ['Push B', 'Spinta B'],
      ['Push A', 'Spinta A'],
      ['Week', 'Settimana'],
      ['Program', 'Programma'],
      ['Workout', 'Allenamento'],
    ]);
  }
  if (language === 'de') {
    return replaceByMap(text, [
      ['Strength & Bulk Plan', 'Kraft- und Masseplan'],
      ['Upper / Lower', 'Oberkorper / Unterkorper'],
      ['Upper/Lower', 'Oberkorper/Unterkorper'],
      ['Current Program', 'Aktuelles Programm'],
      ['Lower Body', 'Unterkorper'],
      ['Upper Body', 'Oberkorper'],
      ['Push Hypertrophy', 'Push Hypertrophie'],
      ['Push Strength', 'Push Kraft'],
      ['Upper Balance', 'Oberkorper Balance'],
      ['Lower B', 'Unterkorper B'],
      ['Lower A', 'Unterkorper A'],
      ['Upper B', 'Oberkorper B'],
      ['Upper A', 'Oberkorper A'],
      ['Legs B', 'Beine B'],
      ['Legs A', 'Beine A'],
      ['Pull B', 'Pull B'],
      ['Pull A', 'Pull A'],
      ['Push B', 'Push B'],
      ['Push A', 'Push A'],
      ['Week', 'Woche'],
      ['Program', 'Programm'],
      ['Workout', 'Workout'],
    ]);
  }
  return text;
};
