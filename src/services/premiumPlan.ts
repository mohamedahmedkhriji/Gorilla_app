import { AppLanguage } from './language';
import { buildT2AdaptiveDecision, type T2WorkoutCheckIn } from './t2CheckIn';

export type T2PremiumConfig = {
  planKind: 't2-cut';
  cutIntensity: 'conservative' | 'balanced' | 'aggressive';
  cardioPreference: 'incline_walk' | 'bike' | 'mixed';
  recoveryMode: 'protect' | 'balanced' | 'performance';
};

export type PremiumCardioRecommendation = {
  state: 'locked' | 'required' | 'recommended' | 'recovery' | 'completed';
  badge: string;
  title: string;
  body: string;
  typeLabel: string;
  minutesLabel: string;
  footer: string;
  buttonLabel: string;
  actionWorkoutKey: string | null;
  disabled: boolean;
};

export type PremiumWorkoutCardMeta = {
  displayTitle: string;
  weekLabel: string;
  intensityLabel: string;
  durationLabel: string;
  insight: string;
};

export type PremiumProgressInsight = {
  title: string;
  body: string;
  tone: 'good' | 'watch' | 'hold';
  stats: Array<{ label: string; value: string }>;
};

const STORAGE_KEY = 'assignedProgramTemplate';
const T2_PATTERN = /\bt-?2\b/i;
const T2_CUTTING_PATTERN = /\bcut(ting)?\b|تنشيف|cutting|cardio/i;

export const DEFAULT_T2_PREMIUM_CONFIG: T2PremiumConfig = {
  planKind: 't2-cut',
  cutIntensity: 'balanced',
  cardioPreference: 'incline_walk',
  recoveryMode: 'balanced',
};

const PREMIUM_COPY = {
  en: {
    weekA: 'Week A',
    weekB: 'Week B',
    density: 'Density',
    pump: 'Pump',
    minutes: 'min',
    lockedBadge: 'Unlock After Choosing',
    lockedTitle: 'Choose today workout first',
    lockedBody: 'RepSet unlocks your cardio target after you choose the best session for today.',
    lockedFooter: 'This premium target reacts to your setup and session type.',
    lockedButton: 'Choose Best Session',
    requiredBadge: 'Required',
    recommendedBadge: 'Recommended',
    recoveryBadge: 'Recovery Led',
    completedBadge: 'Done Today',
    completedTitle: 'Today session is already complete',
    completedBody: 'Use Progress to review the next premium adjustment before the next session.',
    completedFooter: 'RepSet will keep adapting the cut as more data comes in.',
    completedButton: 'Completed',
    cardioFooterRequired: 'This cardio target is part of your premium cut flow today.',
    cardioFooterRecommended: 'RepSet recommends this target to keep the cut moving without overspending recovery.',
    cardioFooterRecovery: 'Recovery protection is active, so cardio is kept lighter today.',
    cardioTitle: 'Post-workout cardio',
    longCardioTitle: 'Primary cardio block',
    inclineWalk: 'Incline walk',
    bike: 'Bike',
    mixed: 'Mixed cardio',
    heroEyebrow: 'Premium Cut Day',
    heroNoteRequired: 'Today is a push day for the cut. Hit the lift, then finish the cardio target.',
    heroNoteRecommended: 'Training quality stays first today. Cardio adjusts around recovery and cut mode.',
    heroNoteRecovery: 'Muscle-protection mode is active. RepSet is keeping cardio lighter to protect performance.',
    insightPicked: 'Today active premium session',
    insightRecommended: 'Best next to keep recovery and fat-loss balanced',
    insightDensity: 'Density block for structure and tension',
    insightPump: 'Pump block for fullness and metabolic stress',
    progressTitle: 'T-2 Premium Control',
    progressBodyGood: 'The cut is in a stable zone. Keep quality high and let the plan accumulate clean weeks.',
    progressBodyWatch: 'Recovery pressure is building. RepSet is biasing clean execution over extra fatigue.',
    progressBodyHold: 'Adherence is the priority right now. Keep the plan moving before raising demand.',
    progressMode: 'Mode',
    progressCardio: 'Cardio',
    progressPressure: 'Week pressure',
  },
  ar: {
    weekA: 'الأسبوع A',
    weekB: 'الأسبوع B',
    density: 'كثافة',
    pump: 'ضخ',
    minutes: 'د',
    lockedBadge: 'افتحه بعد الاختيار',
    lockedTitle: 'اختر تمرين اليوم أولاً',
    lockedBody: 'يقوم RepSet بفتح هدف الكارديو بعد اختيار أفضل حصة لليوم.',
    lockedFooter: 'هذا الهدف المميز يتغير حسب إعداداتك ونوع الحصة.',
    lockedButton: 'اختر أفضل حصة',
    requiredBadge: 'إلزامي',
    recommendedBadge: 'موصى به',
    recoveryBadge: 'حسب الاستشفاء',
    completedBadge: 'تم اليوم',
    completedTitle: 'تم إكمال حصة اليوم',
    completedBody: 'استخدم صفحة التقدم لمراجعة التعديل التالي قبل الحصة القادمة.',
    completedFooter: 'سيواصل RepSet تعديل التنشيف كلما دخلت بيانات أكثر.',
    completedButton: 'مكتمل',
    cardioFooterRequired: 'هدف الكارديو هذا جزء من مسار التنشيف المميز اليوم.',
    cardioFooterRecommended: 'يوصي RepSet بهذا الهدف لتحريك التنشيف بدون سحب زائد من الاستشفاء.',
    cardioFooterRecovery: 'تم تفعيل حماية الاستشفاء، لذلك الكارديو أخف اليوم.',
    cardioTitle: 'كارديو بعد التمرين',
    longCardioTitle: 'بلوك الكارديو الأساسي',
    inclineWalk: 'مشي مائل',
    bike: 'دراجة',
    mixed: 'كارديو متنوع',
    heroEyebrow: 'يوم التنشيف المميز',
    heroNoteRequired: 'اليوم يوم دفع للتنشيف. أنجز الحديد ثم أكمل هدف الكارديو.',
    heroNoteRecommended: 'جودة التمرين هي الأولوية اليوم، والكارديو يتكيف مع الاستشفاء ووضع التنشيف.',
    heroNoteRecovery: 'تم تفعيل وضع حماية العضلة. RepSet يجعل الكارديو أخف لحماية الأداء.',
    insightPicked: 'حصة اليوم المميزة',
    insightRecommended: 'أفضل خيار تالٍ لموازنة الاستشفاء مع التنشيف',
    insightDensity: 'بلوك كثافة للبناء وجودة الشد',
    insightPump: 'بلوك ضخ للامتلاء والإجهاد الأيضي',
    progressTitle: 'تحكم T-2 المميز',
    progressBodyGood: 'التنشيف في منطقة مستقرة. حافظ على الجودة ودع الخطة تتراكم بأسابيع نظيفة.',
    progressBodyWatch: 'ضغط الاستشفاء يرتفع. RepSet يفضل جودة التنفيذ على زيادة الإجهاد.',
    progressBodyHold: 'الأولوية الآن للالتزام. استمر في الخطة قبل رفع الطلب أكثر.',
    progressMode: 'الوضع',
    progressCardio: 'الكارديو',
    progressPressure: 'ضغط الأسبوع',
  },
  it: {
    weekA: 'Settimana A',
    weekB: 'Settimana B',
    density: 'Densita',
    pump: 'Pump',
    minutes: 'min',
    lockedBadge: 'Sblocca Dopo La Scelta',
    lockedTitle: 'Scegli prima il workout di oggi',
    lockedBody: 'RepSet sblocca il target cardio dopo che scegli la sessione migliore per oggi.',
    lockedFooter: 'Questo target premium reagisce alla tua configurazione e al tipo di sessione.',
    lockedButton: 'Scegli La Sessione',
    requiredBadge: 'Obbligatorio',
    recommendedBadge: 'Consigliato',
    recoveryBadge: 'Guidato dal recupero',
    completedBadge: 'Fatto Oggi',
    completedTitle: 'La sessione di oggi e gia completa',
    completedBody: 'Usa Progressi per rivedere il prossimo aggiustamento premium.',
    completedFooter: 'RepSet continuera ad adattare il cutting con piu dati.',
    completedButton: 'Completato',
    cardioFooterRequired: 'Questo target cardio fa parte del tuo flusso premium di cutting oggi.',
    cardioFooterRecommended: 'RepSet consiglia questo target per far avanzare il cutting senza stressare troppo il recupero.',
    cardioFooterRecovery: 'La protezione del recupero e attiva, quindi il cardio oggi resta piu leggero.',
    cardioTitle: 'Cardio post-workout',
    longCardioTitle: 'Blocco cardio principale',
    inclineWalk: 'Camminata inclinata',
    bike: 'Bike',
    mixed: 'Cardio misto',
    heroEyebrow: 'Giorno Premium Cutting',
    heroNoteRequired: 'Oggi il cutting chiede di spingere. Fai il workout e poi chiudi il target cardio.',
    heroNoteRecommended: 'La qualita dell allenamento resta al primo posto. Il cardio oggi si adatta al recupero.',
    heroNoteRecovery: 'La modalita protezione muscolare e attiva. RepSet tiene il cardio piu leggero per proteggere la performance.',
    insightPicked: 'Sessione premium attiva di oggi',
    insightRecommended: 'Migliore prossimo passo per bilanciare recupero e cutting',
    insightDensity: 'Blocco densita per struttura e tensione',
    insightPump: 'Blocco pump per pienezza e stress metabolico',
    progressTitle: 'Controllo Premium T-2',
    progressBodyGood: 'Il cutting e stabile. Mantieni alta la qualita e lascia che il piano accumuli settimane pulite.',
    progressBodyWatch: 'La pressione sul recupero sta salendo. RepSet privilegia l esecuzione pulita.',
    progressBodyHold: 'La priorita ora e l aderenza. Continua il piano prima di aumentare la richiesta.',
    progressMode: 'Modalita',
    progressCardio: 'Cardio',
    progressPressure: 'Pressione settimanale',
  },
  de: {
    weekA: 'Woche A',
    weekB: 'Woche B',
    density: 'Dichte',
    pump: 'Pump',
    minutes: 'min',
    lockedBadge: 'Nach Auswahl Freischalten',
    lockedTitle: 'Waehle zuerst dein heutiges Workout',
    lockedBody: 'RepSet schaltet dein Cardio-Ziel frei, sobald du die beste Einheit fuer heute waehlst.',
    lockedFooter: 'Dieses Premium-Ziel reagiert auf dein Setup und den Session-Typ.',
    lockedButton: 'Beste Einheit Waehlen',
    requiredBadge: 'Pflicht',
    recommendedBadge: 'Empfohlen',
    recoveryBadge: 'Erholungsgefuehrt',
    completedBadge: 'Heute Erledigt',
    completedTitle: 'Die heutige Einheit ist schon erledigt',
    completedBody: 'Nutze Fortschritt, um die naechste Premium-Anpassung zu sehen.',
    completedFooter: 'RepSet passt den Cut mit mehr Daten weiter an.',
    completedButton: 'Erledigt',
    cardioFooterRequired: 'Dieses Cardio-Ziel ist heute Teil deines Premium-Cut-Ablaufs.',
    cardioFooterRecommended: 'RepSet empfiehlt dieses Ziel, um den Cut voranzubringen ohne zu viel Erholung zu verbrauchen.',
    cardioFooterRecovery: 'Erholungsschutz ist aktiv, deshalb bleibt das Cardio heute leichter.',
    cardioTitle: 'Cardio nach dem Workout',
    longCardioTitle: 'Haupt-Cardioblock',
    inclineWalk: 'Steigungslaufband',
    bike: 'Fahrrad',
    mixed: 'Gemischtes Cardio',
    heroEyebrow: 'Premium-Cut-Tag',
    heroNoteRequired: 'Heute darf der Cut druecken. Erledige das Workout und dann das Cardio-Ziel.',
    heroNoteRecommended: 'Trainingsqualitaet bleibt heute zuerst. Das Cardio passt sich an die Erholung an.',
    heroNoteRecovery: 'Muskel-Schutzmodus ist aktiv. RepSet haelt das Cardio heute leichter, um Leistung zu schuetzen.',
    insightPicked: 'Aktive Premium-Einheit fuer heute',
    insightRecommended: 'Bester naechster Schritt fuer Erholung und Fettverlust',
    insightDensity: 'Dichteblock fuer Struktur und Spannung',
    insightPump: 'Pumpblock fuer Fuelle und metabolischen Stress',
    progressTitle: 'T-2 Premium-Steuerung',
    progressBodyGood: 'Der Cut ist stabil. Halte die Qualitaet hoch und sammle saubere Wochen.',
    progressBodyWatch: 'Erholungsdruck steigt. RepSet priorisiert saubere Ausfuehrung vor extra Ermuedung.',
    progressBodyHold: 'Adhaerenz hat jetzt Prioritaet. Bewege den Plan weiter, bevor du die Nachfrage erhoehst.',
    progressMode: 'Modus',
    progressCardio: 'Cardio',
    progressPressure: 'Wochenlast',
  },
} as const;

const getCopy = (language: AppLanguage) => PREMIUM_COPY[language as keyof typeof PREMIUM_COPY] || PREMIUM_COPY.en;

const safeParseJson = <T,>(raw: string | null, fallback: T): T => {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

const normalizeConfig = (raw: Partial<T2PremiumConfig> | null | undefined): T2PremiumConfig => ({
  planKind: 't2-cut',
  cutIntensity: raw?.cutIntensity === 'conservative' || raw?.cutIntensity === 'aggressive' ? raw.cutIntensity : 'balanced',
  cardioPreference: raw?.cardioPreference === 'bike' || raw?.cardioPreference === 'mixed' ? raw.cardioPreference : 'incline_walk',
  recoveryMode: raw?.recoveryMode === 'protect' || raw?.recoveryMode === 'performance' ? raw.recoveryMode : 'balanced',
});

const getAssignedTemplate = () => safeParseJson<Record<string, any> | null>(
  typeof window === 'undefined' ? null : window.localStorage.getItem(STORAGE_KEY),
  null,
);

const getPlanNameCandidates = (programData?: any) => {
  const stored = getAssignedTemplate();
  return [
    stored?.planName,
    stored?.name,
    stored?.description,
    programData?.planName,
    programData?.name,
    programData?.description,
  ].map((value) => String(value || '').trim()).filter(Boolean);
};

const isT2Plan = (programData?: any) => {
  const candidates = getPlanNameCandidates(programData);
  const hasT2Token = candidates.some((value) => T2_PATTERN.test(value));
  if (!hasT2Token) return false;

  const hasCuttingSignal = candidates.some((value) => T2_CUTTING_PATTERN.test(value));
  const hasPremiumConfig = Boolean(
    programData?.premiumPlanConfig
    || programData?.assignedProgramTemplate?.premiumPlanConfig,
  );

  return hasCuttingSignal || hasPremiumConfig;
};

const parseWorkoutLabel = (workoutName: string) => {
  const value = String(workoutName || '').trim();
  const match = value.match(/^Week\s+([A-Za-z0-9]+)\s*-\s*(.+)$/i);
  if (!match) {
    return { weekToken: '', focusTitle: value };
  }
  return {
    weekToken: String(match[1] || '').trim().toUpperCase(),
    focusTitle: String(match[2] || '').trim() || value,
  };
};

const getFocusCategory = (workoutName: string) => {
  const value = String(workoutName || '').toLowerCase();
  if (/long cardio|cardio \+ core|cardio/.test(value)) return 'cardio';
  if (/leg|quad|hamstring|glute/.test(value)) return 'legs';
  if (/back/.test(value)) return 'back';
  if (/chest|upper chest/.test(value)) return 'chest';
  if (/shoulder|delt|arm|tricep|bicep/.test(value)) return 'upper';
  return 'general';
};

const getBaseCardioMinutes = (config: T2PremiumConfig, category: string) => {
  if (category === 'cardio') {
    if (config.cutIntensity === 'aggressive') return 55;
    if (config.cutIntensity === 'conservative') return 40;
    return 45;
  }

  const base = config.cutIntensity === 'aggressive'
    ? 20
    : config.cutIntensity === 'conservative'
      ? 10
      : 15;

  if (category === 'legs') {
    return config.recoveryMode === 'protect' ? Math.max(8, base - 5) : Math.max(10, base - 2);
  }

  if (category === 'back') {
    return config.recoveryMode === 'protect' ? Math.max(10, base - 3) : base;
  }

  return base;
};

const getCardioTypeLabel = (config: T2PremiumConfig, language: AppLanguage) => {
  const copy = getCopy(language);
  if (config.cardioPreference === 'bike') return copy.bike;
  if (config.cardioPreference === 'mixed') return copy.mixed;
  return copy.inclineWalk;
};

const getModeLabel = (config: T2PremiumConfig, language: AppLanguage) => {
  if (language === 'ar') {
    if (config.cutIntensity === 'aggressive') return '\u0647\u062c\u0648\u0645\u064a';
    if (config.cutIntensity === 'conservative') return '\u0645\u062d\u0627\u0641\u0638';
    return '\u0645\u062a\u0648\u0627\u0632\u0646';
  }
  if (language === 'it') {
    if (config.cutIntensity === 'aggressive') return 'Aggressivo';
    if (config.cutIntensity === 'conservative') return 'Conservativo';
    return 'Bilanciato';
  }
  if (language === 'de') {
    if (config.cutIntensity === 'aggressive') return 'Aggressiv';
    if (config.cutIntensity === 'conservative') return 'Konservativ';
    return 'Ausgewogen';
  }
  if (config.cutIntensity === 'aggressive') return 'Aggressive';
  if (config.cutIntensity === 'conservative') return 'Conservative';
  return 'Balanced';
};

const formatMinutesLabel = (minutes: number, language: AppLanguage) => `${minutes} ${getCopy(language).minutes}`;

export const getActiveT2PremiumConfig = (programData?: any): T2PremiumConfig | null => {
  const stored = getAssignedTemplate();
  if (!isT2Plan(programData) && !isT2Plan(stored)) return null;
  return normalizeConfig(
    stored?.premiumPlanConfig
    ?? programData?.premiumPlanConfig
    ?? programData?.assignedProgramTemplate?.premiumPlanConfig,
  );
};

export const buildT2PremiumCardMeta = ({
  language,
  workoutName,
  exerciseCount,
  isPickedForToday,
  isRecommendedNext,
}: {
  language: AppLanguage;
  workoutName: string;
  exerciseCount: number;
  isPickedForToday?: boolean;
  isRecommendedNext?: boolean;
}): PremiumWorkoutCardMeta => {
  const copy = getCopy(language);
  const parsed = parseWorkoutLabel(workoutName);
  const category = getFocusCategory(parsed.focusTitle || workoutName);
  const durationMinutes = Math.max(35, Math.min(90, (Number(exerciseCount || 0) * 8) + 12));
  const weekLabel = parsed.weekToken === 'A'
    ? copy.weekA
    : parsed.weekToken === 'B'
      ? copy.weekB
      : parsed.weekToken ? `Week ${parsed.weekToken}` : '';
  const intensityLabel = parsed.weekToken === 'A'
    ? copy.density
    : parsed.weekToken === 'B'
      ? copy.pump
      : category === 'cardio'
        ? copy.pump
        : copy.density;

  let insight = parsed.weekToken === 'B' ? copy.insightPump : copy.insightDensity;
  if (isPickedForToday) insight = copy.insightPicked;
  if (isRecommendedNext && !isPickedForToday) insight = copy.insightRecommended;

  return {
    displayTitle: parsed.focusTitle || workoutName,
    weekLabel,
    intensityLabel,
    durationLabel: formatMinutesLabel(durationMinutes, language),
    insight,
  };
};

export const buildT2PremiumCardioRecommendation = ({
  language,
  config,
  selectedWorkoutName,
  selectedWorkoutKey,
  recommendedWorkoutKey,
  hasTodaySelection,
  isTodaySelectionCompleted,
  latestCheckIn,
}: {
  language: AppLanguage;
  config: T2PremiumConfig;
  selectedWorkoutName?: string;
  selectedWorkoutKey?: string;
  recommendedWorkoutKey?: string;
  hasTodaySelection: boolean;
  isTodaySelectionCompleted: boolean;
  latestCheckIn?: T2WorkoutCheckIn | null;
}): PremiumCardioRecommendation => {
  const copy = getCopy(language);
  if (isTodaySelectionCompleted) {
    return {
      state: 'completed',
      badge: copy.completedBadge,
      title: copy.completedTitle,
      body: copy.completedBody,
      typeLabel: getCardioTypeLabel(config, language),
      minutesLabel: formatMinutesLabel(getBaseCardioMinutes(config, 'general'), language),
      footer: copy.completedFooter,
      buttonLabel: copy.completedButton,
      actionWorkoutKey: null,
      disabled: true,
    };
  }

  if (!hasTodaySelection) {
    return {
      state: 'locked',
      badge: copy.lockedBadge,
      title: copy.lockedTitle,
      body: copy.lockedBody,
      typeLabel: getCardioTypeLabel(config, language),
      minutesLabel: formatMinutesLabel(getBaseCardioMinutes(config, 'general'), language),
      footer: copy.lockedFooter,
      buttonLabel: copy.lockedButton,
      actionWorkoutKey: recommendedWorkoutKey || null,
      disabled: !recommendedWorkoutKey,
    };
  }

  const category = getFocusCategory(selectedWorkoutName || '');
  const adaptiveDecision = buildT2AdaptiveDecision({ language, current: latestCheckIn || null });
  const minutes = Math.max(
    category === 'cardio' ? 25 : 8,
    getBaseCardioMinutes(config, category) + Number(adaptiveDecision?.cardioAdjustmentMinutes || 0),
  );
  const typeLabel = getCardioTypeLabel(config, language);
  const isLongCardio = category === 'cardio';
  const recoveryModeLight = category === 'legs' && config.recoveryMode === 'protect';
  const state = adaptiveDecision?.tone === 'recover' && !isLongCardio
    ? 'recovery'
    : isLongCardio
      ? 'required'
      : recoveryModeLight
        ? 'recovery'
        : config.cutIntensity === 'conservative'
          ? 'recommended'
          : 'required';

  return {
    state,
    badge: state === 'required' ? copy.requiredBadge : state === 'recommended' ? copy.recommendedBadge : copy.recoveryBadge,
    title: isLongCardio ? copy.longCardioTitle : copy.cardioTitle,
    body: adaptiveDecision?.body || (
      state === 'required'
        ? copy.heroNoteRequired
        : state === 'recommended'
          ? copy.heroNoteRecommended
          : copy.heroNoteRecovery
    ),
    typeLabel,
    minutesLabel: formatMinutesLabel(minutes, language),
    footer: adaptiveDecision?.loadAction || (
      state === 'required'
        ? copy.cardioFooterRequired
        : state === 'recommended'
          ? copy.cardioFooterRecommended
          : copy.cardioFooterRecovery
    ),
    buttonLabel: language === 'ar'
      ? 'ابدأ تمريني'
      : language === 'it'
        ? 'Avvia Workout'
        : language === 'de'
          ? 'Workout Starten'
          : 'Start Workout',
    actionWorkoutKey: selectedWorkoutKey || null,
    disabled: !selectedWorkoutKey,
  };
};

export const buildT2PremiumProgressInsight = ({
  language,
  config,
  completionPercent,
  workoutsRemainingThisWeek,
  latestCheckIn,
}: {
  language: AppLanguage;
  config: T2PremiumConfig;
  completionPercent: number;
  workoutsRemainingThisWeek: number;
  latestCheckIn?: T2WorkoutCheckIn | null;
}): PremiumProgressInsight => {
  const copy = getCopy(language);
  const adaptiveDecision = buildT2AdaptiveDecision({ language, current: latestCheckIn || null });
  const baseCardio = Math.max(
    8,
    getBaseCardioMinutes(config, workoutsRemainingThisWeek > 1 ? 'legs' : 'general') + Number(adaptiveDecision?.cardioAdjustmentMinutes || 0),
  );
  const tone = adaptiveDecision?.tone === 'recover'
    ? 'watch'
    : adaptiveDecision?.tone === 'hold'
      ? 'hold'
      : completionPercent >= 75
        ? 'good'
        : completionPercent >= 45
          ? 'watch'
          : 'hold';

  return {
    title: copy.progressTitle,
    body: adaptiveDecision?.body || (
      tone === 'good'
        ? copy.progressBodyGood
        : tone === 'watch'
          ? copy.progressBodyWatch
          : copy.progressBodyHold
    ),
    tone,
    stats: [
      { label: copy.progressMode, value: getModeLabel(config, language) },
      { label: copy.progressCardio, value: formatMinutesLabel(baseCardio, language) },
      { label: copy.progressPressure, value: adaptiveDecision?.badge || `${Math.max(0, workoutsRemainingThisWeek)}` },
    ],
  };
};
