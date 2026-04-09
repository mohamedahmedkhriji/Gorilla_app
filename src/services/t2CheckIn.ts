import { AppLanguage } from './language';

export const T2_CHECKIN_UPDATED_EVENT = 't2-checkin-updated';

export type T2WorkoutCheckIn = {
  summaryDate: string;
  workoutName: string;
  pumpScore: number;
  sorenessScore: number;
  fatigueScore: number;
  sleepHours: number;
  moodScore: number;
  jointPainScore: number;
  bodyweightKg: number | null;
  createdAt: string;
  updatedAt: string;
};

export type T2AdaptiveDecision = {
  tone: 'push' | 'hold' | 'recover';
  badge: string;
  title: string;
  body: string;
  cardioAdjustmentMinutes: number;
  loadAction: string;
};

const STORAGE_KEY = 't2PremiumWorkoutCheckIns';

const COPY = {
  en: {
    badgePush: 'Push',
    badgeHold: 'Hold',
    badgeRecover: 'Recover',
    pushTitle: 'Quality stayed high today',
    holdTitle: 'Hold the stimulus steady',
    recoverTitle: 'Recovery protection is active',
    pushBody: 'Pump, mood, and fatigue are in a clean range. RepSet can keep pressure on the cut next session.',
    holdBody: 'The session was solid, but not a day to force progression. Keep load stable and execute cleanly.',
    recoverBody: 'Fatigue, soreness, or sleep are asking for a lighter follow-up. Protect output before adding more demand.',
    fastLossNote: 'Bodyweight is dropping quickly, so the next step should stay muscle-protective.',
    stalledNote: 'Bodyweight is not moving much yet, so cardio pressure can stay on.',
    loadPush: 'Keep load or progress small',
    loadHold: 'Hold load and repeat clean reps',
    loadRecover: 'Reduce fatigue before pushing load',
  },
  ar: {
    badgePush: 'دفع',
    badgeHold: 'ثبات',
    badgeRecover: 'استشفاء',
    pushTitle: 'جودة الحصة كانت قوية اليوم',
    holdTitle: 'ثبّت التحفيز للحصة القادمة',
    recoverTitle: 'تم تفعيل حماية الاستشفاء',
    pushBody: 'الضخ والمزاج والإجهاد في نطاق جيد. يستطيع RepSet إبقاء ضغط التنشيف مرتفعًا في الحصة القادمة.',
    holdBody: 'الحصة كانت جيدة، لكن ليس هذا الوقت لفرض زيادة. ثبّت الحمل ونفّذ بجودة.',
    recoverBody: 'الإجهاد أو الألم أو النوم يشير إلى متابعة أخف. احمِ الأداء قبل زيادة الطلب.',
    fastLossNote: 'الوزن ينخفض بسرعة، لذلك يجب أن تكون الخطوة القادمة أكثر حفاظًا على العضلة.',
    stalledNote: 'الوزن لا يتحرك كثيرًا بعد، لذلك يمكن إبقاء ضغط الكارديو قائمًا.',
    loadPush: 'ثبّت الحمل أو زد زيادة صغيرة',
    loadHold: 'حافظ على الحمل وكرّر بجودة',
    loadRecover: 'خفف الإجهاد قبل أي زيادة',
  },
  it: {
    badgePush: 'Spingi',
    badgeHold: 'Mantieni',
    badgeRecover: 'Recupero',
    pushTitle: 'La qualita oggi e rimasta alta',
    holdTitle: 'Mantieni stabile lo stimolo',
    recoverTitle: 'La protezione recupero e attiva',
    pushBody: 'Pump, umore e fatica sono in una buona zona. RepSet puo mantenere pressione sul cut nel prossimo workout.',
    holdBody: 'Sessione solida, ma non e il giorno per forzare progressione. Mantieni il carico stabile.',
    recoverBody: 'Fatica, dolore o sonno stanno chiedendo un follow-up piu leggero. Proteggi la performance prima di spingere.',
    fastLossNote: 'Il peso sta scendendo velocemente, quindi il prossimo passo deve proteggere il muscolo.',
    stalledNote: 'Il peso non si sta muovendo molto, quindi la pressione cardio puo restare attiva.',
    loadPush: 'Mantieni o aumenta poco il carico',
    loadHold: 'Mantieni il carico e ripeti pulito',
    loadRecover: 'Riduci la fatica prima di spingere il carico',
  },
  de: {
    badgePush: 'Push',
    badgeHold: 'Halten',
    badgeRecover: 'Erholung',
    pushTitle: 'Die Qualitaet war heute stark',
    holdTitle: 'Halte den Reiz stabil',
    recoverTitle: 'Erholungsschutz ist aktiv',
    pushBody: 'Pump, Stimmung und Ermuedung liegen in einem guten Bereich. RepSet kann den Cut im naechsten Workout weiter druecken.',
    holdBody: 'Die Einheit war solide, aber nicht der Tag fuer erzwungene Progression. Halte die Last stabil.',
    recoverBody: 'Ermuedung, Schmerzen oder Schlaf verlangen nach einer leichteren Folgeeinheit. Schuetze Leistung vor mehr Druck.',
    fastLossNote: 'Das Gewicht faellt schnell, deshalb sollte der naechste Schritt muskel-schonend bleiben.',
    stalledNote: 'Das Gewicht bewegt sich kaum, deshalb kann der Cardio-Druck aktiv bleiben.',
    loadPush: 'Last halten oder leicht steigern',
    loadHold: 'Last halten und sauber wiederholen',
    loadRecover: 'Ermuedung senken, bevor du mehr Last forderst',
  },
} as const;

const getCopy = (language: AppLanguage) => COPY[language as keyof typeof COPY] || COPY.en;

const normalizeWorkoutKey = (summaryDate: string, workoutName: string) =>
  `${String(summaryDate || '').trim()}::${String(workoutName || '').trim().toLowerCase()}`;

const getCurrentUserScope = (userId?: number | null) => {
  const directUserId = Number(userId || 0);
  if (Number.isInteger(directUserId) && directUserId > 0) {
    return `id_${directUserId}`;
  }

  try {
    const storedUser = JSON.parse(localStorage.getItem('appUser') || localStorage.getItem('user') || '{}');
    const localUserId = Number(localStorage.getItem('appUserId') || localStorage.getItem('userId') || 0);
    const parsedUserId = Number(storedUser?.id || 0);
    const resolvedUserId = localUserId || parsedUserId;
    if (Number.isInteger(resolvedUserId) && resolvedUserId > 0) {
      return `id_${resolvedUserId}`;
    }
  } catch {
    // Ignore malformed user payloads.
  }

  return 'guest';
};

const getStorageKey = (userId?: number | null) => `${STORAGE_KEY}:${getCurrentUserScope(userId)}`;

const clampScore = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const normalizeCheckIn = (raw: any): T2WorkoutCheckIn | null => {
  const summaryDate = String(raw?.summaryDate || '').trim();
  const workoutName = String(raw?.workoutName || '').trim();
  if (!summaryDate || !workoutName) return null;

  return {
    summaryDate,
    workoutName,
    pumpScore: clampScore(Math.round(Number(raw?.pumpScore || 0)) || 0, 1, 10),
    sorenessScore: clampScore(Math.round(Number(raw?.sorenessScore ?? 4)) || 4, 1, 10),
    fatigueScore: clampScore(Math.round(Number(raw?.fatigueScore || 0)) || 0, 1, 10),
    sleepHours: clampScore(Number(raw?.sleepHours || 0) || 0, 0, 24),
    moodScore: clampScore(Math.round(Number(raw?.moodScore || 0)) || 0, 1, 10),
    jointPainScore: clampScore(Math.round(Number(raw?.jointPainScore || 0)) || 0, 0, 10),
    bodyweightKg: Number.isFinite(Number(raw?.bodyweightKg))
      ? Number(Number(raw.bodyweightKg).toFixed(1))
      : null,
    createdAt: String(raw?.createdAt || raw?.updatedAt || new Date().toISOString()),
    updatedAt: String(raw?.updatedAt || new Date().toISOString()),
  };
};

const isCheckIn = (value: T2WorkoutCheckIn | null): value is T2WorkoutCheckIn => Boolean(value);

export const readT2WorkoutCheckIns = (userId?: number | null): T2WorkoutCheckIn[] => {
  try {
    const raw = localStorage.getItem(getStorageKey(userId));
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    const normalized = parsed
      .map((entry) => normalizeCheckIn(entry))
      .filter(isCheckIn);
    return normalized.sort((left, right) => String(right.updatedAt).localeCompare(String(left.updatedAt)));
  } catch {
    return [];
  }
};

export const getT2WorkoutCheckInForSummary = (
  summaryDate: string,
  workoutName: string,
  userId?: number | null,
): T2WorkoutCheckIn | null => {
  const lookupKey = normalizeWorkoutKey(summaryDate, workoutName);
  return readT2WorkoutCheckIns(userId).find((entry) =>
    normalizeWorkoutKey(entry.summaryDate, entry.workoutName) === lookupKey) || null;
};

export const getLatestT2WorkoutCheckIn = (userId?: number | null): T2WorkoutCheckIn | null =>
  readT2WorkoutCheckIns(userId)[0] || null;

export const getPreviousT2WorkoutCheckIn = (
  current: T2WorkoutCheckIn | null | undefined,
  userId?: number | null,
): T2WorkoutCheckIn | null => {
  if (!current) return null;
  const currentKey = normalizeWorkoutKey(current.summaryDate, current.workoutName);
  return readT2WorkoutCheckIns(userId).find((entry) =>
    normalizeWorkoutKey(entry.summaryDate, entry.workoutName) !== currentKey) || null;
};

export const saveT2WorkoutCheckIn = (
  input: Omit<T2WorkoutCheckIn, 'createdAt' | 'updatedAt'>,
  userId?: number | null,
): T2WorkoutCheckIn => {
  const nextTimestamp = new Date().toISOString();
  const currentItems = readT2WorkoutCheckIns(userId);
  const nextItem = normalizeCheckIn({
    ...input,
    updatedAt: nextTimestamp,
    createdAt: getT2WorkoutCheckInForSummary(input.summaryDate, input.workoutName, userId)?.createdAt || nextTimestamp,
  });

  if (!nextItem) {
    throw new Error('Invalid T-2 check-in payload.');
  }

  const filtered = currentItems.filter((entry) =>
    normalizeWorkoutKey(entry.summaryDate, entry.workoutName) !== normalizeWorkoutKey(nextItem.summaryDate, nextItem.workoutName));
  const nextItems = [nextItem, ...filtered].sort((left, right) => String(right.updatedAt).localeCompare(String(left.updatedAt)));
  localStorage.setItem(getStorageKey(userId), JSON.stringify(nextItems));
  window.dispatchEvent(new CustomEvent(T2_CHECKIN_UPDATED_EVENT));
  return nextItem;
};

export const deriveT2EnergyLevel = ({
  sorenessScore,
  fatigueScore,
  sleepHours,
  moodScore,
  jointPainScore,
  pumpScore,
}: Pick<T2WorkoutCheckIn, 'sorenessScore' | 'fatigueScore' | 'sleepHours' | 'moodScore' | 'jointPainScore' | 'pumpScore'>): number => {
  const boundedSleep = clampScore(Math.round(Number(sleepHours || 0)), 0, 10);
  const recoveryReserve = clampScore(10 - Math.round(Number(fatigueScore || 0)), 0, 10);
  const rawScore = (
    (recoveryReserve * 0.38)
    + (Number(moodScore || 0) * 0.24)
    + (boundedSleep * 0.2)
    + (Number(pumpScore || 0) * 0.12)
    - (Math.max(0, Number(sorenessScore || 0) - 4) * 0.28)
    - (Math.max(0, Number(jointPainScore || 0) - 2) * 0.34)
  );

  return clampScore(Math.round(rawScore), 1, 10);
};

export const buildT2AdaptiveDecision = ({
  language,
  current,
  previous,
}: {
  language: AppLanguage;
  current: T2WorkoutCheckIn | null | undefined;
  previous?: T2WorkoutCheckIn | null;
}): T2AdaptiveDecision | null => {
  if (!current) return null;

  const copy = getCopy(language);
  const weightDelta = current.bodyweightKg != null && previous?.bodyweightKg != null
    ? Number((current.bodyweightKg - previous.bodyweightKg).toFixed(1))
    : null;
  const recoveryFlags = [
    current.sorenessScore >= 7,
    current.fatigueScore >= 8,
    current.sleepHours > 0 && current.sleepHours < 6,
    current.jointPainScore >= 6,
    current.moodScore <= 4,
  ].filter(Boolean).length;
  const fastLoss = weightDelta != null && weightDelta <= -1;
  const stalledLoss = weightDelta != null && weightDelta >= -0.1;

  if (recoveryFlags >= 2 || current.jointPainScore >= 7 || fastLoss) {
    return {
      tone: 'recover',
      badge: copy.badgeRecover,
      title: copy.recoverTitle,
      body: fastLoss ? `${copy.recoverBody} ${copy.fastLossNote}` : copy.recoverBody,
      cardioAdjustmentMinutes: fastLoss ? -10 : -5,
      loadAction: copy.loadRecover,
    };
  }

  if (
    current.pumpScore >= 8
    && current.sorenessScore <= 5
    && current.fatigueScore <= 6
    && current.sleepHours >= 7
    && current.moodScore >= 6
    && current.jointPainScore <= 3
  ) {
    return {
      tone: 'push',
      badge: copy.badgePush,
      title: copy.pushTitle,
      body: stalledLoss ? `${copy.pushBody} ${copy.stalledNote}` : copy.pushBody,
      cardioAdjustmentMinutes: stalledLoss ? 5 : 0,
      loadAction: copy.loadPush,
    };
  }

  return {
    tone: 'hold',
    badge: copy.badgeHold,
    title: copy.holdTitle,
    body: stalledLoss ? `${copy.holdBody} ${copy.stalledNote}` : copy.holdBody,
    cardioAdjustmentMinutes: 0,
    loadAction: copy.loadHold,
  };
};
